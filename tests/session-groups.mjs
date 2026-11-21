// Session-group ordering / nesting / batch selection (v0.44.0, issue #29).
// Pure helpers are sliced out of the shipped source and executed, so the
// assertions describe BEHAVIOUR (what the tree builder and the drop-commit
// helpers actually return); the remaining guards are file-level and protect
// the wiring that a pure test cannot reach (drag handlers, store keys,
// dictionaries).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const CLIENT_CHUNKS = ['src/client.locales.js', 'src/client.styles.js']
const clientText = () => [...CLIENT_CHUNKS.map(read), read('src/client.js')].join('\n')

/**
 * Slice the module-level pure helpers the same way the shipped bundle runs
 * them: plain functions over plain data, no React, no store.
 * - basename..normPath: the title splitter buildSessionTree depends on;
 * - explicitSegsOf..buildTree: the declared-group reader;
 * - buildSessionTree..DISK_SEP: the tree builder plus every ordering helper
 *   that sits next to it (reorderIds, sessionGroup*, orderTokens*, retitle*).
 */
const loadHelpers = () => {
  const text = read('src/client.js')
  const cut = (from, to) => {
    const start = text.indexOf(from)
    const end = text.indexOf(to)
    assert.ok(start !== -1 && end !== -1 && end > start, 'slice anchors ' + from + ' -> ' + to)
    return text.slice(start, end)
  }
  const src = cut('const basename =', 'const normPath =')
    + cut('const explicitSegsOf =', 'function buildTree')
    + cut('function buildSessionTree', 'const DISK_SEP =')
    + '\nreturn { buildSessionTree, reorderIds, sessionGroupOrderKey, orderTokensWith, orderTokensWithout, sessionGroupParentPath, sessionGroupLeafName, retitleGroupMember }'
  return new Function(src)()
}

const groupNames = (node) => node.groups.map((g) => g.name)

test('v0.44.0: session group order key namespaces the level by workspace + parent path', () => {
  const h = loadHelpers()
  // The root level of a workspace has its own bucket; a nested level appends
  // the parent path. Two workspaces can never share a bucket.
  assert.equal(h.sessionGroupOrderKey('w1', ''), 'w1|')
  assert.equal(h.sessionGroupOrderKey('w2', ''), 'w2|')
  assert.equal(h.sessionGroupOrderKey('w1', 'web'), 'w1|web')
  assert.equal(h.sessionGroupOrderKey('w1', 'web/api'), 'w1|web/api')
  // Missing inputs must not produce the string 'undefined' — hydration gives
  // old snapshots no such key at all.
  assert.equal(h.sessionGroupOrderKey(null, null), '|')
  assert.equal(h.sessionGroupOrderKey(undefined, undefined), '|')
  // Session buckets can never collide with a workspace-tree level key, which
  // is an idPrefix ('' or a bare workspaceId) and never contains '|'.
  assert.ok(!h.sessionGroupOrderKey('w1', '').startsWith('w:'))
})

test('v0.44.0: orderTokensWith moves one name inside a level (pure)', () => {
  const h = loadHelpers()
  const level = ['alpha', 'beta', 'gamma']
  // before / after place the mover relative to the anchor.
  assert.deepEqual(h.orderTokensWith(level, 'gamma', 'alpha', 'before'), ['gamma', 'alpha', 'beta'])
  assert.deepEqual(h.orderTokensWith(level, 'alpha', 'gamma', 'after'), ['beta', 'gamma', 'alpha'])
  assert.deepEqual(h.orderTokensWith(level, 'alpha', 'gamma', 'after'), ['beta', 'gamma', 'alpha'])
  // A droppped-adjacent pair stays put (idempotent for the store write guard).
  assert.deepEqual(h.orderTokensWith(level, 'alpha', 'beta', 'before'), level)
  // Unknown anchor (the target vanished mid-drag) appends instead of throwing.
  assert.deepEqual(h.orderTokensWith(level, 'alpha', 'missing', 'after'), ['beta', 'gamma', 'alpha'])
  // Dropping a row onto itself is a no-op that still returns a list — not a
  // silent jump to the end of the level.
  assert.deepEqual(h.orderTokensWith(level, 'beta', 'beta', 'after'), level)
  assert.deepEqual(h.orderTokensWith(level, 'beta', 'beta', 'before'), level)
  // Defensive inputs: the store can hold a malformed value after a bad write.
  assert.deepEqual(h.orderTokensWith(null, 'x', 'y', 'after'), ['x'])
  assert.deepEqual(h.orderTokensWith(undefined, 'x', 'y', 'before'), ['x'])
  // The source array is never mutated (React state is the caller's).
  assert.deepEqual(level, ['alpha', 'beta', 'gamma'], 'input list untouched')
})

