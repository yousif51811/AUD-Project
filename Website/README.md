# FamilyMind AI

A fictional-data family wellbeing prototype combining the original warm planner interface with accounts, encrypted synchronization, shared server-side Gemini and optional personal AI providers connected directly from browsers. React, TypeScript, Next.js, npm, Prisma and PostgreSQL.

## Manage the family from the assistant

Home’s assistant supports typed management proposals with **Confirm changes** and **Dismiss proposal** in the conversation. Examples: “Add a study session for me on Friday from 17:00 to 18:00”, “Move Dentist to 16:00”, “Invite alex@example.com as an adult member”, “Confirm access for Sam”, or “Accept this shared calendar request”. Exact item/member names are resolved locally; missing or ambiguous details require another proposal.

Supported commands cover calendar create/edit/delete; task create/edit/complete/delete; care reminders; keepsakes with chosen visibility; study settings; family name/goals/reminder policy/daily limits; invitations, invitation cancellation, member approval/removal, Member/Read-only role changes, ownership transfer and timezone; private check-ins and volunteered availability; responsibility rotations; listing/responding to pending change requests; and personal display, language and appearance preferences. The capability disclosure below the composer explains the available controls.

The selected provider returns validated JSON proposals, not executable code or arbitrary HTTP requests. Shared Gemini and all three personal providers use the same allowlist. Date/time validation, current-record matching and permissions are checked before execution. Previews use locally decrypted content without uploading it as extra model context. Only existing author-approved records go to inference; earlier chat and private record reads are not silently added. The model receives bounded actor/role/date/timezone metadata to interpret “me” and dates, but this metadata grants no authority. Family APIs recheck the authenticated account.

Up to six state changes can be confirmed together; administrative/personal commands are confirmed individually. State changes use the same awaited encrypted persistence as manual controls. Shared calendar/task changes require the affected members’ own acceptance, including people removed from an assignment. The assistant can list/respond to those requests; it cannot accept for another person. Stale proposals, lost permissions and failed saves do not produce a success message. Invitations create a 48-hour link for the owner to share and do not send email. The fictional sample can change its planner but cannot create real memberships/invitations.

Account/family deletion, passwords, encryption recovery, provider keys and author AI-sharing consent stay in their dedicated controls. The assistant cannot grant itself access or change these boundaries. No additional database migration or dependency is required for the assistant tools. Live model tool-selection quality is separate from mocked-provider workflow verification.

## Optional Google sign-in on Render

Google uses the existing account tables. Apply all repository migrations before running this revision; the simplified account flow adds usernames and invitation roles. Email/password continues working when Google is not configured.

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), configure the OAuth consent screen and create an OAuth client of type **Web application**. Use your own project/contact details and, if Google restricts a testing app, allow your demo accounts in its audience settings.
2. Register this **Authorized redirect URI**, replacing the placeholder with your actual Render hostname: `https://YOUR-RENDER-HOST/api/auth/callback/google`. Set `APP_URL` to the **origin only** (for this deployment, `https://familymind.onrender.com`), without `/api/auth` or the callback path. The redirect URI must use that same scheme and hostname plus `/api/auth/callback/google`. For local testing, register the equivalent URI for your chosen localhost address and port. Open the app at that exact address; `localhost` and `127.0.0.1` do not share OAuth state cookies.
3. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the Render Web Service's environment, alongside the existing `APP_URL`, `AUTH_SECRET` and database URLs. Keep these server-only; never use `NEXT_PUBLIC_` names. Restart/redeploy the service after changing them. Do not replace the existing auth secret.
4. The sign-in and create-account tabs offer **Continue with Google**. New accounts use the selected age group and Google's profile name/email. Children/teens need a matching adult invitation; its email, age group and validity are checked again after Google's callback. Existing email users first sign in normally, then choose **Link Google to this account** on Account using the same Google email. Accounts are not silently merged.

**`redirect_uri_mismatch` on Render:** on 28 October 2026, Google's error details confirmed the live service was sending `http://localhost:3000/api/auth/callback/google`. The registered HTTPS callback was correct. Set the Render Web Service's `APP_URL` to `https://familymind.onrender.com` and restart the service so authentication reloads the environment. Keep the authorized callback at `https://familymind.onrender.com/api/auth/callback/google`; do not add localhost as a workaround for production. If an error remains, compare Google's actual `redirect_uri` and the OAuth client used by `GOOGLE_CLIENT_ID` with that client's saved redirect list.

