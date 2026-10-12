import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, initializeDatabase } from '../lib/database.js';
import { createApp } from '../lib/app.js';

test('Speise- und Shishakarte: Erstinstallation, Migration und Historie',async t=>{
  const db=await openDatabase({memory:true});
  t.after(()=>db.close());
  await initializeDatabase(db);

  await t.test('24 Kartenartikel mit richtigen Dollarpreisen und allen sieben Aromen',async()=>{
    const {rows}=await db.query('SELECT * FROM products WHERE active=TRUE ORDER BY sort_order');
    assert.equal(rows.length,24);
    const expected={
      'Moonwater Chili':25000,'Steak Hamburger':35000,'Steakhouseplatte':40000,
      'Buddy Bier':22500,'Wein':35000,'Whisky':40000,'Cola':30000,
      'Eistee Pfirsich':25000,'Texas Water':20000,'Espresso':24000,'Latte Macchiato':22000,
      'Cuban Cigar':100000,'Bloodystrike':40000,'Moonhowl':40000,'Wizardspuff':40000,
      'Trinkblut':90000,'Magische E-Shisha':500000,'Magische Kohle':50000,
      'Sonnenmango':50000,'Feenapfel':50000,'Sternenbeere':50000,'Astraltraube':50000,
      'Blutmondkirsche':50000,'Frostminze':50000,
    };
    assert.deepEqual(Object.fromEntries(rows.map(p=>[p.name,p.price_cents])),expected);
    assert.equal(rows.filter(p=>p.category==='Aromen').length,7);
    assert.equal((await db.query('SELECT currency FROM settings WHERE id=1')).rows[0].currency,'USD');
  });

  await t.test('Bestehende Euro-Verkäufe bleiben erhalten und werden getrennt von Dollar-Umsätzen summiert',async()=>{
    // Zustand einer früheren Installation mit Beispielkarte und eigenen Artikeln.
    await db.query('DELETE FROM schema_migrations');
    await db.query('DELETE FROM stock_movements');
    await db.query("DELETE FROM products WHERE id<>'cola'");
    await db.query("UPDATE products SET price_cents=350,category='Alkoholfrei' WHERE id='cola'");
    await db.query("INSERT INTO products (id,name,category,price_cents) VALUES ('old-fashioned','Old Fashioned','Cocktails',1200),('custom','Eigener Artikel','Essen',99900)");
    await db.query("UPDATE settings SET currency='EUR' WHERE id=1");
    await db.query("INSERT INTO employees (id,name,name_key) VALUES ('legacy','Altbestand','altbestand')");
    await db.query("INSERT INTO orders (id,employee_id,total_cents,currency,payment) VALUES ('legacy-order','legacy',700,'EUR','cash')");
    await db.query("INSERT INTO order_items (order_id,product_id,name,price_cents,quantity) VALUES ('legacy-order','cola','Cola',350,2)");
    await initializeDatabase(db);
    assert.equal((await db.query("SELECT active FROM products WHERE id='old-fashioned'")).rows[0].active,false);
    assert.equal((await db.query("SELECT active FROM products WHERE id='custom'")).rows[0].active,true);
    assert.equal((await db.query("SELECT price_cents FROM products WHERE id='cola'")).rows[0].price_cents,30000);
    const old=(await db.query("SELECT total_cents,currency FROM orders WHERE id='legacy-order'")).rows[0];
    assert.deepEqual(old,{total_cents:700,currency:'EUR'});
    assert.equal((await db.query("SELECT price_cents FROM order_items WHERE order_id='legacy-order'")).rows[0].price_cents,350);
    await db.query("INSERT INTO orders (id,employee_id,total_cents,currency,payment) VALUES ('usd-order','legacy',60000,'USD','cash')");
    await db.query("INSERT INTO order_items (order_id,product_id,name,price_cents,quantity) VALUES ('usd-order','cola','Cola',30000,2)");
    const server=createApp(db).listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    try{
      const base=`http://127.0.0.1:${server.address().port}/api`;
      const login=await fetch(base+'/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Altbestand'})});
      const headers={Cookie:login.headers.get('set-cookie').split(';')[0]};
      const usd=await (await fetch(base+'/stats',{headers})).json();
      const eur=await (await fetch(base+'/stats?currency=EUR',{headers})).json();
      assert.equal(usd.currency,'USD');assert.equal(Number(usd.totals.total_cents),60000);
      assert.equal(eur.currency,'EUR');assert.equal(Number(eur.totals.total_cents),700);
      assert.equal(usd.orders.length,1);assert.equal(eur.orders.length,1);
      assert.deepEqual(new Set(usd.currencies),new Set(['EUR','USD']));
      const exportUsd=await (await fetch(base+'/orders/export?currency=USD',{headers})).text();
      assert.ok(exportUsd.includes('usd-order'));assert.ok(!exportUsd.includes('legacy-order'));
      const exportAll=await (await fetch(base+'/orders/export',{headers})).text();
      assert.ok(exportAll.includes('usd-order'));assert.ok(exportAll.includes('legacy-order'));
      assert.equal((await fetch(base+'/stats?currency=GBP',{headers})).status,400);
    }finally{await new Promise(resolve=>server.close(resolve));}
  });

  await t.test('Neustarts bewahren manuelle Preisänderungen und pausierte Artikel',async()=>{
    await db.query("UPDATE products SET price_cents=42000 WHERE id='cola'");
    await db.query("UPDATE products SET active=FALSE WHERE id='magische-e-shisha'");
    await initializeDatabase(db);
    assert.equal((await db.query("SELECT price_cents FROM products WHERE id='cola'")).rows[0].price_cents,42000);
    assert.equal((await db.query("SELECT active FROM products WHERE id='magische-e-shisha'")).rows[0].active,false);
    assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM schema_migrations')).rows[0].count,2);
    assert.equal((await db.query('SELECT COUNT(*)::int AS count FROM orders')).rows[0].count,2);
  });
});
