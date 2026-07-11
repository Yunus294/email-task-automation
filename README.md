# email-task-automation

Turns inbound emails into tasks in a multi-tenant CRM. A fake email provider POSTs
incoming emails to a webhook, an LLM decides if the email is an actionable task, and
if it is, a Task gets created for the right company and waits for a human to accept
or reject it.

## Setup

```bash
npm install
cp .env.example .env
# put your OpenAI key into OPENAI_API_KEY in .env
```

You need a MongoDB running (`MONGODB_URI`). If you don't have one, set
`USE_MEMORY_DB=true` in `.env` and the app starts its own in-memory Mongo and seeds
demo data automatically (2 companies, 3 users, api keys get printed on startup).

No OpenAI key at hand? Set `LLM_FAKE=true` and a keyword heuristic is used instead,
so the whole flow still works locally.

## Run

```bash
npm run start:dev
# with a real mongo, seed demo companies/users once:
npm run seed
# simulate the email provider sending 5 emails:
npm run send:emails
```

Swagger is at http://localhost:3000/api/docs

## Endpoints

| Method | Path | Auth | What it does |
|--------|------|------|--------------|
| POST | /webhooks/email | `x-webhook-token` header | receives an inbound email from the provider, returns 202 |
| GET | /tasks?status=&page=&size= | `x-api-key` header | lists the company's tasks, paginated |
| GET | /tasks/:id | `x-api-key` header | single task |
| POST | /tasks/:id/review | `x-api-key` header | body `{"action": "ACCEPT"}` or `{"action": "REJECT"}` |

Task statuses: `PENDING_REVIEW` (created by the LLM), `ACCEPTED`, `REJECTED`.

Demo api keys after seeding: `acme-dev-key` (users sara@acme.uz, tom@acme.uz) and
`globex-dev-key` (user lena@globex.io).

```bash
curl -H "x-api-key: acme-dev-key" "http://localhost:3000/tasks?status=PENDING_REVIEW"
curl -X POST -H "x-api-key: acme-dev-key" -H "content-type: application/json" \
  -d '{"action":"ACCEPT"}' http://localhost:3000/tasks/<id>/review
```

## Project structure

Same conventions as the main backend: one domain per folder (`Task/`, `InboundEmail/`,
`Company/`, `User/`, `Llm/`) with `*.entity.ts`, `*.service.ts`, `*.controller.ts`,
`*.mapper.ts` and a `dto/` folder inside. Shared enums and pagination live in
`src/libs`. Errors always carry a `code` from `ERROR_CODE`.

## Tests

```bash
npm test          # unit tests
npm run test:e2e  # full flow against an in-memory mongo, LLM stubbed
```

See DESIGN.md for what was built and why, THREATS.md for the abuse cases.
