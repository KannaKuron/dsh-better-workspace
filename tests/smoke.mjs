// Smoke tests: pure helper/file-level, no Cordis runtime, no network.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

test('package.json declares a dual-face dsh web plugin', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.name, 'dsh-better-workspace')
  assert.equal(pkg.main, 'src/index.js')
  assert.equal(pkg.exports['./client'], './src/client.js')
  assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.ok(pkg.files.includes('src/client.js'), 'client entry must ship')
  assert.ok(pkg.files.includes('src/index.js'), 'host entry must ship')
})

test('package.json declares the dsh peers the 0.1.7+ compatibility gate reads', () => {
  // dsh 0.1.7-rc.1 enforces exactly one thing at install and boot
  // (packages/boot/app-boot/src/plugin-compatibility.ts): every
  // peerDependencies entry named `@deepseek-ai/dsh` or `@deepseek-ai/dsh-*`,
  // compared with prereleases participating. Without such an entry a plugin is
  // never validated at all, which is how this one used to be invisible to the
  // gate. The range mirrors engines.dsh and stays open-ended: an upper bound
  // would only disable the plugin on the next dsh line before any real break
  // was observed (dsh-any-background@0.3.0 was refused on 0.1.7-rc.1 for
  // exactly that).
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.peerDependencies['@deepseek-ai/dsh'], '>=0.2.2-alpha.2')
  // Both dsh peers must be OPTIONAL: the gate reads peerDependencies only, but
  // a package manager with autoInstallPeers (pnpm's default) resolves the range
  // against the registry — and every published version of both packages is a
  // prerelease, which a plain range excludes (ERR_PNPM_NO_MATCHING_VERSION).
  assert.equal(pkg.peerDependenciesMeta?.['@deepseek-ai/dsh']?.optional, true)
  assert.equal(pkg.peerDependenciesMeta?.['@deepseek-ai/dsh-settings']?.optional, true)
})

test('dsh.plugin.json version matches package.json', () => {
  const pkg = JSON.parse(read('package.json'))
  const manifest = JSON.parse(read('dsh.plugin.json'))
  assert.equal(manifest.id, 'dsh-external/dsh-better-workspace')
  assert.equal(manifest.version, pkg.version)
  assert.equal(manifest.main, './src/index.js')
})

test('cordis.patch.yml inserts exactly one plugin row', () => {
  const text = read('cordis.patch.yml')
  assert.match(text, /^- insert:/m)
  assert.match(text, /id: better-workspace/)
  assert.match(text, /name: 'dsh-better-workspace'/)
  const insertRows = text.match(/name: 'dsh-better-workspace'/g) || []
  assert.equal(insertRows.length, 2) // comment example + real row
})

test('package.json declares the dsh engine floor (plugin market requirement)', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.engines.node, '>=18')
  assert.equal(pkg.engines.dsh, '>=0.2.2-alpha.2')
})

