import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase,initializeDatabase} from '../lib/database.js';
import {createApp} from '../lib/app.js';

test('Mehrere Ränge verbinden Rechte und bleiben bei Neustarts erhalten',async t=>{
  const db=await openDatabase({memory:true});await initializeDatabase(db);
  const server=createApp(db,{accessPassword:'multiple-ranks-test',loginLimit:1000}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}/api`;let owner,ownerId,staff,staffId;
  const call=async(route,body,{cookie=owner,method=body?'POST':'GET'}={})=>{
    const response=await fetch(base+route,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  const set=roles=>call('/employees/'+staffId,{roles,department:'Bar & Empfang'},{method:'PUT'});
  const login=name=>call('/login',{name,password:'multiple-ranks-test'});
  await t.test('Bisherige Einzelränge und die Anmeldung behalten ihre Zuordnung',async()=>{
    const a=await login('Michael Black');owner=a.cookie;ownerId=a.data.employee.id;
    const b=await login('Mehrfach Team');staff=b.cookie;staffId=b.data.employee.id;
    assert.deepEqual(a.data.employee.roles,['Inhaber']);assert.deepEqual(b.data.employee.roles,['Barkeeper']);
  });
  await t.test('Bar und Security gemeinsam erlauben Kasse und Eintritt ohne Verwaltung',async()=>{
    const saved=await set(['Security','Barkeeper']);assert.equal(saved.status,200);
    assert.deepEqual(saved.data.employee.roles,['Barkeeper','Security']);
    const current=await call('/me',undefined,{cookie:staff});assert.equal(current.data.employee.permissions.cashier,true);assert.equal(current.data.employee.permissions.entrance,true);assert.equal(current.data.employee.permissions.manage,false);
    for(const route of ['/products','/admissions'])assert.equal((await call(route,undefined,{cookie:staff})).status,200);
    assert.equal((await call('/employees',undefined,{cookie:staff})).status,403);
    await initializeDatabase(db);const again=await login('Mehrfach Team');assert.deepEqual(again.data.employee.roles,['Barkeeper','Security']);
    const person=(await call('/employees')).data.employees.find(e=>e.id===staffId);assert.deepEqual(person.roles,['Barkeeper','Security']);assert.equal(person.department,'Bar & Empfang');
  });
  await t.test('Ungültige oder leere Auswahlen und Selbstbeförderung werden abgewehrt',async()=>{
    for(const roles of [[],['Chef'],['Security','security'],null,'Manager',[{role:'Manager'}],Array(7).fill('Manager')])assert.equal((await set(roles)).status,400);
    assert.equal((await call('/employees/'+staffId,{roles:['Manager'],department:''},{cookie:staff,method:'PUT'})).status,403);
    assert.equal((await call('/employees/'+ownerId,{roles:['Barkeeper','Security'],department:''},{method:'PUT'})).status,409);
  });
  await t.test('Entfernen eines Rangs nimmt nur dessen Rechte und alte Clients bleiben kompatibel',async()=>{
    assert.equal((await set(['Security'])).status,200);
    assert.equal((await call('/products',undefined,{cookie:staff})).status,403);assert.equal((await call('/admissions',undefined,{cookie:staff})).status,200);
    assert.equal((await call('/employees/'+staffId,{role:'Barkeeper',department:''},{method:'PUT'})).status,200);
    const current=await call('/me',undefined,{cookie:staff});assert.deepEqual(current.data.employee.roles,['Barkeeper']);
    assert.equal((await call('/products',undefined,{cookie:staff})).status,200);assert.equal((await call('/admissions',undefined,{cookie:staff})).status,403);
  });
  await t.test('Beide Leitungen verwalten die freigegebenen Bereiche ohne Finanzzugriff oder Selbstbeförderung',async()=>{
    for(const job of ['Barkeeper Leitung','Security Leitung']){
      assert.equal((await set([job])).status,200);
      for(const route of ['/products?all=true','/admissions','/inventory','/purchases','/rentals','/events','/employees'])assert.equal((await call(route,undefined,{cookie:staff})).status,200,job+' '+route);
      for(const route of ['/finance','/wallet','/stats'])assert.equal((await call(route,undefined,{cookie:staff})).status,403,route);
      assert.equal((await call('/employees/'+staffId,{roles:[job,'Manager'],department:''},{cookie:staff,method:'PUT'})).status,403);
      assert.equal((await call('/employees/'+ownerId,{roles:['Barkeeper'],department:''},{cookie:staff,method:'PUT'})).status,403);
      assert.equal((await call('/employees/'+ownerId+'/kick',{}, {cookie:staff})).status,403);
      const product=(await call('/products',undefined,{cookie:staff})).data.products.find(p=>p.id==='cola');
      assert.equal((await call('/products/'+product.id,{name:product.name,category:product.category,description:product.description,price_cents:product.price_cents,active:true},{cookie:staff,method:'PUT'})).status,200);
    }
  });
});
