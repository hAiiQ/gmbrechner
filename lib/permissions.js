export const INITIAL_OWNER_NAME_KEY='michael black';
export const EMPLOYEE_JOBS=Object.freeze(['Inhaber','Manager','Barkeeper Leitung','Barkeeper','Security Leitung','Security']);
const jobKey=value=>String(value??'').normalize('NFKC').trim().toLocaleLowerCase('de-DE').replace(/\s+/g,' ');
export const canonicalJob=value=>EMPLOYEE_JOBS.find(job=>jobKey(job)===jobKey(value))??null;
export function employeePermissions(employee){
  const role=canonicalJob(employee.role);
  const manage=['Inhaber','Manager'].includes(role),security=['Security','Security Leitung'].includes(role);
  return {manage,cashier:manage||!security,entrance:manage||security};
}
export const withPermissions=employee=>({...employee,permissions:employeePermissions(employee)});

export async function initializePermissions(db){
  await db.query(`CREATE TABLE IF NOT EXISTS permission_settings (
    id INTEGER PRIMARY KEY CHECK (id=1), owner_assigned BOOLEAN NOT NULL DEFAULT FALSE
  ); INSERT INTO permission_settings(id) VALUES(1) ON CONFLICT DO NOTHING;`);
  await db.query("ALTER TABLE employees ALTER COLUMN role SET DEFAULT 'Barkeeper'");
  await db.transaction(async tx=>{
    const {rows}=await tx.query('SELECT owner_assigned FROM permission_settings WHERE id=1 FOR UPDATE');
    const migration=await tx.query("SELECT id FROM schema_migrations WHERE id='fixed-employee-jobs-v1'");
    if(!migration.rows.length){
      const employees=await tx.query('SELECT id,role FROM employees ORDER BY id FOR UPDATE');
      for(const employee of employees.rows){
        const job=canonicalJob(employee.role)||'Barkeeper';
        if(job!==employee.role)await tx.query('UPDATE employees SET role=$2 WHERE id=$1',[employee.id,job]);
      }
      await tx.query("INSERT INTO schema_migrations(id) VALUES('fixed-employee-jobs-v1')");
    }
    if(rows[0].owner_assigned)return;
    const assigned=await tx.query("UPDATE employees SET role='Inhaber' WHERE name_key=$1 RETURNING id",[INITIAL_OWNER_NAME_KEY]);
    if(assigned.rows.length)await tx.query('UPDATE permission_settings SET owner_assigned=TRUE WHERE id=1');
  });
}
export async function assignInitialOwner(tx,nameKey,employee){
  if(nameKey!==INITIAL_OWNER_NAME_KEY)return employee;
  const {rows}=await tx.query('SELECT owner_assigned FROM permission_settings WHERE id=1');
  if(rows[0].owner_assigned)return employee;
  await tx.query("UPDATE employees SET role='Inhaber' WHERE id=$1",[employee.id]);
  await tx.query('UPDATE permission_settings SET owner_assigned=TRUE WHERE id=1');
  return {...employee,role:'Inhaber'};
}
export async function protectLastManager(tx,employee,next,fail){
  const wasManager=employee.active&&!employee.removed_at&&employeePermissions(employee).manage;
  const willBeManager=next.active&&!next.removed_at&&employeePermissions(next).manage;
  if(!wasManager||willBeManager)return;
  const {rows}=await tx.query('SELECT role FROM employees WHERE active=TRUE AND removed_at IS NULL');
  if(rows.filter(employee=>employeePermissions(employee).manage).length<=1)fail(409,'Mindestens ein aktiver Inhaber oder Manager muss erhalten bleiben. Bitte zuerst einer anderen Person diese Rolle zuweisen.');
}
export function enforcePermissions(req,res,next){
  const permissions=employeePermissions(req.employee);
  req.employee=withPermissions(req.employee);
  if(permissions.manage)return next();
  const route=req.path,read=req.method==='GET';
  if(read&&['/me','/events'].includes(route)||req.method==='POST'&&route==='/logout')return next();
  if(permissions.cashier&&(read&&route==='/products'&&req.query.all!=='true'||read&&route==='/cashier-summary'||req.method==='POST'&&route==='/orders'||read&&/^\/orders\/[0-9a-f-]{36}$/i.test(route)||req.method==='POST'&&/^\/orders\/[0-9a-f-]{36}\/void$/i.test(route)))return next();
  if(permissions.entrance&&(read&&route==='/admissions'||req.method==='POST'&&route==='/admissions'||read&&/^\/admissions\/[0-9a-f-]{36}$/i.test(route)||req.method==='POST'&&/^\/admissions\/[0-9a-f-]{36}\/void$/i.test(route)))return next();
  return res.status(403).json({error:'Deine Rolle hat für diese Funktion keine Berechtigung.',code:'ROLE_FORBIDDEN',employee:req.employee});
}
