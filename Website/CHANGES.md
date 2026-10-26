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
