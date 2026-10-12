import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,initializeDatabase} from '../lib/database.js';
import {createApp} from '../lib/app.js';

test('Rabatte auf Kassenzettel, Umsatz, Lager und Geldbestand',async t=>{
  const db=await openDatabase({memory:true});await initializeDatabase(db);
  const server=createApp(db,{accessPassword:'discount-test-access',loginLimit:1000}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}/api`;let alice,bob,aliceId,cardOrder;
  async function call(path,body,{cookie=alice,method=body?'POST':'GET'}={}){
    const r=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    return {status:r.status,data:r.headers.get('content-type').includes('application/json')?await r.json():await r.text(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
  }
  const sale=(percent=0,items=[['cola',1,30000]],payment='cash')=>({id:randomUUID(),currency:'USD',payment,discount_percent:percent,items:items.map(([productId,quantity,unitPriceCents])=>({productId,quantity,unitPriceCents}))});
  const stats=async()=>(await call('/stats')).data;
  const wallet=async()=>(await call('/wallet')).data;
  const stock=async id=>(await call('/products')).data.products.find(p=>p.id===id).stock_quantity;
  const cash=w=>Number(w.employees.find(e=>e.id===aliceId).cash_cents);
  await t.test('Anmeldung erforderlich; Altbuchungen und ältere Clients erhalten 0 % Rabatt',async()=>{
    assert.equal((await call('/orders',sale(10),{cookie:null})).status,401);
    const a=await call('/login',{name:'Alice',password:'discount-test-access'});alice=a.cookie;aliceId=a.data.employee.id;
    bob=(await call('/login',{name:'Bob',password:'discount-test-access'})).cookie;
    await db.query("INSERT INTO orders(id,employee_id,total_cents,currency,payment) VALUES('legacy-discount-order',$1,12345,'USD','cash')",[aliceId]);
    const old=(await call('/orders/legacy-discount-order')).data.order;
    assert.equal(old.discount_basis_points,0);assert.equal(old.discount_cents,0);assert.equal(old.total_cents,12345);
    const payload=sale();delete payload.discount_percent;
    const result=await call('/orders',payload);assert.equal(result.status,201);assert.equal(result.data.order.total_cents,30000);assert.equal(result.data.order.discount_cents,0);assert.equal(result.data.order.discount_basis_points,0);
    assert.equal(cash(await wallet()),30000);
  });
  await t.test('Rabatt mindert Gesamt-/Mitarbeiterumsatz, Bargeld und Finanzen; Mengen bleiben vollständig',async()=>{
    const before=await stats(),stockBefore=await stock('cola'),w=await wallet(),finance=(await call('/finance')).data;
    const result=await call('/orders',{...sale(20,[['cola',2,30000],['buddy-bier',3,22500]]),total_cents:1,discount_cents:1});
    assert.equal(result.status,201);assert.equal(result.data.order.discount_basis_points,2000);assert.equal(result.data.order.discount_cents,25500);assert.equal(result.data.order.total_cents,102000);
    assert.equal(await stock('cola'),stockBefore-2);
    const after=await stats();assert.equal(Number(after.totals.total_cents)-Number(before.totals.total_cents),102000);assert.equal(Number(after.totals.cash_cents)-Number(before.totals.cash_cents),102000);
    assert.equal(Number(after.employees.find(e=>e.id===aliceId).total_cents)-Number(before.employees.find(e=>e.id===aliceId).total_cents),102000);
    assert.equal(cash(await wallet())-cash(w),102000);assert.equal((await call('/finance')).data.totals.sales_cents-Number(finance.totals.sales_cents),102000);
    const detail=(await call('/orders/'+result.data.order.id)).data;
    assert.equal(detail.items.reduce((sum,line)=>sum+line.discount_cents,0),25500);
    assert.equal(detail.items.reduce((sum,line)=>sum+line.quantity*line.price_cents-line.discount_cents,0),102000);
    assert.equal(Number(after.bestsellers.find(p=>p.name==='Buddy Bier').total_cents),54000);
  });
  await t.test('100 % ist ein kostenloser Verkauf: kompletter Lagerabzug, kein Geldzugang, Storno stellt Lager wieder her',async()=>{
    const before=await wallet(),totals=(await stats()).totals,quantity=await stock('wein');
    const result=await call('/orders',sale(100,[['wein',2,35000]]));assert.equal(result.status,201);assert.equal(result.data.order.total_cents,0);assert.equal(result.data.order.discount_cents,70000);assert.equal(await stock('wein'),quantity-2);
    assert.equal(Number((await wallet()).total_cents),Number(before.total_cents));assert.equal((await stats()).totals.total_cents,totals.total_cents);
    assert.equal((await call('/orders/'+result.data.order.id+'/void',{reason:'Kostenlose Runde storniert'})).status,200);assert.equal(await stock('wein'),quantity);assert.equal(Number((await wallet()).total_cents),Number(before.total_cents));
  });
  await t.test('Nachkommastellen und Rundungscent werden exakt verteilt, auch bei gleichen Positionen und großen Beträgen',async()=>{
    const result=await call('/orders',sale(12.5,[['cola',2,30000],['buddy-bier',3,22500]],'card'));cardOrder=result.data.order.id;
    assert.equal(result.status,201);assert.equal(result.data.order.discount_basis_points,1250);assert.equal(result.data.order.discount_cents,15938);assert.equal(result.data.order.total_cents,111562);
    const w=await wallet();assert.equal(Number(w.clearing_cents),111562);
    const details=(await call('/orders/'+cardOrder)).data;
    assert.equal(details.items.reduce((sum,p)=>sum+p.discount_cents,0),15938);
    assert.equal(details.items.reduce((sum,p)=>sum+p.price_cents*p.quantity-p.discount_cents,0),111562);
    for(const [name,price] of [['Rundung A',1],['Rundung B',1],['Großer Betrag',10000000]]){
      const created=await call('/products',{name,category:'Test',description:'',price_cents:price});assert.equal(created.status,201);
      const product=created.data.product;
      await db.query('UPDATE products SET stock_quantity=110 WHERE id=$1',[product.id]);
      if(price===1){details[name]=product.id;}else details.large=product.id;
    }
    const tiny=await call('/orders',sale(50,[[details['Rundung A'],1,1],[details['Rundung B'],1,1]]));assert.equal(tiny.status,201);assert.equal(tiny.data.order.discount_cents,1);assert.equal(tiny.data.order.total_cents,1);
    const tinyDetail=(await call('/orders/'+tiny.data.order.id)).data;
    assert.deepEqual(tinyDetail.items.map(p=>p.discount_cents).sort(),[0,1]);
    const large=await call('/orders',sale(28.07,[[details.large,100,10000000]]));assert.equal(large.status,201);assert.equal(large.data.order.discount_cents,280700000);assert.equal(large.data.order.total_cents,719300000);
  });
  await t.test('Ungültige Rabatte und manipulierte Preise buchen weder Geld noch Bestand',async()=>{
    const before=await wallet(),quantity=await stock('cola'),totals=(await stats()).totals;
    for(const percent of [-1,100.01,101,0.001,12.345,'20',null,true,{},[50]]){
      const result=await call('/orders',sale(percent));assert.equal(result.status,400,JSON.stringify(percent));
    }
    assert.equal((await call('/orders',sale(100,[['cola',1,1]]))).status,409);
    assert.equal(await stock('cola'),quantity);assert.equal((await wallet()).total_cents,before.total_cents);assert.deepEqual((await stats()).totals,totals);
  });
  await t.test('Gleichzeitige Wiederholungen buchen Rabatt und Geld nur einmal und behalten den gespeicherten Rabatt',async()=>{
    const payload=sale(10),quantity=await stock('cola'),before=await wallet();
    const result=await Promise.all([call('/orders',payload),call('/orders',payload)]);assert.deepEqual(result.map(r=>r.status),[201,201]);
    assert.equal(await stock('cola'),quantity-1);assert.equal(cash(await wallet())-cash(before),27000);
    const changedRetry=await call('/orders',{...payload,discount_percent:100});assert.equal(changedRetry.data.order.total_cents,27000);assert.equal(changedRetry.data.order.discount_basis_points,1000);
    assert.equal((await call('/orders',payload,{cookie:bob})).status,409);
    assert.equal(cash(await wallet())-cash(before),27000);
  });
  await t.test('CSV zeigt Bruttowerte, Prozent, centgenauen Positionsrabatt und tatsächlichen Buchungsbetrag',async()=>{
    const csv=await call('/orders/export');assert.equal(csv.status,200);
    assert.ok(csv.data.includes('Positionssumme vor Rabatt'));assert.ok(csv.data.includes('Positionssumme nach Rabatt'));assert.ok(csv.data.includes('Rabatt (%)'));
    const lines=csv.data.split('\r\n').filter(line=>line.includes(cardOrder));assert.equal(lines.length,2);
    const records=lines.map(line=>line.slice(1,-1).split('";"'));
    assert.ok(records.every(fields=>fields[11]==='12,50'&&fields[14]==='159,38'&&fields[15]==='1115,62'));
    const cents=value=>Math.round(Number(value.replace(',','.'))*100);
    assert.equal(records.reduce((sum,fields)=>sum+cents(fields[12]),0),15938);assert.equal(records.reduce((sum,fields)=>sum+cents(fields[13]),0),111562);
  });
  await t.test('Storno nach Bankübertragung erstattet nur den bezahlten Betrag und die volle Artikelmenge',async()=>{
    const before=await wallet(),quantity=await stock('cola');
    assert.equal((await call('/wallet/transfer',{id:randomUUID(),account:'clearing',amount_cents:111562,expected_balance_cents:Number(before.clearing_cents),reason:'Testeinzahlung'})).status,201);
    const bank=Number((await wallet()).bank_cents);
    const voided=await call('/orders/'+cardOrder+'/void',{reason:'Rabattverkauf storniert'});assert.equal(voided.status,200);assert.equal(voided.data.order.discount_cents,15938);
    assert.equal(Number((await wallet()).bank_cents),bank-111562);assert.equal(await stock('cola'),quantity+2);
    assert.equal(Number((await wallet()).total_cents),Number(before.total_cents)-111562);
    assert.equal((await call('/orders/'+cardOrder+'/void',{reason:'Doppelt'})).status,409);
  });
  await t.test('Weitere Deployments erhalten Rabatte und vorherige Umsätze und Geldbestände',async()=>{
    const w=await wallet(),totals=(await stats()).totals,order=(await call('/orders/'+cardOrder)).data;
    await initializeDatabase(db);
    assert.deepEqual((await call('/orders/'+cardOrder)).data,order);assert.deepEqual((await stats()).totals,totals);assert.equal((await wallet()).total_cents,w.total_cents);
    const legacy=(await call('/orders/legacy-discount-order')).data.order;assert.equal(legacy.total_cents,12345);assert.equal(legacy.discount_basis_points,0);
  });
});
