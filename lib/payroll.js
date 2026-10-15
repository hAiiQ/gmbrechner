import {randomUUID,createHash} from 'node:crypto';
import {employeeJobs,canonicalJob} from './permissions.js';
import {bookWallet} from './wallet.js';

export const HOURLY_RATES=Object.freeze({Inhaber:2000000,Manager:2000000,'Barkeeper Leitung':1500000,Barkeeper:1000000,'Security Leitung':1500000,Security:1000000});
export const DELIVERY_WAGE_CENTS=100000;
export function shiftWage(seconds,rate){return Number((BigInt(seconds)*BigInt(rate)+1800n)/3600n);}
export async function initializePayroll(db){
  await db.query(`CREATE TABLE IF NOT EXISTS time_shifts(
    id TEXT PRIMARY KEY,employee_id TEXT NOT NULL REFERENCES employees(id),job TEXT NOT NULL,
    hourly_rate_cents INTEGER NOT NULL CHECK(hourly_rate_cents>0),started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,worked_seconds BIGINT,amount_cents BIGINT,stopped_by TEXT REFERENCES employees(id),stop_request_id TEXT UNIQUE,
    CHECK(ended_at IS NULL OR ended_at>=started_at));
    CREATE UNIQUE INDEX IF NOT EXISTS time_shifts_one_active_idx ON time_shifts(employee_id) WHERE ended_at IS NULL;
    CREATE INDEX IF NOT EXISTS time_shifts_employee_date_idx ON time_shifts(employee_id,started_at);
    CREATE TABLE IF NOT EXISTS payroll_payouts(id TEXT PRIMARY KEY,employee_id TEXT NOT NULL REFERENCES employees(id),
      amount_cents BIGINT NOT NULL CHECK(amount_cents>0),recorded_by TEXT NOT NULL REFERENCES employees(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS payroll_credits(id TEXT PRIMARY KEY,employee_id TEXT NOT NULL REFERENCES employees(id),
      kind TEXT NOT NULL CHECK(kind IN ('work','delivery','delivery_reversal')),amount_cents BIGINT NOT NULL,
      shift_id TEXT UNIQUE REFERENCES time_shifts(id),order_id TEXT REFERENCES orders(id),
      payout_id TEXT REFERENCES payroll_payouts(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),voided_at TIMESTAMPTZ,
      UNIQUE(order_id,kind));
    CREATE INDEX IF NOT EXISTS payroll_credits_employee_idx ON payroll_credits(employee_id);
    ALTER TABLE finance_entries ADD COLUMN IF NOT EXISTS payroll_payout_id TEXT UNIQUE REFERENCES payroll_payouts(id);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_delivery BOOLEAN NOT NULL DEFAULT FALSE;`);
}
export async function closeEmployeeShift(tx,{employeeId,recordedBy,shiftId=null,requestId=randomUUID()},fail){
  const {rows}=await tx.query(`SELECT *,GREATEST(0,FLOOR(EXTRACT(EPOCH FROM (NOW()-started_at))))::text AS elapsed_seconds
    FROM time_shifts WHERE employee_id=$1 AND ${shiftId?'id=$2':'ended_at IS NULL'} FOR UPDATE`,shiftId?[employeeId,shiftId]:[employeeId]);
  if(!rows.length){if(shiftId)fail(404,'Schicht nicht gefunden.');return null;}
  const shift=rows[0];if(shift.ended_at)return shift;
  const reused=await tx.query('SELECT id FROM time_shifts WHERE stop_request_id=$1 AND id<>$2',[requestId,shift.id]);
  if(reused.rows.length)fail(409,'Diese Stempelnummer wurde bereits verwendet.');
  const seconds=Number(shift.elapsed_seconds),amount=shiftWage(seconds,shift.hourly_rate_cents);
  const saved=(await tx.query(`UPDATE time_shifts SET ended_at=GREATEST(NOW(),started_at),worked_seconds=$2,amount_cents=$3,stopped_by=$4,stop_request_id=$5 WHERE id=$1 RETURNING *`,[shift.id,seconds,amount,recordedBy,requestId])).rows[0];
  await tx.query("INSERT INTO payroll_credits(id,employee_id,kind,amount_cents,shift_id) VALUES($1,$2,'work',$3,$4)",[randomUUID(),employeeId,amount,shift.id]);
  return saved;
}
export async function creditDelivery(tx,employeeId,orderId){
  await tx.query("INSERT INTO payroll_credits(id,employee_id,kind,amount_cents,order_id) VALUES($1,$2,'delivery',$3,$4) ON CONFLICT(order_id,kind) DO NOTHING",[randomUUID(),employeeId,DELIVERY_WAGE_CENTS,orderId]);
}
export async function cancelDeliveryCredit(tx,employeeId,orderId){
  const credit=(await tx.query("SELECT * FROM payroll_credits WHERE order_id=$1 AND kind='delivery' FOR UPDATE",[orderId])).rows[0];
  if(!credit||credit.voided_at)return;
  if(!credit.payout_id)await tx.query('UPDATE payroll_credits SET voided_at=NOW() WHERE id=$1',[credit.id]);
  else await tx.query("INSERT INTO payroll_credits(id,employee_id,kind,amount_cents,order_id) VALUES($1,$2,'delivery_reversal',$3,$4) ON CONFLICT(order_id,kind) DO NOTHING",[randomUUID(),employeeId,-DELIVERY_WAGE_CENTS,orderId]);
}
async function balance(tx,employeeId,lock=false){
  const {rows}=await tx.query(`SELECT id,amount_cents FROM payroll_credits WHERE employee_id=$1 AND payout_id IS NULL AND voided_at IS NULL ORDER BY id ${lock?'FOR UPDATE':''}`,[employeeId]);
  const pending=rows.reduce((sum,row)=>sum+BigInt(row.amount_cents),0n);
  return {pending_cents:String(pending),snapshot:createHash('sha256').update(rows.map(row=>`${row.id}:${row.amount_cents}`).join('|')).digest('hex')};
}
async function employeePayroll(db,employeeId){
  const person=(await db.query('SELECT id,name,role,roles,department,active,removed_at FROM employees WHERE id=$1',[employeeId])).rows[0];
  if(!person)return null;
  const active=(await db.query('SELECT * FROM time_shifts WHERE employee_id=$1 AND ended_at IS NULL',[employeeId])).rows[0]||null;
  const earned=(await db.query('SELECT COALESCE(SUM(amount_cents),0)::text AS amount FROM payroll_credits WHERE employee_id=$1 AND voided_at IS NULL',[employeeId])).rows[0].amount;
  const paid=(await db.query('SELECT COALESCE(SUM(amount_cents),0)::text AS amount FROM payroll_payouts WHERE employee_id=$1',[employeeId])).rows[0].amount;
  return {...person,...await balance(db,employeeId),active_shift:active,earned_cents:earned,paid_cents:paid};
}
export function registerPayroll(app,db,{fail,uuid}){
  const checkId=value=>{if(!uuid(value))fail(400,'Ungültige Buchungsnummer.');return value;};
  app.get('/api/timeclock',async(req,res)=>{
    const active=(await db.query('SELECT * FROM time_shifts WHERE employee_id=$1 AND ended_at IS NULL',[req.employee.id])).rows[0]||null;
    res.json({active_shift:active,server_now:(await db.query('SELECT NOW() AS now')).rows[0].now,jobs:employeeJobs(req.employee).map(job=>({job,hourly_rate_cents:HOURLY_RATES[job]}))});
  });
  app.post('/api/timeclock/in',async(req,res)=>{
    const id=checkId(req.body.id),job=canonicalJob(req.body.job);if(!job)fail(400,'Bitte einen gültigen Arbeitsrang auswählen.');
    const shift=await db.transaction(async tx=>{
      const person=(await tx.query('SELECT * FROM employees WHERE id=$1 FOR UPDATE',[req.employee.id])).rows[0];
      if(!person.active||person.removed_at)fail(403,'Dieser Mitarbeiter ist nicht aktiv.');
      const existing=(await tx.query('SELECT * FROM time_shifts WHERE id=$1',[id])).rows[0];
      if(existing){if(existing.employee_id!==person.id||existing.job!==job)fail(409,'Diese Stempelnummer wurde bereits verwendet.');return existing;}
      if(!employeeJobs(person).map(canonicalJob).includes(job))fail(403,'Dieser Arbeitsrang ist dir nicht zugewiesen.');
      if((await tx.query('SELECT id FROM time_shifts WHERE employee_id=$1 AND ended_at IS NULL',[person.id])).rows.length)fail(409,'Du bist bereits eingestempelt. Bitte zuerst ausstempeln.');
      return (await tx.query('INSERT INTO time_shifts(id,employee_id,job,hourly_rate_cents) VALUES($1,$2,$3,$4) RETURNING *',[id,person.id,job,HOURLY_RATES[job]])).rows[0];
    });
    res.status(201).json({shift});
  });
  app.post('/api/timeclock/out',async(req,res)=>{
    const id=checkId(req.body.id),shiftId=checkId(req.body.shift_id);
    const shift=await db.transaction(async tx=>{
      const found=(await tx.query('SELECT employee_id FROM time_shifts WHERE id=$1',[shiftId])).rows[0];
      if(!found)fail(404,'Schicht nicht gefunden.');
      if(found.employee_id!==req.employee.id&&!req.employee.permissions.manage)fail(403,'Du kannst nur deine eigene Schicht beenden.');
      await tx.query('SELECT id FROM employees WHERE id=$1 FOR UPDATE',[found.employee_id]);
      return closeEmployeeShift(tx,{employeeId:found.employee_id,recordedBy:req.employee.id,shiftId,requestId:id},fail);
    });
    res.json({shift});
  });
  app.get('/api/payroll',async(_req,res)=>{
    const ids=(await db.query('SELECT id FROM employees ORDER BY LOWER(name),id')).rows;
    const employees=[];for(const {id} of ids)employees.push(await employeePayroll(db,id));
    res.json({employees,bank_cents:(await db.query("SELECT balance_cents::text AS amount FROM wallet_accounts WHERE id='bank'")).rows[0].amount,rates:HOURLY_RATES});
  });
  const details=async(req,res,id)=>{
    const employee=await employeePayroll(db,id);if(!employee)fail(404,'Mitarbeiter nicht gefunden.');
    const shifts=(await db.query('SELECT * FROM time_shifts WHERE employee_id=$1 ORDER BY started_at DESC,id DESC LIMIT 100',[id])).rows;
    const credits=(await db.query('SELECT * FROM payroll_credits WHERE employee_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100',[id])).rows;
    const payouts=(await db.query('SELECT p.*,e.name AS recorded_by_name FROM payroll_payouts p JOIN employees e ON e.id=p.recorded_by WHERE p.employee_id=$1 ORDER BY p.created_at DESC,p.id DESC LIMIT 100',[id])).rows;
    res.json({employee,shifts,credits,payouts,rates:HOURLY_RATES});
  };
  app.get('/api/payroll/me',(req,res)=>details(req,res,req.employee.id));
  app.get('/api/payroll/:id',(req,res)=>details(req,res,checkId(req.params.id)));
  app.post('/api/payroll/payout',async(req,res)=>{
    const id=checkId(req.body.id),employeeId=checkId(req.body.employee_id);
    if(typeof req.body.expected_snapshot!=='string'||!/^[a-f0-9]{64}$/.test(req.body.expected_snapshot))fail(400,'Bitte die Lohnübersicht vor der Auszahlung aktualisieren.');
    const payout=await db.transaction(async tx=>{
      const person=(await tx.query('SELECT id,name FROM employees WHERE id=$1 FOR UPDATE',[employeeId])).rows[0];
      if(!person)fail(404,'Mitarbeiter nicht gefunden.');
      const existing=(await tx.query('SELECT * FROM payroll_payouts WHERE id=$1',[id])).rows[0];
      if(existing){if(existing.employee_id!==employeeId||existing.recorded_by!==req.employee.id)fail(409,'Diese Buchungsnummer wurde bereits verwendet.');return existing;}
      const current=await balance(tx,employeeId,true),amount=Number(current.pending_cents);
      if(current.snapshot!==req.body.expected_snapshot)fail(409,'Der offene Lohn hat sich geändert. Bitte die Lohnübersicht aktualisieren.');
      if(!Number.isSafeInteger(amount)||amount<=0||amount>1000000000)fail(409,'Es ist kein auszahlbarer Lohn vorhanden oder der Betrag übersteigt 10.000.000 $.');
      const saved=(await tx.query('INSERT INTO payroll_payouts(id,employee_id,amount_cents,recorded_by) VALUES($1,$2,$3,$4) RETURNING *',[id,employeeId,amount,req.employee.id])).rows[0];
      const financeId=randomUUID(),reason='Lohn · '+person.name;
      await tx.query(`INSERT INTO finance_entries(id,employee_id,payroll_payout_id,kind,amount_cents,currency,reason,occurred_on,payment)
        VALUES($1,$2,$3,'expense',$4,'USD',$5,(NOW() AT TIME ZONE 'Europe/Berlin')::date,'bank')`,[financeId,employeeId,id,amount,reason]);
      await bookWallet(tx,{employeeId,recordedBy:req.employee.id,amount,payment:'bank',expense:true,requireFunds:true,reason,financeId});
      await tx.query('UPDATE payroll_credits SET payout_id=$2 WHERE employee_id=$1 AND payout_id IS NULL AND voided_at IS NULL',[employeeId,id]);
      return saved;
    });
    res.status(201).json({payout});
  });
}
