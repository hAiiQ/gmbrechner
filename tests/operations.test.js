import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,initializeDatabase} from '../lib/database.js';
import {createApp} from '../lib/app.js';

test('Lager, Vermietungen und Finanzen mit echter Datenbank',async t=>{
  const db=await openDatabase({memory:true});await initializeDatabase(db);
  const server=createApp(db,{loginLimit:1000,accessPassword:'test-bar-access'}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}/api`;
  let cookie;
  async function call(path,body,method=body?'POST':'GET'){
    const res=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};
  }
  const product=async id=>(await db.query('SELECT * FROM products WHERE id=$1',[id])).rows[0];
  const sale=(id,quantity,price,requestId=randomUUID())=>({id:requestId,payment:'cash',currency:'USD',items:[{productId:id,quantity,unitPriceCents:price}]});
  await t.test('Nur angemeldete Mitarbeiter haben Zugriff',async()=>{
    for(const path of ['/inventory','/rentals','/finance'])assert.equal((await call(path)).status,401);
    cookie=(await call('/login',{name:'Lager Team',password:'test-bar-access'})).cookie;
  });
  await t.test('Alle 24 Bildbestände: nur Stückzahlen, Stapel addiert, Warnung streng unter 30',async()=>{
    const inv=(await call('/inventory')).data;
    assert.equal(inv.products.length,24);assert.equal(inv.threshold,30);
    const expected={'Steak Hamburger':40,Steakhouseplatte:15,'Moonwater Chili':54,Cola:39,'Eistee Pfirsich':37,'Texas Water':12,Trinkblut:30,Espresso:40,'Latte Macchiato':39,Whisky:34,'Buddy Bier':50,Moonhowl:50,Bloodystrike:26,Wizardspuff:38,'Cuban Cigar':397,Sonnenmango:29,'Magische E-Shisha':9,Wein:46,Blutmondkirsche:39,Feenapfel:28,Sternenbeere:29,'Magische Kohle':59,Astraltraube:27,Frostminze:29};
    assert.deepEqual(Object.fromEntries(inv.products.map(p=>[p.name,p.stock_quantity])),expected);
    assert.equal(inv.products.filter(p=>p.stock_quantity<30).length,9);
    assert.equal(inv.movements.length,24);
  });
  await t.test('Bestand wird einmal abgezogen, Überverkauf und gleichzeitiger letzter Verkauf verhindert',async()=>{
    const payload=sale('trinkblut',1,90000);
    assert.equal((await call('/orders',payload)).status,201);
    assert.equal((await product('trinkblut')).stock_quantity,29);
    assert.equal((await call('/orders',payload)).status,201);
    assert.equal((await product('trinkblut')).stock_quantity,29);
    assert.equal((await call('/orders',sale('trinkblut',30,90000))).status,409);
    const inv=await call('/inventory/magische-e-shisha',{id:randomUUID(),quantity:1,expected_quantity:9,reason:'Inventur: nur noch ein Stück'});
    assert.equal(inv.status,201);
    const results=await Promise.all([call('/orders',sale('magische-e-shisha',1,500000)),call('/orders',sale('magische-e-shisha',1,500000))]);
    assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
    assert.equal((await product('magische-e-shisha')).stock_quantity,0);
  });
  await t.test('Storno gibt Lager zurück; Altbuchungen vor Inventur verändern Bestand nicht',async()=>{
    const payload=sale('texas-water',2,20000);await call('/orders',payload);
    assert.equal((await product('texas-water')).stock_quantity,10);
    assert.equal((await call('/orders/'+payload.id+'/void',{reason:'Teststorno'})).status,200);
    assert.equal((await product('texas-water')).stock_quantity,12);
    assert.equal((await call('/orders/'+payload.id+'/void',{reason:'Doppeltes Storno'})).status,409);
    assert.equal((await product('texas-water')).stock_quantity,12);
    const employee=(await db.query('SELECT id FROM employees LIMIT 1')).rows[0].id;
    await db.query("INSERT INTO orders (id,employee_id,total_cents,currency,payment) VALUES ('historisch',$1,90000,'USD','cash')",[employee]);
    await db.query("INSERT INTO order_items (order_id,product_id,name,price_cents,quantity) VALUES ('historisch','trinkblut','Trinkblut',90000,1)");
    assert.equal((await call('/orders/historisch/void',{reason:'Alte Buchung'})).status,200);
    assert.equal((await product('trinkblut')).stock_quantity,29);
  });
  await t.test('Inventur mit Grund, Doppelanfrage und Konfliktschutz; Neustart setzt nichts zurück',async()=>{
    const body={id:randomUUID(),quantity:70,expected_quantity:29,reason:'Lieferung von 41 Stück'};
    assert.equal((await call('/inventory/trinkblut',body)).status,201);
    assert.equal((await call('/inventory/trinkblut',body)).status,201);
    assert.equal((await product('trinkblut')).stock_quantity,70);
    assert.equal((await call('/inventory/trinkblut',{...body,id:randomUUID(),quantity:40})).status,409);
    assert.equal((await call('/inventory/trinkblut',{...body,id:randomUUID(),quantity:-1})).status,400);
    assert.equal((await call('/inventory/trinkblut',{...body,id:randomUUID(),reason:''})).status,400);
    await initializeDatabase(db);assert.equal((await product('trinkblut')).stock_quantity,70);
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM stock_movements WHERE id=$1',[body.id])).rows[0].n,1);
  });
  await t.test('Alte Beispielartikel archiviert; historischer Artikel und Umsatz bleiben erhalten',async()=>{
    await db.query("INSERT INTO products (id,name,category,price_cents) VALUES ('old-fashioned','Old Fashioned','Cocktails',1200)");
    await db.query("DELETE FROM schema_migrations WHERE id LIKE '%lagerbestand%'");
    await db.query("DELETE FROM stock_movements WHERE kind='initial'");
    await initializeDatabase(db);
    assert.equal((await product('old-fashioned')).archived,true);
    assert.ok(!(await call('/products?all=true')).data.products.some(p=>p.id==='old-fashioned'));
    assert.equal((await call('/products/old-fashioned',{name:'Wieder da',category:'Cocktails',price_cents:100,active:true},'PUT')).status,404);
    assert.equal((await call('/orders/historisch')).data.items[0].name,'Trinkblut');
  });
  const vip={space:'vip',unit:'hour',quantity:2,start:'2026-11-01T18:00',customer_name:'Max Muster',family:'Muster',phone:'01234'};
  let vipId,upperId;
  await t.test('VIP berechnet 2 × 50.000 $, ignoriert gefälschten Preis und bucht genau eine Einnahme',async()=>{
    const q=(await call('/rentals/quote',vip)).data.quote;
    assert.equal(q.total_cents,10000000);assert.equal(q.ends_at,'2026-11-01T19:00:00.000Z');
    const body={...vip,id:randomUUID(),total_cents:1};vipId=body.id;
    const r=await call('/rentals',body);assert.equal(r.status,201);assert.equal(r.data.rental.total_cents,10000000);
    assert.equal(r.data.rental.customer_name,'Max Muster');assert.equal(r.data.rental.family,'Muster');assert.equal(r.data.rental.phone,'01234');
    assert.equal((await call('/rentals',body)).status,201);
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM finance_entries WHERE rental_id=$1',[vipId])).rows[0].n,1);
    const money=(await call('/finance')).data.totals;
    assert.equal(Number(money.rental_income_cents),10000000);
  });
  await t.test('Mehrere Gäste im selben Bereich und Zeitraum sowie beide Bereiche gleichzeitig möglich',async()=>{
    assert.equal((await call('/rentals',{...vip,id:randomUUID(),customer_name:'Weiterer Gast',start:'2026-11-01T19:00'})).status,201);
    assert.equal((await call('/rentals',{...vip,id:randomUUID(),start:'2026-11-01T20:00',quantity:1})).status,201);
    const body={...vip,id:randomUUID(),space:'upper',unit:'week',quantity:1,family:''};upperId=body.id;
    const result=await call('/rentals',body);assert.equal(result.status,201);assert.equal(result.data.rental.total_cents,10000000);assert.equal(result.data.rental.family,'');
    assert.equal(result.data.rental.ends_at,'2026-11-08T17:00:00.000Z');
  });
  await t.test('Oberer Bereich hat feste 1- oder 4-Wochen-Tarife, auch über Sommerzeit und Monatsgrenzen',async()=>{
    const q=(await call('/rentals/quote',{space:'upper',unit:'four_weeks',start:'2027-04-01T18:00'})).data.quote;
    assert.equal(q.total_cents,25000000);assert.equal(q.ends_at,'2027-04-29T16:00:00.000Z');
    assert.equal(q.unit,'week');assert.equal(q.quantity,4);assert.equal(q.rate_cents*q.quantity,q.total_cents);
    const week=(await call('/rentals/quote',{space:'upper',unit:'week',start:'2027-03-27T18:00'})).data.quote;
    assert.equal(week.starts_at,'2027-03-27T17:00:00.000Z');assert.equal(week.ends_at,'2027-04-03T16:00:00.000Z');
    assert.equal(week.quantity,1);assert.equal(week.total_cents,10000000);
    const tampered=(await call('/rentals/quote',{space:'upper',unit:'four_weeks',quantity:99,start:'2027-04-01T18:00'})).data.quote;
    assert.equal(tampered.quantity,4);assert.equal(tampered.total_cents,25000000);assert.equal(tampered.ends_at,q.ends_at);
    const booked=await call('/rentals',{space:'upper',unit:'four_weeks',start:'2027-04-01T18:00',id:randomUUID(),customer_name:'Vier Wochen',phone:'555-0100'});
    assert.equal(booked.status,201);assert.equal(booked.data.rental.quantity,4);assert.equal(booked.data.rental.total_cents,25000000);assert.equal(booked.data.rental.ends_at,q.ends_at);
    assert.equal((await call('/rentals/quote',{space:'upper',unit:'month',start:'2027-04-01T18:00'})).status,400);
    assert.equal((await call('/rentals/quote',{space:'upper',unit:'toString',start:'2027-04-01T18:00'})).status,400);
    for(const body of [{...vip,start:'2027-02-30T18:00'},{...vip,start:'2027-03-28T02:30'},{...vip,unit:'week'},{...vip,quantity:0},{...vip,start:'kein Datum'}])assert.equal((await call('/rentals/quote',body)).status,400);
    assert.equal((await call('/rentals',{...vip,id:randomUUID(),phone:''})).status,400);
  });
  await t.test('Bereits gespeicherte Monatsmiete und ihre Einnahme bleiben nach dem Tarifwechsel erhalten',async()=>{
    const id=randomUUID(),entryId=randomUUID();
    await db.query(`INSERT INTO rentals (id,employee_id,space,customer_name,family,phone,starts_at,ends_at,unit,quantity,rate_cents,total_cents,currency)
      SELECT $1,employee_id,space,'Bestehender Gast',family,phone,'2029-01-01 17:00:00+00','2029-02-01 17:00:00+00','month',1,25000000,25000000,currency FROM rentals WHERE id=$2`,[id,upperId]);
    await db.query(`INSERT INTO finance_entries (id,employee_id,rental_id,kind,amount_cents,reason,occurred_on)
      SELECT $1,employee_id,id,'income',total_cents,'Bestehende Monatsmiete','2026-10-12' FROM rentals WHERE id=$2`,[entryId,id]);
    const before=(await call('/rentals')).data.rentals.find(r=>r.id===id);
    await initializeDatabase(db);
    const retry=await call('/rentals',{...vip,id,space:'upper',unit:'month',quantity:1});
    assert.equal(retry.status,201);assert.equal(retry.data.rental.unit,'month');
    assert.equal(retry.data.rental.ends_at,before.ends_at);assert.equal(retry.data.rental.total_cents,25000000);
    const after=(await call('/rentals')).data.rentals.find(r=>r.id===id);assert.deepEqual(after,before);
    const money=await db.query('SELECT amount_cents FROM finance_entries WHERE rental_id=$1',[id]);
    assert.equal(money.rows.length,1);assert.equal(money.rows[0].amount_cents,25000000);
  });
  await t.test('Vermietungsstorno betrifft nur diese Buchung und storniert ihre Einnahme einmal',async()=>{
    const f=(await db.query('SELECT id FROM finance_entries WHERE rental_id=$1',[vipId])).rows[0].id;
    assert.equal((await call('/finance/'+f+'/void',{reason:'Nicht hier'})).status,409);
    assert.equal((await call('/rentals/'+vipId+'/cancel',{reason:'Gast abgesagt'})).status,200);
    assert.equal((await call('/rentals/'+vipId+'/cancel',{reason:'Nochmal'})).status,200);
    const saved=(await db.query('SELECT * FROM finance_entries WHERE rental_id=$1',[vipId])).rows[0];assert.ok(saved.voided_at);assert.equal(saved.void_reason,'Gast abgesagt');
    assert.equal((await call('/rentals',{...vip,id:randomUUID()})).status,201);
    assert.equal((await call('/rentals')).data.rentals.find(r=>r.id===vipId).cancel_reason,'Gast abgesagt');
  });
  await t.test('Sonstige Einnahmen/Ausgaben, Grund erforderlich, Saldo mit Kasse und Stornos',async()=>{
    const income={id:randomUUID(),kind:'income',amount_cents:123456,reason:'Veranstaltung',occurred_on:'2026-10-12'};
    const expense={id:randomUUID(),kind:'expense',amount_cents:40000,reason:'Warenlieferung',occurred_on:'2026-10-12'};
    assert.equal((await call('/finance',income)).status,201);assert.equal((await call('/finance',income)).status,201);
    assert.equal((await call('/finance',expense)).status,201);
    for(const body of [{...income,id:randomUUID(),reason:''},{...income,id:randomUUID(),amount_cents:-10},{...income,id:randomUUID(),amount_cents:1.5},{...income,id:randomUUID(),occurred_on:'2026-02-30'}])assert.equal((await call('/finance',body)).status,400);
    const overview=(await call('/finance')).data;
    assert.equal(Number(overview.totals.other_income_cents),123456);assert.equal(Number(overview.totals.expense_cents),40000);
    assert.equal(overview.totals.balance_cents,Number(overview.totals.sales_cents)+Number(overview.totals.rental_income_cents)+123456-40000);
    const filtered=(await call('/finance?from=2026-10-12&to=2026-10-12')).data;
    assert.ok(filtered.entries.some(e=>e.reason==='Warenlieferung'));
    assert.equal(filtered.entries.find(e=>e.id===expense.id).occurred_on,'2026-10-12');
    assert.equal((await call('/finance?from=2026-10-13&to=2026-10-12')).status,400);
    assert.equal((await call('/finance/'+expense.id+'/void',{reason:'Falscher Betrag'})).status,200);
    assert.equal((await call('/finance/'+expense.id+'/void',{reason:'Doppelt'})).status,200);
    assert.equal(Number((await call('/finance')).data.totals.expense_cents),0);
    assert.equal(Number((await call('/finance?currency=EUR')).data.totals.rental_income_cents),0);
    await initializeDatabase(db);
    assert.ok((await call('/rentals')).data.rentals.some(r=>r.id===upperId));
    assert.equal(Number((await call('/finance')).data.totals.other_income_cents),123456);
  });
});
