import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,initializeDatabase} from '../lib/database.js';
import {createApp} from '../lib/app.js';

test('Einkauf verbindet Lager und Konto atomar',async t=>{
  const db=await openDatabase({memory:true});t.after(()=>db.close());await initializeDatabase(db);
  const server=createApp(db,{accessPassword:'test-bar-access',loginLimit:1000}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}/api`;let cookie,otherCookie,first,custom;
  async function call(path,body,method=body?'POST':'GET',session=cookie){
    const r=await fetch(base+path,{method,headers:{...(session?{Cookie:session}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
  }
  const buy=(lines,more={})=>({id:randomUUID(),occurred_on:'2026-10-12',reason:'Warenlieferung',items:lines.map(([productId,quantity,unitCostCents])=>({productId,quantity,unitCostCents})),...more});
  const stock=async id=>(await db.query('SELECT stock_quantity FROM products WHERE id=$1',[id])).rows[0].stock_quantity;
  const count=async()=>(await db.query('SELECT COUNT(*)::int AS n FROM purchases')).rows[0].n;
  await t.test('Zugriff benötigt Passwortanmeldung und alle 24 Einkaufspreise passen zu Bildern und Ergänzungen',async()=>{
    assert.equal((await call('/purchases')).status,401);
    cookie=(await call('/login',{name:'Einkauf Team',password:'test-bar-access'})).cookie;
    otherCookie=(await call('/login',{name:'Anderes Team',password:'test-bar-access'})).cookie;
    const products=(await call('/purchases')).data.products;
    const expected={'Whisky':10000,'Wein':10000,'Cuban Cigar':10000,'Bloodystrike':10000,'Moonhowl':10000,'Wizardspuff':10000,'Cola':10000,'Eistee Pfirsich':10000,'Buddy Bier':10000,'Texas Water':10000,'Steakhouseplatte':10000,'Moonwater Chili':10000,'Latte Macchiato':10000,'Espresso':10000,'Steak Hamburger':10000,'Trinkblut':60000,'Magische E-Shisha':300000,'Magische Kohle':30000,'Sonnenmango':30000,'Feenapfel':30000,'Sternenbeere':30000,'Astraltraube':30000,'Blutmondkirsche':30000,'Frostminze':30000};
    assert.equal(products.length,24);assert.deepEqual(Object.fromEntries(products.map(p=>[p.name,p.purchase_price_cents])),expected);
  });
  await t.test('5 Cola + 2 E-Shisha kosten 6.500 $, Konto sinkt exakt und beide Bestände steigen',async()=>{
    const payload=buy([['cola',5,10000],['magische-e-shisha',2,300000]],{total_cents:1,employee_id:'gefälscht'});first=payload.id;
    const result=await call('/purchases',payload);assert.equal(result.status,201);assert.equal(result.data.purchase.total_cents,650000);
    assert.equal(await stock('cola'),44);assert.equal(await stock('magische-e-shisha'),11);
    const finance=(await call('/finance')).data;assert.equal(Number(finance.totals.expense_cents),650000);assert.equal(finance.totals.balance_cents,-650000);
    assert.ok(finance.entries.some(e=>e.purchase_id===first));
    const history=(await call('/inventory')).data.movements.filter(m=>m.purchase_id===first);
    assert.deepEqual(history.map(m=>m.delta).sort((a,b)=>a-b),[2,5]);
  });
  await t.test('Gleichzeitige Wiederholungen buchen Lager und Ausgabe genau einmal, anderer Mitarbeiter darf ID nicht übernehmen',async()=>{
    const payload=buy([['cola',1,10000]]),before=await stock('cola');
    const results=await Promise.all([call('/purchases',payload),call('/purchases',payload)]);assert.deepEqual(results.map(r=>r.status),[201,201]);
    assert.equal(await stock('cola'),before+1);
    assert.equal((await call('/purchases',payload)).status,201);assert.equal(await stock('cola'),before+1);
    assert.equal((await call('/purchases',payload,'POST',otherCookie)).status,409);
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM finance_entries WHERE purchase_id=$1',[payload.id])).rows[0].n,1);
  });
  await t.test('Ungültige Mengen, fehlende Artikel, alte/manipulierte Preise und Teilausfälle verändern nichts',async()=>{
    const beforeCount=await count(),before=await stock('cola'),balance=(await call('/finance')).data.totals.balance_cents;
    for(const lines of [[['cola',0,10000]],[['cola',-1,10000]],[['cola',1.5,10000]],[['cola',100001,10000]],[['cola',1,1]],[['cola',1,10000],['cola',1,10000]],[['cola',2,10000],['unknown',1,10000]],[['magische-e-shisha',100000,300000]]])assert.ok([400,409].includes((await call('/purchases',buy(lines))).status));
    assert.equal((await call('/purchases',buy([['cola',1,10000]],{occurred_on:'2026-02-30'}))).status,400);
    assert.equal(await stock('cola'),before);assert.equal(await count(),beforeCount);assert.equal((await call('/finance')).data.totals.balance_cents,balance);
  });
  await t.test('Neue Artikel brauchen Einkaufspreis; pausierte Artikel können nachgefüllt werden, alte Preise bleiben im Einkauf',async()=>{
    const product=(await call('/products',{name:'Neuer Lagerartikel',category:'Essen',price_cents:20000})).data.product;custom=product.id;
    assert.equal((await call('/purchases',buy([[custom,1,10000]]))).status,409);
    const body={name:product.name,category:product.category,description:'',price_cents:20000,active:false,purchase_price_cents:12500};
    assert.equal((await call('/products/'+custom,body,'PUT')).status,200);
    const saved=await call('/purchases',buy([[custom,10,12500]]));assert.equal(saved.status,201);assert.equal(saved.data.purchase.total_cents,125000);assert.equal(await stock(custom),10);
    assert.equal((await call('/products/'+custom,{...body,purchase_price_cents:15000},'PUT')).status,200);
    assert.equal((await call('/purchases',buy([[custom,1,12500]]))).status,409);
    const details=(await call('/purchases/'+saved.data.purchase.id)).data;assert.equal(details.items[0].unit_cost_cents,12500);assert.equal(details.purchase.total_cents,125000);
    await initializeDatabase(db);assert.equal((await db.query('SELECT purchase_price_cents FROM products WHERE id=$1',[custom])).rows[0].purchase_price_cents,15000);
    assert.equal(await stock(custom),10);
  });
  await t.test('Preisänderungen vorhandener Artikel und Restarts überschreiben weder Einkaufspreise noch Geld und Bestand',async()=>{
    await db.query("UPDATE products SET purchase_price_cents=11000 WHERE id='cola'");
    const balance=(await call('/finance')).data.totals.balance_cents,before=await stock('cola');
    await initializeDatabase(db);
    assert.equal((await db.query("SELECT purchase_price_cents FROM products WHERE id='cola'")).rows[0].purchase_price_cents,11000);
    assert.equal(await stock('cola'),before);assert.equal((await call('/finance')).data.totals.balance_cents,balance);
    const details=(await call('/purchases/'+first)).data;assert.equal(details.items.find(i=>i.product_id==='cola').unit_cost_cents,10000);
  });
  await t.test('Einkaufsstorno korrigiert Konto und Lager gemeinsam und ist bei Wiederholung sicher',async()=>{
    const entry=(await db.query('SELECT id FROM finance_entries WHERE purchase_id=$1',[first])).rows[0].id;
    assert.equal((await call('/finance/'+entry+'/void',{reason:'Nur Geld zurück'})).status,409);
    const before=await stock('cola'),balance=(await call('/finance')).data.totals.balance_cents;
    assert.equal((await call('/purchases/'+first+'/void',{reason:'Falsch erfasst'})).status,200);
    assert.equal(await stock('cola'),before-5);assert.equal(await stock('magische-e-shisha'),9);
    assert.equal((await call('/finance')).data.totals.balance_cents,balance+650000);
    assert.equal((await call('/purchases/'+first+'/void',{reason:'Nochmal'})).status,200);
    assert.equal(await stock('cola'),before-5);assert.equal((await call('/finance')).data.totals.balance_cents,balance+650000);
    assert.ok((await call('/purchases/'+first)).data.purchase.voided_at);
  });
  await t.test('Storno wird komplett abgelehnt, wenn eingekaufter Bestand bereits verbraucht wurde',async()=>{
    const result=await call('/purchases',buy([[custom,10,15000]]));const id=result.data.purchase.id;
    await db.query('UPDATE products SET stock_quantity=1 WHERE id=$1',[custom]);
    const balance=(await call('/finance')).data.totals.balance_cents;
    assert.equal((await call('/purchases/'+id+'/void',{reason:'Zu spät storniert'})).status,409);
    assert.equal(await stock(custom),1);assert.equal((await call('/finance')).data.totals.balance_cents,balance);
    assert.equal((await call('/purchases/'+id)).data.purchase.voided_at,null);
  });
});