test('v0.44.0: orderTokensWithout drops a name out of a level (pure)', () => {
  const h = loadHelpers()
  assert.deepEqual(h.orderTokensWithout(['a', 'b', 'c'], 'b'), ['a', 'c'])
  assert.deepEqual(h.orderTokensWithout(['a'], 'a'), [])
  // Absent name = the level already forgot it (a group was renamed on disk).
  assert.deepEqual(h.orderTokensWithout(['a', 'b'], 'zzz'), ['a', 'b'])
  assert.deepEqual(h.orderTokensWithout(null, 'a'), [])
})

test('v0.44.0: group path split mirrors the workspace-tree parentKey contract', () => {
  const h = loadHelpers()
  assert.equal(h.sessionGroupParentPath('a/b/c'), 'a/b')
  assert.equal(h.sessionGroupParentPath('a'), '', 'a top-level group has the root parent')
  assert.equal(h.sessionGroupParentPath(''), '')
  assert.equal(h.sessionGroupParentPath(null), '')
  assert.equal(h.sessionGroupLeafName('a/b/c'), 'c')
  assert.equal(h.sessionGroupLeafName('a'), 'a')
  assert.equal(h.sessionGroupLeafName(''), '')
  // Round-trip: parent + leaf rebuilds the path, which is what the drop
  // commit relies on when it computes the new prefix.
  for (const path of ['a', 'a/b', 'a/b/c']) {
    const parent = h.sessionGroupParentPath(path)
    const leaf = h.sessionGroupLeafName(path)
    assert.equal(parent === '' ? leaf : parent + '/' + leaf, path)
  }
})

test('v0.44.0: retitleGroupMember re-prefixes members and refuses foreign rows', () => {
  const h = loadHelpers()
  // Moving a group keeps each member's own leaf.
  assert.equal(h.retitleGroupMember('a/x', 'a', 'b'), 'b/x')
  assert.equal(h.retitleGroupMember('a/b/x', 'a/b', 'a/c'), 'a/c/x')
  // An empty destination lifts the member to the workspace root level.
  assert.equal(h.retitleGroupMember('a/x', 'a', ''), 'x')
  assert.equal(h.retitleGroupMember('a/b/x', 'a/b', ''), 'x')
  // Rows that never lived in the group come back untouched — this is what
  // keeps an auto-titled (opaque, flat) session from being stapled with a
  // prefix it never agreed to.
  assert.equal(h.retitleGroupMember('other/x', 'a', 'b'), 'other/x')
  assert.equal(h.retitleGroupMember('x', 'a', 'b'), 'x')
  assert.equal(h.retitleGroupMember('ab/x', 'a', 'b'), 'ab/x', 'prefix must match a whole segment')
  // An empty source is a no-op: there is no prefix to strip.
  assert.equal(h.retitleGroupMember('a/x', '', 'b'), 'a/x')
  assert.equal(h.retitleGroupMember(null, 'a', 'b'), '')
  assert.equal(h.retitleGroupMember('a/x', 'a', null), 'x')
})

test('v0.44.0: buildSessionTree orders sibling groups by the stored level order', () => {
  const h = loadHelpers()
  const rows = [
    { id: '1', title: 'alpha/one' },
    { id: '2', title: 'beta/two' },
    { id: '3', title: 'gamma/three' },
  ]
  // No stored order (fresh install / pre-0.44 snapshot): name sort, exactly
  // the behaviour every earlier version shipped.
  const plain = h.buildSessionTree(rows, true, {}, 'w1', {})
  assert.deepEqual(groupNames(plain), ['alpha', 'beta', 'gamma'])
  const noArg = h.buildSessionTree(rows, true, {}, 'w1')
  assert.deepEqual(groupNames(noArg), ['alpha', 'beta', 'gamma'], 'the parameter is optional')
  // A stored order wins, and names the caller forgot are appended by name
  // (a group can exist before its first ordered drop).
  const ordered = h.buildSessionTree(rows, true, {}, 'w1', { 'w1|': ['gamma', 'alpha'] })
  assert.deepEqual(groupNames(ordered), ['gamma', 'alpha', 'beta'], 'listed first, unlisted appended by name')
  // Another workspace's bucket is never consulted.
  const foreign = h.buildSessionTree(rows, true, {}, 'w1', { 'w2|': ['gamma', 'alpha'] })
  assert.deepEqual(groupNames(foreign), ['alpha', 'beta', 'gamma'])
  // Stale names in the stored order are ignored, not resurrected.
  const stale = h.buildSessionTree(rows, true, {}, 'w1', { 'w1|': ['gone', 'beta'] })
  assert.deepEqual(groupNames(stale), ['beta', 'alpha', 'gamma'])
  // A malformed value (hand-edited localStorage) degrades to the name sort.
  const malformed = h.buildSessionTree(rows, true, {}, 'w1', { 'w1|': 'not-an-array' })
  assert.deepEqual(groupNames(malformed), ['alpha', 'beta', 'gamma'])
})

