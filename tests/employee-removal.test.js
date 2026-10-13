import {grantTestManager} from './fixtures.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,initializeDatabase} from '../lib/database.js';
import {createApp} from '../lib/app.js';

test('Rauswerfen entfernt Mitarbeiter aus der Liste und bewahrt ihre Abrechnung',async t=>{
  const db=await openDatabase({memory:true});await initializeDatabase(db);
  const server=createApp(db,{accessPassword:'employee-removal-test',loginLimit:1000}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}/api`;
  let alice,aliceId,bob,bobSecond,bobId,offlineId,inactiveId,orderId,originalMoney,originalTotals,originalStock;
  async function call(path,body,{cookie=alice,method=body?'POST':'GET'}={}){
    const response=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    const result={status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
    if(path==='/login'&&body?.name?.trim().toLowerCase()==='alice')await grantTestManager(db,result);
    return result;
  }
  const login=name=>call('/login',{name,password:'employee-removal-test'});
  const list=async(includeRemoved=false)=>{const r=await call('/employees'+(includeRemoved?'?include_removed=true':''));assert.equal(r.status,200);return r.data.employees;};
  const wallet=async()=>(await call('/wallet')).data;
  const stats=async()=>(await call('/stats')).data;
  const product=async id=>(await call('/products')).data.products.find(p=>p.id===id);
  const cash=w=>Number(w.employees.find(e=>e.id===bobId).cash_cents);
  await t.test('Entfernen/Wiederherstellen benötigen Anmeldung, vorhandene Namen bleiben zunächst sichtbar',async()=>{
    assert.equal((await call('/employees/'+randomUUID()+'/kick',{}, {cookie:null})).status,401);
    assert.equal((await call('/employees/'+randomUUID()+'/restore',{}, {cookie:null})).status,401);
    assert.equal((await call('/employees?include_removed=true',undefined,{cookie:null})).status,401);
    const a=await login('Alice');alice=a.cookie;aliceId=a.data.employee.id;
    const b=await login('Bob');bob=b.cookie;bobId=b.data.employee.id;
    bobSecond=(await login('BOB')).cookie;
    const offline=await login('Offline Mitarbeiter');offlineId=offline.data.employee.id;
    await call('/logout',{}, {cookie:offline.cookie});
    const inactive=await login('Deaktivierter Mitarbeiter');inactiveId=inactive.data.employee.id;
    await call('/employees/'+inactiveId+'/status',{active:false},{method:'PUT'});
    assert.equal((await list()).length,4);
    assert.ok((await list()).every(e=>e.removed_at===null&&e.removed_by===null));
  });
  await t.test('Rolle, Umsätze, Lager und Bargeld werden für den Mitarbeiter erfasst',async()=>{
    assert.equal((await call('/employees/'+bobId,{role:'Schichtleitung',department:'Bar & VIP'},{method:'PUT'})).status,200);
    orderId=randomUUID();const cola=await product('cola');
    assert.equal((await call('/orders',{id:orderId,currency:'USD',payment:'cash',items:[{productId:cola.id,quantity:2,unitPriceCents:cola.price_cents}]},{cookie:bob})).status,201);
    originalMoney=await wallet();originalTotals=(await stats()).totals;originalStock=(await product('cola')).stock_quantity;
    assert.equal(cash(originalMoney),60000);
  });
  await t.test('Auch abgemeldete und deaktivierte Mitarbeiter lassen sich aus der Liste entfernen',async()=>{
    for(const id of [offlineId,inactiveId]){
      const before=(await list()).find(e=>e.id===id);assert.equal(before.session_count,0);
      const result=await call('/employees/'+id+'/kick',{});assert.equal(result.status,200);assert.ok(result.data.employee.removed_at);
      assert.ok(!(await list()).some(e=>e.id===id));
      const removed=(await list(true)).find(e=>e.id===id);assert.equal(removed.active,false);assert.equal(removed.session_count,0);assert.equal(removed.removed_by,aliceId);
    }
    assert.equal((await list()).length,2);assert.equal((await list(true)).length,4);
  });
  await t.test('Angemeldete Person verschwindet aus der Liste und alle Geräte und normalisierten Namen werden gesperrt',async()=>{
    const result=await call('/employees/'+bobId+'/kick',{});assert.equal(result.status,200);assert.equal(result.data.removed_sessions,2);
    assert.ok(!(await list()).some(e=>e.id===bobId));
    for(const cookie of [bob,bobSecond])assert.equal((await call('/me',undefined,{cookie})).status,401);
    for(const name of ['Bob','  BOB  ','Ｂｏｂ']){const rejected=await login(name);assert.equal(rejected.status,403);assert.equal(rejected.cookie,undefined);}
    const removed=(await list(true)).find(e=>e.id===bobId);assert.equal(removed.session_count,0);assert.equal(removed.role,'Schichtleitung');assert.equal(removed.department,'Bar & VIP');assert.equal(removed.removed_by,aliceId);
    assert.equal((await call('/employees/'+bobId,{role:'Chef',department:'Bar'},{method:'PUT'})).status,404);
    assert.equal((await call('/employees/'+bobId+'/status',{active:true},{method:'PUT'})).status,409);
  });
  await t.test('Umsätze, Buchungsdetails und Geldbestände bleiben erhalten, Bargeldabgabe bleibt möglich',async()=>{
    const w=await wallet();assert.equal(w.total_cents,originalMoney.total_cents);assert.equal(cash(w),60000);assert.equal((await product('cola')).stock_quantity,originalStock);
    assert.deepEqual((await stats()).totals,originalTotals);
    const detail=(await call('/orders/'+orderId)).data;assert.equal(detail.order.employee_name,'Bob');assert.equal(detail.order.employee_id,bobId);assert.equal(detail.order.total_cents,60000);
    const deposit=await call('/wallet/transfer',{id:randomUUID(),account:'employee:'+bobId,amount_cents:30000,expected_balance_cents:60000,reason:'Abgabe nach Austritt'});assert.equal(deposit.status,201);
    const after=await wallet();assert.equal(cash(after),30000);assert.equal(Number(after.bank_cents),30000);assert.equal(after.total_cents,w.total_cents);assert.deepEqual((await stats()).totals,originalTotals);
  });
  await t.test('Wiederholungen und Neustarts verändern Entfernung oder Abrechnung nicht',async()=>{
    const before=(await list(true)).find(e=>e.id===bobId),w=await wallet();
    const repeated=await call('/employees/'+bobId+'/kick',{});assert.equal(repeated.status,200);assert.equal(repeated.data.removed_sessions,0);
    await initializeDatabase(db);
    assert.deepEqual((await list(true)).find(e=>e.id===bobId),before);assert.ok(!(await list()).some(e=>e.id===bobId));assert.equal((await wallet()).total_cents,w.total_cents);assert.equal((await login('Bob')).status,403);
    assert.deepEqual((await stats()).totals,originalTotals);
  });
  await t.test('Wiederherstellen bewahrt Mitarbeiter-ID, Rolle, Bargeld und Historie; alte Cookies bleiben ungültig',async()=>{
    const restored=await call('/employees/'+bobId+'/restore',{});assert.equal(restored.status,200);assert.equal(restored.data.employee.id,bobId);assert.equal(restored.data.employee.active,true);assert.equal(restored.data.employee.removed_at,null);
    const visible=(await list()).find(e=>e.id===bobId);assert.equal(visible.role,'Schichtleitung');assert.equal(visible.department,'Bar & VIP');assert.equal(visible.removed_by,null);assert.equal(Number(visible.cash_cents),30000);assert.equal(visible.session_count,0);
    for(const cookie of [bob,bobSecond])assert.equal((await call('/me',undefined,{cookie})).status,401);
    const newLogin=await login('BOB');assert.equal(newLogin.status,200);assert.equal(newLogin.data.employee.id,bobId);bob=newLogin.cookie;
    assert.equal((await call('/employees/'+bobId+'/restore',{})).status,200);assert.equal((await call('/me',undefined,{cookie:bob})).status,200);
    assert.deepEqual((await stats()).totals,originalTotals);assert.equal(cash(await wallet()),30000);
  });
  await t.test('Gleichzeitige Anmeldung und Entfernung können keine aktive Sitzung oder neue Mitarbeiter-ID hinterlassen',async()=>{
    const results=await Promise.all([login('Bob'),call('/employees/'+bobId+'/kick',{})]);assert.equal(results[1].status,200);assert.ok([200,403].includes(results[0].status));
    assert.ok(!(await list()).some(e=>e.id===bobId));assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM sessions WHERE employee_id=$1',[bobId])).rows[0].n,0);
    assert.equal((await list(true)).filter(e=>e.name==='Bob').length,1);assert.equal(cash(await wallet()),30000);
  });
  await t.test('Eigene Entfernung und ungültige IDs werden abgewiesen',async()=>{
    assert.equal((await call('/employees/'+aliceId+'/kick',{})).status,409);assert.equal((await call('/me')).status,200);assert.ok((await list()).some(e=>e.id===aliceId));
    for(const suffix of ['kick','restore']){
      assert.equal((await call('/employees/no-id/'+suffix,{})).status,400);
      assert.equal((await call('/employees/'+randomUUID()+'/'+suffix,{})).status,404);
    }
  });
});
