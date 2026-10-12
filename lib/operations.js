import { randomUUID } from 'node:crypto';
import { RENTAL_RATES, rentalQuote } from './rentals.js';

export async function initializeOperations(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS rental_spaces (id TEXT PRIMARY KEY);
    INSERT INTO rental_spaces (id) VALUES ('vip'),('upper') ON CONFLICT DO NOTHING;
    CREATE TABLE IF NOT EXISTS rentals (
      id TEXT PRIMARY KEY, employee_id TEXT NOT NULL REFERENCES employees(id),
      space TEXT NOT NULL REFERENCES rental_spaces(id), customer_name TEXT NOT NULL,
      family TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL,
      starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL CHECK (ends_at > starts_at),
      unit TEXT NOT NULL CHECK (unit IN ('hour','week','month')), quantity INTEGER NOT NULL CHECK (quantity > 0),
      rate_cents INTEGER NOT NULL, total_cents INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'USD',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), cancelled_at TIMESTAMPTZ, cancel_reason TEXT,
      cancelled_by TEXT REFERENCES employees(id)
    );
    CREATE INDEX IF NOT EXISTS rentals_period_idx ON rentals(space,starts_at,ends_at);
    CREATE TABLE IF NOT EXISTS finance_entries (
      id TEXT PRIMARY KEY, employee_id TEXT NOT NULL REFERENCES employees(id), rental_id TEXT UNIQUE REFERENCES rentals(id),
      kind TEXT NOT NULL CHECK (kind IN ('income','expense')), amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      currency TEXT NOT NULL DEFAULT 'USD', reason TEXT NOT NULL, occurred_on DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), voided_at TIMESTAMPTZ, void_reason TEXT,
      voided_by TEXT REFERENCES employees(id)
    );
    CREATE INDEX IF NOT EXISTS finance_entries_date_idx ON finance_entries(occurred_on);
  `);
}

export function registerOperations(app,db,{fail,clean,uuid,range,rangeSql,readCurrency,dateValue}) {
  app.get('/api/inventory',async (_req,res) => {
    const products=await db.query('SELECT * FROM products WHERE archived=FALSE ORDER BY stock_quantity,name');
    const movements=await db.query(`SELECT m.*,p.name AS product_name,e.name AS employee_name FROM stock_movements m
      JOIN products p ON p.id=m.product_id LEFT JOIN employees e ON e.id=m.employee_id
      ORDER BY m.created_at DESC,m.id DESC LIMIT 50`);
    res.json({products:products.rows,movements:movements.rows,threshold:30});
  });
  app.post('/api/inventory/:id',async (req,res) => {
    const {id,quantity,expected_quantity}=req.body;
    if(!uuid(id)||!Number.isInteger(quantity)||quantity<0||quantity>1_000_000||!Number.isInteger(expected_quantity)||expected_quantity<0)fail(400,'Bitte einen ganzen Bestand von 0 bis 1.000.000 eingeben.');
    const reason=clean(req.body.reason,200,'Grund',3);
    const movement=await db.transaction(async tx => {
      const product=await tx.query('SELECT * FROM products WHERE id=$1 AND archived=FALSE FOR UPDATE',[req.params.id]);
      if(!product.rows.length)fail(404,'Artikel nicht gefunden.');
      const previous=await tx.query('SELECT * FROM stock_movements WHERE id=$1',[id]);
      if(previous.rows.length){
        if(previous.rows[0].employee_id!==req.employee.id||previous.rows[0].product_id!==req.params.id)fail(409,'Diese Buchungsnummer ist bereits vergeben.');
        return previous.rows[0];
      }
      const p=product.rows[0];
      if(p.stock_quantity!==expected_quantity)fail(409,`Der Bestand hat sich inzwischen geändert (${p.stock_quantity} Stück). Bitte aktualisieren und erneut eingeben.`);
      await tx.query('UPDATE products SET stock_quantity=$2 WHERE id=$1',[p.id,quantity]);
      const saved=await tx.query(`INSERT INTO stock_movements (id,product_id,employee_id,delta,quantity_after,reason,kind)
        VALUES ($1,$2,$3,$4,$5,$6,'adjustment') RETURNING *`,[id,p.id,req.employee.id,quantity-p.stock_quantity,quantity,reason]);
      return saved.rows[0];
    });
    res.status(201).json({movement});
  });

  function quote(body){try{return rentalQuote(body);}catch(error){fail(400,error.message);}}
  app.post('/api/rentals/quote',(req,res)=>res.json({quote:quote(req.body)}));
  app.get('/api/rentals',async (_req,res)=>{
    const {rows}=await db.query(`SELECT r.*,e.name AS employee_name FROM rentals r JOIN employees e ON e.id=r.employee_id
      ORDER BY r.starts_at DESC,r.created_at DESC`);
    res.json({rentals:rows,rates:RENTAL_RATES});
  });
  app.post('/api/rentals',async (req,res)=>{
    const {id}=req.body;
    if(!uuid(id))fail(400,'Ungültige Buchungsnummer.');
    const customer=clean(req.body.customer_name,80,'Name',2),family=clean(req.body.family??'',80,'Familie',0),phone=clean(req.body.phone,40,'Nummer');
    // Also resolve retries from the previous tariff version without changing a saved rental.
    const existing=await db.query('SELECT * FROM rentals WHERE id=$1',[id]);
    if(existing.rows.length){
      if(existing.rows[0].employee_id!==req.employee.id)fail(409,'Diese Buchungsnummer ist bereits vergeben.');
      return res.status(201).json({rental:existing.rows[0]});
    }
    const q=quote(req.body);
    const rental=await db.transaction(async tx=>{
      // Serialize retries for this area; different guests may share the same period.
      await tx.query('SELECT id FROM rental_spaces WHERE id=$1 FOR UPDATE',[q.space]);
      const previous=await tx.query('SELECT * FROM rentals WHERE id=$1',[id]);
      if(previous.rows.length){if(previous.rows[0].employee_id!==req.employee.id)fail(409,'Diese Buchungsnummer ist bereits vergeben.');return previous.rows[0];}
      const result=await tx.query(`INSERT INTO rentals (id,employee_id,space,customer_name,family,phone,starts_at,ends_at,unit,quantity,rate_cents,total_cents,currency)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'USD') RETURNING *`,[id,req.employee.id,q.space,customer,family,phone,q.starts_at,q.ends_at,q.unit,q.quantity,q.rate_cents,q.total_cents]);
      await tx.query(`INSERT INTO finance_entries (id,employee_id,rental_id,kind,amount_cents,currency,reason,occurred_on)
        VALUES ($1,$2,$3,'income',$4,'USD',$5,(NOW() AT TIME ZONE 'Europe/Berlin')::date)`,
        [randomUUID(),req.employee.id,id,q.total_cents,`${q.space_name} · ${customer} · ${q.quantity} ${q.unit==='hour'?(q.quantity===1?'Stunde':'Stunden'):q.unit==='week'?(q.quantity===1?'Woche':'Wochen'):(q.quantity===1?'Monat':'Monate')}`]);
      return result.rows[0];
    });
    res.status(201).json({rental});
  });
  app.post('/api/rentals/:id/cancel',async (req,res)=>{
    const reason=clean(req.body.reason,200,'Stornogrund',3);
    const rental=await db.transaction(async tx=>{
      const found=await tx.query('SELECT * FROM rentals WHERE id=$1 FOR UPDATE',[req.params.id]);
      if(!found.rows.length)fail(404,'Vermietung nicht gefunden.');
      if(found.rows[0].cancelled_at)return found.rows[0];
      const result=await tx.query('UPDATE rentals SET cancelled_at=NOW(),cancel_reason=$2,cancelled_by=$3 WHERE id=$1 RETURNING *',[req.params.id,reason,req.employee.id]);
      await tx.query('UPDATE finance_entries SET voided_at=NOW(),void_reason=$2,voided_by=$3 WHERE rental_id=$1',[req.params.id,reason,req.employee.id]);
      return result.rows[0];
    });
    res.json({rental});
  });

  app.post('/api/finance',async (req,res)=>{
    const {id,kind,amount_cents}=req.body;
    if(!uuid(id)||!['income','expense'].includes(kind)||!Number.isInteger(amount_cents)||amount_cents<1||amount_cents>1_000_000_000)fail(400,'Bitte Einnahme oder Ausgabe und einen Betrag größer als 0 bis 10.000.000 $ eingeben.');
    const reason=clean(req.body.reason,200,'Grund',3),day=dateValue(req.body.occurred_on);
    if(!day)fail(400,'Bitte ein Buchungsdatum angeben.');
    const entry=await db.transaction(async tx=>{
      const result=await tx.query(`INSERT INTO finance_entries (id,employee_id,kind,amount_cents,currency,reason,occurred_on)
        VALUES ($1,$2,$3,$4,'USD',$5,$6) ON CONFLICT DO NOTHING RETURNING *`,[id,req.employee.id,kind,amount_cents,reason,day]);
      if(result.rows.length)return result.rows[0];
      const previous=await tx.query('SELECT * FROM finance_entries WHERE id=$1',[id]);
      if(previous.rows[0].employee_id!==req.employee.id||previous.rows[0].rental_id||previous.rows[0].purchase_id)fail(409,'Diese Buchungsnummer ist bereits vergeben.');
      return previous.rows[0];
    });
    res.status(201).json({entry});
  });
  app.post('/api/finance/:id/void',async (req,res)=>{
    const reason=clean(req.body.reason,200,'Stornogrund',3);
    const entry=await db.transaction(async tx=>{
      const result=await tx.query('SELECT * FROM finance_entries WHERE id=$1 FOR UPDATE',[req.params.id]);
      if(!result.rows.length)fail(404,'Eintrag nicht gefunden.');
      if(result.rows[0].rental_id)fail(409,'Bitte die zugehörige Vermietung auf der VIP-Seite stornieren.');
      if(result.rows[0].purchase_id)fail(409,'Bitte den zugehörigen Einkauf auf der Einkaufsseite stornieren, damit auch der Bestand korrigiert wird.');
      if(result.rows[0].voided_at)return result.rows[0];
      const saved=await tx.query('UPDATE finance_entries SET voided_at=NOW(),void_reason=$2,voided_by=$3 WHERE id=$1 RETURNING *',[req.params.id,reason,req.employee.id]);
      return saved.rows[0];
    });
    res.json({entry});
  });
  app.get('/api/finance',async (req,res)=>{
    const [from,to]=range(req),currency=readCurrency(req.query.currency)||'USD',params=[from,to,currency];
    const sql=`($1::date IS NULL OR f.occurred_on >= $1::date) AND ($2::date IS NULL OR f.occurred_on <= $2::date) AND f.currency=$3`;
    const totals=await db.query(`SELECT
      COALESCE(SUM(amount_cents) FILTER (WHERE kind='income' AND rental_id IS NULL),0)::text AS other_income_cents,
      COALESCE(SUM(amount_cents) FILTER (WHERE kind='income' AND rental_id IS NOT NULL),0)::text AS rental_income_cents,
      COALESCE(SUM(amount_cents) FILTER (WHERE kind='expense'),0)::text AS expense_cents
      FROM finance_entries f WHERE voided_at IS NULL AND ${sql}`,params);
    const sales=await db.query(`SELECT COALESCE(SUM(total_cents),0)::text AS sales_cents FROM orders o
      WHERE voided_at IS NULL AND o.currency=$3 AND ${rangeSql('o')}`,params);
    const entries=await db.query(`SELECT f.*,TO_CHAR(f.occurred_on,'YYYY-MM-DD') AS occurred_on,e.name AS employee_name FROM finance_entries f JOIN employees e ON e.id=f.employee_id
      WHERE ${sql} ORDER BY f.occurred_on DESC,f.created_at DESC,f.id LIMIT 200`,params);
    const t={...totals.rows[0],...sales.rows[0]};
    t.income_cents=Number(t.sales_cents)+Number(t.rental_income_cents)+Number(t.other_income_cents);
    t.balance_cents=t.income_cents-Number(t.expense_cents);
    res.json({currency,totals:t,entries:entries.rows});
  });
}
