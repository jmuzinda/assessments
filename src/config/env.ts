export function loadEnv(source: NodeJS.ProcessEnv = process.env): {
  port: number;
  databasePath: string;
  jwtSecret: string;
  logLevel: string;
  nodeEnv: string;
} {
  const port = Number(source.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  const nodeEnv = source.NODE_ENV ?? 'development';
  const jwtSecret = source.JWT_SECRET ?? 'dev-only-change-me';
  if (nodeEnv === 'production' && (jwtSecret === 'dev-only-change-me' || jwtSecret.length < 24)) {
    throw new Error('JWT_SECRET must be set to a string of at least 24 characters in production');
  }
  const logLevel = source.LOG_LEVEL ?? 'info';
  return {
    port,
    databasePath: source.DATABASE_PATH ?? './data/helio.db',
    jwtSecret,
    logLevel,
    nodeEnv,
  };
}
