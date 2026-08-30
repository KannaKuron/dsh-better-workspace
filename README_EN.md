# dsh-better-workspace

> A **folder system** for the DeepSeek Harness (DSH) sidebar workspace list — a workspace is still one directory, but every `/` in its name becomes hierarchy, so `web/frontend` and `web/backend` group under one virtual `web` folder.

```
web/                 ← virtual folder (naming only, not a real directory)
├─ frontend          ← workspace "web/frontend"
└─ backend           ← workspace "web/backend"
```

## Features

- **Hierarchy tree**: `/` inside a workspace title groups it under a virtual folder, arbitrarily deep. Renaming a workspace re-derives the tree instantly — folders are a projection of names, there is no second source of truth.
- **Parent-group popup in the add flow**: after picking a directory for a new workspace, a small dialog asks for the parent group — type one (`web`), pick an existing level from the datalist, or leave empty for the root. The plugin creates the workspace and writes the prefix into its title.
- **New-folder button**: create explicit empty folders (multi-level paths welcome) that persist in the browser until workspaces live inside them.
- **Folder actions**: hover a folder row to rename it (rewrites every descendant workspace title) or delete it when empty.
- **Native capabilities kept**: open/rename/fork/archive sessions, per-workspace new-session, collapse/expand, current-session highlight, running/pending dots, ungrouped-session fallback, zh/en localization.
- **Conversation hero too**: the empty-state "Add workspace" menu uses the same picking interaction.

## Install

```bash
dsh plugin --profile web add dsh-better-workspace
```

Plain JavaScript, zero build, zero npm dependencies (dsh client baseline modules only). Restart DSH after installing.

## How it works

The sidebar browsing region is the public `sidebar.workspaces` slot; this plugin registers the same slot with a lower priority and replaces the shipped browser with the tree. All data flows through the slot's standard snapshot hooks and injected host actions — no private APIs.

The add flow lands in the seam dsh designed for third parties: the two `directoryFlow` holes. The trigger, busy semantics, and error dialog stay official; this plugin owns everything between the trigger and the adopted path — exactly enough room for pick → group popup → create → prefixed rename.

View state persists browser-side via the dsh client store (`dsh.betterWorkspace.view.v1`).

## Relationship to dsh-better-sidebar

Same `dsh-better-*` family, zero overlap: [dsh-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) is the VSCode-like panel on the right; this plugin only takes over the left workspace list. They can be installed together.

## Limitations / roadmap

- Workspace drag-reorder is not wired yet (v0.1 sorts by name inside the tree).
- Search is local title filtering; host content search is planned.
- Explicit empty folders persist per-browser (roadmap: host-side folder registry + settings page).

## Develop

```bash
npm test
npm pack
```

## License

[MIT](./LICENSE)
