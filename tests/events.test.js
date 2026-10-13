import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,initializeDatabase} from '../lib/database.js';
import {createApp} from '../lib/app.js';

test('Team-Events: Termine, gemeinsame Bearbeitung und dauerhafte Speicherung',async t=>{
  const db=await openDatabase({memory:true});await initializeDatabase(db);
  const server=createApp(db,{accessPassword:'events-test-access',loginLimit:1000}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}/api`;
  let alice,bob,aliceId,eventId,initialWallet,initialStock;
  const payload=()=>({id:randomUUID(),title:'Whiskyabend',start:'2027-01-15T20:00',description:''});
  async function call(route,body,{cookie=alice,method=body?'POST':'GET'}={}){
    const response=await fetch(base+route,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  const list=async()=>{const result=await call('/events');assert.equal(result.status,200);return result.data.events;};
  await t.test('Alle Event-Endpunkte erfordern Anmeldung',async()=>{
    for(const [route,body,method] of [['/events',undefined,'GET'],['/events',payload(),'POST'],['/events/'+randomUUID(),{...payload(),revision:1},'PUT'],['/events/'+randomUUID(),{revision:1},'DELETE']])assert.equal((await call(route,body,{cookie:null,method})).status,401);
    const a=await call('/login',{name:'Alice Events',password:'events-test-access'});alice=a.cookie;aliceId=a.data.employee.id;
    const b=await call('/login',{name:'Bob Events',password:'events-test-access'});bob=b.cookie;
    initialWallet=(await call('/wallet')).data;
    initialStock=(await call('/products')).data.products;
    assert.deepEqual(await list(),[]);
  });
  await t.test('Datum und Uhrzeit reichen; Beschreibung und Ende sind optional',async()=>{
    const input=payload();delete input.description;input.title='  Whiskyabend   im Club  ';eventId=input.id;
    const saved=await call('/events',input);assert.equal(saved.status,201);
    assert.equal(saved.data.event.title,'Whiskyabend im Club');assert.equal(saved.data.event.description,'');assert.equal(saved.data.event.ends_at,null);
    assert.equal(new Date(saved.data.event.starts_at).toISOString(),'2027-01-15T19:00:00.000Z');assert.equal(saved.data.event.revision,1);
    const [event]=await list();assert.equal(event.created_by_name,'Alice Events');assert.equal(event.created_by,aliceId);
    assert.equal((await call('/events',undefined,{cookie:bob})).data.events[0].id,eventId);
  });
  await t.test('Wiederholte und parallele Speicheranfragen erzeugen nur einen Termin',async()=>{
    const input=payload();
    const results=await Promise.all([call('/events',input),call('/events',input)]);
    results.forEach(result=>assert.equal(result.status,201));
    assert.equal((await list()).filter(e=>e.id===input.id).length,1);
    assert.equal((await call('/events',{...input,title:'Andere Veranstaltung'})).status,409);
    assert.equal((await call('/events',input,{cookie:bob})).status,409);
  });
  await t.test('Optionales Ende, mehrzeilige Infos und Sommerzeit werden korrekt gespeichert',async()=>{
    const saved=await call('/events',{...payload(),start:'2027-07-16T22:30',end:'2027-07-17T02:00',description:'Treffen um 21 Uhr.\nBar vorbereiten.'});
    assert.equal(saved.status,201);assert.equal(new Date(saved.data.event.starts_at).toISOString(),'2027-07-16T20:30:00.000Z');
    assert.equal(new Date(saved.data.event.ends_at).toISOString(),'2027-07-17T00:00:00.000Z');assert.ok(saved.data.event.description.includes('\n'));
  });
  await t.test('Ungültige Daten, Endzeiten, Zeitumstellung und Eingaben werden abgelehnt',async()=>{
    for(const change of [{title:''},{title:'x'.repeat(101)},{start:'2027-02-30T20:00'},{start:'2027-03-28T02:30'},{start:'2027-01-15T24:00'},{start:'2027-01-15T20:00Z'},{start:3},{start:'2019-12-31T20:00'},{end:'2027-01-15T20:00'},{end:'2027-01-14T20:00'},{description:'x'.repeat(2001)},{description:'Info\u0000'},{description:42},{id:'bad-id'}]){
      assert.equal((await call('/events',{...payload(),...change})).status,400,JSON.stringify(change));
    }
  });
  await t.test('Andere Mitarbeiter können bearbeiten; veraltete Änderungen überschreiben nichts',async()=>{
    const input={title:'Jazz & Whisky',start:'2027-01-16T21:00',end:'',description:'Das ganze Team ist informiert.',revision:1};
    const updated=await call('/events/'+eventId,input,{cookie:bob,method:'PUT'});assert.equal(updated.status,200);assert.equal(updated.data.event.revision,2);
    assert.equal((await list()).find(e=>e.id===eventId).updated_by_name,'Bob Events');
    assert.equal((await call('/events/'+eventId,{...input,title:'Veraltete Änderung'},{method:'PUT'})).status,409);
    assert.equal((await call('/events/'+eventId,{revision:1},{method:'DELETE'})).status,409);
    assert.equal((await list()).find(e=>e.id===eventId).title,'Jazz & Whisky');
    assert.equal((await call('/events/'+eventId,{...input,revision:0},{method:'PUT'})).status,400);
    assert.equal((await call('/events/'+randomUUID(),input,{method:'PUT'})).status,404);
  });
  await t.test('Neustarts und Mitarbeiterentfernung bewahren Events samt Urheber',async()=>{
    const before=await list();await initializeDatabase(db);assert.deepEqual(await list(),before);
    assert.equal((await call('/employees/'+aliceId+'/kick',{}, {cookie:bob})).status,200);
    const events=await call('/events',undefined,{cookie:bob});assert.equal(events.status,200);assert.equal(events.data.events.find(e=>e.id===eventId).created_by_name,'Alice Events');
    alice=bob;
  });
  await t.test('Löschen entfernt den Termin für alle; Wiederholungen sind unschädlich',async()=>{
    assert.equal((await call('/events/'+eventId,{revision:2},{method:'DELETE'})).status,200);
    assert.ok(!(await list()).some(e=>e.id===eventId));
    assert.equal((await call('/events/'+eventId,{revision:2},{method:'DELETE'})).status,200);
    assert.equal((await call('/events/'+eventId,{title:'Wiederverwendung',start:'2027-01-15T20:00',revision:3},{method:'PUT'})).status,404);
    assert.equal((await call('/events',{id:eventId,title:'Whiskyabend im Club',start:'2027-01-15T20:00'})).status,409);
    assert.equal((await call('/events/bad-id',{revision:1},{method:'DELETE'})).status,400);
    assert.equal((await call('/events/'+randomUUID(),{revision:1},{method:'DELETE'})).status,404);
  });
  await t.test('Eventplanung verändert weder Geld noch Verkäufe, Lager oder Vermietungen',async()=>{
    const wallet=(await call('/wallet')).data;
    assert.deepEqual(wallet,initialWallet);
    assert.deepEqual((await call('/products')).data.products,initialStock);
    for(const table of ['orders','rentals','finance_entries']){
      assert.equal(Number((await db.query('SELECT COUNT(*) AS count FROM '+table)).rows[0].count),0);
    }
  });
});
