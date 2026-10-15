import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,initializeDatabase} from '../lib/database.js';
import {createApp} from '../lib/app.js';

test('Rollenrechte und Eintrittsbuchungen werden auf dem Server durchgesetzt',async t=>{
  const db=await openDatabase({memory:true});await initializeDatabase(db);
  const server=createApp(db,{accessPassword:'role-test-access',loginLimit:1000}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}/api`;
  let owner,ownerId,manager,managerId,bartender,bartenderId,lead,guard,guardId,otherGuard,otherGuardId,guest,cashEntry,cardEntry,bankEntry;
  const call=async(path,body,{cookie=owner,method=body?'POST':'GET'}={})=>{
    const response=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  const login=name=>call('/login',{name,password:'role-test-access',role:'Inhaber',permissions:{manage:true}});
  const role=async(name,job)=>{const session=await login(name);assert.equal((await call('/employees/'+session.data.employee.id,{role:job,department:'Testbereich'},{method:'PUT'})).status,200);return session;};
  const entry=(price=50000,quantity=2,payment='cash')=>({id:randomUUID(),unit_price_cents:price,quantity,payment});
  await t.test('Michael Black wird einmalig Inhaber; neue Namen erhalten keinen Vollzugriff',async()=>{
    const initial=await login('  MICHAEL   BLACK  ');owner=initial.cookie;ownerId=initial.data.employee.id;
    assert.equal(initial.data.employee.role,'Inhaber');assert.equal(initial.data.employee.permissions.manage,true);
    guest=(await login('Unbekannter Mitarbeiter')).cookie;
    const unknown=await call('/me',undefined,{cookie:guest});assert.equal(unknown.data.employee.permissions.manage,false);
    assert.equal((await call('/employees',undefined,{cookie:guest})).status,403);
    const m=await role('Manager Team','Manager');manager=m.cookie;managerId=m.data.employee.id;
    const b=await role('Barkeeper Team','Barkeeper');bartender=b.cookie;bartenderId=b.data.employee.id;
    lead=(await role('Barleitung Team','Barkeeper Leitung')).cookie;
    const s=await role('Security Team','Security');guard=s.cookie;guardId=s.data.employee.id;
    const s2=await role('Security Zwei','Security Leitung');otherGuard=s2.cookie;otherGuardId=s2.data.employee.id;
  });
  await t.test('Die Jobliste enthält genau sechs Vorgaben; andere Jobnamen werden abgelehnt',async()=>{
    const jobs=['Inhaber','Manager','Barkeeper Leitung','Barkeeper','Security Leitung','Security'];
    assert.deepEqual((await call('/employees')).data.jobs,jobs);
    for(const value of ['Chef','Mitarbeiter','Service','Security-Leitung','Manager 2']){
      assert.equal((await call('/employees/'+bartenderId,{role:value,department:'Bar'},{method:'PUT'})).status,400);
    }
    const normalized=await call('/employees/'+otherGuardId,{role:'  security   leitung  ',department:'Einlass frei eintragbar'},{method:'PUT'});
    assert.equal(normalized.status,200);assert.equal(normalized.data.employee.role,'Security Leitung');
    assert.equal(normalized.data.employee.department,'Einlass frei eintragbar');
    const me=await call('/me',undefined,{cookie:otherGuard});
    for(const [key,value] of Object.entries({manage:false,operations:true,statistics:true,payroll:true,cashier:true,entrance:true}))assert.equal(me.data.employee.permissions[key],value);
  });
  await t.test('Inhaber und Manager erreichen alle Seiten und dürfen Rollen und Preise ändern',async()=>{
    for(const cookie of [owner,manager])for(const path of ['/stats','/inventory','/purchases','/rentals','/finance','/wallet','/employees','/events','/admissions','/products?all=true'])assert.equal((await call(path,undefined,{cookie})).status,200,path);
    assert.equal((await call('/employees/'+bartenderId,{role:'Barkeeper',department:'Bar unten'},{cookie:manager,method:'PUT'})).status,200);
  });
  await t.test('Barkeeper können nur Kasse und Teamtermine lesen; keine Verwaltung oder Selbstbeförderung',async()=>{
    for(const cookie of [bartender,guest]){
      for(const path of ['/products','/cashier-summary','/events'])assert.equal((await call(path,undefined,{cookie})).status,200,path);
      const products=(await call('/products',undefined,{cookie})).data.products;assert.ok(!Object.hasOwn(products[0],'purchase_price_cents'));
      for(const path of ['/stats','/orders/export','/inventory','/purchases','/rentals','/finance','/wallet','/employees','/products?all=true','/admissions'])assert.equal((await call(path,undefined,{cookie})).status,403,path);
      for(const [path,method] of [['/products','POST'],['/products/cola','PUT'],['/settings','PUT'],['/finance','POST'],['/wallet/adjustment','POST'],['/rentals','POST'],['/purchases','POST'],['/events','POST'],['/events/'+randomUUID(),'PUT'],['/events/'+randomUUID(),'DELETE'],['/employees/'+bartenderId,'PUT'],['/employees/'+ownerId+'/kick','POST'],['/admissions','POST']])assert.equal((await call(path,{role:'Inhaber'},{cookie,method})).status,403,path);
    }
    const sales={id:randomUUID(),items:[{productId:'cola',quantity:1,unitPriceCents:30000}],payment:'cash',currency:'USD'};
    const saved=await call('/orders',sales,{cookie:bartender});assert.equal(saved.status,201);
    assert.equal((await call('/orders/'+sales.id,undefined,{cookie:bartender})).status,200);
    assert.equal((await call('/orders/'+sales.id,undefined,{cookie:guest})).status,403);
    assert.equal((await call('/orders/'+sales.id+'/void',{reason:'Falsche Person'},{cookie:guest})).status,403);
    assert.equal((await call('/orders/'+sales.id+'/void',{reason:'Testverkauf'},{cookie:bartender})).status,200);
  });
  await t.test('Security hat ausschließlich Eintritt und lesbare Teamtermine, auch bei direkten API-Aufrufen',async()=>{
    for(const cookie of [guard]){
      for(const path of ['/products','/cashier-summary','/stats','/inventory','/wallet','/finance','/employees','/purchases','/rentals'])assert.equal((await call(path,undefined,{cookie})).status,403,path);
      for(const path of ['/orders','/products','/finance','/wallet/transfer','/events'])assert.equal((await call(path,{}, {cookie})).status,403,path);
    }
    assert.equal((await call('/events',undefined,{cookie:guard})).status,200);
    assert.equal((await call('/admissions',undefined,{cookie:guard})).status,200);
    assert.equal((await call('/admissions',entry(),{cookie:null})).status,401);
  });
  await t.test('Preis × Menge verbucht Eintritt, Finanz-Einnahme und richtige Geldquelle atomar',async()=>{
    const stock=(await call('/products')).data.products;
    cashEntry=entry(62500,4,'cash');cardEntry=entry(27500,3,'card');bankEntry=entry(15000,2,'bank');
    for(const body of [cashEntry,cardEntry,bankEntry]){const saved=await call('/admissions',{...body,employee_id:ownerId,total_cents:1},{cookie:guard});assert.equal(saved.status,201);assert.equal(saved.data.admission.employee_id,guardId);assert.equal(saved.data.admission.total_cents,body.unit_price_cents*body.quantity);}
    const wallet=(await call('/wallet')).data;assert.equal(Number(wallet.total_cents),362500);assert.equal(Number(wallet.bank_cents),30000);assert.equal(Number(wallet.clearing_cents),82500);assert.equal(Number(wallet.employees.find(e=>e.id===guardId).cash_cents),250000);
    const finances=(await call('/finance')).data;assert.equal(finances.entries.filter(e=>e.admission_id).length,3);assert.equal(finances.totals.balance_cents,362500);
    assert.deepEqual((await call('/products')).data.products,stock);
    const list=(await call('/admissions',undefined,{cookie:guard})).data;assert.equal(list.admissions.length,3);assert.equal(Number(list.totals.quantity),9);
  });
  await t.test('Wiederholungen buchen einmal; ungültige Preise und Mengen verändern nichts',async()=>{
    const results=await Promise.all([call('/admissions',cashEntry,{cookie:guard}),call('/admissions',cashEntry,{cookie:guard})]);results.forEach(r=>assert.equal(r.status,201));
    assert.equal((await call('/admissions',{...cashEntry,quantity:3},{cookie:guard})).status,409);
    assert.equal((await call('/admissions',cashEntry,{cookie:otherGuard})).status,409);
    const before=(await call('/wallet')).data;
    for(const change of [{quantity:0},{quantity:1.5},{quantity:10001},{unit_price_cents:0},{unit_price_cents:-1},{unit_price_cents:0.5},{unit_price_cents:10000001},{quantity:10000,unit_price_cents:10000000},{payment:'bitcoin'},{id:'bad-id'}])assert.equal((await call('/admissions',{...entry(),...change},{cookie:guard})).status,400);
    assert.deepEqual((await call('/wallet')).data,before);
  });
  await t.test('Security sieht und storniert eigene Eintritte; Manager sehen alle',async()=>{
    const other=entry();assert.equal((await call('/admissions',other,{cookie:otherGuard})).status,201);
    assert.equal((await call('/admissions',undefined,{cookie:guard})).data.admissions.length,3);
    assert.equal((await call('/admissions',undefined,{cookie:manager})).data.admissions.length,4);
    assert.equal((await call('/admissions/'+other.id,undefined,{cookie:guard})).status,403);
    assert.equal((await call('/admissions/'+other.id+'/void',{reason:'Fremde Buchung'},{cookie:guard})).status,403);
    const finance=(await call('/finance')).data.entries.find(e=>e.admission_id===cashEntry.id);
    assert.equal((await call('/finance/'+finance.id+'/void',{reason:'Umgehung'})).status,409);
    for(let i=0;i<2;i++)assert.equal((await call('/admissions/'+cardEntry.id+'/void',{reason:'Doppelt erfasst'},{cookie:guard})).status,200);
    const wallet=(await call('/wallet')).data;assert.equal(Number(wallet.clearing_cents),0);assert.equal(Number(wallet.total_cents),380000);
    assert.ok((await call('/finance')).data.entries.find(e=>e.admission_id===cardEntry.id).voided_at);
  });
  await t.test('Rollenänderungen gelten sofort für vorhandene Sitzungen; Besitzerzuweisung bleibt einmalig',async()=>{
    assert.equal((await call('/employees/'+guardId,{role:'Barkeeper',department:'Bar'},{method:'PUT'})).status,200);
    assert.equal((await call('/admissions',entry(),{cookie:guard})).status,403);assert.equal((await call('/products',undefined,{cookie:guard})).status,200);
    assert.equal((await call('/employees/'+ownerId,{role:'Barkeeper',department:'Bar'},{cookie:manager,method:'PUT'})).status,200);
    await initializeDatabase(db);
    const again=await login('Michael Black');assert.equal(again.data.employee.role,'Barkeeper');assert.equal(again.data.employee.permissions.manage,false);
    assert.equal((await call('/employees',undefined,{cookie:owner})).status,403);
    assert.equal((await call('/employees/'+managerId,{role:'Barkeeper',department:''},{cookie:manager,method:'PUT'})).status,409);
    assert.equal((await call('/employees/'+ownerId,{role:'Inhaber',department:''},{cookie:manager,method:'PUT'})).status,200);
  });
  await t.test('Gleichzeitige Rollenänderungen lassen mindestens eine Leitung erhalten',async()=>{
    const results=await Promise.all([
      call('/employees/'+ownerId,{role:'Barkeeper',department:''},{cookie:owner,method:'PUT'}),
      call('/employees/'+managerId,{role:'Barkeeper',department:''},{cookie:manager,method:'PUT'})
    ]);
    assert.deepEqual(results.map(result=>result.status).sort(),[200,409]);
    const remaining=(await db.query("SELECT id FROM employees WHERE active=TRUE AND removed_at IS NULL AND role IN ('Inhaber','Manager')")).rows;
    assert.equal(remaining.length,1);
  });
});

test('Die Einführung weist einem bestehenden Michael Black einmalig die Inhaberrolle zu',async t=>{
  const db=await openDatabase({memory:true});t.after(()=>db.close());await initializeDatabase(db);
  const id=randomUUID();
  await db.query("INSERT INTO employees(id,name,name_key,role,department) VALUES($1,'Michael Black','michael black','Barkeeper','Leitung')",[id]);
  await db.query("UPDATE wallet_accounts SET balance_cents=1250000 WHERE id='bank'");
  await initializeDatabase(db);
  const owner=(await db.query('SELECT * FROM employees WHERE id=$1',[id])).rows[0];
  assert.equal(owner.role,'Inhaber');assert.equal(owner.department,'Leitung');
  assert.equal(Number((await db.query("SELECT balance_cents FROM wallet_accounts WHERE id='bank'")).rows[0].balance_cents),1250000);
  await db.query("UPDATE employees SET role='Manager' WHERE id=$1",[id]);await initializeDatabase(db);
  assert.equal((await db.query('SELECT role FROM employees WHERE id=$1',[id])).rows[0].role,'Manager');
});

test('Feste Jobs übernehmen alte Angaben einmalig und erhalten Abteilungen, Sperren und Geld',async t=>{
  const db=await openDatabase({memory:true});t.after(()=>db.close());
  await db.query(`CREATE TABLE employees(id TEXT PRIMARY KEY,name TEXT NOT NULL,name_key TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL DEFAULT 'Mitarbeiter',department TEXT NOT NULL DEFAULT '',active BOOLEAN NOT NULL DEFAULT TRUE);
    CREATE TABLE wallet_accounts(id TEXT PRIMARY KEY,employee_id TEXT UNIQUE REFERENCES employees(id),balance_cents BIGINT NOT NULL DEFAULT 0);
    INSERT INTO wallet_accounts(id,balance_cents) VALUES('bank',450000);`);
  const rows=[['Michael Black','inhaber','Leitung',true],['Alte Funktion','Shisha Meister','Shisha',false],['Security Chef',' security   leitung ','Einlass',true],['Barchef',' barkeeper leitung ','Bar',true]];
  const ids=rows.map(()=>randomUUID());
  for(const [index,[name,role,department,active]] of rows.entries())await db.query('INSERT INTO employees(id,name,name_key,role,department,active) VALUES($1,$2,$3,$4,$5,$6)',[ids[index],name,name.toLowerCase(),role,department,active]);
  await db.query('INSERT INTO wallet_accounts(id,employee_id,balance_cents) VALUES($1,$2,80000)',['employee:'+ids[1],ids[1]]);
  await initializeDatabase(db);
  const expected=['Inhaber','Barkeeper','Security Leitung','Barkeeper Leitung'];
  for(const [index,id] of ids.entries()){
    const employee=(await db.query('SELECT * FROM employees WHERE id=$1',[id])).rows[0];
    assert.equal(employee.role,expected[index]);assert.equal(employee.department,rows[index][2]);assert.equal(employee.active,rows[index][3]);
  }
  const money=(await db.query('SELECT * FROM wallet_accounts ORDER BY id')).rows;
  await db.query("UPDATE employees SET role='Security' WHERE id=$1",[ids[1]]);await initializeDatabase(db);
  assert.equal((await db.query('SELECT role FROM employees WHERE id=$1',[ids[1]])).rows[0].role,'Security');
  assert.deepEqual((await db.query('SELECT * FROM wallet_accounts ORDER BY id')).rows,money);
  const newId=randomUUID();await db.query("INSERT INTO employees(id,name,name_key) VALUES($1,'Neuer Kollege','neuer kollege')",[newId]);
  assert.equal((await db.query('SELECT role FROM employees WHERE id=$1',[newId])).rows[0].role,'Barkeeper');
  assert.equal((await db.query("SELECT COUNT(*)::int AS count FROM schema_migrations WHERE id='fixed-employee-jobs-v1'")).rows[0].count,1);
});
