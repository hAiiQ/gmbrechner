import {randomUUID} from 'node:crypto';

const MAX_AMOUNT=1_000_000_000_000;
const problem=message=>{const error=new Error(message);error.status=409;throw error;};
export async function initializeWallet(db){
  await db.query(`
    CREATE TABLE IF NOT EXISTS wallet_settings (id INTEGER PRIMARY KEY CHECK (id=1),started_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    INSERT INTO wallet_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
    CREATE TABLE IF NOT EXISTS wallet_accounts (
      id TEXT PRIMARY KEY,employee_id TEXT UNIQUE REFERENCES employees(id),balance_cents BIGINT NOT NULL DEFAULT 0
    );
    INSERT INTO wallet_accounts (id) VALUES ('bank'),('clearing') ON CONFLICT DO NOTHING;
    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK (kind IN ('receipt','expense','refund','transfer','adjustment')),
      recorded_by TEXT NOT NULL REFERENCES employees(id),reason TEXT NOT NULL,amount_cents BIGINT NOT NULL CHECK (amount_cents>=0),
      source_account TEXT REFERENCES wallet_accounts(id),target_account TEXT REFERENCES wallet_accounts(id),
      order_id TEXT REFERENCES orders(id),finance_entry_id TEXT REFERENCES finance_entries(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (order_id,kind),UNIQUE (finance_entry_id,kind)
    );
    CREATE TABLE IF NOT EXISTS wallet_movements (
      transaction_id TEXT NOT NULL REFERENCES wallet_transactions(id),account_id TEXT NOT NULL REFERENCES wallet_accounts(id),
      delta_cents BIGINT NOT NULL CHECK (delta_cents<>0),PRIMARY KEY (transaction_id,account_id)
    );
    CREATE INDEX IF NOT EXISTS wallet_transactions_created_idx ON wallet_transactions(created_at);
    ALTER TABLE finance_entries ADD COLUMN IF NOT EXISTS payment TEXT NOT NULL DEFAULT 'bank' CHECK (payment IN ('cash','card','bank'));
  `);
}

export function walletPayment(value,fail){
  const payment=value??'bank';
  if(!['cash','card','bank'].includes(payment))fail(400,'Bitte Bar, Karte oder Bank wählen.');
  return payment;
}
async function lockAccounts(tx,ids){
  const keys=[...new Set(ids)].sort();
  for(const id of keys){
    if(id.startsWith('employee:'))await tx.query('INSERT INTO wallet_accounts (id,employee_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',[id,id.slice(9)]);
  }
  const {rows}=await tx.query('SELECT * FROM wallet_accounts WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',[keys]);
  if(rows.length!==keys.length)problem('Geldbestand nicht gefunden. Bitte aktualisieren.');
  return new Map(rows.map(r=>[r.id,Number(r.balance_cents)]));
}
async function writeTransaction(tx,{id=randomUUID(),kind,recordedBy,reason,amount,source=null,target=null,orderId=null,financeId=null},moves){
  const {rows}=await tx.query(`INSERT INTO wallet_transactions (id,kind,recorded_by,reason,amount_cents,source_account,target_account,order_id,finance_entry_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING RETURNING *`,[id,kind,recordedBy,reason,amount,source,target,orderId,financeId]);
  if(!rows.length){
    const previous=(await tx.query('SELECT * FROM wallet_transactions WHERE id=$1',[id])).rows[0];
    if(previous.recorded_by!==recordedBy||previous.kind!==kind||previous.source_account!==source||previous.target_account!==target)problem('Diese Buchungsnummer ist bereits vergeben.');
    return previous;
  }
  for(const [account,delta] of moves.filter(([,value])=>value!==0)){
    await tx.query('UPDATE wallet_accounts SET balance_cents=balance_cents+$2 WHERE id=$1',[account,delta]);
    await tx.query('INSERT INTO wallet_movements (transaction_id,account_id,delta_cents) VALUES ($1,$2,$3)',[id,account,delta]);
  }
  return rows[0];
}

