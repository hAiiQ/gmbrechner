import { openDatabase, initializeDatabase } from './lib/database.js';
import { createApp } from './lib/app.js';

const production=process.env.NODE_ENV==='production';
const accessCode=process.env.BAR_ACCESS_CODE||'';
const adminPin=process.env.ADMIN_PIN||'2007';
if (production && (!process.env.DATABASE_URL || accessCode.length<4 || !/^\d{4,12}$/.test(process.env.ADMIN_PIN||''))) {
  throw new Error('Auf Render sind DATABASE_URL, BAR_ACCESS_CODE (mindestens 4 Zeichen) und ADMIN_PIN (4–12 Ziffern) erforderlich.');
}
const db=await openDatabase({url:process.env.DATABASE_URL,directory:process.env.DATA_DIR||'./data'});
await initializeDatabase(db);
const app=createApp(db,{production,accessCode,adminPin});
const port=Number(process.env.PORT||3000);
const server=app.listen(port,'0.0.0.0',()=>console.log(`Gentlemans Bar läuft auf http://localhost:${port}`));
let shuttingDown=false;
async function shutdown() {
  if (shuttingDown) return;
  shuttingDown=true;
  server.close(async()=>{await db.close();process.exit(0);});
  setTimeout(()=>process.exit(1),10000).unref();
}
process.on('SIGTERM',shutdown);
process.on('SIGINT',shutdown);
