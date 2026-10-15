import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,initializeDatabase} from '../lib/database.js';
import {createApp} from '../lib/app.js';

test('Lieferlohn einmal pro Kassenzettel und erst bei Auszahlung vom Bankkonto',async t=>{
  const db=await openDatabase({memory:true});await initializeDatabase(db);
  const server=createApp(db,{accessPassword:'delivery-test',loginLimit:1000}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  t.after(async()=>{await new Promise(r=>server.close(r));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}/api`;let owner,staff,staffId,first,paidOrder;
  const call=async(route,body,{cookie=staff,method=body?'POST':'GET'}={})=>{const r=await fetch(base+route,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
  const login=name=>call('/login',{name,password:'delivery-test'});
  owner=(await login('Michael Black')).cookie;const s=await login('Delivery Team');staff=s.cookie;staffId=s.data.employee.id;
  const product=(await call('/products')).data.products.find(p=>p.name==='Cola');
  const order=(extra={})=>({id:randomUUID(),items:[{productId:product.id,quantity:3,unitPriceCents:product.price_cents}],currency:'USD',payment:'cash',is_delivery:true,...extra});
  const pending=async()=>Number((await call('/payroll/me')).data.employee.pending_cents);
  const bank=async()=>Number((await db.query("SELECT balance_cents FROM wallet_accounts WHERE id='bank'")).rows[0].balance_cents);
  await t.test('Verkauf und Mengen bleiben unverändert; auch parallele Wiederholung schreibt nur einen Lieferlohn',async()=>{
    const before=await bank(),request=order();first=request.id;
    const results=await Promise.all([call('/orders',request),call('/orders',request)]);results.forEach(r=>{assert.equal(r.status,201);assert.equal(r.data.order.is_delivery,true);assert.equal(r.data.order.total_cents,3*product.price_cents);});
    assert.equal(await pending(),100000);assert.equal(await bank(),before);
    assert.equal((await db.query('SELECT COUNT(*)::int n FROM payroll_credits WHERE order_id=$1',[first])).rows[0].n,1);
    const changed=await call('/orders',{...request,is_delivery:false});assert.equal(changed.data.order.is_delivery,true);assert.equal(await pending(),100000);
    const stats=(await call('/employee-statistics',undefined,{cookie:owner})).data.employees.find(e=>e.id===staffId);assert.equal(stats.delivery_count,1);assert.equal(Number(stats.revenue_cents),3*product.price_cents);
  });
  await t.test('Fehlgeschlagene Verkäufe und normale Kassenzettel erzeugen keinen Lieferlohn',async()=>{
    assert.equal((await call('/orders',order({items:[{productId:product.id,quantity:999,unitPriceCents:product.price_cents}]}))).status,409);
    assert.equal((await call('/orders',order({is_delivery:'ja'}))).status,400);
    assert.equal((await call('/orders',order({is_delivery:false}))).status,201);assert.equal(await pending(),100000);
  });
  await t.test('Unbezahlter Lieferlohn entfällt beim Storno einmalig, alte Verkäufe bleiben ohne Bonus',async()=>{
    assert.equal((await call('/orders/'+first+'/void',{reason:'Lieferung abgesagt'})).status,200);assert.equal(await pending(),0);
    assert.equal((await call('/orders/'+first+'/void',{reason:'Lieferung abgesagt'})).status,409);assert.equal(await pending(),0);
    await initializeDatabase(db);assert.equal(await pending(),0);
  });
  await t.test('Auszahlung belastet Bank genau einmal, bezahltes Lieferstorno wird mit künftigem Lohn verrechnet',async()=>{
    const request=order({items:[{productId:product.id,quantity:1,unitPriceCents:product.price_cents}]});paidOrder=request.id;
    assert.equal((await call('/orders',request)).status,201);
    assert.equal((await call('/finance',{id:randomUUID(),kind:'income',amount_cents:200000,currency:'USD',reason:'Testbank',payment:'bank',occurred_on:'2026-10-15'},{cookie:owner})).status,201);
    const before=await bank(),summary=(await call('/payroll/me')).data.employee;
    const body={id:randomUUID(),employee_id:staffId,expected_snapshot:summary.snapshot};
    assert.equal((await call('/payroll/payout',body,{cookie:owner})).status,201);assert.equal((await call('/payroll/payout',body,{cookie:owner})).status,201);
    assert.equal(await bank(),before-100000);assert.equal(await pending(),0);
    const after=await bank();assert.equal((await call('/orders/'+paidOrder+'/void',{reason:'Nach Auszahlung storniert'})).status,200);
    assert.equal(await bank(),after);assert.equal(await pending(),-100000);
    assert.equal((await call('/orders/'+paidOrder+'/void',{reason:'Erneuter Stornoversuch'})).status,409);assert.equal(await pending(),-100000);
    await call('/orders',order());assert.equal(await pending(),0);
    const stats=(await call('/employee-statistics',undefined,{cookie:owner})).data.employees.find(e=>e.id===staffId);assert.equal(stats.delivery_count,1);
  });
});
