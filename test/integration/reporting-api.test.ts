import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Express } from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import type {
  ListCommissionsResponse,
  PeriodSummaryResponse,
} from '../../src/domain/reporting.js';
import { PostgresReportingRepository } from '../../src/repositories/postgres-reporting-repository.js';
import { ReportingService } from '../../src/services/reporting-service.js';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://commissions:commissions@localhost:5433/commissions_test';

describe('reporting API with PostgreSQL', () => {
  let pool: Pool;
  let app: Express;

  beforeAll(async () => {
    assertSafeTestDatabase(TEST_DATABASE_URL);
    pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 2 });

    const seedSql = await readFile(resolve(process.cwd(), 'db/init.sql'), 'utf8');
    await pool.query(seedSql);

    const repository = new PostgresReportingRepository(pool);
    const reportingService = new ReportingService(repository);
    app = buildApp({
      reportingService,
      logger: { error: () => undefined },
    });
  });

  afterAll(async () => {
    await pool.end();
  });

  it('filters commissions and returns every allocation without a follow-up request', async () => {
    const response = await request(app).get(
      '/v1/commissions' +
        '?teamId=a1a1a1a1-0000-4000-8000-000000000001' +
        '&status=finalized&from=2025-03-01&to=2025-03-31&pageSize=1',
    );
    const body = response.body as ListCommissionsResponse;

    expect(response.status).toBe(200);
    expect(body.pagination).toEqual({
      page: 1,
      pageSize: 1,
      totalItems: 2,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    });
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: '10000000-0000-4000-8000-000000000012',
      status: 'finalized',
      closeDate: '2025-03-12',
      totalCents: '620000',
      currency: 'USD',
      allocations: [
        {
          partyType: 'team_member',
          percentage: '0.6000',
          amountCents: '372000',
        },
        {
          partyType: 'brokerage',
          percentage: '0.4000',
          amountCents: '248000',
        },
      ],
    });
  });

  it('paginates in deterministic close-date order', async () => {
    const response = await request(app).get(
      '/v1/commissions?from=2025-03-01&to=2025-03-31&page=2&pageSize=2',
    );
    const body = response.body as ListCommissionsResponse;

    expect(response.status).toBe(200);
    expect(body.pagination).toMatchObject({
      page: 2,
      pageSize: 2,
      totalItems: 9,
      totalPages: 5,
    });
    expect(body.items.map((item) => item.id)).toEqual([
      '10000000-0000-4000-8000-000000000014',
      '10000000-0000-4000-8000-000000000017',
    ]);
  });

  it('returns exact March totals and breakdowns', async () => {
    const response = await request(app).get(
      '/v1/reports/period-summary?from=2025-03-01&to=2025-03-31',
    );
    const body = response.body as PeriodSummaryResponse;

    expect(response.status).toBe(200);
    expect(body).toEqual({
      period: { from: '2025-03-01', to: '2025-03-31', teamId: null },
      commissionCount: 9,
      totalGciCents: '5220000',
      byStatus: {
        draft: { commissionCount: 2, totalGciCents: '650000' },
        pending_approval: { commissionCount: 1, totalGciCents: '400000' },
        approved: { commissionCount: 2, totalGciCents: '930000' },
        finalized: { commissionCount: 4, totalGciCents: '3240000' },
      },
      byPartyType: {
        team_member: { allocationCount: 9, totalAmountCents: '2815500' },
        external_agent: { allocationCount: 5, totalAmountCents: '1051000' },
        brokerage: { allocationCount: 9, totalAmountCents: '1353500' },
      },
    });
  });

  it('applies the team filter to the summary', async () => {
    const response = await request(app).get(
      '/v1/reports/period-summary?from=2025-03-01&to=2025-03-31' +
        '&teamId=a1a1a1a1-0000-4000-8000-000000000001',
    );
    const body = response.body as PeriodSummaryResponse;

    expect(response.status).toBe(200);
    expect(body.commissionCount).toBe(5);
    expect(body.totalGciCents).toBe('2850000');
    expect(body.byPartyType.external_agent).toEqual({
      allocationCount: 3,
      totalAmountCents: '520000',
    });
  });

  it('returns a complete zero-filled summary for an empty period', async () => {
    const response = await request(app).get(
      '/v1/reports/period-summary?from=2026-01-01&to=2026-01-31',
    );
    const body = response.body as PeriodSummaryResponse;

    expect(response.status).toBe(200);
    expect(body.commissionCount).toBe(0);
    expect(body.totalGciCents).toBe('0');
    expect(Object.values(body.byStatus)).toEqual([
      { commissionCount: 0, totalGciCents: '0' },
      { commissionCount: 0, totalGciCents: '0' },
      { commissionCount: 0, totalGciCents: '0' },
      { commissionCount: 0, totalGciCents: '0' },
    ]);
    expect(Object.values(body.byPartyType)).toEqual([
      { allocationCount: 0, totalAmountCents: '0' },
      { allocationCount: 0, totalAmountCents: '0' },
      { allocationCount: 0, totalAmountCents: '0' },
    ]);
  });

  it('zero-fills an absent status without losing non-empty period totals', async () => {
    const response = await request(app).get(
      '/v1/reports/period-summary?from=2025-02-01&to=2025-02-28',
    );
    const body = response.body as PeriodSummaryResponse;

    expect(response.status).toBe(200);
    expect(body.commissionCount).toBe(5);
    expect(body.totalGciCents).toBe('2930000');
    expect(body.byStatus.draft).toEqual({
      commissionCount: 0,
      totalGciCents: '0',
    });
    expect(body.byStatus.finalized).toEqual({
      commissionCount: 2,
      totalGciCents: '1600000',
    });
  });

  it('uses the same JSON error contract for validation and missing routes', async () => {
    const invalidResponse = await request(app).get(
      '/v1/reports/period-summary?from=2025-04-01&to=2025-03-01',
    );
    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body).toEqual({
      code: 'INVALID_QUERY',
      message: 'from must be on or before to',
      details: { field: 'dateRange' },
    });

    const missingResponse = await request(app).get('/not-a-route');
    expect(missingResponse.status).toBe(404);
    expect(missingResponse.body).toEqual({
      code: 'NOT_FOUND',
      message: 'Route not found',
    });
  });
});

function assertSafeTestDatabase(connectionString: string): void {
  const databaseName = decodeURIComponent(new URL(connectionString).pathname.slice(1));

  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to reset database "${databaseName}" because its name does not end in _test`,
    );
  }
}
