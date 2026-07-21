# Commission Reporting API

A read-only Express and PostgreSQL service for browsing commission transactions and producing period summaries for Finance. It targets Node.js 18+ and uses strict TypeScript.

## Run locally

Prerequisites: Node.js 18 or newer, npm, Docker, and Docker Compose.

```bash
docker compose up -d --wait
npm install
npm run dev
```

The API listens on `http://localhost:3000` by default. `GET /health` returns a basic process health response. Environment defaults are listed in `.env.example`; the service reads `DATABASE_URL`, `HOST`, and `PORT` directly from the process environment.

For a production-style build:

```bash
npm run build
npm start
```

If the main `pgdata` volume was created before a schema change, recreate it with `docker compose down -v` followed by `docker compose up -d --wait`. This deletes local container data and reloads the provided seed.

## API design

Both reporting operations are `GET` endpoints because they are read-only, safe, and idempotent. Transaction browsing and summary reporting use separate resource paths because they have different filters, response shapes, and performance characteristics; overloading one endpoint would make its contract harder to understand. Dates are ISO calendar dates and both range boundaries are inclusive.

### Browse commission details

```http
GET /v1/commissions?teamId=<uuid>&status=finalized&from=2025-03-01&to=2025-03-31&page=1&pageSize=25
```

Every filter is optional:

- `teamId`: one team UUID
- `status`: `draft`, `pending_approval`, `approved`, or `finalized`
- `from` / `to`: independent inclusive close-date bounds in `YYYY-MM-DD` format
- `page`: positive page number, default `1`, maximum `1000000`
- `pageSize`: default `25`, maximum `100`

Results are ordered by `closeDate DESC, id DESC`, which makes page ordering deterministic even when two commissions close on the same day. The response includes each commission's complete allocation array and pagination metadata:

