import { describe, expect, it, vi } from 'vitest';
import type { ReportingRepository } from '../../src/repositories/reporting-repository.js';
import { ReportingService } from '../../src/services/reporting-service.js';

describe('ReportingService', () => {
  it('calculates pagination metadata', async () => {
    const repository: ReportingRepository = {
      listCommissions: vi.fn().mockResolvedValue({
        items: [],
        totalItems: 26,
      }),
      getPeriodSummaryAggregates: vi.fn(),
    };
    const service = new ReportingService(repository);

    const result = await service.listCommissions({ page: 2, pageSize: 10 });

    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 10,
      totalItems: 26,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('fills missing summary categories with zeroes', async () => {
    const repository: ReportingRepository = {
      listCommissions: vi.fn(),
      getPeriodSummaryAggregates: vi.fn().mockResolvedValue([
        {
          dimension: 'overall',
          key: 'all',
          count: '1',
          amountCents: '500000',
        },
        {
          dimension: 'status',
          key: 'finalized',
          count: '1',
          amountCents: '500000',
        },
        {
          dimension: 'party_type',
          key: 'team_member',
          count: '1',
          amountCents: '300000',
        },
      ]),
    };
    const service = new ReportingService(repository);

    const result = await service.getPeriodSummary({
      from: '2025-01-01',
      to: '2025-01-31',
    });

    expect(result).toMatchObject({
      commissionCount: 1,
      totalGciCents: '500000',
      byStatus: {
        draft: { commissionCount: 0, totalGciCents: '0' },
        pending_approval: { commissionCount: 0, totalGciCents: '0' },
        approved: { commissionCount: 0, totalGciCents: '0' },
        finalized: { commissionCount: 1, totalGciCents: '500000' },
      },
      byPartyType: {
        team_member: { allocationCount: 1, totalAmountCents: '300000' },
        external_agent: { allocationCount: 0, totalAmountCents: '0' },
        brokerage: { allocationCount: 0, totalAmountCents: '0' },
      },
    });
  });
});
