# Design notes

## What I built

A small monolith with five domains, laid out the same way as our main backend:
`Company/`, `User/`, `InboundEmail/`, `Task/`, `Llm/` (entity + service + controller +
mapper + dto per domain, shared enums/pagination in `src/libs`).

The flow: the provider POSTs to `/webhooks/email` (protected by a shared token).
I store the raw email first and return 202 right away, then process it async in the
same process. Processing means: find which user owns one of the recipient addresses
(that user's company becomes the tenant), send subject + body to OpenAI with a strict
JSON schema, and if the model says "actionable" create a Task in `PENDING_REVIEW`.
A human then accepts or rejects it through `POST /tasks/:id/review`. Nothing the LLM
produces goes live without that review step, that was the main design decision.

Tenant resolution is recipient-based on purpose: an email lands in the system because
somebody at a company received it, so the recipient decides the tenant, not the sender.
Emails that match no user are stored as `UNMATCHED` and never reach the LLM (no point
paying for spam sent to random addresses).

Every inbound email is persisted with a status (`RECEIVED/PROCESSING/PROCESSED/
DISCARDED/UNMATCHED/FAILED`), so there is a full audit trail and failed ones can be
retried just by re-delivering the same messageId. Deduplication is done on messageId
too, the provider can retry as much as it wants.

The LLM output is treated as untrusted: title/description get length-clamped, the due
date must actually parse, and the suggested assignee is only kept if that email really
belongs to a user of the same company. Everything else is dropped, not errored.

## What I cut

- Bull/Redis. The async work is a fire-and-forget promise with status flags in Mongo.
  Fine for this size, but it means no automatic retries/backoff and an email can get
  stuck in `PROCESSING` if the process dies mid-flight. First thing I'd add back.
- Real auth. `x-api-key` per company instead of users + JWT. It keeps the tenant
  scoping honest (every query filters by companyId) without building a whole login flow.
- Task lifecycle beyond review. No done/in-progress states, no editing, no manual task
  creation. The assignment only felt like it asked for the review gate.
- Attachments, threading, HTML parsing beyond a basic tag strip.

## Tradeoffs

- Answering 202 before the LLM runs means the provider never waits on OpenAI, but you
  can't tell from the webhook response whether a task was created. The email status
  field is the source of truth instead.
- One LLM call per email with no batching. Simple and easy to reason about, costs more
  at volume.
- `USE_MEMORY_DB` and `LLM_FAKE` flags exist purely so the project runs anywhere with
  zero infra. In a real deployment both would be off, but they made testing (mine and
  yours) much less painful.

## With another week

Bull queue with retries and a dead-letter state, per-company rate limits on the
webhook, hashed api keys, an outbox so task creation and email status updates are
atomic, confidence-based auto-accept for high-scoring tasks, and a small eval set of
sample emails to measure the prompt against before touching it.
