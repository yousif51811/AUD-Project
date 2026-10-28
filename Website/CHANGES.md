# Neon PostgreSQL setup

Linked the supplied existing Neon project’s production branch with PostgreSQL only. Added `neon.ts` and development-only config support; `.neon` context and environment credentials are ignored. Existing account secret and app origin were preserved, with a private temporary configuration backup before initialization. The existing Prisma 6/PostgreSQL architecture remains: pooled `DATABASE_URL` for runtime, direct `DATABASE_URL_UNPOOLED` for migrations. Local setup and isolated test launchers set both variables, preventing a hosted migration URL from leaking into local fixture runs.

Added an explicitly opted-in `verify:neon` smoke check that uses real HTTP account/session and encrypted sharing flows against the configured Neon database, then deletes only its synthetic fixtures. Ordinary tests still refuse remote fixture databases. The application has not been published to Render; setup requires both database URLs, the auth secret, public app origin and the hosted port-binding command documented in [README.md](README.md).

Neon AI Gateway was excluded after checking its current paid-plan/prepaid-credit requirements. No new AI endpoint, shared public credential, backend inference path or paid service was enabled. Existing browser AI providers remain available.

---

# Direct browser AI providers

Gemini follow-up: replaced the outdated suggested Gemini 2.5 model with `gemini-3.5-flash-lite` after checking Google’s current new-project guidance. Removed the Gemini temperature override so current models use their defaults. Setup errors now include safe HTTP status and allowlisted reason codes, with specific restrictions/authentication guidance and no raw provider messages. The reported generic model/JSON error alone cannot establish whether the user’s key is invalid; no real key was tested or stored.

The user approved replacing WebLLM with multiple providers that are easy to set up without backend AI handling. Added Groq, Gemini and OpenRouter with official key links, suggested models, a synthetic Test & connect flow, per-request context previews, provider selection, cancellation and clear error states. The homepage assistant still uses recorded facts without AI for exact assignment/availability questions. No model download, WebGPU or new SDK is required; the WebLLM worker and dependency were removed.

New credentials are visit-only in memory by default. Signed-in members can remember them in locally sealed encryption, bound to their account and family and unlocked with their vault identity. Neither readable nor encrypted new provider credentials are uploaded to the backend. Each browser connects separately. Earlier encrypted shared credentials are not used; explicit owner cleanup is offered without silently deleting them. Family data and private chat history retain their existing encrypted synchronization.

All requests use fixed HTTPS provider endpoints with header credentials and no application proxy, redirects, automatic retries or provider fallback. Provider responses remain schema-validated, permissions and action limits still apply, and changes still require confirmation. No unrelated motion pass was included in this provider contribution.

Source backup: `/tmp/familymind-before-provider-options-20261028.tar.gz`. Setup and provider policy links are in [README.md](README.md); validation boundaries are in [VERIFICATION.md](VERIFICATION.md).

---

# Courtyard homepage (earlier interface contribution)

The user requested a more expressive interface with the assistant directly on the signed-in homepage. Home now combines the existing assistant behavior, personal greeting, custom illustrated courtyard and daily family plan. The primary navigation is Home, Our week and Calendar. `/coach` remains an entry point and redirects to `/dashboard#assistant`; unlocked family members visiting the public root are directed Home.

Added a layered botanical background that follows fine-pointer movement, animated SVG plants, dotted paths and flowers, staggered entrances, round navigation and subtle interaction feedback. Scenery is decorative, never blocks controls and can be paused per member through the homepage or family menu. Device/household reduced motion remains effective. The existing appearance preference, task editing, AI consent, action confirmation and privacy boundaries remain in place. No new packages or inference services were added.

Source backup before this change: `/tmp/familymind-before-courtyard-20261028.tar.gz`. See [verification](VERIFICATION.md) for measured checks.

---

# Full-stack merge (historical implementation)

The user approved retaining the current family-planner interface while adding accounts, encrypted sharing and browser-side AI. No commits, pushes or deployments were authorized or performed.

## Foundation

- React/TypeScript presentation moved from Vite into a Next.js client entry and catch-all route. Existing route names remain available. Reusable screens moved from `src/pages/` to `src/screens/` to avoid Next.js route discovery.
- Added PostgreSQL/Prisma migrations, local database tooling, password authentication, expiring invitation links, pending membership approval, owner controls and authenticated versioned encrypted records. Selected authentication/invitation patterns were adapted from the supplied team source.
- The source download remains untouched. Source-only backups are `/tmp/familymind-merge-existing.tar.gz` and `/tmp/familymind-merge-friend.tar.gz`; the normalized preparation copy is `/tmp/familymind-team-normalized`.

## Data and AI

