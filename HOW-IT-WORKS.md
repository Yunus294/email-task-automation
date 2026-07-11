# How it works (and where the tokens come from)

This is the "explain it simply" guide. `DESIGN.md` is the why, `THREATS.md` is the
security, this file is **how to actually run it and what each secret is**.

## The whole flow in one picture

```
  Email provider                 This app                        Reviewer
 (SendGrid / Mailgun /      ┌───────────────────────┐          (your CRM UI
  our test script)          │                       │           or curl)
        │                   │                       │              │
        │  POST /webhooks/email                     │              │
        │  header: x-webhook-token  ───────────────►│              │
        │                   │ 1. store raw email    │              │
        │  ◄─── 202 Accepted│ 2. return 202 at once  │              │
        │                   │ 3. (async) find which  │              │
        │                   │    company owns a      │              │
        │                   │    recipient address   │              │
        │                   │ 4. ask the LLM: is     │              │
        │                   │    this an actual task?│              │
        │                   │ 5. if yes → create a   │              │
        │                   │    Task = PENDING_REVIEW              │
        │                   │                       │  GET /tasks   │
        │                   │            header: x-api-key ◄────────│
        │                   │                       │  POST /tasks/:id/review
        │                   │            {"action":"ACCEPT"} ◄──────│
        └───────────────────┴───────────────────────┘              │
```

Key idea: **the LLM never does anything on its own.** It only *suggests* a task.
A human accepts or rejects it. That's the whole point of the design.

## The 3 secrets — this is the part that confuses people

There are three "keys" in this project. **Two of them you invent yourself, only one
is a real external account.** Nobody gives you a signup page for the first two.

| Secret | Header | Where it comes from | Do I need to sign up anywhere? |
|--------|--------|---------------------|-------------------------------|
| **Webhook token** | `x-webhook-token` | **You make it up.** It lives in `.env` as `WEBHOOK_TOKEN`. Right now it is `dev-webhook-token`. | ❌ No. It's just a password you and the email provider agree on. |
| **API key** | `x-api-key` | Comes from the **seeded companies** in the database. Demo values: `acme-dev-key`, `globex-dev-key`. | ❌ No. The seed script creates them. |
| **OpenAI key** | (server-side only) | `platform.openai.com` → API keys. Goes in `.env` as `OPENAI_API_KEY`. | ✅ Yes — this is the only real account. And you can skip it with `LLM_FAKE=true`. |

### 1. The webhook token — "where do I get it?"

**You don't get it from anywhere. You choose it.**

Think of it like a doorbell code you share with a delivery person. A real email
provider (SendGrid Inbound Parse, Mailgun Routes, Postmark) lets you configure a
secret header when it forwards emails to your URL. You type the *same* string in two
places:

- in **your `.env`** → `WEBHOOK_TOKEN=whatever-you-want`
- in the **provider's dashboard** → the custom header `x-webhook-token: whatever-you-want`

Then, when the provider POSTs an email to you, the app checks the two match. If they
don't → `401`. That's the only thing it does: prove the request really came from your
provider and not a random person on the internet who found your URL.

In this project there is no real provider — `scripts/send-test-emails.ts` plays that
role, and it sends the token `dev-webhook-token`. So **the "dev version" already
exists**: the token is a fixed, non-secret dev value. You just have to send it in the
header:

```bash
curl -X POST http://localhost:3000/webhooks/email \
  -H "x-webhook-token: dev-webhook-token" \
  -H "content-type: application/json" \
  -d '{"messageId":"m1","from":"client@corp.com","to":["sara@acme.uz"],
       "subject":"please send the invoice by 2026-07-20","text":"can you send it asap"}'
```

**"Can't we run with no token at all?"** You already are, in spirit — the token is a
throwaway dev string, not something you fetch. I kept the check in on purpose because
`THREATS.md` treats "anyone can POST fake emails" as the #1 abuse case, and dropping
the token would remove that defense. If you truly want a header-less local mode we can
make the guard skip when `WEBHOOK_TOKEN` is empty — but for grading it's better to
leave it as a 1-line header you paste. It is not a real secret.

### 2. The API key — how the reviewer authenticates

Same idea, different job. Every company gets its own `x-api-key`. It tells the app
**which company's tasks you're allowed to see**. It is created by the seed, not by any
signup:

- `acme-dev-key`   → Acme Digital  (users `sara@acme.uz`, `tom@acme.uz`)
- `globex-dev-key`  → Globex Media (user `lena@globex.io`)

Every task query is filtered by the company behind the key, so Acme's key can never
see Globex's tasks (it gets `404`, not `403`, so ids can't be guessed).

### 3. The OpenAI key — the only real account

This is the one genuine external credential, from `platform.openai.com`. It goes in
`.env` as `OPENAI_API_KEY`. **You can avoid it completely** for local testing:
set `LLM_FAKE=true` and a keyword heuristic stands in for the model, so the full flow
still runs with zero cost and zero account.

## Run it with literally zero setup

No Mongo, no OpenAI account, no tokens to fetch:

```bash
npm install
USE_MEMORY_DB=true LLM_FAKE=true npm run start:dev
```

- `USE_MEMORY_DB=true` → the app boots its own throwaway Mongo **and auto-seeds** the
  two demo companies + three users (api keys are printed in the startup log).
- `LLM_FAKE=true` → no OpenAI needed.

Open Swagger at `http://localhost:3000/api/docs`, click **Authorize**, paste
`dev-webhook-token` for the webhook and `acme-dev-key` for the api key, and every
endpoint is clickable. Every endpoint now also shows its **response body model**
(`TaskResponseDto`, `TaskPageResponseDto`, `InboundEmailAcceptedDto`) so you can see
the exact shape you get back.

## End-to-end in 4 curl commands

```bash
# 1. provider delivers an email (needs the webhook token)
curl -X POST http://localhost:3000/webhooks/email \
  -H "x-webhook-token: dev-webhook-token" -H "content-type: application/json" \
  -d '{"messageId":"m1","from":"client@corp.com","to":["sara@acme.uz"],
       "subject":"please send the invoice by 2026-07-20","text":"can you send it asap"}'
# → 202 Accepted

# 2. reviewer lists pending tasks (needs the api key)
curl -H "x-api-key: acme-dev-key" "http://localhost:3000/tasks?status=PENDING_REVIEW"

# 3. reviewer opens one task  (use an id from step 2)
curl -H "x-api-key: acme-dev-key" "http://localhost:3000/tasks/<id>"

# 4. reviewer accepts it  → status becomes ACCEPTED, returns 200
curl -X POST -H "x-api-key: acme-dev-key" -H "content-type: application/json" \
  -d '{"action":"ACCEPT"}' "http://localhost:3000/tasks/<id>/review"
```

That's the entire product: email in → suggested task → human accepts/rejects.