test('v0.44.0: the stored order applies PER LEVEL, including nested groups', () => {
  const h = loadHelpers()
  const rows = [
    { id: '1', title: 'outer/inner-b/one' },
    { id: '2', title: 'outer/inner-a/two' },
    { id: '3', title: 'top/three' },
  ]
  const order = {
    'w1|': ['top', 'outer'],
    'w1|outer': ['inner-b', 'inner-a'],
  }
  const tree = h.buildSessionTree(rows, true, {}, 'w1', order)
  assert.deepEqual(groupNames(tree), ['top', 'outer'], 'root level order')
  const outer = tree.groups.find((g) => g.name === 'outer')
  assert.deepEqual(groupNames(outer), ['inner-b', 'inner-a'], 'nested level has its own bucket')
  // The nested bucket is ignored when the parent is not listed at all, but the
  // ROOT bucket still holds: levels are independent.
  const rootOnly = h.buildSessionTree(rows, true, {}, 'w1', { 'w1|': ['top', 'outer'] })
  assert.deepEqual(groupNames(rootOnly.groups.find((g) => g.name === 'outer')), ['inner-a', 'inner-b'])
})

test('v0.44.0: declared empty groups ride the same order as members', () => {
  const h = loadHelpers()
  // An explicitly declared group with no session in it must be reorderable
  // too (the drop writes its NAME; the builder must honour it before any row
  // ever lands inside).
  const declared = { w1: ['zeta'] }
  const tree = h.buildSessionTree([{ id: '1', title: 'alpha/one' }], true, declared, 'w1', { 'w1|': ['zeta', 'alpha'] })
  assert.deepEqual(groupNames(tree), ['zeta', 'alpha'])
  assert.equal(tree.groups[0].sessions.length, 0, 'the declared group starts empty')
})

test('v0.44.0: group-by-names off keeps every row flat (order is irrelevant)', () => {
  const h = loadHelpers()
  const rows = [{ id: '1', title: 'a/x' }, { id: '2', title: 'b/y' }]
  const flat = h.buildSessionTree(rows, false, {}, 'w1', { 'w1|': ['b', 'a'] })
  assert.deepEqual(flat.groups, [], 'no groups when the layer is off')
  assert.deepEqual(flat.sessions.map((s) => s.id), ['1', '2'], 'members stay in host order')
  assert.equal(flat.sessions[0].leaf, 'a/x', 'the whole title is the leaf')
})

test('v0.44.0: reorderIds keeps the insertSessionBefore anchor semantics', () => {
  const h = loadHelpers()
  assert.deepEqual(h.reorderIds(['a', 'b', 'c'], 'c', 'a'), ['c', 'a', 'b'])
  assert.deepEqual(h.reorderIds(['a', 'b', 'c'], 'a', undefined), ['b', 'c', 'a'], 'missing anchor appends')
  assert.deepEqual(h.reorderIds(['a', 'b', 'c'], 'b', 'zzz'), ['a', 'c', 'b'], 'unknown anchor appends')
  assert.deepEqual(h.reorderIds([], 'a', undefined), ['a'])
})

