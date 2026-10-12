import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,initializeDatabase} from '../lib/database.js';
import {createApp} from '../lib/app.js';

test('VIP Lounge und Oberer Bereich sind unabhängig vermietbar',async t=>{
  const db=await openDatabase({memory:true});await initializeDatabase(db);
  const server=createApp(db,{accessPassword:'test-rental-access'}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}/api`;let cookie;
  async function call(path,body){
    const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
    return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
  }
  cookie=(await call('/login',{name:'Vermietung Team',password:'test-rental-access'})).cookie;
  const rental=(space,start)=>({id:randomUUID(),space,start,unit:space==='vip'?'hour':'week',quantity:2,customer_name:space==='vip'?'VIP Gast':'Gast oben',phone:'555-0100'});

  await t.test('Zuerst oben, dann VIP im selben Zeitraum: beide Gäste und beide Einnahmen gespeichert',async()=>{
    const upper=await call('/rentals',rental('upper','2030-01-01T18:00'));
    const vip=await call('/rentals',rental('vip','2030-01-02T18:00'));
    assert.equal(upper.status,201);assert.equal(vip.status,201);
    assert.ok(vip.data.rental.starts_at>upper.data.rental.starts_at);assert.ok(vip.data.rental.ends_at<upper.data.rental.ends_at);
    const saved=(await call('/rentals')).data.rentals;
    assert.equal(saved.find(r=>r.id===upper.data.rental.id).space,'upper');assert.equal(saved.find(r=>r.id===vip.data.rental.id).space,'vip');
    const finance=(await call('/finance')).data;
    assert.equal(Number(finance.totals.rental_income_cents),20000000);
    for(const r of [upper,vip])assert.equal(finance.entries.filter(e=>e.rental_id===r.data.rental.id).length,1);
  });
  await t.test('Zuerst VIP, dann oben mit identischem Beginn; nur Doppelbelegung desselben Bereichs gesperrt',async()=>{
    const start='2031-01-01T18:00';
    assert.equal((await call('/rentals',rental('vip',start))).status,201);
    assert.equal((await call('/rentals',rental('upper',start))).status,201);
    for(const [space,name] of [['vip','VIP Lounge'],['upper','Oberer Bereich']]){
      const rejected=await call('/rentals',rental(space,start));assert.equal(rejected.status,409);assert.ok(rejected.data.error.includes(name));
    }
    const finance=(await call('/finance')).data;assert.equal(finance.entries.length,4);assert.equal(Number(finance.totals.rental_income_cents),40000000);
  });
  await t.test('Gleichzeitige Anfragen und Wiederholungen für beide Bereiche buchen jede Einnahme einmal',async()=>{
    const bodies=[rental('vip','2032-01-01T18:00'),rental('upper','2032-01-01T18:00')];
    const results=await Promise.all(bodies.map(body=>call('/rentals',body)));assert.deepEqual(results.map(r=>r.status),[201,201]);
    const retries=await Promise.all(bodies.map(body=>call('/rentals',body)));assert.deepEqual(retries.map(r=>r.status),[201,201]);
    const upper=bodies.find(b=>b.space==='upper'),vip=bodies.find(b=>b.space==='vip');
    let finance=(await call('/finance')).data;assert.equal(finance.entries.length,6);assert.equal(Number(finance.totals.rental_income_cents),60000000);
    assert.equal((await call('/rentals/'+upper.id+'/cancel',{reason:'Gast oben hat abgesagt'})).status,200);
    const saved=(await call('/rentals')).data.rentals;assert.ok(saved.find(r=>r.id===upper.id).cancelled_at);assert.equal(saved.find(r=>r.id===vip.id).cancelled_at,null);
    assert.equal((await call('/rentals',rental('vip',vip.start))).status,409);
    assert.equal((await call('/rentals',rental('upper',upper.start))).status,201);
    finance=(await call('/finance')).data;assert.equal(Number(finance.totals.rental_income_cents),60000000);
    assert.equal(finance.entries.find(e=>e.rental_id===vip.id).voided_at,null);assert.ok(finance.entries.find(e=>e.rental_id===upper.id).voided_at);
  });
  await t.test('Zwei gleichzeitige Reservierungen derselben Lounge erzeugen nur eine Vermietung',async()=>{
    const results=await Promise.all([call('/rentals',rental('vip','2033-01-01T18:00')),call('/rentals',rental('vip','2033-01-01T18:00'))]);
    assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
    const finance=(await call('/finance')).data;assert.equal(Number(finance.totals.rental_income_cents),70000000);
  });
});
