import {randomUUID} from 'node:crypto';
import {bookWallet,refundWallet,walletPayment} from './wallet.js';

export async function initializeAdmissions(db){
  await db.query(`CREATE TABLE IF NOT EXISTS admissions (
    id TEXT PRIMARY KEY,employee_id TEXT NOT NULL REFERENCES employees(id),
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents>0),quantity INTEGER NOT NULL CHECK (quantity>0),
    total_cents INTEGER NOT NULL CHECK (total_cents>0),currency TEXT NOT NULL DEFAULT 'USD',
    payment TEXT NOT NULL CHECK(payment IN ('cash','card','bank')),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    voided_at TIMESTAMPTZ,void_reason TEXT,voided_by TEXT REFERENCES employees(id)
  ); CREATE INDEX IF NOT EXISTS admissions_date_idx ON admissions(created_at);
  ALTER TABLE finance_entries ADD COLUMN IF NOT EXISTS admission_id TEXT UNIQUE REFERENCES admissions(id);`);
}
export function registerAdmissions(app,db,{fail,clean,uuid}){
  const idValue=req=>{if(!uuid(req.params.id))fail(400,'Ungültige Eintrittsbuchung.');return req.params.id;};
  const own=(req,row)=>{if(!req.employee.permissions.allAdmissions&&row.employee_id!==req.employee.id)fail(403,'Du kannst nur deine eigenen Eintrittsbuchungen ansehen oder stornieren.');};
  app.get('/api/admissions',async(req,res)=>{
    const params=[req.employee.permissions.allAdmissions,req.employee.id];
    const {rows}=await db.query(`SELECT a.*,e.name AS employee_name FROM admissions a JOIN employees e ON e.id=a.employee_id
      WHERE ($1::boolean OR a.employee_id=$2) ORDER BY a.created_at DESC,a.id DESC LIMIT 100`,params);
    const totals=await db.query(`SELECT COALESCE(SUM(total_cents),0)::text AS total_cents,COALESCE(SUM(quantity),0)::text AS quantity
      FROM admissions WHERE voided_at IS NULL AND ($1::boolean OR employee_id=$2)`,params);
    res.json({admissions:rows,totals:totals.rows[0],currency:'USD'});
  });
  app.post('/api/admissions',async(req,res)=>{
    const {id,quantity,unit_price_cents}=req.body,payment=walletPayment(req.body.payment,fail);
    if(!uuid(id)||!Number.isInteger(quantity)||quantity<1||quantity>10000||!Number.isInteger(unit_price_cents)||unit_price_cents<1||unit_price_cents>10_000_000||quantity*unit_price_cents>1_000_000_000)fail(400,'Bitte einen positiven Preis bis 100.000 $ und eine ganze Menge von 1 bis 10.000 eingeben. Die Summe darf höchstens 10.000.000 $ betragen.');
    const total=quantity*unit_price_cents;
    const admission=await db.transaction(async tx=>{
      const result=await tx.query(`INSERT INTO admissions(id,employee_id,unit_price_cents,quantity,total_cents,payment)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING *`,[id,req.employee.id,unit_price_cents,quantity,total,payment]);
      if(!result.rows.length){
        const existing=(await tx.query('SELECT * FROM admissions WHERE id=$1',[id])).rows[0];
        if(existing.employee_id!==req.employee.id||existing.unit_price_cents!==unit_price_cents||existing.quantity!==quantity||existing.payment!==payment)fail(409,'Diese Buchungsnummer wurde bereits verwendet. Bitte die Eintrittsliste aktualisieren.');
        return existing;
      }
      const financeId=randomUUID(),reason=`Eintritt · ${quantity} × ${(unit_price_cents/100).toFixed(2)} $`;
      await tx.query(`INSERT INTO finance_entries(id,employee_id,admission_id,kind,amount_cents,currency,reason,occurred_on,payment)
        VALUES($1,$2,$3,'income',$4,'USD',$5,(NOW() AT TIME ZONE 'Europe/Berlin')::date,$6)`,[financeId,req.employee.id,id,total,reason,payment]);
      await bookWallet(tx,{employeeId:req.employee.id,amount:total,payment,reason,financeId});
      return result.rows[0];
    });
    res.status(201).json({admission});
  });
  app.get('/api/admissions/:id',async(req,res)=>{
    const {rows}=await db.query('SELECT a.*,e.name AS employee_name FROM admissions a JOIN employees e ON e.id=a.employee_id WHERE a.id=$1',[idValue(req)]);
    if(!rows.length)fail(404,'Eintrittsbuchung nicht gefunden.');own(req,rows[0]);res.json({admission:rows[0]});
  });
  app.post('/api/admissions/:id/void',async(req,res)=>{
    const id=idValue(req),reason=clean(req.body.reason,200,'Stornogrund',3);
    const admission=await db.transaction(async tx=>{
      const {rows}=await tx.query('SELECT * FROM admissions WHERE id=$1 FOR UPDATE',[id]);
      if(!rows.length)fail(404,'Eintrittsbuchung nicht gefunden.');own(req,rows[0]);
      if(rows[0].voided_at)return rows[0];
      const finance=(await tx.query('SELECT id FROM finance_entries WHERE admission_id=$1',[id])).rows[0];
      await refundWallet(tx,{financeId:finance.id,recordedBy:req.employee.id,reason:'Eintrittsstorno · '+reason});
      await tx.query('UPDATE finance_entries SET voided_at=NOW(),void_reason=$2,voided_by=$3 WHERE admission_id=$1',[id,reason,req.employee.id]);
      return (await tx.query('UPDATE admissions SET voided_at=NOW(),void_reason=$2,voided_by=$3 WHERE id=$1 RETURNING *',[id,reason,req.employee.id])).rows[0];
    });
    res.json({admission});
  });
}
