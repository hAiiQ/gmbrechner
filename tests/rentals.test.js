import {grantTestManager} from './fixtures.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,initializeDatabase} from '../lib/database.js';
import {createApp} from '../lib/app.js';

test('Mehrere Gäste können denselben Bereich gleichzeitig mieten',async t=>{
  const db=await openDatabase({memory:true});await initializeDatabase(db);
  const server=createApp(db,{accessPassword:'test-rental-access'}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}/api`;let cookie;
  async function call(path,body){
    const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
    const result={status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
    if(path==='/login')await grantTestManager(db,result);
    return result;
  }
  cookie=(await call('/login',{name:'Vermietung Team',password:'test-rental-access'})).cookie;
  const rental=(space,start,customer_name=space==='vip'?'VIP Gast':'Gast oben')=>({id:randomUUID(),space,start,unit:space==='vip'?'hour':'week',quantity:2,customer_name,phone:'555-0100'});
  const income=async()=>Number((await call('/finance')).data.totals.rental_income_cents);

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
  await t.test('Derselbe Bereich mit identischem Beginn, auch 1- und 4-Wochen-Tarife überlappend',async()=>{
    const before=await income(),start='2031-01-01T18:00',bodies=[
      rental('vip',start,'VIP Gast A'),rental('vip',start,'VIP Gast B'),
      rental('upper',start,'Gast oben A'),{...rental('upper',start,'Gast oben B'),unit:'four_weeks'}
    ];
    for(const body of bodies)assert.equal((await call('/rentals',body)).status,201);
    const saved=(await call('/rentals')).data.rentals;
    for(const body of bodies)assert.equal(saved.find(r=>r.id===body.id).customer_name,body.customer_name);
    assert.equal(saved.find(r=>r.id===bodies[3].id).quantity,4);
    assert.equal(await income(),before+55000000);
  });
  await t.test('Storno eines Gastes erhält andere überlappende Buchungen und ihre Einnahmen',async()=>{
    const start='2032-01-01T18:00';
    for(const space of ['vip','upper']){
      const before=await income(),bodies=[rental(space,start,'Gast bleibt'),rental(space,start,'Gast sagt ab')];
      for(const body of bodies)assert.equal((await call('/rentals',body)).status,201);
      assert.equal((await call('/rentals/'+bodies[1].id+'/cancel',{reason:'Gast hat abgesagt'})).status,200);
      assert.equal((await call('/rentals/'+bodies[1].id+'/cancel',{reason:'Erneute Anfrage'})).status,200);
      const saved=(await call('/rentals')).data.rentals;assert.equal(saved.find(r=>r.id===bodies[0].id).cancelled_at,null);assert.ok(saved.find(r=>r.id===bodies[1].id).cancelled_at);
      const finance=(await call('/finance')).data;
      assert.equal(finance.entries.find(e=>e.rental_id===bodies[0].id).voided_at,null);assert.ok(finance.entries.find(e=>e.rental_id===bodies[1].id).voided_at);
      assert.equal(await income(),before+10000000);
    }
  });
  await t.test('Gleichzeitige Gäste im selben Bereich erlaubt, doppelte Anfrage bucht nur einmal',async()=>{
    for(const space of ['vip','upper']){
      const before=await income(),a=rental(space,'2033-01-01T18:00','Gast A'),b=rental(space,'2033-01-01T18:00','Gast B');
      const results=await Promise.all([call('/rentals',a),call('/rentals',a),call('/rentals',b)]);
      assert.deepEqual(results.map(r=>r.status),[201,201,201]);
      const saved=(await call('/rentals')).data.rentals;assert.equal(saved.filter(r=>[a.id,b.id].includes(r.id)).length,2);
      const finance=(await call('/finance')).data;
      for(const body of [a,b])assert.equal(finance.entries.filter(e=>e.rental_id===body.id).length,1);
      assert.equal(await income(),before+20000000);
    }
  });
});
