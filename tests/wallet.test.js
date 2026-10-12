import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase,initializeDatabase} from '../lib/database.js';
import {createApp} from '../lib/app.js';

test('Kassenstand, Übergangskonto und Bargeldabgabe mit echten Transaktionen',async t=>{
  const db=await openDatabase({memory:true});await initializeDatabase(db);
  const server=createApp(db,{accessPassword:'test-wallet-access',loginLimit:1000}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.close();});
  const base=`http://127.0.0.1:${server.address().port}/api`;let alice,bob,aliceId,bobId,cashSale,cardSale,rentalId,cashExpense,purchaseId;
  async function call(path,body,{cookie=alice,method=body?'POST':'GET'}={}){
    const r=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};
  }
  async function wallet(){
    const result=await call('/wallet');assert.equal(result.status,200);
    const w=result.data;
    assert.equal(Number(w.total_cents),Number(w.bank_cents)+Number(w.clearing_cents)+Number(w.cash_cents));
    assert.equal(Number(w.cash_cents),w.employees.reduce((sum,e)=>sum+Number(e.cash_cents),0));return w;
  }
  const balance=(w,account)=>Number(account==='bank'?w.bank_cents:account==='clearing'?w.clearing_cents:w.employees.find(e=>'employee:'+e.id===account).cash_cents);
  const personal=(w,id)=>balance(w,'employee:'+id);
  const change=async (kind,account,amount,cookie=alice)=>call('/wallet/'+kind,{id:randomUUID(),account,amount_cents:amount,expected_balance_cents:balance(await wallet(),account),reason:'Testabgleich'},{cookie});
  const sale=(payment,productId,quantity,unitPriceCents)=>({id:randomUUID(),payment,currency:'USD',items:[{productId,quantity,unitPriceCents}],employee_id:'gefälscht'});
  let legacyOrder,legacyFinance,start;

  await t.test('Zugriff geschützt; neue Bestände starten bei 0 und importieren keine alten Umsätze',async()=>{
    assert.equal((await call('/wallet',undefined,{cookie:null})).status,401);
    assert.equal((await call('/wallet/transfer',{id:randomUUID()},{cookie:null})).status,401);
    const a=await call('/login',{name:'Alice',password:'test-wallet-access'});alice=a.cookie;aliceId=a.data.employee.id;
    const b=await call('/login',{name:'Bob',password:'test-wallet-access'});bob=b.cookie;bobId=b.data.employee.id;
    legacyOrder=randomUUID();legacyFinance=randomUUID();
    await db.query("INSERT INTO orders (id,employee_id,total_cents,currency,payment) VALUES ($1,$2,99900,'USD','cash')",[legacyOrder,aliceId]);
    await db.query("INSERT INTO finance_entries (id,employee_id,kind,amount_cents,reason,occurred_on) VALUES ($1,$2,'income',120000,'Alte Einnahme','2026-10-12')",[legacyFinance,aliceId]);
    await initializeDatabase(db);
    const w=await wallet();start=w.started_at;assert.equal(Number(w.total_cents),0);assert.equal(personal(w,aliceId),0);assert.equal(personal(w,bobId),0);
    assert.equal((await call('/finance')).data.totals.balance_cents,219900);
    assert.equal((await call('/stats')).data.totals.count,1);
  });
  await t.test('Anfangsbestände manuell pro Konto und Mitarbeiter, ohne zusätzlichen Umsatz',async()=>{
    const before=(await call('/finance')).data.totals;
    for(const [account,amount] of [['bank',200000],['employee:'+aliceId,100000],['employee:'+bobId,50000]])assert.equal((await change('adjustment',account,amount)).status,201);
    const w=await wallet();assert.equal(Number(w.total_cents),350000);assert.equal(Number(w.bank_cents),200000);assert.equal(personal(w,aliceId),100000);
    assert.deepEqual((await call('/finance')).data.totals,before);
    assert.equal((await call('/wallet/adjustment',{id:randomUUID(),account:'bank',amount_cents:900000,expected_balance_cents:0,reason:'Veralteter Stand'})).status,409);
    await initializeDatabase(db);assert.equal((await wallet()).started_at,start);assert.equal(Number((await wallet()).total_cents),350000);
  });
  await t.test('Barzahlung beim buchenden Mitarbeiter, Karte ausschließlich auf Übergangskonto, Wiederholung einmal',async()=>{
    const before=await wallet();cashSale=sale('cash','cola',2,30000);cardSale=sale('card','buddy-bier',1,22500);
    assert.equal((await call('/orders',cashSale)).status,201);assert.equal((await call('/orders',cashSale)).status,201);
    assert.equal((await call('/orders',cardSale,{cookie:bob})).status,201);
    const w=await wallet();assert.equal(personal(w,aliceId),personal(before,aliceId)+60000);assert.equal(personal(w,bobId),personal(before,bobId));
    assert.equal(Number(w.clearing_cents),22500);assert.equal(Number(w.bank_cents),Number(before.bank_cents));assert.equal(Number(w.total_cents),Number(before.total_cents)+82500);
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM wallet_transactions WHERE order_id=$1',[cashSale.id])).rows[0].n,1);
  });
  await t.test('Teilabgabe und Kartenübertragung verschieben Geld ohne zusätzlichen Umsatz; parallele Anfragen sicher',async()=>{
    const before=await wallet(),financeBefore=(await call('/finance')).data.totals;
    const body={id:randomUUID(),account:'employee:'+aliceId,amount_cents:60000,expected_balance_cents:personal(before,aliceId),reason:'Teilabgabe'};
    const results=await Promise.all([call('/wallet/transfer',body),call('/wallet/transfer',body)]);assert.deepEqual(results.map(r=>r.status),[201,201]);
    let w=await wallet();assert.equal(personal(w,aliceId),100000);assert.equal(Number(w.bank_cents),260000);assert.equal(Number(w.total_cents),Number(before.total_cents));
    assert.equal((await call('/wallet/transfer',body,{cookie:bob})).status,409);
    assert.equal((await change('transfer','clearing',22500)).status,201);w=await wallet();assert.equal(Number(w.clearing_cents),0);assert.equal(Number(w.bank_cents),282500);
    const a={id:randomUUID(),account:'employee:'+aliceId,amount_cents:70000,expected_balance_cents:100000,reason:'Abgabe A'},b={...a,id:randomUUID(),reason:'Abgabe B'};
    assert.deepEqual((await Promise.all([call('/wallet/transfer',a),call('/wallet/transfer',b)])).map(r=>r.status).sort(),[201,409]);
    assert.equal(personal(await wallet(),aliceId),30000);assert.deepEqual((await call('/finance')).data.totals,financeBefore);
    for(const amount of [-1,1.5,1000000000001])assert.equal((await call('/wallet/transfer',{...a,id:randomUUID(),amount_cents:amount})).status,400);
    assert.equal((await change('transfer','employee:'+aliceId,40000)).status,409);
    assert.equal((await call('/wallet/transfer',{...a,id:randomUUID(),account:'employee:'+randomUUID()})).status,404);
  });
  await t.test('Vermietung und sonstige Barzahlungen beim richtigen Mitarbeiter; Einkäufe und Bankausgaben auf Bank',async()=>{
    const before=await wallet();rentalId=randomUUID();cashExpense=randomUUID();purchaseId=randomUUID();
    assert.equal((await call('/rentals',{id:rentalId,space:'vip',unit:'hour',quantity:1,start:'2026-11-01T18:00',customer_name:'Gast',phone:'555',payment:'cash'})).status,201);
    assert.equal((await call('/finance',{id:randomUUID(),kind:'income',amount_cents:30000,payment:'cash',reason:'Extra Einnahme',occurred_on:'2026-10-13'},{cookie:bob})).status,201);
    assert.equal((await call('/finance',{id:cashExpense,kind:'expense',amount_cents:10000,payment:'cash',reason:'Bar bezahlt',occurred_on:'2026-10-13'},{cookie:bob})).status,201);
    assert.equal((await call('/finance',{id:randomUUID(),kind:'expense',amount_cents:12000,payment:'bank',reason:'Bank bezahlt',occurred_on:'2026-10-13'})).status,201);
    assert.equal((await call('/purchases',{id:purchaseId,items:[{productId:'cola',quantity:3,unitCostCents:10000}],occurred_on:'2026-10-13',reason:'Nachschub'})).status,201);
    const w=await wallet();assert.equal(personal(w,aliceId),personal(before,aliceId)+5000000);assert.equal(personal(w,bobId),personal(before,bobId)+20000);
    assert.equal(Number(w.bank_cents),Number(before.bank_cents)-42000);assert.equal(Number(w.total_cents),Number(before.total_cents)+4978000);
  });
  await t.test('Storno nach Einzahlung erstattet über Bank; unbetroffene Bargeldbestände und keine Doppelkorrektur',async()=>{
    assert.equal((await change('transfer','employee:'+aliceId,personal(await wallet(),aliceId))).status,201);
    const before=await wallet();assert.equal((await call('/orders/'+cashSale.id+'/void',{reason:'Rückerstattung'})).status,200);
    assert.equal((await call('/orders/'+cardSale.id+'/void',{reason:'Kartenstorno'})).status,200);
    assert.equal((await call('/rentals/'+rentalId+'/cancel',{reason:'Gast sagt ab'})).status,200);
    const w=await wallet();assert.equal(personal(w,aliceId),0);assert.equal(personal(w,bobId),personal(before,bobId));
    assert.equal(Number(w.bank_cents),Number(before.bank_cents)-5082500);assert.equal(Number(w.total_cents),Number(before.total_cents)-5082500);
    assert.equal((await call('/orders/'+cashSale.id+'/void',{reason:'Erneut'})).status,409);
    assert.equal((await call('/rentals/'+rentalId+'/cancel',{reason:'Erneut'})).status,200);assert.equal(Number((await wallet()).total_cents),Number(w.total_cents));
  });
  await t.test('Ausgabenstorno gibt Geld an ursprüngliche Quelle zurück; fehlendes Bargeld rollt alles zurück',async()=>{
    const before=await wallet();assert.equal((await call('/finance/'+cashExpense+'/void',{reason:'Falsch gebucht'})).status,200);
    assert.equal((await call('/purchases/'+purchaseId+'/void',{reason:'Lieferung storniert'})).status,200);
    const w=await wallet();assert.equal(personal(w,bobId),personal(before,bobId)+10000);assert.equal(Number(w.bank_cents),Number(before.bank_cents)+30000);
    const financeBefore=(await call('/finance')).data.totals;
    assert.equal((await call('/finance',{id:randomUUID(),kind:'expense',amount_cents:900000,payment:'cash',reason:'Zu viel Bargeld',occurred_on:'2026-10-13'},{cookie:bob})).status,409);
    assert.deepEqual((await call('/finance')).data.totals,financeBefore);assert.equal(Number((await wallet()).total_cents),Number(w.total_cents));
    await initializeDatabase(db);assert.equal(Number((await wallet()).total_cents),Number(w.total_cents));
  });
  await t.test('Altbuchungsstornos verändern keine neuen Bestände; negative Bank kann manuell abgeglichen werden',async()=>{
    const before=await wallet();assert.equal((await call('/orders/'+legacyOrder+'/void',{reason:'Altbuchung korrigiert'})).status,200);
    assert.equal((await call('/finance/'+legacyFinance+'/void',{reason:'Altbuchung korrigiert'})).status,200);
    assert.equal(Number((await wallet()).total_cents),Number(before.total_cents));
    await change('adjustment','bank',0);
    assert.equal((await call('/finance',{id:randomUUID(),kind:'expense',amount_cents:10000,payment:'bank',reason:'Bankausgabe',occurred_on:'2026-10-13'})).status,201);
    assert.equal(Number((await wallet()).bank_cents),-10000);assert.equal((await change('adjustment','bank',40000)).status,201);assert.equal(Number((await wallet()).bank_cents),40000);
  });
});
