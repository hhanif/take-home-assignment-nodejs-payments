export interface AppConfig {
  databaseUrl: string;
  host: string;
  port: number;
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
  return {
    databaseUrl:
      environment.DATABASE_URL ??
      'postgresql://commissions:commissions@localhost:5432/commissions',
    host: environment.HOST ?? '0.0.0.0',
    port: parsePort(environment.PORT),
  };
}

function parsePort(value: string | undefined): number {
  if (value === undefined) {
    return 3000;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return port;
}
