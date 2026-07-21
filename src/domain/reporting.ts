export const COMMISSION_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'finalized',
] as const;

export type CommissionStatus = (typeof COMMISSION_STATUSES)[number];

export const PARTY_TYPES = [
  'team_member',
  'external_agent',
  'brokerage',
] as const;

export type PartyType = (typeof PARTY_TYPES)[number];

export interface Allocation {
  id: string;
  commissionId: string;
  partyId: string;
  partyType: PartyType;
  percentage: string;
  amountCents: string;
  createdAt: string;
}

export interface CommissionDetail {
  id: string;
  teamId: string;
  status: CommissionStatus;
  closeDate: string;
  totalCents: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
  allocations: Allocation[];
}

export interface ListCommissionsFilters {
  teamId?: string;
  status?: CommissionStatus;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export interface PeriodSummaryFilters {
  teamId?: string;
  from: string;
  to: string;
}

export interface CommissionPage {
  items: CommissionDetail[];
  totalItems: number;
}

export interface ListCommissionsResponse {
  items: CommissionDetail[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface SummaryAggregateRow {
  dimension: 'overall' | 'status' | 'party_type';
  key: string;
  count: string;
  amountCents: string;
}

export interface PeriodSummaryResponse {
  period: {
    from: string;
    to: string;
    teamId: string | null;
  };
  commissionCount: number;
  totalGciCents: string;
  byStatus: Record<
    CommissionStatus,
    { commissionCount: number; totalGciCents: string }
  >;
  byPartyType: Record<
    PartyType,
    { allocationCount: number; totalAmountCents: string }
  >;
}

export function isCommissionStatus(value: string): value is CommissionStatus {
  return (COMMISSION_STATUSES as readonly string[]).includes(value);
}

export function isPartyType(value: string): value is PartyType {
  return (PARTY_TYPES as readonly string[]).includes(value);
}
