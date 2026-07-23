# AI Tool Usage

I used OpenAI Codex as a coding assistant during this assignment. I directed the scope, evaluated the trade-offs, reviewed the resulting implementation, and made the final decisions about what to keep or change. Codex helped accelerate repository analysis, draft portions of the TypeScript service, SQL, tests, and documentation, and automate repeatable verification commands.

I did not treat AI output as authoritative. Suggestions were checked against the assignment, the executable PostgreSQL schema, exact seeded totals, Node.js 18 compatibility, and the required real-database test strategy. Codex's installed gstack review workflow was also consulted during the final completeness audit. I did not create any repository-local agent or skill files.

## Suggestions retained after review

The following design suggestions were retained substantially as proposed after I reviewed and validated them:

- Return PostgreSQL `BIGINT` cent values as decimal strings so JSON serialization cannot lose precision.
- Fetch one page of commissions and all of that page's allocations in a constant two-query pattern, avoiding N+1 requests and join-driven pagination errors.
- Produce the summary aggregates in one SQL statement, then zero-fill enum categories missing from grouped results.
- Use deterministic `closeDate DESC, id DESC` pagination and refuse to reset an integration database whose name does not end in `_test`.

## Suggestions I modified

- The first scaffold used Fastify 4. I changed it to Express 5 after `npm audit` identified unresolved advisories in the Node-18-compatible Fastify line and the remediated Fastify major proved incompatible with the assignment's Node.js 18 floor.
- I treated the executable schema as authoritative and implemented its three allowed party types instead of inventing support for the prose-only `team` value in `ASSIGNMENT.md`.
- I narrowed an initial broad-index proposal to indexes that match the actual reporting access paths rather than adding every possible composite permutation.

## Suggestions I rejected

- I rejected adding TypeORM or Knex because the service is read-only and its core work is explicit aggregation SQL; an ORM would add indirection without useful entity-persistence behavior here.
- I rejected cursor pagination for this version because Finance benefits from total pages and the supplied reporting dataset is read-only. The README records cursor pagination as a future option for larger, concurrently changing datasets.
- I rejected a combined `(team_id, status, close_date)` index until production query statistics show that the narrower optional-filter combination justifies another overlapping index.

## Corrections and verification

The initial Fastify dependency choice was the main AI-generated issue I identified and corrected. I verified the final implementation with strict type checking, a production build, unit tests, real-PostgreSQL integration tests, exact seeded-value assertions, Node.js 18 compatibility, a dependency audit, and HTTP smoke tests. There are no known uncorrected AI-generated issues in the submitted implementation.
