export const STOCK_VERSION = '2026-10-12-lagerbestand-fotos-v1';
export const INITIAL_STOCK = {
  'steak-hamburger':40,'steakhouseplatte':15,'moonwater-chili':54,
  cola:39,'eistee-pfirsich':37,'texas-water':12,trinkblut:30,
  espresso:40,'latte-macchiato':39,whisky:34,'buddy-bier':50,
  moonhowl:50,bloodystrike:26,wizardspuff:38,'cuban-cigar':397,
  sonnenmango:29,'magische-e-shisha':9,wein:46,blutmondkirsche:39,
  feenapfel:28,sternenbeere:29,'magische-kohle':59,astraltraube:27,frostminze:29,
};
const OLD_PRODUCTS = ['old-fashioned','whiskey-sour','negroni','gin-tonic','cuba-libre','moscow-mule','whiskey','rum','lager','red-wine','water','ginger-beer','nuts'];

export async function initializeInventory(db) {
  await db.query(`
    ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0);
    ALTER TABLE products ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_accounted BOOLEAN NOT NULL DEFAULT FALSE;
    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id),
      employee_id TEXT REFERENCES employees(id), order_id TEXT REFERENCES orders(id),
      delta INTEGER NOT NULL, quantity_after INTEGER NOT NULL CHECK (quantity_after >= 0),
      reason TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('initial','adjustment','sale','void')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS stock_movements_created_idx ON stock_movements(created_at);
  `);
  await db.transaction(async tx => {
    const applied = await tx.query('INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id',[STOCK_VERSION]);
    if (!applied.rows.length) return;
    await tx.query('UPDATE products SET archived=TRUE,active=FALSE WHERE id=ANY($1::text[])',[OLD_PRODUCTS]);
    for (const [id,quantity] of Object.entries(INITIAL_STOCK)) {
      const result=await tx.query('UPDATE products SET stock_quantity=$2 WHERE id=$1 RETURNING id',[id,quantity]);
      if(result.rows.length) await tx.query(`INSERT INTO stock_movements (id,product_id,delta,quantity_after,reason,kind)
        VALUES ($1,$2,$3,$3,'Erstbestand aus den Lagerbildern','initial')`,['initial:'+id,id,quantity]);
    }
  });
}
