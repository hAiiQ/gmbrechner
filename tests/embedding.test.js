import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,initializeDatabase} from '../lib/database.js';
import {createApp} from '../lib/app.js';

test('FiveM-Tablet: Einbetten und Anmeldung im Produktionsmodus',async t=>{
  const db=await openDatabase({memory:true});await initializeDatabase(db);
  const server=createApp(db,{production:true,accessPassword:'test-tablet-access'}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}`;
  const origin=base.replace('http:','https:');
  async function call(path,{body,cookie,requestOrigin=origin,type='application/json'}={}){
    return fetch(base+path,{method:body?'POST':'GET',headers:{'X-Forwarded-Proto':'https',
      ...(body?{'Content-Type':type,Origin:requestOrigin}:{}),...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});
  }
  await t.test('HTML und API erlauben iframe, andere Schutzheader bleiben erhalten',async()=>{
    for(const path of ['/','/api/config']){
      const result=await call(path);assert.equal(result.status,200);
      assert.equal(result.headers.get('x-frame-options'),null);
      const csp=result.headers.get('content-security-policy');assert.doesNotMatch(csp,/frame-ancestors/);
      assert.match(csp,/script-src 'self'/);assert.match(csp,/object-src 'none'/);
      assert.equal(result.headers.get('x-content-type-options'),'nosniff');
      assert.match(result.headers.get('strict-transport-security'),/max-age=/);
    }
  });
  await t.test('Login, Sitzungsabfrage und Logout verwenden ein iframe-fähiges HTTPS-Cookie',async()=>{
    for(const remember_me of [false,true]){
      const login=await call('/api/login',{body:{name:'Tablet Team',password:'test-tablet-access',remember_me}});
      assert.equal(login.status,200);
      const header=login.headers.get('set-cookie'),cookie=header.split(';')[0];
      assert.match(header,/HttpOnly/);assert.match(header,/Secure/);assert.match(header,/SameSite=None/);
      if(remember_me)assert.match(header,/Max-Age=2592000/);else assert.doesNotMatch(header,/Max-Age|Expires/);
      const me=await call('/api/me',{cookie});assert.equal(me.status,200);assert.equal((await me.json()).employee.name,'Tablet Team');
      const logout=await call('/api/logout',{body:{},cookie});assert.equal(logout.status,200);
      assert.match(logout.headers.get('set-cookie'),/SameSite=None/);assert.match(logout.headers.get('set-cookie'),/Secure/);
      assert.equal((await call('/api/me',{cookie})).status,401);
    }
  });
  await t.test('Einbettung gibt der Tablet-Seite keinen Zugriff auf geschützte Daten oder Buchungen',async()=>{
    const login=await call('/api/login',{body:{name:'Tablet Team',password:'test-tablet-access'}});
    const cookie=login.headers.get('set-cookie').split(';')[0];
    assert.equal((await call('/api/products')).status,401);
    const read=await call('/api/products',{cookie});assert.equal(read.headers.get('access-control-allow-origin'),null);
    for(const requestOrigin of ['https://cfx-nui-tablet','https://fremde-seite.example','null']){
      const rejected=await call('/api/logout',{body:{},cookie,requestOrigin});assert.equal(rejected.status,403);
    }
    assert.equal((await call('/api/logout',{body:{},cookie,type:'text/plain'})).status,415);
    assert.equal((await call('/api/me',{cookie})).status,200);
  });
});
