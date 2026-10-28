# Verification — Neon PostgreSQL connection

Verified 28 October 2026 against the user-selected existing project’s production branch. The Neon CLI authenticated successfully after the user completed browser sign-in. Setup used PostgreSQL only; no AI Gateway, paid plan upgrade, credits purchase, new auth service or hosted application deployment was enabled.

- `neon init`: linked the supplied organization/project and `production` branch; pulled three variables into the ignored `.env`. Existing `AUTH_SECRET` and `APP_URL` were preserved. Local `.neon` metadata is ignored.
- `neon config plan` and `neon deploy`: **“No changes — branch production already matches the policy. Utilized services: Postgres.”**
- A direct connection check confirmed **zero public tables before migration**. `npm run db:deploy`: **“All migrations have been successfully applied.”** Applied `202610270001_encrypted_family` without resetting any database.
- Prisma 6 validates the schema and uses pooled runtime and direct migration URLs. Local setup/test launchers explicitly provide both, so isolated fixture migrations cannot inherit Neon’s URL.
- `npm run build`: passed, **“Compiled successfully”**, TypeScript finished, pages generated and process exited 0. The built production app started locally on `127.0.0.1:3004` and served `/demo` with HTTP 200.
- `npm run verify:neon -- --allow-synthetic-writes` against that local production server passed with **real Neon database operations**: HTTP signup/sign-in, encrypted vault save/unlock, invitation/approval, two-session encrypted sharing, private recipient exclusion, ciphertext inspection, stale-write rejection and membership revocation. It removed only its disposable accounts, identities and household afterward. No real household data or AI inference was involved.
- **128 unit tests**, normal type checking, lint, separate type/lint checks for the new opt-in smoke script and Prisma schema validation passed.
- Both **local database integration scenarios** and **two relevant Playwright account/sharing scenarios** passed again against the isolated local test database. Standard test runners still refuse remote fixture databases. No new interface behavior warrants repeating the earlier 114-layout matrix.
- Package manifest/lockfile dependencies match, relative documentation links resolve, whitespace checks pass and the root README remains untouched.

**Remaining setup:** Render must receive `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET` and its actual HTTPS `APP_URL`, with the documented Node version/start command. The Next.js app was not published to Render or verified at a public URL. Environment files are not automatically transferred from this machine to Render.

