import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,initializeDatabase} from '../lib/database.js';
import {createApp} from '../lib/app.js';

test('Mitarbeiterstatistiken verbinden alle Bereiche ohne Doppelsummen',async t=>{
  const db=await openDatabase({memory:true});await initializeDatabase(db);
  const server=createApp(db,{accessPassword:'statistics-test',loginLimit:1000}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}/api`;let owner,staff,staffId,regular;
  const call=async(route,body,{cookie=owner,method=body?'POST':'GET'}={})=>{const r=await fetch(base+route,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:r.headers.get('content-type')?.includes('json')?await r.json():await r.text(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
  const login=name=>call('/login',{name,password:'statistics-test'});
  const stats=async(range='from=2026-10-15&to=2026-10-15')=>{const result=await call('/employee-statistics?'+range);assert.equal(result.status,200,JSON.stringify(result.data));return result.data.employees.find(e=>e.id===staffId);};
  await t.test('Nur Geschäftsführung und beide Leitungen können alle Mitarbeiter auswerten',async()=>{
    assert.equal((await call('/employee-statistics',undefined,{cookie:null})).status,401);
    owner=(await login('Michael Black')).cookie;const s=await login('=Statistik Team');staff=s.cookie;staffId=s.data.employee.id;regular=(await login('Normales Team')).cookie;
    assert.equal((await call('/employee-statistics',undefined,{cookie:regular})).status,403);
    assert.equal((await call('/employees/'+staffId,{roles:['Security Leitung','Barkeeper'],department:'Bar & Einlass'},{method:'PUT'})).status,200);
    assert.equal((await call('/employee-statistics',undefined,{cookie:staff})).status,200);
  });
  await t.test('Verkäufe, Rabatte, Stornos, Eintritt, VIP, Einkauf und Lohn werden gemeinsam erfasst',async()=>{
    await db.query("UPDATE wallet_accounts SET balance_cents=100000000 WHERE id='bank'");
    const sale={id:randomUUID(),currency:'USD',payment:'cash',discount_percent:25,items:[{productId:'cola',quantity:2,unitPriceCents:30000}]};
    assert.equal((await call('/orders',sale,{cookie:staff})).status,201);
    const voided={...sale,id:randomUUID(),discount_percent:0,items:[{productId:'buddy-bier',quantity:1,unitPriceCents:22500}]};
    assert.equal((await call('/orders',voided,{cookie:staff})).status,201);assert.equal((await call('/orders/'+voided.id+'/void',{reason:'Falsche Bestellung'},{cookie:staff})).status,200);
    assert.equal((await call('/admissions',{id:randomUUID(),unit_price_cents:50000,quantity:3,payment:'card'},{cookie:staff})).status,201);
    for(const free of [false,true])assert.equal((await call('/rentals',{id:randomUUID(),space:'vip',unit:'hour',quantity:1,start:'2026-10-15T20:00',customer_name:'Statistik Gast',phone:'555',free,payment:'bank'},{cookie:staff})).status,201);
    assert.equal((await call('/purchases',{id:randomUUID(),occurred_on:'2026-10-15',reason:'Testlieferung',items:[{productId:'cola',quantity:2,unitCostCents:10000}]},{cookie:staff})).status,201);
    assert.equal((await call('/employees/'+staffId,{roles:['Manager'],department:'Test'},{method:'PUT'})).status,200);
    for(const [kind,amount] of [['income',50000],['expense',10000]])assert.equal((await call('/finance',{id:randomUUID(),kind,amount_cents:amount,reason:'Manuelle Statistik',occurred_on:'2026-10-15',payment:'bank'},{cookie:staff})).status,201);
    const shiftId=randomUUID();await db.query("INSERT INTO time_shifts(id,employee_id,job,hourly_rate_cents,started_at,ended_at,worked_seconds,amount_cents) VALUES($1,$2,'Security',1000000,'2026-10-14T21:30:00Z','2026-10-14T22:30:00Z',3600,1000000)",[shiftId,staffId]);
    await db.query("INSERT INTO payroll_credits(id,employee_id,kind,amount_cents,shift_id,created_at) VALUES($1,$2,'work',1000000,$3,'2026-10-14T22:30:00Z')",[randomUUID(),staffId,shiftId]);
    const payroll=(await call('/payroll/'+staffId)).data;assert.equal((await call('/payroll/payout',{id:randomUUID(),employee_id:staffId,expected_snapshot:payroll.employee.snapshot})).status,201);
    for(const table of ['orders','admissions','rentals','payroll_payouts'])await db.query('UPDATE '+table+" SET created_at='2026-10-15T10:00:00Z' WHERE employee_id=$1",[staffId]);
    await db.query("UPDATE finance_entries SET occurred_on='2026-10-15' WHERE employee_id=$1",[staffId]);
    assert.equal((await call('/employees/'+staffId,{roles:['Security Leitung','Barkeeper'],department:'Bar & Einlass'},{method:'PUT'})).status,200);
    const row=await stats();assert.equal(Number(row.sales_cents),45000);assert.equal(row.sales_count,1);assert.equal(row.voided_sales_count,1);
    assert.equal(Number(row.admission_cents),150000);assert.equal(Number(row.admission_people),3);assert.equal(Number(row.rental_cents),5000000);assert.equal(row.rental_count,2);
    assert.equal(Number(row.purchase_cents),20000);assert.equal(Number(row.other_income_cents),50000);assert.equal(Number(row.revenue_cents),5245000);assert.equal(Number(row.expense_cents),1030000);
    assert.equal(Number(row.worked_seconds),1800);assert.equal(Number(row.earned_cents),1000000);assert.equal(Number(row.paid_cents),1000000);assert.equal(Number(row.pending_cents),0);assert.equal(Number(row.cash_cents),45000);
  });
  await t.test('Berliner Tagesgrenzen begrenzen Stunden und historische Buchungen unabhängig vom aktuellen Bargeld',async()=>{
    const previous=await stats('from=2026-10-14&to=2026-10-14');assert.equal(Number(previous.worked_seconds),1800);assert.equal(Number(previous.sales_cents),0);assert.equal(Number(previous.cash_cents),45000);
    const all=await stats('');assert.equal(Number(all.worked_seconds),3600);
    assert.equal((await call('/employee-statistics?from=2026-10-16&to=2026-10-15')).status,400);
  });
  await t.test('Alle Einzeldaten sind mit stabiler Paginierung und vollständigem CSV abrufbar',async()=>{
    for(let i=0;i<220;i++)await db.query("INSERT INTO stock_movements(id,product_id,employee_id,delta,quantity_after,reason,kind,created_at) VALUES($1,'cola',$2,1,99,'Testhistorie','adjustment','2026-10-15T12:00:00.123456Z')",[randomUUID(),staffId]);
    const records=[];let cursor=null;
    do{
      const result=await call('/employee-statistics/'+staffId+'?from=2026-10-15&to=2026-10-15'+(cursor?'&cursor='+encodeURIComponent(cursor):''),undefined,{cookie:staff});
      assert.equal(result.status,200,JSON.stringify(result.data));records.push(...result.data.records);cursor=result.data.next_cursor;
    }while(cursor);
    assert.equal(records.filter(r=>r.kind==='stock'&&r.notes.includes('Testhistorie')).length,220);
    assert.equal(new Set(records.map(r=>r.kind+':'+r.id)).size,records.length);assert.ok(records.length>220);
    const exportData=await call('/employee-statistics/'+staffId+'/export?from=2026-10-15&to=2026-10-15',undefined,{cookie:staff});assert.equal(exportData.status,200);assert.ok(exportData.data.includes("'=Statistik Team"));assert.equal(exportData.data.split('\r\n').length,records.length+1);
    assert.equal((await call('/employee-statistics/'+staffId+'?cursor=bad')).status,400);
    assert.equal((await call('/employee-statistics/export')).status,200);
  });
  await t.test('Entfernte Mitarbeiter behalten ihre auswertbare Historie',async()=>{
    assert.equal((await call('/employees/'+staffId+'/kick',{})).status,200);
    const row=await stats();assert.ok(row.removed_at);assert.equal(Number(row.revenue_cents),5245000);
  });
});
