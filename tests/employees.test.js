import {grantTestManager} from './fixtures.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {openDatabase,initializeDatabase} from '../lib/database.js';
import {createApp} from '../lib/app.js';

test('Mitarbeiterverwaltung, Sitzungen und erhaltene Abrechnung',async t=>{
  const db=await openDatabase({memory:true});
  const legacyId=randomUUID();
  // Start with the employee table from before this feature was introduced.
  await db.query(`CREATE TABLE employees(id TEXT PRIMARY KEY,name TEXT NOT NULL,name_key TEXT NOT NULL UNIQUE,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  await db.query('INSERT INTO employees(id,name,name_key) VALUES($1,$2,$3)',[legacyId,'Bestehendes Team','bestehendes team']);
  await initializeDatabase(db);
  const server=createApp(db,{accessPassword:'employee-test-access',loginLimit:1000}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}/api`;
  let alice,bob,bobSecond,aliceId,bobId,orderId,previousTotals;
  async function call(path,body,{cookie=alice,method=body?'POST':'GET'}={}){
    const response=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    const result={status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
    if(path==='/login'&&body?.name?.trim().toLowerCase()==='alice')await grantTestManager(db,result);
    return result;
  }
  const login=(name)=>call('/login',{name,password:'employee-test-access',remember_me:true});
  const list=async()=>{const result=await call('/employees');assert.equal(result.status,200);return result.data.employees;};
  const bobEntry=async()=>(await list()).find(e=>e.id===bobId);
  async function unchangedMoney(){
    const wallet=await call('/wallet');assert.equal(wallet.status,200);
    assert.equal(Number(wallet.data.employees.find(e=>e.id===bobId).cash_cents),30000);
    assert.equal(Number(wallet.data.total_cents),30000);
    assert.deepEqual((await call('/stats')).data.totals,previousTotals);
    assert.equal((await call('/orders/'+orderId)).status,200);
  }
  await t.test('Alle Mitarbeiter-Endpunkte benötigen Anmeldung; bestehende Namen erhalten sichere Vorgaben',async()=>{
    for(const [path,body,method] of [['/employees',undefined,'GET'],['/employees/'+legacyId,{role:'Barkeeper',department:'Bar'},'PUT'],['/employees/'+legacyId+'/sessions/end',{},'POST'],['/employees/'+legacyId+'/status',{active:false},'PUT']])assert.equal((await call(path,body,{cookie:null,method})).status,401);
    const a=await login('Alice');alice=a.cookie;aliceId=a.data.employee.id;
    const old=(await list()).find(e=>e.id===legacyId);
    assert.equal(old.role,'Barkeeper');assert.equal(old.department,'');assert.equal(old.active,true);assert.equal(old.last_login_at,null);assert.equal(old.session_count,0);
  });
  await t.test('Jeder neue Name erscheint, mehrere Anmeldungen behalten dieselbe Person',async()=>{
    const b=await login('Bob');bob=b.cookie;bobId=b.data.employee.id;
    const second=await login('  BOB  ');bobSecond=second.cookie;assert.equal(second.data.employee.id,bobId);
    const row=await bobEntry();assert.equal(row.name,'Bob');assert.equal(row.session_count,2);assert.ok(row.last_login_at);assert.equal((await list()).length,3);
    assert.ok(!JSON.stringify(await list()).includes('token_hash'));assert.ok(!JSON.stringify(await list()).includes('employee-test-access'));
    const version=(await db.query('SELECT access_version FROM sessions LIMIT 1')).rows[0].access_version;
    for(const [expires,accessVersion] of [["NOW()-INTERVAL '1 day'",version],["NOW()+INTERVAL '1 day'",'wrong-version']]){
      await db.query(`INSERT INTO sessions(token_hash,employee_id,expires_at,access_version) VALUES($1,$2,${expires},$3)`,[createHash('sha256').update(randomBytes(32)).digest('hex'),bobId,accessVersion]);
    }
    assert.equal((await bobEntry()).session_count,2);
  });
  await t.test('Voreingestellten Job und freie Abteilung speichern, normalisieren und in der Anmeldung anzeigen',async()=>{
    const result=await call('/employees/'+bobId,{role:'  barkeeper   leitung ',department:'Shisha & VIP-Service',active:false,name:'Falscher Name'},{method:'PUT'});
    assert.equal(result.status,200);assert.equal(result.data.employee.role,'Barkeeper Leitung');assert.equal(result.data.employee.department,'Shisha & VIP-Service');assert.equal(result.data.employee.active,true);assert.equal(result.data.employee.name,'Bob');
    const me=await call('/me',undefined,{cookie:bobSecond});assert.equal(me.data.employee.role,'Barkeeper Leitung');assert.equal(me.data.employee.department,'Shisha & VIP-Service');
    assert.equal((await call('/employees/'+aliceId,{role:'Inhaber',department:''},{method:'PUT'})).status,200);
    for(const body of [{role:'',department:''},{role:'x'.repeat(61),department:''},{role:'Barkeeper',department:'x'.repeat(81)},{role:'Barkeeper',department:2},{role:'Chef\u0000',department:''}])assert.equal((await call('/employees/'+bobId,body,{method:'PUT'})).status,400);
  });
  await t.test('Bargeld und Umsatz sind dauerhaft mit der ursprünglichen Person verbunden',async()=>{
    const products=await call('/products'),cola=products.data.products.find(p=>p.name==='Cola');orderId=randomUUID();
    assert.equal((await call('/orders',{id:orderId,currency:'USD',payment:'cash',items:[{productId:cola.id,quantity:1,unitPriceCents:cola.price_cents}]},{cookie:bob})).status,201);
    previousTotals=(await call('/stats')).data.totals;
    assert.equal(Number((await bobEntry()).cash_cents),30000);await unchangedMoney();
  });
  await t.test('Anmeldungen beenden betrifft alle Geräte, lässt die erneute Anmeldung zu und bewahrt Abrechnung',async()=>{
    const kicked=await call('/employees/'+bobId+'/sessions/end',{});assert.equal(kicked.status,200);assert.ok(kicked.data.removed_sessions>=2);
    for(const cookie of [bob,bobSecond])assert.equal((await call('/me',undefined,{cookie})).status,401);
    assert.equal((await bobEntry()).session_count,0);await unchangedMoney();
    const again=await login('bob');assert.equal(again.status,200);assert.equal(again.data.employee.id,bobId);bob=again.cookie;
    assert.equal((await bobEntry()).session_count,1);await unchangedMoney();
  });
  await t.test('Deaktivieren sperrt die normalisierten Namen und alle Zugriffe ohne Datenverlust',async()=>{
    assert.equal((await call('/employees/'+bobId+'/status',{active:false},{method:'PUT'})).status,200);
    assert.equal((await call('/me',undefined,{cookie:bob})).status,401);
    const row=await bobEntry();assert.equal(row.active,false);assert.equal(row.session_count,0);assert.ok(row.deactivated_at);
    for(const name of ['Bob','  BOB  ','Ｂｏｂ']){const rejected=await login(name);assert.equal(rejected.status,403);assert.equal(rejected.cookie,undefined);}
    // An accidentally restored session must also be rejected for an inactive employee.
    const token=randomBytes(32).toString('hex'),version=(await db.query('SELECT access_version FROM sessions WHERE employee_id=$1 LIMIT 1',[aliceId])).rows[0].access_version;
    await db.query("INSERT INTO sessions(token_hash,employee_id,expires_at,access_version) VALUES($1,$2,NOW()+INTERVAL '1 day',$3)",[createHash('sha256').update(token).digest('hex'),bobId,version]);
    assert.equal((await call('/products',undefined,{cookie:'bar_session='+token})).status,401);
    assert.equal((await bobEntry()).session_count,0);
    assert.equal((await call('/employees/'+bobId+'/status',{active:false},{method:'PUT'})).status,200);
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM sessions WHERE employee_id=$1',[bobId])).rows[0].n,0);
    await unchangedMoney();assert.equal((await list()).length,3);
  });
  await t.test('Wieder aktivieren erhält ID, Rolle und Geld; alte Cookies bleiben ungültig',async()=>{
    const result=await call('/employees/'+bobId+'/status',{active:true},{method:'PUT'});assert.equal(result.status,200);
    assert.equal((await call('/me',undefined,{cookie:bob})).status,401);
    const again=await login('Bob');assert.equal(again.status,200);bob=again.cookie;
    assert.equal(again.data.employee.id,bobId);assert.equal(again.data.employee.role,'Barkeeper Leitung');assert.equal((await bobEntry()).deactivated_at,null);await unchangedMoney();
  });
  await t.test('Gleichzeitige Anmeldung und Deaktivierung hinterlassen keine gültige Sitzung',async()=>{
    const results=await Promise.all([login('Bob'),call('/employees/'+bobId+'/status',{active:false},{method:'PUT'})]);
    assert.equal(results[1].status,200);assert.ok([200,403].includes(results[0].status));
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM sessions WHERE employee_id=$1',[bobId])).rows[0].n,0);
    await unchangedMoney();
  });
  await t.test('Weitere Deployments erhalten Rollen, Sperren, Anmeldungen und Geld',async()=>{
    const row=await bobEntry();await initializeDatabase(db);
    assert.deepEqual(await bobEntry(),row);assert.equal((await call('/me')).status,200);assert.equal((await login('Bob')).status,403);await unchangedMoney();
  });
  await t.test('Fehlerhafte Ziele/Status und eigene Deaktivierung werden abgewiesen; eigene Abmeldung möglich',async()=>{
    assert.equal((await call('/employees/not-an-id/sessions/end',{})).status,400);
    assert.equal((await call('/employees/'+randomUUID()+'/sessions/end',{})).status,404);
    assert.equal((await call('/employees/'+randomUUID(),{role:'Barkeeper',department:'Bar'},{method:'PUT'})).status,404);
    assert.equal((await call('/employees/'+randomUUID()+'/status',{active:true},{method:'PUT'})).status,404);
    assert.equal((await call('/employees/'+aliceId+'/status',{active:'false'},{method:'PUT'})).status,400);
    assert.equal((await call('/employees/'+aliceId+'/status',{active:false},{method:'PUT'})).status,409);
    assert.equal((await call('/me')).status,200);
    assert.equal((await call('/employees/'+aliceId+'/sessions/end',{})).status,200);
    assert.equal((await call('/me')).status,401);
  });
});
