export const RENTAL_RATES = {
  vip:{name:'VIP Lounge',units:{hour:5_000_000}},
  upper:{name:'Oberer Bereich',units:{week:10_000_000,four_weeks:25_000_000}},
};
const partsFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
function wallParts(date) {
  return Object.fromEntries(partsFormatter.formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
}
function wallMillis(p){return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second||0);}
export function berlinDateTime(value) {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Bitte einen gültigen Beginn eingeben.');
  const [year,month,day,hour,minute]=value.match(/\d+/g).map(Number);
  const calendar=new Date(Date.UTC(year,month-1,day));
  if(month<1||month>12||day<1||calendar.getUTCDate()!==day||calendar.getUTCMonth()!==month-1||hour>23||minute>59)throw new Error('Bitte einen gültigen Beginn eingeben.');
  const p={year,month,day,hour,minute,second:0},wall=wallMillis(p);
  let result=wall;
  for(let i=0;i<4;i++)result+=wall-wallMillis(wallParts(new Date(result)));
  if(wallMillis(wallParts(new Date(result)))!==wall)throw new Error('Diese Uhrzeit existiert wegen der Zeitumstellung nicht. Bitte eine andere Uhrzeit wählen.');
  return new Date(result);
}
export function rentalQuote({space,unit,quantity,start,free=false,unlimited=false}) {
  if(typeof free!=='boolean'||typeof unlimited!=='boolean')throw new Error('Kostenlos und Unbegrenzt müssen als Ankreuzoptionen angegeben werden.');
  const tariff=RENTAL_RATES[space]?.units?.[unit];
  if(!Number.isInteger(tariff)||tariff<=0)throw new Error('Bitte einen passenden Tarif wählen.');
  if(space==='upper'){
    quantity=unit==='week'?1:4;
    unit='week';
  }else if(unlimited)quantity=1;
  else if(!Number.isInteger(quantity)||quantity<1||quantity>52)throw new Error('Bitte eine Dauer von 1 bis 52 Stunden wählen.');
  const rate=free?0:space==='upper'?tariff/quantity:tariff;
  const from=berlinDateTime(start);
  if(from.getUTCFullYear()<2020||from.getUTCFullYear()>2090)throw new Error('Der Beginn muss zwischen 2020 und 2090 liegen.');
  let to=null;
  if(unlimited)to=null;
  else if(unit==='hour')to=new Date(+from+quantity*3_600_000);
  else {
    const p=wallParts(from);
    const calendar=new Date(Date.UTC(p.year,p.month-1,p.day));
    calendar.setUTCDate(calendar.getUTCDate()+quantity*7);
    const pad=n=>String(n).padStart(2,'0');
    to=berlinDateTime(`${calendar.getUTCFullYear()}-${pad(calendar.getUTCMonth()+1)}-${pad(calendar.getUTCDate())}T${pad(p.hour)}:${pad(p.minute)}`);
  }
  return {space,space_name:RENTAL_RATES[space].name,unit,quantity,starts_at:from.toISOString(),ends_at:to?to.toISOString():null,rate_cents:rate,total_cents:rate*quantity,currency:'USD',is_free:free,is_unlimited:unlimited};
}
