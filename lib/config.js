export class ConfigurationError extends Error {
  constructor(problems) {
    super(`Die Kasse kann mit diesen Einstellungen nicht starten:\n${problems.map(problem => `- ${problem}`).join('\n')}\nIn Render: gentlemans-bar-kasse → Environment. Werte korrigieren, speichern und erneut deployen.`);
    this.name = 'ConfigurationError';
  }
}

export function loadConfiguration(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const databaseUrl = (env.DATABASE_URL || '').trim();
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
  }

  const port = Number(env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    problems.push('PORT ist ungültig. Eine ganze Zahl zwischen 1 und 65535 verwenden.');
  }
  if (problems.length) throw new ConfigurationError(problems);

  return {
    production,
    databaseUrl,
    port,
    dataDirectory: env.DATA_DIR || './data',
  };
}
