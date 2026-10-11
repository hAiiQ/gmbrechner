// Beträge aus den vom Bar-Team bereitgestellten Speise- und Shishakarten.
// Die Kartenpreise sind Dollarbeträge; intern wird weiterhin in Cent gerechnet.
export const MENU_CURRENCY = 'USD';
export const MENU_VERSION = '2026-10-11-speise-und-shishakarte-v1';
export const MENU_PRODUCTS = [
  ['moonwater-chili','Moonwater Chili','Essen','',25000],
  ['steak-hamburger','Steak Hamburger','Essen','',35000],
  ['steakhouseplatte','Steakhouseplatte','Essen','',40000],
  ['buddy-bier','Buddy Bier','Alkoholische Getränke','',22500],
  ['wein','Wein','Alkoholische Getränke','',35000],
  ['whisky','Whisky','Alkoholische Getränke','',40000],
  ['cola','Cola','Alkoholfreie Getränke','',30000],
  ['eistee-pfirsich','Eistee Pfirsich','Alkoholfreie Getränke','',25000],
  ['texas-water','Texas Water','Alkoholfreie Getränke','',20000],
  ['espresso','Espresso','Kaffeespezialitäten','',24000],
  ['latte-macchiato','Latte Macchiato','Kaffeespezialitäten','',22000],
  ['cuban-cigar','Cuban Cigar','Zigaretten & Zigarren','',100000],
  ['bloodystrike','Bloodystrike','Zigaretten & Zigarren','',40000],
  ['moonhowl','Moonhowl','Zigaretten & Zigarren','',40000],
  ['wizardspuff','Wizardspuff','Zigaretten & Zigarren','',40000],
  ['trinkblut','Trinkblut','Spezielles','',90000],
  ['magische-e-shisha','Magische E-Shisha','Shisha','',500000],
  ['magische-kohle','Magische Kohle','Aromen','Aus der Shishakarte',50000],
  ['sonnenmango','Sonnenmango','Aromen','Aus der Shishakarte',50000],
  ['feenapfel','Feenapfel','Aromen','Aus der Shishakarte',50000],
  ['sternenbeere','Sternenbeere','Aromen','Aus der Shishakarte',50000],
  ['astraltraube','Astraltraube','Aromen','Aus der Shishakarte',50000],
  ['blutmondkirsche','Blutmondkirsche','Aromen','Aus der Shishakarte',50000],
  ['frostminze','Frostminze','Aromen','Aus der Shishakarte',50000],
];

// Alte Beispielartikel werden pausiert. Ihre Datensätze bleiben für bestehende
// Buchungen bestehen. Cola wird mit derselben ID aus der echten Karte übernommen.
const SAMPLE_PRODUCT_IDS = ['old-fashioned','whiskey-sour','negroni','gin-tonic','cuba-libre','moscow-mule','whiskey','rum','lager','red-wine','water','ginger-beer','nuts'];

export async function applyMenuMigration(tx) {
  const applied=await tx.query('INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id',[MENU_VERSION]);
  if(!applied.rows.length)return;
  await tx.query('SELECT id FROM settings WHERE id=1 FOR UPDATE');
  await tx.query('UPDATE products SET active=FALSE WHERE id=ANY($1::text[])',[SAMPLE_PRODUCT_IDS]);
  for(let i=0;i<MENU_PRODUCTS.length;i++){
    const [id,name,category,description,price]=MENU_PRODUCTS[i];
    await tx.query(`INSERT INTO products (id,name,category,description,price_cents,sort_order,active)
      VALUES ($1,$2,$3,$4,$5,$6,TRUE) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,
      category=EXCLUDED.category,description=EXCLUDED.description,price_cents=EXCLUDED.price_cents,
      sort_order=EXCLUDED.sort_order,active=TRUE`,[id,name,category,description,price,i]);
  }
  // Historische Buchungen behalten ihre eigene Währung und ihre Preis-Snapshots.
  await tx.query('UPDATE settings SET currency=$1 WHERE id=1',[MENU_CURRENCY]);
}
