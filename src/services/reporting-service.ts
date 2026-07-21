import {
  isCommissionStatus,
  isPartyType,
  type ListCommissionsFilters,
  type ListCommissionsResponse,
  type PeriodSummaryFilters,
  type PeriodSummaryResponse,
} from '../domain/reporting.js';
import type { ReportingRepository } from '../repositories/reporting-repository.js';

export class ReportingService {
  constructor(private readonly repository: ReportingRepository) {}

  async listCommissions(
    filters: ListCommissionsFilters,
  ): Promise<ListCommissionsResponse> {
    const page = await this.repository.listCommissions(filters);
    const totalPages = Math.ceil(page.totalItems / filters.pageSize);

    return {
      items: page.items,
      pagination: {
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems: page.totalItems,
        totalPages,
        hasNextPage: filters.page < totalPages,
        hasPreviousPage: filters.page > 1 && totalPages > 0,
      },
    };
  }

  async getPeriodSummary(
    filters: PeriodSummaryFilters,
  ): Promise<PeriodSummaryResponse> {
    const rows = await this.repository.getPeriodSummaryAggregates(filters);
    const summary: PeriodSummaryResponse = {
      period: {
        from: filters.from,
        to: filters.to,
        teamId: filters.teamId ?? null,
      },
      commissionCount: 0,
      totalGciCents: '0',
      byStatus: {
        draft: { commissionCount: 0, totalGciCents: '0' },
        pending_approval: { commissionCount: 0, totalGciCents: '0' },
        approved: { commissionCount: 0, totalGciCents: '0' },
        finalized: { commissionCount: 0, totalGciCents: '0' },
      },
      byPartyType: {
        team_member: { allocationCount: 0, totalAmountCents: '0' },
        external_agent: { allocationCount: 0, totalAmountCents: '0' },
        brokerage: { allocationCount: 0, totalAmountCents: '0' },
      },
    };

    for (const row of rows) {
      const count = parseSafeCount(row.count);

      if (row.dimension === 'overall') {
        summary.commissionCount = count;
        summary.totalGciCents = row.amountCents;
      } else if (row.dimension === 'status' && isCommissionStatus(row.key)) {
        summary.byStatus[row.key] = {
          commissionCount: count,
          totalGciCents: row.amountCents,
        };
      } else if (row.dimension === 'party_type' && isPartyType(row.key)) {
        summary.byPartyType[row.key] = {
          allocationCount: count,
          totalAmountCents: row.amountCents,
        };
      } else {
        throw new Error(
          `Database returned an unsupported summary category: ${row.dimension}/${row.key}`,
        );
      }
    }

    return summary;
  }
}

function parseSafeCount(value: string): number {
  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Database count is outside JavaScript's safe integer range: ${value}`);
  }

  return parsed;
}