test('client half is a __ModuleLoader__ bundle with baseline requires only', () => {
  const text = read('src/client.js')
  assert.match(text, /window\.__ModuleLoader__\.load\(/)
  assert.match(text, /id: 'dsh-better-workspace'/)
  const requires = [...text.matchAll(/require\('([^']+)'\)/g)].map((m) => m[1])
  const baseline = new Set([
    'react',
    'react/jsx-runtime',
    'react-dom',
    'react-dom/client',
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-client-store',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-ui-primitives',
  ])
  for (const specifier of requires) {
    assert.ok(baseline.has(specifier), 'non-baseline require: ' + specifier)
  }
  assert.ok(requires.length > 0, 'expected at least one require')
})

test('client half registers the expected seats (v0.12.1)', () => {
  const text = read('src/client.js')
  assert.match(text, /slots\.inject\('sidebar\.workspaces'/)
  assert.match(text, /priority: -1/, 'browser shadowing needs the lowest rank')
  // NO children declaration, ever (the v0.12.0 regression): a child-hole
  // declaration is EXCLUSIVE and the shipped browser entry keeps owning
  // 'sidebar.workspaces.directoryFlow' even after losing the render race —
  // re-declaring throws and silently unregisters this whole seat.
  assert.doesNotMatch(text, /children:\s*\{[^}]*directoryFlow/,
    'a children declaration for the directory-flow hole must never return')
  // v0.16.0: NEITHER directory-flow hole is occupied. Shadowing the sidebar
  // seat forfeits the child-hole render authorization for good (ui-renderer:
  // "not declared by this entry's children"), so the shipped occupant — the OS
  // chooser driver on native, the 1052-line in-app browser on browse — stays
  // with the official owners instead of a second-hand copy.
  assert.doesNotMatch(text, /slots\.inject\('sidebar\.workspaces\.directoryFlow'/,
    'the sidebar hole must stay official (v0.16.0)')
  assert.doesNotMatch(text, /slots\.inject\('conversation\.hero\.workspace\.directoryFlow'/,
    'the hero hole must stay official')
  // Settings ride BOTH host eras.
  assert.doesNotMatch(text, /settings\.plugin\.item/, 'the legacy settings-list seat must stay gone')
  assert.match(text, /slots\.inject\('plugins\.bundle\.config',[\s\S]*?key: 'dsh-better-workspace',/)
  assert.match(text, /props\.view === 'page'/)
})

test('hero picker: the sidebar tree shadows the shipped flat picker (v0.22.0)', () => {
  const text = read('src/client.js')
  // Same shadowing rule as the sidebar seat: lowest rank renders, and the
  // shipped entry keeps its registration (and its child-hole declaration).
  assert.match(text, /slots\.inject\('conversation\.hero\.workspace', guarded\(/)
  assert.match(text, /name: 'conversation\.hero\.workspace',\s*\n\s*priority: -1,/)
  // Still NO children declaration for the hero flow hole, and no injection
  // into the hole itself: the shipped occupant component is rendered from the
  // slot ledger (component + its own injected face) instead.
  assert.doesNotMatch(text, /'conversation\.hero\.workspace\.directoryFlow':\s*\{/)
  assert.match(text, /slots\.entries\(HERO_FLOW_HOLE\)/)
  assert.match(text, /function HeroWorkspacePicker\(props\)/)
  assert.match(text, /function PickerRow\(/)
  // The tree reads the SAME view-store selectors the sidebar reads, so a view
  // option changed on either surface moves both.
  assert.match(text, /workspaceGroupModeOf\(state && state\.workspaceGroupMode, state && state\.workspaceTitleSlash\)/)
  assert.match(text, /materializeChain\(compressTree\(f\)\)/)
  // Rows are the primitives' keyboard currency, and a host without that Menu
  // keeps the shipped picker instead of being left with no popover.
  assert.match(text, /role: 'menuitem'/)
  assert.match(text, /if \(typeof ui\.Menu === 'function'\) \{\s*\n\s*const heroInjected/)
})

test('customize dialog seeds the draft by row identity, not the rebuilt initial (v0.22.0)', () => {
  const text = read('src/client.js')
  assert.match(text, /function CustomizeDialog\(\{ open, seedKey, initial, defaults, kind, onChange, onReset, onClose, t \}\)/)
  assert.match(text, /seedKey: customize \? customize\.entryKey : undefined,/)
  assert.match(text, /\}, \[open, seedKey\]\)/)
  // A running Session re-renders the browser every few seconds; keying the
  // seed on the rebuilt initial object threw the operator's picks away.
  assert.doesNotMatch(text, /\}, \[open, initial\]\)/,
    'the rebuilt initial object must never re-seed the draft')
})

test('client plugin exports the cordis plugin triple', () => {
  const text = read('src/client.js')
  assert.match(text, /name: 'dsh-better-workspace'/)
  // dsh 0.1.7 removed the settingsScope service: a hard inject would leave
  // the fiber PENDING forever, so only era-guaranteed services stay; the
  // settings face is acquired softly (settingsScope) / optionally
  // (configForms) inside apply.
  assert.match(text, /inject: \['slots', 'sessions', 'workspaces', 'locale', 'uiWorkspace'\]/)
  assert.match(text, /ctx\.inject\(\['configForms'\]/)
  assert.doesNotMatch(text, /'uiWorkspace', 'settingsScope'/)
  assert.match(text, /function apply\(ctx\)/)
})

test('client half stays plain JavaScript (no import/JSX/TS syntax)', () => {
  const text = read('src/client.js')
  assert.doesNotMatch(text, /(^|\n)\s*import\s/)
  assert.doesNotMatch(text, /(^|\n)\s*export\s/)
  assert.doesNotMatch(text, /=> </, 'JSX arrow syntax is forbidden')
  assert.doesNotMatch(text, /:\s*(string|number|boolean)\b/, 'TypeScript annotations are forbidden')
  // Compiles as a function body (never executed — window is absent in Node).
  new Function(text)
})

/**
 * Extract the pure title-splitting helpers from the client bundle and run
 * them for real. Everything between splitPlainSegs and normPath is plain,
 * dependency-free JavaScript, so evaluating the slice in one Function scope
 * executes exactly what ships.
 */
const loadTitleSegs = () => {
  const text = read('src/client.js')
  const start = text.indexOf('const splitPlainSegs = (text) => {')
  const end = text.indexOf('const normPath =')
  assert.ok(start !== -1 && end !== -1 && start < end, 'splitting helpers not found')
  const scope = new Function(text.slice(start, end) + '\nreturn { splitTitleSegs }')
  return scope()
}

test('splitTitleSegs: paired quotes verbatim, lone quotes are plain text', () => {
  const { splitTitleSegs } = loadTitleSegs()
  // Unquoted slashes split (deliberate user grouping).
  assert.deepEqual(splitTitleSegs('插件开发/更好的左侧边栏'), ['插件开发', '更好的左侧边栏'])
  // Paired quotes: one verbatim leaf including the quote characters.
  assert.deepEqual(splitTitleSegs('“插件开发/更好的左侧边栏”'), ['“插件开发/更好的左侧边栏”'])
  assert.deepEqual(splitTitleSegs('"a/b" and c/d'), ['"a/b"', 'and c', 'd'])
  // A lone opener (no matching closer) is an ORDINARY character — 0.9.1
  // swallowed the rest of the title instead.
  assert.deepEqual(splitTitleSegs('插件开发/"abc'), ['插件开发', '"abc'])
  assert.deepEqual(splitTitleSegs('say “hello'), ['say “hello'])
  // A closer without an opener never started a span.
  assert.deepEqual(splitTitleSegs('a/b”c'), ['a', 'b”c'])
  // URL tail stays opaque from the first :// onward.
  assert.deepEqual(splitTitleSegs('see https://x.dev/a/b'), ['see https://x.dev/a/b'])
})

test('quote-on-land effect: blank-born only, user renames pinned, stability window', () => {
  const text = read('src/client.js')
  // Eligibility is keyed off an observed BLANK snapshot, not "first time seen".
  assert.match(text, /blankSeen\.add\(id\)/, 'blank birth mark must be recorded')
  assert.match(text, /!blankSeen\.has\(id\) \|\| touched\.has\(id\)/, 'untouched blankSeen/human guard')
  assert.doesNotMatch(text, /titledSeenRef/, '0.9.1 first-snapshot heuristic must be gone')
  // User renames route through the pinning wrapper; the automatic path alone
  // keeps the raw injected renameSession. 8 call sites: drag-into-session-group,
  // session rename dialog, session-group rename, the two group-move entry
  // points (single session / session-group batch), and the three v0.18.0
  // group-LEAVING moves (cross-group drop, workspace-row drop, menu entry).
  assert.match(text, /const renameByUser = \(sessionId, title\) => \{/)
  assert.equal((text.match(/renameByUser\(/g) || []).length, 8, 'exactly 8 user call sites')
  // The automatic quote waits out a stabilization window instead of racing
  // the async LLM name.
  assert.match(text, /TITLE_STABLE_MS = 20000/)
  assert.match(text, /prev\.title === text/, 'title change resets the window')
  assert.match(text, /\[list, stableTick\]/, 'stability tick re-runs the effect')
})

test('host half imports cleanly and applies without side effects', async () => {
  const plugin = await import('../src/index.js')
  assert.equal(plugin.name, 'dsh-better-workspace')
  assert.equal(typeof plugin.apply, 'function')
  let logged = ''
  plugin.apply({ logger: { info: (m) => { logged = String(m) } } })
  assert.match(logged, /dsh-better-workspace/)
  plugin.apply(undefined) // must not throw without a logger
})

/**
 * Host-half self-containment (0.21.1): `@deepseek-ai/schemastery` is a peer,
 * and a STATIC import of it made the whole row unloadable wherever the module
 * does not resolve (isolated profile / desktop runtime) — no fiber, no
 * `dsh.client` scan, no client half in the boot graph, and a silent fallback to
 * the official sidebar. The import must stay dynamic so the row always mounts.
 */
test('host half keeps its schemastery peer import lazy (0.21.1)', () => {
  const text = read('src/index.js')
  assert.doesNotMatch(text, /^import\s+\w+\s+from\s+'@deepseek-ai\/schemastery'/m, 'no static schemastery import may come back')
  assert.match(text, /await import\('@deepseek-ai\/schemastery'\)/, 'the module is resolved lazily')
  assert.match(text, /export const Config = Schema === null/, 'Config degrades to absent instead of throwing')
})

test('locale dictionaries cover every static t() key in both languages', () => {
  const text = read('src/client.js')
  const slice = (startMarker, endMarker) => {
    const start = text.indexOf(startMarker)
    assert.ok(start !== -1, 'missing block: ' + startMarker)
    const end = text.indexOf(endMarker, start)
    assert.ok(end !== -1, 'missing end marker for ' + startMarker)
    return text.slice(start, end)
  }
  const keysOf = (block) => new Set([...block.matchAll(/'([a-zA-Z][^']*)':/g)].map((m) => m[1]))
  const zhBlock = slice('const zh = {', 'const en = {')
  const enBlock = slice('const en = {', 'const LOCALES = {')
  const zhKeys = keysOf(zhBlock)
  const enKeys = keysOf(enBlock)
  assert.ok(zhKeys.size > 20, 'zh dictionary looks too small')
  assert.deepEqual([...enKeys].sort(), [...zhKeys].sort(), 'zh/en dictionaries must be key-aligned')
  const used = new Set([...text.matchAll(/\bt\('([^']+)'\)/g)].map((m) => m[1]))
  for (const key of used) {
    assert.ok(zhKeys.has(key), 't("' + key + '") missing from zh dictionary')
    assert.ok(enKeys.has(key), 't("' + key + '") missing from en dictionary')
  }
  // dynamic time keys
  for (const unit of ['minutes', 'hours', 'days', 'months', 'years']) {
    assert.ok(zhKeys.has('time.' + unit) && enKeys.has('time.' + unit), 'missing time.' + unit)
  }
})

// Same guard as dsh-ide-git's smoke suite. Every third-language block is
// preceded by a /* locale: <tag> */ marker, so the blocks can be sliced out of
// the file without parsing it. Equality matters because a key missing from a
// third language falls back to English at lookup time — a silent
// half-translated panel, which is exactly what this catches.
const SHIPPED_LOCALES = [
  'ar', 'de', 'fr', 'hi', 'id', 'it', 'ja', 'ko', 'nl', 'pl',
  'pt', 'ru', 'sv', 'th', 'tr', 'vi', 'zh-HK', 'zh-MO', 'zh-TW',
]

test('every shipped dictionary carries the same key set as zh', () => {
  const text = read('src/client.js')
  // Values may be single- OR double-quoted (apostrophe-bearing copy), so
  // the line pattern stops at the key's closing colon.
  const keyLines = (segment) => [...segment.matchAll(/^ +'([^']+)': (?!\{)/gm)].map((m) => m[1]).sort()
  const zhKeys = keyLines(text.slice(text.indexOf('const zh = {'), text.indexOf('const en = {')))
  assert.ok(zhKeys.length >= 80, 'the zh dictionary looks truncated: ' + zhKeys.length)

  const start = text.indexOf('const LOCALES = {')
  const end = text.indexOf('/* ============================= helpers', start)
  assert.ok(start !== -1 && end !== -1 && start < end, 'the LOCALES table is missing')
  const parts = text.slice(start, end).split('/* locale: ')
  assert.ok(
    parts.length - 1 >= SHIPPED_LOCALES.length,
    'expected at least ' + SHIPPED_LOCALES.length + ' third-language dictionaries, saw ' + (parts.length - 1),
  )
  const tags = []
  for (let index = 1; index < parts.length; index += 1) {
    const tag = parts[index].slice(0, parts[index].indexOf(' */'))
    tags.push(tag)
    assert.deepEqual(keyLines(parts[index]), zhKeys, 'dictionary ' + tag + ' does not match the zh key set')
  }
  assert.deepEqual(tags, SHIPPED_LOCALES, 'the shipped language list changed')
  // All dictionaries ride the one register call the host locale service reads;
  // a dropped locale here would leave that language on English.
  assert.match(
    text,
    /ctx\.locale\.register\(NS, Object\.assign\(\{ zh, en \}, LOCALES\)\)/,
    'every dictionary must be published through ctx.locale.register',
  )

  // Live switching is the host's job here. `t` is a seat the renderer binds
  // from the registration's locale: NS and rebuilds on every locale revision,
  // so nothing may resolve or capture a dictionary plugin-side — a
  // translatorOf / dictionaryFor (which dsh-ide-git needs only because its
  // panel is not a DSH slot) would fork that single source of truth and pin
  // the language until the next page load.
  assert.match(text, /locale: NS/, 'every registration must name the dictionary namespace')
  assert.doesNotMatch(
    text,
    /translatorOf|dictionaryFor|dictionaryOf\(/,
    'dictionary resolution belongs to the host locale service, not this plugin',
  )
})

/**
 * Cold-restart title fallback (0.9.4). The host list serves titles only from
 * the persisted projection cache; fork-born and never-checkpointed sessions
 * restart with title absent and displayTitle degraded to the workspace
 * basename. The plugin remembers last-known real wire titles and feeds them
 * through sessionTitleOf's third parameter.
 */
test('sessionTitleOf: wire title wins, remembered fills the cold-restart window', () => {
  const text = read('src/client.js')
  const start = text.indexOf('const sessionTitleOf =')
  const end = text.indexOf('/**', start)
  assert.ok(start !== -1 && end !== -1, 'sessionTitleOf not found')
  const { sessionTitleOf } = new Function(text.slice(start, end) + '\nreturn { sessionTitleOf }')()
  const t = (k) => k
  assert.equal(sessionTitleOf({ blank: true }, t, 'x'), 'session.new', 'blank stays New Session')
  assert.equal(sessionTitleOf({ title: 'wire/real' }, t, 'old/name'), 'wire/real', 'wire title beats memory')
  assert.equal(sessionTitleOf({ displayTitle: 'basename' }, t, 'web/前端'), 'web/前端', 'remembered beats the basename fallback')
  // v0.36.14 (issue #16): an unnamed row renders the official Untitled label.
  // The host displayTitle used to leak through as its basename fallback, so
  // every title-less session showed up as a duplicate workspace name.
  assert.equal(sessionTitleOf({ displayTitle: 'basename' }, t), 'session.untitled', 'no memory: official Untitled, never the basename')
  assert.equal(sessionTitleOf({ displayTitle: 'basename' }, t, ''), 'session.untitled', 'blank memory never masks the official label')
  assert.doesNotMatch(text.slice(start, end), /summary\.displayTitle/, 'the host displayTitle fallback must never reach a row')
  assert.equal(sessionTitleOf(undefined, t, 'x'), '', 'no summary renders nothing')
})

test('title cache: persisted key, batch learning, debounced save, bounded eviction (0.9.6)', async () => {
  const text = read('src/client.js')
  // 0.9.6 shape (issue #1): the cache is plain module state — no reactive
  // store, no per-session dispatch; one batch pass + one debounced save.
  assert.doesNotMatch(text, /createTitleCacheStore|actions\.rememberTitle/)
  assert.match(text, /const TITLE_CACHE_KEY = 'dsh\.betterWorkspace\.titles\.v1'/)
  // Learning discipline kept: only real wire titles (summary.title), never blank rows.
  assert.match(text, /if \(!summary \|\| summary\.blank\) continue/)
  assert.match(text, /typeof title !== 'string' \|\| title === ''\) continue/)
  assert.match(text, /titleCacheRef\.rememberAllTitles\(list\)/)
  // Rows render through the remembered fallback.
  // Rows render through the grafting wrapper (v0.30.2): display wins while
  // the wire title stays group-less; the fallback stays sessionTitleOf.
  assert.match(text, /const rowTitleOf = \(id, summary, graftedOn\) => \{/)
  assert.match(text, /return sessionTitleOf\(summary, t, rememberedTitleOf\(id\)\)/)
  assert.match(text, /title: rowTitleOf\(id, summary, prefsMap\.graftTitlePrefix !== false\)/)
  assert.match(text, /leaf: rowTitleOf\(id, summary, prefsMap\.graftTitlePrefix !== false\)/)
  assert.match(text, /rowTitleOf\(dialog\.sessionId, summary, prefsMap\.graftTitlePrefix !== false\)/)
  // Manual renames forget the grafted display (authoritative rename).
  assert.match(text, /forgetDisplay\(String\(sessionId\)\)/)
  // Drive the real block with a mocked localStorage.
  const start = text.indexOf('const TITLE_CACHE_LIMIT =')
  const end = text.indexOf('/* ======================= host settings sync')
  assert.ok(start !== -1 && end !== -1 && start < end, 'title cache block not found')
  const saved = new Map()
  const fakeLocalStorage = {
    getItem: (k) => (saved.has(k) ? saved.get(k) : null),
    setItem: (k, v) => { saved.set(k, String(v)) },
  }
  const scope = new Function('localStorage', 'setTimeout', 'clearTimeout',
    text.slice(start, end)
    + '\nreturn { titleCache, loadTitleCache, rememberAllTitles, graftTitleDisplay, TITLE_CACHE_LIMIT, TITLE_CACHE_KEEP }')
  const api = scope(fakeLocalStorage, setTimeout, clearTimeout)
  // Hydration: existing persisted state replaces the empty seed.
  saved.set('dsh.betterWorkspace.titles.v1', JSON.stringify({ byId: { old: { title: 'a/b', at: 1 } } }))
  api.loadTitleCache()
  assert.equal(api.titleCache.byId.old.title, 'a/b')
  // Batch learning: blank and empty-title rows never learn; real titles do.
  const list = { byId: { a: { title: 'web/one' }, b: { blank: true }, c: { title: '' }, d: { title: 'web/two' } } }
  assert.equal(api.rememberAllTitles(list), true, 'first pass learns')
  assert.ok(api.titleCache.byId.a && api.titleCache.byId.d)
  assert.ok(!api.titleCache.byId.b && !api.titleCache.byId.c)
  assert.equal(typeof api.titleCache.byId.a.at, 'number')
  // Same values again: nothing changes, nothing schedules a save.
  assert.equal(api.rememberAllTitles(list), false, 'unchanged pass is a no-op')
  // Eviction past the cap keeps the newest TITLE_CACHE_KEEP entries.
  const big = { byId: {} }
  for (let i = 0; i < api.TITLE_CACHE_LIMIT + 1; i++) big.byId['k' + i] = { title: 't' + i }
  api.rememberAllTitles(big)
  assert.equal(Object.keys(api.titleCache.byId).length, api.TITLE_CACHE_KEEP)
  assert.ok(api.titleCache.byId['k' + api.TITLE_CACHE_LIMIT], 'newest survives')
  assert.ok(!api.titleCache.byId.old, 'oldest evicted')
  // Debounced save lands under the same persist key (~200 ms).
  await new Promise((r) => setTimeout(r, 260))
  assert.ok(saved.has('dsh.betterWorkspace.titles.v1'), 'debounced save persisted')
  const persisted = JSON.parse(saved.get('dsh.betterWorkspace.titles.v1'))
  assert.ok(persisted && typeof persisted.byId === 'object')
  // v0.30.2 grafting: a fresh group-less title after a grouped one learns a
  // display entry; a grouped title stands verbatim and clears any display.
  assert.equal(typeof api.graftTitleDisplay, 'function')
  assert.equal(api.graftTitleDisplay('A/old', 'fresh'), 'A/fresh')
  assert.equal(api.graftTitleDisplay('A/B/old', 'fresh'), 'A/B/fresh')
  assert.equal(api.graftTitleDisplay('plain', 'fresh'), undefined, 'no prefix: nothing to keep')
  assert.equal(api.graftTitleDisplay(undefined, 'fresh'), undefined)
  assert.equal(api.graftTitleDisplay('A/old', ''), undefined, 'blank next never grafts')
  assert.equal(api.graftTitleDisplay('A/old', 'X/new'), undefined, 'a grouped next stands verbatim')
  assert.equal(api.graftTitleDisplay('A/', 'fresh'), undefined, 'empty leaf: no prefix to keep')
  const list2 = { byId: { g1: { title: 'A/one' }, g2: { title: 'X/two' } } }
  api.rememberAllTitles(list2)
  assert.equal(api.titleCache.byId.g1.display, undefined, 'first learn has no previous display')
  const list3 = { byId: { g1: { title: 'leafonly' } } }
  api.rememberAllTitles(list3)
  assert.equal(api.titleCache.byId.g1.title, 'leafonly')
  assert.equal(api.titleCache.byId.g1.display, 'A/leafonly', 'grafted display learned')
  const list4 = { byId: { g1: { title: 'Other/renamed' } } }
  api.rememberAllTitles(list4)
  assert.equal(api.titleCache.byId.g1.title, 'Other/renamed')
  assert.equal(api.titleCache.byId.g1.display, undefined, 'grouped rename clears the display')
})


test('manual cross-device sync: host scope bind, dual writes, pull modes', () => {
  const text = read('src/client.js')
  // Scope bound once per activation; failures degrade to browser-local.
  // v0.21.1: the probe goes through ctx.get — reading the service PROPERTY on
  // a host that never injected it throws on the cordis proxy ("cannot get
  // property \"settingsScope\" without inject"), which put a stack trace in the
  // console on every 0.1.7 boot.
  assert.match(text, /ctx\.get\('settingsScope'\)/, 'the soft probe reads the service without injecting it')
  assert.doesNotMatch(text, /ctx\.settingsScope/, 'the throwing property read is gone')
  assert.match(text, /typeof scopeHost\.bind === 'function'/)
  assert.match(text, /bind\(\{ namespace: 'better-workspace' \}\)/)
  // Dual-write wrappers exist and route every preference mutation through them.
  // v0.12.0 dropped the explicit-folder channel with the feature itself.
  assert.match(text, /const makeSharedWrites = \(actions, stylingMap\)/)
  assert.equal((text.match(/shared\.setStyling\(/g) || []).length, 2,
    'the customize dialog writes through the shared wrapper')
  assert.doesNotMatch(text, /shared\.(addFolder|removeFolder|renameFolder)\(/, 'explicit folders are gone (v0.12.0)')
  // Pull modes: overwrite replaces, merge unions with the pulled copy winning.
  assert.match(text, /importHost: \(d, host\)/)
  assert.match(text, /mergeHost: \(d, host\)/)
  // Surface detection picks the pull label direction.
  assert.match(text, /location\.protocol === 'dsh-app:'/)
  assert.match(text, /t\(IS_DESKTOP_SURFACE \? 'sync\.pull\.web' : 'sync\.pull\.desktop'\)/)
  // No automatic mirror/migration remains: sync is manual by user decision.
  assert.doesNotMatch(text, /useHostMirror/)
  assert.doesNotMatch(text, /HOST_SYNC_MARK/)
  for (const key of ['sync.pull.desktop', 'sync.pull.web', 'sync.mode.overwrite', 'sync.mode.merge', 'sync.push']) {
    assert.ok(text.includes("'" + key + "':"), 'missing dictionary key ' + key)
  }
})

/**
 * Appearance defaults + the derived text outline (0.10.0). The outline color is
 * never picked by hand: it is the pole that contrasts with the label color, so
 * it survives a theme or background-plugin light/dark flip.
 */
test('appearance: stroke ships OFF (v0.31.0, legacy ON preserved), gray color default, field-by-field merge (0.10.0)', () => {
  const text = read('src/client.js')
  const start = text.indexOf('const colorToRgb =')
  const end = text.indexOf('function FolderRow(')
  assert.ok(start !== -1 && end !== -1 && start < end, 'appearance helpers not found')
  const loaded = new Function(text.slice(start, end) +
    '\nreturn { DEFAULT_APPEARANCE, readAppearance, mergeAppearance, contrastStrokeColor, parseCssColor, strokeStyleOf }')()
  const { DEFAULT_APPEARANCE, readAppearance, mergeAppearance, contrastStrokeColor, parseCssColor, strokeStyleOf } = loaded
  // The outline ships OFF for fresh installs (v0.31.0): on a clean theme the
  // rim reads as embossed noise, and only a background image ever needed it.
  assert.equal(DEFAULT_APPEARANCE.stroke, false)
  assert.equal(DEFAULT_APPEARANCE.strokeWidth, 1)
  assert.equal(DEFAULT_APPEARANCE.color, '')
  assert.equal(DEFAULT_APPEARANCE.strokeColor, '#808080', 'the outline defaults to gray')
  // Hydration replaces state wholesale: every read tolerates missing keys.
  // Upgrade semantics follow workspaceSlashOf: a hydrated snapshot WITHOUT an
  // appearance record predates the flip and keeps the legacy ON outline; the
  // shipped OFF reaches users only through init's baked record (asserted at
  // the end of this test) or through an explicit value.
  assert.deepEqual(readAppearance(undefined), { color: '', glow: 0, weight: 0, shadow: false, stroke: true, strokeWidth: 1, strokeColor: '#808080' }, 'missing keys fall back, stroke to the LEGACY on')
  assert.equal(readAppearance({}).stroke, true, 'a missing stroke key keeps the legacy outline')
  assert.equal(readAppearance({}).strokeColor, '#808080', 'a missing color key keeps the gray default')
  assert.equal(readAppearance({ stroke: true }).stroke, true, 'an explicit on survives')
  assert.equal(readAppearance({ stroke: false }).stroke, false, 'an explicit off survives')
  assert.equal(readAppearance({ strokeWidth: 99 }).strokeWidth, 2, 'width clamps to the slider range')
  assert.equal(readAppearance({ strokeWidth: 0 }).strokeWidth, 1, 'a zero width falls back to the default')
  // Row entries override the default FIELD BY FIELD: entries written before the
  // outline existed still inherit the effective base of their install.
  const merged = mergeAppearance(readAppearance(undefined), { color: '#f85149', glow: 6 })
  assert.equal(merged.color, '#f85149')
  assert.equal(merged.glow, 6)
  assert.equal(merged.stroke, true, 'older entries inherit the legacy outline')
  assert.equal(merged.strokeWidth, 1)
  assert.equal(mergeAppearance(DEFAULT_APPEARANCE, { color: '#f85149' }).stroke, false, 'fresh installs inherit OFF')
  assert.equal(mergeAppearance(DEFAULT_APPEARANCE, { stroke: false }).stroke, false, 'a row can turn it off')
  assert.equal(mergeAppearance(DEFAULT_APPEARANCE, { stroke: true }).stroke, true, 'a row can turn it on')
  // The pole follows the LABEL color (WCAG contrast against both poles).
  assert.equal(contrastStrokeColor([255, 255, 255]), '#000000')
  assert.equal(contrastStrokeColor([0, 0, 0]), '#ffffff')
  assert.equal(contrastStrokeColor([230, 230, 230]), '#000000')
  assert.equal(contrastStrokeColor([91, 141, 239]), '#000000')
  assert.equal(contrastStrokeColor(null), '#000000')
  assert.equal(parseCssColor('rgb(230, 230, 230)')[0], 230)
  assert.equal(parseCssColor('rgba(18, 18, 20, 0.9)')[2], 20)
  assert.equal(parseCssColor('color(srgb 0.9 0.9 0.9)')[0], 229.5, 'color(srgb ...) is understood too')
  assert.equal(parseCssColor('nonsense'), null)
  // Custom colors compute their own pole; rows without one read the sampled
  // variable so a palette flip needs no React render.
  assert.equal(strokeStyleOf({ color: '#ffffff', stroke: true, strokeWidth: 2 }).WebkitTextStrokeColor, '#808080', 'gray is the default pick')
  assert.equal(strokeStyleOf({ color: '#ffffff', stroke: true, strokeWidth: 2, strokeColor: '#f85149' }).WebkitTextStrokeColor, '#f85149', 'a picked color wins')
  assert.equal(strokeStyleOf({ color: '#ffffff', stroke: true, strokeWidth: 2, strokeColor: 'not-a-color' }).WebkitTextStrokeColor, '#808080', 'a malformed pick falls back to gray')
  assert.equal(strokeStyleOf({ color: '#ffffff', stroke: true, strokeWidth: 2, strokeColor: 'auto' }).WebkitTextStrokeColor, '#000000', 'auto derives the pole')
  assert.equal(strokeStyleOf({ color: '#0b0b0b', stroke: true, strokeWidth: 1, strokeColor: 'auto' }).WebkitTextStrokeColor, '#ffffff')
  assert.match(strokeStyleOf({ color: '', stroke: true, strokeWidth: 1, strokeColor: 'auto' }).WebkitTextStrokeColor, /--bw-stroke-color/)
  // paint-order hides the inner half of the band, so the painted width is TWICE
  // the rim the slider promises: painting the configured value left a 0.5px rim
  // that antialiasing blended away into the pale, uneven edge users reported.
  assert.equal(strokeStyleOf({ color: '#ffffff', stroke: true, strokeWidth: 1 }).WebkitTextStrokeWidth, '2px', 'a 1px rim is painted 2px wide')
  assert.equal(strokeStyleOf({ color: '#ffffff', stroke: true, strokeWidth: 2 }).WebkitTextStrokeWidth, '4px')
  assert.equal(strokeStyleOf({ color: '#ffffff', stroke: true, strokeWidth: 2 }).paintOrder, 'stroke fill')
  assert.equal(strokeStyleOf({ color: '#fff', stroke: false }), null, 'off renders no stroke style')
  // 0.11.1's offset-copy rim is gone: eight directions are four diagonal
  // samples, so slopes and curves came out as detached blocks.
  assert.doesNotMatch(text, /STROKE_DIRECTIONS|strokeShadowsOf/, 'the rim must stay a real geometric stroke')
  // Host schema + cross-device sync carry the new field.
  assert.match(read('src/index.js'), /appearance: Schema\.dict/, 'host namespace must declare appearance')
  assert.match(text, /host\.appearance && typeof host\.appearance === 'object'/, 'pull paths must carry appearance')
  assert.match(text, /scopeSet\('appearance'/, 'the push path must carry appearance')
  assert.match(text, /--bw-stroke-color/, 'the sampled variable is what unattributed rows read')
  // Fresh installs never hydrate: createViewStore's init bakes the shipped
  // default (stroke OFF) into prefs.appearance, and the baked literal must
  // stay in lockstep with DEFAULT_APPEARANCE.
  const initPrefs = /prefs: \{ compactChains: true, sessionLimit: 0, appearance: \{([^}]*)\}/.exec(text)
  assert.ok(initPrefs, 'init must bake an appearance record for fresh installs')
  const baked = {}
  for (const pair of initPrefs[1].matchAll(/(\w+): ('[^']*'|[^,}]+)/g)) baked[pair[1]] = String(pair[2]).replace(/^'|'$/g, '')
  assert.equal(baked.stroke, String(DEFAULT_APPEARANCE.stroke), 'init appearance must match DEFAULT_APPEARANCE.stroke')
  assert.equal(baked.strokeWidth, String(DEFAULT_APPEARANCE.strokeWidth), 'init appearance must match DEFAULT_APPEARANCE.strokeWidth')
  assert.equal(baked.strokeColor, DEFAULT_APPEARANCE.strokeColor, 'init appearance must match DEFAULT_APPEARANCE.strokeColor')
})

/**
 * Outline clipping + meta-column rules (0.10.1): an outer outline overflows the
 * glyph box, so the label's overflow:hidden (needed for the ellipsis) cut it off
 * at the left edge; the 11px meta column must not be stroked at all.
 */
test('outline: label keeps a bleed, meta column stays unstroked (0.10.1)', () => {
  const text = read('src/client.js')
  assert.match(text, /\.bw-row-label\{[^}]*padding:3px;margin:-3px/, 'the label needs a bleed for the rim')
  assert.match(text, /\.bw-row-label\{[^}]*overflow:hidden/, 'the ellipsis overflow must stay')
  assert.match(text, /\.bw-preview-label\{[^}]*padding:3px;margin:-3px/, 'the preview label bleeds too')
  assert.match(text, /\.bw-row-count,\.bw-row-time\{-webkit-text-stroke-width:0\}/, 'count/time must not be stroked')
  // The rim never travels through text-shadow, so the halo and the breathing
  // keyframes keep working exactly as they did before 0.11.1.
  assert.doesNotMatch(text, /--bw-stroke-shadow|--bw-glow-shadow|--bw-text-glow/, 'the rim must not ride in text-shadow')
  assert.match(text, /@keyframes bw-breathe-text\{0%,100%\{text-shadow:0 0 1px var\(--bw-pulse-color\)/, 'the pulse keyframes are untouched')
})

/**
 * Icon compatibility (0.10.2): dsh 0.1.6-alpha.1 replaced part of the
 * primitives icon set (IconSendOutline16 -> IconPaperPlaneOutline14 and
 * friends), so a persisted custom icon naming a retired glyph must resolve to a
 * surviving equivalent instead of rendering an empty cell.
 */
test('icons: retired glyphs resolve to a survivor; the picker follows the host set (0.10.2)', () => {
  const text = read('src/client.js')
  const start = text.indexOf('const ICON_ALIASES =')
  const end = text.indexOf('/** Render a primitives icon by name')
  assert.ok(start !== -1 && end !== -1 && start < end, 'icon resolution helpers not found')
  const load = (ui) => new Function('ui', text.slice(start, end) + '\nreturn { resolveIconName }')(ui)

  const oldUi = { IconSendOutline16: () => null, IconSendOutline14: () => null, IconSearchOutline16: () => null }
  assert.equal(load(oldUi).resolveIconName('IconSendOutline16'), 'IconSendOutline16', 'a live glyph is used as-is')
  assert.equal(load(oldUi).resolveIconName('IconNope'), '', 'an unknown glyph degrades to empty')
  assert.equal(load(oldUi).resolveIconName(''), '')
  assert.equal(load(oldUi).resolveIconName(undefined), '')
  assert.equal(load(oldUi).resolveIconName('solid'), '', 'legacy slots are not glyph names')

  const added = ['IconPaperPlaneOutline14', 'IconShieldOutline16', 'IconCompactOutline16', 'IconWrapLinesOutline16', 'IconPlanOutline14']
  const newUi = { IconSendOutline14: () => null }
  for (const name of added) newUi[name] = () => null
  assert.equal(load(newUi).resolveIconName('IconSendOutline16'), 'IconSendOutline14', 'a retired glyph follows its alias chain')
  assert.equal(load(newUi).resolveIconName('IconSendOutline14'), 'IconSendOutline14')
  assert.equal(load({}).resolveIconName('IconSendOutline16'), '', 'an alias with no survivor stays empty rather than crashing')

  const choicesStart = text.indexOf('const ICON_CHOICES = [')
  const choicesEnd = text.indexOf('})()', choicesStart) + 4
  assert.ok(choicesStart !== -1 && choicesEnd > choicesStart, 'icon choice list not found')
  const aliasCode = text.slice(start, end)
  const pickerCode = aliasCode + '\n' + text.slice(choicesStart, choicesEnd)
  const listOf = (ui) => new Function('ui', pickerCode + '\nreturn { ICON_CHOICES, ICON_PICKER_CHOICES }')(ui)
  const onNew = listOf(newUi)
  assert.ok(!onNew.ICON_CHOICES.includes('IconSendOutline16'), 'the retired name is gone from the committed list')
  assert.ok(onNew.ICON_CHOICES.includes('IconSendOutline14'), 'the surviving glyph is committed')
  assert.ok(onNew.ICON_PICKER_CHOICES.includes('IconSendOutline14'), 'the surviving glyph is offered')
  assert.equal(new Set(onNew.ICON_PICKER_CHOICES).size, onNew.ICON_PICKER_CHOICES.length, 'no duplicate cells')
  assert.ok(onNew.ICON_PICKER_CHOICES.includes('solid') && onNew.ICON_PICKER_CHOICES.includes('none'), 'legacy slots always survive')
  assert.ok(onNew.ICON_PICKER_CHOICES.length < onNew.ICON_CHOICES.length, 'glyphs this host lacks are filtered out')
  for (const name of added) {
    assert.ok(onNew.ICON_CHOICES.includes(name), name + ' is part of the committed list')
    assert.ok(onNew.ICON_PICKER_CHOICES.includes(name), name + ' is offered on a host that exports it')
  }
  // A host that lacks the newer glyphs still offers the survivors, never them.
  const bare = listOf({ IconSendOutline14: () => null })
  for (const name of added) assert.ok(!bare.ICON_PICKER_CHOICES.includes(name), name + ' must be filtered out on a host that lacks it')
  assert.ok(bare.ICON_PICKER_CHOICES.includes('IconSendOutline14'), 'the survivor stays offered')
})

/**
 * dsh 0.1.7-rc.1 added exactly two glyphs to the primitives set (the users
 * pair used by the agent-team / subagent surfaces). Invariant 12: a new glyph
 * is committed to the candidate list first; the runtime filter is what keeps a
 * host without it from rendering an empty cell. The generation fallback must
 * also land the historical pixel-suffix spelling on the new name.
 */
test('icons: the 0.1.7-rc.1 users pair is committed and host-filtered (0.21.1)', () => {
  const text = read('src/client.js')
  const start = text.indexOf('const ICON_ALIASES =')
  const end = text.indexOf('/** Render a primitives icon by name')
  const choicesStart = text.indexOf('const ICON_CHOICES = [')
  const choicesEnd = text.indexOf('})()', choicesStart) + 4
  const pickerCode = text.slice(start, end) + '\n' + text.slice(choicesStart, choicesEnd)
  const listOf = (ui) => new Function('ui', pickerCode + '\nreturn { ICON_CHOICES, ICON_PICKER_CHOICES, resolveIconName }')(ui)

  const pair = ['IconUsersOutlineRegular', 'IconUsersOutlineMedium']
  const rc1 = { IconFolderOpenRegular: () => null }
  for (const name of pair) rc1[name] = () => null
  const onRc1 = listOf(rc1)
  for (const name of pair) {
    assert.ok(onRc1.ICON_CHOICES.includes(name), name + ' is committed to the candidate list')
    assert.ok(onRc1.ICON_PICKER_CHOICES.includes(name), name + ' is offered on a host that exports it')
  }
  assert.equal(
    onRc1.resolveIconName('IconUsersOutline16'), 'IconUsersOutlineRegular',
    'the pixel-suffix spelling lands on the new generation name',
  )
  // Pre-0.1.7 hosts: the pair is unknown, so both disappear from the grid
  // (never an empty cell) while the legacy spellings keep resolving.
  const oldHost = listOf({ IconFolderOpen16: () => null })
  for (const name of pair) {
    assert.ok(!oldHost.ICON_PICKER_CHOICES.includes(name), name + ' must not become an empty icon cell on an old host')
    assert.equal(oldHost.resolveIconName(name), '', name + ' resolves to nothing there')
  }
  assert.ok(oldHost.ICON_PICKER_CHOICES.includes('IconFolderOpen16'), 'the host’s own legacy spellings stay offered')
  assert.ok(oldHost.ICON_PICKER_CHOICES.includes('solid') && oldHost.ICON_PICKER_CHOICES.includes('none'), 'legacy slots always survive')
})

/**
 * Session reorder fallback (0.10.2): dsh 0.1.6-alpha.1 stopped injecting
 * insertSessionBefore, which used to be the only reorder channel — the browser
 * keeps its own flat order so the gesture keeps working.
 */
test('session reorder: host action preferred, browser-local order as the fallback (0.10.2)', () => {
  const text = read('src/client.js')

  const start = text.indexOf('function reorderIds(ids, id, anchor)')
  const end = text.indexOf('const countSessionTree = (node) =>')
  assert.ok(start !== -1 && end !== -1 && start < end, 'reorderIds not found')
  const { reorderIds } = new Function(text.slice(start, end) + '\nreturn { reorderIds }')()
  assert.deepEqual(reorderIds(['a', 'b', 'c'], 'c', 'a'), ['c', 'a', 'b'], 'move before an anchor')
  assert.deepEqual(reorderIds(['a', 'b', 'c'], 'a', 'c'), ['b', 'a', 'c'])
  assert.deepEqual(reorderIds(['a', 'b', 'c'], 'a', undefined), ['b', 'c', 'a'], 'no anchor appends')
  assert.deepEqual(reorderIds(['a', 'b', 'c'], 'b', 'gone'), ['a', 'c', 'b'], 'a vanished anchor appends')
  assert.deepEqual(reorderIds([], 'a', undefined), ['a'])
  assert.deepEqual(reorderIds(undefined, 'a', undefined), ['a'], 'a missing list is tolerated')

  // Store action: hydration replaces state wholesale, so a state persisted
  // before this key existed must still accept the write.
  const storeStart = text.indexOf('const createViewStore = () => storeKit.defineStore({')
  const storeEnd = text.indexOf('/* ========================= title cache store')
  assert.ok(storeStart !== -1 && storeEnd !== -1 && storeStart < storeEnd, 'view store not found')
  const def = new Function('storeKit', text.slice(storeStart, storeEnd) + '\nreturn createViewStore()')({ defineStore: (d) => d })
  assert.deepEqual(def.init().sessionOrder, {}, 'init carries the new key')
  const setSessionOrder = def.actions.setSessionOrder
  const stale = { folders: [] }
  setSessionOrder(stale, 'ws1', ['a', 'b'])
  assert.deepEqual(stale.sessionOrder.ws1, ['a', 'b'])
  setSessionOrder(stale, 'ws1', [])
  assert.equal('ws1' in stale.sessionOrder, false, 'an empty order clears the entry')
  setSessionOrder(stale, 'ws2', undefined)
  assert.equal('ws2' in stale.sessionOrder, false)
  setSessionOrder(stale, 'ws3', 'not-a-list')
  assert.equal('ws3' in stale.sessionOrder, false)

  // Wiring: the host action stays authoritative; the local order only applies
  // where the host no longer injects one.
  assert.match(text, /typeof insertSessionBefore === 'function' \? \[\] : sessionOrderOf\(workspace\.workspaceId\)/,
    'the host order must win wherever the action exists')
  assert.match(text, /actions\.setSessionOrder\(workspaceId, reorderIds\(flat\.map/,
    'the fallback commits the move into the local order')
  assert.match(text, /const sessionOrderMap = useStore \? \(useStore\(s => s\.sessionOrder\) \|\| \{\}\) : \{\}/,
    'the browser subscribes to the local order')
  // v0.18.0 wrapped the commit in a `reorder` closure — the cross-group rename
  // runs first, then the order. What this guards is unchanged: the host
  // channel is still tried before the browser-local fallback.
  const dropStart = text.indexOf('const commitSessionDrop = (workspaceId, targetSessionId, half) => {')
  const dropEnd = text.indexOf('const commitSessionMoveOut = (workspaceId) => {', dropStart)
  assert.ok(dropStart !== -1 && dropEnd !== -1 && dropStart < dropEnd, 'the session drop commit is missing')
  const dropBody = text.slice(dropStart, dropEnd)
  assert.ok(
    dropBody.indexOf("typeof insertSessionBefore === 'function'") < dropBody.indexOf('actions.setSessionOrder'),
    'the host channel is tried first in the drop commit',
  )
})

/**
 * The two-layer tree (v0.12.0). Disk nesting follows the official
 * owningParentFolder semantics — a workspace row nests under its nearest
 * registered ancestor directory, no virtual nodes for unregistered paths —
 * while name groups ("/" in titles) live INSIDE each level. This drives
 * buildTree for real across both layers.
 */
test('buildTree: disk nesting + name groups inside each level (0.12.0)', () => {
  const text = read('src/client.js')
  const helpers = new Function(text.slice(
    text.indexOf('const basename ='),
    text.indexOf('const splitPlainSegs ='),
  ) + text.slice(
    text.indexOf('const splitPlainSegs ='),
    text.indexOf('const normPath ='),
  ) + text.slice(
    text.indexOf('const DISK_SEP ='),
    text.indexOf('const countWorkspaces ='),
  ) + '\nreturn { buildTree, diskParentMapOf, normDiskPath }')()
  const { buildTree, diskParentMapOf, normDiskPath } = helpers

  // Windows paths normalize for comparison without interpreting POSIX
  // backslashes as separators.
  assert.equal(normDiskPath('C:\\Users\\kanna'), 'C:/Users/kanna')
  assert.equal(normDiskPath('/home/u/'), '/home/u')

  const items = [
    { workspaceId: 'a', title: 'web/前端', path: '/home/u/web' },
    { workspaceId: 'b', title: 'api', path: '/home/u/web/api' },
    { workspaceId: 'c', title: 'web/后端', path: '/home/u/other' },
    { workspaceId: 'd', title: 'deep/nested/x', path: '/home/u/web/api/d' },
    { workspaceId: 'top', title: '独立', path: '/srv' },
  ]
  // Disk ancestry: b and d nest under a; nothing nests under c (its
  // directory /home/u/other has no registered child).
  const parents = diskParentMapOf(items)
  assert.equal(parents.get('a'), undefined)
  assert.equal(parents.get('b'), 'a')
  assert.equal(parents.get('d'), 'b')
  assert.equal(parents.get('top'), undefined)

  const tree = buildTree(items)
  // Root level: one name group (web) holding a and c; the standalone row.
  assert.deepEqual(tree.folders.map((f) => f.name), ['web'])
  assert.deepEqual(tree.folders[0].workspaces.map((w) => w.workspaceId), ['a', 'c'])
  assert.deepEqual(tree.workspaces.map((w) => w.workspaceId), ['top'])
  // a's disk children form a nested LEVEL with its own name groups.
  const a = tree.folders[0].workspaces[0]
  assert.ok(a.sub, 'a has nested workspaces')
  assert.deepEqual(a.sub.workspaces.map((w) => w.workspaceId), ['b'])
  assert.deepEqual(a.sub.folders, [], "b's title has no '/', so a's nested level holds no name groups")
  // Sub-level folder identity keys carry the owning chain so same-named
  // groups in different levels never share expansion/styling state.
  // (checked on b's nested level below, where d's title forms groups)
  // d (b's disk child) sits inside b's sub level, inside the deep group.
  const b = a.sub.workspaces[0]
  assert.ok(b.sub)
  // d's title 'deep/nested/x' forms the chain deep → nested inside b's level.
  assert.deepEqual(b.sub.folders.map((f) => f.name), ['deep'])
  assert.deepEqual(b.sub.folders[0].folders.map((f) => f.name), ['nested'])
  assert.deepEqual(b.sub.folders[0].folders[0].workspaces.map((w) => w.workspaceId), ['d'])
  assert.equal(b.sub.folders[0].idPath, 'a//b//deep')
  // c has no nested level: sub is null, the row stays a leaf.
  assert.equal(tree.folders[0].workspaces[1].sub, null)
})

/**
 * View options (v0.13): the official group/order menu plus the two
 * slash-grouping toggles. Guards the store contract (defaults in init,
 * fallback reads), the toggle-aware tree builders, and the menu wiring
 * (feature-probed primitives Menu, disabled rows for options that cannot
 * affect the current mode, anchor suppression while recency sorts).
 */
test('view options: group/order menu + the two slash toggles (0.13.0)', () => {
  const text = read('src/client.js')
  // v0.15: the workspace name layer ships OFF (see the opt-in test below);
  // session grouping keeps its 0.13 default.
  assert.match(text, /groupBy: 'workspace-tree', orderBy: 'manual', archivedFilter: 'default', workspaceGroupMode: 'disk', sessionTitleSlash: true, workspaceTitleSlash: false, ungroupedOpen: true/)
  // v0.20.0: the archived filter rides the same store (official mirror).
  assert.match(text, /setArchivedFilter: \(d, value\)/)
  assert.match(text, /useStore\(s => s\.archivedFilter\) \|\| 'default'/)
  // v0.21.0: grouping strategy, collapsible Ungrouped, listing quota.
  assert.match(text, /setWorkspaceGroupMode: \(d, value\)/)
  assert.match(text, /setUngroupedOpen: \(d, value\)/)
  // v0.31.0: init bakes prefs.appearance (stroke ships OFF) for fresh installs.
  assert.match(text, /prefs: \{ compactChains: true, sessionLimit: 0, appearance: \{ color: '', glow: 0, weight: 0, shadow: false, stroke: false, strokeWidth: 1, strokeColor: '#808080' \} \}/)
  assert.match(text, /useStore\(s => s\.ungroupedOpen\) !== false/)
  for (const action of ['setGroupBy', 'setOrderBy', 'setSessionTitleSlash', 'setWorkspaceTitleSlash']) {
    assert.ok(text.includes(action + ': (d, value)'), 'store action ' + action)
  }
  assert.match(text, /useStore\(s => s\.groupBy\) \|\| 'workspace-tree'/)
  assert.match(text, /useStore\(s => s\.sessionTitleSlash\) !== false/)

  const helpers = new Function(text.slice(
    text.indexOf('const basename ='),
    text.indexOf('const splitPlainSegs ='),
  ) + text.slice(
    text.indexOf('const splitPlainSegs ='),
    text.indexOf('const normPath ='),
  ) + text.slice(
    text.indexOf('function buildSessionTree'),
    text.indexOf('function reorderIds'),
  ) + text.slice(
    text.indexOf('const DISK_SEP ='),
    text.indexOf('const countWorkspaces ='),
  ) + '\nreturn { buildTree, buildSessionTree }')()
  const { buildTree, buildSessionTree } = helpers

  const items = [
    { workspaceId: 'a', title: 'web/前端', path: '/home/u/web' },
    { workspaceId: 'b', title: 'api', path: '/home/u/web/api' },
  ]
  // 'disk' strategy: no name layer — workspaces mount straight at their disk
  // level; the DISK layer is a filesystem fact and survives.
  const flat = buildTree(items, 'disk')
  assert.deepEqual(flat.folders, [], 'no name groups')
  assert.deepEqual(flat.workspaces.map((w) => w.workspaceId), ['a'])
  assert.equal(flat.workspaces[0].leaf, 'web/前端', 'leaf keeps the full title')
  assert.equal(flat.workspaces[0].folderPath, '')
  assert.ok(flat.workspaces[0].sub, 'disk nesting survives')
  assert.equal(flat.workspaces[0].sub.workspaces[0].leaf, 'api')
  // 'slash' strategy (issue #7): name groups WITHOUT disk nesting — b is no
  // longer inferred to be a's child from the shared directory.
  const slashOnly = buildTree(items, 'slash')
  assert.equal(slashOnly.workspaces.map((w) => w.workspaceId).join(','), 'b', 'no disk inference at the root')
  assert.equal(slashOnly.folders.length, 1, 'the slash of the title groups')
  assert.equal(slashOnly.folders[0].name, 'web')
  assert.equal(slashOnly.folders[0].workspaces[0].leaf, '前端')
  assert.equal(slashOnly.folders[0].workspaces[0].sub, null, 'no disk children exist')
  // 'disk-slash' strategy: both layers, the historical workspaceSlash-on shape.
  const both = buildTree(items, 'disk-slash')
  assert.equal(both.folders[0].workspaces[0].leaf, '前端')
  assert.ok(both.folders[0].workspaces[0].sub, 'disk nesting survives under the name folder')
  assert.equal(both.folders[0].workspaces[0].sub.workspaces[0].leaf, 'api')

  const rows = [
    { id: '1', title: 'proj/设计' },
    { id: '2', title: 'plain' },
  ]
  // Session slash toggle OFF: every row at the root, full title as leaf.
  const sess = buildSessionTree(rows, false)
  assert.deepEqual(sess.groups, [])
  assert.deepEqual(sess.sessions.map((s) => s.leaf), ['proj/设计', 'plain'])
  // Default (toggle on) keeps the founding grouping behavior.
  const grouped = buildSessionTree(rows, true)
  assert.equal(grouped.groups.length, 1)
  assert.equal(grouped.groups[0].name, 'proj')

  // The menu mirrors the official ViewOptionsMenu and feature-probes Menu;
  // options that cannot affect the current mode render disabled.
  assert.match(text, /function ViewOptionsMenu/)
  assert.match(text, /typeof ui\.Menu !== 'function'\) return null/)
  assert.match(text, /disabled: groupBy === 'flat'/)
  // v0.15: the workspace slash toggle LEFT this menu (it lives in the settings
  // card now), so the workspace-tree-only disable rule is gone with it.
  assert.doesNotMatch(text, /id: 'workspace-slash'/, 'workspace toggle no longer rides the view menu')
  // Recency ordering is presentational: reorder anchors suppressed.
  assert.match(text, /if \(orderBy === 'updated'\) return null/)
  // alpha.2 retention contract: open goes through the navigation service.
  assert.match(text, /open: \(sessionId\) => \{ uiWorkspace\.openSession\(sessionId\) \}/)
  assert.match(text, /mainSessionIdOf/)
})

/**
 * The add-workspace flow runs the OFFICIAL interaction (v0.12.0): the
 * browser is the owner (open/busy/onPicked/onCancel/onError), the composed
 * picker serves the declared child hole, and a picked directory is adopted
 * with createWorkspace + startSession — the shipped browser's behavior.
 * v0.28.0: a browse Host renders the SHIPPED in-app dialog right in the
 * sidebar — the occupant's component read off the sidebar hole's ledger
 * (the v0.22.0 hero read) — instead of being pointed at the empty-state
 * page; the pointer dialog stays as the floor when the ledger hides the
 * entry.
 */
test('add-workspace flow: official chooser, browse Host renders the shipped dialog in place (v0.28.0)', () => {
  const text = read('src/client.js')
  // The affordance probes the composed backend and rides the OFFICIAL chooser;
  // a browse Host opens 'add-flow', which renders the SHIPPED occupant read
  // off the sidebar hole's ledger (never a plugin-built browser — the seat
  // shadowing makes that unrenderable for good).
  assert.match(text, /pickerCapabilityNow\(\)/)
  assert.match(text, /const startAddFlow = \(\) => \{/)
  assert.match(text, /if \(kind === 'browse'\) \{ setDialog\(\{ kind: 'add-flow' \}\); return undefined \}/)
  assert.match(text, /if \(pickerRefusal\(reason\)\) \{ setDialog\(\{ kind: 'add-flow' \}\); return \}/)
  // The ledger read: browserInjected exposes it, the browser consumes it, and
  // the dialog branch renders the occupant with this seat's owner
  // conversation — falling back to the add-guide pointer when absent.
  assert.match(text, /sidebarFlowEntry: \(\) => \{/)
  assert.match(text, /slots\.entries\('sidebar\.workspaces\.directoryFlow'\)/)
  assert.match(text, /pickDirectory, listDirectory, createDirectory,\s*\n\s*sidebarFlowEntry,/)
  assert.match(text, /if \(dialog\.kind === 'add-guide' \|\| dialog\.kind === 'add-flow'\) \{/)
  assert.match(text, /const flowEntry = dialog\.kind === 'add-flow'/)
  assert.match(text, /E\(flowEntry\.component, \{/)
  assert.match(text, /onPicked: \(path\) => \{ setDialog\(null\); if \(path\) adoptDirectory\(String\(path\)\) \}/)
  assert.match(text, /'add\.guide'/, 'the pointer dialog stays as the fallback floor')
  assert.doesNotMatch(text, /DirectoryBrowseDialog|BetterFlow|markPickerBrowse/,
    'the hand-made directory browser must never return')
  // Native Hosts ride the SAME official host service (no custom chooser).
  assert.match(text, /pickDirectory: \(\) => uiWorkspace\.pickDirectory\(\)/)
  // The owner adopts with create + startSession; no parent-group popup.
  assert.match(text, /createWorkspace\(\{ path: String\(path\) \}\)/)
  assert.match(text, /startSession\(workspace\.workspaceId\)/)
  assert.doesNotMatch(text, /'flow\.parent'|'flow\.picked'|initialParent/,
    'the parent-group popup must not return')
})


/**
 * Context menu (v0.14.0): mirrors the OFFICIAL row menus item-for-item —
 * same ids, icons, danger semantics, and the official 'workspace'
 * dictionary COPY bound at apply time so upstream rewording follows
 * without a release. Customize appearance appends after a separator; the
 * session archive entry is deliberately NOT destructive (official
 * semantics), and the menu renders through the official primitives Menu.
 */
test('context menu: official alignment via the workspace dictionary (0.14.0)', () => {
  const text = read('src/client.js')
  assert.match(text, /ctx\.locale\.bind\('workspace'\)/, 'binds the official dictionary')
  assert.match(text, /let officialT = null/)
  assert.match(text, /officialT,/)
  // Menu entries follow official ids, icons, and danger semantics; the
  // v0.20.0 mirror (pin/rename/fork/archive-unarchive) reads the official
  // dictionary through the params-aware official() wrapper.
  assert.match(text, /ot\('delete\.workspace'\)/)
  assert.match(text, /official\('menu\.fork', t\('menu\.fork'\)\)/)
  assert.match(text, /official\('menu\.archiveSession', t\('menu\.archive'\)\)/)
  assert.match(text, /official\('menu\.unarchiveSession', t\('menu\.archive'\)\)/)
  assert.match(text, /official\(pinned \? 'menu\.unpinSession' : 'menu\.pinSession'/)
  assert.match(text, /official\('rename', t\('menu\.rename'\)\)/)
  assert.match(text, /icon\('IconArchiveOutline20', 16\)/)
  assert.match(text, /icon\('IconTrashOutline16', 16\), danger: true/)
  // The archive entry must NOT be destructive (official Rows.tsx comment).
  assert.match(text, /deliberately NOT styled destructive/)
  // Rendered through the official primitives Menu, positioned by the event.
  assert.match(text, /typeof ui\.Menu === 'function'\) \? E\(ui\.Menu/)
  assert.match(text, /getAnchorRect: \(\) => new DOMRect\(ctx\.x, ctx\.y, 0, 0\)/)
  // dsh 0.2.1-alpha.5's fifth official entry rides after archive (order 450):
  // the clipboard write is feature-probed on the host primitive, so the whole
  // row hides where the primitives lack it.
  assert.match(text, /official\('menu\.sessionId', t\('menu\.sessionId'\)\)/)
  assert.match(text, /id: 'copy-id',/)
  assert.match(text, /icon\('IconCopyOutlineRegular', 16\)/)
  assert.match(text, /typeof ui\.writeClipboard === 'function' \? \[\{\n\s*id: 'copy-id',/)
  // The bw-only entries ride after a separator.
  assert.match(text, /id: 'customize', label: t\('custom\.title'\), icon: icon\('IconPersonalizationOutline16', 16\)/)
})

/**
 * Official 0.1.7 mirror (v0.20.0): the session-action surface follows the
 * shipped row entries — pin/rename/fork/archive(-unarchive) in official
 * order, the stop-and-archive confirmation on the Host refusal, the
 * archived-filter view option, pinned-row fronting, and the two settings
 * gates (right-click trigger vs the official-style "..." button, row hover
 * buttons). Also guards the 0.1.7 status-hook migration and the icon-set
 * generation fallback that keeps pre-0.1.7 glyph names rendering.
 */
test('official mirror: pin/archive surface, archived filter, gates, status migration (v0.20.0)', () => {
  const text = read('src/client.js')
  // Status hooks, BOTH eras: useSessionStatus preferred, the pending-only
  // hook kept for pre-0.1.7 hosts, summary fields filling the rest.
  assert.match(text, /useSessionPendingInteraction, useSessionStatus, useWorkspaces/)
  assert.match(text, /statusMap = typeof useSessionStatus === 'function' \? useSessionStatus\(s => s\) : null/)
  assert.match(text, /visiblePendingKind\(st && st\.pendingInteraction && st\.pendingInteraction\.kind\) \|\| pendingKindOf\(pending, id\)/)
  assert.match(text, /completed: summary\.completed === true \|\| \(st && st\.completionUnread === true\)/)
  // Pin/unpin/unarchive reach the injected face feature-probed; archive
  // passes the stopActivity hop through for the confirmation flow.
  assert.match(text, /pinSession: typeof uiWorkspace\.pinSession === 'function'/)
  assert.match(text, /unpinSession: typeof uiWorkspace\.unpinSession === 'function'/)
  assert.match(text, /unarchiveSession: typeof uiWorkspace\.unarchiveSession === 'function'/)
  assert.match(text, /archiveSession: \(sessionId, options\) => uiWorkspace\.archiveSession\(sessionId, options\)/)
  assert.match(text, /reason\.name === 'WorkspaceArchiveError'/)
  assert.match(text, /stopActivity: true/)
  // The archived filter mirrors the official ArchivedFilter semantics and
  // lives in the view store next to groupBy/orderBy.
  assert.match(text, /if \(archivedFilter === 'show'\) return true/)
  assert.match(text, /if \(archivedFilter === 'only'\) return !!archived/)
  assert.match(text, /setArchivedFilter: \(d, value\)/)
  // Pinned rows front their section (official sectionMembers partition) and
  // archived rows never open or drag.
  assert.match(text, /const pinnedPartition = \(rows\)/)
  assert.match(text, /pinnedSet\.has\(id\) && !archivedSet\.has\(id\)/)
  assert.match(text, /dragEvents: workspaceId && !session\.archived \? sessionDragEvents/)
  // The settings gate: the hover quick buttons (absent key = enabled). The
  // right-click menu is the only ctx trigger since the in-row "..."
  // affordances retired — session row (v0.35.0) and workspace row (v0.35.1):
  // no onMenu prop, no ellipsis icon, no sessionMenu setting anywhere.
  assert.match(text, /rowActionsEnabled = prefsMap\.rowActions !== false/)
  assert.match(text, /quick: rowActionsEnabled/)
  assert.doesNotMatch(text, /sessionMenuEnabled/)
  assert.doesNotMatch(text, /'settings\.sessionMenu/)
  assert.doesNotMatch(text, /IconEllipsisOutline16/)
  assert.doesNotMatch(text, /function WorkspaceRow\(\{ workspace, depth, count, sessionsOpen, onToggle, onStart, onMenu,/)
  // v0.35.2 (issue #14): rename tiers, cheapest first — open rows borrow the
  // retained binding directly, closed rows go through manager.rename ("without
  // opening its history"), and 0.1.6-era hosts keep the sessions.using fallback
  // (slow but the only legal path there).
  assert.match(text, /const manager = sessions\.manager/)
  assert.match(text, /typeof manager\.rename === 'function'/)
  assert.match(text, /await manager\.rename\(sessionId, title\)/)
  const tierFast = text.indexOf('const face = binding ? binding.session : undefined')
  const tierMgr = text.indexOf('typeof manager.rename === \'function\'')
  const tierUsing = text.indexOf('(reference) => reference.binding.session.rename(title)')
  assert.ok(tierFast !== -1 && tierMgr !== -1 && tierUsing !== -1, 'all three rename tiers present')
  assert.ok(tierFast < tierMgr && tierMgr < tierUsing, 'rename tier order: binding < manager < using')
  // The view options menu rides the OFFICIAL dictionary for the filter
  // section and hides it entirely where the host lacks the keys.
  assert.match(text, /official\('filterBy\.label'\)/)
  assert.match(text, /hasFilter \? \[/)
  // Icon-set generation fallback: pre-0.1.7 pixel-suffix names resolve to
  // the Regular/Medium spellings before degrading to null.
  assert.match(text, /if \(ui\[base \+ 'Regular'\]\) return base \+ 'Regular'/)
  assert.match(text, /const C = ui\[resolveIconName\(name\)\]/)
})

/**
 * dsh 0.2.1-alpha.5 mirror (v0.30.0): the session-id menu row reports through
 * the official primitives Toast when the host ships it (body portal, official
 * look) and falls back to the plugin's own chip otherwise; the quota's
 * always-visible set follows the official attention semantics (see the issue
 * round test), and the retired forkError mirror keeps its typeof defenses.
 */
test('copy-session-id notice: official toast or fallback chip (v0.30.0)', () => {
  const text = read('src/client.js')
  // Feature probes, both directions.
  assert.match(text, /const officialToast = typeof ui\.Toast === 'function' \? ui\.Toast : null/)
  assert.match(text, /id === 'copy-id' && typeof ui\.writeClipboard === 'function'/)
  // Official wiring: copied === true is success, everything else fails.
  assert.match(text, /ok: copied === true/)
  // The official path keys on seq; the fallback chip rides the fork-notice
  // styling with its own close button; both self-dismiss (onDone / cap).
  assert.match(text, /key: 'bw-copy-' \+ copyNotice\.seq/)
  assert.match(text, /tone: copyNotice\.ok \? 'success' : undefined/)
  assert.match(text, /onDone: \(\) => setCopyNotice\(null\)/)
  assert.match(text, /\(copyNotice && !officialToast\)\n\s*\? E\('div', \{ className: 'bw-toast', role: 'status' \}/)
  assert.match(text, /onClick: \(\) => setCopyNotice\(null\),/)
  // Copy rides the official dictionary with the aligned local fallback, for
  // both outcomes.
  assert.match(text, /officialText\(copyNotice\.ok \? 'toast\.sessionIdCopied' : 'toast\.sessionIdCopyFailed',/)
  // The retired forkError mirror stays defensive (rc.2-era hosts).
  assert.match(text, /typeof dismissForkError === 'function'/)
  // Dictionary: all three keys are local (pre-0.2.1 hosts have no official
  // copy) — zh carries them and the key-set test pins the other 20.
  const zhKeys = text.slice(text.indexOf('const zh = {'), text.indexOf('const en = {'))
  assert.match(zhKeys, /'menu\.sessionId': '复制 Session ID',/)
  assert.match(zhKeys, /'toast\.sessionIdCopied': 'Session ID 已复制',/)
  assert.match(zhKeys, /'toast\.sessionIdCopyFailed': '复制失败，请重试',/)
})

/**
 * Issue round v0.21.0: four reports, one release. #9's two defects (the
 * missing ./package.json export that kept the client half out of the desktop
 * boot graph, and the customize-dialog icon pick that overwrote itself),
 * #6's collapsible Ungrouped block, #7's tri-state grouping wired to BOTH
 * faces, and #8's progressive session listing.
 */
test('issue round: exports fix, icon pick, ungrouped fold, tri-state, quota (v0.21.0)', () => {
  const text = read('src/client.js')
  // #9-1: desktop module discovery resolves <pkg>/package.json through the
  // exports map; without this row the client half never enters the boot
  // graph (ERR_PACKAGE_PATH_NOT_EXPORTED, silently swallowed).
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.exports['./package.json'], './package.json', 'the manifest subpath is exported')
  // #9-2: the dialog fallback only FILLS the field readAppearance drops —
  // a fresh pick must always win over it.
  assert.match(text, /icon: patch\.icon \|\| prev\.icon \|\| 'solid'/)
  assert.doesNotMatch(text, /icon: prev\.icon \|\| 'solid'/)
  // #6: the Ungrouped bucket folds like a group row; search keeps it open.
  assert.match(text, /const open = searching \|\| ungroupedOpen/)
  assert.match(text, /setUngroupedOpen\(!open\)/)
  // #7: the menu section and the settings segmented control write the ONE
  // store key through the same action; buildTree speaks all three modes and
  // slash-only skips the disk parent map entirely.
  assert.match(text, /id: 'ws-disk-slash'/)
  assert.match(text, /onWsGroupPick\(id\.slice\(3\)\)/)
  assert.match(text, /setWorkspaceGroupMode\('slash'\)/)
  assert.match(text, /const diskParentOf = diskOn \? diskParentMapOf\(list\) : new Map\(\)/)
  assert.match(text, /d\.workspaceTitleSlash = d\.workspaceGroupMode !== 'disk'/, 'the legacy boolean rides along for downgrades')
  // #8: the quota skips blank/running/subagent/pinned rows (v0.30.0: plus the
  // official attention window — pending/completed/current stay visible within
  // the first 50 non-blank rows, the shipped watermark's auto cap); the
  // overflow row rides the legacy sessions.expand copy; search bypasses the
  // quota.
  assert.match(text, /row\.blank \|\| row\.running \|\| row\.subagents > 0 \|\| row\.pinned/)
  assert.match(text, /const SESSION_ATTENTION_WINDOW = 50/)
  assert.match(text, /row\.pending \|\| row\.completed \|\| row\.id === currentId/)
  assert.match(text, /limitSessionsForRender\(full, sessionLimit, limitLifted\[workspace\.workspaceId\], currentId\)/)
  assert.match(text, /t\('sessions\.expand', \{ n: limited\.hidden \}\)/)
})

/**
 * Group discoverability (v0.15.0): a row could always be grouped by retyping
 * its title, but nothing in the UI said so — no "new group" affordance, and
 * drag-into-group only worked once a group already existed. The header button
 * + drop slot and the menu entry funnel into one dialog, and grouping stays a
 * name projection: no empty group container, no new store key.
 */
test('group move: one shared menu entry on every row kind, one dialog for both entry paths', () => {
  const text = read('src/client.js')
  // One shared item object, gated PER NAME LAYER (v0.15): a workspace row
  // offers "move to group" only while "/" grouping is on for workspaces, a
  // session row while its own layer is on. The two switches are independent —
  // a disk-only workspace tree must not promise a container it cannot render.
  assert.match(text, /const groupItem = \{ id: 'move-group', label: t\('menu\.moveToGroup'\)/, 'shared group item')
  assert.match(text, /const wsGroupItems = workspaceSlash \? \[groupItem\] : \[\]/, 'workspace rows gate on the workspace layer')
  assert.match(text, /const sgroupItems = sessionSlash \? \[groupItem\] : \[\]/, 'session rows gate on the session layer')
  assert.equal((text.match(/\.\.\.wsGroupItems,/g) || []).length, 2, 'workspace + folder branches')
  assert.equal((text.match(/\.\.\.sgroupItems,/g) || []).length, 2, 'session + session-group branches')
  // One dialog serves the row menu (target locked) and the header picker.
  assert.match(text, /if \(dialog\.kind === 'group-move'\) return E\(GroupDialog/, 'dialog wiring')
  assert.match(text, /targets: dialog\.targets \|\| null/)
  assert.match(text, /onConfirm: \(tv, gv\) => submitGroupMove\(dialog\.targets \? targetOfValue\(tv\) : dialog\.target, gv\)/)
  // Module-level component: an inline definition would remount and drop input.
  assert.match(text, /function GroupDialog\(\{ title, hint, initial, targets, groupPaths, onConfirm, onClose, t \}\)/)
})

test('group move: the header "New group" button doubles as the drop slot', () => {
  const text = read('src/client.js')
  // v0.17.0: the button is an ICON now and its label tracks the live layers.
  assert.match(text, /'aria-label': newGroupLabel\(\)/, 'header button is labelled by the live layers')
  assert.match(text, /const newGroupLabel = \(\) => \(workspaceSlash && sessionSlash \? t\('group\.new\.both'\)/, 'both layers live -> "session or workspace"')
  assert.match(text, /\}, icon\('IconFolderOpen16', 16\)\) : null,/, 'rendered as an icon button')
  // The button exists only while at least one name layer is ON.
  assert.match(text, /\(workspaceSlash \|\| sessionSlash\) \? E\('button', \{/, 'header button follows the switches')
  assert.match(text, /const groupDropTarget = \(\) => drag !== null && drag\.over && drag\.over\.kind === 'newgroup'/)
  // The slot refuses rows whose layer is off — while hovering AND on drop.
  assert.match(text, /if \(drag\.kind === 'workspace' && !workspaceSlash\) return/, 'hover refused on a disk-only workspace layer')
  assert.match(text, /if \(\(drag\.kind === 'workspace' && !workspaceSlash\) \|\| \(drag\.kind === 'session' && !sessionSlash\)\) \{/, 'drop refused on a disabled layer')
  assert.match(text, /over: \{ kind: 'newgroup' \}/, 'drag over the button marks the new-group target')
  // The datalist source is snapshotted when the dialog opens, never walked
  // during render: collectGroupPaths covers every workspace + session title,
  // so a render-time call would redo that walk on every store tick.
  assert.match(text, /groupPaths: collectGroupPaths\(target\.kind\)/, 'menu / drop snapshot the datalist source')
  assert.match(text, /const pickerKindOf = \(\) => workspaceSlash && sessionSlash \? undefined/, 'picker kind still narrows to the enabled layers (drag path)')
  // v0.17.0: the header click opens the NEW-group dialog, not the move picker.
  assert.match(text, /setDialog\(\{ kind: 'group-new', layer: defaultNewGroupLayer\(\) \}\)/, 'header opens the new-group dialog')
  assert.match(text, /const defaultNewGroupLayer = \(\) => \(workspaceSlash && !sessionSlash \? 'workspace' : 'session'\)/, 'a disk-only host defaults to the session layer')
  assert.match(text, /const pickerKindOf = \(\) => workspaceSlash && sessionSlash \? undefined : \(workspaceSlash \? 'workspace' : 'session'\)/, 'picker narrows to the enabled layers')
  assert.match(text, /groupPaths: dialog\.groupPaths \|\| \[\]/, 'render reads the snapshot instead of re-walking')
  assert.match(text, /\.bw-drop-into-strong\{outline:2px solid var\(--dsw-alias-brand-primary/, 'drop highlight')
})

test('group move: user renames ride renameByUser, host reorder stays optional', () => {
  const text = read('src/client.js')
  const start = text.indexOf('const submitGroupMove = (target, rawGroup) =>')
  const end = text.indexOf('/* ------------------------- drag & drop --------------------------')
  assert.ok(start !== -1 && end > start, 'submitGroupMove sits before the drag section')
  const body = text.slice(start, end)
  assert.match(body, /renameWorkspace\(target\.id, next\)/, 'workspace move is a plain rename')
  assert.match(body, /typeof insertWorkspaceBefore === 'function'/, 'host reorder action stays optional (0.1.6-alpha.1 contract)')
  assert.match(body, /renameByUser\(target\.id, next\)/, 'single session move is pinned against the auto-quote effect')
  assert.match(body, /await renameByUser\(row\.id, next \+ row\.title\.slice\(target\.path\.length\)\)/, 'session-group batch move is pinned too')
  assert.match(body, /for \(const w of affected\)[\s\S]*renameWorkspace\(w\.workspaceId, next \+ String\(w\.title\)\.slice\(target\.path\.length\)\)/, 'workspace-group batch move rewrites every member')
})

/**
 * Host-era compat: 0.1.6-alpha.2 replaced ISessions.binding with the
 * retention-contract using(); 0.1.5-rc.x hosts still ship binding only, where
 * the unconditional using() call threw "sessions.using is not a function" and
 * took every rename path down with it (row dialog, session-group batch, move
 * to group). Both contracts must stay wired.
 */
test('session rename: using() preferred, binding() fallback for 0.1.5-rc.x hosts', () => {
  const text = read('src/client.js')
  const start = text.indexOf('const renameSession = async (sessionId, title) =>')
  const end = text.indexOf('const forkSession = (sessionId)')
  assert.ok(start !== -1 && end > start, 'renameSession sits before forkSession')
  const body = text.slice(start, end)
  assert.match(body, /if \(typeof sessions\.using === 'function'\)/, 'the new contract is probed, never assumed')
  assert.match(body, /source: 'workspaceOperation'/, 'new contract keeps the explicit retention source')
  assert.match(body, /typeof sessions\.binding === 'function' \? sessions\.binding\(sessionId\) : undefined/, 'old binding fallback is probed too')
  assert.match(body, /face\.rename\(title\)/, 'old contract renames through the session face')
  assert.match(body, /throw new Error\('session rename is unavailable on this host'\)/, 'fails loud when neither contract exists')
})

/**
 * Host-era compat, second contract: the "open" session. 0.1.6-alpha.2 replaced
 * the SessionListState.current wire field with the mainView retention source,
 * and 0.1.5-rc.x never carried retainedBy at all — so reading either one alone
 * breaks on the other generation: no current highlight, and every blank row
 * (a brand-new session before its first message) filtered out by
 * sessionVisible. Retention wins, the wire field backs it up.
 */
test('current session: mainView retention preferred, wire current as the 0.1.5-rc.x fallback', () => {
  const text = read('src/client.js')
  const start = text.indexOf('const mainSessionIdOf = (list) => {')
  const end = text.indexOf('const hasActiveScheduleOf')
  assert.ok(start !== -1 && end > start, 'mainSessionIdOf sits before hasActiveScheduleOf')
  const { mainSessionIdOf } = new Function(text.slice(start, end) + '\nreturn { mainSessionIdOf }')()

  // 0.1.6-alpha.2 shape: no \`current\` field, retention decides.
  assert.equal(mainSessionIdOf({ byId: { a: { id: 'a' }, b: { id: 'b', retainedBy: { mainView: 1 } } } }), 'b')
  // 0.1.5-rc.x shape: no retainedBy anywhere, the wire field decides.
  assert.equal(mainSessionIdOf({ byId: { a: { id: 'a' }, b: { id: 'b' } }, current: 'a' }), 'a')
  // Retention wins when both are present, so an alpha.2 host is never second-guessed.
  assert.equal(mainSessionIdOf({ byId: { a: { id: 'a', retainedBy: { mainView: 1 } } }, current: 'z' }), 'a')
  // Nothing open (or no list at all): undefined, never a throw.
  assert.equal(mainSessionIdOf({ byId: { a: { id: 'a' } } }), undefined)
  assert.equal(mainSessionIdOf({ byId: {} }), undefined)
  assert.equal(mainSessionIdOf(null), undefined)

  // The consumer memo must also watch \`current\`: 0.1.5-rc.x switches it without
  // necessarily handing back a new byId.
  assert.match(text, /\[list \? list\.byId : null, list \? list\.current : null\]/, 'currentId memo depends on current')
})

/**
 * v0.15: the workspace NAME layer became opt-in. Fresh installs render the
 * official disk folders only; a browser that already ran the 0.13 view options
 * keeps whichever value it stored; a pre-0.13 snapshot — which grouped by "/"
 * by default with no switch to turn it off — stays ON, so upgrading never
 * silently reorganizes a tree someone already lives in. Hydration replaces the
 * whole state and only runs when a snapshot exists, which is exactly what
 * makes those three cases separable from one read (no migration pass).
 */
test('workspace "/" grouping: opt-in default, pre-0.13 snapshots stay on', () => {
  const text = read('src/client.js')
  assert.match(text, /workspaceGroupMode: 'disk', sessionTitleSlash: true, workspaceTitleSlash: false, ungroupedOpen: true/, 'init ships the disk-only default plus the declared-group bags')
  assert.match(text, /const workspaceSlashOf = \(value\) => value === undefined \? true : value === true/, 'tri-state read')
  const start = text.indexOf('const workspaceSlashOf = (value) =>')
  const end = text.indexOf('\n', start)
  const { workspaceSlashOf } = new Function(text.slice(start, end) + '\nreturn { workspaceSlashOf }')()
  assert.equal(workspaceSlashOf(undefined), true, 'a pre-0.13 snapshot keeps grouping (upgrade must not reorganize)')
  assert.equal(workspaceSlashOf(true), true, 'explicit on')
  assert.equal(workspaceSlashOf(false), false, 'explicit off')

  // v0.21.0 (issue #7): the strategy is TRI-STATE and lives in BOTH faces —
  // the view menu section and the settings card segmented control write the
  // one store key, so they can never disagree.
  const modeStart = text.indexOf('const workspaceGroupModeOf = (mode, legacySlash) =>')
  const modeEnd = text.indexOf('const limitSessionsForRender', modeStart)
  const { workspaceGroupModeOf } = new Function('workspaceSlashOf', text.slice(modeStart, modeEnd) + ' return { workspaceGroupModeOf }')(workspaceSlashOf)
  assert.equal(workspaceGroupModeOf('slash', false), 'slash', 'a persisted mode always wins')
  assert.equal(workspaceGroupModeOf(undefined, true), 'disk-slash', 'legacy on migrates to disk+slash')
  assert.equal(workspaceGroupModeOf(undefined, false), 'disk', 'legacy off migrates to disk-only')
  assert.equal(workspaceGroupModeOf(undefined, undefined), 'disk-slash', 'a pre-0.13 snapshot keeps grouping')
  assert.doesNotMatch(text, /id: 'workspace-slash'/, 'still gone from the view menu')
  assert.doesNotMatch(text, /t\('settings\.workspaceSlash'\)/, 'the retired switch copy is gone')
  assert.match(text, /id: 'ws-disk-slash'/, 'the menu carries the tri-state section')
  assert.match(text, /t\('settings\.workspaceGroup'\)/, 'carried by the settings card')
  assert.match(text, /setWorkspaceGroupMode\('disk-slash'\)/, 'the card writes the store key')
  // Same strategy read on both surfaces: a mismatch would show the switch in
  // one state and render the tree in the other.
  assert.equal((text.match(/workspaceGroupModeOf\(useStore\(s => s\.workspaceGroupMode\), useStore\(s => s\.workspaceTitleSlash\)\)/g) || []).length, 2, 'tree + card agree')
})

/**
 * Disk-only safety: with the workspace name layer OFF the tree renders no name
 * groups, so a workspace drop must be PURE REORDERING. The drag source still
 * derives its leaf from the raw title (it must — a compressed row lies about
 * it), which means a stale folderPath would make every drop read as a
 * cross-group move and silently rewrite the title ("web/前端" -> "前端") with
 * no group visible to explain it. The arming site and the commit site must
 * agree that there is no folder to cross.
 */
test('workspace drag: disk-only mode reorders, never rewrites titles', () => {
  const text = read('src/client.js')
  assert.match(text, /const sourceFolder = workspaceSlash && segs\.length > 1 \? segs\.slice\(0, -1\)\.join\('\/'\) : ''/, 'drag source drops the folder while the layer is off')
  assert.match(text, /const sameFolder = !workspaceSlash \|\| targetFolder === source\.folderPath/, 'commit forces the reorder path')
  assert.match(text, /hint: workspaceSlash \? t\('ws\.rename\.hint'\) : null/, 'the rename dialog stops advertising "/"')
})

/**
 * Dropdowns are MenuPicker, never native. The OS draws a native select's popup
 * and a datalist's suggestion list itself, so over this plugin's translucent
 * panel both came back as light system surfaces that ignore the theme —
 * reported by the user on the "move to group" dialog. dsh-ide-git carries the
 * same lesson twice (see its RepoSelect / FilterSelect notes); it had to lay
 * the replacement menu out inside its own panel, because dsh-better-sidebar
 * declares contain:layout and strands a portal off-screen. This plugin sits in
 * a native DSH slot, so it can use the real primitives Menu: official look and
 * keyboard model, portalled above the modal (z-index 1100 vs 1000), and its
 * own scrolling list.
 */
test('group dialog dropdowns: primitives Menu, native control only as the Menu-less fallback', () => {
  const text = read('src/client.js')
  assert.match(text, /function MenuPicker\(\{ options, value, onPick, placeholder, chevronOnly, title, t \}\)/, 'one shared picker')
  assert.match(text, /const menuReady = typeof ui\.Menu === 'function'/, 'the primitives are probed')
  assert.match(text, /selectedId: current === null \? undefined : String\(current\.value\)/, 'the current row is checked')
  assert.match(text, /className: cls\('bw-menu-block', chevronOnly && 'bw-menu-inline'\)/, 'the wrapper width follows the shape')
  // The group dialog routes BOTH dropdowns through it.
  assert.match(text, /menuReady\s*\?\s*E\(MenuPicker, \{/, 'the target list uses the picker')
  assert.match(text, /\(menuReady && hintList\.length > 0\)\s*\?\s*E\(MenuPicker, \{/, 'the group-path suggestions use the picker')
  // Native controls survive ONLY as the fallback: one select per dialog that
  // hosts a picker (group-move since v0.16, workspace-preset since v0.32),
  // and the datalist is gone for good (its popup could not be styled at all).
  assert.equal((text.match(/E\('select', \{/g) || []).length, 2, 'native selects left, as the fallbacks only')
  assert.doesNotMatch(text, /E\('datalist'/, 'the datalist is gone')
  assert.doesNotMatch(text, /list: 'bw-group-paths'/, 'no field is wired to a native suggestion list')
})

/**
 * The official "workspace" grouping mode (v0.13) rendered every row WITHOUT A
 * NAME: it handed the raw WorkspaceView to renderWorkspaceEntry, and a raw item
 * carries no leaf field — the exact field WorkspaceRow renders as its label
 * (the title it also passes is only the tooltip). The tree path fills leaf
 * while building, so only this flat path lost it. Reported 2026-09-19.
 */
test('official "workspace" grouping: flat rows carry a label', () => {
  const text = read('src/client.js')
  assert.match(text, /renderWorkspaceEntry\(\{ workspace: flatWorkspaceEntry\(workspace\) \}, 0, wsPulseOf\(workspace\)\)/, 'the flat mode builds a labelled entry')
  // The bare { workspace } form stays CORRECT on the tree path — those entries
  // carry a leaf by construction. What must never come back is the raw form
  // over `items`, which has none.
  assert.doesNotMatch(text, /for \(const workspace of items \|\| \[\]\) bodyRows\.push\(\.\.\.renderWorkspaceEntry\(\{ workspace \}/, 'the flat branch never hands over a raw item again')
  // Drive the real helper: the two slices supply basename, its one dependency.
  const baseStart = text.indexOf('const basename = ')
  const baseEnd = text.indexOf('\n    }\n', baseStart) + 6
  const flatStart = text.indexOf('const flatWorkspaceEntry = ')
  const flatEnd = text.indexOf('function buildTree')
  assert.ok(baseStart !== -1 && baseEnd > baseStart && flatStart !== -1 && flatEnd > flatStart, 'both helpers located')
  const { flatWorkspaceEntry } = new Function(
    text.slice(baseStart, baseEnd) + '\n' + text.slice(flatStart, flatEnd) + '\nreturn { flatWorkspaceEntry }')()
  // The FULL title is the label: this mode renders no name groups, so a slash
  // has nothing to group into and must stay in the text.
  assert.equal(flatWorkspaceEntry({ workspaceId: 'w', title: 'web/前端', path: '/a/b' }).leaf, 'web/前端')
  // Same fallback chain the tree path uses when the title is empty.
  assert.equal(flatWorkspaceEntry({ workspaceId: 'w', title: '', path: '/a/b' }).leaf, 'b')
  assert.equal(flatWorkspaceEntry({ workspaceId: 'w', path: '' }).leaf, 'w')
  assert.equal(flatWorkspaceEntry({ workspaceId: 'w', title: 'x' }).folderPath, '')
})




/**
 * Declared-empty groups (v0.17.0). A group used to be a pure projection of "/"
 * in member titles, so a member-less one could not be represented at all and
 * "create a group" had nothing to write. The store gained a `folders` bag for
 * the declaration; these tests drive the real reducer and the real tree walk.
 */
test('declared groups: the store writes and prunes them, descendants included (v0.17.0)', () => {
  const text = read('src/client.js')
  const start = text.indexOf('        addFolder: (d, kind, scope, path) => {')
  const end = text.indexOf('\n      },', start)
  assert.ok(start !== -1 && end > start, 'the two folder actions sit in the store')
  // The path helper is a module-scope sibling of the store, so inject it
  // separately: the slice between it and the actions crosses the store's head.
  const helperFrom = text.indexOf('    const declaredPathOf = (raw) =>')
  const helperTo = text.indexOf('\n\n', helperFrom)
  const helper = text.slice(helperFrom, helperTo)
  const { addFolder, removeFolder } = new Function(helper + '\nreturn {' + text.slice(start, end).replace(/,\s*$/, '') + '}')()
  const d = {}
  addFolder(d, 'workspace', '', 'design')
  addFolder(d, 'workspace', '', 'design/sub')
  addFolder(d, 'workspace', 'ws-1', 'inner')
  addFolder(d, 'session', 'ws-9', '前端')
  assert.deepEqual(d.folders.ws[''], ['design', 'design/sub'], 'workspace declarations accumulate per scope')
  assert.deepEqual(d.folders.ws['ws-1'], ['inner'], 'a disk level has its own bag')
  assert.deepEqual(d.folders.sess['ws-9'], ['前端'], 'session declarations key on the workspace')
  addFolder(d, 'workspace', '', 'design')
  assert.deepEqual(d.folders.ws[''], ['design', 'design/sub'], 're-declaring is a no-op')
  addFolder(d, 'workspace', '', '  ')
  assert.deepEqual(d.folders.ws[''], ['design', 'design/sub'], 'a blank name never lands')
  removeFolder(d, 'workspace', '', 'design')
  assert.equal(d.folders.ws[''], undefined, 'deleting a branch takes its descendants and drops the empty bag')
  assert.deepEqual(d.folders.ws['ws-1'], ['inner'], 'other scopes are untouched')
})

test('declared groups: they render even with no members to project from (v0.17.0)', () => {
  const text = read('src/client.js')
  const start = text.indexOf('    const EMPTY_FOLDERS = Object.freeze({})')
  const end = text.indexOf('    function buildTree(')
  assert.ok(start !== -1 && end > start, 'the resolvers sit above buildTree')
  const { hasDeclared, explicitSegsOf, EMPTY_FOLDERS } =
    new Function(text.slice(start, end) + '\nreturn { hasDeclared, explicitSegsOf, EMPTY_FOLDERS }')()
  assert.equal(hasDeclared(EMPTY_FOLDERS, ''), false, 'a pre-0.17 snapshot declares nothing')
  assert.equal(hasDeclared({ '': [] }, ''), false, 'an empty list is not a declaration')
  assert.equal(hasDeclared({ '': ['a'] }, ''), true)
  assert.deepEqual(explicitSegsOf({ '': ['a/b'] }, ''), [['a', 'b']], 'a declared path splits into levels')
  assert.deepEqual(explicitSegsOf(EMPTY_FOLDERS, ''), [], 'missing keys resolve to nothing')

  // The tree walk must ingest them, or an empty group is invisible.
  assert.match(text, /for \(const segs of explicitSegsOf\(explicitWs, idPrefix\)\) ensure\(segs\)/,
    'workspace levels declare their empty groups before the members')
  assert.match(text, /for \(const segs of explicitSegsOf\(explicitSess, groupScope\)\) ensure\(segs\)/,
    'session trees do the same')
  // A workspace whose sessions are all gone still shows its declared groups.
  assert.match(text, /if \(full\.length === 0 && !hasDeclared\(sessFolders, workspace\.workspaceId\)\) return \[\]/,
    'empty session rows no longer short-circuit a declared group away')
  // Every caller threads the bag through.
  // v0.36.11: the sidebar resolves its tree mode through groupBy first
  // ("workspaces" + a name layer = 'slash'), picker keeps its own variable.
  assert.match(text, /const treeMode = groupBy === 'workspace' && workspaceGroupMode !== 'disk'\n          \? 'slash'\n          : workspaceGroupMode\n        const built = buildTree\(items, treeMode, wsFolders, folderOrderMap\)/,
    'the main tree passes the workspace bag and the persisted group order')
  assert.equal((text.match(/buildSessionTree\(sessionsOf\(workspace\), sessionSlash, sessFolders, workspace\.workspaceId\)/g) || []).length, 4,
    'every session-tree caller passes the session bag and its workspace scope')
})

/**
 * The new-group dialog (v0.17.0): a two-way layer switch plus an expandable
 * container TREE, because the parent is a place in the hierarchy — picking it
 * from a flat dropdown lost the "under which workspace / which group" reading.
 * The move dialog keeps its own shape; the two are separate entry points now.
 */
test('new group: icon button, live tooltip, layer switch and a tree picker (v0.17.0)', () => {
  const text = read('src/client.js')
  assert.match(text, /function GroupNewDialog\(props\)/, 'the dialog exists')
  assert.match(text, /const newGroupLayers = \(\) => \(workspaceSlash && sessionSlash \? \['session', 'workspace'\]/, 'both layers are offered when both are live')
  assert.match(text, /layer: defaultNewGroupLayer\(\)/, 'the header hands the dialog its default layer')
  // One live layer means no switch at all — a two-option control with one
  // option is noise, and the tooltip already names the single layer.
  assert.match(text, /kinds\.length > 1 \? E\('div', \{ className: 'bw-seg'/, 'the switch renders only with two layers')
  assert.match(text, /function GroupNewDialog[\s\S]*?treeOf\(kind\)/, 'the container tree follows the selected layer')
  assert.match(text, /const pick = \(node\) => \{ if \(node\.pickable === false\) return; setPicked\(node\); setError\(''\) \}/, 'clicking a node picks the container (containers refuse)')
  // The session layer has no "top level": folders.sess is keyed by workspaceId,
  // so a declaration filed under '' would never be read by any render path. Its
  // introduction is a plain HINT, not a header row that reads as a node.
  // The container tree mirrors the sidebar's view mode, and the session layer
  // walks the SAME tree the sidebar renders (disk nesting included) instead of
  // the flat registry list — a child workspace must nest under its parent.
  assert.match(text, /const treeView = groupBy === 'workspace-tree'\n          \|\| \(groupBy === 'workspace' && workspaceGroupMode !== 'disk'\)/,
    'the dialog follows the live view mode (v0.36.11: "workspaces" + name layer included)')
  assert.match(text, /if \(treeView\) return \{ hint: t\('group\.new\.pickWorkspace'\), nodes: sessNodesOf\(rawTree\) \}/,
    'tree view: session layer walks the tree')
  // The dialog walks the UNCOMPRESSED tree: a merged single-child chain row
  // stands for a group AND its only workspace at once, which cannot be one
  // selectable and one unselectable node.
  assert.match(text, /const rawTree = React\.useMemo\(\(\) => buildTree\(\n        items,\n        groupBy === 'workspace' && workspaceGroupMode !== 'disk' \? 'slash' : workspaceGroupMode,\n        wsFolders,\n        folderOrderMap,\n      \)/,
    'an uncompressed tree exists for the dialog (same groupBy-aware mode as the render)')
  assert.match(text, /const folderLabelOf = \(node\) => String\(node\.name \|\| \(Array\.isArray\(node\.segs\)/,
    'labels survive a node shape that carries segs but no name')
  assert.match(text, /const sessNodesOf = \(node\) => \{/, 'the recursive walk exists')
  assert.match(text, /children: \[\.\.\.inner, \.\.\.subNodes\]/, 'a workspace node carries its session groups AND its disk-nested children')
  assert.match(text, /const flat = \[\]/, 'one-level modes fall back to a flat list')
  assert.match(text, /if \(!picked\) \{ setError\(t\('group\.new\.pickFirst'\)\); return \}/,
    'commit refuses an unpicked container')
  assert.match(text, /plan\.nodes\.length > 0 \? renderNodes\(plan\.nodes, 0\) : E\('div', \{ className: 'bw-gn-empty' \}/,
    'an empty workspace list explains itself instead of rendering nothing')
  assert.match(text, /onConfirm\(kind, picked\.scope, picked\.path === '' \? clean : picked\.path \+ '\/' \+ clean\)/,
    'the name is appended to the picked container path')
  assert.match(text, /actions\.addFolder\(kind, scope, path\)/, 'confirm writes the declaration')
  // The tree carries the exact write targets.
  // Workspace-GROUP containers list name-group folders ONLY: a workspace title
  // is "group/leaf", so with members A/B, A/C, D and E/F the only groups are A
  // and E — B/C/D/F are leaves and must not be offered as containers.
  assert.match(text, /const wsFolderNodesOf = \(node\) => \(node\.folders \|\| \[\]\)\.map/, 'workspace container walk covers groups only')
  assert.doesNotMatch(text, /wsGroupNodesOf/, 'the walk must not fall back to listing workspaces as containers')
  // A dedicated top-level row carries "new group NEXT TO A and E"; the walk
  // supplies the existing top-level groups beside it.
  // It sits LAST: "one more, belonging to none of the above".
  assert.match(text, /nodes: \[\.\.\.groups, \{ id: '@top', scope: '', path: '', label: t\('group\.new\.independent'\), kind: 'new', children: \[\] \}\]/,
    'the dedicated top-level row exists and trails the containers')
  assert.match(text, /const groups = treeView \? wsFolderNodesOf\(rawTree\) : \[\]/, 'the workspace layer uses the group-only walk')
  assert.match(text, /node\.kind === 'new' \? icon\('IconPlusOutline16', 15\)/, 'the top-level row reads as an action, not a folder')
  assert.match(text, /const sessGroupNodesOf = \(node, workspaceId\)/, 'session container walk')
  assert.match(text, /scope: workspaceId, path: g\.path/, 'a session group files under its workspace')
  // Menu hygiene (user report): the plugin's own entries sit AFTER the
  // separator, and the move entry must carry a glyph the host actually has.
  assert.match(text, /icon\('IconFolderOpenOutline16', 16\) \}/, 'move-to-group uses a glyph this host ships')
  assert.doesNotMatch(text, /icon\('IconFolderOutline16'/, 'the retired glyph must not come back')
  assert.match(text, /id: 'delete-folder', label: t\('menu\.deleteGroup'\)/, 'an empty group can be deleted')
  assert.match(text, /ctx\.payload\.empty \? \[deleteFolderEntry\] : \[\]/, 'delete is offered for empty groups only')
})

/**
 * Group-leaving drags (v0.18.0). The visible order of session rows is decided
 * by the name groups, so the old cross-group drop — which only reordered the
 * flat list — left the row exactly where it was and read as "the drag did
 * nothing" (user report: dragging a session out of 测试1 kept it inside).
 */
test('session drag out of a group: cross-group drops move the row, the workspace row takes it out (v0.18.0)', () => {
  const text = read('src/client.js')
  // A drop on a row of another group rewrites the prefix (the move), and only
  // then applies the order.
  assert.match(text, /const titleMovedToGroup = \(title, anchorTitle\) => \{/)
  assert.match(text, /const nextTitle = sessionSlash && target \? titleMovedToGroup\(source\.title, target\.title\) : null/)
  assert.match(text, /chain\.then\(reorder\)\.catch\(fail\)/)
  // The workspace row is the root of the session tree: the one drop target
  // that always exists OUTSIDE every group.
  assert.match(text, /const commitSessionMoveOut = \(workspaceId\) => \{/)
  assert.match(text, /const wsRootDropActive = \(workspaceId\) => dragMatches\('session'\)/)
  assert.match(text, /over: \{ kind: 'ws-root', target: workspace\.workspaceId \}/)
  assert.match(text, /dropInto: wsRootDropActive\(workspace\.workspaceId\)/)
  assert.match(text, /dropInto && 'bw-drop-into'/)
  // ...and the same move is reachable from the context menu, for users who
  // would rather not drag at all.
  assert.match(text, /\{ id: 'move-out', label: t\('menu\.moveOutGroup'\)/)
  // v0.34.0: every session verb routes through the shared dispatcher;
  // the context-menu branch just hands off (an unknown id falls through).
  assert.match(text, /else if \(kind === 'session'\) \{/)
  assert.match(text, /if \(!pickSessionAction\(payload, id\)\) return/)
  // Outside every group is still a way out: the tree container itself accepts
  // the drop (row handlers stopPropagation, so only unclaimed drops reach it)
  // and marks itself while such a drag is in flight.
  assert.match(text, /const sessionCouldLeaveGroup = dragMatches\('session'\) && sessionSlash/)
  assert.match(text, /sessionCouldLeaveGroup && 'bw-root-drop-out'/)

  // Pure helper: the leaf's own text survives, the group comes from the anchor
  // row ('' = the root level, i.e. out of every group).
  const segsSrc = text.slice(text.indexOf('const splitPlainSegs ='), text.indexOf('const normPath ='))
  const helpersSrc = text.slice(text.indexOf('const groupPrefixOf ='), text.indexOf('const collectGroupPaths ='))
  assert.ok(segsSrc.length > 0 && helpersSrc.length > 0, 'the title helpers are missing')
  const { titleMovedToGroup } = new Function(segsSrc + helpersSrc + '\nreturn { titleMovedToGroup }')()
  assert.equal(titleMovedToGroup('组/A', 'B/x'), 'B/A', 'the anchor row decides the group')
  assert.equal(titleMovedToGroup('组/A', '裸行'), 'A', 'an anchor at the root pulls the row out')
  assert.equal(titleMovedToGroup('A', 'B/x'), 'B/A', 'a root row can be moved in')
  assert.equal(titleMovedToGroup('组/A', ''), 'A', 'an empty anchor keeps the leaf as it is')
})

test('new-group dialog components stay at module scope (React discipline)', () => {
  const text = read('src/client.js')
  const head = text.indexOf('function GroupNewDialog(props) {')
  const start = text.indexOf('\n', head) + 1
  const end = text.indexOf('\n    function ', start)
  const body = text.slice(start, end)
  assert.ok(body.length > 0, 'component body found')
  // Hooks before any early return; no nested component definitions.
  assert.doesNotMatch(body, /function [A-Z]\w*\(/, 'no component defined inside the component')
})

/**
 * dsh 0.1.7-rc.2 alignment (v0.23.0). The sidebar/session-tree surface changed
 * most in this release, and two of the changes BROKE this plugin silently:
 * the active-Schedule list projection was deleted (official moved the mark
 * into a seat the shadowed entry declares) and the shortcut layer routes
 * session.search / workspace.add into the shadowed browser's private request
 * store. Both are consumed through the ledger instead, and both degrade to
 * "nothing" when the shipped side is not there.
 */
test('rc.2 archived filter: three explicit picks, legacy two-toggle fallback (v0.23.0)', () => {
  const text = read('src/client.js')
  const start = text.indexOf('function ViewOptionsMenu(')
  const end = text.indexOf('function CustomizeDialog(', start)
  const menu = text.slice(start, end)
  assert.ok(menu.length > 0, 'ViewOptionsMenu not found')
  // The era probe is the new default item's own label: pre-rc.2 hosts have no
  // viewOptions.hideArchived key, and official() returns null for a missing one.
  assert.match(menu, /const hideLabel = official\('viewOptions\.hideArchived'\)/)
  assert.match(menu, /const threeState = hideLabel !== null/)
  assert.match(menu, /\{ id: 'hide-archived', label: hideLabel, icon: icon\('IconArchiveOffOutlineRegular', 16\) \}/)
  assert.match(menu, /icon\(threeState \? 'IconQueueOutlineRegular' : 'IconArchiveOutline20', 16\)/)
  assert.match(menu, /\{ id: 'only-archived', label: onlyLabel, icon: icon\('IconArchiveCheckOutlineRegular', 16\) \}/)
  // rc.2 picks a state directly instead of toggling back to the default...
  assert.match(menu, /if \(id === 'hide-archived'\) \{ onFilterPick\('default'\)/)
  assert.match(menu, /onFilterPick\(threeState \? 'show' : \(filter === 'show' \? 'default' : 'show'\)\)/)
  assert.match(menu, /onFilterPick\(threeState \? 'only' : \(filter === 'only' \? 'default' : 'only'\)\)/)
  // ...and keeps exactly one of the three selected.
  assert.match(menu, /filter === 'only' \? \['only-archived'\] : \(threeState \? \['hide-archived'\] : \[\]\)/)
})

test('rc.2 archived-only view drops Workspaces without archived Sessions (v0.23.0)', () => {
  const text = read('src/client.js')
  // Official tree.ts groupByWorkspace: `if (archivedFilter === 'only' &&
  // members.length === 0) continue` — the inventory is not the archive list.
  assert.match(text, /const archivedOnly = archivedFilter === 'only'/)
  assert.match(text, /const workspaceVisible = \(workspace\) => !archivedOnly/)
  assert.match(text, /if \(!workspaceVisible\(workspace\)\) return \[\]/)
  // A name group emptied by the filter goes with its members, disk sub-levels
  // included (official re-parents a survivor onto the nearest rendered one).
  assert.match(text, /if \(archivedOnly && countVisibleAt\(node\) === 0\) return \[\]/)
  assert.match(text, /const countVisibleAt = \(level\) => \{/)
  // The empty body names the mode and offers the way back (official
  // EmptySessions: empty.noneArchived + empty.viewOthers).
  assert.match(text, /shippedText\('empty\.noneArchived', t\('empty\.noneArchived'\)\)/)
  assert.match(text, /shippedText\('empty\.viewOthers', t\('empty\.viewOthers'\)\)/)
  assert.match(text, /className: 'bw-empty-action'/)
  assert.match(text, /actions\.setArchivedFilter\('default'\)/)
})

test('rc.2 first-use Workspace name: display-only substitution, both surfaces (v0.23.0)', () => {
  const text = read('src/client.js')
  // Official api/workspace-controller/default-workspace.ts: the registry's
  // automatic first-use title is the on-disk leaf, and consumers label exactly
  // that title with the localized name.
  assert.match(text, /const DEFAULT_WORKSPACE_TITLE = 'default-workspace'/)
  assert.match(text, /const withDisplayTitles = \(items, localizedDefault\) => \{/)
  assert.match(text, /Object\.assign\(\{\}, workspace, \{ title: String\(localizedDefault\) \}\)/)
  // Sidebar AND hero picker build their trees from the resolved list, so both
  // surfaces (and the rename prefill fed from them) agree.
  assert.match(text, /const storedItems = useWorkspaces\(s => s\.items\)/)
  assert.match(text, /withDisplayTitles\(storedItems, defaultWorkspaceName\)/)
  assert.match(text, /const defaultWorkspaceName = t\('workspace\.defaultName'\)/)
  const hero = text.slice(text.indexOf('function HeroWorkspacePicker('), text.indexOf('function BetterBrowser('))
  assert.match(hero, /withDisplayTitles\(/, 'the hero picker resolves the same name')
  // Display only: nothing writes the localized name back to the registry.
  assert.doesNotMatch(text, /renameWorkspace\([^)]*defaultWorkspaceName/)
})

test('rc.2 schedule mark: the shipped seat occupant, legacy projection only as fallback (v0.23.0)', () => {
  const text = read('src/client.js')
  // rc.2 deleted packages/schedule/schedule/src/projection.ts, so
  // projectionValues.schedule never exists there: the new source is the seat
  // the SHIPPED browser declares, read off the ledger like the hero occupant.
  assert.match(text, /const scheduleSeatOf = \(slots\) => \{/)
  assert.match(text, /slots\.entries\('sidebar\.session\.row\.leading'\)/)
  assert.match(text, /scheduleSeatReader: \(\) => \{/)
  // A host without the seat (older dsh, or the Schedule overlay switched off)
  // renders NOTHING — no probing, no self-drawn substitute.
  assert.match(text, /const seat = scheduleSeatOf\(slots\)\s*\n\s*if \(!seat\) return null/)
  // The occupant's hooks compartment is bound to the `use<Name>` props the
  // slot renderer would synthesize (its use-sync-external-store shim is not on
  // the client baseline whitelist).
  assert.match(text, /const bindOccupantFace = \(face\) => \{/)
  assert.match(text, /\['use' \+ key\.charAt\(0\)\.toUpperCase\(\) \+ key\.slice\(1\)\] = bindSelectorHook\(observable\)/)
  assert.match(text, /return React\.useSyncExternalStore\(subscribe, getSelection\)/)
  // Shipped row rule: the leading cell belongs to the mark only while the
  // row's own primary state is idle, and never on an archived/blank row.
  assert.match(text, /const markNode = scheduleSeat && !status && !node\.archived && !node\.blank/)
  // Exactly one mark per row: the legacy projection badge is gated on the seat
  // being absent, so a host that has both can never render two.
  assert.match(text, /node\.hasActiveSchedule && !markNode/)
  assert.match(text, /: \(markNode \|\| E\('span', \{ className: 'bw-dot' \}\)\)/)
  // The foreign component renders behind the render-crash boundary.
  assert.match(text, /E\(QuietBoundary, \{ key: 'schedule-seat' \}, E\(ShippedSeatOccupant/)
})

test('rc.2 shortcuts: the shadowed browser\'s request channel is consumed here (v0.23.0)', () => {
  const text = read('src/client.js')
  // session.search / workspace.add resolve into the SHIPPED browser's private
  // store, whose only consumer is that component's effect. The seat is
  // shadowed at priority -1, so the channel is read off the ledger...
  assert.match(text, /const shippedBrowserFaceOf = \(slots, ownComponent\) => \{/)
  assert.match(text, /slots\.entries\('sidebar\.workspaces'\)/)
  assert.match(text, /entry\.component === ownComponent/)
  // ...and version-gated on the face's own shape: an older host has no
  // requestSearch, so there is no channel AND nothing is consumed.
  assert.match(text, /typeof face\.requestSearch === 'function'\) return face/)
  assert.match(text, /shippedBrowserFace: \(\) => shippedBrowserFaceOf\(slots, BetterBrowser\)/)
  // Consumption mirrors the shipped effect: search opens + focuses the field,
  // add runs the same flow as the header button, and both clear the request.
  assert.match(text, /if \(searchRequest === 0\) return/)
  assert.match(text, /if \(typeof closeAddWorkspace === 'function'\) closeAddWorkspace\(\)/)
  assert.match(text, /if \(!addRequested\) return/)
  assert.match(text, /const flow = startAddFlowRef\.current/)
  // The in-flight directory interaction is reported back so a second
  // Cmd/Ctrl+O is answered with the host's own reason instead of stacking.
  assert.match(text, /if \(typeof reportDirectoryBusy === 'function'\) reportDirectoryBusy\(true\)/)
  assert.match(text, /const settle = \(\) => \{ if \(typeof reportDirectoryBusy === 'function'\) reportDirectoryBusy\(false\) \}/)
  // The shipped fork notice rides the shadowed overlay: it is re-rendered here
  // and its dismissal delegates to the shipped channel.
  assert.match(text, /forkError\.reason === 'unavailable'/)
  assert.match(text, /typeof dismissForkError === 'function'\) dismissForkError\(\)/)
  // Sidebar shows the CURRENT binding next to the command it belongs to.
  assert.match(text, /const shortcutLabel = \(label, id\) => \{/)
  assert.match(text, /'aria-keyshortcuts': shortcutAria\('session\.search'\)/)
  assert.match(text, /'aria-keyshortcuts': shortcutAria\('workspace\.add'\)/)
  assert.match(text, /newSessionLabel: shortcutLabel\(t\('session\.new'\), 'session\.new'\)/)
  // The catalog is a bare observable: subscribed without a selector.
  assert.match(text, /const useObservableSnapshot = \(observable\) => \{/)
})

test('rc.2 design tokens: radii and focus rings follow the host scale (v0.23.0)', () => {
  const text = read('src/client.js')
  // rc.2 published --dsw-radius-* and --dsw-focus-ring-*; every adopted value
  // keeps its pre-rc.2 pixel value as the fallback so older hosts only gain
  // the token when the host has it.
  for (const token of ['--dsw-radius-xs', '--dsw-radius-sm', '--dsw-radius-md']) {
    assert.ok(text.includes('var(' + token + ','), 'token without a fallback: ' + token)
  }
  assert.match(text, /outline:var\(--dsw-focus-ring-width,2px\) solid var\(--dsw-focus-ring-color,var\(--dsw-alias-state-business-primary,#5b8def\)\);outline-offset:-2px/)
})

/**
 * Auto appearance for new items (v0.24.0, prefs.autoStyle — OFF by default).
 * The palette is FIXED in code and every entry has to stay readable as the
 * row's text color on the light AND the dark sidebar, so the readability rule
 * is asserted here rather than trusted.
 */
const loadAutoStyle = () => {
  const text = read('src/client.js')
  // Two pure slices: the slot table + resolvers (kept beside colorToRgb, where
  // strokeColorOf can reach them) and the icon pool + shuffle bag.
  const slotsStart = text.indexOf('/* ---------- auto palette slots + theme resolution (v0.25.0, pure) ---------- */')
  const slotsEnd = text.indexOf('/* ---------- end of the auto palette slot block ---------- */')
  const bagStart = text.indexOf('const AUTO_ICON_POOL = [')
  const bagEnd = text.indexOf('/* ------------------ end of the pure auto-style block')
  assert.ok(slotsStart !== -1 && slotsEnd !== -1 && slotsStart < slotsEnd, 'auto palette slot block not found')
  assert.ok(bagStart !== -1 && bagEnd !== -1 && bagStart < bagEnd, 'auto-style block not found')
  const block = text.slice(slotsStart, slotsEnd) + '\n' + text.slice(bagStart, bagEnd)
  return new Function(block + '\nreturn { AUTO_COLOR_SLOTS, AUTO_COLOR_TOKENS, AUTO_TOKEN_RE, isAutoColorToken, resolveAutoColor, resolveColorValue, AUTO_ICON_POOL, AUTO_RECENT_WINDOW, createAutoStyler, autoShuffle }')()
}

const relativeLuminance = (hex) => {
  const value = parseInt(hex.slice(1), 16)
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((raw) => {
    const s = raw / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}
const contrastRatio = (a, b) => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

test('auto style: two theme palettes, each ≥4.5 (normal-text AA) on its own background (v0.25.0)', () => {
  const { AUTO_COLOR_SLOTS, AUTO_COLOR_TOKENS, resolveAutoColor, resolveColorValue, isAutoColorToken, AUTO_ICON_POOL } = loadAutoStyle()
  // "内置定死十几个颜色": a dozen-plus, capped so a shuffled bag still reads as variety.
  assert.ok(AUTO_COLOR_SLOTS.length >= 12 && AUTO_COLOR_SLOTS.length <= 16, 'slot count: ' + AUTO_COLOR_SLOTS.length)
  assert.equal(AUTO_COLOR_TOKENS.length, AUTO_COLOR_SLOTS.length, 'one token per slot')
  assert.equal(new Set(AUTO_COLOR_TOKENS).size, AUTO_COLOR_TOKENS.length, 'tokens must be unique')
  // Measured surfaces (see CHANGELOG v0.25.0): light base #ffffff with a hover /
  // current overlay around #f7f8fa, dark base #151517 with layer tokens up to
  // #2c2c2e. The CONSERVATIVE ends are asserted, so every slot clears normal-text
  // AA even on a hovered/selected row, not merely on the base surface.
  const LIGHT_STRICT = '#ebedf0'
  const LIGHT_BASE = '#ffffff'
  const DARK_STRICT = '#2c2c2e'
  const DARK_BASE = '#151517'
  const seenLight = new Set()
  const seenDark = new Set()
  for (const slot of AUTO_COLOR_SLOTS) {
    assert.match(slot.light, /^#[0-9a-f]{6}$/, 'light slot must be a plain hex: ' + slot.light)
    assert.match(slot.dark, /^#[0-9a-f]{6}$/, 'dark slot must be a plain hex: ' + slot.dark)
    // On the CONSERVATIVE (strictest realistic) surface of its own theme:
    assert.ok(contrastRatio(slot.light, LIGHT_STRICT) >= 4.5,
      slot.name + ' light ' + slot.light + ' below normal-text AA on ' + LIGHT_STRICT + ': ' + contrastRatio(slot.light, LIGHT_STRICT).toFixed(2))
    assert.ok(contrastRatio(slot.dark, DARK_STRICT) >= 4.5,
      slot.name + ' dark ' + slot.dark + ' below normal-text AA on ' + DARK_STRICT + ': ' + contrastRatio(slot.dark, DARK_STRICT).toFixed(2))
    // …and therefore also on the real base surfaces (asserted so a future edit
    // cannot trade the strict surface for the easy one).
    assert.ok(contrastRatio(slot.light, LIGHT_BASE) >= 4.5, slot.name + ' light fails on white')
    assert.ok(contrastRatio(slot.dark, DARK_BASE) >= 4.5, slot.name + ' dark fails on the dark base')
    seenLight.add(slot.light)
    seenDark.add(slot.dark)
  }
  assert.equal(seenLight.size, AUTO_COLOR_SLOTS.length, 'light palette entries must be unique')
  assert.equal(seenDark.size, AUTO_COLOR_SLOTS.length, 'dark palette entries must be unique')
  // Hue continuity: a slot keeps its hue across themes (a flip must not jump
  // from red to blue), and the two palettes are genuinely different colours.
  for (const slot of AUTO_COLOR_SLOTS) assert.notEqual(slot.light, slot.dark, slot.name + ' paints the same colour in both themes')
  // The light pool is the DARKER family and the dark pool the lighter one —
  // that is what makes each side clear AA on its own background.
  for (const slot of AUTO_COLOR_SLOTS) {
    assert.ok(relativeLuminance(slot.light) < relativeLuminance(slot.dark),
      slot.name + ': the light-theme colour must be darker than its dark-theme sibling')
  }
  // The cross-theme numbers are recorded, not required: a light-theme colour on
  // the dark sidebar is not a promise this feature makes (the token resolves to
  // the other pool there). Asserted only so the values stay honest in the docs.
  const cross = AUTO_COLOR_SLOTS.map((slot) => ({
    name: slot.name,
    lightOnDark: +contrastRatio(slot.light, DARK_STRICT).toFixed(2),
    darkOnLight: +contrastRatio(slot.dark, LIGHT_STRICT).toFixed(2),
  }))
  assert.equal(cross.length, AUTO_COLOR_SLOTS.length)
  // Tokens, not hexes, are what gets stored — and they resolve per theme.
  assert.match(AUTO_COLOR_TOKENS[0], /^auto:0$/)
  assert.equal(resolveAutoColor('auto:0', false), AUTO_COLOR_SLOTS[0].light)
  assert.equal(resolveAutoColor('auto:0', true), AUTO_COLOR_SLOTS[0].dark)
  assert.equal(resolveAutoColor('auto:12', true), AUTO_COLOR_SLOTS[12].dark, 'the last slot must resolve')
  assert.equal(resolveAutoColor('#123456', false), '', 'a hex is not a token')
  assert.equal(resolveAutoColor('auto:999', false), AUTO_COLOR_SLOTS[0].light, 'an unknown index clamps to slot 0 (append-only table)')
  assert.equal(resolveColorValue('#123456', true), '#123456', 'manual hex passes through untouched')
  assert.equal(resolveColorValue('auto:3', true), AUTO_COLOR_SLOTS[3].dark, 'a token resolves against the given theme')
  assert.equal(resolveColorValue('', false), '')
  assert.equal(isAutoColorToken('auto:3'), true)
  assert.equal(isAutoColorToken('#c40d00'), false)
  // Icons come from the existing candidate list — never a new icon set.
  // (The theme-subscription guards live in their own tests below, so a mutation
  // in either shape reports independently.)
  const text = read('src/client.js')
  const choices = text.slice(text.indexOf('const ICON_CHOICES = ['), text.indexOf('const ICON_PICKER_CHOICES'))
  assert.ok(AUTO_ICON_POOL.length >= 10, 'icon pool too small: ' + AUTO_ICON_POOL.length)
  for (const name of AUTO_ICON_POOL) {
    assert.ok(choices.includes("'" + name + "'"), 'icon outside the existing candidate list: ' + name)
    assert.notEqual(name, 'none', 'an invisible icon must never be drawn')
  }
})

/**
 * P1 guards, split on purpose (v0.25.0). The verifier mutated the fix and saw
 * only "fail 1" while both assertions lived in one test: the first throw masked
 * the second, so a half-fix ("subscription present but never used") looked the
 * same as "no subscription at all". Two tests report independently.
 */
test('auto style: the row renderer subscribes to the theme flip (v0.25.0 P1 guard 1/2)', () => {
  const text = read('src/client.js')
  const browserStart = text.indexOf('function BetterBrowser(props) {')
  assert.ok(browserStart !== -1, 'BetterBrowser not found')
  const rowStyleStart = text.indexOf('const rowStyleOf = (key) => {', browserStart)
  assert.ok(rowStyleStart > browserStart, 'rowStyleOf not found inside BetterBrowser')
  assert.match(text.slice(browserStart, rowStyleStart), /const autoDarkTheme = useAutoThemeDark\(\)/,
    'BetterBrowser must subscribe to the theme flip (useAutoThemeDark), or a switch never repaints the rows')
})

test('auto style: the row colour resolves with the SUBSCRIBED theme (v0.25.0 P1 guard 2/2)', () => {
  const text = read('src/client.js')
  // "Subscription present but unused" is the half-fix this catches: reading the
  // theme without passing it keeps the old implicit DOM read, and a switch then
  // repaints only after some unrelated re-render.
  assert.match(text, /const color = resolveColorValue\(appearance\.color \|\| '', autoDarkTheme\)/,
    'the row colour must be resolved with the SUBSCRIBED theme, not a DOM read')
})

test('auto style: shuffle bag + recent-dedup drawer, colors and icons independent (v0.24.0)', () => {
  const { createAutoStyler, autoShuffle } = loadAutoStyle()
  const colors = ['c1', 'c2', 'c3', 'c4', 'c5']
  const icons = ['i1', 'i2', 'i3']
  let seed = 42
  const random = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  const styler = createAutoStyler(colors, icons, random)
  // One bag cycle draws every entry exactly once — no repeat while the bag lasts.
  const cycle = []
  for (let i = 0; i < colors.length; i += 1) cycle.push(styler.nextColor())
  assert.deepEqual(cycle.slice().sort(), colors.slice().sort(), 'a bag cycle must cover the pool exactly once')
  // Across a refill the recent window is skipped: with the real 13-slot pool
  // (drawn as `auto:N` TOKENS since v0.25.0 — the draw must not depend on the
  // theme) the next pool-window draws are exactly the entries the refill left in.
  const { AUTO_COLOR_TOKENS, AUTO_RECENT_WINDOW } = loadAutoStyle()
  const big = createAutoStyler(AUTO_COLOR_TOKENS, icons, random)
  const first = []
  for (let i = 0; i < AUTO_COLOR_TOKENS.length; i += 1) first.push(big.nextColor())
  assert.deepEqual(first.slice().sort(), AUTO_COLOR_TOKENS.slice().sort(), 'a bag cycle must cover the pool exactly once')
  const blocked = first.slice(-AUTO_RECENT_WINDOW)
  const refilled = []
  for (let i = 0; i < AUTO_COLOR_TOKENS.length - AUTO_RECENT_WINDOW; i += 1) refilled.push(big.nextColor())
  for (const value of refilled) assert.ok(!blocked.includes(value), 'repeat inside the recent window: ' + value)
  assert.equal(new Set(refilled).size, refilled.length, 'a refilled bag must not repeat either')
  // Over a long run no two CONSECUTIVE draws are ever equal — the property the
  // user actually sees when adding several items in a row.
  let previous = null
  for (let i = 0; i < 120; i += 1) {
    const value = big.nextColor()
    assert.notEqual(value, previous, 'two consecutive items drew the same color')
    previous = value
  }
  // The icon bag is independent of the color bag.
  assert.ok(icons.includes(styler.nextIcon()))
  assert.ok(colors.includes(styler.nextColor()))
  // Shuffle is a permutation, and an injectable random keeps it reproducible.
  assert.deepEqual(autoShuffle(colors, () => 0).slice().sort(), colors.slice().sort())
  assert.deepEqual(autoShuffle(colors, () => 0), autoShuffle(colors, () => 0))
  // Degenerate pools degrade to "nothing to assign", never a crash.
  const empty = createAutoStyler([], [], random)
  assert.equal(empty.nextColor(), null)
  assert.equal(empty.nextIcon(), null)
})

test('auto style: opt-in switch, blank-only sessions, settled-inventory workspaces (v0.24.0)', () => {
  const text = read('src/client.js')
  // Default OFF: the store never seeds the key, and the reader demands `true`
  // (an absent key on every persisted snapshot therefore means off).
  assert.match(text, /const autoStyle = prefsMap\.autoStyle === true/)
  assert.match(text, /const autoStyle = prefs\.autoStyle === true/)
  assert.doesNotMatch(text, /init: \(\) => \(\{[\s\S]{0,400}autoStyle/)
  // The settings card exposes it as a real switch (same shape as the others).
  assert.match(text, /'aria-checked': autoStyle,/)
  assert.match(text, /onClick: \(\) => \{ setPref\('autoStyle', !autoStyle\) \}/)
  // Sessions are recognized as new ONLY while blank (a pre-existing row is
  // never blank), AND only after the first authoritative session snapshot was
  // seeded: a blank row that already existed at that point is recorded without
  // being styled, so "only items created after you turn it on" holds exactly
  // (an independent reviewer caught the missing seed as a slight deviation).
  assert.match(text, /summary\.blank !== true \|\| seen\.sessions\.has\(id\)/)
  assert.match(text, /if \(list && list\.byId && list\.phase !== 'pending'\) \{/)
  assert.match(text, /if \(!seen\.sessionsSeeded\) \{ seen\.sessions\.add\(id\); continue \}/)
  // The seed flag must NOT be consumed by an incomplete intermediate snapshot:
  // a cold-started Host can answer `ready` with an empty list while the real
  // rows are still arriving, and a flag set there styles every pre-existing row
  // that shows up next (one cold start in eight, caught by an independent
  // acceptance run). Both sides therefore set the flag only when the snapshot
  // actually registered rows.
  assert.match(text, /if \(sessionRowsSeen\) seen\.sessionsSeeded = true/)
  assert.match(text, /if \(workspaceRowsSeen\) seen\.seeded = true/)
  assert.doesNotMatch(text, /^\s*seen\.sessionsSeeded = true\s*$/m, 'the session seed flag must not be set unconditionally')
  assert.doesNotMatch(text, /^\s*seen\.seeded = true\s*$/m, 'the workspace seed flag must not be set unconditionally')
  assert.match(text, /sessionsSeeded: false, seeded: false,/)
  // Workspaces only after the first authoritative inventory is recorded.
  assert.match(text, /if \(phase === 'ready' && workspaceStreamState !== 'loading'\) \{/)
  assert.match(text, /if \(!seen\.seeded\) \{ seen\.workspaces\.add\(id\); continue \}/)
  assert.match(text, /if \(seen\.workspaces\.has\(id\)\) continue/)
  // Never overwrite: an existing entry (hand-set or pulled from the host copy)
  // makes the item skip — for both kinds.
  assert.match(text, /if \(!autoStyle \|\| stylingMap\['session:' \+ id\]\) continue/)
  assert.match(text, /if \(!autoStyle \|\| stylingMap\['workspace:' \+ id\]\) continue/)
  // Turning the toggle off stops assignment but keeps what was assigned: the
  // effect only writes, and the ledger/sets are never cleared.
  assert.doesNotMatch(text, /actions\.setStyling\([^)]*, null\)[\s\S]{0,80}autoStyle/)
  assert.doesNotMatch(text, /seen\.sessions\.clear\(|seen\.workspaces\.clear\(/)
  // Colors and icons draw from independent bags, and the batch write keeps the
  // host copy from holding only the last assignment.
  assert.match(text, /const color = autoStyler\.nextColor\(\)[\s\S]{0,200}const icon = autoStyler\.nextIcon\(\)/)
  assert.match(text, /if \(pending\.length > 0\) shared\.setStylingMany\(pending\)/)
  assert.match(text, /setStylingMany: \(entries\) => \{/)
  // Copy keys exist for every shipped language (the key-set test covers the
  // rest); both are actually rendered by the card.
  const zhBlock = text.slice(text.indexOf('const zh = {'), text.indexOf('const en = {'))
  assert.ok(zhBlock.includes("'settings.autoStyle':"), 'zh label missing')
  assert.ok(zhBlock.includes("'settings.autoStyle.hint':"), 'zh hint missing')
  assert.match(text, /t\('settings\.autoStyle'\)/)
  assert.match(text, /t\('settings\.autoStyle\.hint'\)/)
})

/**
 * The honest-copy guard covers ALL 21 shipped languages: the previous wording
 * ("都保证可读" / "stays readable") over-promised, because 3.0 is the WCAG
 * graphics / large-text threshold while the 13px regular row label is normal
 * text (AA = 4.5). Matching stays language-agnostic on purpose: word order and
 * decimal separator differ (ja 「コントラスト 3.0 以上」, ko 「대비 3.0 이상」,
 * de/fr use 3,0), and a strict pattern once mis-flagged correct translations.
 */
test('auto style: all 21 hints promise ≥4.5 (normal-text AA) per theme, no stale "not AA" copy (v0.25.0)', () => {
  const text = read('src/client.js')
  const hints = [...text.matchAll(/'settings\.autoStyle\.hint':\s*(?:'([^']*)'|"([^"]*)")/g)]
    .map((match) => match[1] !== undefined ? match[1] : match[2])
  const locales = [...text.matchAll(/\/\* locale: ([\w-]+) \*\//g)].map((match) => match[1])
  assert.equal(locales.length, 19, 'the LOCALES table must still carry 19 marked languages')
  assert.equal(hints.length, 21, 'expected exactly one hint per shipped language (zh + en + 19)')
  hints.forEach((hint, index) => {
    const tag = index === 0 ? 'zh' : index === 1 ? 'en' : locales[index - 2]
    assert.ok(hint.length > 60, tag + ': hint looks truncated')
    // The claim is now the AA one: 4.5 with the AA token, in whatever order and
    // with whichever decimal separator the language uses (ja 「コントラスト 4.5
    // 以上(本文の AA)」, ko 「대비 4.5 이상(본문 AA)」, de/fr 「4,5」).
    assert.match(hint, /4[.,]5/, tag + ': the ≥4.5 (AA) threshold must be stated')
    assert.match(hint, /AA/, tag + ': the AA token must be stated')
    // …and the OLD threshold/caveat must be gone: 3.0 is no longer the promise,
    // so stale copy saying "≥3.0" or "AA not reached" must fail here.
    assert.doesNotMatch(hint, /3[.,]0/, tag + ': stale ≥3.0 wording must be gone')
  })
  assert.doesNotMatch(hints[0], /未达/, 'the zh copy must not claim AA is unreached')
  assert.doesNotMatch(hints[0], /保证可读/, 'the zh over-promising wording must not come back')
  assert.doesNotMatch(hints[1], /does not reach/, 'the EN copy must not claim AA is unreached')
  assert.doesNotMatch(hints[1], /stays readable/, 'the old EN over-promising wording must not come back')
})

test('customize dialog honors the Modal height contract (v0.27.1, issue #10)', () => {
  const text = read('src/client.js')
  // The Modal .dialog frame is overflow:hidden; a card that grows past the
  // window gets clipped on BOTH ends (title unreachable on top, footer's
  // reset/done unreachable below ~1074px). The official contract caps growth
  // against the Modal padding box (max-height:100%) and scrolls the content
  // region (contentClassName), exactly like the in-tree RiskConfirmation.
  assert.ok(text.includes("'.bw-custom-dialog{max-height:100%}'"),
    'the card needs the max-height cap')
  assert.ok(text.includes("'.bw-custom-scroll{min-height:0;overflow-y:auto;overscroll-behavior:contain}'"),
    'the content region needs its own scroll + overscroll containment')
  assert.ok(text.includes("@supports (height:100dvh){.bw-custom-dialog{max-height:calc(100dvh - 48px)}}"),
    'the 100dvh fallback must stay for hosts sizing against viewport units')
  // The CustomizeDialog call must actually wire both classes into ui.Modal —
  // CSS alone is inert if the call site never passes it.
  const head = text.slice(text.indexOf('function CustomizeDialog'))
  const seg = head.slice(0, head.indexOf('StyleNode()'))
  assert.ok(seg.includes("className: 'bw-custom-dialog'"),
    'CustomizeDialog must pass className to ui.Modal')
  assert.ok(seg.includes("contentClassName: 'bw-custom-scroll'"),
    'CustomizeDialog must pass contentClassName to ui.Modal')
  // No accidental spread: exactly the CSS declarations + the one call site.
  assert.equal((text.match(/bw-custom-dialog/g) || []).length, 3,
    'bw-custom-dialog must appear exactly 3 times (css ×2 + className ×1)')
  assert.equal((text.match(/bw-custom-scroll/g) || []).length, 2,
    'bw-custom-scroll must appear exactly 2 times (css ×1 + contentClassName ×1)')
})


test('v0.30.2: rowTitleOf grafts the remembered display while the wire stays group-less', () => {
  const text = read('src/client.js')
  const start = text.indexOf('const remembered = (titleCacheRef')
  const end = text.indexOf('// Learn real titles from every snapshot')
  assert.ok(start !== -1 && end !== -1 && start < end, 'rowTitleOf block not found')
  const { rowTitleOf } = new Function('sessionTitleOf', 'titleCacheRef', 't',
    text.slice(start, end) + '\nreturn { rowTitleOf }')(
    (summary, t, remembered) => 'fallback:' + (summary && summary.title),
    { getSnapshot: () => ({ byId: { s1: { title: 'A/prev', display: 'A/prev' } }, rememberAllTitles() {} }) },
    (k) => k)
  assert.equal(rowTitleOf('s1', { title: 'bare' }, true), 'A/prev',
    'group-less wire + remembered display: the grafted title wins')
  assert.equal(rowTitleOf('s1', { title: 'A/kept' }, true), 'fallback:A/kept',
    'a grouped wire title always stands (the display is not consulted)')
  assert.equal(rowTitleOf('s1', { title: 'X/newgroup/leaf' }, true), 'fallback:X/newgroup/leaf',
    'a deliberately regrouped wire title stands verbatim')
  assert.equal(rowTitleOf('s1', { title: 'bare' }, false), 'fallback:bare',
    'grafting off: plain fallback even with a display present')
  assert.equal(rowTitleOf('s1', undefined, true), 'fallback:undefined',
    'a blank summary never consults the display')
})

test('issue #12: the in-row "..." menu is retired, row.action seat renders in a boundary', () => {
  const text = read('src/client.js')
  // The menu.item seat must never even be READ again: its occupants need
  // slot-level inject hooks (useShortcuts on 0.2.1-rc.2) that an in-row
  // reproduction cannot supply — one missing hook blanked the whole sidebar.
  assert.ok(!text.includes("seatEntriesOf('sidebar.workspaces.session.menu.item')"),
    'menu.item seat must not be read anymore')
  assert.ok(!text.includes('sessionActions.menuItems'), 'menuItems field must be gone')
  assert.ok(!text.includes('menuSeatChildren'), 'the in-row menu children must be gone')
  // The retired surface must not come back through the trigger path either.
  assert.ok(!text.includes('inlineMenu'), 'no inlineMenu reproduction may remain')
  // row.action seat: the official pin/archive buttons RENDER (the v0.34.0
  // regression was a step-aside with no render point), each inside a
  // QuietBoundary so one broken seat degrades to a missing button.
  assert.ok(text.includes('E(QuietBoundary, { key: \'row-action-seat-\' + index }'),
    'row.action occupants must render inside a QuietBoundary')
  assert.ok(text.includes('ownerProps: { sessionId: node.id, displayTitle: node.leaf || node.title },'),
    'row.action occupants need the slot owner props')
  // The fallback buttons step aside ONLY where the seat has entries.
  assert.ok(text.includes('const quickSeatUsed = Array.isArray(sessionActions.rowActionSeat) && sessionActions.rowActionSeat.length > 0'),
    'the seat/fallback switch must stay')
})

test('alpha.2: sidebar.session.row.trailing renders inside the row, between time and pin', () => {
  const text = read('src/client.js')
  // alpha.2 declares a row-inline trailing seat (ui-workspace Rows.tsx:744:
  // resting cell order time → trailing → pinned). It is where the official
  // experimental worktree/PR icon registers; a custom sidebar that never reads
  // the seat silently hides that surface.
  assert.ok(text.includes("const trailingSeat = seatEntriesOf ? seatEntriesOf('sidebar.session.row.trailing') : []"),
    'the trailing seat must be read from the ledger')
  assert.ok(text.includes('        trailingSeat,\n        rename:'),
    'the seat must reach SessionRow through sessionActions')
  assert.ok(text.includes('const trailingNode = !node.blank && trailingSeats.length > 0'),
    'blank rows carry no trailing cell (shipped rule)')
  assert.ok(text.includes("E(QuietBoundary, {\n          key: 'trailing-seat-' + index,"),
    'each occupant renders behind the render-crash boundary')
  assert.ok(text.includes('ownerProps: { sessionId: node.id }'),
    'the seat owner receives only the sessionId alpha.2 declares')
  // Resting-cell order must mirror Rows.tsx, or the icon lands left of the time.
  const timeAt = text.indexOf("className: 'bw-row-time'")
  const trailingAt = text.indexOf('        trailingNode,', timeAt)
  const pinAt = text.indexOf("className: 'bw-pin-indicator'", timeAt)
  assert.ok(timeAt > 0 && trailingAt > timeAt && pinAt > trailingAt,
    'trailing must sit between the time cell and the pin marker')
  // Same visibility rule as the shipped resting cell: hidden while hover
  // actions replace it.
  assert.ok(text.includes("'.bw-row-trailing{flex:none;display:inline-flex;align-items:center;gap:6px;"),
    'the trailing strip needs its resting-cell layout')
  assert.ok(text.includes('.bw-row:hover .bw-row-trailing'),
    'the trailing strip must yield to the hover actions like time/pin')
})

test('collapsed rail add button never reaches startAddFlow before initialization', () => {
  const text = read('src/client.js')
  // Regression: the rail renders before the main tree, but startAddFlow is a
  // const declared later in the component body. An early return placed above
  // it left the click handler in the temporal dead zone; the first collapsed
  // click threw "Cannot access 'startAddFlow' before initialization".
  const flowAt = text.indexOf('const startAddFlow = () => {')
  const refAt = text.indexOf('startAddFlowRef.current = startAddFlow')
  const railAt = text.indexOf('      if (!wide) {')
  assert.ok(flowAt > 0 && refAt > flowAt && railAt > refAt,
    'the collapsed rail must render only after startAddFlow is initialized')
  assert.ok(text.includes('onClick: () => { expandSidebar(); startAddFlow() }'),
    'the rail button must still expand and start the add flow')
})

test('issue #13: local reads and writes ride the PRIVATE store instance', () => {
  const text = read('src/client.js')
  // The bundle creates its own instance once (defineStore returns a HANDLE;
  // only .create() yields actions + a live snapshot source).
  assert.ok(text.includes('const viewInstance = viewStore.create()'),
    'the private instance must be created in apply')
  assert.ok(text.includes('const useViewStore = typeof React.useSyncExternalStore === \'function\''),
    'the private selector hook must exist')
  // Both seats switch to it through the inject face, keeping the ORIGINAL
  // prop names so a shadowing occupant cannot reach local state anymore.
  // Both seats (BetterBrowser + BetterWorkspacePluginCard) switch the same
  // way — rename the injected props, rebind to the private face.
  assert.equal((text.match(/useStore: injectedUseStore, actions: injectedActions,/g) || []).length, 2,
    'both seats must rename the injected props')
  assert.equal((text.match(/const actions = localStoreFace && localStoreFace.actions \? localStoreFace\.actions : injectedActions/g) || []).length, 2,
    'both seats must rebind actions to the private face')
  // The face travels through BOTH inject faces as a stable getter.
  assert.equal((text.match(/localStore: \(\) => \(\{ useStore: useViewStore, actions: viewInstance.actions \}\)/g) || []).length, 2,
    'both inject faces must carry the private store getter')
})

/* ------------------------------ v0.36.0 ------------------------------ */

test('v0.36.0: sub-level folder appearance saves by the RENDER key (idPath)', () => {
  const text = read('src/client.js')
  // keyOf must produce the SAME key the render side reads (renderPlainFolder
  // reads 'folder:' + idPath; idPath = node.idPath || node.path). Saving by
  // payload.path alone parked sub-level group styling under a key the render
  // never reads (issue: name-slash group appearance never applied).
  assert.match(text, /if \(kind === 'folder'\) return 'folder:' \+ \(payload\.idPath \|\| payload\.path\)/,
    'the appearance entryKey must fall back through idPath exactly like the render side')
})

test('v0.36.0: folder rows drag as whole groups (members retitled under the target prefix)', () => {
  const text = read('src/client.js')
  // The row must be draggable and arm the same one-frame drag state the
  // workspace drag uses (Chromium cancels a drag whose source moves).
  assert.match(text, /const folderDropEvents = \(idPath, path, node\) => \(\{\n        draggable: !searching,/,
    'folder rows carry draggable gated on search only')
  assert.match(text, /setDrag\(\{ kind: 'folder', source: \{ idPath, path, memberIds: collectMemberIds\(node\), levelKey: parentKeyOf\(idPath\) \}, over: null \}\)/,
    'the drag source records the render idPath, the semantic name path, the member block and its level key')
  // Batch move = the drag twin of submitFolderRename: every member title is
  // rewritten under the target prefix.
  assert.match(text, /const commitFolderMoveInto = \(source, targetIdPath\) => \{/,
    'the commit helper exists (source passed in, not closed over)')
  assert.match(text, /const affected = \(items \|\| \[\]\)\.filter\(\(w\) => String\(w\.title \|\| ''\)\.startsWith\(prefix\)\)/,
    'members are swept by title prefix over all items')
  assert.match(text, /const newSourcePath = targetPath \+ '\/' \+ sourceLeaf/,
    'v0.36.10 nest semantics: the group lands UNDER the target as target/leaf')
  assert.match(text, /await renameWorkspace\(w\.workspaceId, newSourcePath \+ String\(w\.title\)\.slice\(source\.path\.length\)\)/,
    'each member is retitled target/leaf + its relative title (cannot collide with the target children)')
  // Dropping a group into itself, its own descendant OR its own ancestor
  // would loop or duplicate a name segment: refused at hover (no
  // preventDefault) AND again at commit (belt and braces).
  const hoverCount = (text.match(/drag\.source\.path\.startsWith\(targetPath \+ '\/'\)/g) || []).length
  assert.equal(hoverCount, 1, 'the hover refuses self/descendant/ancestor targets exactly once')
  const commitCount = (text.match(/(?<!drag\.)source\.path\.startsWith\(targetPath \+ '\/'\)/g) || []).length
  assert.equal(commitCount, 1, 'the commit re-checks self/descendant/ancestor targets exactly once')
  // The namePath helper is shared by hover refusal and the commit.
  assert.equal((text.match(/const namePathOf = \(folderIdPath\) => \{/g) || []).length, 1,
    'namePathOf is defined once')
  // Folder rows light up for both drop kinds — the INTO band only.
  assert.match(text, /const wsDropInto = \(path\) => \(dragMatches\('workspace'\) \|\| dragMatches\('folder'\)\) && drag\.over && drag\.over\.kind === 'folder' && drag\.over\.target === path && \(!drag\.over\.zone \|\| drag\.over\.zone === 'into'\)/,
    'the folder drop highlight accepts both drag kinds on the into band')
  // The render passes BOTH keys plus the node: idPath for the drag/highlight
  // state, node.path for the batch rename prefix, node for member collection.
  assert.match(text, /dragEvents: folderDropEvents\(idPath, node\.path, node\)/,
    'the render hands the row both keys and the node')
})

test('v0.36.1: group rows use a content-band hover (outer reorder + middle into) with a growing slot', () => {
  const text = read('src/client.js')
  // v0.36.4 judges the bands against the row's ORIGINAL position: an open
  // slot pads the row with one logical row (--bw-row-h) via PADDING, so the
  // row box is twice as tall while the original position is the half the
  // content did NOT slide into (pad above for a before-slot, remaining
  // content box for an after-slot). Judging there keeps a still pointer from
  // flipping the slot when it opens (the "抽搐" report) and still lets the
  // pointer cross the original midpoint to switch direction; the vacated
  // half answers null so the caller keeps its current target.
  assert.match(text, /const originalBoxOf = \(el\) => \{/,
    'the original-position helper exists')
  assert.match(text, /if \(padTop > 0\) return \{ top: rect\.top, bottom: rect\.top \+ padTop \}/,
    'a before-slot judges the pad half (its original position)')
  assert.match(text, /if \(padBottom > 0\) return \{ top: rect\.top, bottom: rect\.bottom - padBottom \}/,
    'an after-slot judges the content-box half (its original position)')
  assert.match(text, /const rowZone = \(event\) => \{/,
    'a band-split rowZone helper exists')
  assert.match(text, /if \(y < box\.top \|\| y > box\.bottom\) return null/,
    'the vacated half answers null instead of a stale band')
  assert.match(text, /if \(h < 2\) return 'into'/,
    'a zero-height row answers into')
  assert.match(text, /const rel = \(y - box\.top\) \/ h\n        if \(rel < 0\.3\) return 'before'\n        if \(rel > 0\.7\) return 'after'\n        return 'into'/,
    'the original row is split 30/40/30 into before/into/after')
  assert.match(text, /if \(half === null\) return/,
    'a workspace row keeps its slot while the pointer rests in the vacated half')
  assert.match(text, /if \(zone === null\) \{/,
    'a group row keeps its slot while the pointer rests in the vacated half')
  // Siblings only for a band reorder: the target must share the parent whose
  // name list is being permuted, or no list position exists for the source.
  assert.match(text, /zone !== 'into' && parentKeyOf\(idPath\) !== parentKeyOf\(drag\.source\.idPath\)/,
    'edge-band reorder is only armed between sibling groups')
  assert.match(text, /const commitFolderReorder = \(source, targetIdPath, zone, targetNode\) => \{/,
    'the reorder commit exists (source passed in, not closed over)')
  assert.match(text, /if \(ownerPrefixOf\(source\.idPath\) !== ownerPrefixOf\(targetIdPath\)\) \{ console\.warn/,
    'the reorder commit re-checks the same-level gate (refusals warn, never silent)')
  assert.match(text, /if \(parentKeyOf\(source\.idPath\) !== parentKeyOf\(targetIdPath\)\) \{ console\.warn\('\[bw\] folder reorder refused: cross-parent target'\)/,
    'the reorder commit re-checks the same-parent gate')
  assert.match(text, /collectMemberIds\(targetNode\)\.filter\(\(id\) => !sourceSet\.has\(id\)\)/,
    'the source subtree is filtered out of the target block before anchoring')
  assert.match(text, /const anchor = zone === 'after'\n          \? targetMembers\[targetMembers\.length - 1\]\n          : targetMembers\[0\]/,
    'before anchors the surviving block head, after its tail')
  // Slot visuals: the row keeps its logical height and grows by PADDING
  // (transitionable; align-items cannot animate), so the total box is two
  // rows and the original position stays addressable by originalBoxOf. The
  // gap itself is the feedback: a faint brand wash, no insert line.
  assert.match(text, /\.bw-slot-above\{padding-top:var\(--bw-row-h,34px\);background:linear-gradient/,
    'the above slot slides content down and washes the gap')
  assert.match(text, /\.bw-slot-below\{padding-bottom:var\(--bw-row-h,34px\);background:linear-gradient/,
    'the below slot slides content up and washes the gap')
  assert.doesNotMatch(text, /height:calc\(var\(--bw-row-h,34px\)\*2\)/,
    'the slot never doubles the declared height (padding alone grows the box)')
  assert.match(text, /transition:height \.15s ease-out,padding \.15s ease-out/,
    'the row height and content slide are both animated')
  assert.match(text, /dropSlot === 'before' && 'bw-slot-above'/,
    'FolderRow opens the slot the moment the band is hit')
  assert.match(text, /dropHalf === 'before' && 'bw-slot-above'/,
    'WorkspaceRow opens the slot the same way (the blue line is gone)')
  assert.match(text, /dropSlot: wsFolderSlotOf\(idPath\)/,
    'the render derives the slot from the hover zone')
  assert.doesNotMatch(text, /slotArmed|wsFolderSlotArmed/,
    'no armed flag survives: the slot is immediate')
  assert.doesNotMatch(text, /scheduleFolderHoverExpand|folderHoverTimer|folderSlotLock/,
    'no hover auto-expand and no band lock survive')
  assert.doesNotMatch(text, /actions\.setExpanded\(targetIdPath, true\)/,
    'a successful move-into does NOT auto-open the target group')
  assert.doesNotMatch(text, /draggingWorkspace/,
    'the tree no longer reshapes itself while a workspace drag runs')
})

test('v0.36.2: edge-band reorder needs no hover intent; refusals warn loudly', () => {
  const text = read('src/client.js')
  // v0.36.4 retired the 200ms intent timer: a resting pointer on a band
  // opens the slot on the first dragover frame. Waiting made a fast drag
  // read as "只有一条蓝线" while a slow one read as "抽搐" — the feedback
  // itself has to be immediate for the drop position to be predictable.
  assert.doesNotMatch(text, /folderArmTimer|clearFolderArmTimer/,
    'the 200ms intent timer is retired')
  assert.doesNotMatch(text, /armed: true/,
    'nothing arms a band any more')
  assert.match(text, /const wsFolderSlotOf = \(folderIdPath\) => \(\(dragMatches\('folder'\) \|\| dragMatches\('workspace'\)\) && drag\.over && drag\.over\.kind === 'folder' && drag\.over\.target === folderIdPath && \(drag\.over\.zone === 'before' \|\| drag\.over\.zone === 'after'\)\) \? drag\.over\.zone : null/,
    'wsFolderSlotOf answers the band immediately for both drag kinds')
  // Silent returns are gone: every refusal says why in the console.
  assert.match(text, /console\.warn\('\[bw\] folder reorder refused: cross-level target'\)/,
    'cross-level reorder refusal warns')
  assert.match(text, /console\.warn\('\[bw\] folder reorder refused: cross-parent target'\)/,
    'cross-parent reorder refusal warns')
  assert.match(text, /console\.warn\('\[bw\] folder reorder refused: empty source block'\)/,
    'empty source refusal warns')
  assert.match(text, /console\.warn\('\[bw\] folder reorder refused: target has no members to anchor against'\)/,
    'anchor-less target refusal warns')
  assert.match(text, /console\.warn\('\[bw\] folder move refused: target is self, descendant or ancestor of', source\.path\)/,
    'loop/duplicate move refusal warns')
})

test('v0.36.3/0.36.7: an ancestor row only answers the framed INTO on the DIRECT parent', () => {
  const text = read('src/client.js')
  // v0.36.3 briefly opened the DIRECT parent's edge bands as a drag-out;
  // v0.36.4 closed it again. v0.36.7 reopens ONLY the parent's MIDDLE band,
  // and only as the framed INTO: "放进那个组" = move the block to the tail of
  // the container it already lives in (no rename). A further ancestor, or
  // either edge band on the parent, still refuses — moving a group to another
  // LEVEL is a title rewrite (the rename gesture), not an order change.
  assert.match(text, /if \(drag\.source\.path === targetPath \|\| targetPath\.startsWith\(drag\.source\.path \+ '\/'\)\) \{ clearOver\('folder', idPath\); return \}/,
    'self and descendant targets refuse first')
  assert.match(text, /if \(targetPath !== directParent \|\| zone !== 'into'\) \{ clearOver\('folder', idPath\); return \}/,
    'only the direct parent\'s middle band is accepted; every other ancestor refuses')
  assert.match(text, /const cutAt = drag\.source\.path\.lastIndexOf\('\/'\)\n              const directParent = cutAt === -1 \? '' : drag\.source\.path\.slice\(0, cutAt\)/,
    'the direct-parent carve-out is derived from the source name path')
  assert.match(text, /const sourceSet = new Set\(sourceIds\)\n        const targetMembers = collectMemberIds\(targetNode\)\.filter\(\(id\) => !sourceSet\.has\(id\)\)/,
    'the reorder commit still filters the source block out of its anchor')
  assert.doesNotMatch(text, /folderHoverTimer|scheduleFolderHoverExpand/,
    'the hover auto-expand machinery is fully retired')
})

test('v0.36.4: group order is persisted per parent and drives the tree sort', () => {
  const text = read('src/client.js')
  // THE bug behind "工作区文件夹完全没法改排序": buildTree sorted every level
  // by name, so a SUCCESSFUL commitFolderReorder (a registry edit) changed
  // nothing the user could see. The visible order now lives in the view
  // store, keyed by the PARENT identity, and buildTree sorts by it.
  assert.match(text, /folders: \{ ws: \{\}, sess: \{\} \}, folderOrder: \{\}/,
    'the store carries a persisted per-parent order map')
  assert.match(text, /setFolderOrder: \(d, parentKey, names\) => \{/,
    'an action writes it')
  assert.match(text, /const key = String\(parentKey == null \? '' : parentKey\)/,
    'the root level keys as the empty string')
  assert.match(text, /const folderOrderMap = useStore \? \(useStore\(s => s\.folderOrder\) \|\| EMPTY_FOLDERS\) : EMPTY_FOLDERS/,
    'the sidebar subscribes to it')
  assert.match(text, /const pickerFolderOrder = typeof useStore === 'function'/,
    'the workspace picker shares the same order')
  assert.match(text, /const orderOf = \(parentKey\) => \{/,
    'buildTree reads the order map per level')
  assert.match(text, /const ra = rank\.has\(a\.name\) \? rank\.get\(a\.name\) : names\.length/,
    'known names rank by list position')
  assert.match(text, /sortRec\(child, child\.idPath\)/,
    'each child level sorts by its own idPath')
  assert.match(text, /sortRec\(root, idPrefix\)/,
    'the top level sorts by its idPrefix')
  // The commit writes the SIBLING list it just permuted BEFORE touching the
  // registry, so the drop is visible on the spot.
  assert.match(text, /const orderParent = parentKeyOf\(source\.idPath\)/,
    'the commit resolves the parent whose list it permutes')
  assert.match(text, /writeLevelOrder\(orderParent, sourceName, targetName, zone\)/,
    'the commit persists the new sibling order (mixed token list)')
  assert.match(text, /const folderContainerOf = \(key\) => \{/,
    'a level is resolvable by parent key')
  assert.match(text, /const parentKeyOf = \(folderIdPath\) => \{/,
    'the parent identity helper exists')
  // The padded source row must not swallow its own target: the slot grows a
  // row by a full logical row, so the row the drag started on covers the
  // pointer's first stop and commitWorkspaceDrop would no-op on itself.
  assert.match(text, /if \(drag\.source && drag\.source\.workspaceId === workspace\.workspaceId\) return/,
    'the dragged workspace row is never its own drop target')
  // Persistence: the same store key the view options already ride.
  assert.match(text, /persist: 'dsh\.betterWorkspace\.view\.v1'/,
    'the order rides the existing persisted view store')
})

test('v0.36.4: an open reorder slot splits the original row at its midpoint (no INTO flip)', () => {
  const text = read('src/client.js')
  // fail() lives in BetterBrowser; setFlowOpen lives in WorkspacePicker. Crossing that
  // fiber boundary threw ReferenceError on every failure path (v0.36.4 fix).
  assert.doesNotMatch(text, /const fail = \(text\) => \{ setFlowOpen/,
    'fail() must not reach for the picker-scoped setFlowOpen')
  assert.match(text, /const fail = \(text\) => \{ setDialog\(null\); setErrorText/,
    'fail() closes the dialog and surfaces the error text')
  // THE flicker behind "变下级还是会被撑开" on the row being reordered: the
  // three bands were re-judged on the PADDED row, so a still pointer sitting
  // in the middle band flipped the just-opened slot to INTO on the next
  // dragover frame — the slot closed, and the drop handed
  // commitFolderMoveInto (a same-level no-op) instead of the reorder the
  // user aimed at.
  assert.equal((text.match(/const slotOpen = /g) || []).length, 1,
    'the slot-open probe exists exactly once')
  assert.match(text, /const slotOpen = drag\.over !== null && drag\.over\.kind === 'folder' && drag\.over\.target === idPath && \(drag\.over\.zone === 'before' \|\| drag\.over\.zone === 'after'\)/,
    'the row knows whether it already holds this drag slot')
  assert.match(text, /const pointerInRowBox = \(event\) => \{/,
    'v0.36.10: a helper tells the slot padding apart from the content box')
  assert.match(text, /const zone = slotOpen\n            \? \(pointerInRowBox\(event\) \? rowZone\(event\) : rowHalf\(event\)\)\n            : rowZone\(event\)/,
    'an open slot keeps its verdict on the padding band but RE-JUDGES the three bands in the content box — the INTO middle stays reachable after entering through an edge')
  // rowHalf is the plain midpoint split of the ORIGINAL position: no INTO band.
  assert.match(text, /return y < \(box\.top \+ box\.bottom\) \/ 2 \? 'before' : 'after'/,
    'rowHalf splits at the original midpoint with no middle band')
  // The pointer in the vacated half must keep the slot: re-deciding on the
  // padded geometry is exactly what flickered.
  assert.match(text, /if \(zone === null\) \{\n              if \(drag\.over && drag\.over\.kind === 'folder' && drag\.over\.target === idPath && \(drag\.over\.zone === 'before' \|\| drag\.over\.zone === 'after'\)\) \{/,
    'a pointer in the vacated half keeps this row open slot')
})

test('v0.36.5: a level is ONE mixed sequence (bare workspaces interleave with group rows)', () => {
  const text = read('src/client.js')
  // THE bug behind "插到第一个永远失败": every level painted all group rows
  // first and every bare workspace after, so a workspace dropped ABOVE a group
  // committed its registry edit but still painted last. A level now carries one
  // persisted sequence whose tokens are group names (the historical format) or
  // "w:<workspaceId>" — the same list drives the render AND the reorder commit.
  assert.match(text, /const wsById = new Map\(node\.workspaces\.map\(\(w\) => \[w\.workspaceId, w\]\)\)/,
    'the level indexes its bare workspaces by id')
  assert.match(text, /if \(token\.startsWith\('w:'\)\) \{/,
    'a persisted token may name a bare workspace')
  assert.match(text, /const id = token\.slice\(2\)/,
    'the workspace token carries the workspaceId after the prefix')
  assert.match(text, /seq\.push\(\{ kind: 'ws', entry \}\)/,
    'a workspace token produces a workspace entry in the mixed sequence')
  assert.match(text, /for \(const child of node\.folders\) if \(!seenFolders\.has\(child\.name\)\) seq\.push\(\{ kind: 'folder', node: child \}\)/,
    'groups the list does not mention append after it')
  assert.match(text, /for \(const w of node\.workspaces\) if \(!seenWorkspaces\.has\(w\.workspaceId\)\) seq\.push\(\{ kind: 'ws', entry: w \}\)/,
    'workspaces the list does not mention append in registry order')
  assert.match(text, /node\.seq = seq/,
    'the mixed sequence rides the level node')
  // The drag payload has to name the LEVEL it came from: the mixed reorder is
  // siblings-only, so both drop gates compare that key.
  assert.match(text, /for \(const w of node\.workspaces\) w\.levelKey = parentKey/,
    'every workspace entry records the level it renders in')
  // One token helper shared by renderer and commit: what the user sees and what
  // the drop edits cannot drift apart.
  assert.match(text, /const levelTokenOf = \(item\) => item\.kind === 'ws' \? 'w:' \+ item\.entry\.workspaceId : item\.node\.name/,
    'a level item tokenizes as a group name or a w:<id> token')
  assert.match(text, /const levelSeqOf = \(level\) => \(level && Array\.isArray\(level\.seq\)\)/,
    'levels without a sequence fall back to groups-then-workspaces')
  // v0.36.11 adds a fourth walk: "workspaces" + a name layer renders the
  // root-level name tree through the same loop. v0.36.12 adds a fifth:
  // nodeHoldsCurrent walks it to light ancestor folders holding the session.
  assert.equal((text.match(/for \(const item of levelSeqOf\(/g) || []).length, 5,
    'every render/active path walks the mixed sequence (root level, group row, plain folder, workspace+name tree, ancestor-active walk)')
  // Chain compression rebuilds the folder nodes; the sequence must keep the
  // compressed stand-ins in place or a bare workspace lands next to the wrong row.
  assert.match(text, /const seq = Array\.isArray\(built\.seq\)/,
    'chain compression repoints the sequence instead of dropping it')
  assert.match(text, /return \{ \.\.\.built, folders, workspaces: built\.workspaces, seq \}/,
    'the compressed tree carries the mixed sequence forward')
})

test('v0.36.11: "workspaces" + a name layer renders the root-level name tree', () => {
  const text = read('src/client.js')
  // THE bug behind "切到按工作区后树完全散开": the workspace branch hard-coded
  // the official scatter (every workspace at the root) and ignored the name
  // layer the user had enabled. The tree memo now resolves its mode through
  // groupBy — disk nesting OFF (official) but the name tree ON — and the
  // branch renders that same tree instead of the flat list.
  assert.match(text, /const treeMode = groupBy === 'workspace' && workspaceGroupMode !== 'disk'/,
    'the tree memo folds groupBy into its mode')
  assert.match(text, /\} else if \(groupBy === 'workspace'\) \{\n        if \(workspaceGroupMode === 'disk'\) \{/,
    'the workspace branch keeps the official scatter only when the name layer is off')
  assert.match(text, /for \(const item of levelSeqOf\(tree\)\) \{\n            bodyRows\.push\(\.\.\.\(item\.kind === 'ws'\n              \? renderWorkspaceEntry\(\{ workspace: item\.entry \}, 0, wsPulseOf\(item\.entry\)\)\n              : renderPlainFolder\(item\.node, 0\)\)\)\n          \}\n        \}\n        bodyRows\.push\(\.\.\.renderUngroupedBlock\(\)\)\n      \} else \{/,
    'a name layer turns the workspace branch into the same render loop as the tree branch')
  // buildTree('slash') is the model: disk nesting fully off, name groups at
  // the root, every workspace a top-level leaf.
  assert.match(text, /const diskParentOf = diskOn \? diskParentMapOf\(list\) : new Map\(\)/,
    'slash mode drops disk nesting at the source (empty parent map)')
  // The new-group dialog mirrors the hierarchy the user actually sees.
  assert.match(text, /const treeView = groupBy === 'workspace-tree'\n          \|\| \(groupBy === 'workspace' && workspaceGroupMode !== 'disk'\)/,
    'the new-group dialog mirrors the workspace+name tree')
  // The workspaces-layer picker keeps its own tree mode (it has no groupBy).
  assert.match(text, /const built = buildTree\(items, groupMode, wsFolders, pickerFolderOrder\)/,
    'the picker stays on its own groupMode variable')
})

test('v0.36.5: a workspace row and a group row reorder into each other (mixed drag)', () => {
  const text = read('src/client.js')
  // A workspace row now answers the reorder slot for a GROUP source too — the
  // mirror of a group row answering a workspace source. Same pending highlight,
  // same slot padding: one mechanism, two drag kinds.
  assert.match(text, /const wsDropHalf = \(workspaceId\) => \{\n        if \(!dragMatches\('workspace'\) && !dragMatches\('folder'\)\) return null/,
    'a workspace row answers the slot for both drag kinds')
  assert.match(text, /const wsFolderSlotOf = \(folderIdPath\) => \(\(dragMatches\('folder'\) \|\| dragMatches\('workspace'\)\)/,
    'a group row opens its slot for both drag kinds')
  // Both directions refuse cross-level targets at hover (no preventDefault means
  // the platform shows its own "no drop" cursor, which is the truth).
  // v0.36.6: the hover path now also CLEARS the stale highlight on refusal (an
  // un-preventDefaulted hover used to leave over.zone pointing at whatever band
  // the pointer passed through, so the drop read 'into' and landed at the end).
  // v0.36.7: the cross-level hover now has ONE meaningful target — the disk
  // row that OWNS the group answers the framed INTO (drop = back to that
  // level's tail); every other cross-level hover refuses and clears.
  assert.match(text, /const sourceLevel = drag\.source\.levelKey \|\| ''\n            if \(sourceLevel !== \(workspace\.levelKey \|\| ''\)\) \{/,
    'the group-onto-workspace hover gate splits the cross-level case')
  assert.match(text, /if \(sourceLevel === \(workspace\.subPrefix \|\| ''\)\) \{/,
    'the OWNING disk row is the one cross-level INTO target')
  assert.match(text, /setDrag\(current => \(current && current\.over && current\.over\.kind === 'ws-level' && current\.over\.target === workspace\.workspaceId\)/,
    'the owning row records a ws-level INTO hover')
  assert.match(text, /clearOver\('workspace', workspace\.workspaceId\)\n\s+clearOver\('ws-level', workspace\.workspaceId\)/,
    'every other cross-level hover clears the stale highlight')
  assert.match(text, /commitFolderMoveToLevelEnd\(drag\.source\)/,
    'the owning row drop commits the block back to its level tail')
  // v0.36.6: a workspace edge band on a group row accepts a same-DISK source so
  // the workspace can be lifted out of its name group into the parent level —
  // that lift (not INTO) is what makes "insert at the top" reachable.
  assert.match(text, /if \(zone !== 'into' && \(drag\.source\.levelKey \|\| ''\) !== parentKeyOf\(idPath\) && \(ownerPrefixOf\(idPath\) \|\| ''\) !== \(drag\.source\.disk \|\| ''\)\) \{ clearOver\('folder', idPath\); return \}/,
    'a workspace reaching a group edge band reorders in-level or lifts within the same disk level')
  assert.match(text, /commitWorkspaceLift\(drag\.source, idPath, zone\)/,
    'the cross-level edge-band drop commits the lift')
  // The middle band keeps its old meaning; only the edge bands became reorder.
  assert.match(text, /const reorder = zone !== 'into'/,
    'the INTO band still means move-into, not reorder')
  assert.match(text, /commitLevelReorder\(\{ kind: 'workspace', source: drag\.source \}, \{ kind: 'folder', target: idPath \}, zone\)/,
    'a workspace dropped on a group edge band reorders the level')
  assert.match(text, /commitLevelReorder\(\{ kind: 'folder', source: drag\.source \}, \{ kind: 'workspace', workspace \}, half \|\| 'before'\)/,
    'a group dropped on a workspace half reorders the level')
  // The shared commit: token per kind, the container decided by the TARGET, and
  // the same-level re-check as belt and braces.
  assert.match(text, /const commitLevelReorder = \(sourceRef, targetRef, zone\) => \{/,
    'one commit serves both mixed directions')
  assert.match(text, /const sourceToken = wsSource \? 'w:' \+ sourceRef\.source\.workspaceId : namePathOf\(sourceRef\.source\.idPath\)\.split\('\/'\)\.pop\(\)/,
    'the source token is a workspace id or the group leaf name')
  assert.match(text, /const containerKey = folderTarget \? parentKeyOf\(targetRef\.target\) : \(targetRef\.workspace\.levelKey \|\| ''\)/,
    'the target names the level the list is written under')
  assert.match(text, /if \(sourceLevelKey !== containerKey\) \{ console\.warn\('\[bw\] level reorder refused: cross-level target', sourceLevelKey, containerKey\); return \}/,
    'the commit re-checks the level and says why it refused')
  // The write itself: re-read the level's OWN tokens, move the one token,
  // persist. Reading live tokens (not a stale index) is what keeps positions of
  // every other row intact.
  assert.match(text, /const tokens = levelSeqOf\(container\)\.map\(levelTokenOf\)/,
    'the write starts from the level current token list')
  assert.match(text, /tokens\.splice\(zone === 'after' \? targetAt \+ 1 : targetAt, 0, sourceToken\)/,
    'the moved token lands before or after its target')
  assert.match(text, /actions\.setFolderOrder\(containerKey, tokens\)/,
    'the mixed list persists through the view store')
  assert.match(text, /console\.warn\('\[bw\] level reorder refused: source not in this level', sourceToken\)/,
    'a stale source token warns instead of silently dropping the drag')
  // A group reorder writes the same mixed list (it used to write only names,
  // which erased the workspace positions of that level).
  assert.match(text, /writeLevelOrder\(orderParent, sourceName, targetName, zone\)/,
    'the group reorder goes through the shared mixed write')
  // A workspace->workspace drop still edits the registry, but once the level
  // carries mixed tokens the registry alone no longer moves the row.
  assert.match(text, /if \(tokens\.some\(\(token\) => token\.startsWith\('w:'\)\)\) \{/,
    'a plain workspace reorder also refreshes the mixed list when the level has one')
  assert.match(text, /writeLevelOrder\(levelKey, 'w:' \+ source\.workspaceId, 'w:' \+ targetWorkspace\.workspaceId, half === 'after' \? 'after' : 'before'\)/,
    'the workspace reorder mirrors itself into the mixed list')
})



test('v0.36.6: a workspace lifts OUT of its group onto any same-disk level (insert-as-first)', () => {
  const text = read('src/client.js')
  // THE proven bug (probe12): hover over a group row of ANOTHER level refused
  // without preventDefault, so {over} kept the INTO band the pointer crossed on
  // its way down; the drop then ran move-into and left the row LAST in the
  // group — exactly the user's "I aim at the first position and it lands at the
  // end". A refused hover must also clear the stale highlight.
  assert.match(text, /const clearOver = \(targetKind, target\) => setDrag\(\(current\) => \(current && current\.over && current\.over\.kind === targetKind && current\.over\.target === target\) \? \{ \.\.\.current, over: null \} : current\)/,
    'refusals clear a stale highlight instead of leaving the old band to decide the drop')
  // A workspace edge band on a group row now accepts a source from ANOTHER
  // level as long as both live in the same disk scope; the middle band keeps
  // move-into.
  assert.match(text, /if \(zone !== 'into' && \(drag\.source\.levelKey \|\| ''\) !== parentKeyOf\(idPath\) && \(ownerPrefixOf\(idPath\) \|\| ''\) !== \(drag\.source\.disk \|\| ''\)\) \{ clearOver\('folder', idPath\); return \}/,
    'the lift gate allows same-disk levels and refuses a disk crossing')
  // Drop decides the band from the live highlight first, geometry second — a
  // drop that arrives before any hover frame recorded a band still lands where
  // the pointer is.
  assert.match(text, /const overZone = drag\.over && drag\.over\.kind === 'folder' && drag\.over\.target === idPath && \(drag\.over\.zone === 'before' \|\| drag\.over\.zone === 'after'\) \? drag\.over\.zone : null/,
    'the drop prefers the hovered band')
  assert.match(text, /const geoZone = rowZone\(event\) \|\| 'into'/,
    'a band-less drop falls back to the pointer geometry')
  assert.match(text, /if \(\(drag\.source\.levelKey \|\| ''\) === parentKeyOf\(idPath\)\) commitLevelReorder\(\{ kind: 'workspace', source: drag\.source \}, \{ kind: 'folder', target: idPath \}, zone\)\n            else commitWorkspaceLift\(drag\.source, idPath, zone\)/,
    'same level reorders, another level lifts')
  // The lift itself: a title rewrite to the TARGET level (leaving a group is a
  // rename, not a disk move), then a registry insert, then the level token that
  // actually paints the row in place.
  assert.match(text, /const commitWorkspaceLift = \(source, targetIdPath, zone, anchorWorkspaceId\) => \{/,
    'the lift commit exists (an optional row anchor serves the workspace-row drop)')
  // v0.36.6: a cross-LEVEL drop on a workspace row half is a placement too —
  // renaming into the target row's group used to leave the row somewhere else
  // inside that group (the "line here, lands there" report).
  assert.match(text, /if \(workspaceSlash && \(targetWorkspace\.levelKey \|\| ''\) !== \(source\.levelKey \|\| ''\)\) \{\n          commitWorkspaceLift\(source, targetWorkspace\.levelKey \|\| '', half === 'after' \? 'after' : 'before', targetWorkspace\.workspaceId\)/,
    'a cross-level workspace-row drop lifts to the target row level and anchors at that row')
  assert.match(text, /if \(anchorWorkspaceId\) \{\n          if \(zone === 'before'\) \{\n            anchor = anchorWorkspaceId/,
    'a row-anchored lift anchors at the dropped-on row')
  assert.match(text, /insertLevelToken\(targetParentKey, 'w:' \+ source\.workspaceId, targetNamePath\.split\('\/'\)\.pop\(\), zone\)/,
    'the level token lands beside the target group/token in the parent level')
  assert.match(text, /const levelNamePath = cutAt === -1 \? targetParentKey : targetParentKey\.slice\(cutAt \+ 2\)/,
    'the target level is read back out of the idPath')
  assert.match(text, /const newTitle = levelNamePath !== '' \? levelNamePath \+ '\/' \+ source\.leaf : source\.leaf/,
    'the lifted workspace is retitled to its new level (or to a bare leaf at the root)')
  assert.match(text, /\.then\(\(\) => \(sameNameLevel \? Promise\.resolve\(\) : renameWorkspace\(source\.workspaceId, newTitle\)\)\)/,
    'a same-name level skips the redundant rename')
  assert.match(text, /anchor = targetMembers\[0\]/,
    'before anchors at the target block head (so it lands first)')
  assert.match(text, /const tailAt = registryIds\.indexOf\(targetMembers\[targetMembers\.length - 1\]\)/,
    'after anchors at the id following the whole target block, not its head')
  // insertLevelToken / removeLevelToken are the missing halves of writeLevelOrder:
  // a lifted token is not in the target level yet, and the level it LEFT must
  // not keep a stale token that a later re-group could resurrect.
  assert.match(text, /const insertLevelToken = \(containerKey, sourceToken, targetToken, zone\) => \{/,
    'the lift splices a token into a level that does not have it yet')
  assert.match(text, /const tokens = levelSeqOf\(container\)\.map\(levelTokenOf\)\.filter\(\(token\) => token !== sourceToken\)/,
    'the lift drops a duplicate token before splicing')
  assert.match(text, /if \(targetAt === -1\) \{ console\.warn\('\[bw\] workspace lift refused: target group not in this level', targetToken\); return false \}/,
    'a missing target token warns instead of silently misplacing the row')
  assert.match(text, /const removeLevelToken = \(containerKey, token\) => \{/,
    'the level the workspace LEFT is cleaned up')
  assert.match(text, /if \(sourceKey !== targetParentKey\) removeLevelToken\(sourceKey, 'w:' \+ source\.workspaceId\)/,
    'a lift within the same level never removes its own token')
})


test('v0.36.7: dropping a group on its OWN container row is the framed INTO (block goes to the level tail)', () => {
  const text = read('src/client.js')
  // The user's report: dragging a group row ("工作区分区") onto the workspace
  // row that CONTAINS it showed no feedback at all, while a workspace row
  // dropped on a group row answers the framed INTO. Same visual language now:
  // the owning disk row lights the framed INTO and the drop puts the block at
  // that level's tail — the only position that means "放入这个工作区下"
  // without rewriting any title prefix.
  assert.match(text, /const wsGroupIntoActive = \(workspaceId\) => dragMatches\('folder'\) && drag\.over !== null && drag\.over\.kind === 'ws-level' && drag\.over\.target === workspaceId/,
    'a group hover on its owning disk row is the framed INTO state')
  assert.match(text, /dropInto: wsRootDropActive\(workspace\.workspaceId\) \|\| wsGroupIntoActive\(workspace\.workspaceId\)/,
    'the workspace row renders the framed INTO for both drop languages')
  // The gesture exists only for the row that OWNS the group: sourceLevel is
  // the level the group lives in, and a disk row owns exactly its subPrefix.
  assert.equal((text.match(/if \(sourceLevel === \(workspace\.subPrefix \|\| ''\)\) \{/g) || []).length, 2,
    'both the hover and the drop offer the INTO on the owning disk row')
  // The commit: read the level tokens, move the group token to the tail.
  assert.match(text, /const moveFolderToLevelEnd = \(source\) => \{/,
    'the level-tail move is one shared helper')
  assert.match(text, /const containerKey = source\.levelKey \|\| ''\n        const container = folderContainerOf\(containerKey\)/,
    'the container is the level the group already lives in')
  assert.match(text, /const token = namePathOf\(source\.idPath\)\.split\('\/'\)\.pop\(\)\n        const tokens = levelSeqOf\(container\)\.map\(levelTokenOf\)/,
    'the block is identified by its level token')
  assert.match(text, /const next = tokens\.filter\(\(entry\) => entry !== token\)\n        next\.push\(token\)/,
    'the token is re-appended at the tail')
  assert.match(text, /console\.warn\('\[bw\] folder move refused: group not in this level', token\)/,
    'a stale token warns instead of silently dropping the drag')
  assert.match(text, /const commitFolderMoveToLevelEnd = \(source\) => \{\n        setDrag\(null\)\n        moveFolderToLevelEnd\(source\)/,
    'the disk-row drop closes the gesture and commits')
  // The DIRECT parent group row is the same container at the name layer, and
  // its commit (a batch move-into) must take the tail branch BEFORE the
  // ancestor refusal — otherwise the framed INTO would die at drop time.
  assert.match(text, /if \(targetPath === directParent\) \{ moveFolderToLevelEnd\(source\); return \}/,
    'the direct-parent INTO commits the tail move instead of the rename')
  // The immediate hover still opens the empty slot on edge bands (reorder);
  // only the middle band changed meaning.
  assert.match(text, /if \(targetPath !== directParent \|\| zone !== 'into'\) \{ clearOver\('folder', idPath\); return \}/,
    'the parent edge bands still refuse (a rename is not an order change)')
})

/**
 * Regression: "In one list" + "Last updated" must sort across workspace
 * boundaries (and Ungrouped), rather than concatenating individually sorted
 * workspace runs. Exercise the actual client functions without a Cordis host.
 */
test('flat last-updated order is global, preserving blank and pinned sections', () => {
  const source = read('src/client.js')
  const helperStart = source.indexOf('    const pinnedPartition = (rows) => {')
  const helperEnd = source.indexOf('    const sessionTitleOf = ', helperStart)
  const flatStart = source.indexOf('      const renderFlatRows = () => {')
  const flatEnd = source.indexOf('      const renderUngroupedBlock = ', flatStart)
  assert.ok(helperStart !== -1 && helperEnd > helperStart && flatStart !== -1 && flatEnd > flatStart)
  const render = new Function('items', 'sessionsOf', 'ungrouped', 'orderBy', 'currentId', 'renderSessionRow',
    source.slice(helperStart, helperEnd) + '\n' + source.slice(flatStart, flatEnd) + '\nreturn renderFlatRows()')

  const workspaces = [{ workspaceId: 'a' }, { workspaceId: 'b' }]
  const sessions = {
    a: [
      { id: 'a-old', title: 'a/old', updatedAt: 10 },
      { id: 'a-pin', title: 'a/pin', updatedAt: 20, pinned: true },
    ],
    b: [
      { id: 'b-recent', title: 'b/recent', updatedAt: 80 },
      { id: 'b-pin', title: 'b/pin', updatedAt: 60, pinned: true },
    ],
  }
  const ungrouped = [
    { id: 'loose-newest', title: 'loose', updatedAt: 100 },
    { id: 'blank', title: 'New Session', updatedAt: 0, blank: true },
  ]
  const run = (orderBy, rows = ungrouped) => render(
    workspaces, (w) => sessions[w.workspaceId], rows, orderBy, 'blank', (s) => s)
  assert.deepEqual(run('updated').map(s => s.id), [
    'blank', 'b-pin', 'a-pin', 'loose-newest', 'b-recent', 'a-old',
  ])
  // Preserve full names in flat mode; only grouping modes split by '/'.
  assert.equal(run('updated').find(s => s.id === 'b-recent').leaf, 'b/recent')
  // Manual view deliberately retains caller order; no global sort.
  assert.deepEqual(run('manual').map(s => s.id), [
    'a-old', 'a-pin', 'b-recent', 'b-pin', 'loose-newest', 'blank',
  ])
  // Blank still leads when there are NO pinned sessions.
  const noPins = Object.fromEntries(Object.entries(sessions).map(([key, value]) =>
    [key, value.map(s => ({ ...s, pinned: false }))]))
  const noPinRender = (w) => noPins[w.workspaceId]
  const withoutPins = render(workspaces, noPinRender, ungrouped, 'updated', 'blank', (s) => s)
  assert.deepEqual(withoutPins.map(s => s.id), [
    'blank', 'loose-newest', 'b-recent', 'b-pin', 'a-pin', 'a-old',
  ])
})

/**
 * Regression (v0.36.9): a workspace that CONTAINS the drop target — the disk
 * scope ancestor, e.g. the "用户目录" container dragged onto its own group
 * "工作" or onto a workspace row inside it — must refuse every band. The old
 * code renamed the container under its own subtree ("工作/用户目录"; the lift
 * path even wrote the raw scope id into the title, "2d412faa…/用户目录").
 */

test('v0.36.9: a container workspace cannot be dropped inside its own disk subtree', () => {
  const text = read('src/client.js')
  // The shared judgement: resolve a drop target's disk scope down the parent
  // chain, then walk the disk parent map looking for the dragged workspace.
  const diskScopeAt = text.indexOf('const diskScopeOf = (folderIdPath) => {')
  assert.ok(diskScopeAt !== -1, 'a group row resolves to the disk scope that actually owns it')
  assert.ok(text.indexOf('if (diskParentMap.has(current)) return current', diskScopeAt) !== -1,
    'the scope walk stops at the first real workspace id')
  const loopAt = text.indexOf('const isOwnDescendantScope = (diskScope, workspaceId) => {')
  assert.ok(loopAt !== -1, 'the container check walks the disk parent map')
  assert.ok(text.indexOf('if (current === workspaceId) return true', loopAt) !== -1,
    'the scope chain reaching the dragged container means a loop')
  // Group-row hover: the anti-loop gate runs BEFORE any band is answered —
  // the INTO middle included — and clears any leftover over state.
  const folderHoverGate = "if (isOwnDescendantScope(diskScopeOf(idPath), drag.source.workspaceId)) { clearOver('folder', idPath); return }"
  assert.ok(text.includes(folderHoverGate), 'a container never lights any band on its own group rows')
  assert.ok(text.indexOf(folderHoverGate) < text.indexOf("if (zone !== 'into' && (drag.source.levelKey || '') !== parentKeyOf(idPath)"),
    'the group-row anti-loop gate precedes the lift band decision')
  // Group-row drop: the geometry fallback must not resurrect a refused drop.
  assert.equal(text.split('if (isOwnDescendantScope(diskScopeOf(idPath), drag.source.workspaceId)) return').length - 1, 1,
    'the group-row drop repeats the gate before preventDefault')
  // Workspace-row hover AND drop: the target row may sit inside the dragged
  // container's subtree — lifting beside it would rename the container under
  // itself. Both entry points refuse with no feedback.
  assert.equal(text.split('if (isOwnDescendantScope(diskParentMap.get(workspace.workspaceId), drag.source.workspaceId)) return').length - 1, 2,
    'both the workspace-row hover and its drop refuse the container ancestor')
})

test('v0.36.10: level-mate groups nest, lift and survive a resting drag', () => {
  const text = read('src/client.js')
  // 1) NEST — "把平行帮拖到 Fis管理后台 下面". The old prefix swap merged the
  // members straight into the target level and died on name-conflict when the
  // target had a child with the same leaf name (Web/Back on both sides).
  assert.match(text, /const commitFolderLift = \(source, workspace, zone\) => \{/,
    'the group lift commit exists (mirror of commitWorkspaceLift)')
  assert.ok(text.includes("const cutAt = targetLevel.lastIndexOf('//')"),
    'the lift cuts the target level key at the owner separator')
  assert.ok(text.includes("const levelNamePath = cutAt === -1 ? '' : targetLevel.slice(cutAt + 2)"),
    'the lift resolves the target level name path (disk root lifts to a plain top-level group)')
  assert.match(text, /removeLevelToken\(source\.levelKey \|\| '', sourceLeaf\)\n            insertLevelToken\(targetLevel, sourceLeaf, 'w:' \+ workspace\.workspaceId, zone === 'after' \? 'after' : 'before'\)/,
    'the lifted group token moves to the target level anchored at the row')
  // 2) The nest commit moves the token INSIDE the target group.
  assert.match(text, /insertLevelToken\(targetIdPath, sourceLeaf, tokens\[tokens\.length - 1\], 'after'\)/,
    'the nested group token lands inside the target group list')
  assert.ok(text.includes("const newKey = owner === '' ? newSourcePath : owner + '//' + newSourcePath"),
    'member order follows the group to its new level key')
  // 3) LIFT hover — a cross-level workspace row's EDGE band (same disk scope,
  // not inside the source) arms a folderLift instead of silently refusing.
  assert.match(text, /const half = rowHalf\(event\)\n                const sourceScope = diskScopeOf\(drag\.source\.idPath\)\n                const targetDisk = diskParentMap\.get\(workspace\.workspaceId\) \|\| workspace\.workspaceId\n                const targetLevel = workspace\.levelKey \|\| ''\n                const insideSource = targetLevel === drag\.source\.idPath \|\| targetLevel\.startsWith\(drag\.source\.idPath \+ '\/'\)/,
    'the lift hover gates on the edge band, the disk scope and self-nesting')
  assert.match(text, /over: \{ kind: 'workspace', target: workspace\.workspaceId, half, workspace, folderLift: true \}/,
    'the lift hover arms a folderLift carrying the row object')
  assert.match(text, /commitFolderLift\(drag\.source, workspace, over\.half\)/,
    'the lift drop commits')
  // 4) The middle band of an open slot stays reachable (three bands re-judged
  // in the content box) — nesting through the natural approach path works.
  assert.match(text, /pointerInRowBox\(event\) \? rowZone\(event\) : rowHalf\(event\)/,
    'the content box re-judges while the padding keeps the slot')
  // 5) A resting drag still commits: dragEnd honors the armed {over} unless a
  // real drop ran or Escape cancelled.
  assert.equal((text.match(/const dragStateRef = React\.useRef\(null\)/g) || []).length, 1,
    'one drag state mirror for the dragEnd fallback')
  assert.equal((text.match(/dragDroppedRef\.current = true/g) || []).length, 6,
    'every preventDefault drop marks itself (folder drop, ws drop, owning-row nest, group lift, group reorder, ws drop)')
  assert.equal((text.match(/dragCancelledRef\.current = false/g) || []).length, 2,
    'both dragEnds reset the escape flag')
  assert.match(text, /if \(committed \|\| cancelled \|\| !live \|\| live\.kind !== 'folder' \|\| !live\.over\) return/,
    'the folder dragEnd falls back to the armed over only when no drop and no escape happened')
  assert.match(text, /if \(over\.kind === 'folder'\) \{\n            if \(over\.zone === 'before' \|\| over\.zone === 'after'\) commitFolderReorder\(live\.source, over\.target, over\.zone, over\.node\)\n            else commitFolderMoveInto\(live\.source, over\.target\)/,
    'the folder dragEnd replays the armed reorder or nest')
  assert.match(text, /else if \(over\.kind === 'workspace' && over\.half && over\.folderLift && over\.workspace\) \{\n            commitFolderLift\(live\.source, over\.workspace, over\.half\)/,
    'the folder dragEnd replays the armed lift')
  assert.match(text, /if \(committed \|\| cancelled \|\| !live \|\| live\.kind !== 'workspace' \|\| !live\.over\) return/,
    'the workspace dragEnd falls back the same way')
  assert.match(text, /commitWorkspaceDrop\(over\.workspace, over\.half\)/,
    'the workspace dragEnd replays the armed workspace reorder')
  assert.match(text, /if \(event\.key === 'Escape'\) dragCancelledRef\.current = true/,
    'Escape still cancels the gesture for real')
})

test('v0.36.13: every tree-shaped surface shares ONE view rule (no per-surface drift)', () => {
  const text = read('src/client.js')
  // THE recurring bug class: a surface renders a hierarchy but keeps its own
  // private view condition, so toggling a grouping mode leaves ONE surface
  // scattering rows the others keep as a tree (v0.36.11 sidebar vs v0.36.13
  // picker). The rule lives once per surface, and all of them agree:
  // "workspaces" + a name layer ON renders the tree; only a purely-disk flat
  // view or 'flat' collapses.
  const rule = /groupBy === 'workspace' && workspaceGroupMode !==? 'disk'/
  const surfaces = [
    ['sidebar tree memo', /const treeMode = groupBy === 'workspace' && workspaceGroupMode !== 'disk'\s*\n\s*\? 'slash'\s*:\s*workspaceGroupMode/],
    ['sidebar rawTree', /groupBy === 'workspace' && workspaceGroupMode !== 'disk' \? 'slash' : workspaceGroupMode,/],
    ['new-group chooser treeView', /const treeView = groupBy === 'workspace-tree'\s*\n\s*\|\| \(groupBy === 'workspace' && workspaceGroupMode !== 'disk'\)/],
    ['session picker flatMode', /const flatMode = groupBy === 'flat'\s*\n\s*\|\| \(groupBy === 'workspace' && workspaceGroupMode === 'disk'\)/],
  ]
  for (const [name, re] of surfaces) assert.match(text, re, name + ' must carry the shared view rule')
  assert.match(text, rule, 'the shared rule names groupBy and the name layer together')
  // The ancestor-active walk (v0.36.12) must be view-agnostic: it recurses the
  // mixed sequence itself instead of asking which mode produced it.
  assert.match(text, /const nodeHoldsCurrent = \(level\) => \{[\s\S]{0,220}for \(const item of levelSeqOf\(level\)\)/,
    'ancestor folder active walks the rendered tree, not a view branch')
})

test('v0.36.14: unnamed rows use the official Untitled label in every language (issue #16)', () => {
  const text = read('src/client.js')
  const locales = [...text.matchAll(/\/\* locale: ([\w-]+) \*\//g)].map((match) => match[1])
  assert.equal(locales.length, 19, 'the LOCALES table must still carry 19 marked languages')
  const entries = [...text.matchAll(/'session\.untitled':\s*'([^']*)'/g)].map((match) => match[1])
  assert.equal(entries.length, 21, 'every shipped language must define session.untitled')
  entries.forEach((value, index) => {
    const tag = index === 0 ? 'zh' : index === 1 ? 'en' : locales[index - 2]
    assert.ok(value.length > 0, tag + ': session.untitled must not be empty')
  })
  assert.equal(entries[0], '未命名')
  assert.equal(entries[1], 'Untitled')
  // The official label is the ONLY terminal fallback: the host displayTitle
  // (project basename) must never become a row title again.
  const start = text.indexOf('const sessionTitleOf =')
  const end = text.indexOf('/**', start)
  assert.ok(start !== -1 && end !== -1)
  const body = text.slice(start, end)
  assert.match(body, /return t\('session\.untitled'\)/)
  assert.doesNotMatch(body, /summary\.displayTitle/)
})