```json
{
  "items": [
    {
      "id": "10000000-0000-4000-8000-000000000012",
      "teamId": "a1a1a1a1-0000-4000-8000-000000000001",
      "status": "finalized",
      "closeDate": "2025-03-12",
      "totalCents": "620000",
      "currency": "USD",
      "createdAt": "2025-03-10T09:00:00.000Z",
      "updatedAt": "2025-03-12T11:00:00.000Z",
      "allocations": [
        {
          "id": "20000000-0012-4000-8000-000000000001",
          "commissionId": "10000000-0000-4000-8000-000000000012",
          "partyId": "d4d4d4d4-0000-4000-8000-000000000002",
          "partyType": "team_member",
          "percentage": "0.6000",
          "amountCents": "372000",
          "createdAt": "2025-03-10T09:00:00.000Z"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "totalItems": 2,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

### Period summary

```http
GET /v1/reports/period-summary?from=2025-03-01&to=2025-03-31&teamId=<optional-uuid>
```

`from` and `to` are required. `teamId` is optional; omitting it summarizes all teams. The response contains overall commission count and GCI, then complete maps for every status and executable-schema party type. Missing categories and entirely empty periods return zero values.

```json
{
  "period": {
    "from": "2025-03-01",
    "to": "2025-03-31",
    "teamId": null
  },
  "commissionCount": 9,
  "totalGciCents": "5220000",
  "byStatus": {
    "draft": { "commissionCount": 2, "totalGciCents": "650000" },
    "pending_approval": { "commissionCount": 1, "totalGciCents": "400000" },
    "approved": { "commissionCount": 2, "totalGciCents": "930000" },
    "finalized": { "commissionCount": 4, "totalGciCents": "3240000" }
  },
  "byPartyType": {
    "team_member": { "allocationCount": 9, "totalAmountCents": "2815500" },
    "external_agent": { "allocationCount": 5, "totalAmountCents": "1051000" },
    "brokerage": { "allocationCount": 9, "totalAmountCents": "1353500" }
  }
}
```

All cent values are JSON strings containing base-10 integers. PostgreSQL `BIGINT` can exceed JavaScript's safe integer range, so serializing cents as JSON numbers would eventually lose money precision. Counts are JSON numbers after an explicit safe-integer check. `percentage` is also a string because it comes from PostgreSQL `NUMERIC`; the service never uses floating-point arithmetic for money.

Invalid input uses HTTP `400`; unknown routes use `404`; unexpected failures use `500` without exposing internals. Error responses have one consistent shape:

```json
{
  "code": "INVALID_QUERY",
  "message": "from must be on or before to",
  "details": { "field": "dateRange" }
}
```

Unknown query parameters and repeated parameters are rejected so typos cannot silently produce misleading financial reports.

## Query approach and indexes

Raw SQL was chosen over an ORM query builder because these are read-only, aggregation-heavy reporting queries and the supplied schema does not need entity lifecycle or persistence behavior. Keeping the SQL parameterized and isolated behind a repository interface makes the query plan visible while preserving separation from the HTTP and business layers.

The detail operation uses two queries regardless of page size: one materialized CTE obtains the filtered count and deterministic page, and one `WHERE commission_id = ANY($1::uuid[])` query fetches allocations for all commissions on that page. Allocations are grouped in memory. This avoids both N+1 queries and the row multiplication that makes pagination over a direct commission/allocation join error-prone.

The summary uses one SQL statement. A filtered commission CTE is reused by three `UNION ALL` aggregates: overall totals, status totals, and allocation totals by party type. The service fills enum categories absent from grouped SQL results with zeroes. All filters are parameterized.

`db/init.sql` adds these reporting indexes:

- `(close_date DESC, id DESC)` supports unscoped period scans and result ordering.
- `(team_id, close_date DESC, id DESC)` supports team-period reports.
- `(status, close_date DESC, id DESC)` supports status-period browsing.
- `allocations (commission_id)` supports the foreign-key join and batched allocation lookup. PostgreSQL does not automatically index referencing foreign-key columns.

The small seed does not need these indexes for speed, but they represent the expected production access paths. A combined `(team_id, status, close_date)` index was not added because it overlaps heavily and helps only the request shape where both optional filters are present; production query statistics should justify that extra write/storage cost.

## Tests

Compose starts an isolated `commissions_test` PostgreSQL database on port `5433`. The integration suite refuses to reset a database whose name does not end in `_test`, then reapplies `db/init.sql` before testing so assertions always use known data.

```bash
docker compose up -d --wait test-db
npm test
```

Additional commands:

```bash
npm run test:unit
npm run test:integration
npm run typecheck
npm run build
```

Unit tests cover query parsing, invalid dates/ranges/enums/pagination, pagination metadata, and zero-filling. Integration tests use Supertest over the real repository and real PostgreSQL database; they assert exact filtered transactions, allocations, ordering, known March aggregates, team scoping, empty periods, and error contracts. The database layer is not mocked in integration tests.

Set `TEST_DATABASE_URL` to use another isolated test database. Its database name must end with `_test` because the suite drops and recreates the seeded tables.

## Assumptions and trade-offs

- `db/init.sql` is authoritative when it differs from the prose. `ASSIGNMENT.md` mentions a `team` party type, but the database constraint and seed permit only `team_member`, `external_agent`, and `brokerage`; those three form the API enum.
- Express 5 was chosen from the two permitted HTTP frameworks. It supports the assignment's Node 18 floor; the current Fastify major requires Node 20, while the Node-18-compatible Fastify major has unresolved security advisories. This keeps both runtime compatibility and a clean production dependency audit.
- The supplied data uses one currency (`USD`). Summing unlike currencies would be invalid; a production multi-currency version should require a currency or return one summary per currency.
- Page-based pagination is easy for Finance users to navigate and exposes total pages. Cursor pagination would scale better and be more stable during concurrent writes, but this is a read-only month-end dataset and Finance needs totals, so offset pagination is the simpler fit.
- The API supports one status per detail request. Multi-status filtering can be added if a dashboard workflow needs it; a single value keeps validation and URLs straightforward for the stated requirement.
- Authentication and team-level authorization are assumed to be enforced by an upstream/internal platform because they are outside this exercise. The API must not be exposed publicly as written.

## With more time

I would add OpenAPI generation, authentication/authorization, request IDs and metrics, currency-aware summary groups, cursor pagination for very large result sets, migration tooling instead of bootstrap-only SQL, containerize the API for a one-command full stack, and run PostgreSQL-backed tests in CI across Node 18 and the current LTS release.
