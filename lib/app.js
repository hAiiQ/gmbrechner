import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import path from 'node:path';

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };
const hash = text => createHash('sha256').update(text).digest('hex');
const clean = (value, max, label, min = 1) => {
  if (typeof value !== 'string') fail(400, `${label} fehlt.`);
  const result = value.normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (result.length < min || result.length > max || /[\x00-\x1f\x7f]/.test(result)) fail(400, `${label}: ${min} bis ${max} Zeichen erlaubt.`);
  return result;
};
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const dateValue = value => {
  if (!value) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(400, 'Ungültiges Datum.');
  const d = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(+d) || d.toISOString().slice(0,10) !== value || value < '2000-01-01' || value > '2100-12-31') fail(400, 'Ungültiges Datum.');
  return value;
};
const range = req => {
  const from = dateValue(req.query.from), to = dateValue(req.query.to);
  if (from && to && from > to) fail(400, 'Das Enddatum muss nach dem Startdatum liegen.');
  return [from, to];
};
const rangeSql = alias => `($1::date IS NULL OR (${alias}.created_at AT TIME ZONE 'Europe/Berlin')::date >= $1::date)
  AND ($2::date IS NULL OR (${alias}.created_at AT TIME ZONE 'Europe/Berlin')::date <= $2::date)`;

