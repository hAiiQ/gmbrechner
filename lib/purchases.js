import {randomUUID} from 'node:crypto';
export const PURCHASE_VERSION='2026-10-12-einkaufspreise-v1';
export const PURCHASE_PRICES={
  whisky:10000,wein:10000,'cuban-cigar':10000,bloodystrike:10000,moonhowl:10000,wizardspuff:10000,
  cola:10000,'eistee-pfirsich':10000,'buddy-bier':10000,'texas-water':10000,'steakhouseplatte':10000,
  'moonwater-chili':10000,'latte-macchiato':10000,espresso:10000,'steak-hamburger':10000,
  trinkblut:60000,'magische-e-shisha':300000,'magische-kohle':30000,sonnenmango:30000,
  feenapfel:30000,sternenbeere:30000,astraltraube:30000,blutmondkirsche:30000,frostminze:30000,
};
export async function initializePurchases(db){
  await db.query(`
    ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_price_cents INTEGER CHECK (purchase_price_cents > 0);
    CREATE TABLE IF NOT EXISTS purchases (
      id TEXT PRIMARY KEY,employee_id TEXT NOT NULL REFERENCES employees(id),total_cents INTEGER NOT NULL CHECK (total_cents > 0),
      currency TEXT NOT NULL DEFAULT 'USD',reason TEXT NOT NULL,occurred_on DATE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),voided_at TIMESTAMPTZ,void_reason TEXT,voided_by TEXT REFERENCES employees(id)
    );
    CREATE TABLE IF NOT EXISTS purchase_items (
      purchase_id TEXT NOT NULL REFERENCES purchases(id),product_id TEXT NOT NULL REFERENCES products(id),
      name TEXT NOT NULL,unit_cost_cents INTEGER NOT NULL CHECK (unit_cost_cents > 0),quantity INTEGER NOT NULL CHECK (quantity > 0),
      PRIMARY KEY (purchase_id,product_id)
    );
    ALTER TABLE finance_entries ADD COLUMN IF NOT EXISTS purchase_id TEXT UNIQUE REFERENCES purchases(id);
    ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS purchase_id TEXT REFERENCES purchases(id);
    CREATE INDEX IF NOT EXISTS purchases_created_idx ON purchases(created_at);
  `);
  await db.transaction(async tx=>{
    const applied=await tx.query('INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id',[PURCHASE_VERSION]);
    if(!applied.rows.length)return;
    await tx.query('ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_kind_check');
    await tx.query("ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_kind_check CHECK (kind IN ('initial','adjustment','sale','void','purchase','purchase_void'))");
    for(const [id,price] of Object.entries(PURCHASE_PRICES))await tx.query('UPDATE products SET purchase_price_cents=$2 WHERE id=$1',[id,price]);
  });
}

