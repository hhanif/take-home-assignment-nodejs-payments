import {
  isCommissionStatus,
  type ListCommissionsFilters,
  type PeriodSummaryFilters,
} from '../domain/reporting.js';
import { ApiError } from './errors.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const POSITIVE_INTEGER_PATTERN = /^\d+$/;

const LIST_QUERY_KEYS = new Set([
  'teamId',
  'status',
  'from',
  'to',
  'page',
  'pageSize',
]);
const SUMMARY_QUERY_KEYS = new Set(['teamId', 'from', 'to']);

export function parseListCommissionsQuery(
  input: unknown,
): ListCommissionsFilters {
  const query = parseQueryObject(input, LIST_QUERY_KEYS);
  const teamId = parseOptionalUuid(query, 'teamId');
  const statusValue = readOptionalString(query, 'status');
  const from = parseOptionalDate(query, 'from');
  const to = parseOptionalDate(query, 'to');
  const page = parsePositiveInteger(query, 'page', 1, 1_000_000);
  const pageSize = parsePositiveInteger(query, 'pageSize', 25, 100);

  if (statusValue !== undefined && !isCommissionStatus(statusValue)) {
    throw invalidQuery(
      'status',
      'status must be one of draft, pending_approval, approved, or finalized',
    );
  }

  assertDateRange(from, to);

  return {
    ...(teamId === undefined ? {} : { teamId }),
    ...(statusValue === undefined ? {} : { status: statusValue }),
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
    page,
    pageSize,
  };
}

export function parsePeriodSummaryQuery(input: unknown): PeriodSummaryFilters {
  const query = parseQueryObject(input, SUMMARY_QUERY_KEYS);
  const teamId = parseOptionalUuid(query, 'teamId');
  const from = parseRequiredDate(query, 'from');
  const to = parseRequiredDate(query, 'to');

  assertDateRange(from, to);

  return {
    ...(teamId === undefined ? {} : { teamId }),
    from,
    to,
  };
}

function parseQueryObject(
  input: unknown,
  allowedKeys: ReadonlySet<string>,
): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw invalidQuery('query', 'query parameters must be an object');
  }

  const query = input as Record<string, unknown>;
  const unknownKey = Object.keys(query).find((key) => !allowedKeys.has(key));

  if (unknownKey !== undefined) {
    throw invalidQuery(unknownKey, `unknown query parameter: ${unknownKey}`);
  }

  return query;
}

function readOptionalString(
  query: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = query[field];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    throw invalidQuery(field, `${field} must be a non-empty string`);
  }

  return value.trim();
}

function parseOptionalUuid(
  query: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = readOptionalString(query, field);

  if (value !== undefined && !UUID_PATTERN.test(value)) {
    throw invalidQuery(field, `${field} must be a valid UUID`);
  }

  return value;
}

function parseOptionalDate(
  query: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = readOptionalString(query, field);

  if (value !== undefined && !isCalendarDate(value)) {
    throw invalidQuery(field, `${field} must be a valid date in YYYY-MM-DD format`);
  }

  return value;
}

function parseRequiredDate(
  query: Record<string, unknown>,
  field: string,
): string {
  const value = parseOptionalDate(query, field);

  if (value === undefined) {
    throw invalidQuery(field, `${field} is required`);
  }

  return value;
}

function parsePositiveInteger(
  query: Record<string, unknown>,
  field: string,
  defaultValue: number,
  maximum: number,
): number {
  const value = readOptionalString(query, field);

  if (value === undefined) {
    return defaultValue;
  }

  if (!POSITIVE_INTEGER_PATTERN.test(value)) {
    throw invalidQuery(field, `${field} must be a positive integer`);
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw invalidQuery(field, `${field} must be between 1 and ${maximum}`);
  }

  return parsed;
}

function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function assertDateRange(from: string | undefined, to: string | undefined): void {
  if (from !== undefined && to !== undefined && from > to) {
    throw invalidQuery('dateRange', 'from must be on or before to');
  }
}

function invalidQuery(field: string, message: string): ApiError {
  return new ApiError(400, 'INVALID_QUERY', message, { field });
}
