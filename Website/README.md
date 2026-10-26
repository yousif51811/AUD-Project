# FamilyMind AI

Privacy-conscious, explainable family wellbeing prototype (React 19 + TypeScript + Vite). Fully offline: no backend, no live model, no API keys. All data lives in `localStorage` under `familymind:v1:*`.

## Family planner

One warm interface for the whole family: a noticeboard home, a shared daily list, a calendar and a weekly planner. The header’s sun/moon button switches Light and Dark without a dropdown. System is the default and follows device changes immediately; explicit choices persist across visits and tabs. Use **Family & more → Use device theme** to restore automatic mode. Short entrance animations and smooth theme/icon transitions respect device and household reduced-motion preferences. A warm charcoal palette complements the cream light palette. Existing family data stays in the same browser storage. Appearance uses the separate `familymind:appearance:v1` key, with an in-memory fallback if storage is blocked; old Original/Expressive preferences are ignored. The cinematic intro and aurora effects remain removed.

Today supports quick actions. Our week supports editing, filtering, replacing, printing and reducing the plan. Talk it through provides immediate offline suggestions, with editable actions and an explanation when wanted. See [contribution details](CHANGES.md) and [verification notes](VERIFICATION.md).

This is one shared browser workspace. Sharing and visibility settings are demonstrations, not access controls between family members.

## Run

Use Node **20.19+ or 22.12+** (the declared engine range excludes Node 21 and early Node 22). Run these commands from `Website/`. Install dependencies on the machine where you will run the website; do not copy `node_modules` between Windows and Linux.

```
npm ci
npm run dev        # development server
npm run typecheck  # TypeScript verification
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build on :4173
npm test           # unit tests, including persistence, undo, coach editing and quick add
```

On Linux/macOS with GNU `timeout`, use a finite local preview:

```sh
timeout --signal=TERM --kill-after=10s 1h npm run dev -- --host 127.0.0.1
```

This stops the server after one hour, including a forced-stop fallback after ten seconds. `npm run preview` serves the build on localhost port 4173. Stop any manually started server with Ctrl+C when finished. For copied Windows dependencies or broken executable permissions on Linux, move the copied `node_modules` aside and run `npm ci` to recreate a native installation.

## End-to-end checks (optional)
The existing smoke/flow scripts were written for the original labels and introduction; those assertions require adaptation for the current interface. With `npm run preview` running and `pip install playwright && playwright install chromium`:
```
python e2e/smoke.py   # all routes × 8 widths: overflow, h1, console errors
python e2e/flows.py   # intro, assessment, coach, plan, schedule, care, memories, demo, mobile nav
```

## Routes
`/` `/onboarding` `/assessment` `/results` `/dashboard` `/coach` `/plan` `/schedule` `/student` `/care` `/memories` `/trust` `/demo`

## Where things live
- `src/lib/scoring.ts` deterministic Harmony Score · `recommendations.ts` rules · `scheduleOptimizer.ts` proposals · `coach.ts` + `ai.ts` offline coach behind a provider abstraction · `safety.ts` crisis routing · `storage.ts` safe persistence
- `src/data/demo.ts` Al Noor demo family · `src/data/copy.ts` centralized copy
- `src/components/family/` home, daily planner, weekly planner and navigation · `src/styles/family.css` shared presentation · `src/styles/appearance.css` warm dark palette and icon control · `src/styles/motion.css` short, accessible motion · `src/lib/appearance.ts` preference persistence

FamilyMind AI is not a medical tool, does not diagnose, and cannot monitor emergencies. Prototype metrics are illustrative, not clinical outcomes.
