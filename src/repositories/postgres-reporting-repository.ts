import type { Pool, QueryResultRow } from 'pg';
import type {
  Allocation,
  CommissionDetail,
  CommissionPage,
  CommissionStatus,
  ListCommissionsFilters,
  PartyType,
  PeriodSummaryFilters,
  SummaryAggregateRow,
} from '../domain/reporting.js';
import type { ReportingRepository } from './reporting-repository.js';

interface DatabaseCommission {
  id: string;
  teamId: string;
  status: CommissionStatus;
  closeDate: string;
  totalCents: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

interface CommissionPageRow extends QueryResultRow {
  totalCount: string;
  commissions: DatabaseCommission[];
}

interface AllocationRow extends QueryResultRow {
  id: string;
  commissionId: string;
  partyId: string;
  partyType: PartyType;
  percentage: string;
  amountCents: string;
  createdAt: Date | string;
}

interface SummaryRow extends QueryResultRow {
  dimension: SummaryAggregateRow['dimension'];
  key: string;
  count: string;
  amountCents: string;
}

interface FilterValues {
  teamId?: string;
  status?: CommissionStatus;
  from?: string;
  to?: string;
}

interface SqlFilters {
  clause: string;
  parameters: unknown[];
}

export class PostgresReportingRepository implements ReportingRepository {
  constructor(private readonly pool: Pool) {}

  async listCommissions(
    filters: ListCommissionsFilters,
  ): Promise<CommissionPage> {
    const sqlFilters = buildSqlFilters(filters);
    const limitParameter = sqlFilters.parameters.length + 1;
    const offsetParameter = limitParameter + 1;
    const offset = (filters.page - 1) * filters.pageSize;

    const pageResult = await this.pool.query<CommissionPageRow>(
      `
        WITH filtered AS MATERIALIZED (
          SELECT
            id,
            team_id::text AS "teamId",
            status,
            close_date::text AS "closeDate",
            total_cents::text AS "totalCents",
            currency,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM commissions
          ${sqlFilters.clause}
        ),
        paged AS (
          SELECT *
          FROM filtered
          ORDER BY "closeDate" DESC, id DESC
          LIMIT $${limitParameter}::integer
          OFFSET $${offsetParameter}::integer
        )
        SELECT
          (SELECT COUNT(*)::text FROM filtered) AS "totalCount",
          COALESCE(
            (
              SELECT jsonb_agg(
                to_jsonb(paged)
                ORDER BY "closeDate" DESC, id DESC
              )
              FROM paged
            ),
            '[]'::jsonb
          ) AS commissions
      `,
      [...sqlFilters.parameters, filters.pageSize, offset],
    );

    const pageRow = pageResult.rows[0];
    if (pageRow === undefined) {
      throw new Error('Commission page query returned no result row');
    }

    const totalItems = parseSafeCount(pageRow.totalCount);
    const commissionIds = pageRow.commissions.map((commission) => commission.id);

    if (commissionIds.length === 0) {
      return { items: [], totalItems };
    }

    const allocationResult = await this.pool.query<AllocationRow>(
      `
        SELECT
          id,
          commission_id::text AS "commissionId",
          party_id::text AS "partyId",
          party_type AS "partyType",
          percentage::text AS percentage,
          amount_cents::text AS "amountCents",
          created_at AS "createdAt"
        FROM allocations
        WHERE commission_id = ANY($1::uuid[])
        ORDER BY commission_id, created_at, id
      `,
      [commissionIds],
    );

    const allocationsByCommission = new Map<string, Allocation[]>();

    for (const row of allocationResult.rows) {
      const allocation: Allocation = {
        ...row,
        createdAt: toIsoTimestamp(row.createdAt),
      };
      const existing = allocationsByCommission.get(row.commissionId);

      if (existing === undefined) {
        allocationsByCommission.set(row.commissionId, [allocation]);
      } else {
        existing.push(allocation);
      }
    }

    const items: CommissionDetail[] = pageRow.commissions.map((commission) => ({
      ...commission,
      createdAt: toIsoTimestamp(commission.createdAt),
      updatedAt: toIsoTimestamp(commission.updatedAt),
      allocations: allocationsByCommission.get(commission.id) ?? [],
    }));

    return { items, totalItems };
  }

  async getPeriodSummaryAggregates(
    filters: PeriodSummaryFilters,
  ): Promise<SummaryAggregateRow[]> {
    const sqlFilters = buildSqlFilters(filters);
    const result = await this.pool.query<SummaryRow>(
      `
        WITH filtered AS MATERIALIZED (
          SELECT id, status, total_cents
          FROM commissions
          ${sqlFilters.clause}
        )
        SELECT
          'overall'::text AS dimension,
          'all'::text AS key,
          COUNT(*)::text AS count,
          COALESCE(SUM(total_cents), 0)::text AS "amountCents"
        FROM filtered

        UNION ALL

        SELECT
          'status'::text AS dimension,
          status AS key,
          COUNT(*)::text AS count,
          COALESCE(SUM(total_cents), 0)::text AS "amountCents"
        FROM filtered
        GROUP BY status

        UNION ALL

        SELECT
          'party_type'::text AS dimension,
          allocations.party_type AS key,
          COUNT(*)::text AS count,
          COALESCE(SUM(allocations.amount_cents), 0)::text AS "amountCents"
        FROM allocations
        INNER JOIN filtered ON filtered.id = allocations.commission_id
        GROUP BY allocations.party_type
      `,
      sqlFilters.parameters,
    );

    return result.rows;
  }
}

function buildSqlFilters(filters: FilterValues): SqlFilters {
  const conditions: string[] = [];
  const parameters: unknown[] = [];

  const addCondition = (sql: string, value: unknown): void => {
    parameters.push(value);
    conditions.push(sql.replace('?', `$${parameters.length}`));
  };

  if (filters.teamId !== undefined) {
    addCondition('team_id = ?::uuid', filters.teamId);
  }
  if (filters.status !== undefined) {
    addCondition('status = ?::text', filters.status);
  }
  if (filters.from !== undefined) {
    addCondition('close_date >= ?::date', filters.from);
  }
  if (filters.to !== undefined) {
    addCondition('close_date <= ?::date', filters.to);
  }

  return {
    clause: conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`,
    parameters,
  };
}

function parseSafeCount(value: string): number {
  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`Database count is outside JavaScript's safe integer range: ${value}`);
  }

  return parsed;
}

function toIsoTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.valueOf())) {
    throw new Error(`Database returned an invalid timestamp: ${String(value)}`);
  }

  return date.toISOString();
}
