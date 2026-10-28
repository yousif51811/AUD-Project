# FamilyMind AI

A fictional-data family wellbeing prototype combining the original warm planner interface with accounts, encrypted synchronization and AI requests sent directly from browsers to user-selected providers. React, TypeScript, Next.js, npm, Prisma and PostgreSQL.

## Run locally

Use Node **22.12–24**. Install dependencies on this machine; do not copy `node_modules` from another operating system.

```sh
npm ci
# First terminal, first setup only: starts local PostgreSQL and creates .env.
WRITE_ENV=true npm run db:local
# Second terminal:
npm run db:deploy
# Finite preview, bound to this machine:
timeout --signal=TERM --kill-after=10s 1h npm run dev
```

Open `http://127.0.0.1:3000`. Development and production builds explicitly use Webpack to match the project's custom bundler configuration. Subsequent database starts use `npm run db:local` without `WRITE_ENV=true`; that flag replaces `.env`, including the authentication secret. Stop the database with Ctrl+C. For an existing PostgreSQL database, fill in `.env` using [.env.example](.env.example), then deploy the migrations. Local PostgreSQL uses the same URL for `DATABASE_URL` and `DATABASE_URL_UNPOOLED`; an existing local `.env` needs that second variable added without replacing its auth secret.

The server needs `DATABASE_URL`, `DATABASE_URL_UNPOOLED` for migrations, a random `AUTH_SECRET` of at least 32 characters, and `APP_URL` matching its origin. Localhost and its 127.0.0.1 alias are accepted for local verification. An alternate port requires a matching `APP_URL`. Never commit `.env`.

```sh
npm test                  # original regressions, encryption and assistant validation
npm run typecheck
npm run lint
npm run build             # Prisma generation + Next.js production build
npm run start             # local production server, port 3000
npm run preview           # production server, port 4173; use matching APP_URL
npm run test:server        # separate terminal: migrates isolated familymind_test DB, serves :3002
npm run test:integration   # against the running test server, synthetic accounts only
npm run test:e2e           # Playwright checks against the running test server
```

Install the Playwright browser with `npx playwright install chromium --only-shell`. The test launcher creates a separate local `familymind_test` database and serves the test app on port 3002. It refuses remote database hosts. Tests reset only the test database’s rate-limit buckets and use disposable `@example.test` accounts. They must never target a real deployment. Keep local servers on a finite timer, including database previews when practical.

## Hosting on Render

The current account/sync application needs a **Node Web Service**, not a Static Site. Next.js serves the pages and the existing API routes together; a separate frontend/backend deployment is unnecessary. AI provider calls still go directly from browsers. The Neon database connection, schema migration and locally running app have been verified. The application itself has not been deployed or verified on Render.

