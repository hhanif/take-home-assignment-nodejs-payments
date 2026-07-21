# AI Tool Usage

OpenAI Codex was used extensively for this assignment. It inspected the assignment, README, Docker Compose file, and complete SQL schema/seed; proposed the API contract; scaffolded the TypeScript service; wrote the parameterized PostgreSQL queries, tests, and documentation; and ran the local verification commands. Codex's installed gstack review workflow was also consulted during the final completeness audit. No repository-local agent or skill files were created, so there are no such files to commit.

## Suggestions accepted as proposed

- Return PostgreSQL `BIGINT` cent values as decimal strings so JSON serialization cannot lose precision.
- Fetch one page of commissions and all of that page's allocations in a constant two-query pattern, avoiding N+1 requests and join-driven pagination errors.
- Produce all summary aggregates in one SQL statement, then zero-fill enum categories missing from grouped results.
- Use deterministic `closeDate DESC, id DESC` pagination and refuse to reset an integration database whose name does not end in `_test`.

## Suggestions modified

- The first scaffold used Fastify 4. It was replaced with Express 5 after `npm audit` found unresolved advisories in the Node-18-compatible Fastify line and the remediated Fastify major proved incompatible with the assignment's Node 18 floor.
- The executable schema's three allowed party types were used instead of inventing support for the prose-only `team` value in `ASSIGNMENT.md`.
- An initial broad-index idea was narrowed to access-path-specific indexes rather than adding every possible composite permutation.

## Suggestions rejected

- Adding TypeORM or Knex was rejected because the service is read-only and its core work is explicit aggregation SQL; an ORM would add indirection without useful entity persistence behavior here.
- Cursor pagination was rejected for this version because Finance benefits from total pages and the supplied reporting dataset is read-only. The README records cursor pagination as a future option for larger, concurrently changing datasets.
- Adding a combined `(team_id, status, close_date)` index was rejected until production query statistics show that the narrower optional-filter combination justifies another overlapping index.

The generated work was reviewed iteratively against every assignment requirement and exercised with strict type checking, unit tests, real-PostgreSQL integration tests, a dependency audit, a production build, and HTTP smoke tests. The initial Fastify dependency choice was the main AI-generated issue discovered and corrected. There are no known uncorrected AI errors at handoff.