Google authentication uses only `openid`, `email` and `profile`, with provider tokens encrypted using `AUTH_SECRET`. Call-time requests cannot add Google API scopes. Google sign-in grants no family membership. Encryption is prepared automatically on a new account; a remembered device restores access locally, while a new device needs a saved recovery code (or the existing protection password for older accounts). Owners confirm family access. It does not connect Gemini or another AI provider. The public `/api/auth-options` endpoint exposes only whether Google is configured, never credentials. OAuth failures display fixed guidance, excluding provider descriptions.

Reference: [Better Auth's Google setup](https://better-auth.com/docs/authentication/google), [Google's redirect URI rules](https://developers.google.com/identity/protocols/oauth2/web-server#redirect-uri-validation).

## Signup reports an empty or invalid response

A raw `JSON.parse: unexpected end of data` during signup can hide an empty server failure. The current form shows safe error guidance instead, retains entered fields and enables retry. Authentication routes return sanitized JSON for internal failures; workspace requests also reject incomplete responses without exposing parser errors or upstream HTML.

If the username revision was installed without its database migration, account queries cannot use the new `User.username` column. Apply the repository migrations using `npm run db:deploy` against the intended database before serving this revision. The normal Render build command already includes that step. Use `DATABASE_URL_UNPOOLED` for migrations; do not reset the database or recreate existing accounts. `202610280001_simple_accounts` only adds usernames and invitation roles. If the problem remains after migrations, inspect server status/logs without sharing credentials or request bodies. A parser error alone does not establish the underlying cause.

## One family and clear invitations

New accounts choose a unique username (3–30 ASCII letters, numbers or underscores; case-insensitive). Existing and Google accounts can add one on Your account. Email or username works at sign-in. No family switcher or additional-family creation is offered. Creation and joining enforce at most one active or pending family under a per-account database lock. Older multiple memberships and their encrypted records are preserved; the earliest active family is opened automatically.

Owners select **Invite family** on Home, Your account or the family menu. Enter a username for an existing account or an email for someone new, choose an age group and **Member** or **Read-only**, then share the generated 48-hour link. No email delivery is implied. Existing recipients also see the invitation on Your account. The link or inbox invitation is usable only by the matching email and account age group. Children receive the Child role. Only the owner can invite, cancel invitations, confirm access, remove members or transfer ownership; a read-only membership cannot write encrypted records. Invited members join, then the owner confirms access from the clearly marked waiting member. This explicit device-side step grants access to existing family-shared records while leaving private records private.

Apply the additive `202610280001_simple_accounts` migration using the documented deployment command. It adds nullable unique usernames and invitation roles, preserving accounts, identities, records and existing invitations. The migration was applied to the configured Neon database with user authorization on 29 October 2026. The Next.js application itself has not been redeployed by the agent.

## Languages and About us

Language starts in **Device** mode: the first supported English/Arabic browser preference wins, including regional variants, with English as fallback. Settings offers Device / English / العربية. The header shortcut creates an explicit choice, preserved across reloads and tabs. Existing English/Arabic preferences remain explicit choices. Device mode follows `languagechange`; blocked storage uses memory. Language changes preserve drafts and never translate member-authored content.

The header language button switches between English and Arabic, alongside the theme control. The family menu and sign-in modal also offer the switch. Arabic uses right-to-left layout; the browser remembers the choice separately as `familymind:language:v1`. Switching preserves mounted forms, assistant drafts, theme and family data. Blocked storage keeps the preference in memory for this visit.

Interface translations live in [src/i18n/ar.json](src/i18n/ar.json); English interface strings are the lookup keys. Unknown copy falls back to English. Names, saved tasks, notes, conversations and other record content remain as entered; no translation service is called. The assistant recognises Arabic assignment/availability starters and asks a connected provider to answer in the selected language. Personal providers require an explicit connection; shared Gemini uses server configuration. Both show provider terms and privacy links beside the composer; sending submits the question and author-approved AI context.

The public [About us page](src/screens/About.tsx) is available at `/about`, from the footer and family menu. Edit its English/Arabic text, team names and supervisor in [src/data/about.ts](src/data/about.ts). Its layout uses the existing courtyard artwork and paper palette, with project context, principles and five team cards. Documentation remains in English.

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

The current account/sync application needs a **Node Web Service**, not a Static Site. Next.js serves the pages and the existing API routes together; a separate frontend/backend deployment is unnecessary. Shared Gemini calls pass through the same Next.js service to Google. Personal-provider calls still go directly from browsers. The Neon database connection, schema migration and locally running app have been verified. On 28 October 2026, the project owner confirmed that hosted operation and live AI are working, with server-side setup complete. This supersedes the earlier deployment-status limitation; automated provider tests remain separate from that operational confirmation.

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
| Build Command | `npm ci --include=dev && npm run db:deploy && npm run build` |
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
| `NODE_ENV` | `production` (exactly, without quotes or spaces) |

For hosted builds and `next start`, use `NODE_ENV=production`. Do not copy a local development value into Render. Next.js warns about the wrong environment and may fail to prerender its internal `/_global-error` page with `Cannot read properties of null (reading 'useContext')`; fix the environment before investigating secondary key warnings. After changing it, use Render’s **Clear build cache & deploy** action. `--include=dev` keeps Prisma’s CLI and TypeScript available during the build even with production environment settings. See [Next.js environment guidance](https://nextjs.org/docs/messages/non-standard-node-env).

Keep the secret stable across deploys and set `APP_URL` to the actual origin used to sign in. Do not prefix secrets with `NEXT_PUBLIC_`, commit them, or paste them into chat. Only the shared `GEMINI_API_KEY` belongs in the Render environment; personal-provider keys remain on each browser. The build command applies committed database migrations before building; use only the intended hosted prototype database. Do not run the embedded `db:local` helper on Render. The normal `npm start` intentionally binds to localhost for local use; the explicit hosted start command above overrides that by calling Next directly.

After deployment, check sample access and signup → automatic encryption setup → Create my family, then invite a second disposable account and verify shared encrypted changes. This creates a new database; local accounts/data do not move automatically. Keep demonstrations fictional. See [Render’s Next.js guide](https://render.com/docs/deploy-nextjs-app) and [port requirements](https://render.com/docs/web-services#port-binding).

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

Sign-in and account creation open in an illustrated modal over the current page. Escape or the close button returns to that page and restores keyboard focus without discarding an unsent assistant draft. Direct `/sign-in` and `/sign-up` links open the same modal over the public home. The modal has keyboard-operable mode tabs, password visibility, a scrollable phone layout and an always-reachable close control. Invitation links reuse the form; `/account` shows usernames, incoming invitations, recovery and sessions. The family opens automatically; there is no family switcher.

Account flow: create an account with a name, username, email, age group and one password → Create my family → family homepage. Alternatively, open an invitation or join from Your account → owner selects Confirm family access in Invite family → Go to my family. No second password is chosen. Returning members automatically use their existing family. Children and teenagers require a valid invitation matching their email and age group. Signup profile labels never grant administrator permissions. Email delivery and Google OAuth are not prerequisites; account-password-reset email delivery is not implemented in this merge.

## Interface and features

Home, Our week and Calendar are the main navigation. Home combines the family assistant with today's responsibilities, calendar and care routines. Old `/coach` links open the assistant on Home; an unlocked signed-in member visiting `/` goes to the family homepage. Family & more contains responsibilities and recurring rotations, personal check-ins, voluntary availability, reminders/requests, study/rest support, care routines, text keepsakes, household preferences and privacy settings.

Light, Dark and System keep the existing `familymind:appearance:v1` preference. The courtyard illustration, pointer-responsive botanical background, soft entrances and interaction animations give the space a more expressive identity. The latest presentation pass adds compact navigation, clearer typography, illustrated assistant shortcuts and more deliberate spacing/surfaces. Cards stay still on hover; colour, borders and small icon changes provide interaction feedback. Sign-in remains visible in the phone header. Pause scenery saves a personal reduced-motion preference; device Reduce motion always takes precedence. Larger text and contrast remain supported. The background never intercepts clicks or starts AI. No new animation framework, cinematic intro or artificial typing delay is involved.

Changes to other members' commitments become acceptance requests rather than automatic writes. Recurring responsibilities require agreement on their rotation. Upcoming tasks are prepared explicitly while the app is open. In-app reminders respect quiet hours; closed-browser push, scheduled email and unattended background AI are outside this prototype.

## AI: shared Gemini by default, personal providers optional

**Server-side · Gemini** is selected initially for accounts and the fictional sample. Add `GEMINI_API_KEY` privately in the Render Web Service environment (or your ignored local `.env`) and optionally `GEMINI_MODEL`; the default is `gemini-3.5-flash-lite`. Never use a `NEXT_PUBLIC_` variable or replace the auth secret. Restart/redeploy after changing server configuration. No database migration, SDK or paid plan change is required. Removing the shared key disables the option without switching providers.

`GET /api/ai/config` returns availability/model only and issues a signed HttpOnly anonymous demo session; it never tests inference. `POST /api/ai/answer` accepts only a bounded question, English/Arabic language, approved facts and member identifiers. It builds its own instructions and validates answers. Shared requests send **readable approved context through FamilyMind’s backend to Google**. The backend does not log or persist readable requests/answers; private conversation history can still sync as encrypted records. The inline notice identifies both recipients. Stored household encryption and locally held decryption keys are unchanged.

Shared allowance defaults: 5 requests/minute per signed-in account or signed anonymous demo session, 10/minute globally and 100/day globally (UTC application day). `AI_CALLER_RPM`, `AI_GLOBAL_RPM`, `AI_GLOBAL_RPD` may lower these caps; higher values cannot raise the defaults. Counters use the existing PostgreSQL RateLimit table and are atomic across concurrent requests. Anonymous sessions are not strong identity—clearing cookies can obtain another session—but global caps remain enforced across sessions and restarts. Rejected/failed generation attempts may consume an allowance. Upstream Gemini project limits also apply; these caps cannot guarantee provider availability or prevent charges on an already billed Google project. Keep the existing free-only setup and use fictional data. No retries or provider fallback happen automatically.

Missing configuration, invalid responses, quota and timeout failures retain the question and leave the planner usable. Requests cancel after 45 seconds. Cancellation aborts local/server work when signalled but cannot retract an already submitted Google request or guarantee a quota refund. AI actions still require confirmation and existing member acceptance rules.

### Personal connections

Choose **Connect AI** on Home, or Family & more → People & privacy → Connect your assistant. Select **Groq**, **Gemini** or **OpenRouter**, open the official key page, paste your own key, then choose **Test & connect**. The test uses a tiny synthetic message and verifies that the selected model returns the JSON format the assistant needs. It contains no household records and may count toward the provider's allowance.

| Provider | Suggested model | Setup and limits |
|---|---|---|
| Groq | `openai/gpt-oss-20b` | [Create a key](https://console.groq.com/keys), [current limits](https://console.groq.com/docs/rate-limits) |
| Gemini | `gemini-3.5-flash-lite` | [Google AI Studio keys](https://aistudio.google.com/api-keys), [pricing and data use](https://ai.google.dev/gemini-api/docs/pricing) |
| OpenRouter | `openrouter/free` | [Create a key](https://openrouter.ai/settings/keys), [free router](https://openrouter.ai/openrouter/free), [current limits](https://openrouter.ai/pricing) |

No model weights, WebGPU, local AI runtime or paid hosting are required. WebLLM and its worker/dependency have been removed. Provider accounts, network access, model availability and quotas still apply. Advanced settings allow a different model ID; a model must pass the connection test. Custom endpoints are not supported. OpenRouter's free router chooses an available free model and model host; both OpenRouter and that host process the approved request. Gemini lists free-tier content as usable for product improvement. These are synthetic-data prototype adapters, not verified child-facing deployment arrangements.

**Gemini troubleshooting:** the suggested model is `gemini-3.5-flash-lite`. Google now limits Gemini 2.5 models to previous users, so a new key/project can fail against the old default. In **Choose another model**, choose **Use the suggested model** and test again. New `AQ.` authorization keys are accepted and sent through `x-goog-api-key`, as required by the native Gemini endpoint. HTTP status and recognized Google reason codes distinguish invalid keys, API restrictions, disabled services, quota and model availability; arbitrary provider error text is never displayed. A 403 can also reflect project/free-tier eligibility, and creating another key in the same project does not resolve that. See Google's [model availability](https://ai.google.dev/gemini-api/docs/models) and [troubleshooting guide](https://ai.google.dev/gemini-api/docs/troubleshooting). Replace any key shared in chat or other public material, and enter its replacement only in the app.

Connections are personal to this tab/browser. Keys stay in memory for the visit by default. Signed-in members can explicitly choose **Remember on this browser**, which stores a sealed, encrypted connection locally using the account's vault identity. It becomes usable again only after vault unlock and family selection. It is never uploaded, included in family backups or shared with other members. Demo keys are always memory-only and clear on reload, demo reset, perspective change or account/family changes. Disconnect removes the current tab's connection and its saved browser copy; revoke the key through its provider to invalidate copies elsewhere.

Personal-provider keys go only in authentication headers to fixed HTTPS provider endpoints, never in URLs or application API requests. Neither personal-provider testing nor personal-provider inference uses our backend. Requests have bounded output, cancellation and a timeout. Authentication, model access, quota/credits, browser/network and malformed-answer errors have distinct messages. There is no automatic retry, backend proxy, provider switch or paid-model fallback. An unavailable provider stays unavailable until the user changes the connection.

The composer shows the selected provider’s terms, privacy policy and request route. Sending a message submits the question and author-approved AI context directly, without a per-message modal. Ordinary family sharing does not permit provider processing; authors opt records in separately. Prior chat messages are excluded from provider requests. Built-in assignment/availability queries stay available without any connection and are labelled as recorded facts. Generated changes remain validated proposals requiring confirmation. Private chat history can still sync as encrypted family records; encrypted chat synchronization is separate from approved inference requests.

Earlier encrypted family-wide `cloud` records are no longer used. Owners can explicitly remove them in the old-settings disclosure. They are not silently migrated or deleted. Provider keys copied into the new connection form are never written back to these records.

## Privacy and encrypted data

Account identity, family membership, recipient lists, versions and delivery metadata are visible to the service. Household content is encrypted on devices using libsodium authenticated encryption, with a separate content key per record and recipient-specific key wraps. Private records do not receive household-wide keys. Authors control sharing and cloud approval.

New email accounts protect their encryption identity with their existing account password. Authentication receives that password normally; this convenience does not provide cryptographic separation from password authentication. Google-only accounts use a generated protection secret and an independently generated recovery code. Neither generated secret nor readable encryption keys are sent to the server. Encrypted backups remain in the existing identity format. This browser remembers access in IndexedDB, encrypted with a locally stored, non-extractable AES key, and clears its entry on Sign out. Same-origin code and an unlocked browser can use that key; this is convenience storage, not protection from malicious site code. A new device can use the account password for new email accounts, or the saved recovery code for Google accounts. Older separate passphrases still work; existing identities are never replaced silently. Family settings can generate a new recovery code without changing password protection. Save codes privately; account-password reset does not recover encryption keys. Removing members stops further service access and excludes them from new encryption versions; already downloaded information cannot be retracted.

This is **not independently audited encryption**. It protects stored content against ordinary database/server access, not a compromised device, an authorized recipient copying information, malicious website code or an explicitly authorized cloud provider. Family wellbeing data should remain synthetic. Do not market the app as a medical or emergency service.

## Old data and source boundaries

Original `familymind:v1:*` browser values are left untouched. After unlocking a family, an explicit import preview maps old assignments to the importing member and events to the current week, imports mapped events/keepsakes privately, retains the full old snapshot in an encrypted archive, and records a one-time marker. Review that mapping before confirming. Appearance is independent of household data and demo reset.

The friend's downloaded source was normalized in `/tmp/familymind-team-normalized` without modifying the download. Only selected authentication/infrastructure patterns were adapted; its readable household database and server AI code were not imported. Original screens now live in `src/screens/` because Next.js reserves `src/pages/` for routes. Existing user-facing route paths remain available through the client router.

See [implementation notes](CHANGES.md) and [verification and limitations](VERIFICATION.md).
