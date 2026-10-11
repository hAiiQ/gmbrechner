export class ConfigurationError extends Error {
  constructor(problems) {
    super(`Die Kasse kann mit diesen Einstellungen nicht starten:\n${problems.map(problem => `- ${problem}`).join('\n')}\nIn Render: gentlemans-bar-kasse → Environment. Werte korrigieren, speichern und erneut deployen.`);
    this.name = 'ConfigurationError';
  }
}

export function loadConfiguration(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const databaseUrl = (env.DATABASE_URL || '').trim();
  const accessCode = env.BAR_ACCESS_CODE || '';
  // Beim Kopieren in Render werden manchmal Leerzeichen um die PIN eingefügt.
  const configuredPin = (env.ADMIN_PIN || '').trim();
  const problems = [];

  if (production) {
    if (!databaseUrl) {
      problems.push('DATABASE_URL fehlt. Die Internal Database URL von gentlemans-bar-db eintragen oder die Blueprint-Datenbankverbindung prüfen.');
    } else {
      try {
        const url = new URL(databaseUrl);
        if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) throw new Error();
      } catch {
        problems.push('DATABASE_URL ist ungültig. Die vollständige PostgreSQL-Verbindungsadresse aus Render verwenden.');
      }
    }
    if (!accessCode) {
      problems.push('BAR_ACCESS_CODE fehlt. Einen eigenen Zugangscode mit mindestens 4 Zeichen setzen.');
    } else if (accessCode.trim().length < 4) {
      problems.push('BAR_ACCESS_CODE ist zu kurz. Mindestens 4 Zeichen ohne umgebende Leerzeichen verwenden.');
    }
    if (!configuredPin) {
      problems.push('ADMIN_PIN fehlt. Eine eigene Verwaltungs-PIN mit 4–12 Ziffern setzen.');
    } else if (!/^\d{4,12}$/.test(configuredPin)) {
      problems.push('ADMIN_PIN ist ungültig. Nur 4–12 Ziffern verwenden, ohne Buchstaben oder Sonderzeichen.');
    }
  }

  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    problems.push('PORT ist ungültig. Eine ganze Zahl zwischen 1 und 65535 verwenden.');
  }
  if (problems.length) throw new ConfigurationError(problems);

  return {
    production,
    databaseUrl,
    accessCode,
    adminPin: configuredPin || '2007',
    port,
    dataDirectory: env.DATA_DIR || './data',
  };
}