The selected database is Neon PostgreSQL, with Render remaining the application host. Neon has a Free plan with quotas. In Neon’s **Connect** dialog, copy the **pooled** URL into `DATABASE_URL` and the **direct/unpooled** URL into `DATABASE_URL_UNPOOLED`, retaining their SSL parameters. The existing Prisma 6 client uses pooled connections for application traffic and its `directUrl` for migrations; no ORM upgrade or serverless-driver replacement is needed for this Node web service. Neon’s other managed products are not required. [Neon connection guide](https://neon.com/docs/get-started/connect-neon), [current free-plan quotas](https://neon.com/pricing).

The existing Neon project is linked locally through git-ignored `.neon` metadata and the committed `neon.ts` policy. To link a fresh checkout, run these from `Website/`:

```sh
npx neon@latest login
npx neon@latest init -y --no-agent-setup --org-id org-falling-violet-81293536 --project-id misty-wind-46575890 --branch production --services postgres
npx neon@latest deploy
npm run db:deploy
npm run build
```

Complete sign-in in the browser. The CLI pulls `DATABASE_URL`, `DATABASE_URL_UNPOOLED` and `NEON_BRANCH` into `.env`; preserve `AUTH_SECRET` and `APP_URL`. `neon deploy` applies database-service policy, and `db:deploy` applies the application tables. Neither command publishes the Next.js website to Render. Agent/plugin installation is skipped to keep this database setup focused. Neon configuration support is a development dependency only.

**AI Gateway is deliberately excluded.** It currently requires a paid Launch/Scale plan and prepaid credits (minimum purchase $5), so it does not meet the free-only requirement. A shared gateway bearer credential must not be embedded in browser code. Existing browser provider connections remain unchanged. [Neon Gateway pricing](https://neon.com/docs/ai-gateway/prepaid-credits).

Create a Render **Web Service** connected to the repository and configure:

| Setting | Value |
|---|---|
| Runtime | Node |
| Root Directory | `Website` |
| Build Command | `npm ci && npm run db:deploy && npm run build` |
| Start Command | `npx next start --hostname 0.0.0.0 --port "$PORT"` |
| Instance | Free, for the synthetic prototype |

Set these in the Render service’s environment before deploying:

| Variable | Value |
|---|---|
| `DATABASE_URL` | The private Neon pooled connection string, retaining its SSL parameters |
| `DATABASE_URL_UNPOOLED` | The private Neon direct connection string for migrations, retaining its SSL parameters |
| `AUTH_SECRET` | At least 32 random characters; generate locally with `openssl rand -hex 32` |
| `APP_URL` | The full HTTPS public origin, e.g. `https://your-service.onrender.com` |
| `NODE_VERSION` | `24.22.1` (tested Node 24 runtime) |

Keep the secret stable across deploys and set `APP_URL` to the actual origin used to sign in. Do not prefix secrets with `NEXT_PUBLIC_`, commit them, or paste them into chat. No AI keys belong in the Render environment. The build command applies committed database migrations before building; use only the intended hosted prototype database. Do not run the embedded `db:local` helper on Render. The normal `npm start` intentionally binds to localhost for local use; the explicit hosted start command above overrides that by calling Next directly.

After deployment, check sample access and signup → vault creation → family creation, then invite a second disposable account and verify shared encrypted changes. This creates a new database; local accounts/data do not move automatically. Keep demonstrations fictional. See [Render’s Next.js guide](https://render.com/docs/deploy-nextjs-app) and [port requirements](https://render.com/docs/web-services#port-binding).

For an explicit end-to-end Neon smoke check, run the built app locally with the matching origin in one terminal, then verify it in another:

```sh
APP_URL=http://127.0.0.1:3004 timeout --signal=TERM --kill-after=10s 15m npx next start --hostname 127.0.0.1 --port 3004
# Second terminal, from Website/:
npm run verify:neon -- --allow-synthetic-writes
```

This opt-in check creates two disposable `@example.test` accounts on the configured Neon database, exercises signup/sign-in, encrypted vault round-trip, invitations/approval, recipient-restricted sharing, ciphertext storage, stale writes and member removal, then cleans up only its own accounts/household. It refuses a non-local app origin or a non-Neon database. The ordinary integration/Playwright fixture suite remains restricted to the separate local test database; it never resets rate limits on Neon. To run those local checks while `.env` points at Neon, inject local `DATABASE_URL` and `DATABASE_URL_UNPOOLED` values in each test terminal rather than overwriting `.env`.

Render Free services sleep after 15 minutes without traffic and can take about a minute to wake. Open the app before presenting. Render Free PostgreSQL is an alternative, but it expires after 30 days; Neon Free also has usage/storage quotas. [Render free-service limits](https://render.com/docs/free).

## Explore before signing up

Choose **Try the sample family**, then a fictional Al Noor family member. Each browser session has its own sample changes; there are no shared public demo credentials. Switch perspectives from the sample chooser and reset when needed. This is role simulation, not real authentication. The presenter walkthrough remains under `/tour`.

Real account flow: register → create/unlock vault → create or accept an invitation → owner approves encrypted access → open the family. Children and teenagers require a valid invitation matching their email and age group. Signup profile labels never grant administrator permissions. Email delivery and Google OAuth are not prerequisites; account-password-reset email delivery is not implemented in this merge.

## Interface and features

Home, Our week and Calendar are the main navigation. Home combines the family assistant with today's responsibilities, calendar and care routines. Old `/coach` links open the assistant on Home; an unlocked signed-in member visiting `/` goes to the family homepage. Family & more contains responsibilities and recurring rotations, personal check-ins, voluntary availability, reminders/requests, study/rest support, care routines, text keepsakes, household preferences and privacy settings.

Light, Dark and System keep the existing `familymind:appearance:v1` preference. The courtyard illustration, pointer-responsive botanical background, soft entrances and interaction animations give the space a more expressive identity. Pause scenery saves a personal reduced-motion preference; device Reduce motion always takes precedence. Larger text and contrast remain supported. The background never intercepts clicks or starts AI. No new animation framework, cinematic intro or artificial typing delay is involved.

Changes to other members' commitments become acceptance requests rather than automatic writes. Recurring responsibilities require agreement on their rotation. Upcoming tasks are prepared explicitly while the app is open. In-app reminders respect quiet hours; closed-browser push, scheduled email and unattended background AI are outside this prototype.

## AI: connect directly from your browser

Choose **Connect AI** on Home, or Family & more → People & privacy → Connect your assistant. Select **Groq**, **Gemini** or **OpenRouter**, open the official key page, paste your own key, then choose **Test & connect**. The test uses a tiny synthetic message and verifies that the selected model returns the JSON format the assistant needs. It contains no household records and may count toward the provider's allowance.

| Provider | Suggested model | Setup and limits |
|---|---|---|
| Groq | `openai/gpt-oss-20b` | [Create a key](https://console.groq.com/keys), [current limits](https://console.groq.com/docs/rate-limits) |
| Gemini | `gemini-3.5-flash-lite` | [Google AI Studio keys](https://aistudio.google.com/api-keys), [pricing and data use](https://ai.google.dev/gemini-api/docs/pricing) |
| OpenRouter | `openrouter/free` | [Create a key](https://openrouter.ai/settings/keys), [free router](https://openrouter.ai/openrouter/free), [current limits](https://openrouter.ai/pricing) |

No model weights, WebGPU, local AI runtime or paid hosting are required. WebLLM and its worker/dependency have been removed. Provider accounts, network access, model availability and quotas still apply. Advanced settings allow a different model ID; a model must pass the connection test. Custom endpoints are not supported. OpenRouter's free router chooses an available free model and model host; both OpenRouter and that host process the approved request. Gemini lists free-tier content as usable for product improvement. These are synthetic-data prototype adapters, not verified child-facing deployment arrangements.

**Gemini troubleshooting:** the suggested model is `gemini-3.5-flash-lite`. Google now limits Gemini 2.5 models to previous users, so a new key/project can fail against the old default. In **Choose another model**, choose **Use the suggested model** and test again. New `AQ.` authorization keys are accepted and sent through `x-goog-api-key`, as required by the native Gemini endpoint. HTTP status and recognized Google reason codes distinguish invalid keys, API restrictions, disabled services, quota and model availability; arbitrary provider error text is never displayed. A 403 can also reflect project/free-tier eligibility, and creating another key in the same project does not resolve that. See Google's [model availability](https://ai.google.dev/gemini-api/docs/models) and [troubleshooting guide](https://ai.google.dev/gemini-api/docs/troubleshooting). Replace any key shared in chat or other public material, and enter its replacement only in the app.

Connections are personal to this tab/browser. Keys stay in memory for the visit by default. Signed-in members can explicitly choose **Remember on this browser**, which stores a sealed, encrypted connection locally using the account's vault identity. It becomes usable again only after vault unlock and family selection. It is never uploaded, included in family backups or shared with other members. Demo keys are always memory-only and clear on reload, demo reset, perspective change or account/family changes. Disconnect removes the current tab's connection and its saved browser copy; revoke the key through its provider to invalidate copies elsewhere.

Keys go only in authentication headers to fixed HTTPS provider endpoints, never in URLs or application API requests. Neither testing nor inference uses our backend. Requests have bounded output, cancellation and a timeout. Authentication, model access, quota/credits, browser/network and malformed-answer errors have distinct messages. There is no automatic retry, backend proxy, provider switch or paid-model fallback. An unavailable provider stays unavailable until the user changes the connection.

Every assistant request previews its question and approved context before sending. Ordinary family sharing does not permit provider processing; authors opt records in separately. Prior chat messages are excluded from provider requests. Built-in assignment/availability queries stay available without any connection and are labelled as recorded facts. Generated changes remain validated proposals requiring confirmation. Private chat history can still sync as encrypted family records; this does not proxy an inference request or expose readable prompts to the server.

Earlier encrypted family-wide `cloud` records are no longer used. Owners can explicitly remove them in the old-settings disclosure. They are not silently migrated or deleted. Provider keys copied into the new connection form are never written back to these records.

## Privacy and encrypted data

Account identity, family membership, recipient lists, versions and delivery metadata are visible to the service. Household content is encrypted on devices using libsodium authenticated encryption, with a separate content key per record and recipient-specific key wraps. Private records do not receive household-wide keys. Authors control sharing and cloud approval.

A separate vault passphrase and independently generated recovery code protect the account's encryption identity. Encrypted key backups are synchronized; readable private keys are not stored on the server. Unlocking happens locally. Save the recovery code privately. Resetting an account password cannot recover a lost vault. Removing members stops further service access and excludes them from new encryption versions; already downloaded information cannot be retracted.

This is **not independently audited encryption**. It protects stored content against ordinary database/server access, not a compromised device, an authorized recipient copying information, malicious website code or an explicitly authorized cloud provider. Family wellbeing data should remain synthetic. Do not market the app as a medical or emergency service.

## Old data and source boundaries

Original `familymind:v1:*` browser values are left untouched. After unlocking a family, an explicit import preview maps old assignments to the importing member and events to the current week, imports mapped events/keepsakes privately, retains the full old snapshot in an encrypted archive, and records a one-time marker. Review that mapping before confirming. Appearance is independent of household data and demo reset.

The friend's downloaded source was normalized in `/tmp/familymind-team-normalized` without modifying the download. Only selected authentication/infrastructure patterns were adapted; its readable household database and server AI code were not imported. Original screens now live in `src/screens/` because Next.js reserves `src/pages/` for routes. Existing user-facing route paths remain available through the client router.

See [implementation notes](CHANGES.md) and [verification and limitations](VERIFICATION.md).
