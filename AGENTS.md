# Agent guidelines

## This repo is a fork — all work stays in the fork

`tehjaymo/patterngen-oss` is a **fork** of `halfof8/patterngen-oss`. Everything
the user does should land in **their** fork, never the upstream parent.

- `origin` already points at `tehjaymo/patterngen-oss`, so `git push` goes to the
  fork — that part is fine.
- **Pull requests must target the fork, not upstream.** By default `gh pr create`
  aims a fork's PRs at the *parent* repo, which fails with errors like
  *"No commits between main and …"* / *"Head sha can't be blank"* because the
  branch only exists on the fork.

### How to open a PR here

The gh default repo is set to the fork (`gh repo set-default tehjaymo/patterngen-oss`),
so `gh pr create` should target the fork. Be explicit anyway to be safe:

```sh
gh pr create -R tehjaymo/patterngen-oss --base main --head <branch> \
  --title "…" --body-file <file>
```

If a PR command ever errors about a blank/ missing sha or "no commits between",
the cause is almost certainly fork→upstream targeting — re-run with
`-R tehjaymo/patterngen-oss`.

## Branching

Don't commit directly to `main`. Create a branch first, push it, then open the PR
against `main` in the fork.

## Project layout (quick reference)

- `src/` — React + TypeScript web app (the pattern generator and PNG exporter).
- `src/export/` — PNG-sequence exporter; writes `manifest.json` into the export
  zip declaring `fps`, `frameStep`, resolution, and per-layer sequence settings.
- `blender-addon/patterngen_importer.py` — Blender add-on that imports the export
  and reads `manifest.json` to configure the scene (fps, frame step, sequence
  durations). Keep the exporter manifest and importer reader in sync.
- `figma-plugin/` — Figma scene-export plugin.
- Tests: `npm run test:e2e` (Playwright).
