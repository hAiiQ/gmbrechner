import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';

export async function openDatabase({ url, directory = './data', memory = false } = {}) {
  if (url) {
    const pool = new pg.Pool({
      connectionString: url,
      max: 10,
      ...(process.env.PGSSLMODE === 'require' ? { ssl: { rejectUnauthorized: true } } : {}),
    });
    return {
      query: (sql, params) => pool.query(sql, params),
      async transaction(run) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const result = await run(client);
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally { client.release(); }
      },
      close: () => pool.end(),
    };
  }
  if (!memory) await mkdir(path.resolve(directory), { recursive: true });
  const db = new PGlite(memory ? undefined : path.resolve(directory));
  await db.waitReady;
  return {
    query: (sql, params) => params?.length ? db.query(sql, params) : db.exec(sql).then(results => results.at(-1)),
    transaction: run => db.transaction(client => run(client)),
    close: () => db.close(),
  };
}

export async function initializeDatabase(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1), currency TEXT NOT NULL DEFAULT 'EUR'
    );
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, employee_id TEXT NOT NULL REFERENCES employees(id),
      expires_at TIMESTAMPTZ NOT NULL, admin_until TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '', price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
      active BOOLEAN NOT NULL DEFAULT TRUE, sort_order INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, employee_id TEXT NOT NULL REFERENCES employees(id),
      total_cents INTEGER NOT NULL CHECK (total_cents >= 0), currency TEXT NOT NULL,
      payment TEXT NOT NULL CHECK (payment IN ('cash','card')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), voided_at TIMESTAMPTZ,
      void_reason TEXT, voided_by TEXT REFERENCES employees(id)
    );
    CREATE TABLE IF NOT EXISTS order_items (
      order_id TEXT NOT NULL REFERENCES orders(id), product_id TEXT NOT NULL REFERENCES products(id),
      name TEXT NOT NULL, price_cents INTEGER NOT NULL, quantity INTEGER NOT NULL CHECK (quantity > 0),
      PRIMARY KEY (order_id, product_id)
    );
    CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at);
    CREATE INDEX IF NOT EXISTS orders_employee_idx ON orders(employee_id);
    CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
  `);
  await db.transaction(async tx => {
    const seeded = await tx.query("INSERT INTO settings (id,currency) VALUES (1,'EUR') ON CONFLICT DO NOTHING RETURNING id");
    if (!seeded.rows.length) return;
    const products = [
      ['old-fashioned','Old Fashioned','Cocktails','Whiskey · Bitter · Orange',1200],
      ['whiskey-sour','Whiskey Sour','Cocktails','Bourbon · Zitrone · Zucker',1100],
      ['negroni','Negroni','Cocktails','Gin · Campari · Wermut',1200],
      ['gin-tonic','Gin & Tonic','Longdrinks','Gin · Tonic · Limette',1000],
      ['cuba-libre','Cuba Libre','Longdrinks','Rum · Cola · Limette',950],
      ['moscow-mule','Moscow Mule','Longdrinks','Vodka · Ginger Beer · Limette',1100],
      ['whiskey','Whiskey on the Rocks','Spirituosen','4 cl · auf Eis',850],
      ['rum','Rum Reserva','Spirituosen','4 cl · pur oder auf Eis',800],
      ['lager','Lager vom Fass','Bier & Wein','0,4 l · frisch gezapft',500],
      ['red-wine','Rotwein','Bier & Wein','0,2 l · Hauswein',650],
      ['water','Mineralwasser','Alkoholfrei','0,33 l · still oder sprudelnd',300],
      ['cola','Cola','Alkoholfrei','0,33 l · gekühlt',350],
      ['ginger-beer','Ginger Beer','Alkoholfrei','0,2 l · würzig & frisch',400],
      ['nuts','Bar-Nüsse','Snacks','Eine kleine Schale',400],
    ];
    for (let i = 0; i < products.length; i++) {
      const [id,name,category,description,price] = products[i];
      await tx.query('INSERT INTO products (id,name,category,description,price_cents,sort_order) VALUES ($1,$2,$3,$4,$5,$6)', [id,name,category,description,price,i]);
    }
  });
}