test('v0.44.0: session group drag wiring (three bands, draggable, cycle guard)', () => {
  const text = clientText()
  // The row is draggable now — before this version only sessions were.
  assert.match(text, /const sgroupDropEvents = \(workspaceId, path\) => \(\{\s*\n\s*draggable: !searching,/)
  // The drag arm is delayed one frame, like the workspace rows: Chromium
  // cancels a drag whose source element moves out from under the cursor.
  assert.match(text, /setDrag\(\{ kind: 'sgroup', source: \{ workspaceId, path, name: sessionGroupLeafName\(path\) \}, over: null \}\)/)
  // Three bands: the outer thirds open a sibling insertion slot, the middle
  // third nests. The slot probe must read the CURRENT over, not the stale one.
  assert.match(text, /const holdingSlot = over !== null && over\.kind === 'sgroup' && over\.target === path && \(over\.zone === 'before' \|\| over\.zone === 'after'\)/)
  assert.match(text, /const zone = holdingSlot \? \(pointerInRowBox\(event\) \? rowZone\(event\) : rowHalf\(event\)\) : rowZone\(event\)/)
  // A group can never be dropped inside itself or one of its own children.
  assert.match(text, /if \(parentPath === from \|\| parentPath\.indexOf\(from \+ '\/'\) === 0\) \{\s*\n\s*clearOver\('sgroup', path\)/)
  // Drop commits both shapes: an edge = sibling placement, the middle = nest.
  assert.match(text, /if \(zone === 'into'\) commitSgroupPlace\(drag\.source, path, null, 'into'\)/)
  assert.match(text, /else commitSgroupPlace\(drag\.source, parentPath, sessionGroupLeafName\(path\), zone\)/)
  // The resting-drag fallback exists for groups too (a drop that landed
  // without the drop event being dispatched still commits).
  assert.match(text, /if \(over\.kind !== 'sgroup' \|\| over\.workspaceId !== workspaceId\) return/)
  // A SESSION dropping on a group row keeps the old move-in behaviour.
  assert.match(text, /if \(dragMatches\('session'\)\) \{\s*\n\s*if \(!sessionSlash \|\| drag\.source\.workspaceId !== workspaceId \|\| zone === null\) return/)
})

test('v0.44.0: group rows carry the insertion slot class and its metric', () => {
  const text = clientText()
  // The component takes dropSlot and paints the same slot classes the
  // workspace rows do...
  assert.match(text, /function SessionGroupRow\(\{ name, depth, expanded, count, onToggle, onContextMenu, dropInto, dropSlot, dragEvents, custStyle, pulse, dataRowKey, t \}\)/)
  assert.match(text, /dropSlot === 'before' && 'bw-slot-above', dropSlot === 'after' && 'bw-slot-below'/)
  // ...and the renderer feeds it from the drag state machine.
  assert.match(text, /dropSlot: sgroupSlotOf\(group\.path\),/)
  assert.match(text, /const sgroupSlotOf = \(path\) => \{/)
  // Session-group rows are 32px tall (--bw-session-h), not the workspace
  // row's 34px, so the shared slot rules need their own metric here.
  const css = read('src/client.styles.js')
  assert.match(css, /\.bw-sgroup-row\.bw-slot-above\{padding-top:var\(--bw-session-h,32px\)/)
  assert.match(css, /\.bw-sgroup-row\.bw-slot-below\{padding-bottom:var\(--bw-session-h,32px\)/)
})

test('v0.44.0: committing a group move re-homes members, declarations and order', () => {
  const text = clientText()
  assert.match(text, /const commitSgroupPlace = \(source, parentPath, anchorName, zone\) => \{/)
  // Same level = pure order write (no title touched).
  assert.match(text, /const ordered = orderTokensWith\(sessionGroupNamesAt\(workspace, parent\), leaf, anchorName, zone === 'after' \? 'after' : 'before'\)/)
  // Cross level: re-title every member through the skip-blank batch.
  assert.match(text, /const nextTitle = retitleGroupMember\(row\.title, from, nextPath\)/)
  // Declared-but-empty groups follow their bucket, or the empty group would
  // silently reappear under its old name.
  assert.match(text, /if \(typeof actions\.removeFolder === 'function' && movingDeclared\.length > 0\) \{\s*\n\s*actions\.removeFolder\('session', workspaceId, from\)/)
  assert.match(text, /for \(const path of movingDeclared\) \{\s*\n\s*actions\.addFolder\('session', workspaceId, nextPath \+ path\.slice\(from\.length\)\)/)
  // Both levels are rewritten: the old one loses the name, the new one gains it.
  assert.match(text, /writeSgroupOrder\(workspaceId, oldParent, orderTokensWithout\(oldNames, leaf\)\)/)
  assert.match(text, /writeSgroupOrder\(workspaceId, parent, anchorName\s*\n\s*\? orderTokensWith\(seeded, leaf, anchorName, before \? 'before' : 'after'\)\s*\n\s*: \[\.\.\.seeded, leaf\]\)/)
})

test('v0.44.0: lifting a group out of its parent reaches the root and the workspace row', () => {
  const text = clientText()
  assert.match(text, /const sgroupCouldLeaveGroup = dragMatches\('sgroup'\) && sessionSlash && drag\.source && sessionGroupParentPath\(drag\.source\.path\) !== ''/)
  assert.match(text, /const couldLeaveGroup = sessionCouldLeaveGroup \|\| sgroupCouldLeaveGroup/)
  assert.match(text, /couldLeaveGroup && 'bw-root-drop-out'/)
  assert.match(text, /commitSgroupPlace\(source, '', null, 'after'\)/)
  // The workspace row accepts the lift too, so dropping onto your own
  // workspace row is the same gesture as dropping on the tree background.
  assert.match(text, /if \(!sessionSlash \|\| drag\.source\.workspaceId !== workspace\.workspaceId\) return\s*\n\s*if \(sessionGroupParentPath\(drag\.source\.path\) === ''\) return/)
})

test('v0.44.0: the store persists a second, separate order bag for session groups', () => {
  const text = clientText()
  // init bakes the default so a fresh install never reads undefined...
  assert.match(text, /sessionGroupOrder: \{\}/)
  // ...and the action tolerates a snapshot that predates the key (hydration
  // replaces the whole state object — see the store's own comment).
  assert.match(text, /setSessionGroupOrder: \(d, parentKey, names\) => \{\s*\n\s*if \(!d\.sessionGroupOrder \|\| typeof d\.sessionGroupOrder !== 'object'\) d\.sessionGroupOrder = \{\}/)
  // The bag is separate from folderOrder on purpose: same shape, different
  // key namespace, so a workspace level can never overwrite a session level.
  assert.match(text, /folderOrder: \{\}, sessionGroupOrder: \{\}/)
  // Selector read falls back to the frozen empty bag when the key is absent.
  assert.match(text, /useStore\(s => s\.sessionGroupOrder\) \|\| EMPTY_FOLDERS/)
})

test('v0.44.0: multi-select files several sessions into one group', () => {
  const text = clientText()
  // Selection is a gesture, not a preference: component state, never the store.
  assert.match(text, /const \[selection, setSelection\] = React\.useState\(null\)/)
  assert.match(text, /const toggleSelected = \(workspaceId, sessionId\) => setSelection\(/)
  // The batch branch resolves every member's own leaf before prefixing, so a
  // batch of already-grouped rows lands in the target group one level deeper.
  assert.match(text, /if \(target\.kind === 'batch'\) \{/)
  // It must be answered BEFORE the single-target prelude: a batch has no
  // `target.title`, so the "unchanged title" shortcut would read undefined and
  // reject the move, and an empty group ('') — a real verb here, unstacking the
  // selection to the root — would be swallowed as well.
  const batchAt = text.indexOf("if (target.kind === 'batch') {")
  const singleNextAt = text.indexOf("const next = group ? group + '/' + safe : safe")
  assert.ok(batchAt !== -1 && singleNextAt !== -1 && batchAt < singleNextAt, 'the batch branch precedes the single-target prelude')
  assert.match(text, /const label = row\.allowGroups === false \? String\(row\.title \|\| ''\) : leafOf\(row\.title\)/)
  assert.match(text, /const safeLeaf = leafForGroup\(label, row\.allowGroups === false\)/)
  assert.match(text, /const moved = group \? group \+ '\/' \+ safeLeaf : safeLeaf/)
  // The row asks for selection instead of navigating while a pick is open.
  assert.match(text, /if \(selecting && typeof onSelectToggle === 'function'\) \{ onSelectToggle\(node\.id\); return \}/)
  // Dragging one selected row carries the whole bag.
  assert.match(text, /const batchIds = isSelected\(workspaceId, session\.id\) \? liveSelectionIdsOf\(\) : \[\]/)
  assert.match(text, /const batchIds = Array\.isArray\(source\.batchIds\) && source\.batchIds\.length > 1 \? source\.batchIds : null/)
  // The batch bar only exists while something is picked, and clears after.
  assert.match(text, /className: 'bw-batch-bar', role: 'region', 'aria-label': t\('batch\.title'\)/)
  assert.match(text, /setSelection\(null\)/)
  // The DOM contract of the provider-icon plugin survives selection: the row
  // token and the title classes are untouched by the new props.
  assert.match(text, /cls\('bw-row', 'bw-session-row', 'bw-sessionRow'/)
  assert.match(text, /'bw-row-label bw-title'/)
})

test('v0.44.0: the five batch strings exist in all 21 dictionaries', () => {
  const text = clientText()
  const KEYS = ['batch.select', 'batch.deselect', 'batch.title', 'batch.count', 'batch.clear']
  const keyLines = (segment) => [...segment.matchAll(/^ +'([^']+)': (?!\{)/gm)].map((m) => m[1]).sort()
  const zh = text.slice(text.indexOf('const zh = {'), text.indexOf('const en = {'))
  const en = text.slice(text.indexOf('const en = {'), text.indexOf('const LOCALES = {'))
  const zhKeys = keyLines(zh)
  for (const key of KEYS) {
    assert.ok(zhKeys.includes(key), 'zh has ' + key)
    assert.ok(keyLines(en).includes(key), 'en has ' + key)
  }
  // Every shipped locale mirrors the zh key set exactly (a missing key falls
  // back to English silently, which is the half-translated panel we refuse).
  const localesSegment = text.slice(text.indexOf('const LOCALES = {'), text.indexOf('/* ============================= helpers'))
  const blocks = localesSegment.split(/\/\* locale: /).slice(1)
  assert.equal(blocks.length, 19, '19 shipped locales beyond zh/en')
  for (const block of blocks) {
    const tag = block.slice(0, block.indexOf(' ')).trim()
    const body = block.slice(block.indexOf('{'))
    assert.deepEqual(keyLines(body), zhKeys, 'dictionary ' + tag + ' matches zh')
  }
  // The batch count uses the same {n} placeholder convention as the rest.
  assert.match(zh, /'batch\.count': '已选 \{n\} 个会话'/)
  assert.match(en, /'batch\.count': '\{n\} selected'/)
})

test('v0.44.0: menu + shared context menu can enter and leave a selection', () => {
  const text = clientText()
  assert.match(text, /const selectItem = \{\s*\n\s*id: sessionSelected \? 'deselect' : 'select',/)
  assert.match(text, /const sessionSelected = !!payload && selection !== null && selection\.ids\.indexOf\(payload\.id\) !== -1/)
  assert.match(text, /if \(id === 'select' \|\| id === 'deselect'\) \{/)
  // The official shared context menu (host-provided) gets the same entry
  // through the menu bridge.
  assert.match(text, /selectedIn: \(sessionId\) => selection !== null && selection\.ids\.indexOf\(sessionId\) !== -1/)
  assert.match(text, /toggleSelect: \(sessionId\) => \{/)
  assert.match(text, /id: 'bw-select'/)
})

test('v0.44.0: a batch pick answers in the flat view too (selection scope is not the drag scope)', () => {
  const text = clientText()
  // The drag scope and the selection scope are two different questions: the
  // flat list renders rows with NO workspaceId (they are not reorder sources),
  // yet a pick there must still show its checkbox and answer the click.
  assert.match(text, /const renderSessionRow = \(session, depth, workspaceId, selectScopeId\) => \{/)
  assert.match(text, /const scope = selectScopeId === undefined \? workspaceId : selectScopeId/)
  assert.match(text, /selecting: scope != null && selection !== null && selection\.workspaceId === scope,/)
  assert.match(text, /selected: scope != null && isSelected\(scope, session\.id\),/)
  assert.match(text, /onSelectToggle: scope == null \? undefined : \(id\) => toggleSelected\(scope, id\),/)
  // The flat view resolves the owning workspace once and hands it over; the
  // drag scope stays undefined so those rows never become reorder sources.
  assert.match(text, /const ownerIndex = new Map\(\)/)
  assert.match(text, /if \(!ownerIndex\.has\(id\)\) ownerIndex\.set\(id, workspace\.workspaceId\)/)
  assert.match(text, /renderSessionRow\(\{ \.\.\.s, leaf: s\.title \}, 0, undefined, ownerIndex\.get\(s\.id\)\)/)
  // Ungrouped rows have no workspace at all — a session group is a title prefix
  // INSIDE a workspace tree, so there is nothing there to file them into.
  assert.match(text, /for \(const s of visible\) rows\.push\(renderSessionRow\(s, 0\)\)/)
})
