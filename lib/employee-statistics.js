const period=alias=>`($1::date IS NULL OR (${alias}.created_at AT TIME ZONE 'Europe/Berlin')::date >= $1::date) AND ($2::date IS NULL OR (${alias}.created_at AT TIME ZONE 'Europe/Berlin')::date <= $2::date)`;
async function overview(db,params,employeeId=null){
  const {rows}=await db.query(`WITH
    sales AS(SELECT employee_id,COALESCE(SUM(total_cents) FILTER(WHERE voided_at IS NULL),0)::text AS sales_cents,
      COUNT(*) FILTER(WHERE voided_at IS NULL)::int AS sales_count,COUNT(*) FILTER(WHERE voided_at IS NOT NULL)::int AS voided_sales_count
      FROM orders o WHERE currency='USD' AND ${period('o')} GROUP BY employee_id),
    admissions_total AS(SELECT employee_id,COALESCE(SUM(total_cents),0)::text AS admission_cents,SUM(quantity)::text AS admission_people,COUNT(*)::int AS admission_count
      FROM admissions a WHERE voided_at IS NULL AND ${period('a')} GROUP BY employee_id),
    rents AS(SELECT employee_id,COALESCE(SUM(total_cents),0)::text AS rental_cents,COUNT(*)::int AS rental_count
      FROM rentals r WHERE cancelled_at IS NULL AND currency='USD' AND ${period('r')} GROUP BY employee_id),
    purchases_total AS(SELECT employee_id,COALESCE(SUM(total_cents),0)::text AS purchase_cents,COUNT(*)::int AS purchase_count
      FROM purchases p WHERE voided_at IS NULL AND ($1::date IS NULL OR p.occurred_on >= $1::date) AND ($2::date IS NULL OR p.occurred_on <= $2::date) GROUP BY employee_id),
    finances AS(SELECT employee_id,COALESCE(SUM(amount_cents) FILTER(WHERE kind='income' AND rental_id IS NULL AND admission_id IS NULL),0)::text AS other_income_cents,
      COALESCE(SUM(amount_cents) FILTER(WHERE kind='expense'),0)::text AS expense_cents
      FROM finance_entries f WHERE voided_at IS NULL AND currency='USD' AND ($1::date IS NULL OR f.occurred_on >= $1::date) AND ($2::date IS NULL OR f.occurred_on <= $2::date) GROUP BY employee_id),
    bounds AS(SELECT COALESCE(($1::date)::timestamp AT TIME ZONE 'Europe/Berlin','-infinity'::timestamptz) AS start,
      COALESCE((($2::date)+1)::timestamp AT TIME ZONE 'Europe/Berlin','infinity'::timestamptz) AS finish),
    hours AS(SELECT employee_id,COALESCE(SUM(GREATEST(0,FLOOR(EXTRACT(EPOCH FROM (LEAST(COALESCE(ended_at,NOW()),b.finish)-GREATEST(started_at,b.start)))))),0)::text AS worked_seconds
      FROM time_shifts CROSS JOIN bounds b WHERE started_at<b.finish AND COALESCE(ended_at,NOW())>b.start GROUP BY employee_id),
    earnings AS(SELECT employee_id,COALESCE(SUM(amount_cents),0)::text AS earned_cents,
      COALESCE(SUM(CASE WHEN kind='delivery' THEN 1 WHEN kind='delivery_reversal' THEN -1 ELSE 0 END),0)::int AS delivery_count
      FROM payroll_credits c WHERE voided_at IS NULL AND ${period('c')} GROUP BY employee_id),
    pending AS(SELECT employee_id,COALESCE(SUM(amount_cents),0)::text AS pending_cents FROM payroll_credits WHERE voided_at IS NULL AND payout_id IS NULL GROUP BY employee_id),
    paid AS(SELECT employee_id,COALESCE(SUM(amount_cents),0)::text AS paid_cents FROM payroll_payouts p WHERE ${period('p')} GROUP BY employee_id)
    SELECT e.id,e.name,e.role,e.roles,e.department,e.active,e.removed_at,e.last_login_at,
      COALESCE(s.sales_cents,'0') AS sales_cents,COALESCE(s.sales_count,0) AS sales_count,COALESCE(s.voided_sales_count,0) AS voided_sales_count,
      COALESCE(a.admission_cents,'0') AS admission_cents,COALESCE(a.admission_people,'0') AS admission_people,COALESCE(a.admission_count,0) AS admission_count,
      COALESCE(r.rental_cents,'0') AS rental_cents,COALESCE(r.rental_count,0) AS rental_count,
      COALESCE(p.purchase_cents,'0') AS purchase_cents,COALESCE(p.purchase_count,0) AS purchase_count,
      COALESCE(f.other_income_cents,'0') AS other_income_cents,COALESCE(f.expense_cents,'0') AS expense_cents,
      COALESCE(h.worked_seconds,'0') AS worked_seconds,COALESCE(c.earned_cents,'0') AS earned_cents,COALESCE(c.delivery_count,0) AS delivery_count,
      COALESCE(n.pending_cents,'0') AS pending_cents,COALESCE(d.paid_cents,'0') AS paid_cents,COALESCE(w.balance_cents,0)::text AS cash_cents,
      EXISTS(SELECT 1 FROM time_shifts t WHERE t.employee_id=e.id AND t.ended_at IS NULL) AS on_duty
    FROM employees e LEFT JOIN sales s ON s.employee_id=e.id LEFT JOIN admissions_total a ON a.employee_id=e.id LEFT JOIN rents r ON r.employee_id=e.id
      LEFT JOIN purchases_total p ON p.employee_id=e.id LEFT JOIN finances f ON f.employee_id=e.id LEFT JOIN hours h ON h.employee_id=e.id
      LEFT JOIN earnings c ON c.employee_id=e.id LEFT JOIN pending n ON n.employee_id=e.id LEFT JOIN paid d ON d.employee_id=e.id
      LEFT JOIN wallet_accounts w ON w.employee_id=e.id WHERE ($3::text IS NULL OR e.id=$3) ORDER BY LOWER(e.name),e.id`,[...params,employeeId]);
  return rows.map(row=>({...row,revenue_cents:String(BigInt(row.sales_cents)+BigInt(row.admission_cents)+BigInt(row.rental_cents)+BigInt(row.other_income_cents))}));
}
const historySql=`WITH history AS(
  SELECT 'sale'::text AS kind,id,created_at AS occurred_at,CASE WHEN is_delivery THEN 'Artikelverkauf · Lieferung' ELSE 'Artikelverkauf' END::text AS label,total_cents::bigint AS amount_cents,currency,voided_at IS NOT NULL AS voided,payment AS notes FROM orders WHERE employee_id=$3
  UNION ALL SELECT 'admission',id,created_at,'Eintritt',total_cents::bigint,currency,voided_at IS NOT NULL,quantity::text||' Personen · '||payment FROM admissions WHERE employee_id=$3
  UNION ALL SELECT 'rental',id,created_at,CASE WHEN space='vip' THEN 'VIP Lounge' ELSE 'Oberer Bereich' END,total_cents::bigint,currency,cancelled_at IS NOT NULL,customer_name FROM rentals WHERE employee_id=$3
  UNION ALL SELECT 'purchase',id,occurred_on::timestamp AT TIME ZONE 'Europe/Berlin','Einkauf',-total_cents::bigint,'USD',voided_at IS NOT NULL,reason FROM purchases WHERE employee_id=$3
  UNION ALL SELECT 'finance',id,occurred_on::timestamp AT TIME ZONE 'Europe/Berlin',CASE WHEN kind='income' THEN 'Sonstige Einnahme' ELSE 'Ausgabe' END,CASE WHEN kind='income' THEN amount_cents::bigint ELSE -amount_cents::bigint END,currency,voided_at IS NOT NULL,reason
    FROM finance_entries WHERE employee_id=$3 AND rental_id IS NULL AND purchase_id IS NULL AND admission_id IS NULL AND payroll_payout_id IS NULL
  UNION ALL SELECT 'shift',id,started_at,'Arbeitszeit',amount_cents,'USD',FALSE,job||' · '||COALESCE(worked_seconds::text||' Sekunden','läuft') FROM time_shifts WHERE employee_id=$3
  UNION ALL SELECT 'payout',id,created_at,'Lohnauszahlung',amount_cents,'USD',FALSE,'Bank' FROM payroll_payouts WHERE employee_id=$3
  UNION ALL SELECT 'wage',id,created_at,CASE WHEN kind='work' THEN 'Lohn Arbeitszeit' WHEN kind='delivery' THEN 'Lieferlohn' ELSE 'Verrechnung Lieferstorno' END,amount_cents,'USD',voided_at IS NOT NULL,CASE WHEN payout_id IS NULL THEN 'Offen' ELSE 'Ausgezahlt' END FROM payroll_credits WHERE employee_id=$3
  UNION ALL SELECT 'stock',s.id,s.created_at,'Lagerbewegung',NULL::bigint,'USD',FALSE,p.name||' · '||s.delta::text||' Stück · '||s.reason FROM stock_movements s JOIN products p ON p.id=s.product_id WHERE s.employee_id=$3
) SELECT kind,id,date_trunc('milliseconds',occurred_at) AS occurred_at,label,amount_cents::text,currency,voided,notes FROM history h
WHERE ($1::date IS NULL OR (h.occurred_at AT TIME ZONE 'Europe/Berlin')::date >= $1::date)
AND ($2::date IS NULL OR (h.occurred_at AT TIME ZONE 'Europe/Berlin')::date <= $2::date)`;
function cursorValue(value,fail){
  if(!value)return [null,null,null];
  try{
    if(typeof value!=='string'||value.length>512)throw new Error();
    const data=JSON.parse(Buffer.from(value,'base64url').toString('utf8'));
    if(!Array.isArray(data)||data.length!==3||typeof data[0]!=='string'||new Date(data[0]).toISOString()!==data[0]||typeof data[1]!=='string'||!/^[a-z]+$/.test(data[1])||typeof data[2]!=='string'||data[2].length>128)throw new Error();
    return data;
  }catch{fail(400,'Ungültige Seite der Mitarbeiterhistorie.');}
}
function csvCell(value){let text=typeof value==='number'?String(value).replace('.',','):String(value??'');if(typeof value!=='number'&&/^[\s]*[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
const csv=rows=>'\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n');
export function registerEmployeeStatistics(app,db,{fail,uuid,range}){
  const id=req=>{if(!uuid(req.params.id))fail(400,'Ungültiger Mitarbeiter.');return req.params.id;};
  app.get('/api/employee-statistics',async(req,res)=>res.json({employees:await overview(db,range(req)),currency:'USD'}));
  app.get('/api/employee-statistics/export',async(req,res)=>{
    const rows=await overview(db,range(req));
    res.type('text/csv; charset=utf-8').attachment('mitarbeiter-statistik.csv').send(csv([
      ['Mitarbeiter','Ränge','Abteilung','Umsatz USD','Artikelverkäufe','Eintritt USD','Personen Eintritt','Vermietung USD','Vermietungen','Sonstige Einnahmen USD','Einnahmen gesamt USD','Ausgaben USD','Einkauf USD','Einkäufe','Arbeitsstunden','Verdient USD','Ausgezahlt USD','Lohn offen aktuell USD','Bargeld aktuell USD','Lieferungen'],
      ...rows.map(e=>[e.name,(e.roles?.length?e.roles:[e.role]).join(' + '),e.department,Number(e.sales_cents)/100,e.sales_count,Number(e.admission_cents)/100,e.admission_people,Number(e.rental_cents)/100,e.rental_count,Number(e.other_income_cents)/100,Number(e.revenue_cents)/100,Number(e.expense_cents)/100,Number(e.purchase_cents)/100,e.purchase_count,Number(e.worked_seconds)/3600,Number(e.earned_cents)/100,Number(e.paid_cents)/100,Number(e.pending_cents)/100,Number(e.cash_cents)/100,e.delivery_count])
    ]));
  });
  app.get('/api/employee-statistics/:id/export',async(req,res)=>{
    const employeeId=id(req),params=range(req);
    const person=(await db.query('SELECT name FROM employees WHERE id=$1',[employeeId])).rows[0];if(!person)fail(404,'Mitarbeiter nicht gefunden.');
    const {rows}=await db.query(historySql+' ORDER BY date_trunc(\'milliseconds\',occurred_at) DESC,kind DESC,id DESC',[...params,employeeId]);
    res.type('text/csv; charset=utf-8').attachment('mitarbeiter-'+employeeId+'.csv').send(csv([
      ['Mitarbeiter','Datum (Europe/Berlin)','Art','Nummer','Betrag','Währung','Status','Details'],...rows.map(row=>[person.name,new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',dateStyle:'short',timeStyle:'medium'}).format(new Date(row.occurred_at)),row.label,row.id,row.amount_cents==null?'':Number(row.amount_cents)/100,row.currency,row.voided?'Storniert':'Erfasst',row.notes])
    ]));
  });
  app.get('/api/employee-statistics/:id',async(req,res)=>{
    const employeeId=id(req),params=range(req),employee=(await overview(db,params,employeeId))[0];if(!employee)fail(404,'Mitarbeiter nicht gefunden.');
    const cursor=cursorValue(req.query.cursor,fail);
    const {rows}=await db.query(historySql+` AND ($4::timestamptz IS NULL OR (date_trunc('milliseconds',h.occurred_at),h.kind,h.id)<($4::timestamptz,$5::text,$6::text))
      ORDER BY date_trunc('milliseconds',occurred_at) DESC,kind DESC,id DESC LIMIT 101`,[...params,employeeId,...cursor]);
    const records=rows.slice(0,100),last=records.at(-1);
    const next=rows.length>100?Buffer.from(JSON.stringify([new Date(last.occurred_at).toISOString(),last.kind,last.id])).toString('base64url'):null;
    res.json({employee,records,next_cursor:next,currency:'USD'});
  });
}
