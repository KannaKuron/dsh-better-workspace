/**
 * dsh-better-workspace — panel stylesheet (package-local client chunk).
 *
 * The plugin stylesheet lives here; apply() awaits this chunk once and StyleNode renders whatever CSS_TEXT it published.
 *
 * This is not a package entry: it is fetched on demand from src/client.js with
 * require.async('./client.styles.js') and must stay out of the package "exports" map.
 * The official ModuleLoader only accepts package-local chunk files whose names
 * match /^client\.[A-Za-z0-9][A-Za-z0-9._-]*\.js$/.
 */
window.__ModuleLoader__.load({
  id: 'dsh-better-workspace',
  chunk: 'client.styles.js',
  factory: () => {
    const CSS_TEXT = [
      '.bw-root{height:100%;display:flex;flex-direction:column;min-height:0;position:relative;color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-header{display:flex;align-items:center;gap:2px;padding:10px 10px 4px;flex:none}',
      '.bw-header-title{flex:1;font-size:14px;font-weight:400;line-height:20px;color:var(--dsw-alias-label-tertiary,#9a9a9a);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.bw-icon-btn{flex:none;width:24px;height:24px;border:none;background:transparent;border-radius:var(--dsw-radius-sm,6px);display:grid;place-items:center;color:var(--dsw-alias-label-secondary,#b8b8b8);cursor:pointer;padding:0}',
      '.bw-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.15));color:var(--dsw-alias-label-primary,#e6e6e6)}',
      // Official row iconButton (Rows.module.css): a bare 16px tertiary
      // square — the shipped strip buttons ride this, not the 24px
      // toolbox button above.
      '.bw-row-btn{flex:none;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border:none;border-radius:var(--dsw-radius-xs,4px);padding:0;background:transparent;color:var(--dsw-alias-label-tertiary,#9a9a9a);cursor:pointer}',
      '.bw-row-btn:hover{color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-row-btn:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#5b8def));outline-offset:-2px}',
      // Focus ring parity with the shipped icon buttons (dsh 0.1.7-rc.2
      // focus.css + WorkspaceBrowser.module.css): the host publishes the ring
      // width/colour as tokens and keeps offsets inside controls that clip an
      // outer ring — ours sit in dense 28px rows, so they do the same. The
      // literal fallbacks keep the ring visible if a theme omits the tokens.
      '.bw-icon-btn:focus-visible,.bw-rail-btn:focus-visible,.bw-ctx-item:focus-visible,.bw-seg-btn:focus-visible,.bw-btn:focus-visible{outline:var(--dsw-focus-ring-width,2px) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary,#5b8def));outline-offset:-2px}',
      '.bw-search-row{flex:none;padding:0 10px 6px}',
      '.bw-input{width:100%;box-sizing:border-box;height:26px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));border-radius:var(--dsw-radius-sm,6px);color:inherit;padding:0 8px;font-size:13px;outline:none;font-family:inherit}',
      '.bw-input:focus{border-color:var(--dsw-alias-brand-primary,#5b8def)}',
      '.bw-input::placeholder{color:var(--dsw-alias-label-quaternary,#8a8a8a)}',
      // Dropdown triggers (MenuPicker): the same surface as .bw-input so a
      // picker and a text field read as one family.
      '.bw-select{display:flex;align-items:center;gap:6px;width:100%;box-sizing:border-box;height:26px;padding:0 8px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));border-radius:6px;color:inherit;font-size:13px;font-family:inherit;cursor:pointer;text-align:left}',
      '.bw-select:hover{border-color:var(--dsw-alias-brand-primary,#5b8def)}',
      '.bw-select-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.bw-select-chevron{flex:none;display:inline-flex;align-items:center;color:var(--dsw-alias-label-quaternary,#8a8a8a);font-size:10px;line-height:1}',
      '.bw-select-icon{width:26px;flex:none;justify-content:center;padding:0}',
      '.bw-combo{display:flex;align-items:center;gap:6px}',
      // The Menu root is a <span>; these make it fill the field, or sit inline
      // as the chevron-only button beside an input.
      '.bw-menu-block{display:block;width:100%}',
      '.bw-menu-inline{display:inline-block;width:auto;flex:none}',
      '.bw-tree{--bw-row-h:34px;--bw-session-h:32px;flex:1;overflow-y:auto;overflow-x:hidden;padding:2px 6px 12px;min-height:0}',
      '.bw-rows-exits{position:fixed;inset:0;contain:strict;overflow:clip;pointer-events:none}',
      '.bw-tree[data-bw-density="compact"]{--bw-row-h:28px;--bw-session-h:26px}',
      '.bw-tree[data-bw-density="roomy"]{--bw-row-h:40px;--bw-session-h:38px}',
      '.bw-row{display:flex;align-items:center;gap:6px;height:var(--bw-row-h,34px);padding:0 8px;padding-inline-start:calc(8px + var(--bw-indent,0px));border-radius:var(--dsw-radius-md,8px);cursor:pointer;user-select:none;font-size:14px;line-height:20px;color:var(--dsw-alias-label-primary,#e6e6e6);position:relative;transition:height .15s ease-out,padding .15s ease-out}',
      '.bw-drop-before::before{content:"";position:absolute;z-index:1;left:0;right:4px;top:-7px;height:12px;pointer-events:none;background:linear-gradient(55deg,transparent 0,var(--dsw-alias-state-business-primary,#5b8def) 50%,transparent 100%) 0 0/5px 7px no-repeat,linear-gradient(125deg,transparent 0,var(--dsw-alias-state-business-primary,#5b8def) 50%,transparent 100%) 0 5px/5px 7px no-repeat,linear-gradient(var(--dsw-alias-state-business-primary,#5b8def),var(--dsw-alias-state-business-primary,#5b8def)) 4px 5px/calc(100% - 4px) 2px no-repeat}',
      '.bw-drop-after::after{content:"";position:absolute;z-index:1;left:0;right:4px;bottom:-7px;height:12px;pointer-events:none;background:linear-gradient(55deg,transparent 0,var(--dsw-alias-state-business-primary,#5b8def) 50%,transparent 100%) 0 0/5px 7px no-repeat,linear-gradient(125deg,transparent 0,var(--dsw-alias-state-business-primary,#5b8def) 50%,transparent 100%) 0 5px/5px 7px no-repeat,linear-gradient(var(--dsw-alias-state-business-primary,#5b8def),var(--dsw-alias-state-business-primary,#5b8def)) 4px 5px/calc(100% - 4px) 2px no-repeat}',
      '.bw-drop-into{outline:1.5px dashed var(--dsw-alias-brand-primary,#5b8def);outline-offset:-1.5px}',
      // Grouping drop lands on the header button / a group row: solid brand
      // rim + a tinted wash so "this drop joins a group" reads stronger than
      // the reorder dashes above.
      '.bw-drop-into-strong{outline:2px solid var(--dsw-alias-brand-primary,#5b8def);outline-offset:-2px;background:color-mix(in srgb, var(--dsw-alias-brand-primary,#5b8def) 16%, transparent)}',
      // v0.36.1 edge-band reorder slot on group rows: the row SPLITS OPEN to
      // twice its height so "a row will land here" is visible without
      // staring for the thin official line. Both the height and the content
      // slide are transitioned (padding, which CAN animate — align-items
      // cannot, it teleports the content and feels janky), so the row
      // opens/closes like a drawer, not a flash. The gap fills with a faint
      // brand wash; the middle half of the row (drop-into) never opens.
      '.bw-slot-above{padding-top:var(--bw-row-h,34px);background:linear-gradient(to bottom, color-mix(in srgb, var(--dsw-alias-brand-primary,#5b8def) 10%, transparent) 0, transparent calc(var(--bw-row-h,34px)))}',
      '.bw-slot-below{padding-bottom:var(--bw-row-h,34px);background:linear-gradient(to top, color-mix(in srgb, var(--dsw-alias-brand-primary,#5b8def) 10%, transparent) 0, transparent calc(var(--bw-row-h,34px)))}',
      // Session drag whose source sits in a group: a quiet dashed line at the
      // bottom of the tree says "anywhere outside a group = out of it". Kept
      // faint on purpose — the row outlines are the loud feedback.
      '.bw-root-drop-out::after{content:"";position:absolute;left:10px;right:10px;bottom:6px;border-bottom:1px dashed var(--dsw-alias-border-secondary,rgba(230,230,230,.35));pointer-events:none}',
      // v0.17.0: the new-group entry is an ICON button now (same family as the
      // search / add buttons beside it); the wording moved into its tooltip.
      '.bw-newgroup-btn{flex:none}',
      '.bw-seg{display:flex;gap:0;width:fit-content;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));border-radius:7px;overflow:hidden}',
      '.bw-seg-btn{border:none;background:transparent;color:var(--dsw-alias-label-secondary,#b8b8b8);font:inherit;font-size:13px;padding:5px 14px;cursor:pointer}',
      '.bw-seg-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-seg-btn-on{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.16));color:var(--dsw-alias-label-primary,#e6e6e6);font-weight:500}',
      '.bw-seg-btn+.bw-seg-btn{border-left:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25))}',
      '.bw-gn-hint{font-size:12px;color:var(--dsw-alias-label-tertiary,#9a9a9a)}',
      // A container-only node (a workspace name-group in the session layer):
      // still expandable, but it carries no workspaceId to file against.
      // The trailing "new top-level group" row: separated from the containers
      // above it, because it belongs to none of them.
      '.bw-gn-row-new{margin-top:4px;border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22));border-radius:0 0 6px 6px;padding-top:4px}',
      '.bw-gn-row-new .bw-gn-label{color:var(--dsw-alias-label-secondary,#b8b8b8)}',
      '.bw-gn-row-hold{cursor:default}',
      '.bw-gn-row-hold:hover{background:transparent}',
      '.bw-gn-row-hold .bw-gn-label{color:var(--dsw-alias-label-secondary,#b8b8b8)}',
      '.bw-gn-empty{font-size:12px;color:var(--dsw-alias-label-tertiary,#9a9a9a);padding:10px 8px;text-align:center}',
      '.bw-gn-tree{max-height:250px;overflow:auto;padding:4px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22));border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.06))}',
      '.bw-gn-row{display:flex;align-items:center;gap:6px;min-height:26px;padding-right:8px;border-radius:6px;cursor:pointer;user-select:none}',
      '.bw-gn-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.bw-gn-row-on{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));box-shadow:inset 0 0 0 1px var(--dsw-alias-brand-primary,#5b8def)}',
      '.bw-gn-twist{flex:none;display:grid;place-items:center;width:14px;height:14px;padding:0;border:none;background:transparent;color:var(--dsw-alias-label-tertiary,#9a9a9a);cursor:pointer}',
      '.bw-gn-twist-open{transform:rotate(90deg)}',
      '.bw-gn-icon{flex:none;display:grid;place-items:center;width:16px;height:16px;color:var(--dsw-alias-label-secondary,#b8b8b8)}',
      '.bw-gn-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-gn-input{width:100%;box-sizing:border-box}',
      // Row hover/selection follow the background plugin's interface scheme
      // (body[data-ds-dark-theme], flipped by dsh-any-background): dark
      // surfaces tint BLACK — every label token is rewritten toward bright ink
      // on dark wallpapers, so any label-derived mix still reads as white.
      // Light surfaces keep the white mix.
      '.bw-row:hover,.bw-row.menu-open{background:color-mix(in srgb,#000 12%,transparent)}',
      'body:not([data-ds-dark-theme]) .bw-row:hover,body:not([data-ds-dark-theme]) .bw-row.menu-open{background:color-mix(in srgb,#fff 12%,transparent)}',
      '',
      '.bw-row-current{background:color-mix(in srgb,#000 18%,transparent)}',
      'body:not([data-ds-dark-theme]) .bw-row-current{background:color-mix(in srgb,#fff 20%,transparent)}',
      '',
      '.bw-row-icon{flex:none;width:16px;height:20px;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-tertiary,#9a9a9a)}',
      '.bw-chevron{flex:none;display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-caption,#adb2b8)}',
      '.bw-chevron-open .bw-arrow{transform:rotate(90deg)}',
      '.bw-container-row .bw-chevron{display:none}',
      '.bw-container-row:hover .bw-chevron,.bw-container-row.menu-open .bw-chevron{display:inline-flex}',
      '.bw-container-row:hover .bw-folder-cell,.bw-container-row.menu-open .bw-folder-cell{display:none}',
      '.bw-arrow{flex:none;display:inline-flex;transition:transform 150ms var(--ds-ease-in-out,ease-in-out)}',
      '@media (prefers-reduced-motion:reduce){.bw-arrow{transition:none}}',
      '.bw-folder-active{color:var(--dsw-alias-state-business-primary,#5b8def)}',
      // Hero picker rows (v0.22.0): hierarchy rides the row itself — an
      // indentation gutter, a folder chevron or workspace glyph, and the
      // trailing check. The row mirrors the primitives menu cell (same hover
      // and focus fill) because the fixed 14px icon cell of that row crops any
      // indentation nested inside it.
      '.bw-pick-row{display:flex;align-items:center;gap:6px;width:100%;min-height:30px;padding:4px 8px;border:none;border-radius:var(--dsw-radius-sm,8px);background:transparent;color:inherit;font:inherit;font-size:13px;cursor:pointer;text-align:left}',
      '.bw-pick-row:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.15))}',
      '.bw-pick-row:focus-visible{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.15));outline:none}',
      '.bw-pick-indent{flex:none}',
      '.bw-pick-glyph{flex:none;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;color:var(--dsw-alias-label-tertiary,#9a9a9a)}',
      '.bw-pick-glyph svg{width:16px;height:16px}',
      '.bw-pick-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.bw-pick-folder{font-weight:600}',
      '.bw-pick-check{flex:none;display:inline-flex;align-items:center;color:var(--dsw-alias-brand-primary,#5b8def)}',
      // overflow:hidden (needed for the ellipsis) clips the outline: 3px of
      // padding covers the widest rim (2px at the top of the slider). margin
      // cancels it, so text still starts and truncates where it did.
      '.bw-row-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:3px;margin:-3px}',
      '.bw-session-row .bw-row-label{padding:0;margin:0 6px 0 4px}',
      /* Marquee: Chromium keeps painting the ellipsis at the right edge of a
         scrolling ellipsis element (engine behavior; official rows share it).
         Switch to clip while scrolling — the fade masks carry both edges and
         the full heading reads cleanly; the resting state keeps ellipsis. */
      '.bw-session-row .bw-row-label[data-scrolled]{text-overflow:clip;mask-image:linear-gradient(to right,transparent,#000 12px);-webkit-mask-image:linear-gradient(to right,transparent,#000 12px)}',
      '.bw-session-row .bw-row-label[data-clipped]{mask-image:linear-gradient(to left,transparent,#000 12px);-webkit-mask-image:linear-gradient(to left,transparent,#000 12px)}',
      '.bw-session-row .bw-row-label[data-scrolled][data-clipped]{mask-image:linear-gradient(to right,transparent,#000 12px,#000 calc(100% - 12px),transparent);-webkit-mask-image:linear-gradient(to right,transparent,#000 12px,#000 calc(100% - 12px),transparent)}',
      '.bw-row-count{flex:none;display:none;font-size:12px;color:var(--dsw-alias-label-quaternary,#8a8a8a)}',
      '.bw-tree[data-bw-count] .bw-row-count{display:inline}',
      '.bw-row-time{flex:none;font-size:10px;line-height:16px;color:var(--dsw-alias-label-tertiary,#9a9a9a)}',
      // The outline is inherited from the row: the 10-12px meta column (session
      // count / relative time) opts out — stroked meta text outshines the title
      // it is supposed to support.
      '.bw-row-count,.bw-row-time{-webkit-text-stroke-width:0}',
      '.bw-row-trailing{flex:none;display:inline-flex;align-items:center;gap:6px;color:var(--dsw-alias-label-tertiary,#9a9a9a)}',
      '.bw-row-actions{flex:none;display:none;align-items:center;gap:15px}',
      '.bw-row:hover .bw-row-actions,.bw-row.menu-open .bw-row-actions{display:flex}',
      '.bw-row:hover .bw-row-time,.bw-row:hover .bw-row-count,.bw-row:hover .bw-row-trailing,.bw-row:hover .bw-pin-indicator,.bw-row.menu-open .bw-row-time,.bw-row.menu-open .bw-row-count,.bw-row.menu-open .bw-row-trailing,.bw-row.menu-open .bw-pin-indicator{display:none}',
      '.bw-row-archived .bw-row-label{color:var(--dsw-alias-label-caption,#8a8a8a)}',
      '.bw-pin-indicator{flex:none;display:inline-flex;align-items:center;justify-content:center;width:16px;height:20px;color:var(--dsw-alias-label-caption,#adb2b8);margin:0 0 0 6px}',
      '.bw-overflow-row{display:block;width:100%;text-align:left;border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#9a9a9a);font-size:12px;cursor:pointer;padding:4px 6px;font-family:inherit}',
      '.bw-overflow-row:hover{color:var(--dsw-alias-label-secondary,#b8b8b8)}',
      '.bw-dot{flex:none;width:6px;height:6px;border-radius:50%;background:transparent}',
      '.bw-session-row{font-size:14px;line-height:20px;color:var(--dsw-alias-label-primary,#e6e6e6);height:var(--bw-session-h,32px)}',
      '.bw-sgroup-row{font-size:14px;line-height:20px;color:var(--dsw-alias-label-tertiary,#9a9a9a);height:var(--bw-session-h,32px)}',
      '.bw-sgroup-row:hover{color:var(--dsw-alias-label-secondary,#b8b8b8)}',
      '.bw-session-row:hover{color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-empty{padding:28px 12px;text-align:center;font-size:13px;color:var(--dsw-alias-label-tertiary,#9a9a9a)}',
      // Archived-only empty state (dsh 0.1.7-rc.2 official EmptySessions): the
      // filter is a mode the user can get stuck in, so the body names it and
      // offers the way back.
      '.bw-empty-action{margin:8px auto 0;display:block;padding:0;border:none;background:none;cursor:pointer;font:inherit;font-size:13px;color:var(--dsw-alias-link,#5b8def)}',
      '.bw-empty-action:hover{text-decoration:underline}',
      // Session/workspace hover-card body (official Rows.module.css palette:
// fixed colors, independent of theme aliases).
      '.bw-hover-card{display:flex;flex-direction:column;gap:8px}',
      '.bw-hover-title{font-size:14px;line-height:20px;color:#FFFFFF;overflow-wrap:break-word}',
      '.bw-hover-path{font-size:12px;line-height:16px;color:#CFD3D6;word-break:break-all}',
      '.bw-hover-time{font-size:12px;line-height:16px;color:#CFD3D6}',
      '.bw-hover-status{display:flex;align-items:center;gap:8px;font-size:12px;line-height:20px;color:#ADB2B8}',
      '.bw-hover-archived svg{flex-shrink:0;margin:0 -4px}',
      '.bw-toast{position:absolute;left:10px;right:10px;bottom:12px;z-index:30;display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.3));border-radius:var(--dsw-radius-md,8px);background:var(--dsw-alias-toast-bg,var(--dsw-specific-menu,rgba(28,28,32,.92)));color:var(--dsw-alias-toast-label,var(--dsw-alias-label-primary,#e6e6e6));font-size:12px;box-shadow:0 8px 24px rgba(0,0,0,.35)}',
      '.bw-toast-text{flex:1;min-width:0}',
      '.bw-toast-close{flex:none;width:20px;height:20px;border:none;background:transparent;color:inherit;border-radius:var(--dsw-radius-xs,4px);display:grid;place-items:center;cursor:pointer;padding:0;opacity:.75}',
      '.bw-toast-close:hover{opacity:1;background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.15))}',
      '.bw-swatch{width:20px;height:20px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));cursor:pointer;flex:none;background:transparent;padding:0}',
      '.bw-swatch-wide{width:auto;min-width:38px;padding:0 8px;font-size:11px;color:var(--dsw-alias-label-secondary,#b8b8b8)}',
      '.bw-swatch-active{outline:2px solid var(--dsw-alias-brand-primary,#5b8def);outline-offset:1px}',
      '.bw-color-input{width:36px;height:26px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));border-radius:6px;background:transparent;cursor:pointer;padding:0}',
      '.bw-seg{display:flex;gap:6px;flex-wrap:wrap}',
      '.bw-seg-btn{height:24px;padding:0 10px;border-radius:var(--dsw-radius-sm,6px);border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));background:transparent;color:var(--dsw-alias-label-secondary,#b8b8b8);font-size:12px;cursor:pointer;font-family:inherit}',
      '.bw-seg-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.bw-seg-btn-active{background:var(--dsw-alias-brand-primary,#5b8def);border-color:transparent;color:var(--dsw-alias-brand-text,#fff)}',
      '.bw-seg-btn-active:hover{background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary,#5b8def));border-color:transparent}',
      '.bw-icon-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(30px,1fr));gap:4px}',
      '.bw-icon-cell{height:30px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));border-radius:6px;background:transparent;display:grid;place-items:center;color:var(--dsw-alias-label-secondary,#b8b8b8);cursor:pointer;padding:0}',
      '.bw-icon-cell:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-icon-cell-active{border-color:var(--dsw-alias-brand-primary,#5b8def);color:var(--dsw-alias-label-primary,#e6e6e6);outline:2px solid var(--dsw-alias-brand-primary,#5b8def);outline-offset:-2px}',
      '.bw-icon-none{width:12px;height:2px;background:currentColor;border-radius:1px;opacity:.7}',
      '.bw-rgb-row{display:flex;gap:10px;align-items:center}',
      '.bw-rgb-label{display:flex;align-items:center;gap:4px;font-size:11px;color:var(--dsw-alias-label-tertiary,#9a9a9a)}',
      '.bw-rgb-input{width:52px;height:26px;box-sizing:border-box;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));border-radius:6px;color:inherit;font-size:12px;padding:0 6px;font-family:inherit}',
      '.bw-ctx-overlay{position:fixed;inset:0;z-index:40}',
      '.bw-ctx-menu{position:fixed;min-width:170px;background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay,rgba(28,28,32,.72)));-webkit-backdrop-filter:var(--dsh-any-blur-card-panels,blur(12px) saturate(1.15));backdrop-filter:var(--dsh-any-blur-card-panels,blur(12px) saturate(1.15));border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.3));border-radius:var(--dsw-radius-sm,8px);padding:4px;box-shadow:0 8px 24px rgba(0,0,0,.35);display:flex;flex-direction:column}',
      '.bw-ctx-item{display:flex;align-items:center;gap:8px;height:28px;padding:0 10px;border:none;background:transparent;color:var(--dsw-alias-label-primary,#e6e6e6);font-size:13px;border-radius:var(--dsw-radius-sm,6px);cursor:pointer;text-align:left;font-family:inherit}',
      '.bw-ctx-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}',
      '.bw-ctx-danger{color:var(--dsw-alias-state-error-primary,#f85149)}',
      '.bw-ctx-sep{height:1px;background:var(--dsw-alias-border-l1,rgba(127,127,127,.2));margin:4px 6px}',
      '.bw-settings{display:flex;flex-direction:column;gap:6px;max-width:640px}',
      '.bw-plugin-card{list-style:none;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.18));border-radius:var(--dsw-radius-md,12px);background:var(--dsw-alias-bg-layer-3,rgba(127,127,127,.05));transition:border-color .16s,background .16s}',
      '.bw-plugin-card:hover{border-color:var(--dsw-alias-label-dimmed,#7a7a7a)}',
      '.bw-plugin-card-open{background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));border-color:var(--dsw-alias-label-dimmed,#7a7a7a)}',
      '.bw-plugin-head{width:100%;appearance:none;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px}',
      '.bw-plugin-head:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5b8def);outline-offset:-2px}',
      '.bw-plugin-headtext{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}',
      '.bw-plugin-name{font-size:15px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-plugin-desc{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary,#9a9a9a)}',
      '.bw-plugin-chevron{flex:none;color:var(--dsw-alias-label-tertiary,#9a9a9a);transition:transform .16s}',
      '.bw-plugin-chevron-open{transform:rotate(180deg)}',
      '.bw-plugin-body{border-top:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.18));margin:0 16px;padding:12px 0 16px}',
      '.bw-setting-row{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-secondary,#b8b8b8)}',
      '.bw-setting-label{flex:1;min-width:0;font-size:13px;line-height:1.5;color:var(--dsw-alias-label-secondary,#b8b8b8)}',
      '.bw-fold{border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.18));border-radius:10px;padding:4px 12px 12px;background:var(--dsw-alias-bg-layer-1,transparent)}',
      '.bw-fold .bw-stack{padding-top:10px}',
      '.bw-foldHead{display:flex;align-items:center;gap:8px;width:100%;appearance:none;background:none;border:0;padding:6px 0;font:inherit;font-size:13px;font-weight:600;letter-spacing:.02em;color:var(--dsw-alias-label-secondary,#b8b8b8);cursor:pointer;text-align:left}',
      '.bw-foldHead:hover{color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-foldHead:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5b8def);outline-offset:-2px}',
      '.bw-foldChevron{flex:none;display:inline-block;color:var(--dsw-alias-label-tertiary,#9a9a9a);transition:transform .16s}',
      '.bw-foldChevron.bw-foldChevronOpen{transform:rotate(90deg)}',
      '.bw-foldTitle{min-width:0;overflow-wrap:anywhere}',
      '.bw-switch{box-sizing:border-box;position:relative;flex:0 0 auto;width:36px;height:20px;padding:2px;border:0;border-radius:10px;background:var(--dsw-alias-border-l3,rgba(127,127,127,.3));cursor:pointer;transition:background 120ms ease}',
      '.bw-switch:hover{background:var(--dsw-alias-label-dimmed,#7a7a7a)}',
      '.bw-switch-on{background:var(--dsw-alias-brand-primary,#5b8def)}',
      '.bw-switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5b8def);outline-offset:2px}',
      '.bw-switch-thumb{display:block;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-primary-foreground,#fff);transition:transform 120ms ease}',
      '.bw-switch-on .bw-switch-thumb{transform:translateX(16px)}',
      '.bw-plugin-body .bw-hint{font-size:12px;color:var(--dsw-alias-label-tertiary,#9a9a9a)}',
      '.bw-rail{display:flex;flex-direction:column;align-items:center;gap:6px;padding:6px 0}',
      '.bw-rail-btn{width:36px;height:36px;border:none;background:transparent;border-radius:var(--dsw-radius-sm,8px);display:grid;place-items:center;color:var(--dsw-alias-label-secondary,#b8b8b8);cursor:pointer;padding:0}',
      '.bw-rail-btn:hover{background:color-mix(in srgb,#000 12%,transparent);color:var(--dsw-alias-label-primary,#e6e6e6)}',
      'body:not([data-ds-dark-theme]) .bw-rail-btn:hover{background:color-mix(in srgb,#fff 12%,transparent)}',
      '.bw-modal-body{display:flex;flex-direction:column;gap:10px;min-width:300px;max-width:380px;box-sizing:border-box}',
      // issue #10: Modal 高度契约 — 卡片按 Modal 的 padding box 限高,超高内容滚 contentClassName 区
      // (官方 RiskConfirmation 同款范式;.dialog 为 overflow:hidden,不限高则上下被裁)
      '.bw-custom-dialog{max-height:100%}',
      '.bw-custom-scroll{min-height:0;overflow-y:auto;overscroll-behavior:contain}',
      '@supports (height:100dvh){.bw-custom-dialog{max-height:calc(100dvh - 48px)}}',
      '.bw-field{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--dsw-alias-label-secondary,#b8b8b8)}',
      '.bw-appearance{display:flex;flex-direction:column;gap:10px}',
      '.bw-appearance-box{margin-top:8px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22));border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.06))}',
      '.bw-hint{font-size:11px;color:var(--dsw-alias-label-quaternary,#8a8a8a);line-height:1.5;white-space:normal;word-break:break-word}',
      '.bw-modal-actions{display:flex;justify-content:flex-end;gap:8px}',
      '.bw-btn{height:28px;padding:0 14px;border-radius:6px;font-size:13px;cursor:pointer;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));background:transparent;color:var(--dsw-alias-label-primary,#e6e6e6);font-family:inherit}',
      '.bw-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.bw-btn-primary{background:var(--dsw-alias-brand-primary,#5b8def);border-color:transparent;color:var(--dsw-alias-brand-text,#fff)}',
      '.bw-btn-primary:hover{background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary,#5b8def))}',
      '.bw-btn:disabled{opacity:.5;cursor:default}',
'.bw-error-text{font-size:13px;color:var(--dsw-alias-state-error-primary,#f85149);word-break:break-all;max-width:380px}',
      '.bw-dialog-input-row{display:flex;gap:6px;align-items:center}',
      '.bw-glow-row{display:flex;align-items:center;gap:10px}',
      '.bw-slider{flex:1;accent-color:var(--dsw-alias-brand-primary,#5b8def);height:22px}',
      '.bw-glow-value{min-width:44px;text-align:right;font-size:12px;color:var(--dsw-alias-label-secondary,#b8b8b8);font-variant-numeric:tabular-nums}',
      '.bw-preview{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px dashed var(--dsw-alias-border-l2,rgba(127,127,127,.3));border-radius:6px;min-height:28px}',
      '.bw-preview-icon{flex:none;display:grid;place-items:center;width:20px;height:20px;color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-preview-icon svg{width:18px;height:18px}',
      '.bw-preview-label{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:18px;padding:3px;margin:-3px}',
      '.bw-pulse{animation:bw-breathe 1.8s ease-in-out infinite}',
      '@keyframes bw-breathe{0%,100%{filter:drop-shadow(0 0 1px var(--bw-pulse-color));opacity:.55}50%{filter:drop-shadow(0 0 6px var(--bw-pulse-color));opacity:1}}',
      '.bw-pulse-text{animation:bw-breathe-text 1.8s ease-in-out infinite}',
      '@keyframes bw-breathe-text{0%,100%{text-shadow:0 0 1px var(--bw-pulse-color);opacity:.65}50%{text-shadow:0 0 7px var(--bw-pulse-color);opacity:1}}',
    ].join('')

    return { CSS_TEXT }
  },
})
