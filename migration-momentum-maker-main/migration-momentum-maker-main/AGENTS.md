<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

# Architecture rules (migrated VVU Estate)

- The dashboard is ONE route (`/`) that swaps workspaces by `location.hash`
  (#/ive, #/twin, …). Do not split estate surfaces into separate routes — the
  keyboard map, command palette and PiP bridge depend on hash routing. Keep the
  ten fixed surface aliases from the source's keyboard-map.json.
- Workspace components are React.lazy client modules under
  `src/components/<surface>/`; the IVE marketing sub-app uses real routes under
  `/ive/*`. Why: ported 1:1 from the Next.js single-page dashboard (src/app/page.tsx).
- Estate data lives in Lovable Cloud Postgres (migrated from the source's
  Prisma/SQLite schema). Application IDs from the source are preserved as text
  primary keys; user-facing tables are public-read (anon SELECT), writes go
  through TanStack server routes/functions. Why: source has no auth system.
- Mini-service data (telemetry, vault-bridge, field-onboard, wildfire-mesh,
  mesh-demo) is recreated as in-app server-side simulated feeds polled by the
  client — never as external socket.io servers. Why: the target runtime cannot
  host long-lived socket.io services.
- Preserve the estate visual language: near-black #060806 ground, lime #c8ff00
  accent, uppercase tracked vvu-label typography; the VVU tokens live in
  src/styles.css. Why: ported from src/app/globals.css, components use these
  tokens and hex classes directly.
- TanStack package versions come from this project's package.json — never align
  them to the source archive's.
