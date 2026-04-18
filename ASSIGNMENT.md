# Take-Home Assignment — Reporting Endpoints

# Introduction

Hi there 👋,

Thank you for completing this brief take-home assignment. Your time and effort are greatly appreciated. Please timebox your effort to a maximum of 4 hours.

The purpose of this exercise is to evaluate your backend skills in Node.js, SQL, and testing. Please note that you may make assumptions, simplifications, or other changes to the problems, but please state them clearly in your write-up when you submit this assignment. Please feel free to use libraries as appropriate, as there is no need to reinvent the wheel.

Before starting, please review the instructions carefully.

**Good luck 😉**

---

## Context

You're joining the Payments Engineering team at a real estate brokerage. Each month, Finance needs to review commission activity across the team: which transactions closed, how the commissions were split, and aggregate totals by status and party type.

For this exercise, you'll build a reporting API on top of a pre-seeded database. The database already has data in it — your job is to query it correctly, expose it through a clean API, and write tests to prove it works.

**These requirements are intentionally underspecified.** We're giving you the business need and the schema, but leaving the API design up to you — how many endpoints, what filters to support, what the responses look like, and how you handle edge cases. There isn't one right answer. We want to see how you think through ambiguity and make reasonable choices, not how well you follow a spec.

---

## What You're Working With

The database is pre-seeded with two tables. You do not need to build anything that writes to these tables — this is a read-only reporting exercise.

The schema and seed data are provided in `db/init.sql`. Running `docker compose up` will create the tables and populate them automatically.

**`commissions` table:**
```sql
commissions (
  id          UUID PRIMARY KEY,
  team_id     UUID NOT NULL,
  status      VARCHAR(30) NOT NULL,   -- 'draft' | 'pending_approval' | 'approved' | 'finalized'
  close_date  DATE NOT NULL,
  total_cents BIGINT NOT NULL,        -- GCI in cents
  currency    VARCHAR(3) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL
)
```

**`allocations` table:**
```sql
allocations (
  id            UUID PRIMARY KEY,
  commission_id UUID NOT NULL REFERENCES commissions(id),
  party_id      UUID NOT NULL,
  party_type    VARCHAR(30) NOT NULL,  -- 'team_member' | 'team' | 'external_agent' | 'brokerage' 
  percentage    NUMERIC(6,4) NOT NULL, -- e.g. 0.6000 = 60%
  amount_cents  BIGINT NOT NULL,       -- pre-calculated: total_cents * percentage
  created_at    TIMESTAMPTZ NOT NULL
)
```

---

## What to Build

### Reporting API (Required)

Finance needs two things from this API:

1. **Transaction detail** — A way to browse individual commissions with their allocation breakdowns. Finance needs to filter by team, status, and date range, and the list needs to be paginated. Each commission should include its allocations — Finance shouldn't have to make a separate request per commission to see the splits.

2. **Period summary** — A way to get aggregate numbers for a given time period: how many commissions, total GCI, and breakdowns by status and by party type. This powers their month-end reporting dashboard. A period with no matching data should return zeros, not an error.

**Design decisions that are up to you:**
- How many endpoints, what paths, what HTTP methods
- What the request parameters and response shapes look like
- How you handle pagination details (page-based, cursor-based, etc.)
- What error responses look like and what status codes you use
- Whether and how you handle edge cases like invalid date ranges

In your README, explain the API design you chose and why. If you considered alternatives and rejected them, mention that too — we find the reasoning as interesting as the result.

---

### Tests (Required)

Write tests that demonstrate your approach. You choose the scope, the framework (Jest or Vitest), and what to prioritize.

**Requirements:**
- Include both unit tests and integration tests
- Integration tests must run against a real test database — do not mock the database layer
- Seed known data so you can assert exact values, not just "something came back"
- Include a brief README note explaining your query approach, testing strategy, and any indexes you added

---

## Technical Requirements

- **Language:** TypeScript with `strict: true` in `tsconfig.json`
- **Runtime:** Node.js 18+
- **HTTP Framework:** Fastify (preferred) or Express
- **Database:** PostgreSQL — use Docker Compose to make it runnable locally
- **ORM:** TypeORM (preferred) or Knex — raw SQL is also acceptable if well-structured
- **Integration tests:** Must connect to a real test database, not mock the ORM or DB layer
- **Money:** Store and operate in integer cents (`BIGINT`) only — never use floating-point for financial amounts
- **Error responses:** Consistent JSON shape with at minimum `code` and `message` fields

---

## Deliverables

Submit a GitHub repository (public or invite-accessible) with:

1. **Working service** — `docker compose up` should start the database with seed data; `npm run dev` or equivalent should start the API
2. **`npm test`** — runs all tests and exits cleanly
3. **README** with:
   - How to run the service and tests locally
   - Your API design decisions and the reasoning behind them
   - Your query approach and any indexes you added
   - Brief note on your testing strategy
   - What you'd improve with more time
4. **`AI_USAGE.md`** — see the AI Tool Usage Policy below. Required even if you did not use any AI tools (just note that).

---

## What We're Evaluating

| Dimension | What we look at |
|-----------|----------------|
| **Design Judgment** | How you navigated the ambiguity — the choices you made, the alternatives you considered, and how well you articulated your reasoning in the README |
| **API Design** | Whether the API fits the business domain, HTTP semantics, consistent error handling, appropriate status codes |
| **Query Design** | Efficient data fetching (no N+1), correct aggregation, appropriate use of indexes |
| **TypeScript** | Types used meaningfully — not `any`, not bare strings where enums/unions apply |
| **Testing** | Real DB in integration tests, tests for edge cases (not just happy paths), exact value assertions against known seed data |
| **Code Clarity** | Readable without over-engineering — separation between HTTP layer and business logic |

---

## AI Tool Usage Policy

**You are welcome and encouraged to use AI tools** (GitHub Copilot, Claude, ChatGPT, Cursor, or any other) during this assignment. We use AI tools daily on this team and we're interested in how you work with them, not whether you avoid them.

However, we ask for full transparency in your submission:

1. **Commit any agent or skill files you created.** If you used Claude Code with custom agents (`.claude/agents/*.md`) or skills (`.claude/skills/*/SKILL.md`) to scaffold, review, or guide your work, commit those files in your repository. If you used a different tool with a similar concept (Cursor rules, Copilot instructions, etc.), include those as well.

2. **Add an `AI_USAGE.md` file** at the root of your repository describing:
   - Which AI tools you used and for what purpose (e.g., "used Claude to generate the initial schema, reviewed and adjusted the index choices manually")
   - Any suggestions you accepted as-is vs. modified
   - Any suggestions you rejected and why
   - Anything the AI got wrong that you had to correct

There is no right or wrong answer here. Using AI extensively is fine. Using no AI is fine. What we're evaluating is your judgment — whether you understand and can defend the code you're submitting, and whether you can identify when AI output needs correction. We will ask about your AI_USAGE.md directly in the technical deep-dive.

---

## Getting Started

```bash
# Start PostgreSQL with seed data
docker compose up -d

# Install dependencies
npm install

# Start the dev server
npm run dev

# Run tests
npm test
```

The database will be seeded automatically on first run. See `db/init.sql` for the schema and seed data — you can review it to understand the data you're querying against.

---

## Timeline

You have **72 hours** from receipt. A one-time 24-hour extension is available — just let us know.
