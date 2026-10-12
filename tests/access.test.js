import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {openDatabase,initializeDatabase} from '../lib/database.js';
import {createApp} from '../lib/app.js';

test('Bar-Passwort und dauerhafte Anmeldung',async t=>{
  const db=await openDatabase({memory:true});t.after(()=>db.close());await initializeDatabase(db);
  const listen=async password=>{
    const server=createApp(db,{accessPassword:password,loginLimit:1000}).listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
    return `http://127.0.0.1:${server.address().port}/api`;
  };
  const password='test-bar-access',base=await listen(password);let remembered,temporary;
  async function call(path,{body,cookie,host=base}={}){
    const r=await fetch(host+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
    return {status:r.status,data:await r.json(),header:r.headers.get('set-cookie'),cookie:r.headers.get('set-cookie')?.split(';')[0]};
  }
  await t.test('Fehlendes und falsches Passwort lehnen den Zugriff ab, Geheimnisse werden nicht zurückgegeben',async()=>{
    for(const value of [undefined,'wrong-password',null,123]){
      const result=await call('/login',{body:{name:'Test Team',password:value}});
      assert.equal(result.status,401);assert.ok(!JSON.stringify(result.data).includes(password));assert.equal(result.cookie,undefined);
    }
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM employees')).rows[0].n,0);
    assert.equal((await call('/purchases')).status,401);
    const config=await call('/config');assert.deepEqual(config.data,{currency:'USD'});
  });
  await t.test('Angemeldet bleiben setzt ein HttpOnly-Cookie und Ablauf nach 30 Tagen',async()=>{
    const result=await call('/login',{body:{name:'Test Team',password,remember_me:true}});remembered=result.cookie;
    assert.equal(result.status,200);assert.match(result.header,/Max-Age=2592000/);assert.match(result.header,/HttpOnly/);assert.match(result.header,/SameSite=Strict/);
    assert.equal((await call('/me',{cookie:remembered})).data.employee.name,'Test Team');
    const token=remembered.split('=')[1],hash=createHash('sha256').update(token).digest('hex');
    const row=(await db.query('SELECT expires_at,access_version FROM sessions WHERE token_hash=$1',[hash])).rows[0];
    assert.ok(+new Date(row.expires_at)-Date.now()>29*24*3600000);assert.ok(+new Date(row.expires_at)-Date.now()<31*24*3600000);assert.ok(row.access_version);
  });
  await t.test('Ohne Bleiben wird ein Browser-Sitzungscookie verwendet, Großschreibung behält Mitarbeiter',async()=>{
    const result=await call('/login',{body:{name:'TEST TEAM',password,remember_me:false}});temporary=result.cookie;
    assert.equal(result.status,200);assert.ok(!/Max-Age|Expires/.test(result.header));
    assert.equal(result.data.employee.id,(await call('/me',{cookie:remembered})).data.employee.id);
    const token=temporary.split('=')[1],hash=createHash('sha256').update(token).digest('hex');
    const row=(await db.query('SELECT expires_at FROM sessions WHERE token_hash=$1',[hash])).rows[0];
    assert.ok(+new Date(row.expires_at)-Date.now()<13*3600000);
  });
  await t.test('Bereits bestehende Anmeldung ohne Passwort ist nach dem Update ungültig',async()=>{
    const token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex');
    const employee=(await call('/me',{cookie:remembered})).data.employee.id;
    await db.query("INSERT INTO sessions (token_hash,employee_id,expires_at) VALUES ($1,$2,NOW()+INTERVAL '1 day')",[hash,employee]);
    assert.equal((await call('/me',{cookie:'bar_session='+token})).status,401);
  });
  await t.test('Neustart mit gleichem Passwort bewahrt Anmeldung, Passwortänderung sperrt alte Sitzungen',async()=>{
    const same=await listen(password);assert.equal((await call('/me',{cookie:remembered,host:same})).status,200);
    const changed=await listen('different-test-password');assert.equal((await call('/me',{cookie:remembered,host:changed})).status,401);
    assert.equal((await call('/login',{host:changed,body:{name:'Test Team',password}})).status,401);
    assert.equal((await call('/login',{host:changed,body:{name:'Test Team',password:'different-test-password'}})).status,200);
  });
  await t.test('Abgelaufene Cookies und Logout lassen keinen erneuten Zugriff zu',async()=>{
    const token=temporary.split('=')[1],hash=createHash('sha256').update(token).digest('hex');
    await db.query("UPDATE sessions SET expires_at=NOW()-INTERVAL '1 second' WHERE token_hash=$1",[hash]);
    assert.equal((await call('/me',{cookie:temporary})).status,401);
    const result=await call('/logout',{body:{},cookie:remembered});assert.equal(result.status,200);assert.match(result.header,/Expires=/);
    assert.equal((await call('/me',{cookie:remembered})).status,401);
  });
});