export async function bookWallet(tx,{employeeId,recordedBy=employeeId,amount,currency='USD',payment='bank',expense=false,requireFunds=false,reason,orderId=null,financeId=null}){
  if(currency!=='USD'||amount===0)return;
  const account=payment==='cash'?`employee:${employeeId}`:payment==='card'?'clearing':'bank';
  const balances=await lockAccounts(tx,[account]);
  if(expense&&requireFunds&&balances.get(account)<amount)problem('Nicht genug Geld auf dem Bankkonto für diese Lohnauszahlung.');
  if(expense&&payment==='cash'&&balances.get(account)<amount)problem('Nicht genug Bargeld auf der Hand. Bitte Bank wählen oder den Bestand prüfen.');
  return writeTransaction(tx,{kind:expense?'expense':'receipt',recordedBy,reason,amount,source:expense?account:null,target:expense?null:account,orderId,financeId},[[account,expense?-amount:amount]]);
}

export async function refundWallet(tx,{orderId=null,financeId=null,recordedBy,reason}){
  const original=(await tx.query(`SELECT * FROM wallet_transactions WHERE ${orderId?'order_id':'finance_entry_id'}=$1 AND kind IN ('receipt','expense')`,[orderId||financeId])).rows[0];
  // Entries preceding the new balances were not included in the zero opening.
  if(!original)return;
  const previous=await tx.query(`SELECT id FROM wallet_transactions WHERE ${orderId?'order_id':'finance_entry_id'}=$1 AND kind='refund'`,[orderId||financeId]);
  if(previous.rows.length)return;
  const amount=Number(original.amount_cents),expense=original.kind==='expense',account=expense?original.source_account:original.target_account;
  const balances=await lockAccounts(tx,[account,'bank']);
  let moves;
  if(expense)moves=[[account,amount]];
  else if(account==='bank')moves=[['bank',-amount]];
  else {
    const available=Math.min(amount,Math.max(0,balances.get(account)));
    moves=[[account,-available],['bank',-(amount-available)]];
  }
  return writeTransaction(tx,{kind:'refund',recordedBy,reason,amount,source:expense?null:account,target:expense?account:null,orderId,financeId},moves);
}

