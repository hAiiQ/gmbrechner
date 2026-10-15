import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,initializeDatabase} from '../lib/database.js';
import {createApp} from '../lib/app.js';
import {PERMISSION_OPTIONS} from '../lib/permissions.js';

test('Individuelle Zugriffsrechte pro Mitarbeiter, unabhängig von Arbeitsrängen',async t=>{
  const db=await openDatabase({memory:true});await initializeDatabase(db);
  const server=createApp(db,{accessPassword:'permissions-preview',loginLimit:1000}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  t.after(async()=>{await new Promise(r=>server.close(r));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}/api`;let owner,ownerId,manager,staff,staffId,lead,leadId;
  const call=async(route,body,{cookie=owner,method=body?'POST':'GET'}={})=>{const response=await fetch(base+route,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,data:response.headers.get('content-type')?.includes('json')?await response.json():await response.text(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  const login=name=>call('/login',{name,password:'permissions-preview'});
  const rights=(...enabled)=>Object.fromEntries(PERMISSION_OPTIONS.map(({key})=>[key,enabled.includes(key)]));
  const set=(permissions,cookie=owner,id=staffId)=>call('/employees/'+id+'/permissions',{permissions},{method:'PUT',cookie});
  const rank=(id,roles,cookie=owner)=>call('/employees/'+id,{roles,department:'Test'},{method:'PUT',cookie});
  await t.test('Bisherige Rechte bleiben erhalten und nur Geschäftsführung vergibt Haken',async()=>{
    const a=await login('Michael Black');owner=a.cookie;ownerId=a.data.employee.id;
    const b=await login('Rechte Team');staff=b.cookie;staffId=b.data.employee.id;
    const c=await login('Leitung Team');lead=c.cookie;leadId=c.data.employee.id;await rank(leadId,['Barkeeper Leitung']);
    const m=await login('Management Team');manager=m.cookie;await rank(m.data.employee.id,['Manager']);
    assert.equal((await call('/products',undefined,{cookie:staff})).status,200);
    assert.equal((await set(rights('inventory'),staff)).status,403);assert.equal((await set(rights('inventory'),lead)).status,403);
    assert.equal((await set(rights('inventory'),null)).status,401);
    assert.equal((await set(rights('inventory'),manager)).status,200);
    const person=(await call('/employees')).data.employees.find(e=>e.id===staffId);assert.equal(person.permissions.inventory,true);assert.equal(person.permission_defaults.cashier,true);assert.equal(person.custom_permissions.cashier,false);
  });
  const routes={cashier:'/cashier-summary',entrance:'/admissions',sales:'/stats',payroll:'/payroll/me',payroll_admin:'/payroll',statistics:'/employee-statistics',inventory:'/inventory',purchases:'/purchases',vip:'/rentals',events:'/events',finance:'/finance',wallet:'/wallet',employees:'/employees',assortment:'/products?all=true'};
  await t.test('Jeder einzelne Bereich ist ohne Freigabe anderer Seiten nutzbar',async()=>{
    for(const key of Object.keys(routes)){
      assert.equal((await set(rights(key,...(key==='payroll_admin'?['payroll']:[])))).status,200);
      for(const [other,route] of Object.entries(routes)){
        const expected=other===key||key==='payroll_admin'&&other==='payroll'?200:403;
        const result=await call(route,undefined,{cookie:staff});assert.equal(result.status,expected,key+' → '+route+' '+JSON.stringify(result.data));
        if(key==='purchases'&&other==='purchases')assert.equal(typeof result.data.bank_cents,'string');
      }
    }
  });
  await t.test('Leere Auswahl sperrt Daten und Mutationen, Stempeluhr bleibt erhalten',async()=>{
    assert.equal((await set(rights())).status,200);
    assert.equal((await call('/me',undefined,{cookie:staff})).status,200);assert.equal((await call('/timeclock',undefined,{cookie:staff})).status,200);
    for(const [route,body,method] of [
      ['/products',{name:'Unerlaubt'},'POST'],['/products/cola',{name:'Unerlaubt'},'PUT'],['/settings',{currency:'EUR'},'PUT'],
      ['/orders',{id:randomUUID()},'POST'],['/admissions',{id:randomUUID()},'POST'],['/purchases',{id:randomUUID()},'POST'],
      ['/rentals',{id:randomUUID()},'POST'],['/finance',{id:randomUUID()},'POST'],['/wallet',{id:randomUUID()},'POST'],
      ['/employees/'+leadId+'/kick',{},'POST'],['/events',{id:randomUUID()},'POST'],['/payroll/payout',{id:randomUUID()},'POST']
    ])assert.equal((await call(route,body,{cookie:staff,method})).status,403,route);
    const shift=await call('/timeclock/in',{id:randomUUID(),job:'Barkeeper'},{cookie:staff});assert.equal(shift.status,201);assert.equal(shift.data.shift.hourly_rate_cents,1000000);
    assert.equal((await call('/timeclock/out',{id:randomUUID(),shift_id:shift.data.shift.id},{cookie:staff})).status,200);
  });
  await t.test('Eigene und fremde Lohnrechte sind getrennt und Lohnverwaltung erlaubt Auszahlung',async()=>{
    await set(rights('payroll'));const started=await call('/timeclock/in',{id:randomUUID(),job:'Barkeeper Leitung'},{cookie:lead});assert.equal(started.status,201);const shift=started.data.shift;
    assert.equal((await call('/timeclock/out',{id:randomUUID(),shift_id:shift.id},{cookie:staff})).status,403);
    await set(rights('payroll','payroll_admin'));
    assert.equal((await call('/timeclock/out',{id:randomUUID(),shift_id:shift.id},{cookie:staff})).status,200);
    const result=await call('/payroll/payout',{id:randomUUID(),employee_id:leadId,expected_snapshot:'a'.repeat(64)},{cookie:staff});assert.equal(result.status,409);assert.match(result.data.error,/geändert/);
  });
  await t.test('Auch Leitungen mit individuellen Sperren erhalten keine alten Pauschalrechte',async()=>{
    await set(rights('employees'));await rank(staffId,['Barkeeper Leitung','Security']);
    assert.equal((await call('/inventory',undefined,{cookie:staff})).status,403);
    assert.equal((await call('/products?all=true',undefined,{cookie:staff})).status,403);
    assert.equal((await call('/employees',undefined,{cookie:staff})).status,200);
    const custom=(await call('/me',undefined,{cookie:staff})).data.employee.permissions;
    assert.equal(custom.operations,false);assert.equal(custom.allOrders,false);assert.equal(custom.allAdmissions,false);
    assert.equal((await set(rights('finance'),staff,leadId)).status,403);
    assert.equal((await rank(staffId,['Manager'],staff)).status,403);
    assert.equal((await rank(leadId,['Security'],staff)).status,200);
    const access=(await call('/me',undefined,{cookie:lead})).data.employee.permissions;
    assert.equal(access.inventory,true);assert.equal(access.entrance,true); // Previous access preserved; rank changes cannot alter permissions.
    await rank(leadId,['Barkeeper Leitung'],manager);
  });
  await t.test('Neustart, neue Anmeldung und Rangwechsel bewahren individuelle Auswahl; Zurücksetzen stellt Rangrechte wieder her',async()=>{
    await set(rights('vip','payroll'));await initializeDatabase(db);
    const rejoined=await login('Rechte Team');assert.equal(rejoined.data.employee.permissions.vip,true);assert.equal(rejoined.data.employee.permissions.cashier,false);
    assert.deepEqual(rejoined.data.employee.roles,['Barkeeper Leitung','Security']);
    assert.equal((await set(null)).status,200);const current=(await call('/me',undefined,{cookie:staff})).data.employee;
    assert.equal(current.custom_permissions,null);assert.equal(current.permissions.cashier,true);assert.equal(current.permissions.inventory,true);assert.equal(current.permissions.finance,false);
  });
  await t.test('Ungültige Eingaben, unbekannte Rechte und Management-Sperren werden abgewiesen',async()=>{
    for(const permissions of [[],false,'all',{},rights('payroll_admin'),{...rights(),manage:true},{...rights(),cashier:'yes'}])assert.equal((await set(permissions)).status,400);
    assert.equal((await set(rights(),owner,ownerId)).status,409);assert.equal((await set(null,owner,ownerId)).status,200);
    assert.equal((await call('/me')).data.employee.permissions.finance,true);
    assert.equal((await db.query('SELECT COUNT(*)::int n FROM orders')).rows[0].n,0);
    assert.equal((await db.query('SELECT COUNT(*)::int n FROM payroll_payouts')).rows[0].n,0);
  });
});
