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
  assert.equal(pkg.engines.dsh, '>=0.1.0')
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
  assert.match(text, /slots\.inject\('settings\.plugin\.item',[\s\S]*?key: 'better-workspace',/)
  assert.match(text, /slots\.inject\('plugins\.bundle\.config',[\s\S]*?key: 'dsh-better-workspace',/)
  assert.match(text, /props\.view === 'page'/)
})

test('client plugin exports the cordis plugin triple', () => {
  const text = read('src/client.js')
  assert.match(text, /name: 'dsh-better-workspace'/)
  assert.match(text, /inject: \['slots', 'sessions', 'workspaces', 'locale', 'uiWorkspace', 'settingsScope'\]/)
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
  // keeps the raw injected renameSession. 5 call sites: drag-into-session-group,
  // session rename dialog, session-group rename, plus the two group-move
  // entry points (single session / session-group batch).
  assert.match(text, /const renameByUser = \(sessionId, title\) => \{/)
  assert.equal((text.match(/renameByUser\(/g) || []).length, 5, 'exactly 5 user call sites')
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
  assert.equal(sessionTitleOf({ displayTitle: 'basename' }, t), 'basename', 'no memory: fallback stands')
  assert.equal(sessionTitleOf({ displayTitle: 'basename' }, t, ''), 'basename', 'blank memory never masks the fallback')
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
  assert.match(text, /sessionTitleOf\(summary, t, rememberedTitleOf\(id\)\)/)
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
    + '\nreturn { titleCache, loadTitleCache, rememberAllTitles, TITLE_CACHE_LIMIT, TITLE_CACHE_KEEP }')
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
})


test('manual cross-device sync: host scope bind, dual writes, pull modes', () => {
  const text = read('src/client.js')
  // Scope bound once per activation; failures degrade to browser-local.
  assert.match(text, /ctx\.settingsScope && typeof ctx\.settingsScope\.bind === 'function'/)
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
test('appearance: outline on (gray default), pick or auto, field-by-field merge (0.10.0)', () => {
  const text = read('src/client.js')
  const start = text.indexOf('const colorToRgb =')
  const end = text.indexOf('function FolderRow(')
  assert.ok(start !== -1 && end !== -1 && start < end, 'appearance helpers not found')
  const loaded = new Function(text.slice(start, end) +
    '\nreturn { DEFAULT_APPEARANCE, readAppearance, mergeAppearance, contrastStrokeColor, parseCssColor, strokeStyleOf }')()
  const { DEFAULT_APPEARANCE, readAppearance, mergeAppearance, contrastStrokeColor, parseCssColor, strokeStyleOf } = loaded
  // The outline ships ON — text over a background image is unreadable without it.
  assert.equal(DEFAULT_APPEARANCE.stroke, true)
  assert.equal(DEFAULT_APPEARANCE.strokeWidth, 1)
  assert.equal(DEFAULT_APPEARANCE.color, '')
  assert.equal(DEFAULT_APPEARANCE.strokeColor, '#808080', 'the outline defaults to gray')
  // Hydration replaces state wholesale: every read tolerates missing keys.
  assert.deepEqual(readAppearance(undefined), DEFAULT_APPEARANCE)
  assert.equal(readAppearance({}).stroke, true, 'a missing stroke key keeps the default outline')
  assert.equal(readAppearance({}).strokeColor, '#808080', 'a missing color key keeps the gray default')
  assert.equal(readAppearance({ stroke: false }).stroke, false, 'an explicit off survives')
  assert.equal(readAppearance({ strokeWidth: 99 }).strokeWidth, 2, 'width clamps to the slider range')
  assert.equal(readAppearance({ strokeWidth: 0 }).strokeWidth, 1, 'a zero width falls back to the default')
  // Row entries override the default FIELD BY FIELD: entries written before the
  // outline existed still inherit it.
  const merged = mergeAppearance(DEFAULT_APPEARANCE, { color: '#f85149', glow: 6 })
  assert.equal(merged.color, '#f85149')
  assert.equal(merged.glow, 6)
  assert.equal(merged.stroke, true, 'older entries inherit the default outline')
  assert.equal(merged.strokeWidth, 1)
  assert.equal(mergeAppearance(DEFAULT_APPEARANCE, { stroke: false }).stroke, false, 'a row can turn it off')
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
  assert.match(text, /if \(typeof insertSessionBefore === 'function'\) \{\n          Promise\.resolve\(\)/,
    'the host channel is tried first in the drop commit')
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
  assert.match(text, /groupBy: 'workspace-tree', orderBy: 'manual', sessionTitleSlash: true, workspaceTitleSlash: false/)
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
  // Workspace slash toggle OFF: no name layer — workspaces mount straight
  // at their disk level; the DISK layer is a filesystem fact and survives.
  const flat = buildTree(items, false)
  assert.deepEqual(flat.folders, [], 'no name groups')
  assert.deepEqual(flat.workspaces.map((w) => w.workspaceId), ['a'])
  assert.equal(flat.workspaces[0].leaf, 'web/前端', 'leaf keeps the full title')
  assert.equal(flat.workspaces[0].folderPath, '')
  assert.ok(flat.workspaces[0].sub, 'disk nesting survives')
  assert.equal(flat.workspaces[0].sub.workspaces[0].leaf, 'api')

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
 */
test('add-workspace flow: official chooser, browse Host pointed at the official flow (v0.16.0)', () => {
  const text = read('src/client.js')
  // The affordance probes the composed backend and rides the OFFICIAL chooser;
  // a browse Host is pointed at the official in-app flow instead of opening a
  // plugin-built browser (which the seat shadowing made unrenderable for good).
  assert.match(text, /pickerCapabilityNow\(\)/)
  assert.match(text, /const startAddFlow = \(\) => \{/)
  assert.match(text, /if \(kind === 'browse'\) \{ setDialog\(\{ kind: 'add-guide' \}\); return undefined \}/)
  assert.match(text, /if \(pickerRefusal\(reason\)\) \{ setDialog\(\{ kind: 'add-guide' \}\); return \}/)
  assert.match(text, /if \(dialog\.kind === 'add-guide'\)/)
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
  // Menu entries follow official ids, icons, and danger semantics.
  assert.match(text, /ot\('delete\.workspace'\)/)
  assert.match(text, /ot\('menu\.fork'\)/)
  assert.match(text, /ot\('menu\.archiveSession'\)/)
  assert.match(text, /ot\('rename'\)/)
  assert.match(text, /icon\('IconArchiveOutline20', 16\)/)
  assert.match(text, /icon\('IconTrashOutline16', 16\), danger: true/)
  // The archive entry must NOT be destructive (official Rows.tsx comment).
  assert.match(text, /deliberately NOT styled destructive/)
  // Rendered through the official primitives Menu, positioned by the event.
  assert.match(text, /typeof ui\.Menu === 'function'\) \? E\(ui\.Menu/)
  assert.match(text, /getAnchorRect: \(\) => new DOMRect\(ctx\.x, ctx\.y, 0, 0\)/)
  // The bw-only entries ride after a separator.
  assert.match(text, /id: 'customize', label: t\('custom\.title'\), icon: icon\('IconPersonalizationOutline16', 16\)/)
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
  assert.match(text, /workspaceTitleSlash: false, folders: \{ ws: \{\}, sess: \{\} \} \}\)/, 'init ships the new default OFF plus the declared-group bags')
  assert.match(text, /const workspaceSlashOf = \(value\) => value === undefined \? true : value === true/, 'tri-state read')
  const start = text.indexOf('const workspaceSlashOf = (value) =>')
  const end = text.indexOf('\n', start)
  const { workspaceSlashOf } = new Function(text.slice(start, end) + '\nreturn { workspaceSlashOf }')()
  assert.equal(workspaceSlashOf(undefined), true, 'a pre-0.13 snapshot keeps grouping (upgrade must not reorganize)')
  assert.equal(workspaceSlashOf(true), true, 'explicit on')
  assert.equal(workspaceSlashOf(false), false, 'explicit off')

  // The switch moved out of the sidebar view menu and into the settings card,
  // where a flat tree has a findable explanation.
  assert.doesNotMatch(text, /id: 'workspace-slash'/, 'gone from the view menu')
  assert.match(text, /t\('settings\.workspaceSlash'\)/, 'carried by the settings card')
  assert.match(text, /t\('settings\.workspaceSlash\.hint'\)/, 'with its explanation')
  assert.match(text, /actions\.setWorkspaceTitleSlash\(!workspaceSlash\)/, 'the card writes the view store')
  // Same tri-state read on both surfaces: a mismatch would show the switch in
  // one state and render the tree in the other.
  assert.equal((text.match(/workspaceSlashOf\(useStore\(s => s\.workspaceTitleSlash\)\)/g) || []).length, 2, 'tree + card agree')
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
  // Native controls survive ONLY as the fallback: one select, and the datalist
  // is gone for good (its popup could not be styled at all).
  assert.equal((text.match(/E\('select', \{/g) || []).length, 1, 'one native select left, as the fallback')
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
  assert.match(text, /if \(rows\.length === 0 && !hasDeclared\(sessFolders, workspace\.workspaceId\)\) return \[\]/,
    'empty session rows no longer short-circuit a declared group away')
  // Every caller threads the bag through.
  assert.match(text, /buildTree\(items, workspaceSlash, wsFolders\)/, 'the main tree passes the workspace bag')
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
  assert.match(text, /const pick = \(node\) => \{ setPicked\(node\); setError\(''\) \}/, 'clicking a node picks the container')
  // The session layer has no "top level": folders.sess is keyed by workspaceId,
  // so a declaration filed under '' would never be read by any render path. Its
  // introduction is a plain HINT, not a header row that reads as a node.
  assert.match(text, /return \{ hint: t\('group\.new\.pickWorkspace'\), nodes \}/,
    'session layer lists workspaces under a hint, with no fake root node')
  assert.match(text, /if \(!picked\) \{ setError\(t\('group\.new\.pickFirst'\)\); return \}/,
    'commit refuses an unpicked container')
  assert.match(text, /plan\.nodes\.length > 0 \? renderNodes\(plan\.nodes, 0\) : E\('div', \{ className: 'bw-gn-empty' \}/,
    'an empty workspace list explains itself instead of rendering nothing')
  assert.match(text, /onConfirm\(kind, picked\.scope, picked\.path === '' \? clean : picked\.path \+ '\/' \+ clean\)/,
    'the name is appended to the picked container path')
  assert.match(text, /actions\.addFolder\(kind, scope, path\)/, 'confirm writes the declaration')
  // The tree carries the exact write targets.
  assert.match(text, /const wsGroupNodesOf = \(node\) => \{/, 'workspace container walk')
  assert.match(text, /scope: f\.scope, path: f\.path/, 'a folder node files into its own level')
  assert.match(text, /scope: w\.subPrefix, path: '', label: w\.leaf/, 'a workspace node files into the disk level it owns')
  assert.match(text, /const sessGroupNodesOf = \(node, workspaceId\)/, 'session container walk')
  assert.match(text, /scope: workspaceId, path: g\.path/, 'a session group files under its workspace')
  // Menu hygiene (user report): the plugin's own entries sit AFTER the
  // separator, and the move entry must carry a glyph the host actually has.
  assert.match(text, /icon\('IconFolderOpenOutline16', 16\) \}/, 'move-to-group uses a glyph this host ships')
  assert.doesNotMatch(text, /icon\('IconFolderOutline16'/, 'the retired glyph must not come back')
  assert.match(text, /id: 'delete-folder', label: t\('menu\.deleteGroup'\)/, 'an empty group can be deleted')
  assert.match(text, /ctx\.payload\.empty \? \[deleteFolderEntry\] : \[\]/, 'delete is offered for empty groups only')
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
