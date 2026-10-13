import {grantTestManager} from './fixtures.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,initializeDatabase} from '../lib/database.js';
import {createApp} from '../lib/app.js';

test('Kostenlose und unbegrenzte Vermietungen sind unabhängige Optionen',async t=>{
  const db=await openDatabase({memory:true});await initializeDatabase(db);
  const server=createApp(db,{accessPassword:'rental-options-test',loginLimit:1000}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}/api`;let cookie,otherCookie,legacy;
  async function call(path,body,{session=cookie}={}){
    const response=await fetch(base+path,{method:body?'POST':'GET',headers:{...(session?{Cookie:session}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    const result={status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
    if(path==='/login')await grantTestManager(db,result);
    return result;
  }
  const body=(space,free=false,unlimited=false)=>({id:randomUUID(),space,free,unlimited,unit:space==='vip'?'hour':'week',quantity:2,start:'2026-01-01T18:00',customer_name:'Testgast '+space,family:'Testfamilie',phone:'555-0100',payment:'cash'});
  const wallet=async()=>(await call('/wallet')).data;
  const finances=async()=>(await call('/finance')).data;
  const rentals=async()=>(await call('/rentals')).data.rentals;
  const financeCount=async id=>(await db.query('SELECT COUNT(*)::int AS count FROM finance_entries WHERE rental_id=$1',[id])).rows[0].count;
  const walletCount=async id=>(await db.query('SELECT COUNT(*)::int AS count FROM wallet_transactions w JOIN finance_entries f ON f.id=w.finance_entry_id WHERE f.rental_id=$1',[id])).rows[0].count;

  await t.test('Anmeldung erforderlich; neue Optionen ändern die normalen Tarife nicht',async()=>{
    assert.equal((await call('/rentals/quote',body('vip'),{session:null})).status,401);
    assert.equal((await call('/rentals',body('vip'),{session:null})).status,401);
    cookie=(await call('/login',{name:'VIP Team',password:'rental-options-test'})).cookie;
    otherCookie=(await call('/login',{name:'Anderes Team',password:'rental-options-test'})).cookie;
    const regular=body('vip');delete regular.free;delete regular.unlimited;
    const result=await call('/rentals',regular);assert.equal(result.status,201);legacy=result.data.rental;
    assert.equal(legacy.total_cents,10000000);assert.equal(legacy.is_free,false);assert.equal(legacy.is_unlimited,false);assert.equal(legacy.ends_at,'2026-01-01T19:00:00.000Z');assert.equal(await financeCount(legacy.id),1);
  });
  await t.test('Kostenlos mit normalem Zeitraum: beide Bereiche erhalten Enddatum und 0 $, ohne Geldzugang',async()=>{
    const before=await wallet(),totals=(await finances()).totals;
    for(const space of ['vip','upper']){
      const payload=body(space,true,false),quote=await call('/rentals/quote',payload);
      assert.equal(quote.status,200);assert.equal(quote.data.quote.total_cents,0);assert.ok(quote.data.quote.ends_at);assert.equal(quote.data.quote.is_free,true);assert.equal(quote.data.quote.is_unlimited,false);
      const result=await call('/rentals',{...payload,total_cents:99999999,rate_cents:99999999});assert.equal(result.status,201);
      assert.equal(result.data.rental.total_cents,0);assert.equal(result.data.rental.rate_cents,0);assert.equal(result.data.rental.ends_at,quote.data.quote.ends_at);assert.equal(result.data.rental.family,'Testfamilie');
      assert.equal(await financeCount(payload.id),0);assert.equal(await walletCount(payload.id),0);
    }
    assert.deepEqual((await finances()).totals,totals);assert.equal((await wallet()).total_cents,before.total_cents);
  });
  await t.test('Unbegrenzt und bezahlt: kein Enddatum, gewählter Tarif einmalig für VIP und beide oberen Tarife',async()=>{
    const expected=[['vip','hour',5000000],['upper','week',10000000],['upper','four_weeks',25000000]];
    const before=await wallet(),income=Number((await finances()).totals.rental_income_cents);
    for(const [space,unit,amount] of expected){
      const payload={...body(space,false,true),unit,quantity:99999};
      const quote=await call('/rentals/quote',payload);assert.equal(quote.status,200);assert.equal(quote.data.quote.total_cents,amount);assert.equal(quote.data.quote.ends_at,null);assert.equal(quote.data.quote.is_free,false);
      const result=await call('/rentals',payload);assert.equal(result.status,201);assert.equal(result.data.rental.ends_at,null);assert.equal(result.data.rental.total_cents,amount);assert.equal(result.data.rental.is_unlimited,true);
      assert.equal(await financeCount(payload.id),1);assert.equal(await walletCount(payload.id),1);
      const entry=(await finances()).entries.find(e=>e.rental_id===payload.id);assert.equal(entry.amount_cents,amount);assert.match(entry.reason,/Unbegrenzt.*einmaliger Tarif/);
    }
    assert.equal(Number((await wallet()).total_cents)-Number(before.total_cents),40000000);assert.equal(Number((await finances()).totals.rental_income_cents)-income,40000000);
  });
  await t.test('Beide Kästchen: ohne Enddatum und kostenlos, auch mit einem Beginn weit in der Zukunft',async()=>{
    const w=await wallet(),totals=(await finances()).totals;
    for(const space of ['vip','upper']){
      const payload={...body(space,true,true),start:'2080-06-01T12:00'};delete payload.quantity;
      const result=await call('/rentals',payload);assert.equal(result.status,201);assert.equal(result.data.rental.total_cents,0);assert.equal(result.data.rental.ends_at,null);assert.equal(result.data.rental.is_free,true);assert.equal(result.data.rental.is_unlimited,true);
      assert.equal(await financeCount(payload.id),0);assert.equal(await walletCount(payload.id),0);
    }
    assert.equal((await wallet()).total_cents,w.total_cents);assert.deepEqual((await finances()).totals,totals);
  });
  await t.test('Gefälschte Optionen, falsche Tarife und ungültiger Beginn werden vor dem Speichern abgewiesen',async()=>{
    const count=(await rentals()).length,w=await wallet();
    for(const invalid of [{free:'true'},{unlimited:'false'},{free:null},{unlimited:1},{space:'invalid'},{unit:'month'},{start:'2027-02-30T18:00'},{start:'2027-03-28T02:30'}]){
      assert.equal((await call('/rentals',{...body('vip',true,true),...invalid})).status,400,JSON.stringify(invalid));
    }
    assert.equal((await call('/rentals',body('vip',true,false))).status,201);
    assert.equal((await call('/rentals',{...body('vip',true,false),quantity:0})).status,400);
    assert.equal((await rentals()).length,count+1);assert.equal((await wallet()).total_cents,w.total_cents);
  });
  await t.test('Wiederholte und gleichzeitige Buchungen sind einmalig; mehrere unbegrenzte Gäste bleiben erlaubt',async()=>{
    const w=await wallet(),payload=body('upper',false,true),free=body('upper',true,true);
    const responses=await Promise.all([call('/rentals',payload),call('/rentals',payload),call('/rentals',free)]);assert.deepEqual(responses.map(r=>r.status),[201,201,201]);
    assert.equal((await rentals()).filter(r=>[payload.id,free.id].includes(r.id)).length,2);assert.equal(await financeCount(payload.id),1);assert.equal(await financeCount(free.id),0);assert.equal(Number((await wallet()).total_cents)-Number(w.total_cents),10000000);
    const retry=await call('/rentals',{...payload,free:true,unlimited:false});assert.equal(retry.status,201);assert.equal(retry.data.rental.is_free,false);assert.equal(retry.data.rental.is_unlimited,true);assert.equal(retry.data.rental.total_cents,10000000);
    assert.equal((await call('/rentals',payload,{session:otherCookie})).status,409);
  });
  await t.test('Storno funktioniert ohne Einnahme; bezahlte unbegrenzte Vermietung erstattet nur einmal',async()=>{
    const free=body('vip',true,true),paid=body('vip',false,true);
    await call('/rentals',free);await call('/rentals',paid);
    const w=await wallet();assert.equal((await call('/rentals/'+free.id+'/cancel',{reason:'Kostenloser Gast sagt ab'})).status,200);assert.equal((await wallet()).total_cents,w.total_cents);
    const result=await call('/rentals/'+paid.id+'/cancel',{reason:'Bezahlter Gast sagt ab'});assert.equal(result.status,200);assert.ok(result.data.rental.cancelled_at);assert.equal(result.data.rental.ends_at,null);
    assert.equal(Number((await wallet()).total_cents),Number(w.total_cents)-5000000);assert.equal((await call('/rentals/'+paid.id+'/cancel',{reason:'Wiederholter Storno'})).status,200);assert.equal(Number((await wallet()).total_cents),Number(w.total_cents)-5000000);
    assert.equal((await finances()).entries.find(e=>e.rental_id===paid.id).voided_at!==null,true);
  });
  await t.test('Neue Flags und normale Altbuchungen behalten Zeiträume, Geld und Kundendaten bei weiteren Updates',async()=>{
    const before=await rentals(),w=await wallet(),totals=(await finances()).totals;
    await initializeDatabase(db);
    assert.deepEqual(await rentals(),before);assert.deepEqual((await finances()).totals,totals);assert.equal((await wallet()).total_cents,w.total_cents);
    const old=(await rentals()).find(r=>r.id===legacy.id);assert.deepEqual(old,{...legacy,employee_name:'VIP Team'});
  });
});
