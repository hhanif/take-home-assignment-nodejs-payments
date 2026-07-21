import type { Server } from 'node:http';
import { Pool } from 'pg';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { PostgresReportingRepository } from './repositories/postgres-reporting-repository.js';
import { ReportingService } from './services/reporting-service.js';

const config = loadConfig();
const pool = new Pool({ connectionString: config.databaseUrl });
const repository = new PostgresReportingRepository(pool);
const reportingService = new ReportingService(repository);
const app = buildApp({ reportingService });

let server: Server | undefined;
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.info({ signal }, 'Shutting down');

  try {
    if (server !== undefined) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => {
          if (error === undefined) {
            resolve();
          } else {
            reject(error);
          }
        });
      });
    }
  } finally {
    await pool.end();
  }
}

process.once('SIGINT', () => {
  void shutdown('SIGINT').catch(handleShutdownError);
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM').catch(handleShutdownError);
});

function handleShutdownError(error: unknown): void {
  console.error('Failed to shut down cleanly', error);
  process.exitCode = 1;
}

try {
  await pool.query('SELECT 1');
  await new Promise<void>((resolve, reject) => {
    server = app.listen(config.port, config.host, (error?: Error) => {
      if (error === undefined) {
        resolve();
      } else {
        reject(error);
      }
    });
    server.once('error', reject);
  });
  console.info(`Commission Reporting API listening on ${config.host}:${config.port}`);
} catch (error) {
  console.error('Failed to start service', error);
  await pool.end();
  process.exitCode = 1;
}
