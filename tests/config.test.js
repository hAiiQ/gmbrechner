import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { loadConfiguration, ConfigurationError } from '../lib/config.js';

const valid = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://example:private-db-password@localhost:5432/example',
  BAR_ACCESS_CODE: 'private-bar-code',
  ADMIN_PIN: '654321',
  PORT: '10000',
};

test('Render-Konfiguration benennt alle fehlenden Werte, lokale Vorschau funktioniert ohne sie', () => {
  const local=loadConfiguration({});
  assert.equal(local.production,false);
  assert.equal(local.adminPin,'2007');
  assert.equal(local.databaseUrl,'');
  assert.throws(() => loadConfiguration({NODE_ENV:'production'}), error => {
    assert.ok(error instanceof ConfigurationError);
    for (const key of ['DATABASE_URL','BAR_ACCESS_CODE','ADMIN_PIN']) assert.match(error.message,new RegExp(`${key} fehlt`));
    assert.match(error.message,/Environment/);
    return true;
  });
});

test('Gültige Render-Werte und kopierte PIN mit umgebenden Leerzeichen starten ohne Standard-PIN', () => {
  const config=loadConfiguration({...valid,ADMIN_PIN:'  654321  ',DATABASE_URL:` ${valid.DATABASE_URL} `});
  assert.equal(config.adminPin,'654321');
  assert.equal(config.databaseUrl,valid.DATABASE_URL);
  assert.equal(config.accessCode,valid.BAR_ACCESS_CODE);
  assert.equal(config.port,10000);
});

test('Ungültige Zugangswerte bleiben gesperrt, Diagnosen geben keine Geheimnisse aus', () => {
  const cases=[
    ['ADMIN_PIN','letters-are-private'],
    ['ADMIN_PIN','123'],
    ['ADMIN_PIN','1234567890123'],
    ['BAR_ACCESS_CODE','abc'],
    ['BAR_ACCESS_CODE','     '],
    ['DATABASE_URL','https://private-db-password.example'],
    ['DATABASE_URL','private-invalid-address'],
    ['PORT','not-a-port'],
  ];
  for (const [key,value] of cases) {
    assert.throws(() => loadConfiguration({...valid,[key]:value}),error => {
      assert.ok(error instanceof ConfigurationError);
      assert.match(error.message,new RegExp(key));
      for (const secret of ['private-db-password','private-bar-code','letters-are-private','private-invalid-address','654321']) assert.ok(!error.message.includes(secret));
      return true;
    });
  }
});

test('Der Produktionsstart meldet den konkreten Konfigurationsfehler vor einem Datenbankzugriff', () => {
  const result=spawnSync(process.execPath,['server.js'],{
    cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:10000,
    env:{...process.env,...valid,ADMIN_PIN:'',DATABASE_URL:'postgresql://example:private-db-password@127.0.0.1:1/example'},
  });
  assert.equal(result.status,1);
  assert.match(result.stderr,/ADMIN_PIN fehlt/);
  assert.ok(!result.stderr.includes('ECONNREFUSED'));
  assert.ok(!result.stderr.includes('private-db-password'));
  assert.ok(!result.stderr.includes('BAR_ACCESS_CODE fehlt'));
});
