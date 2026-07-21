import { describe, expect, it } from 'vitest';
import { ApiError } from '../../src/http/errors.js';
import {
  parseListCommissionsQuery,
  parsePeriodSummaryQuery,
} from '../../src/http/query-validation.js';

describe('commission query validation', () => {
  it('applies list defaults and parses supported filters', () => {
    expect(
      parseListCommissionsQuery({
        teamId: 'a1a1a1a1-0000-4000-8000-000000000001',
        status: 'approved',
        from: '2025-03-01',
        to: '2025-03-31',
      }),
    ).toEqual({
      teamId: 'a1a1a1a1-0000-4000-8000-000000000001',
      status: 'approved',
      from: '2025-03-01',
      to: '2025-03-31',
      page: 1,
      pageSize: 25,
    });
  });

  it('rejects an impossible calendar date', () => {
    expectInvalidQuery(
      () => parseListCommissionsQuery({ from: '2025-02-30' }),
      'from',
    );
  });

  it('rejects reversed date ranges', () => {
    expectInvalidQuery(
      () =>
        parseListCommissionsQuery({
          from: '2025-04-01',
          to: '2025-03-01',
        }),
      'dateRange',
    );
  });

  it('rejects unsupported statuses, duplicate values, and excessive page sizes', () => {
    expectInvalidQuery(
      () => parseListCommissionsQuery({ status: 'paid' }),
      'status',
    );
    expectInvalidQuery(
      () => parseListCommissionsQuery({ status: ['draft', 'approved'] }),
      'status',
    );
    expectInvalidQuery(
      () => parseListCommissionsQuery({ pageSize: '101' }),
      'pageSize',
    );
  });

  it('requires both summary dates and rejects unknown parameters', () => {
    expectInvalidQuery(
      () => parsePeriodSummaryQuery({ from: '2025-03-01' }),
      'to',
    );
    expectInvalidQuery(
      () =>
        parsePeriodSummaryQuery({
          from: '2025-03-01',
          to: '2025-03-31',
          status: 'approved',
        }),
      'status',
    );
  });
});

function expectInvalidQuery(action: () => unknown, field: string): void {
  try {
    action();
    throw new Error('Expected query validation to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      statusCode: 400,
      code: 'INVALID_QUERY',
      details: { field },
    });
  }
}
