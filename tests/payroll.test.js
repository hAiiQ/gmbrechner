import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,initializeDatabase} from '../lib/database.js';
import {createApp} from '../lib/app.js';
import {shiftWage} from '../lib/payroll.js';

test('Stempeluhr, Rangwahl und Lohnauszahlung mit echten Transaktionen',async t=>{
  const db=await openDatabase({memory:true});await initializeDatabase(db);
  const server=createApp(db,{accessPassword:'payroll-test',loginLimit:1000}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}/api`;let owner,staff,staffId,other,firstShift,secondShift,firstPayout;
  const call=async(route,body,{cookie=owner,method=body?'POST':'GET'}={})=>{const r=await fetch(base+route,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
  const login=name=>call('/login',{name,password:'payroll-test'});
  const summary=async()=>(await call('/payroll/me',undefined,{cookie:staff})).data;
  const payoutBody=async()=>({id:randomUUID(),employee_id:staffId,expected_snapshot:(await summary()).employee.snapshot});
  await t.test('Stempeluhr und eigener Lohn benötigen Anmeldung, Auszahlung bleibt der Geschäftsführung vorbehalten',async()=>{
    for(const route of ['/timeclock','/payroll/me','/payroll'])assert.equal((await call(route,undefined,{cookie:null})).status,401);
    owner=(await login('Michael Black')).cookie;const s=await login('Stempel Team');staff=s.cookie;staffId=s.data.employee.id;other=(await login('Anderes Team')).cookie;
    assert.equal((await call('/employees/'+staffId,{roles:['Barkeeper Leitung','Security'],department:'Test'},{method:'PUT'})).status,200);
    assert.equal((await call('/payroll/me',undefined,{cookie:staff})).status,200);assert.equal((await call('/payroll',undefined,{cookie:staff})).status,403);
    assert.equal((await call('/payroll/'+staffId,undefined,{cookie:other})).status,403);
    assert.equal((await call('/payroll/payout',await payoutBody(),{cookie:staff})).status,403);
  });
  await t.test('Nur zugewiesene Arbeitsränge; genau ein Stundenlohn je Schicht trotz mehrerer Ränge',async()=>{
    const jobs=(await call('/timeclock',undefined,{cookie:staff})).data.jobs;
    assert.deepEqual(jobs.map(j=>j.job),['Barkeeper Leitung','Security']);assert.equal(jobs[0].hourly_rate_cents,1500000);assert.equal(jobs[1].hourly_rate_cents,1000000);
    assert.equal((await call('/timeclock/in',{id:randomUUID(),job:'Manager',hourly_rate_cents:9999999},{cookie:staff})).status,403);
    const request={id:randomUUID(),job:'Security',hourly_rate_cents:9999999};
    const results=await Promise.all([call('/timeclock/in',request,{cookie:staff}),call('/timeclock/in',request,{cookie:staff})]);results.forEach(r=>assert.equal(r.status,201));
    firstShift=results[0].data.shift;assert.equal(firstShift.hourly_rate_cents,1000000);assert.equal(firstShift.job,'Security');
    assert.equal((await call('/timeclock/in',{id:randomUUID(),job:'Barkeeper Leitung'},{cookie:staff})).status,409);
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM time_shifts WHERE employee_id=$1 AND ended_at IS NULL',[staffId])).rows[0].n,1);
  });
  await t.test('Laufende Schicht und Session überstehen Neustart; Schichtwechsel ändert keinen gespeicherten Tarif',async()=>{
    await db.query("UPDATE time_shifts SET started_at=NOW()-INTERVAL '90 minutes' WHERE id=$1",[firstShift.id]);
    await initializeDatabase(db);
    assert.equal((await call('/timeclock',undefined,{cookie:staff})).data.active_shift.id,firstShift.id);
    assert.equal((await call('/employees/'+staffId,{roles:['Barkeeper Leitung'],department:'Bar'},{method:'PUT'})).status,200);
    assert.equal((await call('/timeclock/out',{id:randomUUID(),shift_id:firstShift.id},{cookie:other})).status,403);
    const stopped=await call('/timeclock/out',{id:randomUUID(),shift_id:firstShift.id},{cookie:staff});assert.equal(stopped.status,200);
    firstShift=stopped.data.shift;assert.equal(firstShift.hourly_rate_cents,1000000);assert.ok(Number(firstShift.worked_seconds)>=5400);assert.ok(Number(firstShift.worked_seconds)<5420);
    assert.equal(Number(firstShift.amount_cents),Math.round(Number(firstShift.worked_seconds)*1000000/3600));
    assert.equal(Number((await summary()).employee.pending_cents),Number(firstShift.amount_cents));
    assert.equal(shiftWage(3600,1000000),1000000);assert.equal(shiftWage(1800,1500000),750000);assert.equal(shiftWage(1,2000000),556);
  });
  await t.test('Wiederholtes Ausstempeln erzeugt keinen zweiten Lohn und beendet keine neue Schicht',async()=>{
    const next=await call('/timeclock/in',{id:randomUUID(),job:'Barkeeper Leitung'},{cookie:staff});assert.equal(next.status,201);secondShift=next.data.shift;
    const repeated=await call('/timeclock/out',{id:randomUUID(),shift_id:firstShift.id},{cookie:staff});assert.equal(repeated.status,200);
    assert.equal((await call('/timeclock',undefined,{cookie:staff})).data.active_shift.id,secondShift.id);
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM payroll_credits WHERE shift_id=$1',[firstShift.id])).rows[0].n,1);
  });
  await t.test('Kein Bankguthaben rollt Auszahlung vollständig zurück',async()=>{
    const before=await summary();assert.equal((await call('/payroll/payout',await payoutBody())).status,409);
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM payroll_payouts')).rows[0].n,0);
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM finance_entries WHERE payroll_payout_id IS NOT NULL')).rows[0].n,0);
    assert.equal((await summary()).employee.pending_cents,before.employee.pending_cents);
  });
  await t.test('Auszahlung belastet nur Bank, erzeugt eine Ausgabe und bucht auch bei Wiederholung nur einmal',async()=>{
    await db.query("UPDATE wallet_accounts SET balance_cents=100000000 WHERE id='bank'");
    firstPayout=await payoutBody();const results=await Promise.all([call('/payroll/payout',firstPayout),call('/payroll/payout',firstPayout)]);results.forEach(r=>assert.equal(r.status,201));
    assert.equal(Number((await db.query("SELECT balance_cents FROM wallet_accounts WHERE id='bank'")).rows[0].balance_cents),100000000-Number(firstShift.amount_cents));
    assert.equal(Number((await summary()).employee.pending_cents),0);assert.equal(Number((await summary()).employee.paid_cents),Number(firstShift.amount_cents));
    const expense=(await db.query('SELECT * FROM finance_entries WHERE payroll_payout_id=$1',[firstPayout.id])).rows[0];assert.equal(expense.kind,'expense');assert.equal(expense.payment,'bank');
    assert.equal((await call('/finance/'+expense.id+'/void',{reason:'Umgehung'})).status,409);
    assert.equal((await call('/payroll/payout',await payoutBody())).status,409);
  });
  await t.test('Neue Lohnpositionen verhindern veraltete Auszahlungen, laufende Schichten bleiben erhalten',async()=>{
    const oldSnapshot=(await summary()).employee.snapshot;
    await db.query("UPDATE time_shifts SET started_at=NOW()-INTERVAL '30 minutes' WHERE id=$1",[secondShift.id]);
    const ended=await call('/timeclock/out',{id:randomUUID(),shift_id:secondShift.id},{cookie:staff});assert.equal(ended.status,200);assert.equal(ended.data.shift.hourly_rate_cents,1500000);
    assert.equal((await call('/payroll/payout',{id:randomUUID(),employee_id:staffId,expected_snapshot:oldSnapshot})).status,409);
    assert.equal((await call('/payroll/payout',firstPayout)).status,201);assert.ok(Number((await summary()).employee.pending_cents)>0);
  });
  await t.test('Rauswerfen beendet eine laufende Schicht und bewahrt den offenen Lohn',async()=>{
    const started=await call('/timeclock/in',{id:randomUUID(),job:'Barkeeper Leitung'},{cookie:staff});assert.equal(started.status,201);
    await db.query("UPDATE time_shifts SET started_at=NOW()-INTERVAL '10 minutes' WHERE id=$1",[started.data.shift.id]);
    assert.equal((await call('/employees/'+staffId+'/kick',{})).status,200);
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM time_shifts WHERE employee_id=$1 AND ended_at IS NULL',[staffId])).rows[0].n,0);
    const employee=(await call('/payroll/'+staffId)).data.employee;assert.ok(Number(employee.pending_cents)>0);assert.ok(employee.removed_at);
  });
});
