import {randomUUID} from 'node:crypto';
import {berlinDateTime} from './rentals.js';

export async function initializeEvents(db){
  await db.query(`CREATE TABLE IF NOT EXISTS bar_events (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
    starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ,
    created_by TEXT NOT NULL REFERENCES employees(id),
    updated_by TEXT NOT NULL REFERENCES employees(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), revision INTEGER NOT NULL DEFAULT 1,
    deleted_at TIMESTAMPTZ, CHECK (ends_at IS NULL OR ends_at > starts_at)
  );
  CREATE INDEX IF NOT EXISTS bar_events_start_idx ON bar_events(starts_at) WHERE deleted_at IS NULL;`);
}

export function registerEvents(app,db,{fail,clean,uuid}){
  const fields=body=>{
    const title=clean(body.title,100,'Eventname',2),rawDescription=body.description??'';
    if(typeof rawDescription!=='string'||rawDescription.length>2000||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(rawDescription))fail(400,'Beschreibung: höchstens 2.000 Zeichen erlaubt.');
    const description=rawDescription.normalize('NFKC').trim();
    if(description.length>2000)fail(400,'Beschreibung: höchstens 2.000 Zeichen erlaubt.');
    const stamp=(value,label)=>{
      if(typeof value!=='string'||value<'2020-01-01T00:00'||value>'2090-12-31T23:59')fail(400,`${label}: Bitte Datum und Uhrzeit zwischen 2020 und 2090 eingeben.`);
      try{return berlinDateTime(value).toISOString();}catch{fail(400,`${label}: Ungültiges Datum oder eine wegen der Zeitumstellung nicht vorhandene Uhrzeit.`);}
    };
    const starts_at=stamp(body.start,'Beginn'),ends_at=body.end==null||body.end===''?null:stamp(body.end,'Ende');
    if(ends_at&&ends_at<=starts_at)fail(400,'Das Ende muss nach dem Beginn liegen.');
    return {title,description,starts_at,ends_at};
  };
  const values=e=>[e.title,e.description,new Date(e.starts_at).toISOString(),e.ends_at?new Date(e.ends_at).toISOString():null];
  const eventId=req=>{
    if(!uuid(req.params.id))fail(400,'Ungültige Eventnummer.');
    return req.params.id;
  };
  const revision=body=>{
    if(!Number.isInteger(body.revision)||body.revision<1)fail(400,'Bitte die aktuelle Version des Events verwenden.');
    return body.revision;
  };
  app.get('/api/events',async(_req,res)=>{
    const {rows}=await db.query(`SELECT b.*,c.name AS created_by_name,u.name AS updated_by_name
      FROM bar_events b
      JOIN employees c ON c.id=b.created_by JOIN employees u ON u.id=b.updated_by
      WHERE b.deleted_at IS NULL ORDER BY b.starts_at,b.id`);
    res.json({events:rows});
  });
  app.post('/api/events',async(req,res)=>{
    const id=req.body.id??randomUUID();
    if(!uuid(id))fail(400,'Ungültige Eventnummer.');
    const event=fields(req.body);
    const saved=await db.transaction(async tx=>{
      const inserted=await tx.query(`INSERT INTO bar_events
        (id,title,description,starts_at,ends_at,created_by,updated_by)
        VALUES ($1,$2,$3,$4,$5,$6,$6) ON CONFLICT DO NOTHING RETURNING *`,[id,...values(event),req.employee.id]);
      if(inserted.rows.length)return inserted.rows[0];
      const {rows}=await tx.query('SELECT * FROM bar_events WHERE id=$1',[id]),existing=rows[0];
      if(existing.deleted_at||existing.created_by!==req.employee.id||values(event).some((value,index)=>value!==values(existing)[index]))fail(409,'Diese Eventnummer wurde bereits verwendet. Bitte die Eventliste aktualisieren.');
      return existing;
    });
    res.status(201).json({event:saved});
  });
  app.put('/api/events/:id',async(req,res)=>{
    const id=eventId(req),expected=revision(req.body),event=fields(req.body);
    const saved=await db.transaction(async tx=>{
      const {rows}=await tx.query('SELECT * FROM bar_events WHERE id=$1 AND deleted_at IS NULL FOR UPDATE',[id]);
      const previous=rows[0];
      if(!previous)fail(404,'Event nicht gefunden.');
      if(previous.revision!==expected)fail(409,'Dieses Event wurde inzwischen geändert. Bitte die Liste aktualisieren und die Änderungen erneut eintragen.');
      const updated=await tx.query(`UPDATE bar_events SET title=$2,description=$3,starts_at=$4,ends_at=$5,
        updated_by=$6,updated_at=NOW(),revision=revision+1 WHERE id=$1 RETURNING *`,[id,...values(event),req.employee.id]);
      return updated.rows[0];
    });
    res.json({event:saved});
  });
  app.delete('/api/events/:id',async(req,res)=>{
    const id=eventId(req),expected=revision(req.body);
    await db.transaction(async tx=>{
      const {rows}=await tx.query('SELECT revision,deleted_at FROM bar_events WHERE id=$1 FOR UPDATE',[id]);
      if(!rows.length)fail(404,'Event nicht gefunden.');
      if(rows[0].deleted_at)return;
      if(rows[0].revision!==expected)fail(409,'Dieses Event wurde inzwischen geändert. Bitte vor dem Löschen die Liste aktualisieren.');
      await tx.query('UPDATE bar_events SET deleted_at=NOW(),updated_at=NOW(),updated_by=$2,revision=revision+1 WHERE id=$1',[id,req.employee.id]);
    });
    res.json({ok:true});
  });
}