export function registerPurchases(app,db,{fail,clean,uuid,dateValue}){
  function sameEmployee(row,req){if(row.employee_id!==req.employee.id)fail(409,'Diese Buchungsnummer ist bereits vergeben.');return row;}
  app.get('/api/purchases',async (_req,res)=>{
    const products=await db.query('SELECT * FROM products WHERE archived=FALSE ORDER BY sort_order,name');
    const purchases=await db.query(`SELECT p.*,TO_CHAR(p.occurred_on,'YYYY-MM-DD') AS occurred_on,e.name AS employee_name
      FROM purchases p JOIN employees e ON e.id=p.employee_id ORDER BY p.created_at DESC,p.id LIMIT 50`);
    const totals=await db.query('SELECT COALESCE(SUM(total_cents),0)::text AS total_cents,COUNT(*)::int AS count FROM purchases WHERE voided_at IS NULL');
    res.json({products:products.rows,purchases:purchases.rows,totals:totals.rows[0]});
  });
  app.post('/api/purchases',async (req,res)=>{
    const {id,items}=req.body,day=dateValue(req.body.occurred_on),reason=clean(req.body.reason||'Wareneinkauf',200,'Grund',3);
    if(!uuid(id)||!day)fail(400,'Buchungsnummer oder Buchungsdatum ist ungültig.');
    if(!Array.isArray(items)||!items.length||items.length>100)fail(400,'Bitte 1 bis 100 Artikel für den Einkauf auswählen.');
    const seen=new Set();
    for(const i of items){
      if(!i||typeof i.productId!=='string'||seen.has(i.productId)||!Number.isInteger(i.quantity)||i.quantity<1||i.quantity>100000||!Number.isInteger(i.unitCostCents))fail(400,'Ungültiger Einkaufsartikel oder ungültige Menge (1–100.000).');
      seen.add(i.productId);
    }
    const purchase=await db.transaction(async tx=>{
      const previous=await tx.query('SELECT * FROM purchases WHERE id=$1',[id]);
      if(previous.rows.length)return sameEmployee(previous.rows[0],req);
      const products=await tx.query('SELECT * FROM products WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',[[...seen]]);
      const retried=await tx.query('SELECT * FROM purchases WHERE id=$1',[id]);
      if(retried.rows.length)return sameEmployee(retried.rows[0],req);
      let total=0;
      const lines=items.map(i=>{
        const p=products.rows.find(p=>p.id===i.productId);
        if(!p||p.archived)fail(409,'Ein Artikel ist nicht mehr im Sortiment. Bitte aktualisieren.');
        if(!p.purchase_price_cents)fail(409,`Für „${p.name}“ fehlt der Einkaufspreis. Bitte unter Sortiment ergänzen.`);
        if(p.purchase_price_cents!==i.unitCostCents)fail(409,`Der Einkaufspreis von „${p.name}“ hat sich geändert. Bitte den Einkauf neu laden.`);
        if(p.stock_quantity+i.quantity>1_000_000)fail(400,`„${p.name}“: Der Bestand darf höchstens 1.000.000 Stück betragen.`);
        total+=p.purchase_price_cents*i.quantity;
        return {...p,quantity:i.quantity};
      });
      if(total>1_000_000_000)fail(400,'Der Einkauf darf höchstens 10.000.000 $ kosten.');
      const inserted=await tx.query(`INSERT INTO purchases (id,employee_id,total_cents,currency,reason,occurred_on)
        VALUES ($1,$2,$3,'USD',$4,$5) ON CONFLICT DO NOTHING RETURNING *`,[id,req.employee.id,total,reason,day]);
      if(!inserted.rows.length)return sameEmployee((await tx.query('SELECT * FROM purchases WHERE id=$1',[id])).rows[0],req);
      for(const p of lines){
        await tx.query('INSERT INTO purchase_items (purchase_id,product_id,name,unit_cost_cents,quantity) VALUES ($1,$2,$3,$4,$5)',[id,p.id,p.name,p.purchase_price_cents,p.quantity]);
        await tx.query('UPDATE products SET stock_quantity=stock_quantity+$2 WHERE id=$1',[p.id,p.quantity]);
        await tx.query(`INSERT INTO stock_movements (id,product_id,employee_id,purchase_id,delta,quantity_after,reason,kind)
          VALUES ($1,$2,$3,$4,$5,$6,$7,'purchase')`,[randomUUID(),p.id,req.employee.id,id,p.quantity,p.stock_quantity+p.quantity,`Einkauf · ${reason}`]);
      }
      await tx.query(`INSERT INTO finance_entries (id,employee_id,purchase_id,kind,amount_cents,currency,reason,occurred_on)
        VALUES ($1,$2,$3,'expense',$4,'USD',$5,$6)`,[randomUUID(),req.employee.id,id,total,`Einkauf · ${reason}`,day]);
      return inserted.rows[0];
    });
    res.status(201).json({purchase});
  });
  app.get('/api/purchases/:id',async (req,res)=>{
    const result=await db.query(`SELECT p.*,TO_CHAR(p.occurred_on,'YYYY-MM-DD') AS occurred_on,e.name AS employee_name
      FROM purchases p JOIN employees e ON e.id=p.employee_id WHERE p.id=$1`,[req.params.id]);
    if(!result.rows.length)fail(404,'Einkauf nicht gefunden.');
    const items=await db.query('SELECT * FROM purchase_items WHERE purchase_id=$1 ORDER BY name',[req.params.id]);
    res.json({purchase:result.rows[0],items:items.rows});
  });
  app.post('/api/purchases/:id/void',async (req,res)=>{
    const reason=clean(req.body.reason,200,'Stornogrund',3);
    const purchase=await db.transaction(async tx=>{
      const result=await tx.query('SELECT * FROM purchases WHERE id=$1 FOR UPDATE',[req.params.id]);
      if(!result.rows.length)fail(404,'Einkauf nicht gefunden.');
      if(result.rows[0].voided_at)return result.rows[0];
      const items=await tx.query(`SELECT p.id,p.name,p.stock_quantity,i.quantity FROM products p JOIN purchase_items i ON i.product_id=p.id
        WHERE i.purchase_id=$1 ORDER BY p.id FOR UPDATE OF p`,[req.params.id]);
      for(const p of items.rows){
        if(p.stock_quantity<p.quantity)fail(409,`„${p.name}“: Für dieses Storno müssen noch ${p.quantity} Stück im Lager sein. Es sind nur ${p.stock_quantity} vorhanden.`);
        await tx.query('UPDATE products SET stock_quantity=stock_quantity-$2 WHERE id=$1',[p.id,p.quantity]);
        await tx.query(`INSERT INTO stock_movements (id,product_id,employee_id,purchase_id,delta,quantity_after,reason,kind)
          VALUES ($1,$2,$3,$4,$5,$6,$7,'purchase_void')`,[randomUUID(),p.id,req.employee.id,req.params.id,-p.quantity,p.stock_quantity-p.quantity,`Einkauf storniert · ${reason}`]);
      }
      await tx.query('UPDATE finance_entries SET voided_at=NOW(),void_reason=$2,voided_by=$3 WHERE purchase_id=$1',[req.params.id,reason,req.employee.id]);
      return (await tx.query('UPDATE purchases SET voided_at=NOW(),void_reason=$2,voided_by=$3 WHERE id=$1 RETURNING *',[req.params.id,reason,req.employee.id])).rows[0];
    });
    res.json({purchase});
  });
}
