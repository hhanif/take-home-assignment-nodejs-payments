import type {
  CommissionPage,
  ListCommissionsFilters,
  PeriodSummaryFilters,
  SummaryAggregateRow,
} from '../domain/reporting.js';

export interface ReportingRepository {
  listCommissions(filters: ListCommissionsFilters): Promise<CommissionPage>;
  getPeriodSummaryAggregates(
    filters: PeriodSummaryFilters,
  ): Promise<SummaryAggregateRow[]>;
}
