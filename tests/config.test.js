import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { loadConfiguration, ConfigurationError } from '../lib/config.js';

const valid={NODE_ENV:'production',DATABASE_URL:'postgresql://example:private-db-password@localhost:5432/example',PORT:'10000'};

test('Produktionskonfiguration akzeptiert die Render-Datenbank ohne PIN oder Zugangscode',()=>{
  const config=loadConfiguration(valid);
  assert.equal(config.production,true);
  assert.equal(config.databaseUrl,valid.DATABASE_URL);
  assert.equal(config.port,10000);
  assert.equal(loadConfiguration({}).databaseUrl,'');
});

test('Alte oder leere Zugangseinstellungen behindern den Start nicht',()=>{
  for(const previous of [{ADMIN_PIN:'',BAR_ACCESS_CODE:''},{ADMIN_PIN:'ungueltig',BAR_ACCESS_CODE:'x'}]){
    assert.deepEqual(loadConfiguration({...valid,...previous}),loadConfiguration(valid));
  }
});

test('Optionales Bar-Passwort überschreibt den Vorgabewert ohne Offenlegung bei Konfigurationsfehlern',()=>{
  assert.equal(loadConfiguration({...valid,BAR_PASSWORD:'test-password'}).accessPassword,'test-password');
  assert.equal(loadConfiguration({...valid,BAR_PASSWORD:''}).accessPassword,undefined);
  assert.throws(()=>loadConfiguration({...valid,BAR_PASSWORD:'xyz'}),error=>{
    assert.ok(error instanceof ConfigurationError);assert.match(error.message,/BAR_PASSWORD/);assert.ok(!error.message.includes('xyz'));return true;
  });
});

test('Ungültige Datenbank- und Portwerte werden ohne Ausgabe von Geheimnissen erkannt',()=>{
  for(const [key,value] of [['DATABASE_URL',''],['DATABASE_URL','https://private-db-password.example'],['DATABASE_URL','private-invalid-address'],['PORT','not-a-port']]){
    assert.throws(()=>loadConfiguration({...valid,[key]:value}),error=>{
      assert.ok(error instanceof ConfigurationError);assert.match(error.message,new RegExp(key));
      assert.ok(!error.message.includes('private-db-password'));assert.ok(!error.message.includes('private-invalid-address'));
      return true;
    });
  }
});

test('Der Produktionsstart ohne Datenbank meldet nur die fehlende Verbindung',()=>{
  const result=spawnSync(process.execPath,['server.js'],{
    cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:10000,
    env:{...process.env,NODE_ENV:'production',DATABASE_URL:'',ADMIN_PIN:'',BAR_ACCESS_CODE:'',PORT:'10000'},
  });
  assert.equal(result.status,1);
  assert.match(result.stderr,/DATABASE_URL fehlt/);
  assert.ok(!result.stderr.includes('ECONNREFUSED'));
  assert.ok(!result.stderr.includes('private-db-password'));
  assert.ok(!result.stderr.includes('ADMIN_PIN'));
  assert.ok(!result.stderr.includes('BAR_ACCESS_CODE'));
});