- Household payloads and vault backups use browser libsodium encryption, recipient key wraps and signed envelopes. Server checks enforce membership and optimistic versions. Related record changes can commit as one database transaction. Personal records do not inherit owner access.
- Public identities, account and recipient/delivery metadata remain visible. An unaudited browser application cannot promise protection against malicious site code, compromised devices or recipients copying records.
- WebLLM is lazy-loaded in a dedicated worker. It checks actual GPU-adapter availability before loading. No compatible adapter was available in the in-app browser during verification; local response speed/quality therefore remain unverified.
- Optional Groq requests go directly from the browser after explicit context approval. Credentials are never embedded in public sample data or sent to an application AI endpoint. Built-in fact queries are labelled and never masquerade as live AI.
- Existing family browser data is not overwritten. Import requires explicit review and uses conservative private/member/date mappings.

## Experience

The paper-and-garden identity, both palettes, appearance control, reduced motion and existing planner modules remain. Added no-sign-in member selection, skippable walkthrough, accounts/vaults, invitations, personal check-ins, voluntary expiring availability, recurring responsibility agreements, acceptance requests, in-app reminders and cloud/vault settings. Photo uploads, mobile apps, external calendar integration, background push/email and production certification remain outside scope.

Detailed checks and unresolved limits are in [VERIFICATION.md](VERIFICATION.md).

---

## Earlier interface contribution (historical)

# Family planner redesign

The user authorized a complete replacement of the old presentation. There is now one warm interface using paper surfaces, garden green, restrained terracotta, serif headings and a family-noticeboard illustration. A later user request added Light, Dark and System appearance choices. No new packages, remote images, backend or paid services were introduced.

## Interface

- New home page with an interactive sample noticeboard and clear entry points into setup and the sample family.
- Today puts the shared task list and chronological calendar first. Care routines and a weekly suggestion sit beside them. The check-in score is supporting information rather than the main visual.
- Our week is a vertical planner with day labels and actions. Filters are optional, inside a disclosure. Quick add, completion, editing, replacement, regeneration, reduced workload and printing remain available.
- One navigation bar links Today, Our week and Calendar. Family & more opens every other module. Phones also have a fixed navigation strip.
- The coach is now Talk it through. Responses appear immediately; artificial typing delays and streaming have been removed. Supporting reasoning and extra steps are optional disclosures. Safety messages remain visible.
- Trust topics are expandable rather than a large grid of simultaneous panels. The demo retains all eight steps and presenter tools in the new visual system.

The Original/Expressive switch, effect controls, cinematic intro, old marketing components, old dashboard/plan presentations and dark override stylesheet were removed. Current presentation components live in `src/components/family/`; shared controls and domain behavior remain reusable. Legacy `familymind:ui:*` preferences are ignored. No family-data migration is needed.

## Appearance and refinements

The header has one sun/moon button, including on phones. Click to switch Light/Dark; the family menu’s Use device theme button restores System. There is no appearance dropdown. System follows device changes without a reload; explicit choices persist independently of household data and sync across open tabs. Storage failures keep the choice in memory. A small pre-paint initializer avoids flashing the opposite theme at startup. Switching appearance updates colors in place, preserving routes and unfinished forms.

Dark uses warm charcoal, sage and amber rather than the removed aurora style. Semantic colors cover forms, notices, calendar events, charts, care states and the home noticeboard. Focus states and link hover treatments are clearer, and the shared toggle thumb now fits its track. Print remains light. Both palettes respect larger text, high contrast and reduced motion. The sun/moon icon rotates between states; palette changes blend briefly, and page headings and the home noticeboard have short entrance animations. Checkbox marks and disclosures have small feedback animations. All new motion is disabled for device or household Reduce motion, and no animation framework was added.

## Behavior retained

Existing `familymind:v1:*` browser data, scoring, recommendations, schedule optimizer, student support, memories and care routines are preserved. Previous persistence, edited-coach-action and schedule/care undo fixes remain covered by regression tests. Quick add still uses the daily action/time limits and creates an otherwise empty plan when necessary.

This is an offline, single-browser prototype with no live model, member accounts, access restrictions or background notification delivery. Visibility controls demonstrate intended sharing; anyone using the browser can open the pages.

## Recovery and review

Before this replacement, the website source and assets were backed up to `/tmp/familymind-before-light-redesign-20261026.tar.gz`, excluding dependencies, build output, screenshots and private environment files. The appearance contribution also has a preceding source backup at `/tmp/familymind-before-appearance-20261026.tar.gz`. The earlier source backup `/tmp/familymind-before-expressive-20261026.tar.gz` is also retained. These are temporary local recovery aids. No commits, pushes or deployments were performed.

See [setup](README.md) and [verification](VERIFICATION.md).
