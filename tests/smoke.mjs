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

test('client half registers the three expected slots', () => {
  const text = read('src/client.js')
  assert.match(text, /slots\.inject\('sidebar\.workspaces'/)
  assert.match(text, /priority: -1/, 'browser shadowing needs the lowest rank')
  assert.match(text, /slots\.inject\('conversation\.hero\.workspace\.directoryFlow'/)
  assert.match(text, /slots\.inject\('sidebar\.workspaces\.directoryFlow'/)
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
  // keeps the raw injected renameSession.
  assert.match(text, /const renameByUser = \(sessionId, title\) => \{/)
  assert.equal((text.match(/renameByUser\(/g) || []).length, 3, 'exactly 3 user call sites')
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
  const keyLines = (segment) => [...segment.matchAll(/^ +'([^']+)': '/gm)].map((m) => m[1]).sort()
  const zhKeys = keyLines(text.slice(text.indexOf('const zh = {'), text.indexOf('const en = {')))
  assert.ok(zhKeys.length >= 100, 'the zh dictionary looks truncated: ' + zhKeys.length)

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
  assert.match(text, /const makeSharedWrites = \(actions, stylingMap, foldersList\)/)
  assert.equal((text.match(/shared\.(setStyling|addFolder|removeFolder|renameFolder)\(/g) || []).length, 6,
    'browser (5) + flow (1) preference writes all go through the shared wrappers')
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