**AI decision:** Neon’s current AI Gateway documentation requires Launch/Scale and prepaid credits, with a $5 minimum purchase. It fails the user’s free-only condition, so no gateway credentials or endpoint were wired. Existing direct-browser providers remain unchanged; a shared gateway token is never exposed in client code. See [Neon’s prepaid-credit requirements](https://neon.com/docs/ai-gateway/prepaid-credits).

The first connection safety check expected a branch ID where the CLI supplies the branch name; this local assertion was corrected before migration, and the selected endpoint/name were then verified. A lint invocation also initially excluded the smoke script under the repository’s src-only rule; explicitly scoped lint and type checks passed. No automatic-approval rejection occurred. No commit, push, pull request or Render deployment.

---

# Verification — direct browser AI providers

Verified 28 October 2026 with synthetic family data and disposable local accounts. WebLLM, its worker and dependency are removed. Groq, Gemini and OpenRouter use fixed direct HTTPS endpoints; no backend AI proxy or new credential-sync record is involved.

- **128 unit tests across nine files passed**, including three-provider headers/payloads, safe status/reason diagnostics, Gemini authorization-key format, the current model default, malformed/truncated output, cancellation/timeout, no automatic fallback, and encrypted browser-local connection storage.
- Type checking, lint and production build passed again after the Gemini follow-up. Package manifest/lockfile consistency and whitespace checks passed; the root README remains untouched.
- The full **26-scenario Playwright run passed**, including all **114 route/palette/width combinations** (19 routes, Light/Dark, 360/768/1440), keyboard/modal behavior, contrast, reduced motion, larger text, account/vault flow and two independent browsers sharing encrypted calendar changes.
- Provider browser scenarios verified all three connection tests, approved-context previews and declining without sending; unconfirmed proposals and quota failures; malformed answers without partial writes; demo reset/perspective credential cleanup; six provider-screen layouts; and locally encrypted remembered credentials restored only after vault unlock. Blocked browser persistence falls back to memory with an explanation. Authenticated test credentials were synthetic and provider responses were mocked.
- A saved-connection validation issue found during the first focused run was corrected: local remember/test metadata is excluded before validating request fields. A regression test covers subsequent assistant requests. The successful full run followed those repairs.
- Actual unauthenticated CORS preflights passed for Groq (204), Gemini (200) and OpenRouter (204), including their required credential headers. These checks used no API keys or prompts. They establish preflight compatibility only, not authenticated inference or account eligibility.
- Provider screens were visually inspected in both palettes at all three widths. Temporary screenshots: `/tmp/familymind-providers-{360,768,1440}-{light,dark}.png`.

**Gemini follow-up:** the user reported the former generic model/JSON setup error. Google’s current documentation limits Gemini 2.5 access to previous users, making the old default unsuitable for new projects. The suggestion is now `gemini-3.5-flash-lite`; sampling overrides were removed. HTTP errors display only fixed status and allowlisted reason-code guidance. Tests cover new authorization-key headers, legacy-model failure/reselection and secret-safe errors. All **11 provider browser scenarios passed across the broad and focused reruns**. The new Gemini regression initially selected both the app error and Next.js’s route announcer; its assertion was scoped to the settings section, then the legacy-model error → suggested-model selection → successful synthetic connection flow passed. The generic report does not establish the exact upstream status or prove that the user’s key is invalid. The key supplied in chat was not used, persisted or copied into test fixtures.

**Remaining limits:** no authenticated live-provider generation, 20-scenario live-model quality assessment, physical-phone performance or latency claim. Mocked browser tests do not establish live model reliability. The former local-GPU and model-download acceptance gates no longer apply. Safari/Firefox and independent security review remain unverified. No deployment, commit, push or pull request.

---

# Earlier verification — courtyard homepage

Verified 28 October 2026 with synthetic family data. The redesign adds no inference backend or provider dependency.

- **94 unit tests passed**; final type checking, lint and Next.js production build passed.
- All **114 route/palette/width combinations** passed again: 19 routes in Light/Dark at 360, 768 and 1440 pixels. No horizontal overflow or uncaught page errors were reported. Desktop, tablet and phone screenshots were visually inspected.
- **16 browser scenarios passed across the broad and focused runs**, including the existing account/vault and two-browser encrypted sharing journeys. New checks cover chat beside a working task list, keyboard sending, `/coach` redirection and focus, no automatic inference/model requests, actual pointer response, persisted motion pause, device Reduce motion, and larger-text/high-contrast mode at all three breakpoints.
- Signed-in members returning through the brand link reach the family homepage and its assistant. Keyboard focus trapping, Escape dismissal, theme switching, opt-in cloud context and the local-model download dialog remain covered.
- Computed text contrast passed in both palettes, with motion disabled for stable measurements. The checker now handles CSS `color(srgb …)` from blended colors. An initial assertion also sampled an identity transform during the final frame of a pause transition; the corrected check waits for the paused computed state. These were focused reruns, not a claim that the first full run passed without corrections.
- A first temporary preview stopped before its browser run could connect. The successful broad/focused runs managed the temporary database and preview together and shut them down afterward.
- Temporary design evidence: `/tmp/familymind-courtyard-360-light.png`, `/tmp/familymind-courtyard-768-dark.png`, `/tmp/familymind-courtyard-1440-light.png` and `/tmp/familymind-courtyard-1440-dark.png`. Production preview screenshots are captured separately after building.

No live-model speed, physical-device performance, Safari/Firefox compatibility or audited-security claim is added by this interface work. The AI verification boundaries below still apply. No commits, pushes or deployments were performed.

---

# Earlier verification — full-stack merger

Verified on 27–28 October 2026 using fictional Al Noor data and disposable local `@example.test` accounts. No external deployment, real family use, live-provider credentials, commits or pushes.

## Code and database checks

- Original baseline: 54 unit tests, type checking and Vite production build passed before implementation.
- Merged unit suite: **94 tests across eight files passed**. Includes the original regressions, recipient encryption, authenticated tamper detection, independent vault recovery, fresh content keys, revoked-recipient exclusion, bounded/validated assistant output, private-context filtering, direct-provider request boundaries, date handling and private legacy import.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- Startup follow-up: `npm run dev` now explicitly selects Webpack, matching the custom Next.js configuration. Verified startup on a separate local port and HTTP 200 from `/demo`; 94 unit tests, type checking and lint passed again.
- Next.js production builds passed; the last build includes the final privacy checks.
- Prisma generation and initial migration deployment passed against both local development and isolated test databases.
- Two integration scenarios passed, with assertions covering real password signup/session use, pending/approved memberships, invitation acceptance/reuse checks, owner-only invitations, cross-family denial, private/shared recipient filtering, ciphertext-only storage, optimistic conflicts, atomic batch rollback and child-invitation requirements.
- Whitespace checked using `git -c core.whitespace=cr-at-eol diff --check`, preserving existing CRLF source conventions. Package manifest and lockfile match. Documentation relative links checked.

## Browser checks

Chromium checked 19 routes in Light and Dark at 360, 768 and 1440 pixels: **114 route/palette/width combinations**. Checked one visible main heading, selected appearance, document overflow and uncaught page errors. The weekly print layout deliberately has an additional hidden print heading.

Additional browser scenarios passed:

- No-sign-in sample-member selection, session persistence, private synthetic check-ins across character switches and volunteered talk availability.
- Missing cloud-key setup feedback, explicit provider choice and first-use local-model dialog.
- Keyboard focus inside the family modal, Escape dismissal, theme switching and reduced-motion emulation.
- Registration → vault creation → encrypted household creation through the interface.
- Two independent browser contexts: invitation acceptance → owner approval → decrypting the shared household → receiving a remote calendar update.
- Computed text contrast on six new screens in both palettes. This tests opaque computed text/background colors, not all images, gradients, assistive technologies or an accessibility certification.

A development run captured a transient chunk-loading error while source files were changing and a cold-compilation vault-load timeout. Affected desktop/account checks passed after stable-source reruns. Browser scenario counts are across the full and focused reruns, not a claim that the initial full run was failure-free.

Screenshots were visually inspected in both palettes. Temporary evidence: `/tmp/familymind-merged-light.png` and `/tmp/familymind-merged-dark.png`. Test-generated account fixtures were cleaned up. The test launcher now uses a separate local `familymind_test` database, resets only its rate-limit buckets and refuses remote database hosts.

## Historical AI verification boundary (WebLLM removed in the provider update)

The in-app Chromium browser exposes WebGPU but returned **no compatible GPU adapter**. The application reported that failure without changing the plan or silently using cloud AI. The worker integration compiles, but actual local model answers, cold/warm model-loading time, throughput and the 15-second response target **remain unverified on compatible hardware**. This was an unresolved acceptance check for the earlier WebLLM build. The provider update removes that local-inference requirement.

No real Groq key was supplied. Provider requests, payload/identifier validation and quota-error handling were tested with synthetic/mocked responses. **Authenticated live inference and direct-browser provider compatibility remain unverified.** The settings screen provides a direct connection/model test; no backend proxy was introduced.

## Security and feature limits

- Browser encryption uses maintained libsodium primitives, but this application protocol is not independently audited. No claim of production security, clinical validity or immunity to malicious site code/device compromise.
- Account, membership, recipient and delivery metadata are visible to the server. Authorized recipients can copy decrypted content. Removal cannot retract existing copies.
- Full encrypted snapshots refresh while visible and on focus. This deliberately prioritizes dropping records no longer shared over incremental cursor optimization in this small prototype.
- Imports activate independently mapped private events/keepsakes and retain the entire old snapshot in a private encrypted archive; old active plans/care data are not silently substituted into the current family plan. Original browser values remain untouched.
- Complex administration/recovery/revocation combinations have unit/integration coverage but not exhaustive end-to-end or expert review. No physical-phone, Safari or Firefox matrix was run.
- In-app reminders operate while the page is active. Photo uploads, external-calendar sync, background push/email, unattended AI, hosted deployment and real-family operation remain outside this contribution.
- Final dependency audit reported **one low-severity development-tool advisory** in esbuild’s Windows development-server behavior, with no moderate/high/critical findings. The tested preview runs on Linux; dependency audit is not a security certification.

## Local operation

Preview and database processes use a one-hour timeout and bind locally. See [README.md](README.md) for setup, isolated tests, vault recovery and provider configuration. Temporary source backups are described in [CHANGES.md](CHANGES.md).
