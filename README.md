# email-task-automation

NestJS + MongoDB skeleton for a multi-tenant CRM. Companies have users, each user has
one or more email addresses. Follows the same conventions as the main backend: one
domain per folder with `*.entity.ts` / `*.service.ts`, shared enums and pagination in
`src/libs`.

## Setup

```bash
npm install
cp .env.example .env
```

You need a MongoDB running (`MONGODB_URI`). If you don't have one, set
`USE_MEMORY_DB=true` in `.env` and the app starts its own in-memory Mongo and seeds
demo data automatically.

## Run

```bash
npm run start:dev
# with a real mongo, seed demo companies/users once:
npm run seed
```
