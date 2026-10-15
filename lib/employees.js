import {protectLastManager,EMPLOYEE_JOBS,PERMISSION_OPTIONS,readEmployeeJobs,employeeJobs,employeePermissions,readCustomPermissions,withPermissions} from './permissions.js';
import {closeEmployeeShift} from './payroll.js';
export function registerEmployees(app,db,{fail,clean,uuid,accessVersion}){
  const employeeId=req=>{
    if(!uuid(req.params.id))fail(400,'Ungültige Mitarbeiternummer.');
    return req.params.id;
  };
  const lockEmployee=async(tx,id)=>{
    const {rows}=await tx.query('SELECT id,name,role,roles,custom_permissions,department,active,removed_at FROM employees WHERE id=$1 FOR UPDATE',[id]);
    if(!rows.length)fail(404,'Mitarbeiter nicht gefunden.');
    return rows[0];
  };
  const protectManagement=(req,employee,roles)=>{
    if(!req.employee.permissions.manage&&(employeePermissions(employee).manage||roles?.some(role=>['Inhaber','Manager'].includes(role))))fail(403,'Inhaber und Manager können nur von einem Inhaber oder Manager verwaltet werden.');
  };
  app.get('/api/employees',async(req,res)=>{
    const {rows}=await db.query(`SELECT e.id,e.name,e.role,e.roles,e.custom_permissions,e.department,e.active,e.created_at,e.last_login_at,e.deactivated_at,e.removed_at,e.removed_by,
      (SELECT COUNT(*)::int FROM sessions s WHERE s.employee_id=e.id AND s.expires_at>NOW() AND s.access_version=$1 AND e.active=TRUE AND e.removed_at IS NULL) AS session_count,
      COALESCE(a.balance_cents,0)::text AS cash_cents
      FROM employees e LEFT JOIN wallet_accounts a ON a.employee_id=e.id
      WHERE ($2::boolean OR e.removed_at IS NULL)
      ORDER BY e.active DESC,LOWER(e.name),e.id`,[accessVersion,req.query.include_removed==='true']);
    res.json({employees:rows.map(employee=>({...withPermissions(employee),permission_defaults:employeePermissions({...employee,custom_permissions:null})})),jobs:EMPLOYEE_JOBS,permission_options:PERMISSION_OPTIONS});
  });
  app.put('/api/employees/:id/permissions',async(req,res)=>{
    if(!req.employee.permissions.manage)fail(403,'Nur Inhaber und Manager dürfen Zugriffsrechte einstellen.');
    const id=employeeId(req),permissions=readCustomPermissions(req.body.permissions,fail);
    const employee=await db.transaction(async tx=>{
      await tx.query('SELECT id FROM permission_settings WHERE id=1 FOR UPDATE');
      const actor=(await tx.query('SELECT role,roles,active,removed_at FROM employees WHERE id=$1',[req.employee.id])).rows[0];
      if(!actor?.active||actor.removed_at||!employeePermissions(actor).manage)fail(403,'Nur aktive Inhaber und Manager dürfen Zugriffsrechte einstellen.');
      const previous=await lockEmployee(tx,id);
      if(previous.removed_at)fail(404,'Mitarbeiter nicht gefunden.');
      if(employeePermissions(previous).manage&&permissions!==null)fail(409,'Inhaber und Manager haben immer Vollzugriff.');
      return (await tx.query('UPDATE employees SET custom_permissions=$2 WHERE id=$1 RETURNING id,name,role,roles,custom_permissions,department,active',[id,permissions])).rows[0];
    });
    res.json({employee:withPermissions(employee)});
  });
  app.put('/api/employees/:id',async(req,res)=>{
    const id=employeeId(req),roles=readEmployeeJobs(Object.hasOwn(req.body,'roles')?req.body.roles:[clean(req.body.role,60,'Job')],fail),role=roles[0];
    const department=clean(req.body.department,80,'Abteilung',0);
    const employee=await db.transaction(async tx=>{
      await tx.query('SELECT id FROM permission_settings WHERE id=1 FOR UPDATE');
      const previous=await lockEmployee(tx,id);
      protectManagement(req,previous,roles);
      if(previous.removed_at)fail(404,'Mitarbeiter nicht gefunden.');
      await protectLastManager(tx,previous,{...previous,role,roles},fail);
      // Only management can change access, including indirect changes through ranks.
      const preserveAccess=!req.employee.permissions.manage&&JSON.stringify(employeeJobs(previous))!==JSON.stringify(roles)&&previous.custom_permissions===null;
      const custom=preserveAccess?Object.fromEntries(PERMISSION_OPTIONS.map(({key})=>[key,employeePermissions(previous)[key]])):previous.custom_permissions;
      return (await tx.query('UPDATE employees SET role=$2,department=$3,roles=$4,custom_permissions=$5 WHERE id=$1 RETURNING id,name,role,roles,custom_permissions,department,active',[id,role,department,roles,custom])).rows[0];
    });
    res.json({employee});
  });
  app.post('/api/employees/:id/sessions/end',async(req,res)=>{
    const id=employeeId(req);
    const sessionCount=await db.transaction(async tx=>{
      protectManagement(req,await lockEmployee(tx,id));
      const {rows}=await tx.query('DELETE FROM sessions WHERE employee_id=$1 RETURNING token_hash',[id]);
      return rows.length;
    });
    res.json({ok:true,removed_sessions:sessionCount});
  });
  app.post('/api/employees/:id/kick',async(req,res)=>{
    const id=employeeId(req);
    if(id===req.employee.id)fail(409,'Du kannst dich nicht selbst aus der Mitarbeiterliste entfernen. Bitte einen anderen Mitarbeiter darum bitten.');
    const result=await db.transaction(async tx=>{
      await tx.query('SELECT id FROM permission_settings WHERE id=1 FOR UPDATE');
      const previous=await lockEmployee(tx,id);
      protectManagement(req,previous);
      await protectLastManager(tx,previous,{...previous,active:false},fail);
      await closeEmployeeShift(tx,{employeeId:id,recordedBy:req.employee.id},fail);
      const {rows}=await tx.query(`UPDATE employees SET active=FALSE,
        removed_at=COALESCE(removed_at,NOW()),removed_by=COALESCE(removed_by,$2),
        deactivated_at=COALESCE(deactivated_at,NOW()) WHERE id=$1
        RETURNING id,name,role,roles,department,active,removed_at`,[id,req.employee.id]);
      const sessions=await tx.query('DELETE FROM sessions WHERE employee_id=$1 RETURNING token_hash',[id]);
      return {employee:rows[0],removed_sessions:sessions.rows.length};
    });
    res.json({ok:true,...result});
  });
  app.post('/api/employees/:id/restore',async(req,res)=>{
    const id=employeeId(req);
    const employee=await db.transaction(async tx=>{
      await tx.query('SELECT id FROM permission_settings WHERE id=1 FOR UPDATE');
      const previous=await lockEmployee(tx,id);
      protectManagement(req,previous);
      if(!previous.removed_at)return previous;
      const {rows}=await tx.query(`UPDATE employees SET removed_at=NULL,removed_by=NULL,active=TRUE,deactivated_at=NULL
        WHERE id=$1 RETURNING id,name,role,roles,department,active,removed_at`,[id]);
      await tx.query('DELETE FROM sessions WHERE employee_id=$1',[id]);
      return rows[0];
    });
    res.json({employee});
  });
  app.put('/api/employees/:id/status',async(req,res)=>{
    const id=employeeId(req),active=req.body.active;
    if(typeof active!=='boolean')fail(400,'Mitarbeiterstatus fehlt.');
    if(!active&&id===req.employee.id)fail(409,'Du kannst dich nicht selbst deaktivieren. Bitte einen anderen Mitarbeiter darum bitten.');
    const employee=await db.transaction(async tx=>{
      await tx.query('SELECT id FROM permission_settings WHERE id=1 FOR UPDATE');
      const previous=await lockEmployee(tx,id);
      protectManagement(req,previous);
      if(previous.removed_at)fail(409,'Dieser Mitarbeiter wurde entfernt. Bitte zuerst wiederherstellen.');
      await protectLastManager(tx,previous,{...previous,active},fail);
      if(!active)await closeEmployeeShift(tx,{employeeId:id,recordedBy:req.employee.id},fail);
      const {rows}=await tx.query(`UPDATE employees SET active=$2,
        deactivated_at=CASE WHEN $2 THEN NULL ELSE COALESCE(deactivated_at,NOW()) END
        WHERE id=$1 RETURNING id,name,role,roles,department,active`,[id,active]);
      if(!active)await tx.query('DELETE FROM sessions WHERE employee_id=$1',[id]);
      return rows[0];
    });
    res.json({employee});
  });
}
