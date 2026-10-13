import {protectLastManager} from './permissions.js';
export function registerEmployees(app,db,{fail,clean,uuid,accessVersion}){
  const employeeId=req=>{
    if(!uuid(req.params.id))fail(400,'Ungültige Mitarbeiternummer.');
    return req.params.id;
  };
  const lockEmployee=async(tx,id)=>{
    const {rows}=await tx.query('SELECT id,name,role,department,active,removed_at FROM employees WHERE id=$1 FOR UPDATE',[id]);
    if(!rows.length)fail(404,'Mitarbeiter nicht gefunden.');
    return rows[0];
  };
  app.get('/api/employees',async(req,res)=>{
    const {rows}=await db.query(`SELECT e.id,e.name,e.role,e.department,e.active,e.created_at,e.last_login_at,e.deactivated_at,e.removed_at,e.removed_by,
      (SELECT COUNT(*)::int FROM sessions s WHERE s.employee_id=e.id AND s.expires_at>NOW() AND s.access_version=$1 AND e.active=TRUE AND e.removed_at IS NULL) AS session_count,
      COALESCE(a.balance_cents,0)::text AS cash_cents
      FROM employees e LEFT JOIN wallet_accounts a ON a.employee_id=e.id
      WHERE ($2::boolean OR e.removed_at IS NULL)
      ORDER BY e.active DESC,LOWER(e.name),e.id`,[accessVersion,req.query.include_removed==='true']);
    res.json({employees:rows});
  });
  app.put('/api/employees/:id',async(req,res)=>{
    const id=employeeId(req),role=clean(req.body.role,60,'Rolle / Funktion');
    const department=clean(req.body.department,80,'Abteilung',0);
    const employee=await db.transaction(async tx=>{
      await tx.query('SELECT id FROM permission_settings WHERE id=1 FOR UPDATE');
      const previous=await lockEmployee(tx,id);
      if(previous.removed_at)fail(404,'Mitarbeiter nicht gefunden.');
      await protectLastManager(tx,previous,{...previous,role},fail);
      return (await tx.query('UPDATE employees SET role=$2,department=$3 WHERE id=$1 RETURNING id,name,role,department,active',[id,role,department])).rows[0];
    });
    res.json({employee});
  });
  app.post('/api/employees/:id/sessions/end',async(req,res)=>{
    const id=employeeId(req);
    const sessionCount=await db.transaction(async tx=>{
      await lockEmployee(tx,id);
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
      await protectLastManager(tx,previous,{...previous,active:false},fail);
      const {rows}=await tx.query(`UPDATE employees SET active=FALSE,
        removed_at=COALESCE(removed_at,NOW()),removed_by=COALESCE(removed_by,$2),
        deactivated_at=COALESCE(deactivated_at,NOW()) WHERE id=$1
        RETURNING id,name,role,department,active,removed_at`,[id,req.employee.id]);
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
      if(!previous.removed_at)return previous;
      const {rows}=await tx.query(`UPDATE employees SET removed_at=NULL,removed_by=NULL,active=TRUE,deactivated_at=NULL
        WHERE id=$1 RETURNING id,name,role,department,active,removed_at`,[id]);
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
      if(previous.removed_at)fail(409,'Dieser Mitarbeiter wurde entfernt. Bitte zuerst wiederherstellen.');
      await protectLastManager(tx,previous,{...previous,active},fail);
      const {rows}=await tx.query(`UPDATE employees SET active=$2,
        deactivated_at=CASE WHEN $2 THEN NULL ELSE COALESCE(deactivated_at,NOW()) END
        WHERE id=$1 RETURNING id,name,role,department,active`,[id,active]);
      if(!active)await tx.query('DELETE FROM sessions WHERE employee_id=$1',[id]);
      return rows[0];
    });
    res.json({employee});
  });
}
