import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openDatabase, initializeDatabase } from '../lib/database.js';
import { createApp } from '../lib/app.js';

test('Kasse: Integration mit echter PostgreSQL-Engine', async t => {
  const db=await openDatabase({memory:true});
  await initializeDatabase(db);
  const app=createApp(db,{loginLimit:1000});
  const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}/api`;
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
  async function request(endpoint,{method='GET',body,cookie,origin}={}) {
    const res=await fetch(base+endpoint,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{})},body:body?JSON.stringify(body):undefined});
    const type=res.headers.get('content-type')||'';
    const data=type.includes('json')?await res.json():await res.text();
    return {status:res.status,data,cookie:res.headers.get('set-cookie')?.split(';')[0],headers:res.headers};
  }
  const login=async name=>request('/login',{method:'POST',body:{name}});
  let alice,bob,aliceId,firstOrder,secondOrder;
  const sale=(items,extra={})=>({id:randomUUID(),payment:'cash',currency:'USD',items:items.map(([productId,quantity,unitPriceCents])=>({productId,quantity,unitPriceCents})),...extra});

  await t.test('Anmeldung nur mit Name, gültige Sitzung und CSRF-Prüfung',async()=>{
    assert.equal((await request('/health')).status,200);
    assert.equal((await request('/products')).status,401);
    assert.equal((await request('/login',{method:'POST',body:{name:''}})).status,400);
    assert.equal((await request('/login',{method:'POST',body:{name:'Alice'},origin:'https://fremde-seite.example'})).status,403);
    const a=await login('Alice');alice=a.cookie;aliceId=a.data.employee.id;
    const b=await login('Bob');bob=b.cookie;
    assert.equal((await request('/products',{method:'POST',body:{name:'Test',category:'Snacks',price_cents:100}})).status,401);
    assert.equal((await request('/products?all=true',{cookie:bob})).status,200);
  });
  await t.test('Gleiche Namen werden unabhängig von Großschreibung zusammengeführt',async()=>{
    const same=await login('  ALICE  ');
    assert.equal(same.data.employee.id,aliceId);
    assert.equal(same.data.employee.name,'Alice');
    assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM employees')).rows[0].count,2);
  });
  await t.test('Jeder angemeldete Mitarbeiter kann Artikel und Preise ohne PIN ändern',async()=>{
    const added=await request('/products',{method:'POST',cookie:bob,body:{name:'Testartikel',category:'Snacks',description:'Test',price_cents:111}});
    assert.equal(added.status,201);
    const changed=await request(`/products/${added.data.product.id}`,{method:'PUT',cookie:alice,body:{name:'Testartikel',category:'Snacks',description:'Test',price_cents:125,active:false}});
    assert.equal(changed.status,200);assert.equal(changed.data.product.price_cents,125);
    assert.equal((await request('/products?all=true',{cookie:bob})).data.products.find(p=>p.id===added.data.product.id).price_cents,125);
    assert.equal((await request('/settings',{method:'PUT',cookie:bob,body:{currency:'EUR'}})).status,200);
    assert.equal((await request('/settings',{method:'PUT',cookie:alice,body:{currency:'USD'}})).status,200);
  });
  await t.test('Kartenpreise: 3 × 225 $ + 2 × 300 $ = 1.275 $, Zuordnung aus der Sitzung',async()=>{
    const payload=sale([['buddy-bier',3,22500],['cola',2,30000]],{employee_id:'gefälscht',total_cents:1});
    const result=await request('/orders',{method:'POST',cookie:alice,body:payload});
    assert.equal(result.status,201);assert.equal(result.data.order.total_cents,127500);assert.equal(result.data.order.employee_id,aliceId);
    firstOrder=result.data.order.id;
    const b=await request('/orders',{method:'POST',cookie:bob,body:sale([['whisky',2,40000]],{payment:'card'})});
    assert.equal(b.data.order.total_cents,80000);secondOrder=b.data.order.id;
    const stats=(await request('/stats',{cookie:alice})).data;
    assert.equal(Number(stats.totals.total_cents),207500);assert.equal(stats.totals.count,2);
    assert.equal(Number(stats.totals.cash_cents),127500);assert.equal(Number(stats.totals.card_cents),80000);
    assert.equal(Number(stats.employees.find(e=>e.name==='Alice').total_cents),127500);
    assert.equal(Number(stats.employees.find(e=>e.name==='Bob').total_cents),80000);
  });
  await t.test('Ungültige Mengen, doppelte Positionen und manipulierte Preise werden abgelehnt',async()=>{
    for(const items of [[['cola',-1,30000]],[['cola',1.5,30000]],[['cola',1000,30000]],[['cola',1,1]],[['cola',1,30000],['cola',1,30000]],[['gibts-nicht',1,500]]]){
      const result=await request('/orders',{method:'POST',cookie:alice,body:sale(items)});
      assert.ok([400,409].includes(result.status),JSON.stringify(result));
    }
    assert.equal((await request('/stats',{cookie:alice})).data.totals.count,2);
  });
  await t.test('Doppelte und gleichzeitige Requests erzeugen genau einen Verkauf',async()=>{
    const payload=sale([['texas-water',1,20000]]);
    const results=await Promise.all([request('/orders',{method:'POST',cookie:alice,body:payload}),request('/orders',{method:'POST',cookie:alice,body:payload})]);
    assert.deepEqual(results.map(r=>r.status),[201,201]);
    assert.equal((await request('/orders',{method:'POST',cookie:alice,body:payload})).data.order.id,payload.id);
    assert.equal((await request('/orders',{method:'POST',cookie:bob,body:payload})).status,409);
    assert.equal((await request('/stats',{cookie:alice})).data.totals.count,3);
  });
  await t.test('Geänderte Preise und deaktivierte Artikel, historische Preise bleiben erhalten',async()=>{
    const body={name:'Cola neu',category:'Alkoholfreie Getränke',description:'Test',price_cents:35000,active:true};
    assert.equal((await request('/products/cola',{method:'PUT',cookie:bob,body})).status,200);
    assert.equal((await request('/orders',{method:'POST',cookie:alice,body:sale([['cola',1,30000]])})).status,409);
    const order=(await request(`/orders/${firstOrder}`,{cookie:alice})).data;
    assert.equal(order.items.find(p=>p.product_id==='cola').price_cents,30000);assert.equal(order.items.find(p=>p.product_id==='cola').name,'Cola');
    assert.equal((await request('/products/cola',{method:'PUT',cookie:alice,body:{...body,active:false}})).status,200);
    assert.ok(!(await request('/products',{cookie:alice})).data.products.some(p=>p.id==='cola'));
    assert.equal((await request('/orders',{method:'POST',cookie:alice,body:sale([['cola',1,35000]])})).status,409);
  });
  await t.test('Storno passt Umsatz und Mitarbeitersumme an und verhindert doppeltes Storno',async()=>{
    assert.equal((await request(`/orders/${secondOrder}/void`,{method:'POST',body:{reason:'Falsch gebucht'}})).status,401);
    const result=await request(`/orders/${secondOrder}/void`,{method:'POST',cookie:alice,body:{reason:'Falsch gebucht'}});
    assert.equal(result.status,200);assert.ok(result.data.order.voided_at);
    assert.equal((await request(`/orders/${secondOrder}/void`,{method:'POST',cookie:alice,body:{reason:'Nochmal'}})).status,409);
    const stats=(await request('/stats',{cookie:alice})).data;
    assert.equal(Number(stats.totals.total_cents),147500);assert.equal(stats.totals.count,2);
    assert.equal(Number(stats.totals.card_cents),0);assert.equal(Number(stats.employees.find(e=>e.name==='Bob').total_cents),0);
    assert.equal(stats.orders.length,3);
  });
  await t.test('Berliner Tagesgrenzen und validierte Zeitraumfilter',async()=>{
    await db.query("UPDATE orders SET created_at='2026-10-10 22:30:00+00' WHERE id=$1",[firstOrder]);
    await db.query("UPDATE orders SET created_at='2026-10-10 21:30:00+00' WHERE id<>$1",[firstOrder]);
    const stats=(await request('/stats?from=2026-10-11&to=2026-10-11',{cookie:alice})).data;
    assert.equal(Number(stats.totals.total_cents),127500);assert.equal(stats.totals.count,1);
    assert.equal((await request('/stats?from=2026-02-30',{cookie:alice})).status,400);
    assert.equal((await request('/stats?from=2026-10-12&to=2026-10-11',{cookie:alice})).status,400);
  });
  await t.test('CSV enthält alle Positionen und Stornos, Währungswechsel nach Verkauf gesperrt',async()=>{
    const csv=await request('/orders/export',{cookie:alice});assert.equal(csv.status,200);
    assert.match(csv.data,/Mitarbeiter/);assert.match(csv.data,/Alice/);assert.match(csv.data,/Storniert/);assert.match(csv.data,/Falsch gebucht/);assert.match(csv.data,/"675,00"/);
    assert.equal(csv.data.trim().split('\r\n').length,5);
    assert.equal((await request('/settings',{method:'PUT',cookie:alice,body:{currency:'EUR'}})).status,409);
  });
  await t.test('CSV-Formeln werden neutralisiert, Logout macht die Sitzung ungültig',async()=>{
    await db.query("UPDATE order_items SET name='=HYPERLINK(1)' WHERE order_id=$1 AND product_id='cola'",[firstOrder]);
    const csv=await request('/orders/export',{cookie:alice});assert.match(csv.data,/"'=HYPERLINK\(1\)"/);
    assert.equal((await request('/logout',{method:'POST',cookie:alice,body:{}})).status,200);
    assert.equal((await request('/me',{cookie:alice})).status,401);
  });
});

test('Lokale Daten bleiben nach Datenbank-Neustart erhalten',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'gentlemans-kasse-test-'));
  let db;
  try{
    db=await openDatabase({directory});await initializeDatabase(db);
    await db.query("INSERT INTO employees (id,name,name_key) VALUES ('persist','Persistenz','persistenz')");
    await db.query("INSERT INTO orders (id,employee_id,total_cents,currency,payment) VALUES ('persist-order','persist',1234,'EUR','cash')");
    await db.close();db=await openDatabase({directory});await initializeDatabase(db);
    assert.equal((await db.query("SELECT total_cents FROM orders WHERE id='persist-order'")).rows[0].total_cents,1234);
    assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM products')).rows[0].count,24);
  }finally{if(db)await db.close();await rm(directory,{recursive:true,force:true});}
});