export function registerWallet(app,db,{fail,clean,uuid}){
  function readAccount(value){
    if(value==='bank'||value==='clearing'||typeof value==='string'&&value.startsWith('employee:')&&uuid(value.slice(9)))return value;
    fail(400,'Ungültiger Geldbestand.');
  }
  function readAmount(value,zero=false){
    if(!Number.isInteger(value)||value<(zero?0:1)||value>MAX_AMOUNT)fail(400,'Bitte einen gültigen Betrag bis 10.000.000.000 $ eingeben.');
    return value;
  }
  async function accountExists(tx,account){
    if(account.startsWith('employee:')&&!(await tx.query('SELECT id FROM employees WHERE id=$1',[account.slice(9)])).rows.length)fail(404,'Mitarbeiter nicht gefunden.');
  }
  function retry(row,req,kind,account){
    if(row.recorded_by!==req.employee.id||row.kind!==kind||(kind==='transfer'?row.source_account:row.target_account)!==account)fail(409,'Diese Buchungsnummer ist bereits vergeben.');
    return row;
  }
  app.get('/api/wallet',async (_req,res)=>{
    const snapshot=(await db.query(`SELECT s.started_at,
      COALESCE((SELECT balance_cents FROM wallet_accounts WHERE id='bank'),0)::text AS bank_cents,
      COALESCE((SELECT balance_cents FROM wallet_accounts WHERE id='clearing'),0)::text AS clearing_cents,
      COALESCE((SELECT SUM(balance_cents) FROM wallet_accounts WHERE employee_id IS NOT NULL),0)::text AS cash_cents,
      COALESCE((SELECT SUM(balance_cents) FROM wallet_accounts),0)::text AS total_cents,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('id',e.id,'name',e.name,'cash_cents',COALESCE(a.balance_cents,0)::text) ORDER BY e.name),'[]'::jsonb)
       FROM employees e LEFT JOIN wallet_accounts a ON a.employee_id=e.id) AS employees
      FROM wallet_settings s WHERE s.id=1`)).rows[0];
    const {rows}=await db.query(`SELECT t.*,e.name AS recorded_by_name,
      CASE WHEN t.source_account='bank' THEN 'Bank' WHEN t.source_account='clearing' THEN 'Übergangskonto' ELSE source_employee.name END AS source_name,
      CASE WHEN t.target_account='bank' THEN 'Bank' WHEN t.target_account='clearing' THEN 'Übergangskonto' ELSE target_employee.name END AS target_name,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('account',a.id,'name',CASE WHEN a.id='bank' THEN 'Bank' WHEN a.id='clearing' THEN 'Übergangskonto' ELSE person.name END,'delta_cents',m.delta_cents::text) ORDER BY a.id),'[]'::jsonb)
       FROM wallet_movements m JOIN wallet_accounts a ON a.id=m.account_id LEFT JOIN employees person ON person.id=a.employee_id WHERE m.transaction_id=t.id) AS movements
      FROM wallet_transactions t JOIN employees e ON e.id=t.recorded_by
      LEFT JOIN wallet_accounts source ON source.id=t.source_account LEFT JOIN employees source_employee ON source_employee.id=source.employee_id
      LEFT JOIN wallet_accounts target ON target.id=t.target_account LEFT JOIN employees target_employee ON target_employee.id=target.employee_id
      ORDER BY t.created_at DESC,t.id DESC LIMIT 100`);
    res.json({currency:'USD',...snapshot,transactions:rows});
  });
  for(const kind of ['transfer','adjustment'])app.post(`/api/wallet/${kind}`,async (req,res)=>{
    if(!uuid(req.body.id))fail(400,'Ungültige Buchungsnummer.');
    const account=readAccount(req.body.account),amount=readAmount(req.body.amount_cents,kind==='adjustment');
    const expected=req.body.expected_balance_cents,reason=clean(req.body.reason|| (kind==='transfer'?'Bankeinzahlung':'Bestandskorrektur'),200,'Grund',3);
    if(!Number.isInteger(expected)||Math.abs(expected)>MAX_AMOUNT)fail(400,'Ungültiger erwarteter Geldbestand.');
    if(kind==='transfer'&&account==='bank')fail(400,'Bitte Bargeld oder Übergangskonto für die Einzahlung wählen.');
    const result=await db.transaction(async tx=>{
      const previous=await tx.query('SELECT * FROM wallet_transactions WHERE id=$1',[req.body.id]);
      if(previous.rows.length)return retry(previous.rows[0],req,kind,account);
      await accountExists(tx,account);
      const balances=await lockAccounts(tx,[account,...(kind==='transfer'?['bank']:[])]);
      const repeated=await tx.query('SELECT * FROM wallet_transactions WHERE id=$1',[req.body.id]);
      if(repeated.rows.length)return retry(repeated.rows[0],req,kind,account);
      const current=balances.get(account);
      if(current!==expected)fail(409,'Der Geldbestand hat sich geändert. Bitte aktualisieren und erneut eingeben.');
      if(kind==='transfer'){
        if(amount>current)fail(409,'Der Betrag ist größer als das verfügbare Geld.');
        return writeTransaction(tx,{id:req.body.id,kind,recordedBy:req.employee.id,reason,amount,source:account,target:'bank'},[[account,-amount],['bank',amount]]);
      }
      return writeTransaction(tx,{id:req.body.id,kind,recordedBy:req.employee.id,reason,amount,target:account},[[account,amount-current]]);
    });
    res.status(201).json({transaction:result});
  });
}