export function createApp(db, { production = false, publicDirectory = path.resolve('public'), loginLimit = 30 } = {}) {
  const app = express();
  if (production) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: { directives: { 'img-src': ["'self'", 'data:'], 'script-src': ["'self'"], 'style-src': ["'self'"], 'font-src': ["'self'"], 'connect-src': ["'self'"], 'upgrade-insecure-requests': production ? [] : null } } }));
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
      if (!req.is('application/json')) return res.status(415).json({ error: 'JSON-Anfrage erforderlich.' });
      const origin = req.get('origin');
      if (origin && origin !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ error: 'Diese Anfrage ist nicht erlaubt.' });
    }
    next();
  });
  app.get('/api/health', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ ok: true });
  });
  app.get('/api/config', async (_req, res) => {
    const { rows } = await db.query('SELECT currency FROM settings WHERE id=1');
    res.json({ currency: rows[0].currency });
  });
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: loginLimit, standardHeaders: 'draft-8', legacyHeaders: false,
    handler: (_req,res) => res.status(429).json({ error: 'Zu viele Versuche. Bitte in 15 Minuten erneut versuchen.' }) });
  app.post('/api/login', limiter, async (req,res) => {
    const name = clean(req.body.name, 40, 'Name', 2);
    const nameKey = name.toLocaleLowerCase('de-DE');
    const { rows } = await db.query(`INSERT INTO employees (id,name,name_key) VALUES ($1,$2,$3)
      ON CONFLICT (name_key) DO UPDATE SET name_key=EXCLUDED.name_key RETURNING id,name`, [randomUUID(),name,nameKey]);
    const token = randomBytes(32).toString('hex');
    await db.query("DELETE FROM sessions WHERE expires_at < NOW()");
    await db.query("INSERT INTO sessions (token_hash,employee_id,expires_at) VALUES ($1,$2,NOW()+INTERVAL '12 hours')",[hash(token),rows[0].id]);
    res.cookie('bar_session',token,{ httpOnly:true, secure:production, sameSite:'strict', maxAge:12*60*60*1000, path:'/' });
    res.json({ employee: rows[0] });
  });
  app.use('/api', async (req,res,next) => {
    const match = (req.get('cookie') || '').match(/(?:^|;\s*)bar_session=([a-f0-9]{64})(?:;|$)/);
    if (!match) fail(401,'Bitte melde dich an.');
    const tokenHash = hash(match[1]);
    const { rows } = await db.query(`SELECT e.id,e.name FROM sessions s
      JOIN employees e ON e.id=s.employee_id WHERE s.token_hash=$1 AND s.expires_at>NOW()`,[tokenHash]);
    if (!rows.length) fail(401,'Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.');
    req.employee = rows[0]; req.tokenHash = tokenHash;
    next();
  });
  app.get('/api/me',(req,res) => res.json({ employee:{id:req.employee.id,name:req.employee.name} }));
  app.post('/api/logout',async (req,res) => {
    await db.query('DELETE FROM sessions WHERE token_hash=$1',[req.tokenHash]);
    res.clearCookie('bar_session',{path:'/',secure:production,sameSite:'strict'}).json({ok:true});
  });
  app.get('/api/products',async (req,res) => {
    const all = req.query.all === 'true';
    const { rows } = await db.query(`SELECT * FROM products ${all ? '' : 'WHERE active=TRUE'} ORDER BY sort_order,name`);
    res.json({products:rows});
  });
  app.post('/api/products',async (req,res) => {
    const product = validateProduct(req.body);
    const { rows } = await db.query('INSERT INTO products (id,name,category,description,price_cents,sort_order) VALUES ($1,$2,$3,$4,$5,(SELECT COALESCE(MAX(sort_order),0)+1 FROM products)) RETURNING *',
      [randomUUID(),product.name,product.category,product.description,product.price_cents]);
    res.status(201).json({product:rows[0]});
  });
  app.put('/api/products/:id',async (req,res) => {
    const product = validateProduct(req.body);
    if (typeof req.body.active !== 'boolean') fail(400,'Artikelstatus fehlt.');
    const { rows } = await db.query('UPDATE products SET name=$2,category=$3,description=$4,price_cents=$5,active=$6 WHERE id=$1 RETURNING *',
      [req.params.id,product.name,product.category,product.description,product.price_cents,req.body.active]);
    if (!rows.length) fail(404,'Artikel nicht gefunden.');
    res.json({product:rows[0]});
  });
  app.put('/api/settings',async (req,res) => {
    const currency = req.body.currency;
    if (!['EUR','USD'].includes(currency)) fail(400,'Bitte EUR oder USD wählen.');
    await db.transaction(async tx => {
      const { rows } = await tx.query('SELECT currency FROM settings WHERE id=1 FOR UPDATE');
      if (rows[0].currency !== currency) {
        const orders = await tx.query('SELECT id FROM orders LIMIT 1');
        if (orders.rows.length) fail(409,'Nach dem ersten Verkauf bleibt die Währung fest, damit alle Umsätze vergleichbar sind.');
        await tx.query('UPDATE settings SET currency=$1 WHERE id=1',[currency]);
      }
    });
    res.json({currency});
  });
  app.post('/api/orders',async (req,res) => {
    const { id, items, payment, currency } = req.body;
    if (!uuid(id)) fail(400,'Ungültige Buchungsnummer.');
    if (!['cash','card'].includes(payment)) fail(400,'Bitte eine Zahlungsart wählen.');
    if (!Array.isArray(items) || !items.length || items.length>100) fail(400,'Der Warenkorb muss 1 bis 100 Positionen enthalten.');
    const seen = new Set();
    for (const item of items) {
      if (!item || typeof item.productId!=='string' || seen.has(item.productId) || !Number.isInteger(item.quantity) || item.quantity<1 || item.quantity>999 || !Number.isInteger(item.unitPriceCents)) fail(400,'Ungültiger Artikel oder ungültige Menge (1–999).');
      seen.add(item.productId);
    }
    const result = await db.transaction(async tx => {
      const existing = await tx.query('SELECT * FROM orders WHERE id=$1',[id]);
      if (existing.rows.length) {
        if (existing.rows[0].employee_id!==req.employee.id) fail(409,'Diese Buchungsnummer ist bereits vergeben.');
        return existing.rows[0];
      }
      const settings = await tx.query('SELECT currency FROM settings WHERE id=1 FOR SHARE');
      if (currency !== settings.rows[0].currency) fail(409,'Die Währung hat sich geändert. Bitte lade die Seite neu.');
      const products = await tx.query('SELECT * FROM products WHERE id=ANY($1::text[]) ORDER BY id FOR SHARE',[[...seen]]);
      let total = 0;
      const lines = items.map(item => {
        const p = products.rows.find(p=>p.id===item.productId);
        if (!p?.active) fail(409,'Ein Artikel ist nicht mehr verfügbar. Bitte aktualisiere den Warenkorb.');
        if (p.price_cents!==item.unitPriceCents) fail(409,`Der Preis von „${p.name}“ hat sich geändert. Bitte füge den Artikel neu hinzu.`);
        total += p.price_cents * item.quantity;
        return {...p,quantity:item.quantity};
      });
      if (total > 1_000_000_000) fail(400,'Der Gesamtbetrag ist zu groß.');
      const inserted = await tx.query(`INSERT INTO orders (id,employee_id,total_cents,currency,payment) VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT DO NOTHING RETURNING *`,[id,req.employee.id,total,currency,payment]);
      if (!inserted.rows.length) {
        const duplicate = await tx.query('SELECT * FROM orders WHERE id=$1',[id]);
        if (duplicate.rows[0].employee_id !== req.employee.id) fail(409,'Diese Buchungsnummer ist bereits vergeben.');
        return duplicate.rows[0];
      }
      for (const line of lines) await tx.query('INSERT INTO order_items (order_id,product_id,name,price_cents,quantity) VALUES ($1,$2,$3,$4,$5)',[id,line.id,line.name,line.price_cents,line.quantity]);
      return inserted.rows[0];
    });
    res.status(201).json({order:result});
  });
  app.get('/api/stats',async (req,res) => {
    const params = range(req);
    const settings=await db.query('SELECT currency FROM settings WHERE id=1');
    const currency=readCurrency(req.query.currency)||settings.rows[0].currency;
    params.push(currency);
    const employees = await db.query(`SELECT e.id,e.name,COALESCE(SUM(o.total_cents),0)::text AS total_cents,COUNT(o.id)::int AS count
      FROM employees e LEFT JOIN orders o ON o.employee_id=e.id AND o.voided_at IS NULL AND o.currency=$3 AND ${rangeSql('o')}
      GROUP BY e.id,e.name ORDER BY SUM(o.total_cents) DESC NULLS LAST,e.name`,params);
    const totals = await db.query(`SELECT COALESCE(SUM(total_cents),0)::text AS total_cents,COUNT(*)::int AS count,
      COALESCE(SUM(total_cents) FILTER (WHERE payment='cash'),0)::text AS cash_cents,
      COALESCE(SUM(total_cents) FILTER (WHERE payment='card'),0)::text AS card_cents
      FROM orders o WHERE voided_at IS NULL AND o.currency=$3 AND ${rangeSql('o')}`,params);
    const orders = await db.query(`SELECT o.*,e.name AS employee_name FROM orders o JOIN employees e ON e.id=o.employee_id
      WHERE o.currency=$3 AND ${rangeSql('o')} ORDER BY o.created_at DESC,o.id DESC LIMIT 50`,params);
    const best = await db.query(`SELECT i.name,SUM(i.quantity)::text AS quantity,SUM(i.price_cents*i.quantity)::text AS total_cents
      FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.voided_at IS NULL AND o.currency=$3 AND ${rangeSql('o')}
      GROUP BY i.name ORDER BY SUM(i.quantity) DESC,i.name LIMIT 5`,params);
    const currencies=await db.query('SELECT DISTINCT currency FROM orders ORDER BY currency');
    res.json({currency,currencies:[...new Set([settings.rows[0].currency,...currencies.rows.map(row=>row.currency)])],totals:totals.rows[0],employees:employees.rows,orders:orders.rows,bestsellers:best.rows});
  });
  app.get('/api/orders/export',async (req,res) => {
    const params = range(req);
    params.push(readCurrency(req.query.currency));
    const { rows } = await db.query(`SELECT o.*,e.name AS employee_name,i.name AS article,i.price_cents,i.quantity
      FROM orders o JOIN employees e ON e.id=o.employee_id JOIN order_items i ON i.order_id=o.id
      WHERE ($3::text IS NULL OR o.currency=$3) AND ${rangeSql('o')} ORDER BY o.created_at DESC,o.id,i.name`,params);
    const cell = value => {
      let str=String(value??'');
      if (/^[\s]*[=+@-]/.test(str)) str="'"+str;
      return '"'+str.replaceAll('"','""')+'"';
    };
    const csv=[['Buchung','Datum (Europe/Berlin)','Mitarbeiter','Artikel','Menge','Einzelpreis','Positionssumme','Währung','Zahlungsart','Status','Stornogrund']];
    for (const row of rows) csv.push([row.id,new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'medium'}).format(new Date(row.created_at)),row.employee_name,row.article,row.quantity,(row.price_cents/100).toFixed(2).replace('.',','),(row.price_cents*row.quantity/100).toFixed(2).replace('.',','),row.currency,row.payment==='cash'?'Bar':'Karte',row.voided_at?'Storniert':'Gebucht',row.void_reason||'']);
    res.type('text/csv; charset=utf-8').attachment('gentlemans-bar-umsaetze.csv').send('\uFEFF'+csv.map(row=>row.map(cell).join(';')).join('\r\n'));
  });
  app.get('/api/orders/:id',async (req,res) => {
    const { rows } = await db.query('SELECT o.*,e.name AS employee_name FROM orders o JOIN employees e ON e.id=o.employee_id WHERE o.id=$1',[req.params.id]);
    if (!rows.length) fail(404,'Buchung nicht gefunden.');
    const items = await db.query('SELECT * FROM order_items WHERE order_id=$1 ORDER BY name',[req.params.id]);
    res.json({order:rows[0],items:items.rows});
  });
  app.post('/api/orders/:id/void',async (req,res) => {
    const reason = clean(req.body.reason,200,'Stornogrund',3);
    const { rows } = await db.query('UPDATE orders SET voided_at=NOW(),void_reason=$2,voided_by=$3 WHERE id=$1 AND voided_at IS NULL RETURNING *',[req.params.id,reason,req.employee.id]);
    if (!rows.length) fail(409,'Diese Buchung wurde bereits storniert oder existiert nicht.');
    res.json({order:rows[0]});
  });
  app.use('/api',(_req,res) => res.status(404).json({error:'Diese Funktion existiert nicht.'}));
  app.use(express.static(publicDirectory,{maxAge:production?'1h':0}));
  app.use((error,_req,res,_next) => {
    if (!error.status || error.status >= 500) console.error('Anfrage fehlgeschlagen:',error.message);
    const status = error.status || 500;
    res.status(status).json({error:status<500?error.message:'Die Buchung konnte nicht verarbeitet werden. Bitte versuche es erneut.'});
  });
  return app;
}

function validateProduct(body) {
  const name=clean(body.name,60,'Artikelname'),category=clean(body.category,30,'Kategorie');
  const description=clean(body.description??'',120,'Beschreibung',0);
  if (!Number.isInteger(body.price_cents) || body.price_cents<0 || body.price_cents>10_000_000) fail(400,'Der Preis muss zwischen 0 und 100.000 liegen.');
  return {name,category,description,price_cents:body.price_cents};
}

function readCurrency(value) {
  if(value===undefined||value==='')return null;
  if(!['USD','EUR'].includes(value))fail(400,'Ungültige Währung. Bitte USD oder EUR wählen.');
  return value;
}
