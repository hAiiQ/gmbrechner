import { openDatabase, initializeDatabase } from './lib/database.js';
import { createApp } from './lib/app.js';
import { ConfigurationError, loadConfiguration } from './lib/config.js';

let config;
try {
  config=loadConfiguration();
} catch (error) {
  if (!(error instanceof ConfigurationError)) throw error;
  console.error(error.message);
  process.exit(1);
}
const {production,accessCode,adminPin,port}=config;
const db=await openDatabase({url:config.databaseUrl,directory:config.dataDirectory});
await initializeDatabase(db);
const app=createApp(db,{production,accessCode,adminPin});
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
