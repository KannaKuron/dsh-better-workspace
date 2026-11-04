/**
 * dsh-better-workspace — client half (plain JavaScript, no build step).
 *
 * Registrations:
 *  1. sidebar.workspaces (priority -1): replaces the shipped workspace
 *     browser with a two-layer hierarchy — disk nesting (a workspace row
 *     nests under its nearest registered ancestor directory, the official
 *     0.1.6-alpha.2 workspace-tree semantics) plus "/"-segment name groups
 *     inside each level (this plugin's founding feature). The registration
 *     declares the sidebar.workspaces.directoryFlow child hole without
 *     occupying it, so the official composed picker (OS chooser or in-app
 *     browser, whichever the Host serves) drives the add-workspace flow.
 *  2. plugins.bundle.config (the Plugins panel's bundle page, dsh
 *     0.1.6-alpha.2+; keyed by package name): the settings card — the single
 *     settings seat since the host floor was raised past the old list seat.
 *
 * Every require below is a dsh client baseline module (see
 * @deepseek-ai/dsh-client-web seed.ts): react, @deepseek-ai/dsh-client-store,
 * @deepseek-ai/dsh-client-ui-primitives.
 */
window.__ModuleLoader__.load({
  id: 'dsh-better-workspace',
  factory: (require) => {
    const React = require('react')
    const storeKit = require('@deepseek-ai/dsh-client-store')
    const ui = require('@deepseek-ai/dsh-client-ui-primitives')

    const E = React.createElement
    const NS = 'betterWorkspace'
    // Official transient banner (dsh 0.2.1-alpha.5 primitives Toast; body
    // portal, self-fading). Absent on older hosts — the copy-session-id
    // notice then falls back to this plugin's own chip.
    const officialToast = typeof ui.Toast === 'function' ? ui.Toast : null

    /* ============================== i18n ============================== */
    // All dictionaries ship in the package-local chunk client.locales.js.
    // apply() awaits it once (require.async) before registering NS.
    let localeTables = null

    /* ============================= helpers ============================ */

    const cls = (...xs) => xs.filter(Boolean).join(' ')
    const messageOf = (reason) => (reason instanceof Error ? reason.message : String(reason))

    const basename = (p) => {
      if (!p) return ''
      const s = String(p).replace(/[\\/]+$/, '')
      const i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'))
      return i === -1 ? s : s.slice(i + 1)
    }
    /**
     * Plain-text splitting with the URL tail kept opaque: a bare "/" split
     * shreds URLs ("https:" → empty → host → path...), so from the first
     * "://" onward the tail is ONE leaf; text before the marker splits
     * normally at the last "/" before it. This is the FALLBACK guard —
     * freshly generated titles get their whole "/"-bearing title wrapped in
     * quotes by the quote-on-land effect (see BetterBrowser), which is the
     * primary mechanism.
     */
    const splitPlainSegs = (text) => {
      const s = String(text || '')
      const schemeAt = s.indexOf('://')
      if (schemeAt === -1) return s.split('/').map(x => x.trim()).filter(Boolean)
      const cut = s.lastIndexOf('/', schemeAt)
      const segs = (cut === -1 ? '' : s.slice(0, cut)).split('/').map(x => x.trim()).filter(Boolean)
      const tail = s.slice(cut + 1).trim()
      if (tail !== '') segs.push(tail)
      return segs
    }

    /**
     * A title that QUOTES an absolute path is a sentence, not a name
     * hierarchy (v0.37.2, issue #17): the host auto-titles a new session by
     * echoing its first message verbatim, so "/Users/x/repo/file.md" used to
     * shred into one fake folder per segment. Detection stays narrow on
     * purpose — a token starts at line start / whitespace with "/" (or a
     * "C:/" drive form) and carries at least one more "/" — so plain name
     * groups ("web/前端") and relative pairs ("a/b") keep splitting.
     */
    const titleQuotesPath = (text) => {
      // A path inside a PAIRED quote span is already an opaque leaf (the
      // quote parser below keeps it verbatim), so only the unquoted remainder
      // can be mistaken for a name hierarchy.
      const s = String(text || '').replace(/"[^"]*"|“[^”]*”/g, ' ')
      const re = /(?:^|\s)(?:[A-Za-z]:)?\/\S+/g
      let m
      while ((m = re.exec(s)) !== null) {
        if ((m[0].match(/\//g) || []).length >= 2) return true
      }
      return false
    }

    /**
     * Title → hierarchy segments, QUOTE-AWARE: a PAIRED “…” (or "…") span is
     * verbatim — slashes inside quotes never split, the quotes stay part of
     * the leaf. Text outside paired spans splits through splitPlainSegs
     * (URL-tail opaque). A LONE quote character — an opener with no matching
     * closer, or a closer without an opener — is an ORDINARY character and
     * splits normally around it (0.9.1 swallowed the tail after an
     * unterminated opener; the user wants lone quotes as plain text).
     * Grouping is a pure projection, so previously shredded titles re-flow
     * on reload.
     */
    const splitTitleSegs = (title) => {
      const s = String(title || '')
      if (titleQuotesPath(s)) return [s.trim()]
      if (!/["“]/.test(s)) return splitPlainSegs(s)
      const out = []
      let plain = ''
      let i = 0
      while (i < s.length) {
        const ch = s[i]
        if (ch === '"' || ch === '“') {
          const close = ch === '“' ? '”' : '"'
          const j = s.indexOf(close, i + 1)
          if (j === -1) { // lone opener: ordinary character, keep scanning
            plain += ch
            i += 1
            continue
          }
          for (const seg of splitPlainSegs(plain)) out.push(seg)
          plain = ''
          const end = j + 1
          const quoted = s.slice(i, end).trim()
          if (quoted !== '') out.push(quoted)
          i = end
          continue
        }
        plain += ch
        i += 1
      }
      for (const seg of splitPlainSegs(plain)) out.push(seg)
      return out
    }
    const normPath = (p) => splitTitleSegs(p).join('/')

    /**
     * Glyphs a host may have RETIRED, mapped to the surviving equivalents in
     * preference order. dsh 0.1.6-alpha.1 replaced IconSendOutline16 with
     * IconPaperPlaneOutline14 and deleted the old export, so a saved custom
     * icon naming it must land on something real rather than an empty cell.
     */
    const ICON_ALIASES = { IconSendOutline16: ['IconSendOutline14'] }

    /**
     * Resolve one configured icon value to a glyph the LOADED primitives
     * actually export (pure). Retired names follow their alias chain, unknown
     * names degrade to '' — so both the picker grid and a choice persisted
     * before an upgrade survive a host that renamed its icon set.
     */
    const resolveIconName = (name) => {
      if (typeof name !== 'string' || name === '') return ''
      if (ui[name]) return name
      const aliases = ICON_ALIASES[name]
      if (aliases) for (const alias of aliases) if (ui[alias]) return alias
      // Icon-set generation fallback (dsh 0.1.7): the primitives renamed the
      // whole product set from pixel-size suffixes (…16/…14/…20) to stroke
      // weights (…Regular/…Medium). Strip the trailing size and try the new
      // spellings so pre-0.1.7 names keep rendering on current hosts — the
      // header/menus call icon() with historical names directly.
      const base = typeof name === 'string' ? name.replace(/\d+$/, '') : ''
      if (base !== '' && base !== name) {
        if (ui[base + 'Regular']) return base + 'Regular'
        if (ui[base + 'Medium']) return base + 'Medium'
      }
      return ''
    }

    /** Render a primitives icon by name; unknown names degrade to null, never crash. */
    const icon = (name, size) => {
      const C = ui[resolveIconName(name)]
      return C ? E(C, { size: size || 16 }) : null
    }

    const FALLBACK_UNITS = { minutes: 'm', hours: 'h', days: 'd', months: 'mo', years: 'y' }
    const timeLabel = (updatedAt, now, t) => {
      if (typeof ui.relativeTime !== 'function') return ''
      const r = ui.relativeTime(updatedAt, now)
      if (!r) return ''
      if (r.unit === 'now') return t('time.now')
      const key = 'time.' + r.unit
      const out = t(key, { n: r.n })
      if (typeof out === 'string' && out !== '' && out !== key) return out
      return String(r.n) + (FALLBACK_UNITS[r.unit] || '')
    }

    // Port of ui-workspace rows/AnimatedRows.tsx — the package entry exports
    // only apply/inject, so the component cannot be required (same discipline
    // as the row-style port). FLIP glide + entry/exit fades for keyed rows:
    // armed by the first pointer/key input, skipped when membership, order,
    // readiness or the reset key did not change. Deltas from upstream: the
    // plugin tree rolls its own indent var (--bw-indent, not
    // --dsh-workspace-indent), the exit overlay is viewport-FIXED because no
    // positioned ancestor is guaranteed here (clone math subtracts the
    // overlay rect either way), and the list div takes an attrs passthrough
    // (data-bw-density / data-bw-count) plus innerRef (autoStyle samples it).
    const ROW_FADE_MS = 100
    const ROW_GLIDE_MS = 200
    const sameRowKeys = (previous, next) => previous.length === next.length
      && previous.every((key, index) => key === next[index])
    const intersectsViewport = (rect, viewport) => rect.bottom > viewport.top && rect.top < viewport.bottom
      && rect.right > viewport.left && rect.left < viewport.right
    class AnimatedRows extends React.Component {
      constructor(props) {
        super(props)
        this.armed = false
        this.list = { current: null }
        this.overlay = React.createRef()
        this.movements = new Map()
        this.exits = new Map()
      }
      getSnapshotBeforeUpdate(previous) {
        const list = this.list.current
        if (!this.armed || sameRowKeys(previous.rowKeys, this.props.rowKeys) || previous.resetKey !== this.props.resetKey
          || !previous.ready || !this.props.ready || list === null
          || typeof list.animate !== 'function'
          || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null
        const viewport = list.getBoundingClientRect()
        const positions = this.readPositions()
        const nextKeys = new Set(this.props.rowKeys)
        const removed = new Map()
        for (const [key, row] of positions) {
          if (nextKeys.has(key) || !intersectsViewport(row.rect, viewport)) continue
          const clone = row.element.cloneNode(true)
          clone.removeAttribute('data-row-key')
          clone.inert = true
          clone.style.setProperty('--bw-indent', getComputedStyle(row.element).getPropertyValue('--bw-indent'))
          removed.set(key, Object.assign({}, row, { element: clone }))
        }
        return { positions, removed }
      }
      componentDidUpdate(previous, _state, snapshot) {
        if (snapshot === null) {
          if (!sameRowKeys(previous.rowKeys, this.props.rowKeys) || previous.resetKey !== this.props.resetKey
            || previous.ready !== this.props.ready) this.clear()
          return
        }
        this.cancelMovements()
        const list = this.list.current
        const overlay = this.overlay.current
        const viewport = list.getBoundingClientRect()
        const origin = overlay.getBoundingClientRect()
        const positions = this.readPositions()
        for (const [key, row] of positions) {
          this.removeExit(key)
          const previousRow = snapshot.positions.get(key)
          if (!intersectsViewport(row.rect, viewport)
            && (previousRow === undefined || !intersectsViewport(previousRow.rect, viewport))) continue
          if (previousRow === undefined) {
            this.move(row.element, [{ opacity: 0 }, { opacity: 1 }], ROW_FADE_MS)
            continue
          }
          const dx = previousRow.rect.left - row.rect.left
          const dy = previousRow.rect.top - row.rect.top
          if (dx === 0 && dy === 0 && previousRow.opacity === 1) continue
          this.move(row.element, [
            { transform: 'translate(' + String(dx) + 'px, ' + String(dy) + 'px)', opacity: previousRow.opacity },
            { transform: 'translate(0, 0)', opacity: 1 },
          ], ROW_GLIDE_MS)
        }
        for (const [key, row] of snapshot.removed) {
          const { element } = row
          this.removeExit(key)
          Object.assign(element.style, {
            position: 'absolute', margin: '0', transform: 'none', boxSizing: 'border-box',
            left: String(row.rect.left - origin.left) + 'px',
            top: String(row.rect.top - origin.top) + 'px',
            width: String(row.rect.width) + 'px', height: String(row.rect.height) + 'px',
          })
          overlay.append(element)
          const animation = element.animate([{ opacity: row.opacity }, { opacity: 0 }], {
            duration: ROW_FADE_MS, easing: 'ease-out', fill: 'forwards',
          })
          this.exits.set(key, { element, animation })
          animation.onfinish = () => { this.removeExit(key) }
        }
      }
      componentWillUnmount() { this.clear() }
      readPositions() {
        const list = this.list.current
        const rows = list.querySelectorAll('[data-row-key]')
        return new Map(Array.from(rows, (element) => [element.dataset.rowKey, {
          element,
          rect: element.getBoundingClientRect(),
          opacity: this.movements.has(element) ? Number(getComputedStyle(element).opacity) : 1,
        }]))
      }
      move(element, keyframes, duration) {
        const animation = element.animate(keyframes, { duration, easing: 'ease-out' })
        this.movements.set(element, animation)
        animation.onfinish = () => { this.movements.delete(element); animation.cancel() }
      }
      cancelMovements() {
        for (const animation of this.movements.values()) {
          animation.onfinish = null
          animation.cancel()
        }
        this.movements.clear()
      }
      removeExit(key) {
        const exit = this.exits.get(key)
        if (exit === undefined) return
        exit.animation.onfinish = null
        exit.animation.cancel()
        exit.element.remove()
        this.exits.delete(key)
      }
      clear() {
        this.cancelMovements()
        for (const key of Array.from(this.exits.keys())) this.removeExit(key)
      }
      render() {
        const attrs = this.props.attrs || {}
        return [
          E('div', Object.assign({
            key: 'list',
            ref: (el) => { this.list.current = el; if (this.props.innerRef) this.props.innerRef.current = el },
            className: this.props.className,
            role: 'tree',
            'aria-label': this.props.label,
            onPointerDownCapture: () => { this.armed = true },
            onKeyDownCapture: () => { this.armed = true },
          }, attrs), this.props.children),
          E('div', { key: 'exits', ref: this.overlay, className: 'bw-rows-exits', 'aria-hidden': 'true' }),
        ]
      }
    }

    const pendingKindOf = (pending, id) => {
      if (!pending) return undefined
      const p = typeof pending.get === 'function' ? pending.get(id) : pending[id]
      if (!p) return undefined
      return p.kind || p.status || p.type || 'pending'
    }

    // Official visiblePendingKind (dsh 0.1.7 tree.ts): only the three
    // navigation kinds light the warning lamp; anything else a domain
    // publishes stays off the sidebar.
    const visiblePendingKind = (kind) => (kind === 'approval' || kind === 'plan-review' || kind === 'question' ? kind : undefined)

    // In-place flavor for arrays built by the caller (same bucket order).
    const pinnedPartitionInPlace = (rows) => {
      const arranged = pinnedPartition(rows)
      if (arranged !== rows) rows.splice(0, rows.length, ...arranged)
      return rows
    }

    // Official pinned-block partition (sectionMembers): placeholders first,
    // then the non-archived pinned rows, then everything else — preserving
    // each caller-side order inside every bucket.
    const pinnedPartition = (rows) => {
      if (!rows || rows.length === 0) return rows
      const blanks = []
      const pins = []
      const rest = []
      for (const row of rows) {
        if (row.pinned) pins.push(row)
        else if (row.blank) blanks.push(row)
        else rest.push(row)
      }
      if (pins.length === 0) return rows
      return [...blanks, ...pins, ...rest]
    }

    // Global and per-workspace recency share the same ordering contract:
    // current blank first, then pinned Sessions, then ordinary Sessions.
    // In flat mode this must run AFTER collecting every workspace and Ungrouped.
    const orderSessionsByRecency = (rows, currentId) => {
      const sorted = rows.slice().sort((a, b) => (b.updatedAt - a.updatedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      const blank = currentId !== undefined && sorted.find((row) => row.id === currentId && row.blank)
      if (blank) {
        const at = sorted.indexOf(blank)
        if (at > 0) { sorted.splice(at, 1); sorted.unshift(blank) }
      }
      return pinnedPartition(sorted)
    }

    const sessionTitleOf = (summary, t, rememberedTitle) => {
      if (!summary) return ''
      if (summary.blank) return t('session.new')
      if (summary.title) return String(summary.title)
      // Cold-restart window: the wire serves only the projection cache, so a
      // title that was never checkpointed (fork-born, never-checkpointed) is
      // missing for the list row even though the durable title sits in the
      // session log. A title remembered from an earlier snapshot restores the
      // "/" grouping until the session opens and the wire catches up.
      if (typeof rememberedTitle === 'string' && rememberedTitle !== '') return rememberedTitle
      // Nothing remembered: stay official. Rows.tsx displayTitle() renders
      // t('session.untitled') for an unnamed row — NEVER the host's
      // displayTitle, which falls back to the project basename and turned
      // every title-less row into a duplicate workspace name (issue #16).
      return t('session.untitled')
    }

    /**
     * Official visibility rule (dsh 0.1.7 tree.ts sessionVisible): subagent
     * children live in their parent's catalog, a blank row is the provisional
     * New Session of the current selection, and archived rows follow the
     * archived filter — 'default' hides them, 'show' mixes them into their
     * kept slots, 'only' restricts the view to them. Pre-filter hosts only
     * ever pass 'default' (the historical hide-archived behavior).
     */
    const sessionVisible = (summary, current, archivedSet, archivedFilter) => {
      if (!summary || summary.origin === 'subagent') return false
      if (summary.blank && summary.id !== current) return false
      const archived = archivedSet && archivedSet.has(summary.id)
      if (archivedFilter === 'show') return true
      if (archivedFilter === 'only') return !!archived
      return !archived
    }

    /**
     * The "open" session, across BOTH host generations.
     *
     * dsh 0.1.6-alpha.2 dropped SessionListState.current: the open session is
     * now the one retained under the mainView source — navigation belongs to
     * the view owner (official ui-workspace tree.ts mainSessionId).
     *
     * dsh 0.1.5-rc.x never carried `retainedBy` at all (it was introduced by
     * the same 2026-09-17 generation refactor that added it), so the retention
     * loop matches nothing there and reading retention alone yields a permanent
     * undefined: no current highlight, and every blank row (a brand-new session
     * before its first message) filtered out by sessionVisible. Both contracts
     * must stay wired — same shape as the renameSession probe below.
     */
    const mainSessionIdOf = (list) => {
      if (!list || !list.byId) return undefined
      for (const session of Object.values(list.byId)) {
        if (session && session.retainedBy && (session.retainedBy.mainView || 0) > 0) return session.id
      }
      return typeof list.current === 'string' && list.current !== '' ? list.current : undefined
    }

    /**
     * Active-schedule marker, mirroring the official tree's
     * hasActiveSchedule(): the list projection carries one entry per active
     * Schedule record, and a non-empty projection is the badge's only gate.
     * Defensive shapes (missing/mis-typed projection) degrade to false.
     */
    const hasActiveScheduleOf = (summary) => !!(summary
      && summary.projectionValues
      && Array.isArray(summary.projectionValues.schedule)
      && summary.projectionValues.schedule.length > 0)

    /**
     * First-use Workspace naming, official semantics (dsh 0.1.7-rc.2:
     * api workspace-controller default-workspace.ts). The registry derives the
     * automatic first-use title from the on-disk directory name
     * ('default-workspace', language-neutral so one installation keeps one path
     * across language switches), and every shipped browser surface labels
     * exactly that title with the LOCALIZED default name — the stored title
     * itself never changes. rc.2 dropped the old `defaultWorkspace.title`
     * dictionary path and resolves the label at the display site instead;
     * mirrored here so the tree, the hero picker and the rename prefill agree
     * with the shipped browser. The copy comes from this plugin's dictionaries,
     * which cover the 19 languages the official common dictionary leaves on its
     * English fallback. A host without the key (pre-rc.2) simply keeps the
     * stored title — the substitution is a display layer, never a write.
     */
    const DEFAULT_WORKSPACE_TITLE = 'default-workspace'
    const withDisplayTitles = (items, localizedDefault) => {
      const list = items || []
      if (!localizedDefault) return list
      let replaced = false
      const out = list.map((workspace) => {
        if (!workspace || workspace.title !== DEFAULT_WORKSPACE_TITLE) return workspace
        replaced = true
        return Object.assign({}, workspace, { title: String(localizedDefault) })
      })
      return replaced ? out : list
    }

    /**
     * The SHIPPED sidebar's own business face, read off the slot ledger (dsh
     * 0.1.7-rc.2). The shipped shortcut layer routes session search and
     * add-workspace into a private request store whose ONLY consumer is the
     * shipped browser's own effect; a seat shadowed at priority -1 never mounts
     * that consumer, so this plugin consumes the same channel instead of
     * leaving Cmd/Ctrl+K and Cmd/Ctrl+O consumed-but-dead. Same ledger-read
     * technique as the hero picker's directory-flow occupant. Every read is
     * best-effort and version-gated by the face's own shape: an older host has
     * no requestSearch at all (no channel, no consumption), and a host that
     * hides the ledger costs the channel only.
     */
    const shippedBrowserFaceOf = (slots, ownComponent) => {
      try {
        const entries = slots.entries('sidebar.workspaces')
        for (const entry of entries || []) {
          if (!entry || entry.component === ownComponent) continue
          if (typeof entry.inject !== 'function') continue
          const face = entry.inject()
          if (face && typeof face === 'object' && typeof face.requestSearch === 'function') return face
        }
      } catch (error) {
        return null
      }
      return null
    }

    /**
     * The shipped schedule mark's seat occupant (dsh 0.1.7-rc.2:
     * `sidebar.session.row.leading`, registered by
     * @deepseek-ai/dsh-client-ui-schedule). rc.2 removed the list projection
     * this plugin used to mirror the mark from and moved the mark into a seat
     * DECLARED BY THE SHIPPED BROWSER — a shadowing entry cannot render another
     * entry's child seat, so the occupant is read off the ledger and rendered
     * inside our own row, exactly like the hero picker's directory-flow
     * occupant. No occupant (the Schedule overlay is off, or an older host has
     * no such seat) means no mark, which is the shipped default anyway.
     */
    const scheduleSeatOf = (slots) => {
      try {
        const entries = slots.entries('sidebar.session.row.leading')
        const entry = entries && entries.length > 0 ? entries[0] : null
        if (!entry || !entry.component || typeof entry.inject !== 'function') return null
        return {
          component: entry.component,
          face: entry.inject(),
          locale: typeof entry.locale === 'string' ? entry.locale : null,
        }
      } catch (error) {
        return null
      }
    }

    /**
     * Bind one ledger occupant's `hooks` compartment into the `use<Name>`
     * selector-hook props the slot renderer would synthesize (ui-slots
     * PropsHooks): the occupant was written against that contract, so it is
     * reproduced here — subscribe/getSnapshot captured once per source, the
     * selected value cached across renders with the optional equality — the
     * semantics of the shipped bindSnapshotSelector, whose
     * use-sync-external-store shim is not on the client baseline whitelist.
     */
    const EMPTY_SELECTION = { empty: true }
    const NOOP_SUBSCRIBE = () => () => {}
    const NOOP_SNAPSHOT = () => null
    /**
     * Subscribe one bare observable source (HostObservable: getSnapshot +
     * subscribe) without a selector. The capture is memoized so a component
     * never resubscribes across renders, and a missing source degrades to a
     * constant null instead of a conditional hook.
     */
    const useObservableSnapshot = (observable) => {
      const subscribe = React.useMemo(
        () => (observable && typeof observable.subscribe === 'function' ? (notify) => observable.subscribe(notify) : NOOP_SUBSCRIBE),
        [observable],
      )
      const getSnapshot = React.useMemo(
        () => (observable && typeof observable.getSnapshot === 'function' ? () => observable.getSnapshot() : NOOP_SNAPSHOT),
        [observable],
      )
      return React.useSyncExternalStore(subscribe, getSnapshot)
    }

    const bindSelectorHook = (observable) => {
      const subscribe = (notify) => observable.subscribe(notify)
      const getSnapshot = () => observable.getSnapshot()
      return function useSelector(selector, isEqual) {
        const selectorRef = React.useRef(selector)
        selectorRef.current = selector
        const isEqualRef = React.useRef(isEqual)
        isEqualRef.current = isEqual
        const cached = React.useRef(EMPTY_SELECTION)
        const getSelection = React.useCallback(() => {
          const next = selectorRef.current(getSnapshot())
          const previous = cached.current
          if (previous !== EMPTY_SELECTION && typeof isEqualRef.current === 'function' && isEqualRef.current(previous, next)) {
            return previous
          }
          cached.current = next
          return next
        }, [])
        return React.useSyncExternalStore(subscribe, getSelection)
      }
    }

    /** Split an inject face into plain props + `use<Name>` selector hooks. */
    const bindOccupantFace = (face) => {
      const props = {}
      if (!face || typeof face !== 'object') return props
      for (const key of Object.keys(face)) {
        if (key === 'hooks' || key === 'keyedHooks') continue
        props[key] = face[key]
      }
      const hooks = face.hooks
      if (hooks && typeof hooks === 'object') {
        for (const key of Object.keys(hooks)) {
          const observable = hooks[key]
          if (!observable || typeof observable.subscribe !== 'function' || typeof observable.getSnapshot !== 'function') continue
          props['use' + key.charAt(0).toUpperCase() + key.slice(1)] = bindSelectorHook(observable)
        }
      }
      return props
    }

    /**
     * Render one occupant the SHIPPED browser seats (module level on purpose:
     * React discipline — the occupant mounts once per row and keeps its own
     * state across our re-renders).
     */
    function ShippedSeatOccupant({ seat, ownerProps, standardProps, t, useMenuOpenState }) {
      const bound = React.useMemo(() => bindOccupantFace(seat.face), [seat])
      return E(seat.component, Object.assign({}, standardProps || null, ownerProps, bound, t ? { t } : null,
        // The menu.item slot's hookContext factory (ui-slots) hands its
        // occupants the menu open-state pair through a useMenuOpenState
        // hook; the slot renderer would inject it, our in-row menu
        // reproduces the same shape here.
        typeof useMenuOpenState === 'function' ? { useMenuOpenState } : null))
    }

    /**
     * Running subagent descendants per session (light lineage walk over
     * parent links) — a parent row keeps its "ongoing" ring while a spawned
     * subagent is still working. The client SessionSummary exposes the
     * parent as parentId (the session controller maps parentSessionId to
     * parentId on the wire); the old parentSessionId spelling is kept as a
     * fallback for profiles serving the pre-rename shape.
     */
    const subagentRunningCounts = (byId) => {
      const children = new Map()
      for (const id of Object.keys(byId || {})) {
        const summary = byId[id]
        const parentId = summary && (summary.parentId || summary.parentSessionId)
        if (!summary || !parentId) continue
        let list = children.get(parentId)
        if (!list) { list = []; children.set(parentId, list) }
        list.push(summary)
      }
      const countFor = (rootId) => {
        let count = 0
        const queue = (children.get(rootId) || []).slice()
        const seen = new Set([rootId])
        while (queue.length > 0) {
          const summary = queue.shift()
          if (!summary || seen.has(summary.id)) continue
          seen.add(summary.id)
          if (summary.running) count += 1
          const kids = children.get(summary.id)
          if (kids) for (const kid of kids) queue.push(kid)
        }
        return count
      }
      const counts = new Map()
      for (const id of Object.keys(byId || {})) counts.set(id, countFor(id))
      return counts
    }

    /**
     * Session nesting inside one workspace: same "/" convention as workspace
     * titles. Groups are virtual (projection of names). Rows keep the Host
     * workspace.sessionIds (manual) order — drag-to-reorder must be visible.
     */
    function buildSessionTree(rows, groupBySlash, explicitSess, groupScope) {
      const root = { path: '', name: '', groups: [], sessions: [] }
      const byPath = new Map([['', root]])
      // Slash grouping OFF (v0.13 view option): every row lands at the
      // root level and keeps its FULL title as the leaf — no levels.
      if (groupBySlash === false) {
        for (const row of rows || []) root.sessions.push({ ...row, leaf: row.title })
        return root
      }
      // SEGMENT-driven: paths arrive as already-split segment arrays (URL-aware
      // splitTitleSegs can yield segments containing "//", e.g. the
      // "scheme://host" authority segment) and are joined into the path KEY
      // verbatim — never re-split on "/", which would shred an authority
      // segment into "https:" + "" + host.
      const ensure = (segs) => {
        let node = root
        let key = ''
        for (const seg of segs) {
          key = key === '' ? seg : key + '/' + seg
          let next = byPath.get(key)
          if (!next) {
            next = { path: key, name: seg, groups: [], sessions: [] }
            byPath.set(key, next)
            node.groups.push(next)
          }
          node = next
        }
        return node
      }
      for (const segs of explicitSegsOf(explicitSess, groupScope)) ensure(segs)
      for (const row of rows || []) {
        const segs = splitTitleSegs(row.title)
        const folderPath = segs.slice(0, -1).join('/')
        const leaf = segs.length > 0 ? segs[segs.length - 1] : row.title
        ensure(segs.slice(0, -1)).sessions.push({ ...row, leaf })
      }
      const sortRec = (node) => {
        node.groups.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
        for (const group of node.groups) sortRec(group)
      }
      sortRec(root)
      return root
    }

    /**
     * Move one id inside a flat list: before `anchor`, or to the end when the
     * anchor is missing (pure). Mirrors the host action's insertSessionBefore
     * semantics, so the browser-local fallback orders rows exactly the way the
     * host would have.
     */
    function reorderIds(ids, id, anchor) {
      const next = (ids || []).filter((x) => x !== id)
      const at = anchor === undefined ? -1 : next.indexOf(anchor)
      if (at === -1) next.push(id)
      else next.splice(at, 0, id)
      return next
    }

    const countSessionTree = (node) => node.sessions.length + node.groups.reduce((sum, group) => sum + countSessionTree(group), 0)

    const collectSessionRows = (node) => {
      const out = node.sessions.slice()
      for (const group of node.groups) out.push(...collectSessionRows(group))
      return out
    }

    const findSessionGroup = (node, path) => {
      if (node.path === path) return node
      for (const group of node.groups) {
        const hit = findSessionGroup(group, path)
        if (hit) return hit
      }
      return null
    }

    /**
     * Build the hierarchy tree. Two orthogonal layers, the way the official
     * 0.1.6-alpha.2 browser composes them:
     * - the DISK layer nests a workspace under its nearest registered
     *   ancestor directory (owningParentFolder semantics — workspace rows
     *   nest, no virtual nodes for paths nobody registered; a filesystem
     *   fact this UI never changes);
     * - the NAME layer groups one level's workspaces by the "/" segments
     *   of their titles (virtual folders, this plugin's founding feature;
     *   pure projection, re-flows on rename).
     * Returns the root level { path, name, folders, workspaces }; every
     * workspace entry carries .sub — the child LEVEL nested under that
     * workspace's directory (null when it has no nested workspaces).
     * Folder identity keys (idPath) are prefixed with the owning workspace
     * id inside sub-levels so expansion/styling state never collides when
     * two disk levels happen to hold same-named name groups.
     */
    const DISK_SEP = String.fromCharCode(92) // windows backslash
    /** Normalize a disk path for prefix comparison: separators to "/", trailing separators stripped. */
    const normDiskPath = (p) => {
      const s = String(p || '')
      const windows = (s.length > 2 && s.charCodeAt(1) === 58 && (s.charAt(2) === '/' || s.charAt(2) === DISK_SEP))
        || (s.charAt(0) === DISK_SEP && s.charAt(1) === DISK_SEP)
      const t = windows ? s.split(DISK_SEP).join('/') : s
      let end = t.length
      while (end > 0 && t.charAt(end - 1) === '/') end -= 1
      return t.slice(0, end)
    }
    /** Nearest registered ancestor workspace id per workspace (undefined at top level). */
    const diskParentMapOf = (items) => {
      const list = items || []
      const idByPath = new Map()
      for (const w of list) idByPath.set(normDiskPath(w.path), w.workspaceId)
      const map = new Map()
      for (const w of list) {
        const child = normDiskPath(w.path)
        let ownerPath
        let length = -1
        for (const root of idByPath.keys()) {
          if (root.length > length && child !== root && child.startsWith(root + '/')) {
            ownerPath = root
            length = root.length
          }
        }
        map.set(w.workspaceId, ownerPath !== undefined ? idByPath.get(ownerPath) : undefined)
      }
      return map
    }
    /**
     * The row entry the official 'workspace' grouping mode renders.
     *
     * A raw WorkspaceView carries no `leaf`, and WorkspaceRow renders exactly
     * that field as its label (the tree path fills it while building) — so
     * handing the raw item to renderWorkspaceEntry, as v0.13 did, drew every
     * row with its icon and sessions but NO NAME AT ALL. Reported 2026-09-19.
     *
     * The label is the FULL title: this mode renders no name groups, so a "/"
     * has nothing to group into and must stay in the text.
     */
    const flatWorkspaceEntry = (workspace) => ({
      ...workspace,
      leaf: String(workspace.title || '') || basename(workspace.path) || String(workspace.workspaceId || ''),
      folderPath: '',
    })

    /**
     * Declared-but-empty groups, resolved per level. `explicit` is the store's
     * `folders.ws` bag (level idPrefix → path list); the empty path splits into
     * segments the same way a title prefix does, so a declared "a/b" produces
     * the same two-level chain a member would.
     */
    const EMPTY_FOLDERS = Object.freeze({})
    /** True when this scope declares at least one group (empty groups included). */
    const hasDeclared = (explicit, scope) => {
      const raw = explicit && typeof explicit === 'object' ? explicit[String(scope)] : undefined
      return Array.isArray(raw) && raw.length > 0
    }

    /**
     * Display name of a tree folder node. compressTree materializes a
     * single-child chain as a `kind:'ws'` row, and THAT shape carries `segs`
     * but no `name` — reading .name alone rendered a blank row (a lone
     * "E" above its only member F came out empty).
     */
    const folderLabelOf = (node) => String(node.name || (Array.isArray(node.segs) ? node.segs.join('/') : '') || node.path || '')

    const explicitSegsOf = (explicit, scope) => {
      const raw = explicit && typeof explicit === 'object' ? explicit[String(scope)] : undefined
      const out = []
      for (const path of Array.isArray(raw) ? raw : []) {
        const segs = String(path).split('/').filter((s) => s !== '')
        if (segs.length > 0) out.push(segs)
      }
      return out
    }

    function buildTree(items, groupMode, explicitWs, folderOrder) {
      const list = items || []
      // Issue #7: 'disk' nests by disk only, 'disk-slash' adds the name
      // layer on top (the historical workspaceSlash-on shape), 'slash' runs
      // the name layer WITHOUT any disk nesting — an empty parent map puts
      // every workspace at the root level where "/" segments group them.
      const slashOn = groupMode !== 'disk'
      const diskOn = groupMode !== 'slash'
      const diskParentOf = diskOn ? diskParentMapOf(list) : new Map()
      const childrenOf = new Map()
      for (const w of list) {
        const parent = diskParentOf.get(w.workspaceId)
        if (parent === undefined) continue
        if (!childrenOf.has(parent)) childrenOf.set(parent, [])
        childrenOf.get(parent).push(w)
      }
      // NAME layer inside one level: SEGMENT-driven keys (never re-split a
      // joined path — URL authority segments would shred).
      const buildLevel = (wsList, idPrefix) => {
        const root = { path: '', name: '', folders: [], workspaces: [] }
        const byPath = new Map([['', root]])
        const ensure = (segs) => {
          let node = root
          let key = ''
          for (const seg of segs) {
            key = key === '' ? seg : key + '/' + seg
            let next = byPath.get(key)
            if (!next) {
              next = {
                path: key,
                name: seg,
                folders: [],
                workspaces: [],
                idPath: (idPrefix !== '' ? idPrefix + '//' : '') + key,
                // Declared-group scope of THIS level (v0.17.0): the exact key a
                // new child group must be filed under in folders.ws.
                scope: idPrefix,
              }
              byPath.set(key, next)
              node.folders.push(next)
            }
            node = next
          }
          return node
        }
        // Declared empty groups land BEFORE the members: a declared path that
        // also carries members is the same node either way (ensure is
        // idempotent), and declaring first means an empty one still renders.
        if (slashOn) {
          for (const segs of explicitSegsOf(explicitWs, idPrefix)) ensure(segs)
        }
        for (const workspace of wsList) {
          const segs = splitTitleSegs(workspace.title)
          const folderPath = segs.slice(0, -1).join('/')
          const leaf = segs.length > 0 ? segs[segs.length - 1] : (basename(workspace.path) || String(workspace.title || '') || String(workspace.workspaceId || ''))
          const subList = childrenOf.get(workspace.workspaceId)
          // The disk level this workspace OWNS — its declared groups file here.
          const subPrefix = (idPrefix !== '' ? idPrefix + '//' : '') + workspace.workspaceId
          const entry = {
            workspaceId: workspace.workspaceId,
            title: String(workspace.title || ''),
            path: String(workspace.path || ''),
            sessionIds: Array.isArray(workspace.sessionIds) ? workspace.sessionIds : [],
            leaf,
            folderPath,
            subPrefix,
            sub: subList ? buildLevel(subList, subPrefix) : null,
          }
          // Name layer OFF ('disk' mode): skip it — workspaces mount
          // straight at their disk level; the DISK layer is a filesystem
          // fact and stays.
          if (!slashOn) {
            entry.leaf = String(workspace.title || '') || leaf
            entry.folderPath = ''
            root.workspaces.push(entry)
            continue
          }
          ensure(segs.slice(0, -1)).workspaces.push(entry)
        }
        // Group order: the NAME sort is only the seed. v0.36.4 keeps a
        // persisted per-parent name list (folderOrder) so a dragged group
        // keeps its place — before this the drop committed the registry
        // order but the renderer re-sorted by name, which is why dragging a
        // group row looked like a no-op. Names absent from the stored list
        // (a just-created group) sort after the known ones by locale.
        // v0.36.5: the SAME list may also carry "w:<workspaceId>" tokens,
        // which interleave a BARE workspace row with the group rows of its
        // level. Before this a level always rendered every folder first and
        // every workspace after, so a top-level workspace could never be
        // dropped "as the first row" — the probe showed the commit landing
        // but the row staying at the bottom ("插到第一个永远失败").
        // Tokens absent from the list (a new member, a workspace that just
        // moved in) append in the default order: groups first, then
        // workspaces in registry order.
        const orderOf = (parentKey) => {
          if (!folderOrder || typeof folderOrder !== 'object') return null
          const list = folderOrder[parentKey]
          return Array.isArray(list) ? list : null
        }
        const sortRec = (node, parentKey) => {
          const order = orderOf(parentKey)
          const names = order
            ? order.filter((token) => typeof token === 'string' && token !== '' && !token.startsWith('w:'))
            : null
          if (names && names.length) {
            const rank = new Map()
            for (let i = 0; i < names.length; i += 1) rank.set(names[i], i)
            node.folders.sort((a, b) => {
              const ra = rank.has(a.name) ? rank.get(a.name) : names.length
              const rb = rank.has(b.name) ? rank.get(b.name) : names.length
              if (ra !== rb) return ra - rb
              return a.name.localeCompare(b.name, 'zh')
            })
          } else {
            node.folders.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
          }
          // Level identity every workspace row carries into its drag payload:
          // the mixed reorder is siblings-only, so the drop gate compares it
          // with parentKeyOf(target group idPath).
          for (const w of node.workspaces) w.levelKey = parentKey
          // Mixed display sequence of THIS level: the persisted order first
          // (groups and bare workspaces interleaved), then whatever the list
          // does not mention, groups before workspaces.
          const folderByName = new Map(node.folders.map((child) => [child.name, child]))
          const wsById = new Map(node.workspaces.map((w) => [w.workspaceId, w]))
          const seq = []
          const seenFolders = new Set()
          const seenWorkspaces = new Set()
          for (const token of order || []) {
            if (typeof token !== 'string' || token === '') continue
            if (token.startsWith('w:')) {
              const id = token.slice(2)
              const entry = wsById.get(id)
              if (!entry || seenWorkspaces.has(id)) continue
              seq.push({ kind: 'ws', entry })
              seenWorkspaces.add(id)
            } else {
              const child = folderByName.get(token)
              if (!child || seenFolders.has(token)) continue
              seq.push({ kind: 'folder', node: child })
              seenFolders.add(token)
            }
          }
          for (const child of node.folders) if (!seenFolders.has(child.name)) seq.push({ kind: 'folder', node: child })
          for (const w of node.workspaces) if (!seenWorkspaces.has(w.workspaceId)) seq.push({ kind: 'ws', entry: w })
          node.seq = seq
          for (const child of node.folders) sortRec(child, child.idPath)
        }
        sortRec(root, idPrefix)
        return root
      }
      const topLevel = list.filter((w) => diskParentOf.get(w.workspaceId) === undefined)
      return buildLevel(topLevel, '')
    }

    const countWorkspaces = (node) => (node.kind === 'ws'
      ? 1
      : node.workspaces.reduce((sum, w) => sum + 1 + (w.sub ? countWorkspaces(w.sub) : 0), 0)
        + node.folders.reduce((sum, f) => sum + countWorkspaces(f), 0))

    /**
     * VS Code-style single-child chain compression (preference-controlled):
     * a folder level holding exactly ONE child and nothing else merges into a
     * single display row; a chain ending in one workspace becomes that
     * workspace row with the merged label. Only presentation changes; the
     * underlying workspace/title data is untouched.
     *
     * The merged label is the chain RELATIVE to the first un-compressed
     * ancestor (VS Code explorer behaviour): a chain a/b/c holding only
     * workspace W shows "a/b/c/W" at the root, but the same chain nested
     * inside a populated folder "a" shows "b/c/W". Labels are therefore
     * assembled from RELATIVE segments (segs + pure leaf name) and only
     * materialised into a display node at the chain's top — the pre-0.8 code
     * prefixed each recursion level with the FULL node.path, so nested chains
     * rendered duplicated prefixes like "1/2/1/2/3/A".
     */
    const materializeChain = (chain) => chain.kind === 'ws'
      ? {
        kind: 'ws',
        path: chain.path,
        workspace: { ...chain.workspace, leaf: chain.segs.join('/') + '/' + chain.pure, title: chain.workspace.title, folderPath: '' },
        folders: [],
        workspaces: [],
      }
      : { kind: 'folder', path: chain.path, name: chain.segs.join('/'), folders: chain.folders, workspaces: chain.workspaces }

    function compressTree(node) {
      const folders = (node.folders || []).map(compressTree)
      const workspaces = node.workspaces || []
      if (workspaces.length === 0 && folders.length === 1) {
        // Continue the chain upward: one more relative segment in front of
        // whatever the child chain accumulated. path stays the DEEPEST full
        // path (expansion identity); the label is joined only at the top.
        const child = folders[0]
        return {
          kind: child.kind,
          path: child.path,
          segs: [node.name].concat(child.segs || []),
          pure: child.pure,
          workspace: child.workspace,
          folders: child.folders,
          workspaces: child.workspaces,
        }
      }
      if (folders.length === 0 && workspaces.length === 1) {
        return { kind: 'ws', path: node.path, segs: [node.name], pure: workspaces[0].leaf, workspace: workspaces[0], folders: [], workspaces: [] }
      }
      // Chain top (multiple children, or a mix): children are materialised
      // relative to this node; this node itself keeps its single name.
      return { kind: 'folder', path: node.path, segs: [node.name], folders: folders.map(materializeChain), workspaces }
    }

    /* ============================== styles ============================ */
    // CSS ships in the package-local chunk client.styles.js. The empty
    // default keeps StyleNode renderable before the chunk resolves (or if
    // that request fails); apply() replaces it with the published text.
    let CSS_TEXT = ''
    const StyleNode = () => E('style', null, CSS_TEXT)

    /* ========================== view store =========================== */

    /**
     * The workspace NAME layer ("/" grouping) is OPT-IN as of v0.15: a fresh
     * install shows the official disk folders only, and titles render whole.
     * Hydration REPLACES the whole state and only runs when a snapshot exists,
     * so this one read separates three populations with no migration pass:
     *   true / false -> this browser already ran the 0.13 view options; honour
     *                   the user's own choice.
     *   undefined    -> a pre-0.13 snapshot. Those versions grouped by "/" by
     *                   default and had no switch to turn it off, so undefined
     *                   means "an existing tree that was built with grouping
     *                   ON". Upgrading must not silently reorganize a tree
     *                   someone already lives in: they stay ON.
     *   (a fresh install never hydrates, so init's `false` stands as-is.)
     */
    const workspaceSlashOf = (value) => value === undefined ? true : value === true

    // Issue #7 grouping strategy: 'disk' (official nesting only, default),
    // 'disk-slash' (nesting + "/" name groups — the old workspaceSlash-on),
    // 'slash' (name groups ONLY; disk nesting off). Reads migrate in place:
    // a persisted mode wins; otherwise the pre-0.21 workspaceTitleSlash
    // boolean decides, keeping the v0.15 upgrade semantics (an old snapshot
    // without the key stays grouped — workspaceSlashOf treats undefined ON).
    const workspaceGroupModeOf = (mode, legacySlash) => {
      if (mode === 'disk' || mode === 'disk-slash' || mode === 'slash') return mode
      return workspaceSlashOf(legacySlash) ? 'disk-slash' : 'disk'
    }

    // Issue #8 progressive listing. The official collapsedSessionRows mirror
    // this quota used to track is GONE in dsh 0.2.1-alpha.5 — the shipped
    // browser now folds per group behind a client-side watermark (base 5,
    // auto-raise to 50 for attention rows, +5 per "Show more"). The quota
    // stays a plugin-side opt-in (limit 0 = unlimited, the folder-style
    // default), but its always-visible set follows the official attention
    // semantics: blank, running, running-subagent and pinned rows stay
    // OUTSIDE the quota unconditionally, and so — within the first 50
    // non-blank rows, the official SESSION_WATERMARK_AUTO_MAX — do
    // pending-interaction, completed and the current session, exactly the
    // rows the shipped watermark refuses to fold away. Idle rows beyond the
    // quota hide behind one overflow row; a lifted workspace renders
    // everything again.
    const SESSION_ATTENTION_WINDOW = 50
    const limitSessionsForRender = (rows, limit, lifted, currentId) => {
      if (!rows || !limit || lifted) return { rows: rows || [], hidden: 0 }
      const keep = []
      const idle = []
      let seen = 0
      for (const row of rows) {
        if (!row.blank) seen += 1
        const attention = row.blank || row.running || row.subagents > 0 || row.pinned
          || (seen <= SESSION_ATTENTION_WINDOW && (row.pending || row.completed || row.id === currentId))
        if (attention) keep.push(row)
        else idle.push(row)
      }
      if (idle.length <= limit) return { rows, hidden: 0 }
      return { rows: [...keep, ...idle.slice(0, limit)], hidden: idle.length - limit }
    }

    /**
     * Normalize a declared group path: split on "/", drop blank segments (so
     * "  " and "a//b" cannot create nameless levels), trim each name. Returns
     * '' when nothing is left — the store actions treat that as "do nothing".
     */
    const declaredPathOf = (raw) => String(raw == null ? '' : raw)
      .split('/').map((s) => s.trim()).filter((s) => s !== '').join('/')

    const createViewStore = () => storeKit.defineStore({
      // prefs.appearance bakes the shipped default (v0.31.0: stroke OFF) so a
      // fresh install — which never hydrates — starts outline-free, while a
      // hydrated snapshot without an appearance record keeps the legacy ON
      // default through readAppearance (see DEFAULT_APPEARANCE for the full
      // workspaceSlashOf-style three-population story). The record is a
      // LITERAL, not a spread of DEFAULT_APPEARANCE: init() is eval-harness
      // friendly (no cross-section reference), and the smoke suite asserts the
      // two stay in lockstep field by field.
      init: () => ({ expanded: {}, sessionsExpanded: {}, sessionGroups: {}, sessionOrder: {}, prefs: { compactChains: true, sessionLimit: 0, appearance: { color: '', glow: 0, weight: 0, shadow: false, stroke: false, strokeWidth: 1, strokeColor: '#808080' } }, styling: {}, groupBy: 'workspace-tree', orderBy: 'manual', archivedFilter: 'default', workspaceGroupMode: 'disk', sessionTitleSlash: true, workspaceTitleSlash: false, ungroupedOpen: true, folders: { ws: {}, sess: {} }, folderOrder: {} }),
      // NOTE: hydration REPLACES the state with the persisted whole value —
      // init defaults never merge. Every action must tolerate a missing key
      // (states persisted by older plugin versions lack sessionGroups), and
      // every selector read takes a fallback.
      persist: 'dsh.betterWorkspace.view.v1',
      actions: {
        // Manual-sync pull targets (overwrite / merge): the host settings
        // values land in the local store, and rendering keeps reading the
        // local selectors, so scope-less hosts keep working unchanged.
        importHost: (d, host) => {
          if (!host || typeof host !== 'object') return
          if (host.styling && typeof host.styling === 'object') d.styling = host.styling
          if (!d.prefs) d.prefs = {}
          if (host.compactChains !== undefined) d.prefs.compactChains = host.compactChains !== false
          if (host.statusPulse !== undefined) d.prefs.statusPulse = host.statusPulse !== false
          if (host.appearance && typeof host.appearance === 'object') d.prefs.appearance = host.appearance
        },
        // Merge mode: union of both sides, the PULLED (host) copy wins any
        // per-key conflict; prefs take the pulled booleans when present.
        mergeHost: (d, host) => {
          if (!host || typeof host !== 'object') return
          if (host.styling && typeof host.styling === 'object') d.styling = { ...(d.styling || {}), ...host.styling }
          if (!d.prefs) d.prefs = {}
          if (host.compactChains !== undefined) d.prefs.compactChains = host.compactChains !== false
          if (host.statusPulse !== undefined) d.prefs.statusPulse = host.statusPulse !== false
          if (host.appearance && typeof host.appearance === 'object') d.prefs.appearance = { ...(d.prefs.appearance || {}), ...host.appearance }
        },
        setExpanded: (d, key, value) => { if (!d.expanded) d.expanded = {}; d.expanded[key] = value },
        setSessionsExpanded: (d, key, value) => { if (!d.sessionsExpanded) d.sessionsExpanded = {}; d.sessionsExpanded[key] = value },
        setSessionGroupExpanded: (d, key, value) => { if (!d.sessionGroups) d.sessionGroups = {}; d.sessionGroups[key] = value },
        setPref: (d, key, value) => { if (!d.prefs) d.prefs = {}; d.prefs[key] = value },
        setStyling: (d, key, value) => { if (!d.styling) d.styling = {}; if (value === null) delete d.styling[key]; else d.styling[key] = value },
        // Browser-local session order (v0.10.2): the fallback channel for
        // drag-to-reorder on hosts that no longer inject insertSessionBefore
        // (dsh 0.1.6-alpha.1). Per-workspace and per-browser on purpose — the
        // host order stays authoritative wherever the action exists, and this
        // never rides the cross-device sync.
        setSessionOrder: (d, workspaceId, order) => {
          if (!d.sessionOrder || typeof d.sessionOrder !== 'object') d.sessionOrder = {}
          if (!Array.isArray(order) || order.length === 0) delete d.sessionOrder[workspaceId]
          else d.sessionOrder[workspaceId] = order.slice()
        },
        // View options (v0.13): mirror the official browser's group/order
        // menu plus the two slash-grouping toggles. groupBy mirrors the
        // official literal set; the bw defaults keep the founding behaviour
        // (tree + both slash layers on + manual host order).
        setGroupBy: (d, value) => { d.groupBy = value },
        setOrderBy: (d, value) => { d.orderBy = value },
        setArchivedFilter: (d, value) => { d.archivedFilter = value === 'show' || value === 'only' ? value : 'default' },
        setSessionTitleSlash: (d, value) => { d.sessionTitleSlash = value !== false },
        setWorkspaceTitleSlash: (d, value) => { d.workspaceTitleSlash = value !== false },
        // v0.21.0 tri-state grouping (issue #7). The legacy boolean rides
        // along so a plugin downgrade keeps a sane tree.
        setWorkspaceGroupMode: (d, value) => {
          d.workspaceGroupMode = value === 'slash' || value === 'disk-slash' ? value : 'disk'
          d.workspaceTitleSlash = d.workspaceGroupMode !== 'disk'
        },
        // v0.21.0 collapsible Ungrouped block (issue #6).
        setUngroupedOpen: (d, value) => { d.ungroupedOpen = value },
        // Persisted GROUP order (v0.36.4), one name list per PARENT identity
        // (a level's idPrefix for the root level, else the parent group's
        // idPath). Only sibling reorders are written here — a cross-parent
        // move is a rename, not an order change, and stays refused in the
        // drop handler. An empty list deletes the entry so the name sort
        // comes back for that parent.
        setFolderOrder: (d, parentKey, names) => {
          if (!d.folderOrder || typeof d.folderOrder !== 'object') d.folderOrder = {}
          const key = String(parentKey == null ? '' : parentKey)
          const clean = (Array.isArray(names) ? names : []).map((n) => String(n)).filter((n) => n !== '')
          if (clean.length === 0) delete d.folderOrder[key]
          else d.folderOrder[key] = clean
        },
        // Explicit (possibly EMPTY) groups, v0.17.0. A group has always been a
        // projection of "/" in member titles, so a group with no members simply
        // did not exist and "create a group" had nothing to write. These two
        // actions are that missing write path: a declared path renders as a
        // real row even while it holds nothing, and disappears again when the
        // user deletes it. Scope keys follow the tree's own identities —
        // workspaces live in the DISK level they belong to (folders.ws keyed by
        // the level's idPrefix: '' for the top level, '<wsId>' one disk level
        // down, '<a>//<b>' deeper), sessions live in one workspace
        // (folders.sess keyed by workspaceId). Both bags are plain path lists.
        addFolder: (d, kind, scope, path) => {
          const clean = declaredPathOf(path)
          if (clean === '') return
          if (!d.folders || typeof d.folders !== 'object') d.folders = { ws: {}, sess: {} }
          const bagKey = kind === 'session' ? 'sess' : 'ws'
          if (!d.folders[bagKey] || typeof d.folders[bagKey] !== 'object') d.folders[bagKey] = {}
          const bag = d.folders[bagKey]
          const key = String(scope == null ? '' : scope)
          const cur = Array.isArray(bag[key]) ? bag[key].slice() : []
          if (cur.indexOf(clean) === -1) cur.push(clean)
          bag[key] = cur
        },
        // Deleting a declared group takes its declared DESCENDANTS with it —
        // "a", "a/b" and "a/b/c" are one branch, and leaving the children
        // behind would resurrect the parent as an implicit row.
        removeFolder: (d, kind, scope, path) => {
          const clean = declaredPathOf(path)
          if (clean === '') return
          if (!d.folders || typeof d.folders !== 'object') return
          const bag = d.folders[kind === 'session' ? 'sess' : 'ws']
          if (!bag || typeof bag !== 'object') return
          const key = String(scope == null ? '' : scope)
          const cur = Array.isArray(bag[key]) ? bag[key] : []
          const prefix = clean + '/'
          const next = cur.filter((p) => p !== clean && p.indexOf(prefix) !== 0)
          if (next.length === 0) delete bag[key]
          else bag[key] = next
        },
      },
    })

    /* ========================= title cache store ====================== */

    // Cold-restart title fallback. The host list serves titles only from the
    // persisted projection cache: sessions that never wrote a checkpoint —
    // and every fork-born (seeded) session, which the list skips entirely —
    // come back after a restart with title absent and displayTitle already
    // degraded to the workspace basename (dsh displayTitleOf: title → cwd
    // basename → id). The durable titles live on in each session's log, but
    // nothing reads a log for a cheap list row. This store remembers the
    // last REAL wire title per session id (learned only from snapshots where
    // summary.title exists — never from displayTitle, which is basename
    // degraded in exactly the window being patched), so the tree restores
    // the "/" grouping until the wire catches up. 0.9.6: plain module
    // state with one debounced whole-file save per real change batch
    // (issue #1: per-session reactive-store dispatches cost O(sessions)
    // immer produces per snapshot tick and froze large installs). Same-
    // value scans allocate nothing; entries evict oldest-at past the hard
    // cap. A stale remembered title (renamed
    // elsewhere, cleared browser storage) self-heals the moment the wire
    // carries the truth again; a missing entry just leaves today's fallback.
    const TITLE_CACHE_LIMIT = 3000
    const TITLE_CACHE_KEEP = 2400
    const TITLE_CACHE_KEY = 'dsh.betterWorkspace.titles.v1'
    const titleCache = { byId: {} }
    let titleSaveTimer = null
    const loadTitleCache = () => {
      try {
        const raw = localStorage.getItem(TITLE_CACHE_KEY)
        if (raw !== null) {
          const parsed = JSON.parse(raw)
          if (parsed && typeof parsed.byId === 'object' && parsed.byId !== null) titleCache.byId = parsed.byId
        }
      } catch (e) { /* storage unavailable/corrupt: cold start without cache */ }
    }
    const scheduleTitleSave = () => {
      clearTimeout(titleSaveTimer)
      titleSaveTimer = setTimeout(() => {
        try { localStorage.setItem(TITLE_CACHE_KEY, JSON.stringify(titleCache)) } catch (e) {}
      }, 200)
    }
    // One plain-object batch pass per snapshot (issue #1). Unchanged scans
    // cost one loop with zero allocation; only real changes mark dirty;
    // eviction runs once per changed batch followed by ONE debounced save.
    // v0.30.2 conversation-following titles: keep the "/" grouping prefix
    // when an automatic rename replaces only the leaf. prev is the LAST
    // title shown for the session (grafted display included); next is the
    // fresh wire title. Returns the grafted full title, or undefined when
    // next must stand alone: prev missing/prefix-free (nothing to keep),
    // next blank, or next carrying "/" itself (a deliberate regroup or a
    // self-grouping auto name — respected verbatim).
    const graftTitleDisplay = (prev, next) => {
      if (typeof prev !== 'string' || typeof next !== 'string') return undefined
      const segs = prev.split('/')
      if (segs.length < 2) return undefined
      while (segs.length > 1 && segs[segs.length - 1] === '') segs.pop()
      if (segs.length < 2) return undefined
      if (next === '' || next.includes('/')) return undefined
      segs.pop() // drop the old leaf: only the group prefix survives
      return segs.join('/') + '/' + next
    }

    const rememberAllTitles = (list) => {
      if (!list || !list.byId) return false
      const byId = titleCache.byId
      const now = Date.now()
      let changed = false
      for (const id of Object.keys(list.byId)) {
        const summary = list.byId[id]
        if (!summary || summary.blank) continue
        const title = summary.title
        if (typeof title !== 'string' || title === '') continue
        const prev = byId[id]
        if (prev && prev.title === title) continue
        const base = prev ? (prev.display || prev.title) : undefined
        const grafted = graftTitleDisplay(base, title)
        const entry = { title: title, at: now }
        if (grafted !== undefined) entry.display = grafted
        byId[id] = entry
        changed = true
      }
      if (!changed) return false
      const keys = Object.keys(byId)
      if (keys.length > TITLE_CACHE_LIMIT) {
        keys.sort((a, b) => ((byId[a] && byId[a].at) || 0) - ((byId[b] && byId[b].at) || 0))
        for (let i = 0; i < keys.length - TITLE_CACHE_KEEP; i++) delete byId[keys[i]]
      }
      scheduleTitleSave()
      return true
    }

    /* ======================= host settings sync ======================= */

    // Cross-device preferences: styling / the two toggles
    // live in the HOST settings store (~/.dsh/settings.yaml through the
    // better-workspace namespace). Web and the desktop app share one DSH_HOME,
    // so a style set in the browser follows the user into the Electron app and
    // back. The browser localStorage view store stays the rendering source and
    // the fallback: host values are MIRRORED into it one-way, and every write
    // goes to BOTH stores (local action for immediate echo, scope.set for
    // durable cross-device persistence). Hosts without the settingsScope
    // service — or non-loopback pages where the scope stays process-local —
    // simply never mirror and never sync, which is exactly the pre-0.9.5
    // browser-local behavior.
    let prefsScopeRef = null
    // 'settingsScope' (dsh <= 0.1.6, the shared ~/.dsh/settings.yaml home —
    // the only world where CROSS-DEVICE sync makes sense) or 'configForms'
    // (dsh >= 0.1.7, per-profile patch persistence). null = browser-local.
    let prefsScopeVia = null
    const HOST_SNAP_UNAVAILABLE = { status: 'unavailable', value: undefined }
    const hostPrefsOf = (snap) => (snap && snap.status === 'ready' && snap.value && typeof snap.value === 'object'
      ? snap.value
      : null)
    const scopeSet = (field, value) => {
      const scope = prefsScopeRef
      if (!scope || typeof scope.set !== 'function') return
      try {
        Promise.resolve(scope.set(field, value)).catch((error) => {
          console.warn('[dsh-better-workspace] host settings write failed: ' + field, error)
        })
      } catch (error) {
        console.warn('[dsh-better-workspace] host settings write threw: ' + field, error)
      }
    }
    // React hook over the scope snapshot; degrades to a stable "unavailable"
    // constant when the scope is absent so useSyncExternalStore never re-binds.
    // The hook call itself is unconditional (React discipline: no conditional
    // hooks) — capability probing lives inside the callbacks.
    const HAS_USE_SYNC_EXTERNAL_STORE = typeof React.useSyncExternalStore === 'function'
    const useHostScope = () => {
      const scope = prefsScopeRef
      return HAS_USE_SYNC_EXTERNAL_STORE
        ? React.useSyncExternalStore(
          (onChange) => (scope && typeof scope.subscribe === 'function' ? scope.subscribe(onChange) : () => {}),
          () => {
            try { return scope && typeof scope.getSnapshot === 'function' ? scope.getSnapshot() : HOST_SNAP_UNAVAILABLE } catch { return HOST_SNAP_UNAVAILABLE }
          },
        )
        : HOST_SNAP_UNAVAILABLE
    }
    // dsh 0.2.2-alpha.3: the shared context menu owns the popup, so its
    // captured target (not our local ctx) decides which row keeps the open
    // state. Capability probing stays inside the callbacks — old hosts have
    // no service and the hook degrades to a stable null.
    // Late-arriving shared menu: the row highlight subscribes to face.active,
    // but the face itself can be adopted AFTER the first render (soft inject).
    // A tiny module-level revision bus re-renders those rows once, so the
    // highlight starts following the official target without waiting for an
    // unrelated store tick.
    const menuFaceListeners = new Set()
    const subscribeMenuFace = (listener) => {
      menuFaceListeners.add(listener)
      return () => { menuFaceListeners.delete(listener) }
    }
    const notifyMenuFace = () => {
      for (const listener of Array.from(menuFaceListeners)) {
        try { listener() } catch { /* one stale row must not stop the rest */ }
      }
    }
    const useActiveContextMenu = (faceOf) => {
      const [, bumpFace] = React.useState(0)
      React.useEffect(() => {
        if (typeof faceOf === 'function' && faceOf()) return undefined
        return subscribeMenuFace(() => bumpFace((value) => value + 1))
      }, [])
      const face = typeof faceOf === 'function' ? faceOf() : null
      const active = face && face.active
      return HAS_USE_SYNC_EXTERNAL_STORE
        ? React.useSyncExternalStore(
          (onChange) => (active && typeof active.subscribe === 'function' ? active.subscribe(onChange) : () => {}),
          () => {
            try { return active && typeof active.getSnapshot === 'function' ? active.getSnapshot() : null } catch { return null }
          },
        )
        : null
    }

    // MANUAL cross-device sync (user-chosen, never automatic): the settings
    // card offers a pull button ("从客户端获取" on the web / "从 Web 获取" in
    // the desktop app — the other surface's copy arrives through the host
    // settings store) with an overwrite-or-merge mode choice, plus a push
    // button that uploads THIS device's current values (pre-0.9.5 history was
    // never uploaded, so a first explicit push is needed once). Routine new
    // writes already dual-write through makeSharedWrites, so the host copy
    // stays fresh after the first push.

    // Shared write wrappers: local action first (immediate echo + fallback
    // store), then the durable host write computed from the CURRENT rendered
    // values — after a manual pull the local store already holds the host
    // copy, so host-only entries written on the other surface survive.
    const makeSharedWrites = (actions, stylingMap) => ({
      setStyling: (key, value) => {
        if (actions && typeof actions.setStyling === 'function') actions.setStyling(key, value)
        const next = { ...stylingMap }
        if (value === null) delete next[key]
        else next[key] = value
        scopeSet('styling', next)
      },
      /**
       * Auto-assignment writes SEVERAL keys in one pass (every new item of a
       * snapshot). The host write is derived from the rendered snapshot, so
       * writing them one by one would leave the host copy holding only the
       * last one — batch them into a single local+host update instead.
       * @param entries - `[key, value]` pairs; null values delete.
       */
      setStylingMany: (entries) => {
        if (!Array.isArray(entries) || entries.length === 0) return
        if (actions && typeof actions.setStyling === 'function') {
          for (const entry of entries) actions.setStyling(entry[0], entry[1])
        }
        const next = { ...stylingMap }
        for (const entry of entries) {
          if (entry[1] === null) delete next[entry[0]]
          else next[entry[0]] = entry[1]
        }
        scopeSet('styling', next)
      },
      setPref: (key, value) => {
        if (actions && typeof actions.setPref === 'function') actions.setPref(key, value)
        scopeSet(key, value)
      },
    })

    /* ==================== directory-picker capability ================== */

    // The host composes exactly ONE directory-picking backend
    // (@deepseek-ai/dsh-host-directory-picker-auto): a loopback-only webserver
    // bind on a display-bearing host gets `native` — one OS chooser on the
    // HOST's own screen — while every other bind (all-interfaces/LAN, SSH,
    // headless) gets `browse`, whose wire verbs are list/createDirectory ONLY
    // and whose `pick` is refused BY DESIGN with `directory-picker/unavailable`
    // ("... needs the native capability; the composed picker serves browse").
    // v0.16.0: the sidebar no longer draws its own in-app browser. The browse
    // backend SHIPS one (dsh-client-ui-directory-picker-browse, mounted as a
    // host+surface pair, its client half registering into both directory-flow
    // holes) — but it can only be RENDER-AUTHORIZED by the entry that
    // DECLARED the child hole (the shipped WorkspaceBrowser), and a child
    // declaration is exclusive, so shadowing that seat forfeits that
    // authorization for good (ui-renderer: "not declared by this entry's
    // children").
    // v0.28.0: that gap no longer punts browse hosts to the empty-state page.
    // The shipped occupant registers into BOTH holes (the sidebar hole
    // included), so the sidebar reads its component off the slot ledger —
    // the v0.22.0 hero read, third use of the shipped-occupant pattern — and
    // renders it with its own owner conversation. A native Host still gets
    // the official OS chooser; a ledger that hides the entry keeps the
    // add-guide pointer as the floor. The probe stays: it decides which of
    // the two this page gets, and a refused pick still classifies the
    // backend.
    const pickerState = { kind: 'unknown', probe: null, api: null }
    /**
     * True for the refusal a Host serving the OTHER capability throws: the wire
     * code when the caller still carries it, the Host's fixed sentence
     * otherwise (uiWorkspace.pickDirectory wraps the RPC failure in a plain
     * Error, so the code is gone by the time the flow sees it).
     */
    const pickerRefusal = (error) => {
      if (error && typeof error === 'object' && error.rpcError
        && error.rpcError.code === 'directory-picker/unavailable') return true
      const message = messageOf(error)
      return message.indexOf('needs the native capability') !== -1
        || message.indexOf('directory-picker/unavailable') !== -1
    }
    /**
     * Resolve which backend this page's Host composes. `list` succeeds exactly
     * on `browse` and is refused with the capability code on `native`, so one
     * call answers both worlds without ever opening a chooser or creating a
     * directory. An unclassified failure (a carrier still connecting at boot)
     * is NOT cached: the next open re-probes, and the flow falls back to trying
     * the chooser itself.
     */
    const pickerCapabilityNow = () => {
      if (pickerState.kind !== 'unknown') return Promise.resolve(pickerState.kind)
      if (pickerState.probe !== null) return pickerState.probe
      const api = pickerState.api
      if (!api || typeof api.listDirectory !== 'function') return Promise.resolve('unknown')
      const probe = Promise.resolve()
        .then(() => api.listDirectory(undefined, undefined))
        .then(
          () => 'browse',
          (error) => (pickerRefusal(error) ? 'native' : 'unknown'),
        )
      pickerState.probe = probe.then((kind) => {
        if (kind === 'unknown') { pickerState.probe = null; return kind }
        pickerState.kind = kind
        return kind
      })
      return pickerState.probe
    }

    /* ============================ flow dialog ========================= */

    const BTN = (props) => (
      ui.Button
        ? E(ui.Button, props)
        : E('button', { type: 'button', className: cls('bw-btn', props.variant === 'primary' && 'bw-btn-primary'), onClick: props.onClick, disabled: props.disabled }, props.children)
    )

    function TextDialog({ title, hint, initial, confirmLabel, onConfirm, onClose, t }) {
      const [value, setValue] = React.useState(initial)
      const inputRef = React.useRef(null)
      React.useEffect(() => { if (inputRef.current) { inputRef.current.focus(); inputRef.current.select() } }, [])
      const commit = () => onConfirm(value)
      return E(ui.Modal, {
        open: true,
        onClose,
        closeLabel: t('close'),
        title,
        footer: E('div', { className: 'bw-modal-actions' },
          E(BTN, { variant: 'outline', onClick: onClose }, t('cancel')),
          E(BTN, { variant: 'primary', onClick: commit }, confirmLabel || t('confirm')),
        ),
      },
        E('div', { className: 'bw-modal-body' },
          E('div', { className: 'bw-field' },
            E('input', {
              ref: inputRef,
              className: 'bw-input',
              value,
              onChange: (e) => setValue(e.target.value),
              onKeyDown: (e) => { if (e.key === 'Enter') commit() },
            }),
            hint ? E('div', { className: 'bw-hint' }, hint) : null,
          ),
        ),
        StyleNode(),
      )
    }

    function ConfirmDialog({ title, body, confirmLabel, onConfirm, onClose, t }) {
      return E(ui.Modal, {
        open: true,
        onClose,
        closeLabel: t('close'),
        title,
        footer: E('div', { className: 'bw-modal-actions' },
          E(BTN, { variant: 'outline', onClick: onClose }, t('cancel')),
          E(BTN, { variant: 'primary', onClick: onConfirm }, confirmLabel || t('confirm')),
        ),
      }, E('div', { className: 'bw-modal-body' }, E('div', { className: 'bw-hint' }, body)), StyleNode())
    }

    /**
     * One picker over the official primitives Menu, used wherever this plugin
     * would otherwise reach for a native <select> / <datalist>.
     *
     * WHY NOT NATIVE: the OS draws a native select's popup itself, so over this
     * plugin's translucent panel it comes back as a light system list that
     * ignores the theme entirely. dsh-ide-git hit the same defect twice and
     * replaced its selects with a button-over-menu for exactly that reason (see
     * the RepoSelect / FilterSelect notes there) — but it had to lay that menu
     * out INSIDE the panel, because dsh-better-sidebar declares
     * `contain: layout` and would strand a portal off-screen. This plugin sits
     * in a native DSH sidebar slot with no such constraint, so it can use the
     * real primitives Menu: official look and keyboard model, portal above the
     * modal (z-index 1100 vs 1000), and its own scrolling list — which the
     * workspace x session target list needs.
     *
     * Degradation: callers keep a native control for hosts whose primitives
     * have no Menu, so picking never becomes impossible.
     */

    /**
     * "New group" dialog (v0.17.0). Three decisions, top to bottom:
     *
     *  1. WHICH LAYER — session groups, or workspace groups. A single segmented
     *     pair of buttons; the workspace side only exists while "/" grouping is
     *     on for workspaces, and a host where only one layer is live renders no
     *     switch at all (the wording of the header button already promised it).
     *  2. WHERE — an expandable TREE of containers rather than a flat dropdown:
     *     the parent is picked visually, so "under this workspace" and "inside
     *     that group" read the same way they do in the sidebar.
     *  3. WHAT — the new group's name ("a/b" nests).
     *
     * Declared-empty groups did not use to exist (a group was a projection of
     * member titles, so a member-less one could not be represented); this dialog
     * writes the declaration itself, which is why it is not the move dialog.
     */
    function GroupNewDialog(props) {
      const { kinds, initialKind, treeOf, label, onConfirm, onClose, t } = props
      const [kind, setKind] = React.useState(initialKind)
      const [picked, setPicked] = React.useState(null)
      const [openKeys, setOpenKeys] = React.useState({})
      const [name, setName] = React.useState('')
      const [error, setError] = React.useState('')
      const plan = treeOf(kind)
      const toggle = (id) => setOpenKeys((prev) => ({ ...prev, [id]: !prev[id] }))
      const pick = (node) => { if (node.pickable === false) return; setPicked(node); setError('') }
      const submit = () => {
        const clean = String(name).split('/').filter((s) => s !== '').join('/')
        if (clean === '') { setError(t('group.new.empty')); return }
        if (!picked) { setError(t('group.new.pickFirst')); return }
        onConfirm(kind, picked.scope, picked.path === '' ? clean : picked.path + '/' + clean)
      }
      const renderNodes = (list, depth) => {
        const out = []
        for (const node of list) {
          const hasKids = node.children.length > 0
          // The first level opens by default: the root row is a header ("pick a
          // workspace"), so a collapsed tree would show the user a header and
          // nothing to pick. Deeper levels stay closed until asked for.
          const expanded = openKeys[node.id] === true || (depth === 0 && openKeys[node.id] !== false)
          out.push(E('div', {
            key: 'n-' + node.id,
            className: cls('bw-gn-row', node.pickable === false && 'bw-gn-row-hold', node.kind === 'new' && 'bw-gn-row-new', picked && picked.id === node.id && 'bw-gn-row-on'),
            style: { paddingLeft: 6 + depth * 14 },
            role: 'treeitem',
            'aria-selected': picked && picked.id === node.id ? 'true' : 'false',
            onClick: () => pick(node),
          },
            hasKids ? E('button', {
              type: 'button',
              className: cls('bw-gn-twist', expanded && 'bw-gn-twist-open'),
              tabIndex: -1,
              'aria-label': node.label,
              onClick: (e) => { e.stopPropagation(); toggle(node.id) },
            }, E('span', { className: 'bw-chevron' })) : E('span', { className: 'bw-gn-twist' }),
            E('span', { className: 'bw-gn-icon' },
              node.kind === 'new' ? icon('IconPlusOutline16', 15)
                : node.kind === 'ws' ? icon('IconFolderOpen16', 15)
                  : icon('IconFolderClose16', 15)),
            E('span', { className: 'bw-gn-label' }, node.label),
          ))
          if (hasKids && expanded) out.push(...renderNodes(node.children, depth + 1))
        }
        return out
      }
      return E(ui.Modal, {
        open: true,
        onClose,
        closeLabel: t('close'),
        title: label,
        footer: E('div', { className: 'bw-modal-actions' },
          E(BTN, { variant: 'outline', onClick: onClose }, t('cancel')),
          E(BTN, { variant: 'primary', onClick: submit }, t('confirm')),
        ),
      },
        E('div', { className: 'bw-modal-body' },
          kinds.length > 1 ? E('div', { className: 'bw-seg', role: 'radiogroup', 'aria-label': t('group.new.title') },
            E('button', {
              type: 'button', role: 'radio', 'aria-checked': kind === 'session' ? 'true' : 'false',
              className: cls('bw-seg-btn', kind === 'session' && 'bw-seg-btn-on'),
              onClick: () => { setKind('session'); setPicked(null) },
            }, t('group.new.sess')),
            E('button', {
              type: 'button', role: 'radio', 'aria-checked': kind === 'workspace' ? 'true' : 'false',
              className: cls('bw-seg-btn', kind === 'workspace' && 'bw-seg-btn-on'),
              onClick: () => { setKind('workspace'); setPicked(null) },
            }, t('group.new.ws')),
          ) : null,
          E('div', { className: 'bw-gn-hint' }, plan.hint || t('group.new.where')),
          E('div', { className: 'bw-gn-tree', role: 'tree', 'aria-label': t('group.new.where') },
            plan.nodes.length > 0 ? renderNodes(plan.nodes, 0) : E('div', { className: 'bw-gn-empty' }, t('group.new.noWorkspace'))),
          E('div', { className: 'bw-field' },
            E('input', {
              className: 'bw-input bw-gn-input',
              value: name,
              autoFocus: true,
              placeholder: t('group.new.placeholder'),
              'aria-label': t('group.new.title'),
              onChange: (e) => { setName(e.target.value); setError('') },
              onKeyDown: (e) => { if (e.key === 'Enter') submit() },
            }),
          ),
          E('div', { className: 'bw-hint' }, t('group.new.nameHint')),
          error !== '' ? E('div', { className: 'bw-error-text', role: 'alert' }, error) : null,
        ),
      )
    }

    function MenuPicker({ options, value, onPick, placeholder, chevronOnly, title, t }) {
      const [open, setOpen] = React.useState(false)
      const list = Array.isArray(options) ? options : []
      let current = null
      for (const option of list) { if (String(option.value) === String(value)) { current = option; break } }
      const chevron = icon('IconChevronDownOutline14', 14)
      return E(ui.Menu, {
        open,
        onClose: () => { setOpen(false) },
        items: list.map((option) => ({ id: String(option.value), label: String(option.label) })),
        selectedId: current === null ? undefined : String(current.value),
        onSelect: (id) => { setOpen(false); onPick(id) },
        align: 'start',
        dense: true,
        portal: true,
        className: cls('bw-menu-block', chevronOnly && 'bw-menu-inline'),
        anchor: E('button', {
          type: 'button',
          className: cls('bw-select', chevronOnly && 'bw-select-icon'),
          title: title === undefined ? undefined : title,
          onClick: () => setOpen(v => !v),
        },
          chevronOnly ? null : E('span', { className: 'bw-select-label' }, current === null ? (placeholder || '') : String(current.label)),
          E('span', { className: 'bw-select-chevron' }, chevron || '\u25be')),
      })
    }

    /**
     * "Move to group…": the discoverable front door for the name-projection
     * grouping this plugin has always had (no empty groups — moving an entry
     * just rewrites its title prefix). Two shapes share one dialog:
     * - a free target (the header "New group" button, or a row drop on it)
     *   locks the entry and only asks for the group name;
     * - the picker shape (header button click) asks which entry first.
     * Both dropdowns are MenuPicker (see its note): a native select's popup and
     * a native datalist's suggestions are drawn by the OS and ignore the panel
     * theme, which is exactly what users reported here.
     */
    function GroupDialog({ title, hint, initial, targets, groupPaths, onConfirm, onClose, t }) {
      const hasTargets = Array.isArray(targets) && targets.length > 0
      const [value, setValue] = React.useState(initial || '')
      const [targetValue, setTargetValue] = React.useState(hasTargets ? targets[0].value : '')
      const inputRef = React.useRef(null)
      React.useEffect(() => { if (inputRef.current) { inputRef.current.focus(); inputRef.current.select() } }, [])
      const commit = () => onConfirm(hasTargets ? targetValue : undefined, value)
      const hintList = Array.isArray(groupPaths) ? groupPaths.filter((p) => p !== '') : []
      const menuReady = typeof ui.Menu === 'function'
      return E(ui.Modal, {
        open: true,
        onClose,
        closeLabel: t('close'),
        title,
        footer: E('div', { className: 'bw-modal-actions' },
          E(BTN, { variant: 'outline', onClick: onClose }, t('cancel')),
          E(BTN, { variant: 'primary', onClick: commit }, t('confirm')),
        ),
      },
        E('div', { className: 'bw-modal-body' },
          hasTargets
            ? E('div', { className: 'bw-field' },
              menuReady
                ? E(MenuPicker, {
                  options: targets.map((item) => ({ value: item.value, label: item.label })),
                  value: targetValue,
                  onPick: setTargetValue,
                  t,
                })
                : E('select', {
                  className: 'bw-input',
                  defaultValue: targets[0].value,
                  onChange: (e) => setTargetValue(e.target.value),
                }, targets.map((item) => E('option', { key: String(item.value), value: String(item.value) }, item.label))),
            )
            : null,
          E('div', { className: 'bw-field' },
            E('div', { className: 'bw-combo' },
              E('input', {
                ref: inputRef,
                className: 'bw-input',
                value,
                onChange: (e) => setValue(e.target.value),
                onKeyDown: (e) => { if (e.key === 'Enter') commit() },
              }),
              // The old datalist's suggestions, as a real menu: one chevron
              // button beside the field. Typing a brand-new group name still
              // works exactly as before.
              (menuReady && hintList.length > 0)
                ? E(MenuPicker, {
                  options: hintList.map((path) => ({ value: path, label: path })),
                  value,
                  onPick: setValue,
                  chevronOnly: true,
                  title: t('group.pick'),
                  t,
                })
                : null,
            ),
            hint ? E('div', { className: 'bw-hint' }, hint) : null,
          ),
        ),
        StyleNode(),
      )
    }

    /**
     * "Change workspace default preset" (v0.32.0): a workspace's default
     * preset IS the agentPreset projection of its standing BLANK session, so
     * this dialog reads the preset roster (the same remote channel the
     * official hero chip reads) and swaps that blank's composition. Without a
     * blank the workspace follows the GLOBAL default — say so instead of
     * promising an edit; a host refusal surfaces inline with its own reason.
     * applyPreset is null exactly when no blank exists (or the face is
     * absent); the roster is a feature-probed plugin-side read.
     */
    /* BUILT-IN preset id → this plugin's dictionary key. Mirrors the official
     * display fold (agent-preset-registry display.ts isBuiltInPreset: built-ins
     * publish NO name) because that registry package is not on the client boot
     * graph and cannot be required here. Custom presets keep their authored
     * name; the id itself is the last-resort fallback. Host-follow: delete this
     * fold and require the official one once it ships on the boot graph. */
    const BUILT_IN_PRESET_LABEL_KEYS = {
      standard: 'presetStandardName',
      ptc: 'presetPtcName',
      minimal: 'presetMinimalName',
      cordis: 'presetCordisName',
    }
    const presetDisplayLabel = (row, t) => {
      if (row && row.name === undefined && BUILT_IN_PRESET_LABEL_KEYS[row.id] !== undefined) return t(BUILT_IN_PRESET_LABEL_KEYS[row.id])
      return (row && row.name) || (row && row.id) || ''
    }

    function WorkspacePresetDialog({ applyPreset, hasBlank, loadRoster, current, onApplied, onClose, t }) {
      const editable = typeof applyPreset === 'function' && hasBlank !== false
      const menuReady = typeof ui.Menu === 'function'
      const [status, setStatus] = React.useState('loading') // loading | ready | error
      const [rows, setRows] = React.useState([])
      const [picked, setPicked] = React.useState('')
      const [errorText, setErrorText] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      React.useEffect(() => {
        if (typeof loadRoster !== 'function') { setStatus('error'); setErrorText(t('wsPreset.loadFailed')); return undefined }
        let alive = true
        Promise.resolve().then(loadRoster).then((roster) => {
          if (!alive) return
          if (!roster || !roster.ok) {
            setStatus('error')
            setErrorText(roster && roster.error ? String(roster.error) : t('wsPreset.loadFailed'))
            return
          }
          // Selector discipline (official preset picker): broken rows drop.
          const list = (Array.isArray(roster.presets) ? roster.presets : [])
            .filter((row) => row && row.id && row.broken !== true)
          setRows(list)
          // Pre-pick the workspace's CURRENT preset, like the official chip
          // shows the live selection; unknown (projection not loaded yet)
          // leaves confirm disabled until the user picks one.
          if (current && list.some((row) => row.id === current)) setPicked(current)
          setStatus('ready')
        }, (reason) => {
          if (!alive) return
          setStatus('error')
          setErrorText(reason instanceof Error ? reason.message : String(reason || t('wsPreset.loadFailed')))
        })
        return () => { alive = false }
      }, [])
      const nameOf = (id) => {
        for (const row of rows) { if (row.id === id) return presetDisplayLabel(row, t) }
        return id
      }
      const options = rows.map((row) => ({
        value: row.id,
        label: presetDisplayLabel(row, t) + (row.isDefault ? ' (' + t('wsPreset.globalDefault') + ')' : ''),
      }))
      const commit = () => {
        if (busy || !picked) { onClose(); return }
        // Picking the CURRENT preset is a no-op: no host round-trip, just close.
        if (picked === current) { onClose(); return }
        setBusy(true)
        setErrorText('')
        Promise.resolve().then(() => applyPreset(picked)).then((result) => {
          if (result && result.ok) { onApplied(); onClose(); return }
          setBusy(false)
          setErrorText(result && result.refusal ? String(result.refusal) : t('wsPreset.loadFailed'))
        }, (reason) => {
          setBusy(false)
          setErrorText(reason instanceof Error ? reason.message : String(reason || t('wsPreset.loadFailed')))
        })
      }
      // No standing draft → the confirm PREPARES one with the picked preset
      // (see the ws-preset menu branch); the hint line spells that out.
      const currentLine = !editable ? t('wsPreset.createHint')
        : current ? t('wsPreset.current') + ': ' + nameOf(current)
          : t('wsPreset.currentUnknown')
      return E(ui.Modal, {
        open: true,
        onClose,
        closeLabel: t('close'),
        title: t('wsPreset.title'),
        footer: E('div', { className: 'bw-modal-actions' },
          E(BTN, { variant: 'outline', onClick: onClose, disabled: busy }, t('cancel')),
          E(BTN, { variant: 'primary', onClick: commit, disabled: busy || !picked || picked === current }, t('confirm')),
        ),
      },
        E('div', { className: 'bw-modal-body' },
          status === 'error' ? E('div', { className: 'bw-error-text', role: 'alert' }, errorText) : null,
          status === 'ready' ? (
            rows.length === 0
              ? E('div', { className: 'bw-hint' }, t('wsPreset.empty'))
              : E('div', { className: 'bw-field' },
                menuReady
                  ? E(MenuPicker, { options, value: picked, onPick: setPicked, t })
                  : E('select', {
                    className: 'bw-input',
                    value: picked,
                    onChange: (e) => setPicked(e.target.value),
                  }, rows.map((row) => {
                    const option = options.find((item) => item.value === row.id)
                    return E('option', { key: row.id, value: row.id }, option ? option.label : row.id)
                  })),
              )
          ) : null,
          E('div', { className: 'bw-hint' }, currentLine),
          status === 'ready' && errorText !== ''
            ? E('div', { className: 'bw-error-text', role: 'alert' }, errorText)
            : null,
        ),
        StyleNode(),
      )
    }

    /**
     * Render crash insurance: dsh boots all-or-nothing (one failed entry
     * fails the whole web boot) and React unmounts the root on an uncaught
     * render error — so our registrations render behind this boundary and a
     * bug degrades to "region renders nothing", never a blank application.
     */
    class QuietBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false }
      }
      static getDerivedStateFromError() {
        return { failed: true }
      }
      componentDidCatch(error, info) {
        console.error('[dsh-better-workspace] render error (region degraded to empty)', error, info)
      }
      render() {
        return this.state.failed ? null : this.props.children
      }
    }




    /* ============================== rows ============================== */

    /** Folder glyph variants from the primitives family (solid / outline / hidden). */
    /**
     * Custom icon value → glyph: legacy slots (solid/outline/none) or any
     * primitives icon name, resolved through ICON_ALIASES so a value persisted
     * before a host renamed its icon set still renders something.
     */
    const iconOf = (mode, expanded) => {
      if (!mode || mode === 'none') return null
      if (mode === 'solid') return icon(expanded ? 'IconFolderOpen16' : 'IconFolderClose16')
      if (mode === 'outline') return icon('IconFolderOpenOutline16')
      return icon(resolveIconName(mode))
    }

    const colorToRgb = (hex) => {
      if (!hex) return null
      const m = /^#?([0-9a-fA-F]{6})$/.exec(hex)
      if (!m) return null
      const v = parseInt(m[1], 16)
      return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
    }
    const rgbToHex = (r, g, b) => '#' + [r, g, b]
      .map(n => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'))
      .join('')

    /* ---------- auto palette slots + theme resolution (v0.25.0, pure) ---------- */
    /**
     * Two palettes, one slot table — the "auto color" of a row is stored as the
     * SLOT TOKEN (`auto:3`), never as a hex. Rendering resolves it against the
     * live theme, so a theme flip re-colours every auto-assigned row with no
     * migration, no rewrite of stored data and no cross-device mismatch (the
     * host settings copy carries the token, and each device paints its own
     * theme). Manual colours stay plain hex and are never touched.
     *
     * APPEND-ONLY, like ICON_CHOICES / ICON_ALIASES: a stored token must keep
     * resolving forever, so never reorder or delete a slot (an out-of-range index
     * clamps to slot 0 rather than rendering nothing).
     *
     * Contrast rule: each slot's LIGHT colour clears WCAG **4.5 (normal-text AA)**
     * against the measured light row surface, and each slot's DARK colour clears
     * 4.5 against the measured dark row surface. Backgrounds are not guesses —
     * they were read off a live instance (see CHANGELOG v0.25.0): light
     * `--dsw-alias-bg-base` #ffffff with a hover/current overlay around #f7f8fa,
     * dark base #151517 with tokens up to #2c2c2e. The pairs below are computed
     * against the CONSERVATIVE ends (#ebedf0 light, #2c2c2e dark), which is why
     * the numbers in the comments sit above 5.0 — on the real surfaces they are
     * higher still. Change a hex ⇒ re-run the contrast test in tests/smoke.mjs.
     */
    const AUTO_COLOR_SLOTS = [
      { name: 'red', light: '#c40d00', dark: '#ff7369' }, // h=4   5.26 / 5.25
      { name: 'amber', light: '#965000', dark: '#f08000' }, // h=32  5.20 / 5.17
      { name: 'lime', light: '#496e00', dark: '#74ad00' }, // h=80  5.10 / 5.12
      { name: 'green', light: '#007330', dark: '#00b54b' }, // h=145 5.12 / 5.12
      { name: 'teal', light: '#006e65', dark: '#00b0a1' }, // h=175 5.24 / 5.13
      { name: 'cyan', light: '#006a85', dark: '#00abd6' }, // h=192 5.27 / 5.17
      { name: 'sky', light: '#0065ad', dark: '#24a4ff' }, // h=205 5.17 / 5.20
      { name: 'blue', light: '#0055e8', dark: '#669eff' }, // h=218 5.17 / 5.24
      { name: 'indigo', light: '#5938ff', dark: '#a28fff' }, // h=250 5.21 / 5.25
      { name: 'violet', light: '#8700fc', dark: '#c480ff' }, // h=272 5.21 / 5.23
      { name: 'magenta', light: '#b50097', dark: '#ff59e3' }, // h=310 5.25 / 5.17
      { name: 'pink', light: '#c40052', dark: '#ff69a7' }, // h=335 5.16 / 5.20
      { name: 'grey', light: '#5e6268', dark: '#9b9ea4' }, // h=220 5.23 / 5.19
    ]
    /** The values the shuffle bag draws — slot tokens, not colours. */
    const AUTO_COLOR_TOKENS = AUTO_COLOR_SLOTS.map((slot, index) => 'auto:' + index)
    const AUTO_TOKEN_RE = /^auto:(\d+)$/
    const isAutoColorToken = (value) => typeof value === 'string' && AUTO_TOKEN_RE.test(value)
    /**
     * Token → hex for one theme. `dark` is explicit so the same function serves
     * rendering (live flag), tests (both themes) and the pickers (preview).
     */
    const resolveAutoColor = (token, dark) => {
      const match = AUTO_TOKEN_RE.exec(typeof token === 'string' ? token : '')
      if (!match) return ''
      const index = Number(match[1])
      // Append-only table: an unknown index clamps to slot 0 instead of painting
      // an invalid CSS colour (a row must never end up colourless by accident).
      const slot = AUTO_COLOR_SLOTS[index] || AUTO_COLOR_SLOTS[0]
      if (!slot) return ''
      return dark === true ? slot.dark : slot.light
    }
    /** Any stored colour value → the hex to paint: tokens resolve, hexes pass. */
    const resolveColorValue = (value, dark) => {
      if (typeof value !== 'string' || value === '') return ''
      return isAutoColorToken(value) ? resolveAutoColor(value, dark === undefined ? autoThemeDarkNow() : dark) : value
    }
    /* ---------- end of the auto palette slot block ---------- */


    /* ------------------- appearance: defaults + outline ------------------- */

    // Text outline. Width and color are DERIVED, never hand-picked: an outline
    // only helps when it contrasts with the label, and the label color is
    // whatever the theme — or a background plugin's light/dark switch — hands
    // us at that moment. contrastStrokeColor() reads the effective font color
    // and returns the opposite pole; rows without a custom color inherit
    // --bw-stroke-color, sampled from the live computed style (see the sampler
    // in BetterBrowser) so a palette flip needs no React render.
    // The slider is the rim the eye actually sees (0.5..2px). strokeStyleOf
    // paints twice that because paint-order hides the inner half of the band.
    const STROKE_MAX = 2
    // The outline color defaults to a plain gray: it reads on light and dark
    // backgrounds alike without shouting like pure black/white. "auto" derives
    // the contrasting pole from the font color instead.
    // Since v0.31.0 the outline SHIPS OFF: on a clean theme it reads as
    // embossed noise, and only a background image ever needed it. The legacy
    // ON default survives for existing installs through readAppearance (the
    // workspaceSlashOf pattern: hydration runs only when a snapshot exists,
    // so a missing appearance record means "this browser predates the flip"
    // and keeps the outline it was built with). Fresh installs never hydrate;
    // createViewStore's init bakes this default into prefs.appearance.
    const DEFAULT_APPEARANCE = { color: '', glow: 0, weight: 0, shadow: false, stroke: false, strokeWidth: 1, strokeColor: '#808080' }
    const APPEARANCE_FIELDS = ['color', 'glow', 'weight', 'shadow', 'stroke', 'strokeWidth', 'strokeColor']
    const clampStrokeWidth = (raw) => {
      const n = Number(raw)
      if (!isFinite(n) || n <= 0) return DEFAULT_APPEARANCE.strokeWidth
      return Math.min(STROKE_MAX, Math.max(0.5, Math.round(n * 2) / 2))
    }
    // Persisted values arrive from older plugin versions and from the other
    // surface: every read tolerates missing keys and falls back to the default
    // (hydration replaces state wholesale — the 0.9.x hard rule). For stroke
    // the fallback is the LEGACY ON, not DEFAULT_APPEARANCE.stroke: a missing
    // key means a snapshot from before v0.31.0, and those builds shipped the
    // outline enabled — an upgrade must not silently restyle an existing tree.
    const readAppearance = (raw) => {
      const src = raw && typeof raw === 'object' ? raw : {}
      return {
        color: typeof src.color === 'string' ? src.color : '',
        glow: Math.max(0, Number(src.glow) || 0),
        weight: Number(src.weight) || 0,
        shadow: src.shadow === true,
        stroke: src.stroke !== false,
        strokeWidth: src.strokeWidth === undefined ? DEFAULT_APPEARANCE.strokeWidth : clampStrokeWidth(src.strokeWidth),
        strokeColor: typeof src.strokeColor === 'string' && src.strokeColor !== '' ? src.strokeColor : DEFAULT_APPEARANCE.strokeColor,
      }
    }
    // A row's own entry overrides the default appearance FIELD BY FIELD, so a
    // row customized before this version (no stroke key) still inherits the
    // effective base — the legacy ON on upgraded installs, the shipped OFF on
    // fresh ones — instead of being reset to a different era's look.
    const mergeAppearance = (base, entry) => {
      if (!entry || typeof entry !== 'object') return readAppearance(base)
      const merged = { ...base }
      for (const field of APPEARANCE_FIELDS) {
        if (entry[field] !== undefined) merged[field] = entry[field]
      }
      return readAppearance(merged)
    }
    const parseCssColor = (css) => {
      const text = String(css || '')
      const rgb = /^rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/.exec(text)
      if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]
      const srgb = /^color\(srgb\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)/.exec(text)
      if (srgb) return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255]
      return null
    }
    const relativeLuminance = (rgb) => {
      const [r, g, b] = rgb.map((channel) => {
        const s = Math.max(0, Math.min(255, Number(channel) || 0)) / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    // WCAG contrast against both poles: the outline takes whichever of black /
    // white stands out more from the label color.
    const contrastStrokeColor = (rgb) => {
      if (!rgb) return '#000000'
      const luminance = relativeLuminance(rgb)
      return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#ffffff'
    }
    const STROKE_FALLBACK = 'var(--bw-stroke-color, rgba(0,0,0,.75))'
    const STROKE_AUTO = 'auto'
    // A picked color wins; "auto" derives the contrasting pole from the row's
    // font color — computed in JS when the row carries one, read from the
    // sampled --bw-stroke-color variable otherwise (so a theme or background
    // plugin flip needs no render).
    const strokeColorOf = (appearance) => {
      const picked = appearance && typeof appearance.strokeColor === 'string' && appearance.strokeColor !== ''
        ? appearance.strokeColor
        : DEFAULT_APPEARANCE.strokeColor
      if (picked === STROKE_AUTO) {
        const fontColor = resolveColorValue(appearance.color)
        const rgb = fontColor ? colorToRgb(fontColor) : null
        return rgb ? contrastStrokeColor(rgb) : STROKE_FALLBACK
      }
      return colorToRgb(picked) ? picked : DEFAULT_APPEARANCE.strokeColor
    }
    // paint-order keeps the stroke UNDER the fill so the glyph does not thin out
    // — the whole point of an outer outline. The price is half the band:
    // -webkit-text-stroke centres it on the outline and the fill covers the inner
    // half, so the painted width must be TWICE the rim the slider promises.
    // Painting the configured value (0.10.x) left a 0.5px rim that antialiasing
    // blended away into a pale, uneven edge.
    //
    // 0.11.1 replaced this with eight offset glyph copies. It measured better and
    // looked worse: eight directions are only four diagonal samples, so every
    // slope and curve came out as a string of detached blocks instead of a filled
    // rim. A geometric stroke is continuous by construction — it really is a path
    // stroke — so the answer is to give it enough width to survive antialiasing,
    // not to fake it out of copies.
    const strokeStyleOf = (appearance) => {
      if (!appearance || appearance.stroke === false) return null
      return {
        WebkitTextStrokeWidth: clampStrokeWidth(appearance.strokeWidth) * 2 + 'px',
        WebkitTextStrokeColor: strokeColorOf(appearance),
        paintOrder: 'stroke fill',
      }
    }

    // dsh 0.2.2-alpha.3 keyboard trigger, mirroring the shared menu's own
    // getTriggerProps: ContextMenu or Shift+F10 opens the row menu and the
    // row itself is reachable with Tab. Kept local (not the official helper)
    // so the SAME openCtx path still owns the target payload and the fallback
    // to the local menu on hosts without the service.
    const menuTriggerProps = (onContextMenu) => typeof onContextMenu !== 'function' ? {} : {
      tabIndex: 0,
      onKeyDown: (event) => {
        if (!event || event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return
        if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return
        event.preventDefault()
        event.stopPropagation()
        try { event.currentTarget.focus() } catch { /* detached row */ }
        onContextMenu(event)
      },
    }

    function FolderRow({ node, depth, expanded, onToggle, onContextMenu, dropInto, dropSlot, dragEvents, custStyle, iconMode, pulse, active, dataRowKey, t }) {
      const total = countWorkspaces(node)
      const iconEl = iconOf(iconMode, expanded)
      // Hidden status dots breathe on the icon; with the icon hidden (mode
      // "none" or a missing primitive) the official StateDot stands in.
      const iconChild = pulse
        ? E(PulseGlow, { state: pulse }, iconEl || (typeof ui.StateDot === 'function' ? E(ui.StateDot, { state: pulse, size: 10 }) : null))
        : iconEl
      return E('div', {
        // v0.36.4: an edge band opens the EMPTY reorder slot immediately —
        // the row grows by one row height on the dropped side, so the
        // insertion point is a real gap the block slides into (the user
        // report: a thin line is not "撑开让位").
        className: cls('bw-row', 'bw-container-row',
          dropSlot === 'before' && 'bw-slot-above',
          dropSlot === 'after' && 'bw-slot-below',
          dropInto && 'bw-drop-into', dropInto && 'bw-drop-into-strong'),
        'data-row-key': dataRowKey,
        style: { '--bw-indent': (depth * 12) + 'px', ...(custStyle || {}), ...(pulse ? { '--bw-pulse-color': PULSE_COLORS[pulse] || PULSE_COLORS.ongoing } : null) },
        onClick: onToggle,
        onContextMenu: onContextMenu,
        role: 'treeitem',
        'aria-expanded': expanded,
        ...(dragEvents || {}),
        ...menuTriggerProps(onContextMenu),
      },
        // Official projectRow duality (Rows.module.css): the chevron hides
        // until hover, swapping in for the folder glyph; the arrow spins
        // open with the row.
        E('span', { className: cls('bw-chevron', expanded && 'bw-chevron-open') }, E('span', { className: 'bw-arrow' }, icon('IconTriangleRightFill14', 14))),
        E('span', { className: cls('bw-row-icon', 'bw-folder-cell', active && !pulse && 'bw-folder-active') }, iconChild),
        // A row that already carries a custom label glow breathes in sync.
        E('span', { className: cls('bw-row-label', pulse && custStyle && custStyle.textShadow && 'bw-pulse-text') }, node.name),
        total > 0 ? E('span', { className: 'bw-row-count' }, String(total)) : null,
      )
    }

    function WorkspaceRow({ workspace, depth, count, sessionsOpen, onToggle, onStart, onContextMenu, currentInside, menuOpen, dropHalf, dropInto, dragEvents, custStyle, iconMode, pulse, newSessionLabel, newSessionAria, hoverBody, dataRowKey, t }) {
      const iconEl = iconOf(iconMode, sessionsOpen)
      const iconChild = pulse
        ? E(PulseGlow, { state: pulse }, iconEl || (typeof ui.StateDot === 'function' ? E(ui.StateDot, { state: pulse, size: 10 }) : null))
        : iconEl
      let row = E('div', {
        // v0.36.4: workspace rows open the same empty reorder slot a group
        // row does (the official 12px insert line alone read as "没撑开").
        // The half split is judged in LOGICAL height, so the grown row
        // cannot flip its own band under the pointer.
        className: cls('bw-row', 'bw-container-row', currentInside && 'bw-row-current', menuOpen && 'menu-open', dropHalf === 'before' && 'bw-slot-above', dropHalf === 'after' && 'bw-slot-below', dropInto && 'bw-drop-into', dropInto && 'bw-drop-into-strong'),
        'data-row-key': dataRowKey,
        style: { '--bw-indent': (depth * 12) + 'px', ...(custStyle || {}), ...(pulse ? { '--bw-pulse-color': PULSE_COLORS[pulse] || PULSE_COLORS.ongoing } : null) },
        onClick: onToggle,
        onContextMenu: onContextMenu,
        role: 'treeitem',
        'aria-expanded': sessionsOpen,
        ...(dragEvents || {}),
        ...menuTriggerProps(onContextMenu),
      },
        // Official projectRow duality (Rows.module.css): the chevron hides
        // until hover, swapping in for the folder glyph; the arrow spins
        // open with the row; a subtree holding the current session tints
        // the folder glyph blue (folderActive), not the whole row.
        E('span', { className: cls('bw-chevron', sessionsOpen && 'bw-chevron-open') }, E('span', { className: 'bw-arrow' }, icon('IconTriangleRightFill14', 14))),
        E('span', { className: cls('bw-row-icon', 'bw-folder-cell', currentInside && !pulse && 'bw-folder-active') }, iconChild),
        E('span', { className: cls('bw-row-label', pulse && custStyle && custStyle.textShadow && 'bw-pulse-text'), title: workspace.title || workspace.leaf }, workspace.leaf),
        count > 0 ? E('span', { className: 'bw-row-count' }, String(count)) : null,
        // The in-row ellipsis is retired (mirrors the session-row decision):
        // the ctx surface is the right-click path; hover keeps only the
        // new-session affordance.
        E('span', { className: 'bw-row-actions', onClick: (e) => e.stopPropagation() },
          E('button', {
            type: 'button',
            className: 'bw-row-btn',
            'aria-label': newSessionLabel || t('session.new'),
            'aria-keyshortcuts': newSessionAria,
            title: newSessionLabel || t('session.new'),
            onClick: (e) => { e.stopPropagation(); onStart() },
          }, icon('IconNewChatOutline16')),
        ),
      )
      // Official workspace hover card (Rows.tsx WorkspaceHoverContent): the
      // full label plus the abbreviated path. Workspace rows carry no
      // createdAt here, so the created line is absent.
      if (typeof ui.HoverCard === 'function' && typeof hoverBody === 'function') {
        row = E(ui.HoverCard, { key: 'hover', anchor: row, content: hoverBody(workspace), openDelayMs: 800, grouped: true })
      }
      return row
    }

    // Official status priority: pending interaction > running > running
    // subagents > completed reminder; idle rows show no dot at all.
    const sessionStateOf = (row) => {
      if (!row) return null
      if (row.pending === 'approval' || row.pending === 'plan-review' || row.pending === 'question') return 'warning'
      if (row.running || row.subagents > 0) return 'ongoing'
      if (row.completed) return 'done'
      return null
    }

    /**
     * Status breathing light (preference-controlled, default ON): status dots
     * hidden by a collapse bubble outward to the nearest visible container
     * row. Workspace/folder rows breathe on their icon (drop-shadow glow in
     * the status color; a hidden/no icon falls back to the official StateDot);
     * session-group rows carry a breathing StateDot in front of the label.
     * Colors mirror the official dots: warning amber > ongoing blue > done
     * green, so the glow always matches the lamp it relays.
     */
    const PULSE_RANK = { warning: 3, ongoing: 2, done: 1 }
    const PULSE_COLORS = { warning: '#d29922', ongoing: '#5b8def', done: '#3fb950' }
    const pulseRank = (state) => (state ? (PULSE_RANK[state] || 0) : 0)

    function PulseGlow({ state, children }) {
      return E('span', {
        className: 'bw-pulse',
        style: { '--bw-pulse-color': PULSE_COLORS[state] || PULSE_COLORS.ongoing },
      }, children)
    }

    // RUNNING deliberately stays on the session row itself (its official ring
    // breathes blue there) and does NOT bubble outward — the user found the
    // ongoing relay noisy. Only pending-amber and done-green propagate.
    const relayStateOf = (row) => {
      const s = sessionStateOf(row)
      return s === 'ongoing' ? null : s
    }

    // Official title marquee (Rows.tsx useTitleMarquee): on hover an
    // overflowing title scrolls at the shipped constant speed so the hidden
    // tail becomes readable; scroll progress is exposed through data
    // attributes that drive the CSS edge-fade masks. Reduced motion jumps
    // straight to the end; leaving the row resets instantly.
    const MIN_TITLE_REVEAL_PX = 8
    const TITLE_MARQUEE_PX_PER_MS = 0.03
    const marqueePlace = (title, left, range) => {
      if (!title) return
      if (typeof title.scrollTo === 'function') title.scrollTo({ left, behavior: 'instant' })
      else title.scrollLeft = left
      if (left > 0) title.dataset.scrolled = ''
      else delete title.dataset.scrolled
      if (left < range) title.dataset.clipped = ''
      else delete title.dataset.clipped
    }
    function useTitleMarquee() {
      const titleRef = React.useRef(null)
      const frameRef = React.useRef(0)
      React.useEffect(() => () => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current)
        frameRef.current = 0
      }, [])
      const onPointerEnter = () => {
        const title = titleRef.current
        if (!title) return
        const range = title.scrollWidth - title.clientWidth
        if (!(range > MIN_TITLE_REVEAL_PX)) return
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          marqueePlace(title, range, range)
          return
        }
        let position = 0
        let previous = performance.now()
        const step = (timestamp) => {
          position = Math.min(position + (timestamp - previous) * TITLE_MARQUEE_PX_PER_MS, range)
          previous = timestamp
          marqueePlace(titleRef.current, position, range)
          if (position < range) frameRef.current = requestAnimationFrame(step)
        }
        frameRef.current = requestAnimationFrame(step)
      }
      const onPointerLeave = () => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current)
        frameRef.current = 0
        const title = titleRef.current
        if (!title) return
        marqueePlace(title, 0, 0)
        delete title.dataset.scrolled
        delete title.dataset.clipped
      }
      return { titleRef, onPointerEnter, onPointerLeave }
    }

    function SessionRow({ node, depth, current, onOpen, onContextMenu, now, dropHalf, dragEvents, custStyle, breathing, sessionActions, scheduleSeat, dataRowKey, t }) {
      const state = sessionStateOf(node)
      const status = state === null ? null : {
        state,
        title: state === 'warning'
          ? t('status.' + (node.pending === 'plan-review' ? 'planReview' : node.pending))
          : state === 'ongoing'
            ? (node.running ? t('status.running') : t('status.subagents', { n: node.subagents }))
            : t('status.completed'),
      }
      // Ambient Schedule mark, two host generations, exactly one of them live:
      // · dsh 0.1.7-rc.2+ — the shipped row's leading seat
      //   (`sidebar.session.row.leading`), declared by an entry this seat
      //   shadows, so its occupant is rendered here (see scheduleSeatOf). The
      //   shipped rule holds: the cell belongs to the mark only while the row's
      //   own primary state is idle — a status dot and a seat occupant never
      //   share it — and an archived or blank row keeps the cell empty.
      // · up to 0.1.7-rc.1 — the active-Schedule list projection, which rc.2
      //   deleted; the legacy badge below still serves those hosts, and its
      //   `!markNode` gate is what keeps the two marks from ever doubling up.
      const markNode = scheduleSeat && !status && !node.archived && !node.blank
        ? E(QuietBoundary, { key: 'schedule-seat' }, E(ShippedSeatOccupant, {
          seat: scheduleSeat,
          ownerProps: { sessionId: node.id },
          standardProps: sessionActions ? sessionActions.standardProps : null,
          t: scheduleSeat.t,
        }))
        : null
      // Official alpha.2 row-trailing strip: a list seat nested INSIDE the
      // row, between the time cell and the pin marker, hidden while the hover
      // actions show. Officially populated by the experimental worktree/PR
      // icon; rendering it here keeps that surface visible in our sidebar.
      const trailingSeats = sessionActions && Array.isArray(sessionActions.trailingSeat)
        ? sessionActions.trailingSeat
        : []
      const trailingNode = !node.blank && trailingSeats.length > 0
        ? E('span', { className: 'bw-row-trailing' }, trailingSeats.map((seat, index) => E(QuietBoundary, {
          key: 'trailing-seat-' + index,
        }, E(ShippedSeatOccupant, {
          seat,
          ownerProps: { sessionId: node.id },
          standardProps: sessionActions ? sessionActions.standardProps : null,
          t: seat.t,
        }))))
        : null
      // Official mirror surface (dsh 0.1.7 Rows.tsx): pinned rows carry the
      // pin marker; archived rows render grayed and never open; the hover
      // strip hosts the "..." trigger and the pin/archive quick buttons.
      // The strip replaces the time cell on hover exactly like the official
      // row, and its clicks never reach the row (stopPropagation).
      const ot = sessionActions ? sessionActions.ot : null
      const official = (key, params) => {
        if (typeof ot !== 'function') return null
        const value = ot(key, params)
        return typeof value === 'string' && value !== '' && value !== key ? value : null
      }
      const archivedTitle = official('row.archived')
      const pinnedTitle = official('row.pinned')
      // Row-trailing quick actions: the shipped row.action seat renders the
      // OFFICIAL pin/archive buttons; our own fallback buttons render only
      // where the seat has no entries, so the row never shows two sets. The
      // in-row "..." menu (added v0.34.0) is RETIRED (issue #12): the context
      // menu already carries every entry, and the menu.item occupants depend
      // on slot-level inject hooks (useShortcuts on 0.2.1-rc.2) that an
      // in-row reproduction cannot supply — one missing hook took the whole
      // sidebar down. Each seat occupant sits in a QuietBoundary so a broken
      // seat degrades to a missing button, never a blank panel.
      const quickSeatUsed = Array.isArray(sessionActions.rowActionSeat) && sessionActions.rowActionSeat.length > 0
      const strip = !node.blank && sessionActions && sessionActions.quick && (quickSeatUsed || sessionActions.pin || sessionActions.archive)
        ? E('span', { className: 'bw-row-actions', onClick: (e) => e.stopPropagation() },
            quickSeatUsed
              ? sessionActions.rowActionSeat.map((seat, index) => E(QuietBoundary, { key: 'row-action-seat-' + index },
                E(ShippedSeatOccupant, {
                  key: 'row-action-seat-' + index,
                  seat,
                  ownerProps: { sessionId: node.id, displayTitle: node.leaf || node.title },
                  standardProps: sessionActions.standardProps,
                  t: seat.t,
                })))
              : null,
            !quickSeatUsed && sessionActions.pin && !node.archived ? E('button', {
              type: 'button',
              className: 'bw-icon-btn',
              'aria-label': official(node.pinned ? 'menu.unpinSession' : 'menu.pinSession') || '',
              title: official(node.pinned ? 'actions.unpin' : 'actions.pin') || undefined,
              onClick: (e) => { e.stopPropagation(); sessionActions.pin(node.id, !node.pinned) },
            }, icon(node.pinned ? 'IconPinFillRegular' : 'IconPinOutlineRegular', 14)) : null,
            !quickSeatUsed && sessionActions.quick && sessionActions.archive ? E('button', {
              type: 'button',
              className: 'bw-icon-btn',
              'aria-label': official(node.archived ? 'menu.unarchiveSession' : 'menu.archiveSession') || '',
              title: official(node.archived ? 'actions.unarchive' : 'actions.archive') || undefined,
              onClick: (e) => { e.stopPropagation(); sessionActions.archive(node.id, !node.archived) },
            }, icon(node.archived ? 'IconUnarchiveOutlineRegular' : 'IconArchiveOutline20', 14)) : null,
          )
        : null
      const marquee = useTitleMarquee()
      const title = node.leaf || node.title
      // Official HoverCard (Rows.tsx 693-703): the row is its own anchor; the
      // card yields while the row menu is open. Title copy rides the official
      // copy/copyLabels; a blank row copies nothing (official rule).
      const hoverCard = typeof ui.HoverCard === 'function' && sessionActions && typeof sessionActions.hoverBody === 'function'
      let row = E('div', {
        className: cls('bw-row', 'bw-session-row', current && 'bw-row-current',
          node.archived && 'bw-row-archived',
          dropHalf === 'before' && 'bw-drop-before', dropHalf === 'after' && 'bw-drop-after'),
        'data-row-key': dataRowKey,
        style: { '--bw-indent': (depth * 12) + 'px', ...(custStyle || {}) },
        onClick: () => {
          if (node.archived) {
            // Official semantics (guardedOpen): an archived row is not
            // openable — the click explains instead of navigating.
            if (sessionActions && typeof sessionActions.explainArchived === 'function') sessionActions.explainArchived()
            return
          }
          onOpen(node.id)
        },
        onDoubleClick: node.blank ? undefined : (e) => {
          // Official rename affordance (Rows.tsx title onDoubleClick): the
          // double click never reaches the row's open handler.
          e.stopPropagation()
          if (sessionActions && typeof sessionActions.rename === 'function') sessionActions.rename(node)
        },
        onPointerEnter: marquee.onPointerEnter,
        onPointerLeave: marquee.onPointerLeave,
        onContextMenu: onContextMenu,
        role: 'treeitem',
        'aria-description': node.archived ? archivedTitle || undefined : undefined,
        ...(dragEvents || {}),
        ...menuTriggerProps(onContextMenu),
      },
        E('span', { className: 'bw-row-icon', title: status ? status.title : undefined },
          status && typeof ui.StateDot === 'function'
            ? (state === 'ongoing' && breathing
              // Running breathes blue ON the session row only (never relays);
              // the settings toggle covers this breathing too. The dot takes
              // its official size (14px spinner / 10px lamp), inside the
              // fixed 16px leading cell.
              ? E(PulseGlow, { state: 'ongoing' }, E(ui.StateDot, { state: status.state }))
              : E(ui.StateDot, { state: status.state }))
            : (markNode || E('span', { className: 'bw-dot' })),
        ),
        E('span', { className: 'bw-row-label', ref: marquee.titleRef }, title),
        // Legacy projection mark (see markNode): only ever renders where the
        // shipped seat does not exist, so the row never shows two marks.
        node.hasActiveSchedule && !markNode
          ? E('span', { className: 'bw-schedule-badge', role: 'img', 'aria-label': t('schedule.active'), title: t('schedule.active') }, icon('IconAlarmClockOutline16', 14))
          : null,
        // Official blank rows carry no time, no pin, no actions (a standing
        // "new session" placeholder, not a session).
        !node.blank ? E('span', { className: 'bw-row-time' }, timeLabel(node.updatedAt, now, t)) : null,
        trailingNode,
        !node.blank && node.pinned ? E('span', { className: 'bw-pin-indicator', role: 'img', 'aria-label': pinnedTitle || undefined, title: pinnedTitle || undefined }, icon('IconPinFillRegular', 13)) : null,
        strip,
      )
      if (hoverCard) {
        const copyText = node.blank || title === '' ? undefined : title
        const copyLabel = official('copy')
        const copiedLabel = official('hover.copied')
        row = E(ui.HoverCard, Object.assign({
          key: 'hover',
          anchor: row,
          content: sessionActions.hoverBody(node, status, state),
          openDelayMs: 800,
          grouped: true,
          // copyText present REQUIRES both labels (primitives HoverCard
          // contract): copy only renders where the official copy survives.
        }, copyText && copyLabel && copiedLabel ? { copyText, copyLabel, copiedLabel } : {}))
      }
      return row
    }

    /**
     * Session sub-group inside a workspace (same "/" convention on session
     * titles). Deliberately NOT styled like a workspace folder — no folder
     * icon, tertiary color — so a session level never reads as a workspace.
     */
    function SessionGroupRow({ name, depth, expanded, count, onToggle, onContextMenu, dropInto, dragEvents, custStyle, pulse, dataRowKey, t }) {
      return E('div', {
        className: cls('bw-row', 'bw-sgroup-row', dropInto && 'bw-drop-into', dropInto && 'bw-drop-into-strong'),
        'data-row-key': dataRowKey,
        style: { '--bw-indent': (depth * 12) + 'px', ...(custStyle || {}) },
        onClick: onToggle,
        onContextMenu: onContextMenu,
        role: 'treeitem',
        'aria-expanded': expanded,
        ...(dragEvents || {}),
        ...menuTriggerProps(onContextMenu),
      },
        // Session groups are a plugin concept: their chevron stays visible
        // (only the official container rows hide it until hover).
        E('span', { className: cls('bw-chevron', expanded && 'bw-chevron-open') }, E('span', { className: 'bw-arrow' }, icon('IconTriangleRightFill14', 14))),
        // Session groups have no icon slot: a collapsed group with hidden
        // status relays through a breathing official StateDot instead.
        pulse ? E(PulseGlow, { state: pulse }, typeof ui.StateDot === 'function' ? E(ui.StateDot, { state: pulse, size: 10 }) : null) : null,
        E('span', { className: 'bw-row-label' }, name),
        count > 0 ? E('span', { className: 'bw-row-count' }, String(count)) : null,
      )
    }

    /* ------------------------- view options menu ---------------------- */

    /**
     * View options (v0.13): mirrors the official browser's ViewOptionsMenu —
     * primitives Menu, label/separator/selectedIds structure, portal + dense
     * + end alignment. Group/order picks close the menu; the two slash
     * toggles flip in place (they ride selectedIds: present = on) and stay
     * open. Options that cannot affect the current mode render disabled:
     * slash toggles mean nothing in the flat list, and the WORKSPACE-name
     * toggle only shapes the tree mode (the flat workspace level has no
     * name layer). The primitives Menu is feature-probed like every
     * component — without it the button simply never renders.
     */
    function ViewOptionsMenu({ groupBy, orderBy, sessionSlash, archivedFilter, workspaceGroupMode, onPick, onToggle, onFilterPick, onWsGroupPick, ot, t }) {
      const [open, setOpen] = React.useState(false)
      if (typeof ui.Menu !== 'function') return null
      // Archived filter (dsh 0.1.7 official ViewOptionsMenu mirror): the
      // section rides the OFFICIAL dictionary — when the host's 'workspace'
      // dictionary lacks the keys (pre-filter hosts) the whole section stays
      // hidden, matching that host's native menu. ot(key) returns the key
      // itself for a missing entry, which is the detection.
      const official = (key) => {
        if (typeof ot !== 'function') return null
        const value = ot(key)
        return typeof value === 'string' && value !== '' && value !== key ? value : null
      }
      const filterLabel = official('filterBy.label')
      const hideLabel = official('viewOptions.hideArchived')
      const showLabel = official('viewOptions.showArchived')
      const onlyLabel = official('viewOptions.onlyArchived')
      // rc.2 turns the filter into three explicit radio-style picks (hide /
      // show / only) and names the default one; pre-rc.2 hosts only ship the
      // two toggles, where re-picking the selected item returns to the default
      // view. The presence of the hide label is the era probe, and the icons
      // follow the same generation split (the rc.2 glyphs are absent earlier).
      const threeState = hideLabel !== null
      const hasFilter = filterLabel !== null && showLabel !== null && onlyLabel !== null
        && typeof onFilterPick === 'function'
      const filter = archivedFilter === 'show' || archivedFilter === 'only' ? archivedFilter : 'default'
      return E(ui.Menu, {
        open,
        onClose: () => { setOpen(false) },
        items: [
          { type: 'label', id: 'bw-group-by', text: t('viewOptions.groupBy') },
          { id: 'workspace', label: t('viewOptions.byWorkspace') },
          { id: 'workspace-tree', label: t('viewOptions.byWorkspaceTree') },
          { id: 'flat', label: t('viewOptions.flat') },
          { type: 'separator', id: 'bw-order-sep' },
          { type: 'label', id: 'bw-order-by', text: t('viewOptions.orderBy') },
          { id: 'manual', label: t('viewOptions.manualOrder') },
          { id: 'updated', label: t('viewOptions.updatedOrder') },
          ...(hasFilter ? [
            { type: 'separator', id: 'bw-filter-sep' },
            { type: 'label', id: 'bw-filter-by', text: filterLabel },
            ...(threeState ? [{ id: 'hide-archived', label: hideLabel, icon: icon('IconArchiveOffOutlineRegular', 16) }] : []),
            { id: 'show-archived', label: showLabel, icon: icon(threeState ? 'IconQueueOutlineRegular' : 'IconArchiveOutline20', 16) },
            { id: 'only-archived', label: onlyLabel, icon: icon('IconArchiveCheckOutlineRegular', 16) },
          ] : []),
          { type: 'separator', id: 'bw-wsgroup-sep' },
          // Issue #7 grouping strategy (v0.21.0): the same tri-state the
          // settings card drives; both faces read and write the one store
          // key. Meaningless without the tree, so flat mode disables it.
          { type: 'label', id: 'bw-ws-group-by', text: t('viewOptions.wsGroupBy') },
          { id: 'ws-disk', label: t('viewOptions.wsByDisk'), disabled: groupBy === 'flat' },
          { id: 'ws-disk-slash', label: t('viewOptions.wsByDiskSlash'), disabled: groupBy === 'flat' },
          { id: 'ws-slash', label: t('viewOptions.wsBySlash'), disabled: groupBy === 'flat' },
          { type: 'separator', id: 'bw-slash-sep' },
          // Session grouping keeps its v0.13 toggle here; the workspace name
          // layer gained the strategy section above in v0.21.0.
          { id: 'session-slash', label: t('viewOptions.sessionSlash'), disabled: groupBy === 'flat' },
        ],
        selectedIds: [groupBy, orderBy]
          .concat(sessionSlash ? ['session-slash'] : [])
          // rc.2 keeps exactly one filter pick selected (the default one is a
          // real item); the pre-rc.2 pair only shows a selection when it is on.
          .concat(filter === 'show' ? ['show-archived'] : filter === 'only' ? ['only-archived'] : (threeState ? ['hide-archived'] : []))
          .concat(workspaceGroupMode === 'disk' ? ['ws-disk'] : [])
          .concat(workspaceGroupMode === 'disk-slash' ? ['ws-disk-slash'] : [])
          .concat(workspaceGroupMode === 'slash' ? ['ws-slash'] : []),
        onSelect: (id) => {
          if (id === 'workspace' || id === 'workspace-tree' || id === 'flat') { onPick('groupBy', id); setOpen(false); return }
          if (id === 'manual' || id === 'updated') { onPick('orderBy', id); setOpen(false); return }
          if (id === 'hide-archived') { onFilterPick('default'); setOpen(false); return }
          if (id === 'show-archived') { onFilterPick(threeState ? 'show' : (filter === 'show' ? 'default' : 'show')); setOpen(false); return }
          if (id === 'only-archived') { onFilterPick(threeState ? 'only' : (filter === 'only' ? 'default' : 'only')); setOpen(false); return }
          if (id === 'ws-disk' || id === 'ws-disk-slash' || id === 'ws-slash') { onWsGroupPick(id.slice(3)); setOpen(false); return }
          if (id === 'session-slash') { onToggle('sessionTitleSlash', !sessionSlash); return }
        },
        align: 'end',
        dense: true,
        portal: true,
        anchor: E('button', {
          type: 'button',
          className: 'bw-icon-btn',
          'aria-label': t('viewOptions.label'),
          title: t('viewOptions.label'),
          onClick: () => { setOpen(v => !v) },
        }, icon('IconPersonalizationOutline16')),
      })
    }

    /* --------------------- customization dialog ----------------------- */

    const SWATCHES = ['', '#5b8def', '#3fb950', '#d29922', '#f85149', '#a371f7', '#39c5cf', '#ec6cb9', '#ff9f45', '#6e7681']
    // Outline-color presets: gray (the default), black, white, brand blue — the
    // native picker next to them covers everything else, and "auto" derives the
    // contrasting pole from the font color.
    const STROKE_PRESETS = ['#808080', '#000000', '#ffffff', '#5b8def']
    const GLOW_MAX = 14
    const ICON_CHOICES = [
      'solid', 'outline', 'none',
      'IconProjectAddOutline16', 'IconBranchOutline16', 'IconArchiveOutline20', 'IconCodeOutline16',
      'IconDataOutline16', 'IconGoalOutline16', 'IconGlobeOutline14', 'IconInspectOutline12',
      'IconCopyOutline16', 'IconLinkOutline16', 'IconListPenOutline16', 'IconChecklistOutline14',
      'IconBrowseOutline16', 'IconDownloadOutline16', 'IconContextInjectionOutline16',
      'IconCordisPluginOutline14', 'IconApiOutline14', 'IconAgentPresetOutline16', 'IconEnhanceOutline16',
      'IconSkillOutline16', 'IconSparkle16', 'IconNewChatOutline16',
      'IconCheckOutline14', 'IconCheckOutline16', 'IconChevronDownOutline14', 'IconChevronLeftOutline14',
      'IconChevronRightOutline14', 'IconChevronUpOutline14', 'IconCloseOutline16', 'IconDarkOutline16',
      'IconEditOutline16', 'IconFolderClose16', 'IconFolderOpen16',
      'IconFolderOpenOutline16', 'IconFullscreenOutline16', 'IconLightOutline16', 'IconLinkOutline14',
      'IconLoadingOutline16', 'IconPanelLeftOutline16', 'IconPaperclipOutline16', 'IconPersonalizationOutline16',
      'IconPlayOutline16', 'IconPauseOutline16', 'IconPlusOutline16', 'IconQuestionOutline14',
      'IconQueueOutline14', 'IconRefreshOutline14', 'IconRefreshOutline16', 'IconRightUpOutline14',
      'IconSearchOutline16', 'IconSendOutline14', 'IconSettingsOutline14',
      'IconSettingsOutline16', 'IconShareOutline16', 'IconStopFill16', 'IconThinkOutline14',
      'IconThinkOutline16', 'IconTrashOutline16', 'IconUserOutline16', 'IconWarningOutline16',
      'IconLikeOutline16', 'IconDislikeOutline16', 'IconFollowsystemOutline16',
      'IconAlarmClockOutline16', 'IconClockOutline16', 'IconDatabaseOutline16',
      // Added with dsh 0.1.6-alpha.1 — absent on older hosts, where the picker
      // filters them out (see ICON_PICKER_CHOICES).
      'IconPaperPlaneOutline14', 'IconShieldOutline16', 'IconPlanOutline14',
      'IconWrapLinesOutline16', 'IconCompactOutline16',
      // dsh 0.1.7 generation (resolveIconName filters them out on older
      // hosts): the renamed set added pin/archive-check/tree/list glyphs the
      // native browser now ships. Historical names above resolve through the
      // Regular/Medium generation fallback, so both spellings coexist here.
      'IconPinOutlineRegular', 'IconPinFillRegular', 'IconSlidersTwoOutlineRegular',
      'IconArchiveCheckOutlineRegular', 'IconUnarchiveOutlineRegular',
      'IconWorkspaceTreeOutlineRegular', 'IconFlatListOutlineRegular',
      'IconChevronsUpDownOutlineRegular', 'IconGaugeOutlineRegular',
      'IconInfoOutlineRegular', 'IconWarningTriangleOutlineRegular',
      'IconCompareSplitOutlineRegular', 'IconPluginPinwheelOutlineRegular',
      'IconMicrophoneOutlineRegular', 'IconSendOutlineRegular',
      'IconTreeCornerRegular', 'IconDeliverDocRegular', 'IconWrapFillRegular',
      // dsh 0.1.7-rc.1 added the users pair (agent-team / subagent surfaces);
      // committed here first and filtered on hosts that lack them.
      'IconUsersOutlineRegular', 'IconUsersOutlineMedium',
    ]

    /**
     * What the picker actually offers on THIS host: every legacy slot, plus the
     * primitives this page's icon module really exports, deduped by resolved
     * name so a retired alias can never double a cell. Computed once — the icon
     * module is fixed for the lifetime of the page.
     */
    const ICON_PICKER_CHOICES = (() => {
      const seen = new Set()
      return ICON_CHOICES.filter((mode) => {
        if (mode === 'solid' || mode === 'outline' || mode === 'none') return true
        const name = resolveIconName(mode)
        if (name === '' || seen.has(name)) return false
        seen.add(name)
        return true
      })
    })()

    /* ========= theme-aware auto appearance for NEW items (v0.25.0) ========= */

    /**
     * Live light/dark signal. The shipped theme runtime toggles the BOOLEAN
     * attribute `data-ds-dark-theme` on <body>
     * (packages/client/ui-theme/src/boot-theme.ts), so that attribute — not a
     * luminance guess and not `prefers-color-scheme` (the host resolves `system`
     * itself and may disagree with the OS) — is the authority.
     *
     * A module-level store lets every row re-render on a flip without threading a
     * prop through the tree, and it keeps the pure resolvers below testable:
     * they take the flag as an argument.
     */
    let autoThemeDark = false
    const autoThemeListeners = new Set()
    let autoThemeObserver = null
    const readThemeDark = () => {
      try { return document.body.hasAttribute('data-ds-dark-theme') === true } catch (error) { return false }
    }
    // getSnapshot must stay cheap and stable: a boolean read per render.
    const autoThemeDarkNow = () => {
      const next = readThemeDark()
      if (next !== autoThemeDark) autoThemeDark = next
      return autoThemeDark
    }
    const subscribeAutoTheme = (listener) => {
      autoThemeListeners.add(listener)
      if (autoThemeObserver === null) {
        autoThemeDarkNow()
        try {
          autoThemeObserver = new MutationObserver(() => {
            const next = readThemeDark()
            if (next === autoThemeDark) return
            autoThemeDark = next
            for (const fn of [...autoThemeListeners]) {
              try { fn() } catch (error) { /* a listener must never break the flip */ }
            }
          })
          autoThemeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
        } catch (error) { autoThemeObserver = undefined }
      }
      return () => { autoThemeListeners.delete(listener) }
    }
    /** Subscribe a component to the theme flip (rows repaint with the other pool). */
    const useAutoThemeDark = () => {
      if (typeof React.useSyncExternalStore !== 'function') return autoThemeDarkNow()
      return React.useSyncExternalStore(subscribeAutoTheme, autoThemeDarkNow, autoThemeDarkNow)
    }


    /**
     * Icon pool of the same toggle: names from the EXISTING candidate list
     * (ICON_CHOICES), so the set stays the host's own and the runtime filter
     * below drops whatever this host does not export — exactly like the icon
     * picker. Legacy folder modes (solid/outline) and 'none' stay out: the
     * point is a visible, distinct glyph per item.
     */
    const AUTO_ICON_POOL = [
      'IconBranchOutline16', 'IconCodeOutline16', 'IconDataOutline16', 'IconGoalOutline16',
      'IconGlobeOutline14', 'IconListPenOutline16', 'IconChecklistOutline14', 'IconBrowseOutline16',
      'IconDownloadOutline16', 'IconApiOutline14', 'IconSkillOutline16', 'IconSparkle16',
    ]

    /** How many recent draws the next draw tries to avoid (per pool). */
    const AUTO_RECENT_WINDOW = 3

    /** Fisher-Yates on a copy; `random` is injectable so tests are deterministic. */
    const autoShuffle = (list, random) => {
      const out = list.slice()
      for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(random() * (i + 1))
        const swap = out[i]
        out[i] = out[j]
        out[j] = swap
      }
      return out
    }

    /**
     * Draw-without-replacement drawer: a shuffled BAG per pool, refilled with
     * the pool minus the last AUTO_RECENT_WINDOW draws. One bag cycle never
     * repeats a value, and the refill keeps a value from coming back
     * immediately after the cycle boundary — consecutive new items therefore
     * look clearly different, which pure Math.random() would not guarantee.
     * Colors and icons draw from independent bags. (Pure; unit-tested.)
     * @param colors - fixed color pool.
     * @param icons - fixed icon pool (already filtered for this host).
     * @param random - [0,1) source, defaults to Math.random.
     * @returns `{ nextColor(), nextIcon() }`, each null when its pool is empty.
     */
    const createAutoStyler = (colors, icons, random = Math.random) => {
      const bags = { color: [], icon: [] }
      const recent = { color: [], icon: [] }
      const draw = (kind, pool) => {
        if (!Array.isArray(pool) || pool.length === 0) return null
        if (bags[kind].length === 0) {
          const blocked = new Set(recent[kind])
          const fresh = pool.filter((value) => !blocked.has(value))
          bags[kind] = autoShuffle(fresh.length > 0 ? fresh : pool.slice(), random)
          recent[kind] = []
        }
        const value = bags[kind].pop()
        recent[kind].push(value)
        while (recent[kind].length > AUTO_RECENT_WINDOW) recent[kind].shift()
        return value
      }
      return {
        nextColor: () => draw('color', colors),
        nextIcon: () => draw('icon', icons),
      }
    }

    /* ------------------ end of the pure auto-style block ------------------ */

    /** What this host can actually render, resolved once (the icon set is fixed per page). */
    const AUTO_ICON_CHOICES = AUTO_ICON_POOL.filter((name) => resolveIconName(name) !== '')
    // The bag draws SLOT TOKENS (not colours): the same draw stays valid in both
    // themes, so a theme flip never invalidates the recent-draw window.
    const autoStyler = createAutoStyler(AUTO_COLOR_TOKENS, AUTO_ICON_CHOICES)

    /**
     * Appearance controls shared by the per-row dialog and the settings card's
     * "default appearance" section: color, glow, weight, shadow, the text
     * outline (on/off + width + color) and — where the row actually renders
     * one — the folder glyph. Since v0.10.1 the outline color is a normal
     * choice (presets + picker, gray by default); "auto" is the mode that
     * derives the contrasting pole from the effective font color, so a palette
     * flip keeps working without a re-render.
     */
    function AppearanceControls({ value, onChange, allowIcon, t }) {
      const appearance = readAppearance(value)
      // Subscribe to the theme flip: a row may carry an `auto:N` token, and the
      // controls must show/preview the colour that token paints right now.
      useAutoThemeDark()
      // Displayed/every control below uses the RESOLVED hex; the raw value stays
      // in the draft, so committing without touching the colour keeps the token
      // (and with it the theme-following behaviour).
      const color = resolveColorValue(appearance.color || '')
      const glow = appearance.glow
      const weight = appearance.weight
      const shadow = appearance.shadow
      const stroke = appearance.stroke
      const strokeWidth = appearance.strokeWidth
      const strokeColor = appearance.strokeColor
      const iconMode = value && value.icon ? value.icon : 'solid'
      // The glyph this choice actually resolves to on THIS host: a value saved
      // before the host renamed its icon set still highlights a real cell.
      const activeGlyph = resolveIconName(iconMode)
      const patch = (next) => { if (typeof onChange === 'function') onChange(next) }
      const channels = colorToRgb(color)
      const setChannel = (index, raw) => {
        const n = Math.max(0, Math.min(255, parseInt(raw, 10) || 0))
        const base = channels || [0, 0, 0]
        const next = base.slice()
        next[index] = n
        patch({ color: rgbToHex(next[0], next[1], next[2]) })
      }
      const previewShadows = []
      if (glow > 0 && color) previewShadows.push('0 0 ' + glow + 'px ' + color)
      if (shadow) previewShadows.push('1px 1px 2px rgba(0,0,0,.85)')
      // The preview must show the REAL outline: with no custom color the pole
      // comes from the preview text's own computed color, so it reads correctly
      // in the current theme (including a background plugin's light/dark flip).
      const previewRef = React.useRef(null)
      React.useEffect(() => {
        const el = previewRef.current
        if (!el || typeof getComputedStyle !== 'function') return undefined
        const sample = () => {
          try {
            const rgb = parseCssColor(getComputedStyle(el).color)
            if (rgb) el.style.setProperty('--bw-stroke-color', contrastStrokeColor(rgb))
          } catch (error) { /* best effort: the CSS fallback stays in place */ }
        }
        sample()
        const poll = setInterval(sample, 1500)
        return () => clearInterval(poll)
      }, [color, stroke])
      const previewStroke = strokeStyleOf(appearance)
      return E('div', { className: 'bw-appearance' },
        E('div', { className: 'bw-field' },
          t('custom.color'),
          E('div', { className: 'bw-dialog-input-row' },
            SWATCHES.map((swatch) => E('button', {
              key: swatch || 'none',
              type: 'button',
              className: cls('bw-swatch', color === swatch && 'bw-swatch-active'),
              style: swatch === '' ? undefined : { background: swatch },
              'aria-label': swatch === '' ? t('custom.reset') : swatch,
              onClick: () => patch({ color: swatch }),
            })),
            E('input', {
              type: 'color',
              className: 'bw-color-input',
              value: color || '#5b8def',
              onChange: (e) => patch({ color: e.target.value }),
            }),
          ),
          E('div', { className: 'bw-rgb-row' },
            ['R', 'G', 'B'].map((label, index) => E('label', { key: label, className: 'bw-rgb-label' },
              label,
              E('input', {
                type: 'number',
                className: 'bw-rgb-input',
                min: 0,
                max: 255,
                value: channels ? channels[index] : '',
                placeholder: '—',
                onChange: (e) => setChannel(index, e.target.value),
              }),
            )),
          ),
        ),
        E('div', { className: 'bw-field' },
          t('custom.glow'),
          E('div', { className: 'bw-glow-row' },
            E('input', {
              type: 'range',
              className: 'bw-slider',
              min: 0,
              max: GLOW_MAX,
              step: 1,
              value: glow,
              'aria-label': t('custom.glow'),
              onChange: (e) => patch({ glow: Number(e.target.value) }),
            }),
            E('span', { className: 'bw-glow-value' }, glow === 0 ? t('custom.none') : glow + 'px'),
          ),
        ),
        E('div', { className: 'bw-field' },
          t('custom.weight'),
          E('div', { className: 'bw-seg' },
            [400, 500, 600, 700].map((wt) => E('button', {
              key: String(wt),
              type: 'button',
              className: cls('bw-seg-btn', weight === wt && 'bw-seg-btn-active'),
              onClick: () => patch({ weight: wt }),
            }, wt === 400 ? t('custom.weight.regular') : wt === 500 ? t('custom.weight.medium') : wt === 600 ? t('custom.weight.semibold') : t('custom.weight.bold'))),
          ),
        ),
        E('div', { className: 'bw-field' },
          t('custom.shadow'),
          E('div', { className: 'bw-seg' },
            E('button', { type: 'button', className: cls('bw-seg-btn', !shadow && 'bw-seg-btn-active'), onClick: () => patch({ shadow: false }) }, t('custom.none')),
            E('button', { type: 'button', className: cls('bw-seg-btn', shadow && 'bw-seg-btn-active'), onClick: () => patch({ shadow: true }) }, t('settings.on')),
          ),
        ),
        E('div', { className: 'bw-field' },
          t('custom.stroke'),
          E('div', { className: 'bw-seg' },
            E('button', { type: 'button', className: cls('bw-seg-btn', !stroke && 'bw-seg-btn-active'), onClick: () => patch({ stroke: false }) }, t('settings.off')),
            E('button', { type: 'button', className: cls('bw-seg-btn', stroke && 'bw-seg-btn-active'), onClick: () => patch({ stroke: true }) }, t('settings.on')),
          ),
          E('div', { className: 'bw-glow-row' },
            E('input', {
              type: 'range',
              className: 'bw-slider',
              min: 0.5,
              max: STROKE_MAX,
              step: 0.5,
              value: strokeWidth,
              'aria-label': t('custom.strokeWidth'),
              onChange: (e) => patch({ strokeWidth: Number(e.target.value) }),
            }),
            E('span', { className: 'bw-glow-value' }, strokeWidth + 'px'),
          ),
        ),
        E('div', { className: 'bw-field' },
          t('custom.strokeColor'),
          E('div', { className: 'bw-dialog-input-row' },
            E('button', {
              type: 'button',
              className: cls('bw-swatch', 'bw-swatch-wide', strokeColor === STROKE_AUTO && 'bw-swatch-active'),
              title: t('custom.strokeColor.auto'),
              onClick: () => patch({ strokeColor: STROKE_AUTO }),
            }, t('custom.strokeColor.auto')),
            STROKE_PRESETS.map((value) => E('button', {
              key: value,
              type: 'button',
              className: cls('bw-swatch', strokeColor === value && 'bw-swatch-active'),
              style: { background: value },
              'aria-label': value,
              title: value,
              onClick: () => patch({ strokeColor: value }),
            })),
            E('input', {
              type: 'color',
              className: 'bw-color-input',
              value: colorToRgb(strokeColor) ? strokeColor : DEFAULT_APPEARANCE.strokeColor,
              onChange: (e) => patch({ strokeColor: e.target.value }),
            }),
          ),
          E('div', { className: 'bw-hint' }, t('custom.stroke.hint')),
        ),
        allowIcon ? E('div', { className: 'bw-field' },
          t('custom.icon'),
          E('div', { className: 'bw-icon-grid' },
            ICON_PICKER_CHOICES.map((mode) => E('button', {
              key: mode,
              type: 'button',
              // A value saved before an alias flip still highlights the cell it
              // now resolves to, instead of leaving the grid with no selection.
              className: cls('bw-icon-cell',
                (iconMode === mode || (activeGlyph !== '' && resolveIconName(mode) === activeGlyph)) && 'bw-icon-cell-active'),
              title: mode === 'solid' ? t('custom.icon.solid') : (mode === 'outline' ? t('custom.icon.outline') : mode),
              'aria-label': mode === 'solid' ? t('custom.icon.solid') : (mode === 'outline' ? t('custom.icon.outline') : mode),
              onClick: () => patch({ icon: mode }),
            }, mode === 'none' ? E('span', { className: 'bw-icon-none' }) : iconOf(mode, false))),
          ),
        ) : null,
        E('div', { className: 'bw-field' },
          t('custom.preview'),
          E('div', {
            ref: previewRef,
            className: 'bw-preview',
            style: {
              color: color || undefined,
              fontWeight: weight > 0 ? weight : undefined,
              textShadow: previewShadows.length > 0 ? previewShadows.join(',') : undefined,
              ...(previewStroke || null),
            },
          },
            allowIcon ? E('span', { className: 'bw-preview-icon' }, iconOf(iconMode, true)) : null,
            E('span', { className: 'bw-preview-label' }, t('custom.preview.sample')),
          ),
        ),
      )
    }

    /**
     * Per-row appearance dialog: the shared controls plus the commit / reset
     * semantics. Committing exactly the default appearance (with the default
     * solid icon) clears the row's entry instead of pinning a redundant copy;
     * Reset removes the entry outright.
     */
    function CustomizeDialog({ open, seedKey, initial, defaults, kind, onChange, onReset, onClose, t }) {
      // Icons render only for workspace / workspace-folder rows. Session rows
      // already carry the official status dot (pending/running/done) in the
      // leading slot, and session sub-group rows have no icon either — so the
      // icon grid is offered only where it actually displays.
      const allowIcon = kind === 'folder' || kind === 'workspace'
      const fallback = readAppearance(defaults)
      const [draft, setDraft] = React.useState(DEFAULT_APPEARANCE)
      // The seed reads the CURRENT initial through a ref, and the effect keys
      // on the edited row (seedKey) instead of the initial object: the owner
      // rebuilds that object on every render, and a running Session re-renders
      // the browser every few seconds — keying on the object re-seeded the
      // draft mid-edit and threw the operator's picks away (the "flash back to
      // default" report). Only opening the dialog or switching rows re-seeds.
      const initialRef = React.useRef(initial)
      initialRef.current = initial
      React.useEffect(() => {
        if (!open) return
        const seed = initialRef.current
        const base = readAppearance(seed)
        setDraft({ ...base, icon: (seed && seed.icon) || 'solid' })
      }, [open, seedKey])
      if (!open) return null
      const unchanged = APPEARANCE_FIELDS.every((field) => draft[field] === fallback[field])
        && (!allowIcon || (draft.icon || 'solid') === 'solid')
      const commit = () => {
        const entry = {
          color: draft.color,
          glow: draft.glow,
          weight: draft.weight > 0 ? draft.weight : undefined,
          shadow: draft.shadow || undefined,
          stroke: draft.stroke,
          strokeWidth: draft.strokeWidth,
          ...(allowIcon ? { icon: draft.icon || 'solid' } : {}),
        }
        onChange(unchanged ? null : entry)
        onClose()
      }
      return E(ui.Modal, {
        open: true,
        onClose,
        closeLabel: t('close'),
        title: t('custom.title'),
        // issue #10: 限高 + 内容滚动,窗口矮于内容时 footer 按钮仍可见可点
        className: 'bw-custom-dialog',
        contentClassName: 'bw-custom-scroll',
        footer: E('div', { className: 'bw-modal-actions' },
          E(BTN, { variant: 'outline', onClick: () => { onReset(); onClose() } }, t('custom.reset')),
          E(BTN, { variant: 'primary', onClick: commit }, t('custom.done')),
        ),
      },
        E('div', { className: 'bw-modal-body' },
          E(AppearanceControls, {
            value: draft,
            // patch.icon must WIN: the trailing fallback only fills the
            // field readAppearance drops, never overrides a fresh pick
            // (issue #9: the old spelling made the icon grid a no-op).
            onChange: (patch) => setDraft((prev) => ({ ...readAppearance(prev), ...patch, icon: patch.icon || prev.icon || 'solid' })),
            allowIcon,
            t,
          }),
        ),
        StyleNode(),
      )
    }

    /* ------------------------- settings page ------------------------- */

    // The desktop renderer serves the shell over the private dsh-app: scheme;
    // every other context (http/https) is the web profile.
    const IS_DESKTOP_SURFACE = typeof location !== 'undefined' && location.protocol === 'dsh-app:'

    function BetterWorkspaceSettings({ useStore, actions, t }) {
      const prefs = useStore ? (useStore(s => s.prefs) || {}) : {}
      const localStyling = useStore ? (useStore(s => s.styling) || {}) : {}
      const compactChains = prefs.compactChains !== false
      const statusPulse = prefs.statusPulse !== false
      const rowActions = prefs.rowActions !== false
      // v0.30.2: auto titles keep the '/' group prefix — on unless opted out.
      const graftPrefix = prefs.graftTitlePrefix !== false
      // Auto color + icon for new items (v0.24.0): OFF unless explicitly on —
      // the switch is opt-in, and an absent key means off.
      const autoStyle = prefs.autoStyle === true
      // Progressive listing quota (v0.21.0, issue #8): 0 = unlimited.
      const rawLimit = Math.floor(Number(prefs.sessionLimit))
      const sessionLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 0
      // Row density (v0.34.0): Comfortable rides the shipped sidebar row
      // heights (the default); Compact/Roomy drive the --bw-row-h dials.
      const densityRaw = String(prefs.density || 'comfortable')
      const density = densityRaw === 'compact' || densityRaw === 'roomy' ? densityRaw : 'comfortable'
      // Session count badge: the shipped sidebar retired it; default OFF.
      const showCount = prefs.showCount === true
      // Grouping strategy (v0.21.0, issue #7): rides the view store top-level
      // key next to groupBy/orderBy and stays browser-local, like every other
      // view option. The legacy workspaceTitleSlash boolean is consulted only
      // when no mode was ever persisted.
      const workspaceGroupMode = useStore
        ? workspaceGroupModeOf(useStore(s => s.workspaceGroupMode), useStore(s => s.workspaceTitleSlash))
        : 'disk'
      // Default appearance: the base every row inherits unless it carries its
      // own per-row entry. The outline ships ON — text over a background image
      // is often unreadable without it.
      const appearance = readAppearance(prefs.appearance)
      const setPref = (key, value) => {
        if (actions && typeof actions.setPref === 'function') actions.setPref(key, value)
        scopeSet(key, value)
      }
      const setAppearance = (next) => setPref('appearance', readAppearance(next))
      // Foldable sections, HAND-DRAWN (mirrors dsh-gitbash-shell v0.38.4).
      // The official disclosure row was tried there first (v0.38.0-0.38.3)
      // and never rendered on the real machine: the plugin's restricted
      // require does not reach it (the icon lookup inside the ui-primitives
      // module comes back null there), so every section silently degraded to
      // a static title+stack pile. One button + one conditional instead;
      // header rows stay visible at all times, every section ships collapsed.
      const foldsState = React.useState({})
      const folds = foldsState[0]
      const setFolds = foldsState[1]
      const toggleFold = (key) => {
        setFolds((prev) => {
          const next = { ...prev }
          next[key] = !prev[key]
          return next
        })
      }
      const fold = (titleKey, ...body) => {
        const open = folds[titleKey] === true
        return E('div', { className: 'bw-fold' },
          E('button', {
            type: 'button',
            className: 'bw-foldHead',
            'aria-expanded': open ? 'true' : 'false',
            onClick: () => { toggleFold(titleKey) },
          },
            E('span', { className: cls('bw-foldChevron', open && 'bw-foldChevronOpen'), 'aria-hidden': 'true' }, '▸'),
            E('span', { className: 'bw-foldTitle' }, t(titleKey)),
          ),
          open ? E('div', { className: 'bw-stack' }, body) : null,
        )
      }
      // Manual cross-device sync state.
      const [syncMode, setSyncMode] = React.useState('overwrite')
      const [syncMsg, setSyncMsg] = React.useState(null)
      const snap = useHostScope()
      const host = hostPrefsOf(snap)
      const scopeLive = prefsScopeRef !== null
      const onPull = () => {
        if (host === null) { setSyncMsg(t('sync.empty')); return }
        if (syncMode === 'merge' && actions && typeof actions.mergeHost === 'function') actions.mergeHost(host)
        else if (actions && typeof actions.importHost === 'function') actions.importHost(host)
        else { setSyncMsg(t('sync.off')); return }
        setSyncMsg(t('sync.done'))
      }
      const onPush = () => {
        scopeSet('styling', localStyling)
        scopeSet('compactChains', prefs.compactChains !== false)
        scopeSet('statusPulse', prefs.statusPulse !== false)
        scopeSet('appearance', appearance)
        setSyncMsg(t('sync.done'))
      }
      const modeButton = (id, label) => E('button', {
        type: 'button',
        className: cls('bw-sync-mode', syncMode === id && 'bw-sync-mode-on'),
        'aria-pressed': syncMode === id,
        onClick: () => { setSyncMode(id); setSyncMsg(null) },
      }, label)
      const syncActionButton = (label, onClick, primary, disabled) => E('button', {
        type: 'button',
        className: cls('bw-sync-btn', primary && 'bw-sync-btn-primary'),
        disabled,
        onClick,
      }, label)
      return E('div', { className: 'bw-settings' },
        StyleNode(),
        fold('settings.group.tree',
        E('div', { className: 'bw-setting-row' },
          E('div', { className: 'bw-setting-label' }, t('settings.compactChains')),
          E('button', {
            type: 'button',
            role: 'switch',
            'aria-checked': compactChains,
            'aria-label': t('settings.compactChains'),
            className: cls('bw-switch', compactChains && 'bw-switch-on'),
            onClick: () => { setPref('compactChains', !compactChains) },
          }, E('span', { className: 'bw-switch-thumb' })),
        ),
        E('div', { className: 'bw-hint' }, t('settings.compactChains.hint')),
        E('div', { className: 'bw-setting-row', style: { marginTop: 10 } },
          E('div', { className: 'bw-setting-label' }, t('settings.workspaceGroup')),
          E('div', { className: 'bw-seg' },
            E('button', {
              type: 'button',
              className: cls('bw-seg-btn', workspaceGroupMode === 'disk' && 'bw-seg-btn-active'),
              onClick: () => { if (actions && typeof actions.setWorkspaceGroupMode === 'function') actions.setWorkspaceGroupMode('disk') },
            }, t('viewOptions.wsByDisk')),
            E('button', {
              type: 'button',
              className: cls('bw-seg-btn', workspaceGroupMode === 'disk-slash' && 'bw-seg-btn-active'),
              onClick: () => { if (actions && typeof actions.setWorkspaceGroupMode === 'function') actions.setWorkspaceGroupMode('disk-slash') },
            }, t('viewOptions.wsByDiskSlash')),
            E('button', {
              type: 'button',
              className: cls('bw-seg-btn', workspaceGroupMode === 'slash' && 'bw-seg-btn-active'),
              onClick: () => { if (actions && typeof actions.setWorkspaceGroupMode === 'function') actions.setWorkspaceGroupMode('slash') },
            }, t('viewOptions.wsBySlash')),
          ),
        ),
        E('div', { className: 'bw-hint' }, t('settings.workspaceGroup.hint')),
        E('div', { className: 'bw-setting-row' },
          E('div', { className: 'bw-setting-label' }, t('settings.sessionLimit')),
          E('div', { className: 'bw-seg' },
            [[0, t('settings.sessionLimit.all')], [5, '5'], [10, '10'], [25, '25']].map(([value, label]) =>
              E('button', {
                type: 'button',
                key: String(value),
                className: cls('bw-seg-btn', sessionLimit === value && 'bw-seg-btn-active'),
                onClick: () => { setPref('sessionLimit', value) },
              }, label)),
          ),
        ),
        E('div', { className: 'bw-hint' }, t('settings.sessionLimit.hint')),
        ),
        fold('settings.group.interaction',
        E('div', { className: 'bw-setting-row' },
          E('div', { className: 'bw-setting-label' }, t('settings.graft.title')),
          E('button', {
            type: 'button',
            role: 'switch',
            'aria-checked': graftPrefix,
            'aria-label': t('settings.graft.title'),
            className: cls('bw-switch', graftPrefix && 'bw-switch-on'),
            onClick: () => { setPref('graftTitlePrefix', !graftPrefix) },
          }, E('span', { className: 'bw-switch-thumb' })),
        ),
        E('div', { className: 'bw-hint' }, t('settings.graft.hint')),
        E('div', { className: 'bw-setting-row', style: { marginTop: 10 } },
          E('div', { className: 'bw-setting-label' }, t('settings.rowActions')),
          E('button', {
            type: 'button',
            role: 'switch',
            'aria-checked': rowActions,
            'aria-label': t('settings.rowActions'),
            className: cls('bw-switch', rowActions && 'bw-switch-on'),
            onClick: () => { setPref('rowActions', !rowActions) },
          }, E('span', { className: 'bw-switch-thumb' })),
        ),
        E('div', { className: 'bw-hint' }, t('settings.rowActions.hint')),
        ),
        fold('settings.group.appearance',
        E('div', { className: 'bw-setting-row' },
          E('div', { className: 'bw-setting-label' }, t('settings.statusPulse')),
          E('button', {
            type: 'button',
            role: 'switch',
            'aria-checked': statusPulse,
            'aria-label': t('settings.statusPulse'),
            className: cls('bw-switch', statusPulse && 'bw-switch-on'),
            onClick: () => { setPref('statusPulse', !statusPulse) },
          }, E('span', { className: 'bw-switch-thumb' })),
        ),
        E('div', { className: 'bw-hint' }, t('settings.statusPulse.hint')),
        E('div', { className: 'bw-setting-row' },
          E('div', { className: 'bw-setting-label' }, t('settings.density')),
          E('div', { className: 'bw-seg' },
            ['compact', 'comfortable', 'roomy'].map((mode) =>
              E('button', {
                type: 'button',
                key: mode,
                className: cls('bw-seg-btn', density === mode && 'bw-seg-btn-active'),
                onClick: () => { setPref('density', mode) },
              }, t('settings.density.' + mode)),
            ),
          ),
        ),
        E('div', { className: 'bw-hint' }, t('settings.density.hint')),
        E('div', { className: 'bw-setting-row' },
          E('div', { className: 'bw-setting-label' }, t('settings.showCount')),
          E('button', {
            type: 'button',
            role: 'switch',
            'aria-checked': showCount,
            'aria-label': t('settings.showCount'),
            className: cls('bw-switch', showCount && 'bw-switch-on'),
            onClick: () => { setPref('showCount', !showCount) },
          }, E('span', { className: 'bw-switch-thumb' })),
        ),
        E('div', { className: 'bw-hint' }, t('settings.showCount.hint')),
        E('div', { className: 'bw-setting-row' },
          E('div', { className: 'bw-setting-label' }, t('settings.autoStyle')),
          E('button', {
            type: 'button',
            role: 'switch',
            'aria-checked': autoStyle,
            'aria-label': t('settings.autoStyle'),
            className: cls('bw-switch', autoStyle && 'bw-switch-on'),
            onClick: () => { setPref('autoStyle', !autoStyle) },
          }, E('span', { className: 'bw-switch-thumb' })),
        ),
        E('div', { className: 'bw-hint' }, t('settings.autoStyle.hint')),
        E('div', { className: 'bw-setting-label' }, t('settings.appearance')),
        E('div', { className: 'bw-hint' }, t('settings.appearance.hint')),
        E('div', { className: 'bw-appearance-box' },
          E(AppearanceControls, {
            value: appearance,
            onChange: (patch) => setAppearance({ ...appearance, ...patch }),
            allowIcon: false,
            t,
          }),
          E('div', { style: { marginTop: 10 } },
            E(BTN, { variant: 'outline', onClick: () => setAppearance(DEFAULT_APPEARANCE) }, t('settings.appearance.reset')),
          ),
        ),
        // Manual cross-device sync exists only where a SHARED host home does
        // (dsh <= 0.1.6 settings.yaml; both surfaces read one file). On
        // dsh >= 0.1.7 settings persist per profile, so the section hides.
        ),
        prefsScopeVia === 'settingsScope' ? fold('settings.group.sync',
          E('div', { className: 'bw-hint' }, t('sync.desc')),
          E('div', { className: 'bw-sync-modes' },
            modeButton('overwrite', t('sync.mode.overwrite')),
            modeButton('merge', t('sync.mode.merge')),
          ),
          E('div', { className: 'bw-sync-actions' },
            syncActionButton(t(IS_DESKTOP_SURFACE ? 'sync.pull.web' : 'sync.pull.desktop'), onPull, true, !scopeLive || snap.status === 'loading'),
            syncActionButton(t('sync.push'), onPush, false, !scopeLive),
          ),
          syncMsg !== null ? E('div', { className: 'bw-hint' }, syncMsg)
            : (scopeLive ? null : E('div', { className: 'bw-hint' }, t('sync.off'))),
          scopeLive && snap.status === 'loading' ? E('div', { className: 'bw-hint' }, t('sync.loading')) : null,
        ) : null,
      )
    }

    /* --------- settings → plug-ins card (accordion like official cards) --------- */

    function BetterWorkspacePluginCard(props) {
      const { useStore: injectedUseStore, actions: injectedActions, localStore: localStoreProp, t } = props
      // Issue #13: same private-store switch as the browser seat — the card
      // keeps working no matter what a shadowing occupant does to the props.
      const localStoreFace = typeof localStoreProp === 'function' ? localStoreProp() : null
      const useStore = localStoreFace && typeof localStoreFace.useStore === 'function'
        ? localStoreFace.useStore
        : injectedUseStore
      const actions = localStoreFace && localStoreFace.actions ? localStoreFace.actions : injectedActions
      // The bundle page (plugins.bundle.config, dsh 0.1.6-alpha.2+) renders
      // this card inline with view: 'page' — no accordion chrome there, the
      // settings body sits directly under a one-line title.
      const pageView = props.view === 'page'
      const [open, setOpen] = React.useState(false)
      const Chevron = ui.IconChevronDownOutline14
      if (pageView) {
        return E('div', { className: 'bw-plugin-card' },
          E('div', { className: 'bw-plugin-head' },
            E('span', { className: 'bw-plugin-headtext' },
              E('span', { className: 'bw-plugin-name' }, t('settings.title')),
              E('span', { className: 'bw-plugin-desc' }, t('settings.desc')),
            ),
          ),
          E('div', { className: 'bw-plugin-body' },
            E(BetterWorkspaceSettings, { useStore, actions, t }),
          ),
        )
      }
      return E('li', { className: cls('bw-plugin-card', open && 'bw-plugin-card-open') },
        E('button', {
          type: 'button',
          className: 'bw-plugin-head',
          'aria-expanded': open,
          'aria-label': (open ? t('settings.collapse') : t('settings.expand')) + ': ' + t('settings.title'),
          onClick: () => setOpen(!open),
        },
          E('span', { className: 'bw-plugin-headtext' },
            E('span', { className: 'bw-plugin-name' }, t('settings.title')),
            E('span', { className: 'bw-plugin-desc' }, t('settings.desc')),
          ),
          Chevron ? E(Chevron, { className: cls('bw-plugin-chevron', open && 'bw-plugin-chevron-open') }) : null,
        ),
        open ? E('div', { className: 'bw-plugin-body' },
          E(BetterWorkspaceSettings, { useStore, actions, t }),
        ) : null,
      )
    }

    /* ====================== hero workspace picker ===================== */

    /** The conversation empty-state picker's directory-flow hole (declared and owned by the shipped picker entry). */
    const HERO_FLOW_HOLE = 'conversation.hero.workspace.directoryFlow'
    /** Menu id of the picker's pinned add action — namespaced so it can never collide with a workspace id. */
    const HERO_ADD_ID = '::bw-hero-add'
    /** Stable empty array for memo dependencies. */
    const EMPTY_LIST = []

    /**
     * One picker row. The row is drawn here rather than through the primitives
     * MenuItemButton because the tree needs its own layout — an indentation
     * gutter, the folder chevron and the trailing check — while the fixed
     * 14px icon cell of that row crops any indentation placed inside it. The
     * list chrome (card, scroll, outside click, arrow walk, focus return) is
     * still the primitives Menu's: its keyboard walk reads
     * `button[role="menuitem"]`, which is exactly what this renders.
     */
    function PickerRow({ depth, glyph, label, folder, checked, onSelect }) {
      return E('button', {
        type: 'button',
        role: 'menuitem',
        className: 'bw-pick-row',
        onClick: onSelect,
      },
        E('span', { className: 'bw-pick-indent', style: { width: (depth * 14) + 'px' } }),
        E('span', { className: 'bw-pick-glyph' }, glyph),
        E('span', { className: cls('bw-pick-name', folder && 'bw-pick-folder') }, label),
        checked ? E('span', { className: 'bw-pick-check' }, icon('IconCheckOutlineRegular', 14)) : null,
      )
    }

    /**
     * Conversation empty-state workspace picker (v0.22.0).
     *
     * The shipped picker lists every workspace title flat, in one level, with
     * no disk nesting at all; this seat shadows it (priority -1 — lowest
     * renders) and draws the SAME store-backed tree the sidebar draws: disk
     * nesting by the official owning-parent semantics, the tri-state "/" name
     * layer and chain compression all read the one view store, so a view
     * option changed on either surface moves both. The chip, its anchor and
     * the pick semantics stay with ui-conversation — this component renders the
     * popover only and reports a pick through the owner's onPick.
     *
     * Adding a workspace stays official. Shadowing the seat forfeits the
     * child-hole render authorization (a children declaration is exclusive,
     * and the shipped entry keeps owning HERO_FLOW_HOLE), so the shipped
     * occupant COMPONENT is read off the slot ledger and rendered directly —
     * with this surface supplying the same owner conversation the shipped
     * picker would, plus that entry's own injected face. Native and browse
     * hosts therefore keep the interaction they shipped with; a host whose
     * ledger hides the entry loses the add action, never the picker.
     */
    function HeroWorkspacePicker(props) {
      const t = typeof props.t === 'function' ? props.t : (key => key)
      const useWorkspaces = props.useWorkspaces
      const useStore = props.useStore
      const useDirectoryFlow = props.useDirectoryFlow
      // Hook order must not depend on the injection face arriving: the fallback
      // is a plain function (not a hook), so both branches call the same way.
      const useFlowOccupancy = typeof useDirectoryFlow === 'function' ? useDirectoryFlow : () => 0
      const anchorRef = props.anchorRef
      const selectedId = props.selectedId
      const onPick = props.onPick
      const onClose = props.onClose
      const heroFlowEntry = props.heroFlowEntry
      const createWorkspace = props.createWorkspace

      const snapshot = typeof useWorkspaces === 'function' ? useWorkspaces(state => state) : null
      const groupBy = typeof useStore === 'function'
        ? useStore(state => (state && state.groupBy) || 'workspace-tree')
        : 'workspace-tree'
      const groupMode = typeof useStore === 'function'
        ? useStore(state => workspaceGroupModeOf(state && state.workspaceGroupMode, state && state.workspaceTitleSlash))
        : 'disk'
      const compactChains = typeof useStore === 'function'
        ? useStore(state => !state || !state.prefs || state.prefs.compactChains !== false)
        : true
      const wsFolders = typeof useStore === 'function'
        ? useStore(state => (state && state.folders && state.folders.ws) || EMPTY_FOLDERS)
        : EMPTY_FOLDERS
      // Same persisted group order the sidebar uses (v0.36.4) — a chooser that
      // listed groups alphabetically while the tree showed the dragged order
      // would contradict the surface it selects for.
      const pickerFolderOrder = typeof useStore === 'function'
        ? useStore(state => (state && state.folderOrder) || EMPTY_FOLDERS)
        : EMPTY_FOLDERS
      // Occupancy is the only reactive fact here: the ledger read re-runs on
      // every render, so the count just forces the re-render when the shipped
      // occupant loads or unloads (its identity is stable while occupied).
      const flowCount = useFlowOccupancy(count => count)
      /** Picker-local collapse: the tree opens fully expanded (a chooser must show its targets) and a folder row folds only here. */
      const [folded, setFolded] = React.useState(EMPTY_FOLDERS)
      const [flowOpen, setFlowOpen] = React.useState(false)
      const [picking, setPicking] = React.useState(false)
      const [errorText, setErrorText] = React.useState(null)

      // Same resolved first-use name as the sidebar (see withDisplayTitles):
      // the picker must label a Workspace exactly like the tree does.
      const defaultWorkspaceName = t('workspace.defaultName')
      const rawItems = snapshot && Array.isArray(snapshot.items) ? snapshot.items : EMPTY_LIST
      const items = React.useMemo(
        () => withDisplayTitles(rawItems, defaultWorkspaceName),
        [rawItems, defaultWorkspaceName],
      )
      // Same construction the sidebar runs (buildTree + optional chain
      // compression), so both surfaces answer the same view options.
      const tree = React.useMemo(() => {
        const built = buildTree(items, groupMode, wsFolders, pickerFolderOrder)
        if (!compactChains) return built
        return { ...built, folders: built.folders.map((f) => materializeChain(compressTree(f))), workspaces: built.workspaces }
      }, [items, groupMode, wsFolders, pickerFolderOrder, compactChains])

      const rows = React.useMemo(() => {
        const out = []
        // ONE view rule for every tree-shaped surface (sidebar memo, new-group
        // chooser, this picker): "workspaces" keeps the name tree whenever a
        // name layer is on — only a purely disk flat view or 'flat' collapses.
        const flatMode = groupBy === 'flat'
          || (groupBy === 'workspace' && workspaceGroupMode === 'disk')
        const isFolded = (key) => folded[key] === true
        const toggle = (key) => {
          setFolded((prev) => {
            const next = { ...prev }
            if (next[key] === true) delete next[key]
            else next[key] = true
            return next
          })
        }
        const pick = (workspace) => {
          if (!workspace || workspace.workspaceId === undefined) return
          if (typeof onPick === 'function') onPick(workspace.workspaceId)
        }
        // Tree rows carry the leaf the sidebar shows; flat rows carry the full
        // title (official 'workspace' mode shows whole titles, and a picker
        // must stay unambiguous once the folder context is gone).
        const labelOf = (workspace) => String((flatMode ? workspace.title : workspace.leaf)
          || workspace.title || workspace.leaf || '')
        const workspaceRows = (entry, depth, deep) => {
          const workspace = entry.workspace || entry
          out.push(E(PickerRow, {
            key: 'w:' + String(workspace.workspaceId),
            depth,
            glyph: icon('IconFolderCloseRegular', 16),
            label: labelOf(workspace),
            checked: workspace.workspaceId === selectedId,
            onSelect: () => pick(workspace),
          }))
          // Disk-nested child workspaces always render: folding them away would
          // put them out of reach of a chooser.
          if (deep !== false && entry.sub) levelRows(entry.sub, depth + 1)
        }
        const folderRows = (node, depth) => {
          // compressTree materialises a single-child chain ending in exactly
          // one workspace as a 'ws' row: that row IS the workspace row.
          if (node.kind === 'ws') { workspaceRows({ workspace: node.workspace }, depth, true); return }
          const idPath = node.idPath || node.path
          const collapsed = isFolded(idPath)
          out.push(E(PickerRow, {
            key: 'f:' + String(idPath),
            depth,
            glyph: E('span', { className: cls('bw-chevron', !collapsed && 'bw-chevron-open') }, icon('IconTriangleRightFill14', 14)),
            label: folderLabelOf(node),
            folder: true,
            checked: false,
            onSelect: () => toggle(idPath),
          }))
          if (collapsed) return
          for (const child of node.folders) folderRows(child, depth + 1)
          for (const entry of node.workspaces) workspaceRows(entry, depth + 1, true)
        }
        const levelRows = (level, depth) => {
          for (const node of level.folders) folderRows(node, depth)
          for (const entry of level.workspaces) workspaceRows(entry, depth, true)
        }
        if (!flatMode) levelRows(tree, 0)
        else {
          // Flat surfaces (official 'workspace' mode, and 'flat' where the
          // sidebar carries no workspace rows at all): one level, full titles —
          // a picker still has to offer every workspace.
          const all = []
          const collect = (level) => {
            for (const node of level.folders) collect(node)
            for (const entry of level.workspaces) { all.push(entry); if (entry.sub) collect(entry.sub) }
          }
          collect(tree)
          for (const entry of all) workspaceRows(entry, 0, false)
        }
        return out
      }, [tree, groupBy, folded, selectedId, onPick])

      const flowAvailable = flowCount > 0
      const addEntry = flowAvailable
        ? { id: HERO_ADD_ID, label: t('add'), icon: icon('IconPlusOutlineRegular', 16) }
        : null
      const flowEntry = flowAvailable && typeof heroFlowEntry === 'function' ? heroFlowEntry() : null
      const flowComponent = flowEntry && flowEntry.component ? flowEntry.component : null
      let flowFace = null
      if (flowEntry && typeof flowEntry.inject === 'function') {
        try { flowFace = flowEntry.inject() } catch (error) { flowFace = null }
      }
      const openFlow = () => {
        setErrorText(null)
        setFlowOpen(true)
        if (typeof onClose === 'function') onClose()
      }
      const adoptPath = (path) => {
        setPicking(true)
        Promise.resolve()
          .then(() => createWorkspace({ path: String(path) }))
          .then((workspace) => {
            setFlowOpen(false)
            if (workspace && workspace.workspaceId !== undefined && typeof onPick === 'function') onPick(workspace.workspaceId)
          })
          .catch((reason) => {
            // The picker's own error surface: the shared picker flow answers a
            // failed adoption with a retryable notice, and so does this one.
            setFlowOpen(false)
            setErrorText(messageOf(reason))
          })
          .then(() => { setPicking(false) })
      }
      const menuReady = typeof ui.Menu === 'function'
      const menuOpen = props.open === true && (rows.length > 0 || addEntry !== null)
      const flowNode = flowComponent && flowOpen
        ? E(flowComponent, {
          key: 'bw-hero-flow',
          open: true,
          busy: picking,
          onPicked: adoptPath,
          onCancel: () => { setFlowOpen(false) },
          onError: (message) => { setFlowOpen(false); setErrorText(String(message)) },
          ...(flowFace || EMPTY_FOLDERS),
        })
        : null
      const errorNode = menuReady && errorText !== null
        ? E(ui.Modal, {
          open: true,
          title: t('heroPicker.error.title'),
          closeLabel: t('close'),
          onClose: () => { setErrorText(null) },
          footer: E('div', { className: 'bw-modal-actions' },
            E(BTN, { variant: 'outline', onClick: () => { setErrorText(null) } }, t('cancel')),
            E(BTN, { variant: 'primary', disabled: !flowAvailable, onClick: openFlow }, t('heroPicker.retry')),
          ),
        }, E('div', { className: 'bw-modal-body' }, E('div', { role: 'alert' }, errorText)))
        : null
      return E(React.Fragment, null,
        menuReady ? E(ui.Menu, {
          open: menuOpen,
          // portal mode anchored on the owner's chip: the menu is the popover,
          // never the trigger (ui-conversation renders the chip itself).
          anchor: null,
          items: EMPTY_LIST,
          ...(addEntry ? { footer: [addEntry] } : {}),
          portal: true,
          dense: true,
          side: 'bottom',
          getAnchorRect: () => (anchorRef && anchorRef.current ? anchorRef.current.getBoundingClientRect() : null),
          onClose: () => { if (typeof onClose === 'function') onClose() },
          onSelect: (id) => { if (id === HERO_ADD_ID) openFlow() },
        }, rows) : null,
        flowNode,
        errorNode,
      )
    }

    /* ============================= browser ============================ */

    function BetterBrowser(props) {
      const {
        wide, expandSidebar,
        useSessions, useSessionPendingInteraction, useSessionStatus, useWorkspaces,
        useSessionAccess,
        useStore: injectedUseStore, actions: injectedActions,
        localStore: localStoreProp,
        startSession, open, renameSession, forkSession, renameWorkspace, deleteWorkspace,
        archiveSession, createWorkspace, pinSession, unpinSession, unarchiveSession,
        insertWorkspaceBefore, insertSessionBefore,
        useDirectoryFlow,
        pickDirectory, listDirectory, createDirectory,
        sidebarFlowEntry,
        shippedBrowserFace, scheduleSeatReader, seatEntriesReader,
        officialT,
        presetFaceOf,
        contextMenuFaceOf, setMenuBridge,
        t,
      } = props
      // Issue #13: local reads and writes go through OUR store instance, never
      // the renderer-synthesized props — a shadowing occupant can swap those
      // props for its own store (issue #13). Host projections (useSessions /
      // useWorkspaces) stay on the injected props; only the plugin's OWN view
      // state switches. Names keep their original spelling so the component
      // body needs no other change.
      const localStoreFace = typeof localStoreProp === 'function' ? localStoreProp() : null
      const useStore = localStoreFace && typeof localStoreFace.useStore === 'function'
        ? localStoreFace.useStore
        : injectedUseStore
      const actions = localStoreFace && localStoreFace.actions ? localStoreFace.actions : injectedActions
      // v0.32.2: resolve the stable getter ONCE per render (see
      // browserInjected for why this is a function and not a value prop).
      // Every consumer below keeps reading this local, so a late-arriving
      // agent-preset service is picked up by the next render's menu build.
      const presetFace = typeof presetFaceOf === 'function' ? presetFaceOf() : null
      // Official menu integration (alpha.3): the active target drives the
      // workspace row's open state, while the bridge carries the live bw
      // extras into the apply-level contribution.
      const activeContextMenu = useActiveContextMenu(contextMenuFaceOf)

      if (typeof useWorkspaces !== 'function' || typeof useSessions !== 'function') {
        console.error('[dsh-better-workspace] standard snapshot hooks missing; browser renders nothing')
        return null
      }
      // rc.1 added useSessionAccess to the GLOBAL standard hooks. Shipped seat
      // occupants (row.action pin/archive) call it directly, so an in-row
      // reproduction must hand it down exactly like the slot renderer does.
      // Older hosts do not define it; omit the prop there so the seats stay
      // compatible with their own generation.
      const seatStandardProps = typeof useSessionAccess === 'function' ? { useSessionAccess } : null

      const storedItems = useWorkspaces(s => s.items)
      // Official rc.2 first-use naming (see withDisplayTitles): every surface
      // reads the RESOLVED name, exactly like the shipped browser's own
      // workspaces projection, so the tree, the group labels and the rename
      // prefill agree with the rest of the shell.
      const defaultWorkspaceName = t('workspace.defaultName')
      const items = React.useMemo(
        () => withDisplayTitles(storedItems, defaultWorkspaceName),
        [storedItems, defaultWorkspaceName],
      )
      const phase = useWorkspaces(s => s.phase)
      const archivedSessionIds = useWorkspaces(s => s.archivedSessionIds) || []
      // Registry-global pin set (dsh 0.1.7): absent on older hosts, which
      // simply never see pinned rows or pin actions.
      const pinnedSessionIds = useWorkspaces(s => s.pinnedSessionIds) || []
      const list = useSessions(s => s)
      // Session UI status, BOTH eras: dsh 0.1.7 replaced the pending-only
      // hook with the unified status map (running / pendingInteraction /
      // completionUnread). Prefer it when bound; the legacy hook stays the
      // pre-0.1.7 source, and summary fields fill whatever neither carries.
      const pending = useSessionPendingInteraction ? useSessionPendingInteraction(s => s) : null
      const statusMap = typeof useSessionStatus === 'function' ? useSessionStatus(s => s) : null
      const statusOf = (id) => {
        if (!statusMap || typeof statusMap.get !== 'function') return undefined
        return statusMap.get(id)
      }
      const expandedMap = useStore ? (useStore(s => s.expanded) || {}) : {}
      const sessionsExpandedMap = useStore ? (useStore(s => s.sessionsExpanded) || {}) : {}
      const sessionGroupsMap = useStore ? (useStore(s => s.sessionGroups) || {}) : {}
      const prefsMap = useStore ? (useStore(s => s.prefs) || {}) : {}
      const stylingMap = useStore ? (useStore(s => s.styling) || {}) : {}
      const sessionOrderMap = useStore ? (useStore(s => s.sessionOrder) || {}) : {}
      // Declared (possibly empty) groups, v0.17.0. Hydration replaces the whole
      // state, so a snapshot written by an older version has no `folders` key —
      // the fallback object keeps every read below total.
      const foldersMap = useStore ? (useStore(s => s.folders) || {}) : {}
      const wsFolders = foldersMap && typeof foldersMap.ws === 'object' && foldersMap.ws !== null ? foldersMap.ws : EMPTY_FOLDERS
      const sessFolders = foldersMap && typeof foldersMap.sess === 'object' && foldersMap.sess !== null ? foldersMap.sess : EMPTY_FOLDERS
      // Persisted group order (v0.36.4): { [parentKey]: name[] }. Absent on
      // every snapshot written before it existed — the seed name sort then
      // stands, so old states render unchanged.
      const folderOrderMap = useStore ? (useStore(s => s.folderOrder) || EMPTY_FOLDERS) : EMPTY_FOLDERS
      // View options (v0.13). Selector reads take fallbacks: hydration
      // replaces the whole persisted value, so states written by older
      // plugin versions lack these keys (hard store discipline).
      const groupBy = useStore ? (useStore(s => s.groupBy) || 'workspace-tree') : 'workspace-tree'
      const orderBy = useStore ? (useStore(s => s.orderBy) || 'manual') : 'manual'
      const sessionSlash = useStore ? (useStore(s => s.sessionTitleSlash) !== false) : true
      // Grouping strategy (v0.21.0, issue #7) plus its name-layer shorthand:
      // every pre-0.21 workspaceSlash gate keeps working unchanged.
      const workspaceGroupMode = useStore
        ? workspaceGroupModeOf(useStore(s => s.workspaceGroupMode), useStore(s => s.workspaceTitleSlash))
        : 'disk'
      const workspaceSlash = workspaceGroupMode !== 'disk'
      // Collapsible Ungrouped block (v0.21.0, issue #6); default open.
      const ungroupedOpen = useStore ? (useStore(s => s.ungroupedOpen) !== false) : true
      // Progressive listing (v0.21.0, issue #8): 0 means unlimited (default).
      const rawLimit = Math.floor(Number(prefsMap.sessionLimit))
      const sessionLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 0
      // Tree density + count badge (v0.34.0), read fresh every render.
      const densityRaw = String(prefsMap.density || 'comfortable')
      const density = densityRaw === 'compact' || densityRaw === 'roomy' ? densityRaw : 'comfortable'
      const showCount = prefsMap.showCount === true
      // Dual-write wrappers: every preference mutation lands in the local
      // store (immediate echo + scope-less fallback) AND the host settings
      // store (durable cross-device copy for the manual pull on the other
      // surface). Computed from the CURRENT rendered values.
      const shared = makeSharedWrites(actions, stylingMap)
      const compactChains = prefsMap.compactChains !== false
      const statusPulse = prefsMap.statusPulse !== false
      // Session-action surface gate (v0.20.0): the hover quick buttons. The
      // right-click ctx menu is always on since the in-row "..." triggers
      // retired (session row v0.35.0, workspace row v0.35.1).
      const rowActionsEnabled = prefsMap.rowActions !== false
      // Auto color + icon for new items (v0.24.0). Default OFF: absent key =
      // off, so every existing snapshot keeps its behavior untouched.
      const autoStyle = prefsMap.autoStyle === true
      // Subscribe the ROW renderer to the theme flip (v0.25.0 P1): resolving a
      // stored `auto:N` token reads the live theme, but a read alone never
      // repaints — without this subscription the rows kept the light pool after
      // the Host switched to dark, so normal-text AA was broken on the switch
      // path (measured 2.49). The value is passed explicitly into the resolver
      // below so the colour and the outline pole come from one snapshot.
      //
      // Placement: this sits before every OTHER hook, so the hook order is fixed
      // for a mount. The one branch above it is the injected-hook shape gate
      // (`typeof useWorkspaces !== 'function' → return null`), which is constant
      // for the lifetime of a mount — the hook count therefore never varies, and
      // that branch renders no rows at all. If anyone ever turns that gate into a
      // condition that can CHANGE mid-mount, this subscription must move above it
      // first, or React sees a varying hook count.
      const autoDarkTheme = useAutoThemeDark()
      // Workspace stream state: a `ready` phase with a settled stream is the
      // first authoritative inventory — the point where "everything seen so
      // far is pre-existing" can be recorded once (older hosts without the
      // field simply report undefined, which is not 'loading').
      const workspaceStreamState = useWorkspaces(s => s.state)
      // Archived-row visibility (v0.20.0, official ArchivedFilter mirror);
      // persisted snapshots from older plugin versions lack the key.
      const archivedFilter = useStore ? (useStore(s => s.archivedFilter) || 'default') : 'default'
      const archivedSet = React.useMemo(() => new Set(archivedSessionIds), [archivedSessionIds])
      const pinnedSet = React.useMemo(() => new Set(pinnedSessionIds), [pinnedSessionIds])
      const subCounts = React.useMemo(() => subagentRunningCounts(list ? list.byId : {}), [list ? list.byId : null])

      /* ------------- auto appearance for new items (v0.24.0) -------------- */
      // One mount-scoped ledger of what has already been accounted for, so an
      // item is NEVER assigned twice and NEVER overwritten:
      // · a session counts as new only while the wire still reports it blank —
      //   the trustworthy birth mark this plugin already relies on elsewhere
      //   (pre-existing sessions are never blank, so a reload can never restyle
      //   the inventory, and a late-arriving old row is not restyled either);
      // · a workspace counts as new only once the FIRST authoritative inventory
      //   has been recorded (`phase: 'ready'` with a settled stream), so the
      //   progressive fill of the workspace list cannot masquerade as creation.
      // The ledger is maintained even while the toggle is OFF — that is exactly
      // what keeps items created during the off period from being styled later.
      // Existing styling wins: an entry the user set (or one pulled from the
      // host copy) makes the item skip, so nothing manual is ever repainted.
      const autoSeenRef = React.useRef(null)
      React.useEffect(() => {
        if (autoSeenRef.current === null) {
          autoSeenRef.current = {
            sessions: new Set(), workspaces: new Set(), sessionsSeeded: false, seeded: false,
          }
        }
        const seen = autoSeenRef.current
        const pending = []
        // Sessions: the FIRST authoritative session snapshot that actually
        // carries rows seeds the ledger — a blank row that already existed when
        // the toggle (or this mount) started is pre-existing, so it is recorded
        // WITHOUT being styled. That makes "only items created after you turn it
        // on" exact, and it is the same shape as the workspace seeding below.
        //
        // The seed flag is set only when a snapshot really registered something:
        // a cold-started Host can answer `ready` with an EMPTY list while the
        // real rows are still on their way, and a flag consumed there would style
        // every pre-existing row that shows up next (observed once in eight cold
        // starts). An intermediate snapshot therefore leaves the flag alone and
        // the next populated one seeds instead. `phase` is 'pending' | 'ready' in
        // the Host contract; an older host without the field counts as ready.
        if (list && list.byId && list.phase !== 'pending') {
          let sessionRowsSeen = false
          for (const id of Object.keys(list.byId)) {
            const summary = list.byId[id]
            if (!summary || summary.blank !== true || seen.sessions.has(id)) continue
            sessionRowsSeen = true
            if (!seen.sessionsSeeded) { seen.sessions.add(id); continue }
            seen.sessions.add(id)
            if (!autoStyle || stylingMap['session:' + id]) continue
            const color = autoStyler.nextColor()
            if (color) pending.push(['session:' + id, { color }])
          }
          if (sessionRowsSeen) seen.sessionsSeeded = true
        }
        // Workspaces: same rule — the first authoritative inventory that actually
        // has rows seeds; an empty `ready` snapshot must not consume the flag.
        if (phase === 'ready' && workspaceStreamState !== 'loading') {
          let workspaceRowsSeen = false
          for (const workspace of items || []) {
            const id = workspace ? workspace.workspaceId : undefined
            if (id === undefined || id === null) continue
            workspaceRowsSeen = true
            if (!seen.seeded) { seen.workspaces.add(id); continue }
            if (seen.workspaces.has(id)) continue
            seen.workspaces.add(id)
            if (!autoStyle || stylingMap['workspace:' + id]) continue
            // Colors and icons draw from independent bags; a host that exports
            // none of the pool icons still gets the color.
            const value = {}
            const color = autoStyler.nextColor()
            if (color) value.color = color
            const icon = autoStyler.nextIcon()
            if (icon) value.icon = icon
            if (Object.keys(value).length > 0) pending.push(['workspace:' + id, value])
          }
          if (workspaceRowsSeen) seen.seeded = true
        }
        // One batched write: local store + the host copy in a single update.
        if (pending.length > 0) shared.setStylingMany(pending)
      }, [autoStyle, list ? list.byId : null, items, phase, workspaceStreamState, stylingMap])

      /* --------------- shipped-browser channel (0.1.7-rc.2) --------------- */
      // Read per render, never memoized: the shipped entry registers beside the
      // slot declaration and the ledger must be re-read until it lands.
      const shippedFace = typeof shippedBrowserFace === 'function' ? shippedBrowserFace() : null
      const shortcutChannel = shippedFace && shippedFace.hooks ? shippedFace.hooks.workspaceShortcuts || null : null
      const shortcutCatalog = shippedFace && shippedFace.hooks ? shippedFace.hooks.shortcuts || null : null
      const shortcutState = useObservableSnapshot(shortcutChannel)
      const shortcutRows = useObservableSnapshot(shortcutCatalog)
      const shortcutStateOf = shortcutState && typeof shortcutState === 'object' ? shortcutState : null
      const searchRequest = shortcutStateOf ? shortcutStateOf.searchRequest : 0
      const addRequested = !!(shortcutStateOf && shortcutStateOf.addRequested)
      const forkError = shortcutStateOf ? shortcutStateOf.forkError : null
      const dismissForkError = shippedFace && typeof shippedFace.dismissForkError === 'function'
        ? shippedFace.dismissForkError
        : null
      const closeAddWorkspace = shippedFace && typeof shippedFace.closeAddWorkspace === 'function'
        ? shippedFace.closeAddWorkspace
        : null
      const reportDirectoryBusy = shippedFace && typeof shippedFace.setDirectoryBusy === 'function'
        ? shippedFace.setDirectoryBusy
        : null
      // The shipped schedule mark's seat occupant (see scheduleSeatOf); absent
      // whenever the Schedule overlay is off, which is the shipped default.
      const scheduleSeat = typeof scheduleSeatReader === 'function' ? scheduleSeatReader() : null
      // The shipped session-row seats (official Rows.tsx): row.action
      // occupants render the official pin/archive quick buttons (our own
      // fallback buttons step aside), session.row.hover decorates the hover
      // card. The menu.item seat is deliberately NOT read anymore: its
      // occupants need slot-level inject hooks (useShortcuts on 0.2.1-rc.2)
      // and the in-row menu they anchored was retired in issue #12. All read
      // off the ledger like the schedule mark.
      const seatEntriesOf = typeof seatEntriesReader === 'function' ? seatEntriesReader : null
      const rowActionSeat = seatEntriesOf ? seatEntriesOf('sidebar.workspaces.session.row.action') : []
      const trailingSeat = seatEntriesOf ? seatEntriesOf('sidebar.session.row.trailing') : []
      const hoverSeat = seatEntriesOf ? seatEntriesOf('sidebar.session.row.hover') : []
      /** Effective catalog row of one shipped command (current keybinding, label). */
      const shortcutRowOf = (id) => {
        const rows = Array.isArray(shortcutRows) ? shortcutRows : EMPTY_LIST
        for (const row of rows) if (row && row.id === id) return row
        return null
      }
      /**
       * Feature copy with the command's CURRENT keys appended — the shipped
       * sidebar shows them in its tooltips (Tooltip shortcutKeys) and this
       * surface has no tooltip primitive, so the same information rides the
       * native title/aria-label. Unbound (or an older host without the catalog)
       * keeps the copy alone.
       */
      const shortcutLabel = (label, id) => {
        const row = shortcutRowOf(id)
        const keys = row && Array.isArray(row.keys) ? row.keys : EMPTY_LIST
        return keys.length > 0 ? label + ' (' + keys.join('') + ')' : label
      }
      const shortcutAria = (id) => {
        const row = shortcutRowOf(id)
        return row && typeof row.aria === 'string' && row.aria !== '' ? row.aria : undefined
      }
      /**
       * Shipped-browser copy with this plugin's aligned fallback: the official
       * 'workspace' dictionary is the source of truth (upstream rewording lands
       * without a release), and a host that predates a key keeps the local copy
       * instead of printing the key itself.
       */
      const shippedText = (key, fallback) => {
        if (typeof officialT !== 'function') return fallback
        try {
          const value = officialT(key)
          return typeof value === 'string' && value !== '' && value !== key ? value : fallback
        } catch (error) {
          return fallback
        }
      }
      // Current session across both host generations (see mainSessionIdOf).
      // `current` belongs in the deps: 0.1.5-rc.x switches it without
      // necessarily handing back a new byId, so keying on byId alone would
      // freeze the highlight (and keep filtering blank rows) on those hosts.
      const currentId = React.useMemo(
        () => mainSessionIdOf(list),
        [list ? list.byId : null, list ? list.current : null],
      )
      // Last-known real titles for the cold-restart fallback window (see
      // the title-cache block). Read per render via getSnapshot: no
      // subscription, because a cache write only happens when summary.title
      // exists — at that moment the row already renders the wire truth and
      // no re-render is wanted.
      const remembered = (titleCacheRef && typeof titleCacheRef.getSnapshot === 'function')
        ? (titleCacheRef.getSnapshot().byId || {})
        : {}
      const rememberedTitleOf = (id) => (remembered[id] ? remembered[id].title : undefined)

      // v0.30.2 conversation-following titles: the wire carries no source
      // marker (user vs provider rename), so grafting is shape-based —
      // remembered display (prefix + previous leaves) wins only while the
      // wire title stays group-less. A wire title with "/" and manual
      // renames (renameByUser forgets the display) always stand verbatim.
      const rememberedDisplayOf = (id) => (remembered[id] && typeof remembered[id].display === 'string' ? remembered[id].display : undefined)
      const rowTitleOf = (id, summary, graftedOn) => {
        if (graftedOn) {
          const wire = summary && summary.title
          if (typeof wire === 'string' && wire !== '' && !wire.includes('/')) {
            const shown = rememberedDisplayOf(id)
            if (shown) return shown
          }
        }
        return sessionTitleOf(summary, t, rememberedTitleOf(id))
      }
      // Learn real titles from every snapshot: remember exactly what the
      // wire carried (summary.title), never displayTitle — that is already
      // basename-degraded in the very window this patches. Blank rows are
      // provisional New Sessions and never learn. One plain-object batch
      // call per snapshot (issue #1): unchanged scans cost one loop with
      // zero allocation, real changes schedule one debounced save.
      React.useEffect(() => {
        if (!list || !list.byId) return
        if (titleCacheRef && typeof titleCacheRef.rememberAllTitles === 'function') {
          titleCacheRef.rememberAllTitles(list)
        }
      }, [list ? list.byId : null])

      // Outline color sampler. The outline has to contrast with the LABEL
      // color, and the palette can flip (theme, or a background plugin's
      // light/dark switch) without any React render. So sample the tree's live
      // computed color into --bw-stroke-color: attribute mutations on
      // <html>/<body> catch class- and style-driven flips at once, and the slow
      // poll catches stylesheet-only rewrites (CSSOM variable swaps). Rows with
      // their own color compute the pole in JS and never read the variable.
      const treeRef = React.useRef(null)
      React.useEffect(() => {
        const el = treeRef.current
        if (!el || typeof getComputedStyle !== 'function') return undefined
        let stopped = false
        let pending = null
        const sample = () => {
          if (stopped) return
          try {
            const rgb = parseCssColor(getComputedStyle(el).color)
            if (rgb) el.style.setProperty('--bw-stroke-color', contrastStrokeColor(rgb))
          } catch (error) { /* best effort: the CSS fallback stays in place */ }
        }
        const schedule = () => {
          if (stopped || pending !== null) return
          pending = setTimeout(() => { pending = null; sample() }, 150)
        }
        sample()
        let observer = null
        if (typeof MutationObserver === 'function') {
          observer = new MutationObserver(schedule)
          try {
            observer.observe(document.documentElement, { attributes: true })
            if (document.body && document.body !== document.documentElement) observer.observe(document.body, { attributes: true })
          } catch (error) { /* observing is optional */ }
        }
        const poll = setInterval(sample, 1500)
        return () => {
          stopped = true
          if (pending !== null) clearTimeout(pending)
          clearInterval(poll)
          if (observer) observer.disconnect()
        }
      }, [])

      // Modal surface handoff for dsh-any-background: that plugin sorts dialog
      // surfaces by [aria-labelledby] (settings panels have it; confirm dialogs
      // do not and are pinned OPAQUE by design, exemptDefaultRule). The official
      // ui-primitives Modal never emits aria-labelledby (Modal.tsx: root gets
      // aria-label only, the <h2> has no id), so every Modal-built dialog lands
      // in the confirm bucket and stays solid no matter the sliders. Patch ONLY
      // our own dialogs (recognizable by .bw-modal-body/.bw-modal-actions):
      // point aria-labelledby at the header <h2>. Host confirm dialogs keep
      // their intentional opaque treatment.
      React.useEffect(() => {
        if (typeof MutationObserver !== 'function' || !document.body) return undefined
        let seq = 0
        const sweep = () => {
          const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"][aria-label]:not([aria-labelledby])')
          for (const dlg of dialogs) {
            if (!dlg.querySelector('.bw-modal-body, .bw-modal-actions')) continue
            const heading = dlg.querySelector('h2')
            if (!heading) continue
            if (!heading.id) { seq += 1; heading.id = 'bw-dialog-label-' + seq }
            dlg.setAttribute('aria-labelledby', heading.id)
          }
        }
        const observer = new MutationObserver(sweep)
        observer.observe(document.body, { childList: true, subtree: true })
        sweep()
        return () => observer.disconnect()
      }, [])

      const [query, setQuery] = React.useState('')
      const [searchOpen, setSearchOpen] = React.useState(false)
      const [flowBusy, setFlowBusy] = React.useState(false) // createWorkspace in flight after a pick
      // Occupancy of this surface's directory-flow hole. Since v0.16.0 the
      // occupant is the official backend's client half (native: a renderless
      // OS-chooser driver; browse: the shipped in-app browser), so this only
      // gates the add affordance: an uncomposed host has no way to pick at all.
      const flowAvailable = typeof useDirectoryFlow === 'function' ? useDirectoryFlow(occupied => occupied) : false
      const [dialog, setDialog] = React.useState(null) // { kind, ... }
      // Issue #8: workspaces whose overflow row was clicked this mount.
      // Component-local on purpose (official sessionLimits precedent): a
      // lifted fold resets when the sidebar unmounts.
      const [limitLifted, setLimitLifted] = React.useState({})
      const [ctx, setCtx] = React.useState(null) // context menu { kind, payload, x, y }
      const [copyNotice, setCopyNotice] = React.useState(null) // { seq, ok } copy-session-id notice
      const [customize, setCustomize] = React.useState(null) // { kind, entryKey, name }
      const [errorText, setErrorText] = React.useState(null)
      const [drag, setDrag] = React.useState(null) // { kind: 'workspace'|'session'|'folder', source, over } | null
      // Workspace drags arm their state one frame LATE (see workspaceDragEvents):
      // arming synchronously re-renders during the dragstart dispatch, the chain
      // expansion inserts rows above the drag source, the cursor leaves the
      // source element, and Chromium cancels the whole gesture. dragEnd clears
      // the timer so a same-tick cancel never leaves a ghost drag behind.
      const wsDragArmTimer = React.useRef(null)
      // v0.36.10: Chromium CANCELS a drag whose pointer rests long enough —
      // the mouse-up arrives as dragleave+dragend and 'drop' never fires
      // (probe-measured: resting ~1-2s loses the drop every time). The
      // user reads that as "松手没反应". dragStateRef mirrors {drag} for a
      // dragEnd fallback that honors the armed {over}; dragDroppedRef
      // tells dragEnd a real drop already committed; Escape still cancels.
      const dragStateRef = React.useRef(null)
      const dragDroppedRef = React.useRef(false)
      const dragCancelledRef = React.useRef(false)
      React.useEffect(() => { dragStateRef.current = drag }, [drag])
      React.useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape') dragCancelledRef.current = true }
        window.addEventListener('keydown', onKey, true)
        return () => window.removeEventListener('keydown', onKey, true)
      }, [])
      // (v0.36.3) The 600ms group-hover auto-expand is retired: it kept
      // opening groups under a passing cursor ("变下级会被撑开"). The
      // deterministic reveal now lives in commitFolderMoveInto — the target
      // group opens when the members actually land.
      // (v0.36.4) The hover-intent arming is retired. It made the reorder
      // slot appear only after a ~200ms rest on the band, so a normal drag
      // across a group row showed the thin insert line and never the empty
      // slot — the user report "还是一条蓝线,没拨开让我插入". The edge bands
      // are 30% wide and geometrically judged, so they can answer at once.
      // Quote-on-land eligibility sets (mount-scoped):
      // - blankSeen: ids observed BLANK in any snapshot. A blank row is a
      //   freshly created New Session, so ONLY these may ever receive an
      //   automatic quote. A titled row missing from blankSeen — rows that
      //   stream into the store after mount, fork children (born titled),
      //   rows hidden by load-time filtering — predates this mount or was
      //   named deliberately, and is NEVER touched. (0.9.1 keyed "fresh" off
      //   the first snapshot instead, so late-arriving OLD sessions were
      //   misquoted; blank is the only trustworthy birth mark.)
      // - humanTouched: ids renamed through THIS component's user actions
      //   (rename dialog, drag into a group, group prefix rewrite). A
      //   user-written "/" is a deliberate grouping; a user-written quote
      //   pair is the verbatim escape. The host pins user titles (a later
      //   automatic name is superseded), so the mark is final.
      // - autoStable: id → { title, since } for freshly landed automatic
      //   titles waiting out the stabilization window below.
      const blankSeenRef = React.useRef(null)
      const humanTouchedRef = React.useRef(null)
      const autoStableRef = React.useRef(null)
      const stableTimerRef = React.useRef(null)
      const [stableTick, setStableTick] = React.useState(0)
      // The wire cannot tell the deterministic fallback title (first user
      // message echo, "/"-prone) from the async LLM name that replaces it
      // seconds later — SessionSummary carries no source field. So a landed
      // "/"-bearing title is quoted only after it survives 20s unchanged;
      // any rename resets the window, and the common slash-free LLM name
      // simply releases the session untouched. Only the "new session
      // auto-title stayed slashy" case gets wrapped.
      const TITLE_STABLE_MS = 20000

      // User-driven renames funnel through here: mark first so the
      // quote-on-land effect never second-guesses a deliberate title.
      const renameByUser = (sessionId, title) => {
        if (humanTouchedRef.current === null) humanTouchedRef.current = new Set()
        humanTouchedRef.current.add(String(sessionId))
        if (autoStableRef.current) autoStableRef.current.delete(String(sessionId))
        // A manual rename is authoritative: forget any grafted display so
        // the fresh wire title stands verbatim (no prefix re-applied).
        if (titleCacheRef && typeof titleCacheRef.forgetDisplay === 'function') titleCacheRef.forgetDisplay(String(sessionId))
        return renameSession(sessionId, title)
      }

      /* ------------ shipped-browser requests (dsh 0.1.7-rc.2) ------------ */
      // The shipped shortcut layer resolves session.search / workspace.add into
      // the shipped browser's private request store, whose only consumer is that
      // component's effect — shadowed here, so this plugin consumes the same
      // channel (see shippedBrowserFaceOf). Behavior mirrors the shipped
      // consumer: the search request opens and focuses the field (this tree
      // filters locally, which is this plugin's documented search surface), and
      // the add request runs the same flow as the header button. The focus is
      // deferred one render because the field mounts with the state flip.
      const [focusPending, setFocusPending] = React.useState(false)
      const searchInputRef = React.useRef(null)
      const startAddFlowRef = React.useRef(null)
      React.useEffect(() => {
        if (searchRequest === 0) return
        if (typeof closeAddWorkspace === 'function') closeAddWorkspace()
        // The shipped consumer expands the rail first: the field only exists in
        // the wide header, so the request has to surface the sidebar to land.
        if (!wide && typeof expandSidebar === 'function') expandSidebar()
        setSearchOpen(true)
        setFocusPending(true)
      }, [searchRequest])
      React.useEffect(() => {
        if (!focusPending) return
        const field = searchInputRef.current
        if (!field) return
        try { field.focus({ preventScroll: true }) } catch (error) { field.focus() }
        setFocusPending(false)
      }, [focusPending, searchOpen])
      React.useEffect(() => {
        if (!addRequested) return
        // Clear the request first: the flow is asynchronous and a re-render
        // during it must not start a second one.
        if (typeof closeAddWorkspace === 'function') closeAddWorkspace()
        const flow = startAddFlowRef.current
        if (typeof flow === 'function') flow()
      }, [addRequested])
      // The fork notification belongs to the shipped browser's own overlay,
      // which is shadowed with it; without this the shortcut's async failure
      // would be silent. Dismissal rides the shipped channel so both surfaces
      // agree on the notice's lifetime. dsh 0.2.1-alpha.5 retired the
      // forkError state (a frame-level shortcutForkFailed toast replaced it),
      // so on current hosts this mirror idles — the typeof defenses keep it
      // alive for rc.2-era hosts that still report the field.
      React.useEffect(() => {
        if (forkError === null || forkError === undefined) return
        const timer = setTimeout(() => {
          if (typeof dismissForkError === 'function') dismissForkError()
        }, 6000)
        return () => clearTimeout(timer)
      }, [forkError ? forkError.seq : null])
      // The copy notice normally self-dismisses (the official toast calls
      // onDone; the fallback chip rides this cap). Keyed on seq so a second
      // copy restarts the window.
      React.useEffect(() => {
        if (!copyNotice) return
        const timer = setTimeout(() => setCopyNotice(null), 6000)
        return () => clearTimeout(timer)
      }, [copyNotice ? copyNotice.seq : null])

      React.useEffect(() => {
        if (!list || !list.byId || typeof renameSession !== 'function') return
        if (blankSeenRef.current === null) blankSeenRef.current = new Set()
        if (humanTouchedRef.current === null) humanTouchedRef.current = new Set()
        if (autoStableRef.current === null) autoStableRef.current = new Map()
        const blankSeen = blankSeenRef.current
        const touched = humanTouchedRef.current
        const stable = autoStableRef.current
        const now = Date.now()
        const fixes = []
        let deadline = Infinity
        for (const id of Object.keys(list.byId)) {
          const summary = list.byId[id]
          if (!summary) continue
          if (summary.blank) { blankSeen.add(id); stable.delete(id); continue }
          if (!blankSeen.has(id) || touched.has(id)) { stable.delete(id); continue }
          const text = String(summary.title || '')
          if (text.trim() === '' || text.includes('“') || text.includes('"') || !text.includes('/')) {
            stable.delete(id) // quoted already, or the LLM name arrived slash-free: done
            continue
          }
          // v0.37.3: a path-shaped title is already ONE row at render time
          // (titleQuotesPath). Renaming it here would append a USER title and
          // supersede an asynchronous LLM name that has not landed yet, so the
          // fallback would stay pinned as a raw path. Leave it to the host.
          if (titleQuotesPath(text)) {
            stable.delete(id)
            continue
          }
          const prev = stable.get(id)
          if (prev && prev.title === text) {
            if (now - prev.since >= TITLE_STABLE_MS) {
              stable.delete(id)
              fixes.push([id, '“' + text + '”'])
            } else {
              deadline = Math.min(deadline, prev.since + TITLE_STABLE_MS)
            }
            continue
          }
          stable.set(id, { title: text, since: now }) // new landing or fallback→LLM rename: reset
          deadline = Math.min(deadline, now + TITLE_STABLE_MS)
        }
        for (const id of Array.from(stable.keys())) {
          if (!list.byId[id]) stable.delete(id) // session vanished (archived/deleted): drop the wait
        }
        if (stableTimerRef.current !== null) { clearTimeout(stableTimerRef.current); stableTimerRef.current = null }
        if (deadline !== Infinity) {
          stableTimerRef.current = setTimeout(() => {
            stableTimerRef.current = null
            setStableTick(t => t + 1) // re-evaluate through the effect, never rename from a stale closure
          }, Math.max(1, deadline - now))
        }
        if (fixes.length === 0) return
        Promise.resolve()
          .then(async () => { for (const [id, next] of fixes) await renameSession(id, next) })
          .catch(() => { /* display-layer fallback keeps the row flat; a later snapshot re-evaluates */ })
      }, [list, stableTick])
      React.useEffect(() => () => {
        if (stableTimerRef.current !== null) clearTimeout(stableTimerRef.current)
      }, [])
      const normalizedQuery = query.trim().toLowerCase()
      const now = Date.now()

      // v0.36.4: no setFlowOpen here. flowOpen belongs to the PICKER component
      // (WorkspacePicker), not to this browser: referencing it from here threw
      // 'ReferenceError: setFlowOpen is not defined' on every failure path —
      // including the .catch(fail) of a group move-into, which then silently
      // aborted the rename ('变下级没反应').
      const fail = (text) => { setDialog(null); setErrorText(String(text || 'unknown error')) }

      const styleEntry = (key) => stylingMap[key] || null
      // Effective appearance = the settings card's default, overridden field by
      // field by this row's own entry.
      const defaultAppearance = readAppearance(prefsMap.appearance)
      const appearanceOf = (key) => mergeAppearance(defaultAppearance, styleEntry(key))
      const rowStyleOf = (key) => {
        const appearance = appearanceOf(key)
        // `auto:N` tokens resolve against the LIVE theme here, which is what makes
        // a theme flip re-colour every auto-assigned row. `autoDarkTheme` is the
        // subscribed snapshot, passed explicitly: reading the DOM would give the
        // same value, but only the subscription guarantees the repaint.
        const color = resolveColorValue(appearance.color || '', autoDarkTheme)
        const glow = Number(appearance.glow) || 0
        const weight = Number(appearance.weight) || 0
        const shadow = appearance.shadow === true
        const shadows = []
        if (glow > 0 && color) shadows.push('0 0 ' + glow + 'px ' + color)
        if (shadow) shadows.push('1px 1px 2px rgba(0,0,0,.85)')
        const style = {}
        if (color) style.color = color
        if (weight > 0) style.fontWeight = weight
        if (shadows.length > 0) style.textShadow = shadows.join(',')
        const stroke = strokeStyleOf(appearance)
        if (stroke) Object.assign(style, stroke)
        return Object.keys(style).length > 0 ? style : null
      }
      const keyOf = (kind, payload) => {
        // Render keys folders by idPath (renderPlainFolder), which prefixes
        // the ws id to disambiguate same-named groups across disk levels;
        // saving by payload.path alone made sub-level group styling
        // unreachable (name-slash group appearance never applied).
        if (kind === 'folder') return 'folder:' + (payload.idPath || payload.path)
        if (kind === 'workspace') return 'workspace:' + payload.workspaceId
        if (kind === 'session') return 'session:' + payload.id
        if (kind === 'sgroup') return 'sgroup:' + payload.workspaceId + '|' + payload.path
        return String(kind)
      }

      const accounted = new Set()
      for (const workspace of items || []) for (const id of workspace.sessionIds || []) accounted.add(id)
      const ungrouped = []
      if (list && Array.isArray(list.ids)) {
        for (const id of list.ids) {
          const summary = list.byId[id]
          if (accounted.has(id) || !sessionVisible(summary, currentId, archivedSet, archivedFilter)) continue
          const st = statusOf(id)
          ungrouped.push({
            id,
            title: rowTitleOf(id, summary, prefsMap.graftTitlePrefix !== false),
            leaf: rowTitleOf(id, summary, prefsMap.graftTitlePrefix !== false),
            blank: !!summary.blank,
            running: (st && st.running === true) || !!summary.running,
            completed: summary.completed === true || (st && st.completionUnread === true),
            hasActiveSchedule: hasActiveScheduleOf(summary),
            subagents: subCounts.get(id) || 0,
            updatedAt: summary.updatedAt || 0,
            pending: visiblePendingKind(st && st.pendingInteraction && st.pendingInteraction.kind) || pendingKindOf(pending, id),
            pinned: pinnedSet.has(id) && !archivedSet.has(id),
            archived: archivedSet.has(id),
          })
        }
        ungrouped.sort((a, b) => b.updatedAt - a.updatedAt)
        pinnedPartitionInPlace(ungrouped)
      }

      // (v0.36.4) The drag-time chain EXPANSION is retired. Suspending the
      // merge while a workspace was dragged re-exposed every single-child
      // chain as folder rows, so the tree visibly re-laid itself one frame
      // after dragstart and every drop target below the source shifted —
      // the user report "拖拽中树会乱/落点漂移". Drop targets are now
      // answered by the stable render; nothing re-flows mid-drag.
      const tree = React.useMemo(() => {
        // v0.36.11: "workspaces" (groupBy === 'workspace') turns OFF disk
        // nesting — official semantics — but the NAME tree stays on when the
        // user enabled one (workspaceGroupMode !== 'disk'). A plain buildTree
        // mode of 'slash' expresses exactly that: name groups at the root,
        // every workspace at the top, entry.sub always null.
        const treeMode = groupBy === 'workspace' && workspaceGroupMode !== 'disk'
          ? 'slash'
          : workspaceGroupMode
        const built = buildTree(items, treeMode, wsFolders, folderOrderMap)
        if (!compactChains) return built
        const folders = built.folders.map((f) => materializeChain(compressTree(f)))
        // v0.36.5: keep the MIXED root sequence across chain compression —
        // the compressed node stands in for the raw folder it came from, so
        // a bare workspace stays interleaved where the user put it.
        const byName = new Map()
        for (let i = 0; i < built.folders.length; i += 1) byName.set(built.folders[i].name, folders[i])
        const seq = Array.isArray(built.seq)
          ? built.seq.map((item) => item.kind === 'folder' ? { kind: 'folder', node: byName.get(item.node.name) || item.node } : item)
          : built.seq
        return { ...built, folders, workspaces: built.workspaces, seq }
      }, [items, compactChains, groupBy, workspaceGroupMode, wsFolders, folderOrderMap])
      // UNCOMPRESSED tree, for the new-group dialog only. compressTree merges a
      // single-child chain into one row that stands for BOTH a group and the
      // workspace under it — fine for drawing, useless for choosing a
      // container: one half must stay unselectable and the other must be
      // selectable, and a merged row cannot be both. (It also carried no
      // `name`, which is how a lone "E" rendered blank.)
      // v0.36.11: same groupBy-aware mode as the rendered tree — the
      // new-group dialog must mirror the hierarchy the user actually sees.
      const rawTree = React.useMemo(() => buildTree(
        items,
        groupBy === 'workspace' && workspaceGroupMode !== 'disk' ? 'slash' : workspaceGroupMode,
        wsFolders,
        folderOrderMap,
      ), [items, groupBy, workspaceGroupMode, wsFolders, folderOrderMap])
      // Disk-layer ancestry for drag semantics (same derivation as buildTree).
      const diskParentMap = React.useMemo(() => diskParentMapOf(items), [items])

      /** Browser-local flat session order for one workspace (fallback channel). */
      const sessionOrderOf = (workspaceId) => {
        const map = sessionOrderMap && typeof sessionOrderMap === 'object' ? sessionOrderMap : {}
        const list = map[workspaceId]
        return Array.isArray(list) ? list : []
      }

      const sessionsOf = (workspace) => {
        const rows = []
        for (const id of workspace.sessionIds || []) {
          const summary = list && list.byId ? list.byId[id] : undefined
          if (!sessionVisible(summary, currentId, archivedSet, archivedFilter)) continue
          const st = statusOf(id)
          rows.push({
            id,
            title: rowTitleOf(id, summary, prefsMap.graftTitlePrefix !== false),
            leaf: rowTitleOf(id, summary, prefsMap.graftTitlePrefix !== false),
            blank: !!summary.blank,
            running: (st && st.running === true) || !!summary.running,
            completed: summary.completed === true || (st && st.completionUnread === true),
            hasActiveSchedule: hasActiveScheduleOf(summary),
            subagents: subCounts.get(id) || 0,
            updatedAt: summary.updatedAt || 0,
            pending: visiblePendingKind(st && st.pendingInteraction && st.pendingInteraction.kind) || pendingKindOf(pending, id),
            pinned: pinnedSet.has(id) && !archivedSet.has(id),
            archived: archivedSet.has(id),
          })
        }
        // Browser-local reorder fallback (dsh 0.1.6-alpha.1 stopped injecting
        // insertSessionBefore): the local flat order wins for the workspaces the
        // user dragged in, and is empty everywhere else — so a host that still
        // exposes the action keeps its authoritative order untouched.
        // Host order stays authoritative wherever the action exists.
        // Recency ordering (v0.13 view option, official orderBy semantics):
        // updatedAt descending with an id tie-break, and the CURRENT blank
        // session — the provisional New Session row — pinned on top. Purely
        // presentational: nothing is persisted, the host order is untouched,
        // and drag-to-reorder anchors are suppressed while active (an order
        // the very next render would re-sort is a lie).
        if (orderBy === 'updated') return orderSessionsByRecency(rows, currentId)
        const local = typeof insertSessionBefore === 'function' ? [] : sessionOrderOf(workspace.workspaceId)
        if (local.length === 0) return pinnedPartition(rows)
        const remaining = new Map(rows.map((row) => [row.id, row]))
        const out = []
        for (const id of local) {
          const row = remaining.get(id)
          if (row) { out.push(row); remaining.delete(id) }
        }
        for (const row of rows) if (remaining.has(row.id)) out.push(row)
        return pinnedPartition(out)
      }

      // Search flattens BOTH layers depth-first: every workspace (top level,
      // name groups, disk-nested levels alike) becomes an independent
      // candidate row; matches render at the top level. The name-group
      // structure is a display aid, not a search dimension.
      const searchCandidates = []
      {
        const collect = (node) => {
          for (const folder of node.folders) collect(folder)
          for (const w of node.workspaces) {
            searchCandidates.push(w)
            if (w.sub) collect(w.sub)
          }
        }
        collect(tree)
      }
      const searched = []
      if (normalizedQuery) {
        for (const w of searchCandidates) {
          const sessions = sessionsOf(w)
          const wsHit = w.leaf.toLowerCase().includes(normalizedQuery) || w.title.toLowerCase().includes(normalizedQuery)
          if (wsHit || sessions.some((s) => s.title.toLowerCase().includes(normalizedQuery))) {
            searched.push({ workspace: w })
          }
        }
      }
      const searching = normalizedQuery !== ''

      /* --------------------- status breathing relay -------------------- */

      // Highest-priority status across a whole session subtree (groups + rows).
      const nodePulseOf = (sessionNode) => {
        let best = null
        for (const group of sessionNode.groups || []) {
          const s = nodePulseOf(group)
          if (pulseRank(s) > pulseRank(best)) best = s
        }
        for (const row of sessionNode.sessions || []) {
          const s = relayStateOf(row)
          if (pulseRank(s) > pulseRank(best)) best = s
        }
        return best
      }
      // A COLLAPSED workspace row relays everything it hides — its session
      // tree AND its disk-nested child levels.
      const wsAllPulseOf = (workspace) => {
        if (!statusPulse || searching) return null
        let best = nodePulseOf(buildSessionTree(sessionsOf(workspace), sessionSlash, sessFolders, workspace.workspaceId))
        if (workspace.sub) {
          for (const folder of workspace.sub.folders) {
            const s = folderPulseOf(folder)
            if (pulseRank(s) > pulseRank(best)) best = s
          }
          for (const w of workspace.sub.workspaces) {
            const s = wsAllPulseOf(w)
            if (pulseRank(s) > pulseRank(best)) best = s
          }
        }
        return best
      }
      const wsPulseOf = (workspace) => (!statusPulse || searching || sessionsOpenOf(workspace.workspaceId))
        ? null
        : wsAllPulseOf(workspace)
      const folderPulseOf = (node) => {
        if (node.kind === 'ws') return wsAllPulseOf(node.workspace)
        let best = null
        for (const child of node.folders) {
          const s = folderPulseOf(child)
          if (pulseRank(s) > pulseRank(best)) best = s
        }
        for (const w of node.workspaces) {
          const s = wsAllPulseOf(w)
          if (pulseRank(s) > pulseRank(best)) best = s
        }
        return best
      }

      const folderExpanded = (path) => (expandedMap ? expandedMap[path] !== false : true)
      const sessionsOpenOf = (workspaceId) => (sessionsExpandedMap ? sessionsExpandedMap[workspaceId] !== false : true)
      const sessionGroupOpen = (key) => (sessionGroupsMap ? sessionGroupsMap[key] !== false : true)

      // Keyboard triggers carry clientX/clientY = 0. Mirror the shared menu's
      // own trigger: (0,0) anchors the popup at the focused row's bottom-left
      // instead of the viewport corner. Pointer events pass their point
      // through untouched.
      const menuPointOf = (e) => {
        const x = e && Number.isFinite(e.clientX) ? e.clientX : 0
        const y = e && Number.isFinite(e.clientY) ? e.clientY : 0
        if (x !== 0 || y !== 0) return { x, y }
        const target = e && e.currentTarget
        const rect = target && typeof target.getBoundingClientRect === 'function' ? target.getBoundingClientRect() : null
        return rect ? { x: rect.left, y: rect.bottom } : { x, y }
      }
      const openCtx = (kind, payload, e) => {
        if (e) e.preventDefault()
        const point = menuPointOf(e)
        // dsh 0.2.2-alpha.3: session and workspace are official target
        // families, so the shared popup owns their entries (official ones
        // plus our order-700 extras). Folder/session-group rows are virtual
        // objects with no official family and keep the local menu. Hosts
        // without the service keep the local menu for everything.
        if (e && (kind === 'session' || kind === 'workspace')) {
          const face = typeof contextMenuFaceOf === 'function' ? contextMenuFaceOf() : null
          if (face && typeof face.open === 'function') {
            try {
              if (kind === 'session') {
                face.open({
                  kind: 'session',
                  value: { sessionId: payload.id, displayTitle: String(payload.title || '') },
                }, point)
              } else {
                face.open({
                  kind: 'workspace',
                  value: {
                    workspaceId: payload.workspaceId,
                    path: String(payload.path || ''),
                    displayTitle: String(payload.title || payload.leaf || ''),
                  },
                }, point)
              }
              setCtx(null)
              return
            } catch (error) {
              console.warn('[dsh-better-workspace] official context menu open failed; using local menu', error)
            }
          }
        }
        setCtx({ kind, payload, ...point })
      }

      // Session-action surface (v0.20.0, official mirror): the right-click
      // menu, the hover "..." trigger, and the pin/archive quick buttons all
      // drive the same calls the official row entries make — pin/unpin and
      // unarchive go straight to the uiWorkspace service; archive raises the
      // stop-and-archive confirmation when the Host refuses a running
      // session (WorkspaceArchiveError, workspace/session-active). Copy rides
      // the official 'workspace' dictionary (auto-rewording), with graceful
      // degradation on hosts that lack a key.
      const officialText = (key, params, fallback) => {
        const value = typeof officialT === 'function' ? officialT(key, params) : null
        return typeof value === 'string' && value !== '' && value !== key ? value : fallback
      }

      // Official hover-card bodies (Rows.tsx WorkspaceHoverContent /
      // SessionHoverContent): the palette is FIXED in the shipped card
      // (#FFFFFF title, #CFD3D6 meta, #ADB2B8 status), and the copy rides
      // the official 'workspace' dictionary; a missing key degrades to the
      // aligned bw time label.
      const workspaceHoverBody = (workspace) => E('div', { className: 'bw-hover-card' },
        E('div', { className: 'bw-hover-title' }, workspace.title || workspace.leaf),
        workspace.path ? E('div', { className: 'bw-hover-path' }, workspace.path) : null,
      )
      const sessionHoverTime = (node) => {
        if (typeof ui.relativeTime !== 'function') return timeLabel(node.updatedAt, now, t)
        const r = ui.relativeTime(node.updatedAt, now)
        if (!r) return ''
        if (r.unit === 'now') return officialText('time.now', undefined, t('time.now'))
        const inner = officialText('time.' + r.unit, { n: r.n }, timeLabel(node.updatedAt, now, t))
        const ago = officialText('time.ago', { t: inner }, null)
        return ago || inner
      }
      const sessionHoverBody = (node, status) => E('div', { className: 'bw-hover-card' },
        E('div', { className: 'bw-hover-title' }, node.leaf || node.title),
        !node.blank ? E('div', { className: 'bw-hover-time' }, sessionHoverTime(node)) : null,
        // The shipped session.hover decorations render inside the card,
        // like the official renderSlot('sidebar.session.row.hover').
        ...(Array.isArray(hoverSeat) ? hoverSeat.map((seat, index) => E(QuietBoundary, { key: 'hover-seat-' + index }, E(ShippedSeatOccupant, {
          seat,
          ownerProps: { sessionId: node.id },
          standardProps: sessionActions ? sessionActions.standardProps : null,
          t: seat.t,
        }))) : []),
        status && typeof ui.StateDot === 'function' ? E('div', { className: 'bw-hover-status' },
          E(ui.StateDot, { state: status.state }), E('span', null, status.title)) : null,
        node.archived && officialText('row.archived', undefined, '')
          ? E('div', { className: 'bw-hover-status' }, icon('IconArchiveOutline20', 14), E('span', null, officialText('row.archived', undefined, '')))
          : null,
      )
      const pinAvailable = typeof pinSession === 'function' && typeof unpinSession === 'function'
      const unarchiveAvailable = typeof unarchiveSession === 'function'
      const sessionActions = {
        ot: officialT,
        // Right-click is the only ctx trigger: the in-row "..." affordances
        // are retired (session row in v0.35.0, workspace row likewise).
        quick: rowActionsEnabled,
        pin: pinAvailable
          ? (id, pinning) => {
            Promise.resolve().then(() => (pinning ? pinSession : unpinSession)(id)).catch((reason) => {
              fail(officialText(pinning ? 'toast.pinFailed' : 'toast.unpinFailed', undefined, reason instanceof Error ? reason.message : String(reason || 'pin failed')))
            })
          }
          : undefined,
        archive: typeof archiveSession === 'function'
          ? (id, archiving) => {
            if (!archiving) {
              if (!unarchiveAvailable) return
              Promise.resolve().then(() => unarchiveSession(id)).catch((reason) => { console.warn('session unarchive rejected:', reason) })
              return
            }
            Promise.resolve().then(() => archiveSession(id)).catch((reason) => {
              // Official refusal flow: running work refuses the plain archive
              // (WorkspaceArchiveError / workspace/session-active) and the
              // confirmation offers to stop it first. Anything else reports
              // through the error modal.
              if (reason && reason.name === 'WorkspaceArchiveError') {
                setDialog({ kind: 'sess-archive-confirm', sessionId: id })
                return
              }
              fail(reason)
            })
          }
          : undefined,
        openMenu: (node, e) => openCtx('session', node, e),
        // Row-trailing quick actions: the shipped row.action seat carries the
        // official pin/archive buttons; our own buttons render only where the
        // seat is empty. The in-row "..." menu is RETIRED (issue #12 — its
        // menu.item occupants need slot-level inject hooks an in-row
        // reproduction cannot supply); the context menu keeps every entry
        // through sessionMenuEntriesFor + handleCtxPick.
        standardProps: seatStandardProps,
        rowActionSeat,
        trailingSeat,
        rename: (node) => setDialog({ kind: 'sess-rename', session: node }),
        hoverBody: (node, status) => sessionHoverBody(node, status),
        explainArchived: () => {
          const text = officialText('toast.archivedNotOpenable', undefined, '') || officialText('row.archived', undefined, '')
          if (text) setErrorText(text)
        },
      }

      /* ----------------------- group move helpers --------------------- */
      // Grouping is a NAME PROJECTION (v0.12.0 retired explicit empty
      // groups): a "group" is nothing but the slash-prefix of a title, so
      // moving an entry means rewriting that prefix — no store key, no
      // persistence, no schema. Everything below is derived from titles.

      const groupPrefixOf = (title) => {
        const s = splitTitleSegs(String(title || ''))
        return s.length > 1 ? s.slice(0, -1).join('/') : ''
      }
      const leafOf = (title, fallback) => {
        const s = splitTitleSegs(String(title || ''))
        return s.length > 0 ? s[s.length - 1] : (fallback || String(title || ''))
      }
      /**
       * Retitle `title` so its leaf lands in the group `anchorTitle` lives in
       * (v0.18.0). '' as the anchor group means the root level. Used by the
       * cross-group session drop: the visible order of session rows is decided
       * by these groups, so a drop that only reorders the flat list would leave
       * the row exactly where it was.
       */
      const titleMovedToGroup = (title, anchorTitle) => {
        const leaf = leafOf(title)
        const group = groupPrefixOf(anchorTitle)
        if (!group) return leaf
        // A path-shaped leaf stays ONE opaque row (titleQuotesPath), so an
        // unwrapped prefix would never become a visible group. Quote the leaf
        // — the same convention quote-on-land uses — and the prefix splits
        // while the path stays verbatim inside the quotes.
        const safe = titleQuotesPath(leaf) ? '“' + leaf + '”' : leaf
        return group + '/' + safe
      }
      /**
       * Every existing group path, deduplicated (datalist source). `kind`
       * narrows it to the name layer the dialog is about: workspace rows
       * suggest workspace prefixes, session rows session prefixes; the
       * header picker takes both because it may target either kind.
       *
       * Called ONCE when a dialog opens and snapshotted onto the dialog state,
       * never during render: this walks every workspace and session title, so a
       * render-time call would redo that walk on every store tick (~44/s while
       * an agent runs). Same reason `targets` is snapshotted -- see the 0.9.6
       * lesson in AGENTS.md invariant 6.
       */
      const collectGroupPaths = (kind) => {
        const paths = new Set()
        const addPrefixes = (title) => {
          const segs = splitTitleSegs(String(title || ''))
          for (let i = 1; i < segs.length; i += 1) paths.add(segs.slice(0, i).join('/'))
        }
        for (const workspace of items || []) {
          if (kind !== 'session') addPrefixes(workspace.title)
          if (kind !== 'workspace') for (const session of sessionsOf(workspace)) addPrefixes(session.title)
        }
        return [...paths].sort()
      }
      /**
       * Which name layer the header picker may target. The two switches gate
       * independently, so the picker narrows to whichever layer is ON; the
       * button itself disappears entirely when neither is (see the header).
       */
      const pickerKindOf = () => workspaceSlash && sessionSlash ? undefined : (workspaceSlash ? 'workspace' : 'session')
      // The header button opens "new group" (v0.17.0); its wording and its
      // default layer follow which name layers are live. With workspaces
      // disk-only there is no workspace-group layer to create into, so the
      // default is the session layer — and a single live layer means no switch.
      const newGroupLayers = () => (workspaceSlash && sessionSlash ? ['session', 'workspace'] : (workspaceSlash ? ['workspace'] : ['session']))
      const defaultNewGroupLayer = () => (workspaceSlash && !sessionSlash ? 'workspace' : 'session')
      const newGroupLabel = () => (workspaceSlash && sessionSlash ? t('group.new.both') : (workspaceSlash ? t('group.new.ws') : t('group.new.sess')))

      // Container trees for the new-group dialog. Each node carries the exact
      // write target: `scope` is the store's bags key (the disk level's idPrefix
      // for workspaces, the workspaceId for sessions) and `path` is the parent
      // group's name path — the dialog appends the new name to it.
      // Workspace-GROUP containers: name-group folders only, never the
      // workspaces themselves. A workspace title is "group/leaf", so with
      // members A/B, A/C, D and E/F the only groups that exist are A and E —
      // B, C, D and F are leaves (they are workspaces, not containers), and
      // offering them would invite a group named after a leaf. Disk nesting is
      // a workspace fact too, so it is skipped for the same reason.
      const wsFolderNodesOf = (node) => (node.folders || []).map((f) => ({
        id: f.scope + '|' + f.path, scope: f.scope, path: f.path, label: folderLabelOf(f), kind: 'folder',
        children: wsFolderNodesOf(f),
      }))
      const sessGroupNodesOf = (node, workspaceId) => (node.groups || []).map((g) => ({
        id: workspaceId + '|' + g.path, scope: workspaceId, path: g.path, label: g.name, kind: 'sgroup',
        children: sessGroupNodesOf(g, workspaceId),
      }))
      const newGroupTreeOf = (kind) => {
        // The container tree MIRRORS the sidebar's current view mode (v0.17.1):
        // "workspace tree" offers the real hierarchy (disk nesting + name
        // groups); the one-level modes ("workspaces" / "flat") render no
        // hierarchy to mirror, so they fall back to a flat workspace list.
        // Offering a nesting the sidebar is not showing would be a lie about
        // where the new group lands.
        // v0.36.11: "workspaces" + an enabled name layer shows a root-level
        // name tree — mirror it instead of claiming there is no hierarchy.
        const treeView = groupBy === 'workspace-tree'
          || (groupBy === 'workspace' && workspaceGroupMode !== 'disk')
        if (kind === 'workspace') {
          // "Top level" IS a real target here (a group at the root of the
          // workspace tree), so it is a node like any other.
          // A dedicated top-level row, not a root node that both expands AND
          // accepts the new name: that read as "pick a spot inside the top
          // level", and it left no way to say "give me a group NEXT TO A and
          // E". The row below is that way, and A / E sit beside it as the
          // top-level groups they actually are.
          const groups = treeView ? wsFolderNodesOf(rawTree) : []
          return {
            hint: t('group.new.where'),
            // The "top level" row sits LAST (user's call): it reads as "and
            // here is one more, belonging to none of the above" instead of as
            // a header the others hang under.
            nodes: [...groups, { id: '@top', scope: '', path: '', label: t('group.new.independent'), kind: 'new', children: [] }],
          }
        }
        // A session group lives INSIDE one workspace (folders.sess is keyed by
        // workspaceId), so there is no "top level" to declare into — the
        // workspace tree IS the top level, introduced by a plain hint rather
        // than wrapped in a fake root node (a header row that looked like a
        // tree node read as a container you could pick).
        //
        // The walk follows the SAME tree the sidebar renders (disk nesting
        // included), not the flat registry list: a child workspace must appear
        // nested under its parent exactly as it does in "workspace tree" view.
        // Name-group folders are containers here — a session group cannot be
        // filed against one (they carry no workspaceId) — so they expand but
        // refuse selection.
        const sessNodesOf = (node) => {
          const out = []
          for (const f of node.folders || []) {
            out.push({ id: f.scope + '|' + f.path, scope: '', path: '', label: folderLabelOf(f), kind: 'folder', pickable: false, children: sessNodesOf(f) })
          }
          for (const w of node.workspaces || []) {
            const inner = sessGroupNodesOf(buildSessionTree(sessionsOf(w), sessionSlash, sessFolders, w.workspaceId), w.workspaceId)
            const subNodes = w.sub ? sessNodesOf(w.sub) : []
            out.push({
              id: w.workspaceId + '|', scope: w.workspaceId, path: '', label: w.leaf || w.title, kind: 'ws',
              children: [...inner, ...subNodes],
            })
          }
          return out
        }
        if (treeView) return { hint: t('group.new.pickWorkspace'), nodes: sessNodesOf(rawTree) }
        // One-level modes: every workspace sits at the root, exactly as the
        // sidebar draws it (raw items — there is no .sub level to nest here).
        const flat = []
        for (const w of items) {
          const inner = sessGroupNodesOf(buildSessionTree(sessionsOf(w), sessionSlash, sessFolders, w.workspaceId), w.workspaceId)
          flat.push({ id: w.workspaceId + '|', scope: w.workspaceId, path: '', label: w.leaf || w.title, kind: 'ws', children: inner })
        }
        return { hint: t('group.new.pickWorkspace'), nodes: flat }
      }
      /**
       * Picker entries for the header button: every workspace, then its
       * sessions — each list present only while its OWN name layer is on, so
       * the dropdown never offers a container the tree cannot render.
       */
      const targetListOf = () => {
        const out = []
        for (const workspace of items || []) {
          const name = String(workspace.title || workspace.leaf || workspace.workspaceId || '')
          if (workspaceSlash) out.push({ value: 'ws:' + workspace.workspaceId, label: name })
          if (sessionSlash) for (const session of sessionsOf(workspace)) {
            out.push({ value: 'sess:' + session.id, label: name + ' › ' + String(session.title || session.leaf || '') })
          }
        }
        return out
      }
      /** Rehydrate one 'ws:<id>' / 'sess:<id>' picker value (null when the row vanished). */
      const targetOfValue = (value) => {
        const text = String(value || '')
        if (text.startsWith('sess:')) {
          const id = text.slice(5)
          for (const workspace of items || []) {
            const row = sessionsOf(workspace).find((s) => s.id === id)
            if (row) return { kind: 'session', id: row.id, title: row.title, workspaceId: workspace.workspaceId }
          }
          return null
        }
        if (text.startsWith('ws:')) {
          const id = text.slice(3)
          const workspace = (items || []).find((w) => w.workspaceId === id)
          if (workspace) return { kind: 'workspace', id: workspace.workspaceId, title: workspace.title || workspace.leaf }
        }
        return null
      }
      /**
       * Commit one "move to group" for all four row kinds. Batch kinds
       * (folder / sgroup) rewrite the prefix of every member, exactly like
       * the existing rename-group dialogs; single kinds just retitle the
       * entry. All paths are user-driven renames, so sessions go through
       * renameByUser (humanTouched: never auto-quoted afterwards).
       */
      const submitGroupMove = (target, rawGroup) => {
        if (!target) { setDialog(null); return }
        const group = normPath(String(rawGroup || ''))
        const leaf = leafOf(target.title)
        const next = group ? group + '/' + leaf : leaf
        if (next === '' || next === target.title) { setDialog(null); return }
        if (target.kind === 'workspace') {
          Promise.resolve()
            .then(() => renameWorkspace(target.id, next))
            // The host action is optional (dsh 0.1.6-alpha.1 dropped it from
            // the browser contract); the rename above is the move either way.
            .then(() => { if (typeof insertWorkspaceBefore === 'function') insertWorkspaceBefore(target.id) })
            .then(() => setDialog(null))
            .catch(fail)
          return
        }
        if (target.kind === 'session') {
          Promise.resolve()
            .then(() => renameByUser(target.id, next))
            .then(() => setDialog(null))
            .catch(fail)
          return
        }
        if (target.kind === 'folder') {
          const affected = (items || []).filter((w) => String(w.title || '').startsWith(target.path + '/'))
          Promise.resolve()
            .then(async () => {
              for (const w of affected) {
                await renameWorkspace(w.workspaceId, next + String(w.title).slice(target.path.length))
              }
            })
            .then(() => setDialog(null))
            .catch(fail)
          return
        }
        if (target.kind === 'sgroup') {
          const workspace = (items || []).find((w) => w.workspaceId === target.workspaceId)
          if (!workspace) { setDialog(null); return }
          const node = findSessionGroup(buildSessionTree(sessionsOf(workspace), sessionSlash, sessFolders, workspace.workspaceId), target.path)
          if (!node) { setDialog(null); return }
          const affected = collectSessionRows(node)
          Promise.resolve()
            .then(async () => {
              for (const row of affected) {
                if (row.blank) continue
                await renameByUser(row.id, next + row.title.slice(target.path.length))
              }
            })
            .then(() => setDialog(null))
            .catch(fail)
          return
        }
        setDialog(null)
      }

      /* ------------------------- drag & drop -------------------------- */

      React.useEffect(() => {
        if (drag === null) return
        const accept = (event) => {
          event.preventDefault()
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
        }
        const acceptDrop = (event) => { event.preventDefault() }
        document.addEventListener('dragover', accept)
        document.addEventListener('drop', acceptDrop)
        return () => {
          document.removeEventListener('dragover', accept)
          document.removeEventListener('drop', acceptDrop)
        }
      }, [drag === null])

      // Geometry helpers shared by both reorder targets. v0.36.4 judges in
      // v0.36.4 geometry: an open reorder slot (bw-slot-above / -below) pads
      // the row open by one logical row (padding, so the box grows to two
      // rows). Judge the pointer against the row's ORIGINAL position, not the
      // padded box: the original position is the half its content did NOT
      // slide into — the pad above for a before-slot, the remaining content
      // box for an after-slot. Judging there keeps a still pointer from
      // flipping the slot the moment it opens (the reported "抽搐"), while
      // still letting the pointer cross the original midpoint to switch
      // direction — the padded half answers null instead of a stale band.
      const originalBoxOf = (el) => {
        const rect = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        const padTop = parseFloat(style.paddingTop) || 0
        const padBottom = parseFloat(style.paddingBottom) || 0
        if (padTop > 0) return { top: rect.top, bottom: rect.top + padTop }
        if (padBottom > 0) return { top: rect.top, bottom: rect.bottom - padBottom }
        return { top: rect.top, bottom: rect.bottom }
      }
      // null = the pointer sits in the half the open slot vacated: the caller
      // keeps its current drop target instead of re-deciding on geometry that
      // only exists because of that slot.
      // v0.36.5 MIXED LEVEL SEQUENCE. buildTree attaches a `seq` to every
      // level (group rows and BARE workspace rows interleaved by the
      // persisted folderOrder, whose tokens may be a group name or
      // "w:<workspaceId>"); chain-compressed nodes carry no seq and keep the
      // historical folders-then-workspaces order. Both the renderer and the
      // reorder commit read the SAME sequence, so what the user sees is what
      // the drop edits.
      const levelSeqOf = (level) => (level && Array.isArray(level.seq))
        ? level.seq
        : [
          ...(((level && level.folders) || []).map((node) => ({ kind: 'folder', node }))),
          ...(((level && level.workspaces) || []).map((entry) => ({ kind: 'ws', entry }))),
        ]
      const levelTokenOf = (item) => item.kind === 'ws' ? 'w:' + item.entry.workspaceId : item.node.name
      const rowHalf = (event) => {
        const box = originalBoxOf(event.currentTarget)
        const y = event.clientY
        if (y < box.top || y > box.bottom) return null
        return y < (box.top + box.bottom) / 2 ? 'before' : 'after'
      }
      // Three-band targeting for group rows (react-arborist style): the
      // outer 30% of the CONTENT means "reorder against this group", the
      // middle 40% means "drop into" — so move-into (the framed highlight)
      // is easy to hit and reorder never swallows the pointer. v0.36.3
      // widened the bands from a quarter: at 25% they were 8.5px on a 34px
      // row and practically unhittable (every drop landed "into" instead
      // of reordering beside).
      const rowZone = (event) => {
        const box = originalBoxOf(event.currentTarget)
        const y = event.clientY
        if (y < box.top || y > box.bottom) return null
        const h = box.bottom - box.top
        if (h < 2) return 'into'
        const rel = (y - box.top) / h
        if (rel < 0.3) return 'before'
        if (rel > 0.7) return 'after'
        return 'into'
      }
      // v0.36.10: TRUE when the pointer sits in the row's ORIGINAL content
      // box (a possibly-open slot's padding excluded). While this row holds
      // a reorder slot the padding band keeps the slot verdict, and the
      // content box re-judges the three bands — that is what keeps the
      // INTO middle reachable after a slot opened. The old slotOpen lock
      // answered before/after forever, so a pointer that entered through an
      // edge band could never reach the middle: "拖到另一个下面(嵌套)" was
      // unreachable through the natural approach path.
      const pointerInRowBox = (event) => {
        const box = originalBoxOf(event.currentTarget)
        return event.clientY >= box.top && event.clientY <= box.bottom
      }
      const dragMatches = (kind) => drag !== null && drag.kind === kind
      // A refused hover must DROP the highlight it already owns: leaving a
      // stale {over} in place drew the previous target's INTO frame on a row
      // that no longer accepts anything (the user reads it as "it will land
      // here" and the drop then goes elsewhere).
      const clearOver = (targetKind, target) => setDrag((current) => (current && current.over && current.over.kind === targetKind && current.over.target === target) ? { ...current, over: null } : current)
      const canDragWorkspace = typeof insertWorkspaceBefore === 'function'
      // Session REORDER needs the host insertSessionBefore action; dragging a
      // session onto a sub-group row (a pure rename) stays available without it.
      // Session reorder keeps working either way: the host action is preferred
      // (authoritative, visible to every surface), while hosts that no longer
      // inject it — dsh 0.1.6-alpha.1 dropped insertSessionBefore from the
      // browser contract — fall back to the browser-local flat order.
      const canReorderSessions = true

      /* --------------------- workspace drag & drop -------------------- */

      // v0.36.5: a workspace row answers the SAME slot for both drag kinds —
      // a workspace slides between workspace rows, a whole group block slides
      // beside one (mixed reorder), so the visual is one shared mechanism.
      const wsDropHalf = (workspaceId) => {
        if (!dragMatches('workspace') && !dragMatches('folder')) return null
        const over = drag.over
        return over && over.kind === 'workspace' && over.target === workspaceId ? over.half : null
      }
      // Folder rows light up for a workspace drop (regroup one workspace)
      // AND a folder drop (whole-group move) alike — the INTO band only:
      // an edge-band reorder slot draws the official insert line instead.
      const wsDropInto = (path) => (dragMatches('workspace') || dragMatches('folder')) && drag.over && drag.over.kind === 'folder' && drag.over.target === path && (!drag.over.zone || drag.over.zone === 'into')
      // v0.36.4: an edge band on a group row answers IMMEDIATELY with the
      // empty reorder slot (bw-slot-above/below) — the drop position is
      // visible the moment the pointer enters the band, no intent wait.
      // v0.36.5: BOTH sources open the slot on a group row. A folder source
      // reorders the group block; a WORKSPACE source interleaves one bare
      // workspace row beside the group — the gesture "insert as the first
      // row" that used to be impossible because every group rendered first.
      const wsFolderSlotOf = (folderIdPath) => ((dragMatches('folder') || dragMatches('workspace')) && drag.over && drag.over.kind === 'folder' && drag.over.target === folderIdPath && (drag.over.zone === 'before' || drag.over.zone === 'after')) ? drag.over.zone : null
      const workspaceDragEvents = (workspace) => ({
        draggable: !searching && canDragWorkspace,
        onDragStart: (event) => {
          if (searching || !canDragWorkspace) return
          event.stopPropagation()
          try {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', workspace.workspaceId)
          } catch { /* drag payload is best-effort */ }
          // Drag identity derives from the RAW title, never the displayed leaf:
          // a compressed single-chain row shows "group/workspace" as its leaf with
          // folderPath '' — carrying that would make move-into / cross-folder
          // drops rebuild titles like "x/group/workspace". The real leaf and
          // folder keep every drop target's rename correct.
          const segs = splitTitleSegs(workspace.title)
          const sourceLeaf = segs.length > 0 ? segs[segs.length - 1] : (workspace.leaf || String(workspace.workspaceId))
          // ...unless the name layer is OFF: the tree then renders no groups at
          // all, so reporting a folder here would make every drop look like a
          // cross-group move and rewrite the title behind the user's back.
          // With '' on both sides the drop stays pure reordering.
          const sourceFolder = workspaceSlash && segs.length > 1 ? segs.slice(0, -1).join('/') : ''
          // Deferred by one frame on purpose (Chromium cancels a just-started
          // drag whose source element is moved out from under the cursor; see
          // wsDragArmTimer above). By the next frame the gesture has settled
          // and the chain expansion is an ordinary mid-drag update.
          if (wsDragArmTimer.current !== null) clearTimeout(wsDragArmTimer.current)
          wsDragArmTimer.current = setTimeout(() => {
            wsDragArmTimer.current = null
            setDrag({ kind: 'workspace', source: { workspaceId: workspace.workspaceId, leaf: sourceLeaf, folderPath: sourceFolder, disk: diskParentMap.get(workspace.workspaceId), levelKey: workspace.levelKey || '' }, over: null })
          }, 0)
        },
        onDragEnd: () => {
          if (wsDragArmTimer.current !== null) { clearTimeout(wsDragArmTimer.current); wsDragArmTimer.current = null }
          const committed = dragDroppedRef.current
          dragDroppedRef.current = false
          const cancelled = dragCancelledRef.current
          dragCancelledRef.current = false
          const live = dragStateRef.current
          setDrag(null)
          // v0.36.10: same resting-drag fallback as the folder dragEnd.
          if (committed || cancelled || !live || live.kind !== 'workspace' || !live.over) return
          const over = live.over
          if (over.kind === 'folder') {
            const zone = over.zone === 'before' || over.zone === 'after' ? over.zone : 'into'
            if (zone === 'into') commitWorkspaceMoveInto(live.source, over.target)
            else if ((live.source.levelKey || '') === parentKeyOf(over.target)) commitLevelReorder({ kind: 'workspace', source: live.source }, { kind: 'folder', target: over.target }, zone)
            else commitWorkspaceLift(live.source, over.target, zone)
          } else if (over.kind === 'workspace' && over.half && over.workspace) {
            commitWorkspaceDrop(over.workspace, over.half)
          }
        },
        onDragOver: (event) => {
          // A SESSION dragged onto the workspace row lands at the root level of
          // its session tree — the way OUT of any group (v0.18.0). Only for
          // rows that actually sit in a group: a top-level session gains
          // nothing here, so this row must not light up for it (the browser
          // then shows its plain "no drop" cursor, which tells the truth).
          if (dragMatches('session')) {
            if (!sessionSlash || drag.source.workspaceId !== workspace.workspaceId) return
            if (leafOf(drag.source.title) === drag.source.title) return
            event.preventDefault()
            event.stopPropagation()
            try { event.dataTransfer.dropEffect = 'move' } catch { }
            setDrag(current => (current && current.over && current.over.kind === 'ws-root' && current.over.target === workspace.workspaceId)
              ? current
              : (current ? { ...current, over: { kind: 'ws-root', target: workspace.workspaceId } } : current))
            return
          }
          // v0.36.5 MIXED REORDER: a GROUP block can slide beside a bare
          // workspace row of the same level (the mirror gesture of a
          // workspace sliding beside a group row). Siblings only — a group
          // that lives in another container has no position in this level.
          if (dragMatches('folder')) {
            const sourceLevel = drag.source.levelKey || ''
            if (sourceLevel !== (workspace.levelKey || '')) {
              // v0.36.7 INTO on the OWNING disk row: a group block dropped on
              // the workspace row that CONTAINS it answers the same framed
              // INTO a workspace row gets on a group row ("放入这个工作区
              // 下"). The only position that means without rewriting a path
              // is the tail of the level it already lives in, so the drop
              // commits moveFolderToLevelEnd. Every other cross-level target
              // stays refused: the disk layer is a filesystem fact.
              if (sourceLevel === (workspace.subPrefix || '')) {
                event.preventDefault()
                event.stopPropagation()
                try { event.dataTransfer.dropEffect = 'move' } catch { }
                setDrag(current => (current && current.over && current.over.kind === 'ws-level' && current.over.target === workspace.workspaceId)
                  ? current
                  : (current ? { ...current, over: { kind: 'ws-level', target: workspace.workspaceId } } : current))
              } else {
                // v0.36.10 GROUP LIFT: an EDGE band on a cross-level row of
                // the SAME disk scope lifts the whole group out to this
                // row's level, anchored at the row — "把平行帮拖到和用户
                // 目录、工作平级". The row must not live inside the dragged
                // group (that would nest the group under itself) and not on
                // another disk (a title rename cannot cross disks).
                const half = rowHalf(event)
                const sourceScope = diskScopeOf(drag.source.idPath)
                const targetDisk = diskParentMap.get(workspace.workspaceId) || workspace.workspaceId
                const targetLevel = workspace.levelKey || ''
                const insideSource = targetLevel === drag.source.idPath || targetLevel.startsWith(drag.source.idPath + '/')
                if (half !== null && sourceScope !== null && targetDisk === sourceScope && !insideSource) {
                  event.preventDefault()
                  event.stopPropagation()
                  try { event.dataTransfer.dropEffect = 'move' } catch { }
                  setDrag(current => (current && current.over && current.over.kind === 'workspace' && current.over.target === workspace.workspaceId && current.over.half === half)
                    ? current
                    : (current ? { ...current, over: { kind: 'workspace', target: workspace.workspaceId, half, workspace, folderLift: true } } : current))
                } else {
                  clearOver('workspace', workspace.workspaceId)
                  clearOver('ws-level', workspace.workspaceId)
                }
              }
              return
            }
            event.preventDefault()
            event.stopPropagation()
            try { event.dataTransfer.dropEffect = 'move' } catch { }
            const half = rowHalf(event)
            if (half === null) return
            // The row object rides along for the dragEnd fallback (same
            // reason as the folder over's node above).
            setDrag(current => (current && current.over && current.over.kind === 'workspace' && current.over.target === workspace.workspaceId && current.over.half === half)
              ? current
              : (current ? { ...current, over: { kind: 'workspace', target: workspace.workspaceId, half, workspace } } : current))
            return
          }
          if (!dragMatches('workspace')) return
          // v0.36.4: the SOURCE row is never its own drop target. A reorder
          // slot pads a row open by one logical row, so the row the drag
          // started on ends up covering the pointer's first stop — without
          // this gate the source row swallowed the target, the drop landed on
          // itself, commitWorkspaceDrop no-oped and the gesture read as
          // "拖了没反应".
          if (drag.source && drag.source.workspaceId === workspace.workspaceId) return
          // v0.36.9: this row may sit INSIDE the dragged container's disk
          // subtree — lifting beside it would rename the container under
          // itself. No feedback, like any other refused band.
          if (isOwnDescendantScope(diskParentMap.get(workspace.workspaceId), drag.source.workspaceId)) return
          event.preventDefault()
          event.stopPropagation()
          try { event.dataTransfer.dropEffect = 'move' } catch { }
          const half = rowHalf(event)
          // Pointer in the half the open slot vacated: keep this row's slot.
          if (half === null) return
          setDrag(current => (current && current.over && current.over.kind === 'workspace' && current.over.target === workspace.workspaceId && current.over.half === half)
            ? current
            : (current ? { ...current, over: { kind: 'workspace', target: workspace.workspaceId, half, workspace } } : current))
        },
        onDrop: (event) => {
          if (dragMatches('session')) {
            if (!sessionSlash || drag.source.workspaceId !== workspace.workspaceId) return
            if (leafOf(drag.source.title) === drag.source.title) return
            event.preventDefault()
            event.stopPropagation()
            commitSessionMoveOut(workspace.workspaceId)
            return
          }
          if (dragMatches('folder')) {
            const sourceLevel = drag.source.levelKey || ''
            if (sourceLevel !== (workspace.levelKey || '')) {
              // v0.36.7: the group's OWNING disk row accepts the framed INTO
              // (see onDragOver) — put the block back at that level's tail.
              if (sourceLevel === (workspace.subPrefix || '')) {
                event.preventDefault()
                event.stopPropagation()
                dragDroppedRef.current = true
                commitFolderMoveToLevelEnd(drag.source)
              } else {
                // v0.36.10: the lift band armed in onDragOver.
                const over = drag.over
                if (over && over.kind === 'workspace' && over.target === workspace.workspaceId && over.folderLift && over.half) {
                  event.preventDefault()
                  event.stopPropagation()
                  dragDroppedRef.current = true
                  commitFolderLift(drag.source, workspace, over.half)
                }
              }
              return
            }
            event.preventDefault()
            event.stopPropagation()
            dragDroppedRef.current = true
            const half = drag.over && drag.over.kind === 'workspace' && drag.over.target === workspace.workspaceId ? drag.over.half : rowHalf(event)
            commitLevelReorder({ kind: 'folder', source: drag.source }, { kind: 'workspace', workspace }, half || 'before')
            return
          }
          if (!dragMatches('workspace')) return
          // v0.36.9: the geometry fallback must not resurrect a drop the
          // hover refused — a container never lands inside its own subtree.
          if (isOwnDescendantScope(diskParentMap.get(workspace.workspaceId), drag.source.workspaceId)) return
          event.preventDefault()
          event.stopPropagation()
          dragDroppedRef.current = true
          const half = drag.over && drag.over.kind === 'workspace' && drag.over.target === workspace.workspaceId ? drag.over.half : rowHalf(event)
          commitWorkspaceDrop(workspace, half)
        },
      })
      // A folder row accepts BOTH drag kinds: a workspace drop regroups that
      // one workspace (commitWorkspaceMoveInto), a folder drop moves the
      // whole group — every member retitled under the target prefix
      // (commitFolderMoveInto, the drag twin of submitFolderRename).
      // Dropping a group onto itself or its own descendant would loop, so
      // the hover refuses there and the browser shows its "no drop" cursor.
      const namePathOf = (folderIdPath) => {
        const cutAt = folderIdPath.lastIndexOf('//')
        return cutAt === -1 ? folderIdPath : folderIdPath.slice(cutAt + 2)
      }
      // idPath = [<wsId>//]*<namePath>: the owner prefix names the disk
      // level a group renders in. Reordering only makes sense between
      // groups of the SAME level — across levels a group's position
      // belongs to its own container.
      const ownerPrefixOf = (folderIdPath) => {
        const cutAt = folderIdPath.lastIndexOf('//')
        return cutAt === -1 ? '' : folderIdPath.slice(0, cutAt)
      }
      // PARENT container identity of a group row (v0.36.4) — the key its
      // sibling order is persisted under. The ROOT level of a disk scope
      // answers the scope prefix ('' at the top level, '<wsId>' one disk
      // level down); a deeper group answers the idPath of its parent group.
      const parentKeyOf = (folderIdPath) => {
        const cutAt = folderIdPath.lastIndexOf('//')
        const prefix = cutAt === -1 ? '' : folderIdPath.slice(0, cutAt)
        const namePath = cutAt === -1 ? folderIdPath : folderIdPath.slice(cutAt + 2)
        const segs = namePath.split('/')
        segs.pop()
        const parentNamePath = segs.join('/')
        return parentNamePath === '' ? prefix : prefix + '//' + parentNamePath
      }
      // v0.36.9 ANTI-LOOP. A workspace that CONTAINS the drop target's disk
      // scope may not be dropped onto it: the container would become its own
      // descendant (用户目录 → 工作 → "工作/用户目录"; the lift path even
      // rewrote the title with the raw scope id, "2d412faa…/用户目录").
      // The disk scope behind a group row is its owner prefix resolved down
      // the parent chain until it names a real workspace ('' — the top
      // level — owns nothing, so sibling groups stay untouched).
      const diskScopeOf = (folderIdPath) => {
        let current = ownerPrefixOf(folderIdPath)
        while (current !== '') {
          if (diskParentMap.has(current)) return current
          const cutAt = current.lastIndexOf('//')
          if (cutAt === -1) return null
          current = current.slice(0, cutAt)
        }
        return null
      }
      const isOwnDescendantScope = (diskScope, workspaceId) => {
        let current = diskScope || ''
        while (current !== '') {
          if (current === workspaceId) return true
          current = diskParentMap.get(current) || ''
        }
        return false
      }
      // Locate the container a group order list belongs to inside the RAW
      // (uncompressed) tree: the ROOT level, a disk sub-level (a
      // workspace's `sub`), or a group node whose `folders` are its
      // children. Compression never runs on rawTree, so every group the
      // user can drop beside still has its own idPath here.
      const folderContainerOf = (key) => {
        if (key === '') return rawTree
        let hit = null
        const walk = (level) => {
          if (hit || !level) return
          for (const w of level.workspaces || []) {
            if (hit) return
            if (w.subPrefix === key && w.sub) { hit = w.sub; return }
            if (w.sub) walk(w.sub)
          }
          for (const f of level.folders || []) {
            if (hit) return
            if (f.idPath === key) { hit = f; return }
            walk(f)
          }
        }
        walk(rawTree)
        return hit
      }
      // Whole-block member ids of a name group, from this rendering level
      // down: a reorder slides EVERY nested workspace (prefixes untouched,
      // so sub-groups travel with the block; only the registry order
      // shifts).
      const collectMemberIds = (folderNode) => {
        const acc = []
        const walk = (level) => {
          for (const w of level.workspaces || []) acc.push(w.workspaceId)
          for (const f of level.folders || []) {
            if (f.kind === 'ws') acc.push(f.workspace.workspaceId)
            else walk(f)
          }
        }
        walk(folderNode)
        return acc
      }
      const folderDropEvents = (idPath, path, node) => ({
        draggable: !searching,
        onDragStart: (event) => {
          if (searching) return
          event.stopPropagation()
          try {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', idPath)
          } catch { /* drag payload is best-effort */ }
          // Same one-frame arm as the workspace drag: Chromium cancels a
          // just-started drag whose source element moves under the cursor.
          if (wsDragArmTimer.current !== null) clearTimeout(wsDragArmTimer.current)
          wsDragArmTimer.current = setTimeout(() => {
            wsDragArmTimer.current = null
            setDrag({ kind: 'folder', source: { idPath, path, memberIds: collectMemberIds(node), levelKey: parentKeyOf(idPath) }, over: null })
          }, 0)
        },
        onDragEnd: () => {
          if (wsDragArmTimer.current !== null) { clearTimeout(wsDragArmTimer.current); wsDragArmTimer.current = null }
          const committed = dragDroppedRef.current
          dragDroppedRef.current = false
          const cancelled = dragCancelledRef.current
          dragCancelledRef.current = false
          const live = dragStateRef.current
          setDrag(null)
          // v0.36.10: no drop AND not cancelled means Chromium killed a
          // RESTING drag (mouse-up as dragleave+dragend, drop never fires).
          // Honor the armed {over} instead of throwing the gesture away —
          // the user aimed at a visible slot/into for seconds. Escape still
          // cancels for real.
          if (committed || cancelled || !live || live.kind !== 'folder' || !live.over) return
          const over = live.over
          if (over.kind === 'folder') {
            if (over.zone === 'before' || over.zone === 'after') commitFolderReorder(live.source, over.target, over.zone, over.node)
            else commitFolderMoveInto(live.source, over.target)
          } else if (over.kind === 'ws-level') {
            commitFolderMoveToLevelEnd(live.source)
          } else if (over.kind === 'workspace' && over.half && over.folderLift && over.workspace) {
            commitFolderLift(live.source, over.workspace, over.half)
          } else if (over.kind === 'workspace' && over.half && over.workspace) {
            commitLevelReorder({ kind: 'folder', source: live.source }, { kind: 'workspace', workspace: over.workspace }, over.half)
          }
        },
        onDragOver: (event) => {
          // Three bands on a group row: the outer 30% bands reorder this
          // group among its SIBLINGS (an empty slot opens at once — the
          // drop position is visible the moment the band is entered); the
          // middle 40% moves the source INSIDE the hovered group (framed,
          // never opened). Workspace sources keep whole-row move-into
          // semantics.
          //
          // SIBLINGS means the SAME PARENT (parentKeyOf): a band reorder
          // only permutes one level's group name list, it never rewrites a
          // title prefix. Cross-parent and self/descendant targets are
          // refused — no preventDefault, so the platform shows its own
          // 'no drop' cursor, which is the truth.
          //
          // v0.36.4: once THIS row already holds a reorder slot, the whole
          // original row position answers before/after ONLY (a plain
          // midpoint split). Judging the three bands again there reintroduced
          // the INTO band on the very row that just padded open: a pointer
          // drifting a few pixels inside it flipped to INTO, closed the slot
          // and read as a flicker ("抽搐") — and worse, the drop then landed
          // as move-into (a no-op) instead of the reorder the user aimed at.
          // The three bands still decide the FIRST entry, so INTO (move the
          // source inside this group) stays reachable.
          const slotOpen = drag.over !== null && drag.over.kind === 'folder' && drag.over.target === idPath && (drag.over.zone === 'before' || drag.over.zone === 'after')
          // v0.36.10: an open slot no longer locks the verdict. The slot's
          // padding band keeps the slot (rowHalf is null there and the
          // zone-null branch below holds), but the ORIGINAL content box
          // re-judges the three bands — the INTO middle stays reachable.
          const zone = slotOpen
            ? (pointerInRowBox(event) ? rowZone(event) : rowHalf(event))
            : rowZone(event)
          const isFolder = dragMatches('folder')
          const isWorkspace = dragMatches('workspace')
          if (isFolder) {
            const targetPath = namePathOf(idPath)
            // Self / descendant: looping.
            if (drag.source.path === targetPath || targetPath.startsWith(drag.source.path + '/')) { clearOver('folder', idPath); return }
            // Ancestor: the group already lives inside. The DIRECT parent is
            // the container it lives in, so v0.36.7 reopens its MIDDLE band
            // (the framed INTO): "放进那个组" can only mean "move to the end
            // of that group", the same feedback a workspace row gets when
            // dropped INTO its own group. Edge bands still mean nothing
            // there (leaving a parent is a title rename, not an order
            // change), and a further ancestor stays refused.
            if (targetPath !== '' && drag.source.path.startsWith(targetPath + '/')) {
              const cutAt = drag.source.path.lastIndexOf('/')
              const directParent = cutAt === -1 ? '' : drag.source.path.slice(0, cutAt)
              if (targetPath !== directParent || zone !== 'into') { clearOver('folder', idPath); return }
            }
            // Pointer in the half the open slot vacated: keep this row's slot
            // (re-deciding there would flicker the slot it just opened).
            if (zone === null) {
              if (drag.over && drag.over.kind === 'folder' && drag.over.target === idPath && (drag.over.zone === 'before' || drag.over.zone === 'after')) {
                event.preventDefault()
                event.stopPropagation()
                try { event.dataTransfer.dropEffect = 'move' } catch { }
              }
              return
            }
            // Edge bands permute ONE level's sibling list; a cross-parent
            // band is refused. Move-into (the middle band) stays open across
            // parents: it is a batch rename, which does reach another group.
            if (zone !== 'into' && parentKeyOf(idPath) !== parentKeyOf(drag.source.idPath)) { clearOver('folder', idPath); return }
          } else if (!isWorkspace) {
            return
          } else {
            // v0.36.9 ANTI-LOOP first: the dragged workspace may own the
            // disk scope this group lives in (用户目录 dragging onto its
            // own group 工作). Every band there — the INTO middle included
            // — would rename the container under its own subtree, so the
            // whole row is dead and any leftover over state is cleared.
            if (isOwnDescendantScope(diskScopeOf(idPath), drag.source.workspaceId)) { clearOver('folder', idPath); return }
            // v0.36.6 LIFT: a bare workspace row slides beside a group of ANY
            // level it can reach. Same level keeps the v0.36.5 mixed reorder.
            // Another level is a LIFT: the workspace leaves its current group
            // and joins the target group's level, inserted right there. That
            // is the "insert as the FIRST row" gesture the user kept
            // reporting: the hover used to be refused silently, so {over}
            // kept the previous frame's INTO, and the drop became a
            // move-into that left the row last inside the group. A lift may
            // not cross a DISK boundary (a workspace's folder is a
            // filesystem fact), so the target level must live in the same
            // disk scope as the source. The middle band keeps its old
            // meaning: move the workspace INTO this group.
            if (zone === null) {
              if (drag.over && drag.over.kind === 'folder' && drag.over.target === idPath && (drag.over.zone === 'before' || drag.over.zone === 'after')) {
                event.preventDefault()
                event.stopPropagation()
                try { event.dataTransfer.dropEffect = 'move' } catch { }
              }
              return
            }
            if (zone !== 'into' && (drag.source.levelKey || '') !== parentKeyOf(idPath) && (ownerPrefixOf(idPath) || '') !== (drag.source.disk || '')) { clearOver('folder', idPath); return }
          }
          event.preventDefault()
          event.stopPropagation()
          try { event.dataTransfer.dropEffect = 'move' } catch { }
          const reorder = zone !== 'into'
          // The row's node rides along: the dragEnd fallback (a Chromium
          // resting drag that never fires drop) commits from {over} alone
          // and needs it for the target-block anchor.
          const nextOver = reorder
            ? { kind: 'folder', target: idPath, zone, node }
            : { kind: 'folder', target: idPath, zone: 'into', node }
          setDrag(current => (current && current.over && current.over.kind === 'folder' && current.over.target === idPath && current.over.zone === nextOver.zone)
            ? current
            : (current ? { ...current, over: nextOver } : current))
        },
        onDrop: (event) => {
          if (dragMatches('folder')) {
            event.preventDefault()
            event.stopPropagation()
            dragDroppedRef.current = true
            const zone = drag.over && drag.over.kind === 'folder' && drag.over.target === idPath ? drag.over.zone : 'into'
            if (zone === 'before' || zone === 'after') commitFolderReorder(drag.source, idPath, zone, node)
            else commitFolderMoveInto(drag.source, idPath)
            return
          }
          if (!dragMatches('workspace')) return
          // v0.36.9: same anti-loop gate as the hover — the geometry
          // fallback must not resurrect a drop the hover refused.
          if (isOwnDescendantScope(diskScopeOf(idPath), drag.source.workspaceId)) return
          event.preventDefault()
          event.stopPropagation()
          dragDroppedRef.current = true
          // The live {over} wins; the geometry is the fallback for a drop that
          // lands before any hover frame recorded a band on this row.
          const overZone = drag.over && drag.over.kind === 'folder' && drag.over.target === idPath && (drag.over.zone === 'before' || drag.over.zone === 'after') ? drag.over.zone : null
          const geoZone = rowZone(event) || 'into'
          const zone = overZone || geoZone
          if (zone === 'before' || zone === 'after') {
            // Same level = plain mixed reorder; another level (same disk
            // scope) = lift the workspace out of its group into that level.
            if ((drag.source.levelKey || '') === parentKeyOf(idPath)) commitLevelReorder({ kind: 'workspace', source: drag.source }, { kind: 'folder', target: idPath }, zone)
            else commitWorkspaceLift(drag.source, idPath, zone)
          } else commitWorkspaceMoveInto(idPath)
        },
      })
      const nextWorkspaceAfter = (folderPath, workspaceId) => {
        const node = findTreeNode(tree, folderPath)
        if (!node) return undefined
        const index = node.workspaces.findIndex(w => w.workspaceId === workspaceId)
        return index === -1 ? undefined : (node.workspaces[index + 1] ? node.workspaces[index + 1].workspaceId : undefined)
      }
      // v0.36.5 MIXED LEVEL REORDER. One persisted list per level decides the
      // display order of BOTH kinds: a group name token and a "w:<id>"
      // workspace token. Writes the list only — the registry keeps its own
      // (workspace-only) order, because "above that group" is a VIEW position
      // the registry has no vocabulary for: a workspace title still decides
      // which group it belongs to, the list only decides where the row sits.
      // v0.36.7: a group block dropped INTO the container it already lives in
      // (the framed INTO on its DIRECT parent group row, or on the disk-level
      // row that owns it) lands at that container's TAIL — the same
      // "放入=排到最后" a workspace row gets when dropped INTO its own group.
      // No prefix is rewritten (the block already lives under the right path),
      // only the level order moves.
      const moveFolderToLevelEnd = (source) => {
        const containerKey = source.levelKey || ''
        const container = folderContainerOf(containerKey)
        if (!container) { console.warn('[bw] folder move refused: target level not found', containerKey); return false }
        const token = namePathOf(source.idPath).split('/').pop()
        const tokens = levelSeqOf(container).map(levelTokenOf)
        if (!tokens.includes(token)) { console.warn('[bw] folder move refused: group not in this level', token); return false }
        const next = tokens.filter((entry) => entry !== token)
        next.push(token)
        if (typeof actions.setFolderOrder === 'function') actions.setFolderOrder(containerKey, next)
        return true
      }
      const commitFolderMoveToLevelEnd = (source) => {
        setDrag(null)
        moveFolderToLevelEnd(source)
      }
      const writeLevelOrder = (containerKey, sourceToken, targetToken, zone) => {
        const container = folderContainerOf(containerKey)
        if (!container) { console.warn('[bw] level reorder refused: container not found', containerKey); return false }
        const tokens = levelSeqOf(container).map(levelTokenOf)
        const at = tokens.indexOf(sourceToken)
        if (at === -1) { console.warn('[bw] level reorder refused: source not in this level', sourceToken); return false }
        tokens.splice(at, 1)
        const targetAt = tokens.indexOf(targetToken)
        if (targetAt === -1) { console.warn('[bw] level reorder refused: target not in this level', targetToken); return false }
        tokens.splice(zone === 'after' ? targetAt + 1 : targetAt, 0, sourceToken)
        if (typeof actions.setFolderOrder === 'function') actions.setFolderOrder(containerKey, tokens)
        return true
      }
      // v0.36.6 LIFT writes: the source token does NOT exist in the target
      // level yet (that is what a lift is), so writeLevelOrder's
      // "source must already be here" precondition does not apply — the token
      // is spliced straight in beside the target group.
      const insertLevelToken = (containerKey, sourceToken, targetToken, zone) => {
        const container = folderContainerOf(containerKey)
        if (!container) { console.warn('[bw] workspace lift refused: target level not found', containerKey); return false }
        const tokens = levelSeqOf(container).map(levelTokenOf).filter((token) => token !== sourceToken)
        const targetAt = tokens.indexOf(targetToken)
        if (targetAt === -1) { console.warn('[bw] workspace lift refused: target group not in this level', targetToken); return false }
        tokens.splice(zone === 'after' ? targetAt + 1 : targetAt, 0, sourceToken)
        if (typeof actions.setFolderOrder === 'function') actions.setFolderOrder(containerKey, tokens)
        return true
      }
      // The level a lifted workspace LEFT keeps a stale "w:<id>" token
      // otherwise (buildTree skips it harmlessly, but the list would grow
      // forever and a later re-group could resurrect the old position).
      const removeLevelToken = (containerKey, token) => {
        const container = folderContainerOf(containerKey)
        if (!container) return
        const tokens = levelSeqOf(container).map(levelTokenOf)
        if (!tokens.includes(token)) return
        if (typeof actions.setFolderOrder === 'function') actions.setFolderOrder(containerKey, tokens.filter((entry) => entry !== token))
      }
      // Shared commit for both mixed directions — a workspace sliding beside a
      // group row, and a group block sliding beside a workspace row. The
      // target names the level it belongs to; the hover gate already refused
      // cross-level targets and this re-checks it as belt and braces.
      const commitLevelReorder = (sourceRef, targetRef, zone) => {
        setDrag(null)
        if (!canDragWorkspace) { console.warn('[bw] level reorder refused: workspace reorder unavailable on this host'); return }
        const wsSource = sourceRef.kind === 'workspace'
        const sourceToken = wsSource ? 'w:' + sourceRef.source.workspaceId : namePathOf(sourceRef.source.idPath).split('/').pop()
        const folderTarget = targetRef.kind === 'folder'
        const targetToken = folderTarget ? namePathOf(targetRef.target).split('/').pop() : 'w:' + targetRef.workspace.workspaceId
        const containerKey = folderTarget ? parentKeyOf(targetRef.target) : (targetRef.workspace.levelKey || '')
        const sourceLevelKey = sourceRef.source.levelKey || ''
        if (sourceLevelKey !== containerKey) { console.warn('[bw] level reorder refused: cross-level target', sourceLevelKey, containerKey); return }
        writeLevelOrder(containerKey, sourceToken, targetToken, zone)
      }
      const commitWorkspaceDrop = (targetWorkspace, half) => {
        const source = drag.source
        setDrag(null)
        if (source.workspaceId === targetWorkspace.workspaceId) return
        const targetFolder = targetWorkspace.folderPath || ''
        // A disk-only tree has no name groups to move between: force the reorder
        // path even if the source was armed before the switch flipped.
        const sameFolder = !workspaceSlash || targetFolder === source.folderPath
        // The disk layer is a filesystem fact and never changes here: an
        // in-level drop keeps the manual order next to the anchor, a
        // cross-level drop only re-groups the title (the registry append
        // lands it at the end of ITS disk level).
        const sameDisk = source.disk === diskParentMap.get(targetWorkspace.workspaceId)
        // v0.36.6: a cross-LEVEL drop on a workspace row's half is a PLACEMENT,
        // not a re-group. The user reported "the insert line shows but the row
        // lands somewhere else": renaming into the target's group moved the row
        // into that group's block at whatever position the group already had.
        // Lifting to the target row's own level and anchoring at that row is
        // what makes the drop land where the line was drawn.
        if (workspaceSlash && (targetWorkspace.levelKey || '') !== (source.levelKey || '')) {
          commitWorkspaceLift(source, targetWorkspace.levelKey || '', half === 'after' ? 'after' : 'before', targetWorkspace.workspaceId)
          return
        }
        const chain = sameFolder
          ? Promise.resolve()
          : Promise.resolve().then(() => {
            const newTitle = targetFolder !== '' ? targetFolder + '/' + source.leaf : source.leaf
            return renameWorkspace(source.workspaceId, newTitle)
          })
        const anchor = !sameDisk
          ? undefined
          : (half === 'after'
            ? nextWorkspaceAfter(targetWorkspace.folderPath || '', targetWorkspace.workspaceId)
            : targetWorkspace.workspaceId)
        chain
          .then(() => (anchor !== undefined ? insertWorkspaceBefore(source.workspaceId, anchor) : insertWorkspaceBefore(source.workspaceId)))
          // v0.36.5: once a level carries a MIXED list (it interleaves a bare
          // workspace with its groups), the registry edit above no longer
          // moves the row — rewrite the list too, keeping every other token.
          .then(() => {
            const levelKey = targetWorkspace.levelKey || ''
            const container = folderContainerOf(levelKey)
            const tokens = container ? levelSeqOf(container).map(levelTokenOf) : []
            if (tokens.some((token) => token.startsWith('w:'))) {
              writeLevelOrder(levelKey, 'w:' + source.workspaceId, 'w:' + targetWorkspace.workspaceId, half === 'after' ? 'after' : 'before')
            }
          })
          .catch(fail)
      }
      // v0.36.6 LIFT. Dropping a bare workspace row on a group's EDGE band
      // from a DIFFERENT level means: take the row out of its group, give it
      // the target level's name prefix and place it right beside that group.
      // The user's report was "I can never insert it as the first row" — the
      // gesture existed visually but every path landed it inside the group
      // (move-into) at the tail. The lift is a rename + a level token, never a
      // disk move, so the caller has already checked the disk scope.
      const commitWorkspaceLift = (source, targetIdPath, zone, anchorWorkspaceId) => {
        setDrag(null)
        if (!canDragWorkspace) { console.warn('[bw] workspace lift refused: workspace reorder unavailable on this host'); return }
        const targetParentKey = parentKeyOf(targetIdPath)
        if (!folderContainerOf(targetParentKey)) { console.warn('[bw] workspace lift refused: target level not found', targetParentKey); return }
        const cutAt = targetParentKey.lastIndexOf('//')
        const levelNamePath = cutAt === -1 ? targetParentKey : targetParentKey.slice(cutAt + 2)
        const sourceKey = source.levelKey || ''
        const targetNamePath = namePathOf(targetIdPath)
        const targetNode = findTreeNode(rawTree, targetNamePath)
        const targetMembers = targetNode ? collectMemberIds(targetNode) : []
        const registryIds = (items || []).map((w) => w.workspaceId)
        // after = insert before whatever follows the target block in the
        // registry (undefined = append). before = before the block's head.
        // A row-anchored lift (dropped on a workspace row's half) anchors at
        // that row itself, not at the head/tail of its whole group block.
        let anchor
        if (anchorWorkspaceId) {
          if (zone === 'before') {
            anchor = anchorWorkspaceId
          } else {
            const rowAt = registryIds.indexOf(anchorWorkspaceId)
            anchor = rowAt === -1 ? undefined : registryIds[rowAt + 1]
          }
        } else if (zone === 'before') {
          anchor = targetMembers[0]
        } else if (targetMembers.length) {
          const tailAt = registryIds.indexOf(targetMembers[targetMembers.length - 1])
          anchor = tailAt === -1 ? undefined : registryIds[tailAt + 1]
        }
        const newTitle = levelNamePath !== '' ? levelNamePath + '/' + source.leaf : source.leaf
        const sameNameLevel = (source.folderPath || '') === levelNamePath
        Promise.resolve()
          .then(() => (sameNameLevel ? Promise.resolve() : renameWorkspace(source.workspaceId, newTitle)))
          .then(() => insertWorkspaceBefore(source.workspaceId, anchor))
          .then(() => {
            // The level token is always a GROUP token: a workspace row dropped on
            // from another level is painted beside the group that row lives in,
            // so the token to place it next to is that group's name in the
            // parent level's list (the row's own "w:" token lives one level in).
            insertLevelToken(targetParentKey, 'w:' + source.workspaceId, targetNamePath.split('/').pop(), zone)
            if (sourceKey !== targetParentKey) removeLevelToken(sourceKey, 'w:' + source.workspaceId)
          })
          .catch(fail)
      }
      const commitWorkspaceMoveInto = (folderIdPath) => {
        const source = drag.source
        setDrag(null)
        // idPath = [<wsId>//]*<namePath>: the name path is everything after
        // the last separator.
        const cutAt = folderIdPath.lastIndexOf('//')
        const folderPath = cutAt === -1 ? folderIdPath : folderIdPath.slice(cutAt + 2)
        if (source.folderPath === folderPath) return
        const newTitle = folderPath !== '' ? folderPath + '/' + source.leaf : source.leaf
        Promise.resolve()
          .then(() => renameWorkspace(source.workspaceId, newTitle))
          .then(() => insertWorkspaceBefore(source.workspaceId))
          .catch(fail)
      }
      // Group drag (v0.36.0): moving a folder rewrites EVERY member's title
      // under the target prefix — the same batch rename the rename-group
      // dialog (submitFolderRename) performs. Titles are global name paths,
      // so the member sweep is prefix-based over all items (same known
      // limitation as that dialog: same-named groups on different disk
      // levels move together). Self / descendant targets are already
      // refused at hover time; re-checked here as belt and braces.
      // v0.36.10 GROUP LIFT. Dropping a group row on a cross-level
      // workspace row's EDGE band (same disk scope) means: take the whole
      // group out of its parent, give it the target level's name prefix and
      // place it beside that row — "把平行帮拖到和用户目录、工作平级".
      // Mirrors commitWorkspaceLift: member renames plus a level token,
      // never a disk move; the hover gate already checked scope and nesting.
      const commitFolderLift = (source, workspace, zone) => {
        setDrag(null)
        if (!canDragWorkspace) { console.warn('[bw] folder lift refused: workspace reorder unavailable on this host'); return }
        const targetLevel = workspace.levelKey || ''
        if (targetLevel === source.idPath || targetLevel.startsWith(source.idPath + '/')) { console.warn('[bw] folder lift refused: target level inside the source', targetLevel); return }
        const sourceLeaf = namePathOf(source.idPath).split('/').pop()
        // The target level's name prefix: '' = the disk root (the group
        // becomes a plain top-level group), otherwise the level key's name
        // path after the owner separator.
        const cutAt = targetLevel.lastIndexOf('//')
        const levelNamePath = cutAt === -1 ? '' : targetLevel.slice(cutAt + 2)
        const newSourcePath = levelNamePath === '' ? sourceLeaf : levelNamePath + '/' + sourceLeaf
        const prefix = source.path + '/'
        const affected = (items || []).filter((w) => String(w.title || '').startsWith(prefix))
        if (!affected.length) { console.warn('[bw] folder lift refused: no members under', source.path); return }
        Promise.resolve()
          .then(async () => {
            for (const w of affected) {
              await renameWorkspace(w.workspaceId, newSourcePath + String(w.title).slice(source.path.length))
            }
          })
          .then(() => {
            removeLevelToken(source.levelKey || '', sourceLeaf)
            insertLevelToken(targetLevel, sourceLeaf, 'w:' + workspace.workspaceId, zone === 'after' ? 'after' : 'before')
            // Carry the group's own member order across to its NEW level
            // key, so the members keep their inside order after the rename.
            const oldContainer = folderContainerOf(source.idPath)
            if (oldContainer && typeof actions.setFolderOrder === 'function') {
              const owner = ownerPrefixOf(source.idPath)
              const newKey = owner === '' ? newSourcePath : owner + '//' + newSourcePath
              if (newKey !== source.idPath) actions.setFolderOrder(newKey, levelSeqOf(oldContainer).map(levelTokenOf))
            }
          })
          .catch(fail)
      }
      const commitFolderMoveInto = (source, targetIdPath) => {
        setDrag(null)
        const targetPath = namePathOf(targetIdPath)
        // v0.36.7: the DIRECT parent is the container the group already lives
        // in. The hover already showed the framed INTO there, so "放进那个
        // 组" means "move to the end of that group" — no rename involved.
        // Checked BEFORE the ancestor refusal below.
        const cutAt = source.path.lastIndexOf('/')
        const directParent = cutAt === -1 ? '' : source.path.slice(0, cutAt)
        if (targetPath === directParent) { moveFolderToLevelEnd(source); return }
        // An ANCESTOR target means the group already lives there: a prefix
        // rewrite would duplicate a segment (工作/A → 工作/工作/A). Refuse.
        if (source.path === targetPath || targetPath.startsWith(source.path + '/') || (targetPath !== '' && source.path.startsWith(targetPath + '/'))) { console.warn('[bw] folder move refused: target is self, descendant or ancestor of', source.path); return }
        const prefix = source.path + '/'
        const affected = (items || []).filter((w) => String(w.title || '').startsWith(prefix))
        if (!affected.length) { console.warn('[bw] folder move refused: no members under', source.path); return }
        // v0.36.10 NEST semantics: the group keeps its identity UNDER the
        // target (工作/平行帮 → 工作/Fis管理后台/平行帮). The old prefix
        // swap merged the members straight into the target's own level —
        // "平行帮/Web" became "Fis管理后台/Web", colliding with the
        // target's own Web and dying on workspace/name-conflict before
        // anything moved: the "平级的没法拖动" report. Nesting names every
        // member BELOW the moved group, which cannot collide with the
        // target's direct children.
        const sourceLeaf = namePathOf(source.idPath).split('/').pop()
        const newSourcePath = targetPath + '/' + sourceLeaf
        Promise.resolve()
          .then(async () => {
            for (const w of affected) {
              await renameWorkspace(w.workspaceId, newSourcePath + String(w.title).slice(source.path.length))
            }
          })
          .then(() => {
            // The group token moves from the source's level to INSIDE the
            // target group, and the member order follows to the new key.
            removeLevelToken(source.levelKey || '', sourceLeaf)
            const targetContainer = folderContainerOf(targetIdPath)
            if (targetContainer) {
              const tokens = levelSeqOf(targetContainer).map(levelTokenOf)
              if (tokens.length) insertLevelToken(targetIdPath, sourceLeaf, tokens[tokens.length - 1], 'after')
              else if (typeof actions.setFolderOrder === 'function') actions.setFolderOrder(targetIdPath, [sourceLeaf])
            }
            const oldContainer = folderContainerOf(source.idPath)
            if (oldContainer && typeof actions.setFolderOrder === 'function') {
              const owner = ownerPrefixOf(source.idPath)
              const newKey = owner === '' ? newSourcePath : owner + '//' + newSourcePath
              if (newKey !== source.idPath) actions.setFolderOrder(newKey, levelSeqOf(oldContainer).map(levelTokenOf))
            }
          })
          // (v0.36.4) NO automatic expand after a move-into. v0.36.3 opened
          // the target group here so the move would be visible, but on the
          // real tree a drop in the middle band is exactly the "变下级"
          // gesture, and auto-opening made that read as "又被撑开了".
          // The row the user just dropped into stays as it was; the moved
          // members appear under it once the user opens that group.
          .catch(fail)
      }
      // Group REORDER (v0.36.0): a name group's position IS the registry
      // order of its members, so reordering = sliding the whole member
      // block (prefixes untouched) to just before / after the target
      // group's block. Anchored like commitWorkspaceDrop: before = the
      // target's first member, after = whatever follows the target's last
      // member (undefined = block-append at the level tail). Hover only
      // arms this between same-level groups (identical owner prefix);
      // re-checked here as belt and braces.
      const commitFolderReorder = (source, targetIdPath, zone, targetNode) => {
        setDrag(null)
        if (!canDragWorkspace) { console.warn('[bw] folder reorder refused: workspace reorder unavailable on this host'); return }
        if (ownerPrefixOf(source.idPath) !== ownerPrefixOf(targetIdPath)) { console.warn('[bw] folder reorder refused: cross-level target'); return }
        // v0.36.4: SIBLINGS ONLY. A group's rendered position is decided by
        // its parent's order list, so a target that hangs off a different
        // parent cannot place it at all.
        if (parentKeyOf(source.idPath) !== parentKeyOf(targetIdPath)) { console.warn('[bw] folder reorder refused: cross-parent target'); return }
        const sourceIds = source.memberIds || []
        if (!sourceIds.length) { console.warn('[bw] folder reorder refused: empty source block'); return }
        // Whole-block anchors: the target's members include its nested
        // sub-groups (a plain .workspaces read misses container groups and
        // silently returned on them — the "drop did nothing" report).
        // v0.36.3 drag-out: the source block IS part of the target's block
        // (dropping a nested group onto its parent), so the source subtree
        // is filtered out before anchoring — otherwise the anchor lands
        // inside the moving subtree and the drop no-ops or oscillates.
        const sourceSet = new Set(sourceIds)
        const targetMembers = collectMemberIds(targetNode).filter((id) => !sourceSet.has(id))
        if (!targetMembers.length) { console.warn('[bw] folder reorder refused: target has no members to anchor against'); return }
        // before = the surviving block's first member; after = its last
        // member (inserting before it = right after the block). Anchoring
        // on the block tail itself replaces nextWorkspaceAfter, whose
        // node.workspaces lookup missed nested tails (findIndex -1 →
        // silent append).
        const anchor = zone === 'after'
          ? targetMembers[targetMembers.length - 1]
          : targetMembers[0]
        // v0.36.4: THE DISPLAYED ORDER IS PERSISTED HERE. Group order used to
        // follow buildTree's name sort, so the registry edit below changed
        // nothing the user could see ("拖了没反应"). folderOrder[parentKey]
        // is the sibling name list buildTree sorts by; write it first so the
        // drop is visible immediately, then sync the registry for the
        // workspace order other surfaces read.
        const orderParent = parentKeyOf(source.idPath)
        const sourceName = namePathOf(source.idPath).split('/').pop()
        const targetName = namePathOf(targetIdPath).split('/').pop()
        // v0.36.5: write the MIXED token list (group names + w:<id> tokens),
        // not just the folder names — a level that already interleaves a bare
        // workspace with its groups must keep those workspace positions.
        writeLevelOrder(orderParent, sourceName, targetName, zone)
        Promise.resolve()
          .then(async () => {
            if (anchor === undefined) {
              for (const id of sourceIds) await insertWorkspaceBefore(id)
            } else {
              for (const id of sourceIds) await insertWorkspaceBefore(id, anchor)
            }
          })
          .catch(fail)
      }

      /* ---------------------- session drag & drop --------------------- */

      const sessDropHalf = (sessionId) => {
        // Recency ordering is purely presentational: an anchor for a move
        // the very next render would re-sort is a lie — suppress it.
        if (orderBy === 'updated') return null
        if (!dragMatches('session')) return null
        const over = drag.over
        return over && over.kind === 'session' && over.target === sessionId ? over.half : null
      }
      const sgroupDropInto = (workspaceId, path) => dragMatches('session') && drag.over && drag.over.kind === 'sgroup' && drag.over.target === path
      const sessionDragEvents = (session, workspaceId) => ({
        draggable: !searching,
        onDragStart: (event) => {
          if (searching) return
          event.stopPropagation()
          try {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', session.id)
          } catch { }
          setDrag({ kind: 'session', source: { sessionId: session.id, workspaceId, title: session.title, leaf: session.leaf || session.title }, over: null })
        },
        onDragEnd: () => setDrag(null),
        onDragOver: (event) => {
          if (!dragMatches('session') || !canReorderSessions || drag.source.workspaceId !== workspaceId) return
          event.preventDefault()
          event.stopPropagation()
          try { event.dataTransfer.dropEffect = 'move' } catch { }
          const half = rowHalf(event)
          setDrag(current => (current && current.over && current.over.kind === 'session' && current.over.target === session.id && current.over.half === half)
            ? current
            : (current ? { ...current, over: { kind: 'session', target: session.id, half } } : current))
        },
        onDrop: (event) => {
          if (!dragMatches('session') || !canReorderSessions || drag.source.workspaceId !== workspaceId) return
          event.preventDefault()
          event.stopPropagation()
          const half = drag.over && drag.over.kind === 'session' && drag.over.target === session.id ? drag.over.half : rowHalf(event)
          commitSessionDrop(workspaceId, session.id, half)
        },
      })
      const sgroupDropEvents = (workspaceId, path) => ({
        onDragOver: (event) => {
          if (!dragMatches('session') || drag.source.workspaceId !== workspaceId) return
          event.preventDefault()
          event.stopPropagation()
          try { event.dataTransfer.dropEffect = 'move' } catch { }
          setDrag(current => (current && current.over && current.over.kind === 'sgroup' && current.over.target === path)
            ? current
            : (current ? { ...current, over: { kind: 'sgroup', target: path } } : current))
        },
        onDrop: (event) => {
          if (!dragMatches('session') || drag.source.workspaceId !== workspaceId) return
          event.preventDefault()
          event.stopPropagation()
          commitSessionMoveInto(workspaceId, path)
        },
      })
      const commitSessionDrop = (workspaceId, targetSessionId, half) => {
        const source = drag.source
        setDrag(null)
        if (!canReorderSessions) return
        if (source.sessionId === targetSessionId) return
        const workspace = (items || []).find(w => w.workspaceId === workspaceId)
        if (!workspace) return
        const flat = sessionsOf(workspace)
        const index = flat.findIndex(s => s.id === targetSessionId)
        const anchor = half === 'after'
          ? (index === -1 ? undefined : (flat[index + 1] ? flat[index + 1].id : undefined))
          : targetSessionId
        // v0.18.0 — a drop on a row of ANOTHER group MOVES the row (the name
        // prefix is rewritten to the target row's group). Until then only the
        // flat list was reordered while the visible order is decided by the
        // groups, so a cross-group drop left the row exactly where it was and
        // read as "the drag did nothing" (user report). Same group keeps the
        // pure reorder; with the name layer off every group is '' — which is
        // the same thing.
        const target = flat.find(s => s.id === targetSessionId)
        const nextTitle = sessionSlash && target ? titleMovedToGroup(source.title, target.title) : null
        // Official pinned-block rule: a pinned row reorders only among pinned
        // rows. A cross-block drop that would be a pure reorder is ignored;
        // group moves keep working (the pin fronts the row in its new group).
        if (target && nextTitle === null) {
          const sourceRow = flat.find(s => s.id === source.sessionId)
          if (sourceRow && !!sourceRow.pinned !== !!target.pinned) return
        }
        const reorder = () => {
          if (typeof insertSessionBefore === 'function') {
            return (anchor !== undefined ? insertSessionBefore(workspaceId, source.sessionId, anchor) : insertSessionBefore(workspaceId, source.sessionId))
          }
          // Host channel gone: commit the same move into the browser-local order.
          if (actions && typeof actions.setSessionOrder === 'function') {
            actions.setSessionOrder(workspaceId, reorderIds(flat.map((s) => s.id), source.sessionId, anchor))
          }
          return undefined
        }
        const chain = nextTitle !== null && nextTitle !== source.title
          ? Promise.resolve().then(() => renameByUser(source.sessionId, nextTitle))
          : Promise.resolve()
        chain.then(reorder).catch(fail)
      }
      /**
       * Drop a session ON ITS OWN WORKSPACE ROW = leave the group (v0.18.0).
       * The workspace row is the root of the session tree, so it is the one
       * drop target that always exists OUTSIDE every group — the user's "drag
       * it out of 测试1" gesture had nowhere to land before this.
       */
      const commitSessionMoveOut = (workspaceId) => {
        const source = drag.source
        setDrag(null)
        if (!source || source.workspaceId !== workspaceId) return
        const leaf = leafOf(source.title)
        if (leaf === source.title) return
        Promise.resolve()
          .then(() => renameByUser(source.sessionId, leaf))
          .then(() => {
            // Append to the end of the workspace's flat order: the row now
            // lives at the root level, and the host order is what the tree
            // renders there — without this it would surface somewhere in the
            // middle of the top-level rows, wherever its id happens to sit.
            if (typeof insertSessionBefore === 'function') return insertSessionBefore(workspaceId, source.sessionId)
            return undefined
          })
          .catch(fail)
      }
      const wsRootDropActive = (workspaceId) => dragMatches('session') && drag.over !== null && drag.over.kind === 'ws-root' && drag.over.target === workspaceId
      // v0.36.7: a group block hovering the disk-level row that OWNS it lights
      // the SAME framed INTO a workspace row gets on a group row — the visual
      // is one language: edge bands reorder, the middle band "puts inside".
      const wsGroupIntoActive = (workspaceId) => dragMatches('folder') && drag.over !== null && drag.over.kind === 'ws-level' && drag.over.target === workspaceId
      const commitSessionMoveInto = (workspaceId, groupPath) => {
        const source = drag.source
        setDrag(null)
        const newTitle = groupPath !== '' ? groupPath + '/' + source.leaf : source.leaf
        if (newTitle === source.title) return
        Promise.resolve()
          .then(() => renameByUser(source.sessionId, newTitle))
          .catch(fail)
      }

      /* ---------------------- group drop target ----------------------- */
      // The header's "New group" button doubles as a drop zone: dropping a
      // workspace/session row on it opens the move dialog with that row
      // locked and the group name empty. The drag state machine is reused —
      // `over.kind === 'newgroup'` is the one non-row drop target.

      const groupDropTarget = () => drag !== null && drag.over && drag.over.kind === 'newgroup'
      const groupDropEvents = {
        onDragOver: (event) => {
          if (drag === null) return
          // Only a layer that is ON accepts a drop; the slot never lights up
          // for a row whose name layer is off (see the header render guard).
          if (drag.kind === 'workspace' && !workspaceSlash) return
          if (drag.kind === 'session' && !sessionSlash) return
          event.preventDefault()
          event.stopPropagation()
          try { event.dataTransfer.dropEffect = 'move' } catch { }
          setDrag(current => (current && current.over && current.over.kind === 'newgroup')
            ? current
            : (current ? { ...current, over: { kind: 'newgroup' } } : current))
        },
        onDrop: (event) => {
          if (drag === null) return
          if ((drag.kind === 'workspace' && !workspaceSlash) || (drag.kind === 'session' && !sessionSlash)) {
            setDrag(null)
            return
          }
          event.preventDefault()
          event.stopPropagation()
          const source = drag.source
          if (!source) { setDrag(null); return }
          const target = drag.kind === 'session'
            ? { kind: 'session', id: source.sessionId, title: source.title || source.leaf, workspaceId: source.workspaceId }
            : { kind: 'workspace', id: source.workspaceId, title: source.folderPath ? source.folderPath + '/' + source.leaf : source.leaf }
          setDialog({ kind: 'group-move', target, initial: '', groupPaths: collectGroupPaths(target.kind) })
          setDrag(null)
        },
      }

      /* --------------------------- actions --------------------------- */

      const submitWorkspaceRename = (workspace, nextTitle) => {
        const title = String(nextTitle || '').trim()
        if (title === '' || title === workspace.title) { setDialog(null); return }
        Promise.resolve()
          .then(() => renameWorkspace(workspace.workspaceId, title))
          .then(() => setDialog(null))
          .catch(fail)
      }

      const submitWorkspaceDelete = (workspace) => {
        Promise.resolve()
          .then(() => deleteWorkspace(workspace.workspaceId))
          .then(() => setDialog(null))
          .catch(fail)
      }

      const submitSessionRename = (session, nextTitle) => {
        const title = String(nextTitle || '').trim()
        if (title === '' || title === session.title) { setDialog(null); return }
        Promise.resolve()
          .then(() => renameByUser(session.id, title))
          .then(() => setDialog(null))
          .catch(fail)
      }

      /** Rename one session sub-group: rewrite the title prefix of every member. */
      const submitSessionGroupRename = (target, rawName) => {
        const name = normPath(rawName)
        if (name === '') { setErrorText(t('folder.error.empty')); return }
        if (name === target.name) { setDialog(null); return }
        const workspace = (items || []).find(w => w.workspaceId === target.workspaceId)
        if (!workspace) { setDialog(null); return }
        const node = findSessionGroup(buildSessionTree(sessionsOf(workspace), sessionSlash, sessFolders, workspace.workspaceId), target.path)
        if (!node) { setDialog(null); return }
        const parentPath = target.path.includes('/') ? target.path.slice(0, target.path.lastIndexOf('/')) : ''
        const nextPath = parentPath !== '' ? parentPath + '/' + name : name
        const affected = collectSessionRows(node)
        Promise.resolve()
          .then(async () => {
            for (const row of affected) {
              if (row.blank) continue
              const nextTitle = nextPath + row.title.slice(target.path.length)
              await renameByUser(row.id, nextTitle)
            }
          })
          .then(() => setDialog(null))
          .catch(fail)
      }

      const findTreeNode = (node, path) => {
        if (path !== '' && node.path === path) return node
        for (const folder of node.folders) {
          const hit = findTreeNode(folder, path)
          if (hit) return hit
        }
        for (const w of node.workspaces || []) {
          if (w.sub) {
            const hit = findTreeNode(w.sub, path)
            if (hit) return hit
          }
        }
        return null
      }

      const submitFolderRename = (oldPath, rawPath) => {
        const newPath = normPath(rawPath)
        if (newPath === '') { setErrorText(t('folder.error.empty')); return }
        if (newPath === oldPath) { setDialog(null); return }
        const node = findTreeNode(tree, oldPath)
        const hasChildren = node ? countWorkspaces(node) > 0 : false
        const prefix = oldPath + '/'
        const affected = hasChildren
          ? (items || []).filter(w => String(w.title || '').startsWith(prefix))
          : []
        Promise.resolve()
          .then(async () => {
            for (const w of affected) {
              const nextTitle = newPath + String(w.title).slice(oldPath.length)
              await renameWorkspace(w.workspaceId, nextTitle)
            }
          })
          .then(() => setDialog(null))
          .catch(fail)
      }

      /* ---------------------------- rows ----------------------------- */

      const renderSessionTree = (workspace, depth) => {
        // Folder semantics: a closed workspace shows no sessions at all (the
        // row keeps its count badge); an open one shows the full session tree.
        if (!searching && !sessionsOpenOf(workspace.workspaceId)) return []
        const full = sessionsOf(workspace)
        if (full.length === 0 && !hasDeclared(sessFolders, workspace.workspaceId)) return []
        // Issue #8 progressive listing: quota the IDLE rows of this folder
        // (attention rows stay visible — see limitSessionsForRender); one
        // overflow row hides the rest until clicked. Search always shows
        // everything, and the current session is passed so it can never be
        // folded away.
        const limited = limitSessionsForRender(full, sessionLimit, limitLifted[workspace.workspaceId], currentId)
        const out = renderSessionNode(buildSessionTree(limited.rows, sessionSlash, sessFolders, workspace.workspaceId), workspace.workspaceId, depth)
        if (limited.hidden > 0) {
          out.push(E('button', {
            key: 'lim-' + workspace.workspaceId,
            type: 'button',
            className: 'bw-row bw-overflow-row',
            style: { paddingLeft: 8 + (depth + 1) * 12 },
            onClick: () => setLimitLifted((current) => ({ ...current, [workspace.workspaceId]: true })),
          }, t('sessions.expand', { n: limited.hidden })))
        }
        return out
      }
      const searchSessionNode = (node) => {
        const groups = []
        for (const group of node.groups) {
          const hit = searchSessionNode(group)
          if (hit) groups.push(hit)
        }
        const sessions = node.sessions.filter(s => ((s.leaf || s.title) + ' ' + s.title).toLowerCase().includes(normalizedQuery))
        if (groups.length === 0 && sessions.length === 0) return null
        return { path: node.path, name: node.name, groups, sessions }
      }
      const renderSessionNode = (node, workspaceId, depth) => {
        const view = searching ? searchSessionNode(node) : node
        if (!view) return []
        const out = []
        for (const group of view.groups) {
          const key = workspaceId + '|' + group.path
          const open = searching || sessionGroupOpen(key)
          out.push(E(SessionGroupRow, {
            key: 'sg-' + key,
            name: group.name,
            depth,
            expanded: open,
            pulse: (statusPulse && !open) ? nodePulseOf(group) : null,
            count: countSessionTree(group),
            onToggle: () => { if (!searching) actions.setSessionGroupExpanded(key, !open) },
            onContextMenu: (e) => openCtx('sgroup', { workspaceId, path: group.path, name: group.name, empty: countSessionTree(group) === 0 }, e),
            dropInto: sgroupDropInto(workspaceId, group.path),
            dragEvents: sgroupDropEvents(workspaceId, group.path),
            custStyle: rowStyleOf('sgroup:' + workspaceId + '|' + group.path),
            t,
          }))
          if (open) out.push(...renderSessionNode(group, workspaceId, depth + 1))
        }
        for (const s of view.sessions) out.push(renderSessionRow(s, depth, workspaceId))
        return out
      }

      const renderSessionRow = (session, depth, workspaceId) => E(SessionRow, {
        key: session.id,
        node: session,
        depth,
        current: currentId === session.id,
        now,
        onOpen: (id) => open(id),
        onContextMenu: (e) => openCtx('session', session, e),
        dropHalf: workspaceId && !session.archived ? sessDropHalf(session.id) : null,
        dragEvents: workspaceId && !session.archived ? sessionDragEvents(session, workspaceId) : undefined,
        custStyle: rowStyleOf('session:' + session.id),
        sessionActions,
        scheduleSeat,
        breathing: statusPulse,
        t,
      })

      /**
       * rc.2 archived-only rule (official tree.ts groupByWorkspace): that view
       * lists archives, not the Workspace inventory, so a Workspace whose
       * visible Sessions are empty contributes no row at all — and a name group
       * left without one is dropped with it (the shipped browser re-parents a
       * surviving descendant onto the nearest rendered ancestor; our groups are
       * derived from the members, so an emptied one simply disappears).
       * `sessionsOf` already applies the SAME visibility rule the rows render
       * with, so this can never disagree with the session list below the row.
       */
      const archivedOnly = archivedFilter === 'only'
      const workspaceVisible = (workspace) => !archivedOnly
        || !!(workspace && Array.isArray(workspace.sessionIds) && sessionsOf(workspace).length > 0)
      const countVisibleAt = (level) => {
        let total = 0
        for (const folder of level.folders) {
          total += folder.kind === 'ws'
            ? (workspaceVisible(folder.workspace) ? 1 : 0)
            : countVisibleAt(folder)
        }
        for (const entry of level.workspaces) {
          if (workspaceVisible(entry)) total += 1
          if (entry.sub) total += countVisibleAt(entry.sub)
        }
        return total
      }

      const renderWorkspaceEntry = (entry, depth, pulse) => {
        const { workspace } = entry
        if (!workspaceVisible(workspace)) return []
        const count = countSessionTree(buildSessionTree(sessionsOf(workspace), sessionSlash, sessFolders, workspace.workspaceId))
        const rows = [E(WorkspaceRow, {
          key: 'ws-' + workspace.workspaceId,
          workspace,
          depth,
          count,
          sessionsOpen: searching ? true : sessionsOpenOf(workspace.workspaceId),
          currentInside: wsHasCurrent(workspace),
          onToggle: () => { if (!searching) actions.setSessionsExpanded(workspace.workspaceId, !sessionsOpenOf(workspace.workspaceId)) },
          // Starting a session force-expands the workspace row: the user must
          // SEE the new session appear, even if the row was collapsed.
          onStart: () => { actions.setSessionsExpanded(workspace.workspaceId, true); startSession(workspace.workspaceId) },
          onContextMenu: (e) => openCtx('workspace', workspace, e),
          // The in-row ellipsis is retired; the ctx surface stays the
          // right-click path. While the menu is open the row still pins
          // (hover fill + visible actions), matching the official menuOpen
          // state — the shared popup reports its captured target through
          // contextMenus.active, while older hosts keep the local ctx.
          menuOpen: !!(
            (ctx && ctx.kind === 'workspace' && ctx.payload && ctx.payload.workspaceId === workspace.workspaceId)
            || (activeContextMenu && activeContextMenu.kind === 'workspace'
              && activeContextMenu.value && activeContextMenu.value.workspaceId === workspace.workspaceId)
          ),
          hoverBody: workspaceHoverBody,
          dropHalf: wsDropHalf(workspace.workspaceId),
          dropInto: wsRootDropActive(workspace.workspaceId) || wsGroupIntoActive(workspace.workspaceId),
          dragEvents: workspaceDragEvents(workspace),
          custStyle: rowStyleOf('workspace:' + workspace.workspaceId),
          iconMode: (styleEntry('workspace:' + workspace.workspaceId) || {}).icon || 'solid',
          // Shipped sidebar parity: the row's new-session affordance names the
          // current binding (Tooltip shortcutKeys upstream, native title here).
          newSessionLabel: shortcutLabel(t('session.new'), 'session.new'),
          newSessionAria: shortcutAria('session.new'),
          pulse,
          t,
        })]
        // Disk-nested child workspaces render under the SAME expansion
        // toggle, above the session tree — the nesting is a filesystem
        // fact; the sessions still belong to this row. Search views are
        // flattened, so sub levels never render there.
        if (workspace.sub && !searching && sessionsOpenOf(workspace.workspaceId)) {
          rows.push(...renderLevelRows(workspace.sub, depth + 1))
        }
        rows.push(...renderSessionTree(workspace, depth + 1))
        return rows
      }

      // Official folderActive semantics (Rows.tsx ProjectRow): a folder or
      // workspace whose SUBTREE holds the current session tints its folder
      // glyph blue, regardless of expansion. The plugin tree is path-folded,
      // so ancestor folders match by disk-path prefix, and disk-nested
      // workspace chains are walked through the sub levels.
      const pathHoldsCurrent = (ancestor, child) => !!ancestor && !!child
        && (child === ancestor || child.startsWith(ancestor.endsWith('/') ? ancestor : ancestor + '/'))
      const subHasCurrent = (level) => {
        if (!level || !currentId) return false
        for (const w of level.workspaces || []) if (wsHasCurrent(w)) return true
        for (const f of level.folders || []) {
          if (f.kind === 'ws') { if (wsHasCurrent(f.workspace)) return true } else if (subHasCurrent(f)) return true
        }
        return false
      }
      const wsHasCurrent = (w) => !!currentId && !!w
        && ((w.sessionIds || []).includes(currentId) || subHasCurrent(w.sub))
      // Name groups (slash view) have no disk path to prefix-match; the
      // folder glyph lights up whenever its SUBTREE holds the current
      // session — the official ProjectRow rule, applied tree-wide.
      const nodeHoldsCurrent = (level) => {
        if (!level || !currentId) return false
        for (const item of levelSeqOf(level)) {
          if (item.kind === 'ws') { if (wsHasCurrent(item.entry)) return true }
          else if (nodeHoldsCurrent(item.node)) return true
        }
        return false
      }
      const currentWsPath = currentId
        ? ((items || []).find((w) => (w.sessionIds || []).includes(currentId)) || {}).path
        : undefined
      const renderLevelRows = (level, depth) => {
        const rows = []
        for (const item of levelSeqOf(level)) {
          rows.push(...(item.kind === 'ws'
            ? renderWorkspaceEntry({ workspace: item.entry }, depth, wsPulseOf(item.entry))
            : renderPlainFolder(item.node, depth)))
        }
        return rows
      }

      const renderPlainFolder = (node, depth) => {
        if (node.kind === 'ws') return renderWorkspaceEntry({ workspace: node.workspace }, depth, wsPulseOf(node.workspace))
        // Archived-only view: a group whose Workspaces all lost their archived
        // Sessions is as empty as they are (see countVisibleAt).
        if (archivedOnly && countVisibleAt(node) === 0) return []
        // idPath disambiguates same-named name groups living in different
        // disk levels; path stays the semantic key (rename prefix logic).
        const idPath = node.idPath || node.path
        const expanded = searching || folderExpanded(idPath)
        const rows = [E(FolderRow, {
          key: 'f-' + idPath,
          node,
          depth,
          expanded,
          onToggle: () => { if (!searching) actions.setExpanded(idPath, !expanded) },
          onContextMenu: (e) => openCtx('folder', { path: node.path, name: node.name, idPath, scope: node.scope, empty: countWorkspaces(node) === 0 }, e),
          dropInto: wsDropInto(idPath),
          dropSlot: wsFolderSlotOf(idPath),
          dragEvents: folderDropEvents(idPath, node.path, node),
          custStyle: rowStyleOf('folder:' + idPath),
          iconMode: (styleEntry('folder:' + idPath) || {}).icon || 'solid',
          pulse: expanded ? null : folderPulseOf(node),
          active: pathHoldsCurrent(currentWsPath, node.path) || nodeHoldsCurrent(node),
          t,
        })]
        if (expanded) {
          for (const item of levelSeqOf(node)) {
            rows.push(...(item.kind === 'ws'
              ? renderWorkspaceEntry({ workspace: item.entry }, depth + 1, wsPulseOf(item.entry))
              : renderPlainFolder(item.node, depth + 1)))
          }
        }
        return rows
      }

      // Single flat list (v0.13 groupBy:'flat', official FlatList semantics):
      // every visible session — each workspace's rows plus the ungrouped
      // account — as one depth-0 list. Rows keep their FULL title (no leaf
      // split, no levels), and render through the workspaceId-less path,
      // which carries no drag anchors by construction.
      const renderFlatRows = () => {
        const rows = []
        for (const workspace of items || []) rows.push(...sessionsOf(workspace))
        rows.push(...ungrouped)
        // sessionsOf() sorts inside one workspace; flat mode needs one global
        // recency sort, including the Ungrouped bucket (not per-workspace runs).
        const ordered = orderBy === 'updated' ? orderSessionsByRecency(rows, currentId) : rows
        return ordered.map((s) => renderSessionRow({ ...s, leaf: s.title }, 0, undefined))
      }
      const renderUngroupedBlock = () => {
        const rows = []
        if (ungrouped.length > 0) {
          // Issue #6: the Ungrouped bucket folds like every other group row
          // (chevron + live count); search keeps it expanded.
          const open = searching || ungroupedOpen
          rows.push(E('div', {
            key: 'ungrouped-label',
            className: 'bw-row bw-sgroup-row',
            style: { '--bw-indent': '0px' },
            onClick: () => { if (!searching && actions && typeof actions.setUngroupedOpen === 'function') actions.setUngroupedOpen(!open) },
            role: 'treeitem',
            'aria-expanded': open,
          },
            E('span', { className: cls('bw-chevron', open && 'bw-chevron-open') }, E('span', { className: 'bw-arrow' }, icon('IconTriangleRightFill14', 14))),
            E('span', { className: 'bw-row-label' }, t('group.ungrouped')),
            E('span', { className: 'bw-row-count' }, String(ungrouped.length)),
          ))
          if (open) for (const s of ungrouped) rows.push(renderSessionRow(s, 0))
        }
        return rows
      }
      let bodyRows = []
      if (searching) {
        for (const entry of searched) bodyRows.push(...renderWorkspaceEntry(entry, 0))
      } else if (groupBy === 'flat') {
        bodyRows.push(...renderFlatRows())
      } else if (groupBy === 'workspace') {
        if (workspaceGroupMode === 'disk') {
          // Official 'workspace' mode (v0.13): one level — every workspace at
          // the root, no name groups, no disk nesting, no chain compression.
          // Session rows keep the slash toggle; disk-nested children do not
          // recurse here because raw items carry no .sub level.
          // flatWorkspaceEntry, never the raw item: see its note — the raw
          // one has no `leaf` and the row would render nameless.
          for (const workspace of items || []) {
            bodyRows.push(...renderWorkspaceEntry({ workspace: flatWorkspaceEntry(workspace) }, 0, wsPulseOf(workspace)))
          }
        } else {
          // v0.36.11: with a NAME layer enabled (disk-slash / slash), the
          // official scatter contradicts the user's mental model — the name
          // tree the sidebar has been rendering all along should stay a tree,
          // just lifted to the root (disk nesting OFF = 'slash' mode in the
          // tree memo above). Same render loop as the tree branch below:
          // mixed sequence, drag events, ungrouped block all apply.
          for (const item of levelSeqOf(tree)) {
            bodyRows.push(...(item.kind === 'ws'
              ? renderWorkspaceEntry({ workspace: item.entry }, 0, wsPulseOf(item.entry))
              : renderPlainFolder(item.node, 0)))
          }
        }
        bodyRows.push(...renderUngroupedBlock())
      } else {
        for (const item of levelSeqOf(tree)) {
          bodyRows.push(...(item.kind === 'ws'
            ? renderWorkspaceEntry({ workspace: item.entry }, 0, wsPulseOf(item.entry))
            : renderPlainFolder(item.node, 0)))
        }
        bodyRows.push(...renderUngroupedBlock())
      }
      const isEmpty = bodyRows.length === 0
      if (isEmpty) {
        // rc.2 names the archived-only state and offers the way back
        // (official EmptySessions): the filter is a mode the user can get
        // stuck in, so the empty body explains it and leaves in one click.
        bodyRows = archivedOnly && !searching
          ? [E('div', { key: 'empty', className: 'bw-empty' },
              E('div', null, shippedText('empty.noneArchived', t('empty.noneArchived'))),
              E('button', {
                type: 'button',
                className: 'bw-empty-action',
                onClick: () => { if (actions && typeof actions.setArchivedFilter === 'function') actions.setArchivedFilter('default') },
              }, shippedText('empty.viewOthers', t('empty.viewOthers'))),
            )]
          : [E('div', { key: 'empty', className: 'bw-empty' }, searching ? t('empty.search') : (phase === 'pending' ? '…' : t('empty')))]
      }
      // Keyed-row handoff for AnimatedRows: every body row carries a stable
      // data-row-key (the element's React key when present, array index
      // otherwise) and the key list feeds the component's sameRows guard.
      bodyRows = bodyRows.filter((el) => el !== null && el !== false && el !== undefined)
      const bodyRowKeys = []
      bodyRows = bodyRows.map((el, index) => {
        if (!el || typeof el !== 'object') return el
        const rowKey = el.key != null ? String(el.key) : 'row-' + index
        bodyRowKeys.push(rowKey)
        return React.cloneElement(el, { 'data-row-key': rowKey, dataRowKey: rowKey })
      })

      /* ------------------------- context menu ------------------------ */

      // Context-menu entries mirror the OFFICIAL row menus item-for-item
      // (ui-workspace Rows.tsx workspaceMenuItems / sessionMenuItems): same
      // ids, same icons, same danger semantics, and — through the official
      // 'workspace' dictionary — the same copy, so upstream rewording lands
      // here without a plugin release. What the official menus cannot
      // provide is the bw-only surface: name-group / session-group rename
      // and Customize appearance, appended after a separator.
      const ot = typeof officialT === 'function' ? officialT : null
      // Shared session-menu builder + dispatcher: the right-click menu AND
      // the row's own "..." menu render the SAME entry list (official
      // mirror + bw extensions + trailing customize) and dispatch through
      // the SAME handler, so the two surfaces cannot drift. menuEntries
      // feeds it the ctx payload; sessionActions feeds it the row node.
      const sessionMenuEntriesFor = (payload) => {
        const customizeEntry = { id: 'customize', label: t('custom.title'), icon: icon('IconPersonalizationOutline16', 16) }
        const groupItem = { id: 'move-group', label: t('menu.moveToGroup'), icon: icon('IconFolderOpenOutline16', 16) }
        const ungroupItem = { id: 'move-out', label: t('menu.moveOutGroup'), icon: icon('IconRightUpOutline16', 16) }
        const sgroupItems = sessionSlash ? [groupItem] : []
        const sessionUngroupItems = sessionSlash && payload && groupPrefixOf(String(payload.title || '')) !== '' ? [ungroupItem] : []
        const official = (key, fallback) => {
          const value = typeof ot === 'function' ? ot(key) : null
          return typeof value === 'string' && value !== '' && value !== key ? value : fallback
        }
        const archived = !!(payload.archived || (archivedSet && archivedSet.has(payload.id)))
        const pinned = !!(payload.pinned || (pinnedSet && pinnedSet.has(payload.id)))
        // Official 0.1.7 mirror (Rows.tsx session menu + the shipped slot
        // entries): pin, rename, fork, archive — same order, same icons,
        // same archived-state behavior (pin hides; archive becomes
        // unarchive). Copy Session ID (order 450) rides the official
        // dictionary, so upstream rewording AND future item additions land
        // without a plugin release; every verb is gated on its service
        // method so older hosts simply never offer what they cannot do.
        return [
          ...(pinAvailable && !archived ? [{
            id: pinned ? 'unpin' : 'pin',
            label: official(pinned ? 'menu.unpinSession' : 'menu.pinSession', t('menu.archive')),
            icon: icon(pinned ? 'IconPinFillRegular' : 'IconPinOutlineRegular', 16),
          }] : []),
          { id: 'rename', label: official('rename', t('menu.rename')), icon: icon('IconEditOutline16', 16) },
          { id: 'fork', label: official('menu.fork', t('menu.fork')), icon: icon('IconBranchOutline16', 16) },
          // Official semantics: archive hides the row through the
          // registry-global archive set and never touches the session log
          // — deliberately NOT styled destructive. An archived row gets
          // the restore entry instead.
          archived
            ? { id: 'unarchive', label: official('menu.unarchiveSession', t('menu.archive')), icon: icon('IconUnarchiveOutlineRegular', 16) }
            : { id: 'archive', label: official('menu.archiveSession', t('menu.archive')), icon: icon('IconArchiveOutline20', 16) },
          ...(typeof ui.writeClipboard === 'function' ? [{
            id: 'copy-id',
            label: official('menu.sessionId', t('menu.sessionId')),
            icon: icon('IconCopyOutlineRegular', 16),
          }] : []),
          { type: 'separator', id: 'bw-sep' },
          ...sessionUngroupItems,
          ...sgroupItems,
          customizeEntry,
        ]
      }
      // One group-LEAVING implementation for the local menu and the official
      // contribution: retitle to the leaf and let the user-touch wrapper pin it.
      const moveSessionOut = (payload) => {
        const title = String(payload.title || '')
        const leaf = leafOf(title)
        if (leaf !== title) Promise.resolve().then(() => renameByUser(payload.id, leaf)).catch(fail)
      }
      const pickSessionAction = (payload, id) => {
        if (id === 'rename') { setDialog({ kind: 'sess-rename', session: payload }); return true }
        if (id === 'fork') { forkSession(payload.id); return true }
        if ((id === 'pin' || id === 'unpin') && pinAvailable) {
          Promise.resolve().then(() => (id === 'pin' ? pinSession : unpinSession)(payload.id)).catch((reason) => {
            fail(officialText(id === 'pin' ? 'toast.pinFailed' : 'toast.unpinFailed', undefined, reason instanceof Error ? reason.message : String(reason || 'pin failed')))
          })
          return true
        }
        if (id === 'unarchive' && unarchiveAvailable) {
          Promise.resolve().then(() => unarchiveSession(payload.id)).catch((reason) => { console.warn('session unarchive rejected:', reason) })
          return true
        }
        if (id === 'archive' && typeof archiveSession === 'function') {
          Promise.resolve().then(() => archiveSession(payload.id)).catch((reason) => {
            // Official refusal flow: running work refuses the plain archive
            // (WorkspaceArchiveError / workspace/session-active) and the
            // confirmation offers to stop it first. Anything else reports
            // through the error modal.
            if (reason && reason.name === 'WorkspaceArchiveError') {
              setDialog({ kind: 'sess-archive-confirm', sessionId: payload.id })
              return
            }
            fail(reason)
          })
          return true
        }
        if (id === 'copy-id' && typeof ui.writeClipboard === 'function') {
          // Official mirror: copied → success notice, anything else → the
          // failure notice (official sessionIdInjected wiring).
          Promise.resolve(ui.writeClipboard(payload.id)).then((copied) => {
            setCopyNotice((prev) => ({ seq: (prev ? prev.seq : 0) + 1, ok: copied === true }))
          }, () => {
            setCopyNotice((prev) => ({ seq: (prev ? prev.seq : 0) + 1, ok: false }))
          })
          return true
        }
        // Plain retitle back to the leaf: the row leaves its group and
        // returns to the top level of its workspace (v0.18.0).
        if (id === 'move-out') { moveSessionOut(payload); return true }
        return false
      }
      // Shared workspace-preset flow: the local menu and the official
      // contribution both land here, so the blank-session rules cannot drift.
      const openWorkspacePresetDialog = (payload) => {
        if (!presetFace) return
        // Freeze the target NOW (the dialog outlives the menu ctx): the
        // blank lookup mirrors the official createInWorkspace rule — a
        // standing blank IS the workspace default (its preset projection
        // is what the hero chip shows). With NO standing blank the edit
        // still applies: ClientSessions.create prepares one WITH the
        // picked preset (the same channel as the official new-session
        // button), which makes it the workspace default. Creating a
        // session here is deliberate, not a side effect — the host has
        // no other per-workspace default store (agent-preset-registry
        // selectedDefault is GLOBAL; the standing blank IS the carrier).
        const raw = (storedItems || []).find((item) => item.workspaceId === payload.workspaceId)
        const blankIds = raw && Array.isArray(raw.sessionIds) ? raw.sessionIds : []
        const blankId = raw && raw.path
          ? (list.ids || []).find((sid) => {
            const summary = list.byId[sid]
            return summary && summary.blank === true && summary.cwd === raw.path
              && blankIds.indexOf(sid) !== -1 && !archivedSet.has(sid)
          })
          : undefined
        const blankSummary = blankId !== undefined ? list.byId[blankId] : undefined
        const projection = blankSummary ? blankSummary.projectionValues : undefined
        setDialog({
          kind: 'ws-preset',
          hasBlank: blankId !== undefined,
          applyPreset: blankId !== undefined
            ? (presetId) => presetFace.select(blankId, presetId)
            // Reuse declined / no draft to reuse: create WITH the preset.
            // Shape matches select's { ok } contract; a SessionCreateError
            // lands in the dialog as an inline refusal line.
            : (presetId) => Promise.resolve()
              .then(() => sessions.create({ cwd: raw.path, agentPreset: presetId }))
              .then(() => ({ ok: true }), (reason) => ({ ok: false, refusal: reason instanceof Error ? reason.message : String(reason || 'session create failed') })),
          current: projection && typeof projection.agentPreset === 'string' ? projection.agentPreset : undefined,
        })
      }
      const menuEntries = () => {
        if (ctx === null) return []
        const customizeEntry = { id: 'customize', label: t('custom.title'), icon: icon('IconPersonalizationOutline16', 16) }
        // The discoverability entry (v0.15): a row can be moved into a name
        // group — but ONLY while the matching name layer is ON. With "/"
        // grouping off for workspaces there is no workspace group to move into,
        // and offering the item would promise a container the tree no longer
        // renders. The two layers gate independently, so a session row keeps
        // the entry even when workspaces have gone disk-only.
        // IconFolderOutline16 is NOT in this host's icon set (retired early):
        // probing it silently yielded a glyph-less row. IconFolderOpenOutline16
        // is present and reads as "move into a group" just as well.
        const groupItem = { id: 'move-group', label: t('menu.moveToGroup'), icon: icon('IconFolderOpenOutline16', 16) }
        const wsGroupItems = workspaceSlash ? [groupItem] : []
        const sgroupItems = sessionSlash ? [groupItem] : []
        // "Delete group" only makes sense for a DECLARED group that holds
        // nothing (v0.17.0): a group with members is a projection of their
        // titles, so removing the declaration would change nothing on screen
        // and the row would stay — offering it would be a lie.
        const deleteFolderEntry = { id: 'delete-folder', label: t('menu.deleteGroup'), icon: icon('IconTrashOutline16', 16), danger: true }
        const deleteSgroupEntry = { id: 'delete-sgroup', label: t('menu.deleteGroup'), icon: icon('IconTrashOutline16', 16), danger: true }
        if (ctx.kind === 'folder') return [
          { id: 'rename-folder', label: t('menu.renameFolder'), icon: icon('IconEditOutline16', 16) },
          ...(ctx.payload && ctx.payload.empty ? [deleteFolderEntry] : []),
          { type: 'separator', id: 'bw-sep' },
          ...wsGroupItems,
          customizeEntry,
        ]
        if (ctx.kind === 'workspace') return [
          { id: 'rename', label: ot ? ot('rename') : t('menu.rename'), icon: icon('IconEditOutline16', 16) },
          { id: 'delete', label: ot ? ot('delete.workspace') : t('menu.delete'), icon: icon('IconTrashOutline16', 16), danger: true },
          { type: 'separator', id: 'bw-sep' },
          ...wsGroupItems,
          customizeEntry,
          // v0.32.0: the workspace default preset. Rides the official
          // agent-preset roster + blank-composition channels (the hero
          // chip's remotes); hidden entirely where the host lacks them —
          // older hosts simply never offer what they cannot do.
          ...(presetFace ? [{ id: 'ws-preset', label: t('menu.workspacePreset'), icon: icon('IconAgentPresetOutlineRegular', 16) }] : []),
        ]
        if (ctx.kind === 'session') {
          // The shared builder owns the session list (see
          // sessionMenuEntriesFor): the ctx menu and any future surface share
          // it, so the entries cannot drift.
          return sessionMenuEntriesFor(ctx.payload || {})
        }
        return [
          { id: 'rename-sgroup', label: t('menu.renameSgroup'), icon: icon('IconEditOutline16', 16) },
          ...(ctx.payload && ctx.payload.empty ? [deleteSgroupEntry] : []),
          ...sgroupItems,
          { type: 'separator', id: 'bw-sep' },
          customizeEntry,
        ]
      }
      const handleCtxPick = (id) => {
        const current = ctx
        if (current === null) return
        if (id === 'customize') {
          const payload = current.payload
          const name = current.kind === 'workspace' ? (payload.title || payload.leaf)
            : (current.kind === 'session' ? payload.title : payload.name)
          setCustomize({ kind: current.kind, entryKey: keyOf(current.kind, payload), name })
          setCtx(null)
          return
        }
        const { kind, payload } = current
        setCtx(null)
        if (id === 'move-group') {
          // Lock the clicked row as the dialog target; the group name starts
          // at its CURRENT prefix so "retype to move elsewhere" is one edit.
          const target = kind === 'folder' ? { kind: 'folder', path: payload.path, title: payload.path }
            : kind === 'workspace' ? { kind: 'workspace', id: payload.workspaceId, title: payload.title || payload.leaf }
              : kind === 'session' ? { kind: 'session', id: payload.id, title: payload.title }
                : { kind: 'sgroup', path: payload.path, title: payload.path, workspaceId: payload.workspaceId }
          setDialog({ kind: 'group-move', target, initial: groupPrefixOf(target.title), groupPaths: collectGroupPaths(target.kind) })
        }
        else if (kind === 'folder' && id === 'rename-folder') setDialog({ kind: 'folder-rename', path: payload.path })
        else if (kind === 'folder' && id === 'delete-folder') setDialog({ kind: 'folder-delete', path: payload.path, scope: payload.scope, name: payload.name })
        else if (kind === 'sgroup' && id === 'delete-sgroup') setDialog({ kind: 'sgroup-delete', target: payload })
        else if (kind === 'workspace' && id === 'rename') setDialog({ kind: 'ws-rename', workspace: payload })
        else if (kind === 'workspace' && id === 'delete') setDialog({ kind: 'ws-delete', workspace: payload })
        else if (kind === 'workspace' && id === 'ws-preset' && presetFace) openWorkspacePresetDialog(payload)
        else if (kind === 'sgroup' && id === 'rename-sgroup') setDialog({ kind: 'sgroup-rename', target: payload })
        else if (kind === 'session') {
          // The shared dispatcher owns every session verb (see
          // pickSessionAction); an unknown id falls through silently.
          if (!pickSessionAction(payload, id)) return
        }
      }

      // The official contribution runs outside this component, so it gets a
      // live bridge to the SAME action implementations (dialogs included).
      // The effect republishes after every render: slash switches, the preset
      // face and the current session inventory all feed availability.
      const menuBridgeValue = {
        slashes: { session: sessionSlash, workspace: workspaceSlash },
        hasPreset: () => !!presetFace,
        groupPrefix: (title) => groupPrefixOf(title),
        label: (key) => t(key),
        customize: (kind, payload) => {
          const name = kind === 'workspace' ? (payload.title || payload.leaf) : payload.title
          setCustomize({ kind, entryKey: keyOf(kind, payload), name })
        },
        moveGroup: (kind, payload) => {
          const title = kind === 'workspace' ? (payload.title || payload.leaf) : payload.title
          const target = kind === 'workspace'
            ? { kind: 'workspace', id: payload.workspaceId, title }
            : { kind: 'session', id: payload.id, title }
          setDialog({
            kind: 'group-move',
            target,
            initial: groupPrefixOf(target.title),
            groupPaths: collectGroupPaths(kind),
          })
        },
        moveOut: moveSessionOut,
        workspacePreset: (payload) => openWorkspacePresetDialog(payload),
      }
      React.useEffect(() => {
        if (typeof setMenuBridge !== 'function') return undefined
        setMenuBridge(menuBridgeValue)
        return () => setMenuBridge(null)
      })

      /* --------------------------- dialogs --------------------------- */
      // TextDialog / ConfirmDialog are module-level components: a per-render
      // inline definition would remount on every parent tick and drop input.

      /* ---------------------------- render --------------------------- */

      const dialogElement = (() => {
        if (dialog === null) return null
        if (dialog.kind === 'ws-rename') return E(TextDialog, {
          key: 'ws-rename',
          title: t('ws.rename.title'),
          // The "/" hint only tells the truth while the name layer is ON; with
          // workspaces rendering disk-only it would advertise grouping that is
          // switched off.
          hint: workspaceSlash ? t('ws.rename.hint') : null,
          initial: dialog.workspace.title || dialog.workspace.leaf,
          onConfirm: (v) => submitWorkspaceRename(dialog.workspace, v),
          onClose: () => setDialog(null),
          t,
        })
        // Declared-empty groups are the only ones that can be deleted (the menu
        // only offers it there): removing the declaration of a group whose
        // members still carry the prefix would change nothing on screen.
        if (dialog.kind === 'folder-delete') return E(ConfirmDialog, {
          key: 'folder-delete',
          title: t('group.delete.title'),
          body: t('group.delete.body', { name: dialog.name }),
          onConfirm: () => { actions.removeFolder('workspace', dialog.scope, dialog.path); setDialog(null) },
          onClose: () => setDialog(null),
          t,
        })
        if (dialog.kind === 'sgroup-delete') return E(ConfirmDialog, {
          key: 'sgroup-delete',
          title: t('group.delete.title'),
          body: t('group.delete.body', { name: dialog.target.name }),
          onConfirm: () => { actions.removeFolder('session', dialog.target.workspaceId, dialog.target.path); setDialog(null) },
          onClose: () => setDialog(null),
          t,
        })
        if (dialog.kind === 'ws-delete') return E(ConfirmDialog, {
          key: 'ws-delete',
          title: t('ws.delete.title'),
          body: t('ws.delete.body', { name: dialog.workspace.title || dialog.workspace.leaf }),
          onConfirm: () => submitWorkspaceDelete(dialog.workspace),
          onClose: () => setDialog(null),
          t,
        })
        if (dialog.kind === 'sess-rename') return E(TextDialog, {
          key: 'sess-rename',
          title: t('menu.rename'),
          initial: dialog.session.title,
          onConfirm: (v) => submitSessionRename(dialog.session, v),
          onClose: () => setDialog(null),
          t,
        })
        if (dialog.kind === 'sess-archive-confirm') {
          // Official stop-and-archive confirmation (dsh 0.1.7
          // SessionArchiveConfirmDialog mirror): the Host refused the plain
          // archive because this session still runs; confirming asks the
          // Host to stop that work first. Copy rides the official dictionary.
          const summary = list && list.byId ? list.byId[dialog.sessionId] : undefined
          const displayTitle = summary ? rowTitleOf(dialog.sessionId, summary, prefsMap.graftTitlePrefix !== false) : ''
          return E(ConfirmDialog, {
            key: 'sess-archive-confirm',
            title: officialText('archive.confirm.title', undefined, t('menu.archive')),
            body: officialText('archive.confirm.desc', { title: displayTitle }, ''),
            confirmLabel: officialText('archive.confirm.action', undefined, undefined),
            onConfirm: () => {
              Promise.resolve().then(() => archiveSession(dialog.sessionId, { stopActivity: true }))
                .then(() => setDialog(null))
                .catch(fail)
            },
            onClose: () => setDialog(null),
            t,
          })
        }
        if (dialog.kind === 'sgroup-rename') return E(TextDialog, {
          key: 'sgroup-rename',
          title: t('menu.renameSgroup'),
          hint: t('ws.rename.hint'),
          initial: dialog.target.name,
          onConfirm: (v) => submitSessionGroupRename(dialog.target, v),
          onClose: () => setDialog(null),
          t,
        })
        if (dialog.kind === 'folder-rename') return E(TextDialog, {
          key: 'folder-rename',
          title: t('folder.rename.title'),
          hint: t('folder.rename.hint'),
          initial: dialog.path,
          onConfirm: (v) => submitFolderRename(dialog.path, v),
          onClose: () => setDialog(null),
          t,
        })
        if (dialog.kind === 'group-new') return E(GroupNewDialog, {
          key: 'group-new',
          kinds: newGroupLayers(),
          initialKind: dialog.layer === 'workspace' ? 'workspace' : 'session',
          treeOf: newGroupTreeOf,
          // The heading names the layer(s) the button promised: with both
          // layers live the switch below decides, so the generic wording is
          // accurate there and only there.
          label: newGroupLabel(),
          onConfirm: (kind, scope, path) => { actions.addFolder(kind, scope, path); setDialog(null) },
          onClose: () => setDialog(null),
          t,
        })
        if (dialog.kind === 'group-move') return E(GroupDialog, {
          key: 'group-move',
          title: t('group.move.title'),
          hint: t('ws.rename.hint'),
          initial: dialog.initial || '',
          // targets present = the picker shape (header button / drop slot);
          // absent = the row was locked by the context menu or a drop.
          targets: dialog.targets || null,
          groupPaths: dialog.groupPaths || [],
          onConfirm: (tv, gv) => submitGroupMove(dialog.targets ? targetOfValue(tv) : dialog.target, gv),
          onClose: () => setDialog(null),
          t,
        })
        if (dialog.kind === 'add-guide' || dialog.kind === 'add-flow') {
          // v0.28.0: a browse host gets the SHIPPED in-app dialog right here.
          // The occupant's component is read off the sidebar hole's ledger
          // (the hero read, v0.22.0) and rendered with this seat's owner
          // conversation: a confirmed directory is adopted exactly like a
          // native pick, dismissal just closes. The ledger hiding the entry
          // (or an 'add-guide' outright) keeps the pointer dialog as the
          // floor. All references below are callback-scoped: adoptDirectory
          // and fail are defined after this IIFE, so no render-time TDZ.
          const flowEntry = dialog.kind === 'add-flow'
            && typeof sidebarFlowEntry === 'function' ? sidebarFlowEntry() : null
          if (flowEntry && flowEntry.component) {
            let flowFace = null
            if (typeof flowEntry.inject === 'function') {
              try { flowFace = flowEntry.inject() } catch (error) { flowFace = null }
            }
            return E(flowEntry.component, {
              key: 'bw-sidebar-flow',
              open: true,
              busy: flowBusy,
              onPicked: (path) => { setDialog(null); if (path) adoptDirectory(String(path)) },
              onCancel: () => { setDialog(null) },
              onError: (message) => { setDialog(null); fail(String(message)) },
              ...(flowFace || EMPTY_FOLDERS),
            })
          }
          return E(ui.Modal, {
            key: 'add-guide',
            open: true,
            onClose: () => setDialog(null),
            closeLabel: t('close'),
            title: t('add.guide.title'),
            footer: E('div', { className: 'bw-modal-actions' },
              E(BTN, { variant: 'primary', onClick: () => setDialog(null) }, t('confirm')),
            ),
          },
            E('div', { className: 'bw-modal-body' },
              E('div', { className: 'bw-hint' }, t('add.guide')),
            ),
          )
        }
        if (dialog.kind === 'ws-preset') return E(WorkspacePresetDialog, {
          key: 'ws-preset',
          applyPreset: dialog.applyPreset,
          loadRoster: presetFace ? presetFace.list : null,
          current: dialog.current,
          // Success closes with the same notice pipeline as copy-session-id
          // (see copyNoticeText); refusal errors stay inline in the dialog.
          onApplied: () => setCopyNotice((prev) => ({ seq: (prev ? prev.seq : 0) + 1, ok: true, text: t('wsPreset.done') })),
          onClose: () => setDialog(null),
          t,
        })
        return null
      })()

      // The owner side of the flow conversation: adopt keeps the flow open
      // (busy) until the Host answers, then startSession — exactly what the
      // shipped browser does after the same pick. Groups never ride this
      // flow (v0.12.0+): rename or drag to group instead.
      // Adopt keeps the busy flag up until the Host answers, then startSession —
      // exactly what the shipped browser does after the same pick. Groups never
      // ride this flow (v0.12.0+): rename or drag to group instead.
      const adoptDirectory = (path) => {
        setFlowBusy(true)
        return Promise.resolve()
          .then(() => createWorkspace({ path: String(path) }))
          .then((workspace) => {
            if (workspace && workspace.workspaceId && typeof startSession === 'function') startSession(workspace.workspaceId)
          })
          .catch((reason) => { fail(messageOf(reason)) })
          .then(() => setFlowBusy(false))
      }

      // v0.16.0: the sidebar add affordance rides the OFFICIAL chooser only.
      // A `browse` host refuses that pick by design — the click used to
      // explain where the official in-app flow lives instead. v0.28.0: the
      // browse host now gets that flow RIGHT HERE: 'add-flow' opens the
      // dialog that reads the shipped occupant off the sidebar hole's ledger
      // (see the dialog rendering above; the renderSlot authorization stays
      // with the shipped entry, but the component is on the ledger).
      //
      // The shipped shortcut channel also reports this interaction
      // (setDirectoryBusy): a second Cmd/Ctrl+O while the chooser is open is
      // answered with the host's own "already adding" reason instead of
      // stacking a second picker.
      const startAddFlow = () => {
        if (typeof reportDirectoryBusy === 'function') reportDirectoryBusy(true)
        const settle = () => { if (typeof reportDirectoryBusy === 'function') reportDirectoryBusy(false) }
        Promise.resolve(pickerCapabilityNow())
          .then((kind) => {
            if (kind === 'browse') { setDialog({ kind: 'add-flow' }); return undefined }
            return Promise.resolve()
              .then(() => pickDirectory())
              .then((path) => (path ? adoptDirectory(String(path)) : undefined))
              .catch((reason) => {
                if (pickerRefusal(reason)) { setDialog({ kind: 'add-flow' }); return }
                fail(messageOf(reason))
              })
          })
          .catch((reason) => { fail(messageOf(reason)) })
          .then(settle, settle)
      }
      // The shortcut consumer runs from an effect declared above, after this
      // definition: the ref is the one stable handle it can call.
      startAddFlowRef.current = startAddFlow

      if (!wide) {
        return E('div', { className: 'bw-rail' },
          StyleNode(),
          E('button', {
            type: 'button',
            className: 'bw-rail-btn',
            'aria-label': shortcutLabel(t('rail.search'), 'session.search'),
            'aria-keyshortcuts': shortcutAria('session.search'),
            title: shortcutLabel(t('rail.search'), 'session.search'),
            onClick: () => { expandSidebar(); setSearchOpen(true); setFocusPending(true) },
          }, icon('IconSearchOutline16', 18)),
          flowAvailable ? E('button', {
            type: 'button',
            className: 'bw-rail-btn',
            'aria-label': shortcutLabel(t('rail.add'), 'workspace.add'),
            'aria-keyshortcuts': shortcutAria('workspace.add'),
            title: shortcutLabel(t('rail.add'), 'workspace.add'),
            onClick: () => { expandSidebar(); startAddFlow() },
            disabled: flowBusy,
          }, icon('IconProjectAddOutline16', 18)) : null,
        )
      }

      // v0.18.0 — "drag it OUT" must never land on nothing. The row level
      // already covers the workspace row and the root-level session rows; this
      // catches everything else (the empty space below the tree, the header
      // gap), so a drop outside every group always means the same thing:
      // leave the group. Row handlers stopPropagation, so this only fires
      // where no row claimed the drop.
      const sessionCouldLeaveGroup = dragMatches('session') && sessionSlash && drag.source && leafOf(drag.source.title) !== drag.source.title
      const rootDropEvents = {
        onDragOver: (event) => {
          if (!sessionCouldLeaveGroup) return
          event.preventDefault()
          try { event.dataTransfer.dropEffect = 'move' } catch { }
        },
        onDrop: (event) => {
          if (!sessionCouldLeaveGroup) return
          event.preventDefault()
          commitSessionMoveOut(drag.source.workspaceId)
        },
      }

      // Copy-session-id notice copy: the official 'workspace' dictionary is
      // the source of truth, this plugin's aligned fallback covers older hosts.
      // Copy-session-id notice copy: the official 'workspace' dictionary is
      // the source of truth, this plugin's aligned fallback covers older
      // hosts. An explicit `text` override (v0.32.0 workspace-preset done
      // notice) reuses the same toast pipeline with its own copy.
      const copyNoticeText = copyNotice
        ? (typeof copyNotice.text === 'string' ? copyNotice.text
          : officialText(copyNotice.ok ? 'toast.sessionIdCopied' : 'toast.sessionIdCopyFailed',
              undefined, t(copyNotice.ok ? 'toast.sessionIdCopied' : 'toast.sessionIdCopyFailed')))
        : ''

      return E('div', { className: cls('bw-root', sessionCouldLeaveGroup && 'bw-root-drop-out'), ...rootDropEvents },
        StyleNode(),
        // The shipped fork notice rides the shipped browser's overlay, which is
        // shadowed with it: the shortcut's async failure would otherwise be
        // silent. Copy follows the shipped dictionary, the lifetime follows the
        // shipped channel (the effect above dismisses it). Retired upstream in
        // dsh 0.2.1-alpha.5 (frame-level toast now); kept for rc.2-era hosts.
        (forkError && typeof forkError === 'object')
          ? E('div', { className: 'bw-toast', role: 'status' },
              E('span', { className: 'bw-toast-text' }, forkError.reason === 'unavailable'
                ? shippedText('shortcut.noCompletedTurn', t('shortcut.noCompletedTurn'))
                : shippedText('shortcut.forkFailed', t('shortcut.forkFailed'))),
              E('button', {
                type: 'button',
                className: 'bw-toast-close',
                'aria-label': t('close'),
                title: t('close'),
                onClick: () => { if (typeof dismissForkError === 'function') dismissForkError() },
              }, icon('IconCloseOutline16', 12)),
            )
          : null,
        // Copy-session-id notice (the dsh 0.2.1-alpha.5 menu mirror): the
        // official primitives Toast when this host ships it (body portal,
        // official look), otherwise the same chip the fork notice uses.
        (copyNotice && officialToast)
          ? E(officialToast, {
              key: 'bw-copy-' + copyNotice.seq,
              text: copyNoticeText,
              tone: copyNotice.ok ? 'success' : undefined,
              onDone: () => setCopyNotice(null),
            })
          : (copyNotice && !officialToast)
            ? E('div', { className: 'bw-toast', role: 'status' },
                E('span', { className: 'bw-toast-text' }, copyNoticeText),
                E('button', {
                  type: 'button',
                  className: 'bw-toast-close',
                  'aria-label': t('close'),
                  title: t('close'),
                  onClick: () => setCopyNotice(null),
                }, icon('IconCloseOutline16', 12)),
              )
            : null,
        E('div', { className: 'bw-header' },
          E('div', { className: 'bw-header-title' }, t('title')),
          // Group discoverability: an ICON entry point (v0.17.0 — it used to be
          // a text button, which crowded the header) that doubles as the row-drop
          // zone. Its tooltip names the layer(s) the button can actually create
          // into; the click opens the NEW-group dialog, not the move dialog.
          (workspaceSlash || sessionSlash) ? E('button', {
            type: 'button',
            className: cls('bw-icon-btn', 'bw-newgroup-btn', groupDropTarget() && 'bw-drop-into-strong'),
            'aria-label': newGroupLabel(),
            title: newGroupLabel(),
            onClick: () => setDialog({ kind: 'group-new', layer: defaultNewGroupLayer() }),
            ...groupDropEvents,
          }, icon('IconFolderOpen16', 16)) : null,
          (searchOpen || query !== '') ? E('input', {
            ref: searchInputRef,
            className: 'bw-input',
            style: { width: 130, flex: 'none' },
            value: query,
            autoFocus: true,
            placeholder: t('search.placeholder'),
            onChange: (e) => setQuery(e.target.value),
            onKeyDown: (e) => { if (e.key === 'Escape') { setQuery(''); setSearchOpen(false) } },
            onBlur: () => { if (query === '') setSearchOpen(false) },
          }) : null,
          E(ViewOptionsMenu, {
            groupBy,
            orderBy,
            sessionSlash,
            archivedFilter,
            workspaceGroupMode,
            onPick: (kind, value) => { if (kind === 'groupBy') actions.setGroupBy(value); else actions.setOrderBy(value) },
            onFilterPick: (value) => { if (actions && typeof actions.setArchivedFilter === 'function') actions.setArchivedFilter(value) },
            onWsGroupPick: (value) => { if (actions && typeof actions.setWorkspaceGroupMode === 'function') actions.setWorkspaceGroupMode(value) },
            ot: officialT,
            onToggle: (key, value) => { if (key === 'sessionTitleSlash') actions.setSessionTitleSlash(value) },
            t,
          }),
          E('button', {
            type: 'button',
            className: 'bw-icon-btn',
            'aria-label': shortcutLabel(t('search.placeholder'), 'session.search'),
            'aria-keyshortcuts': shortcutAria('session.search'),
            title: shortcutLabel(t('search.placeholder'), 'session.search'),
            onClick: () => setSearchOpen(v => !v),
          }, icon('IconSearchOutline16')),
          flowAvailable ? E('button', {
            type: 'button',
            className: 'bw-icon-btn',
            'aria-label': shortcutLabel(t('add'), 'workspace.add'),
            'aria-keyshortcuts': shortcutAria('workspace.add'),
            title: shortcutLabel(t('add'), 'workspace.add'),
            onClick: startAddFlow,
            disabled: flowBusy,
          }, icon('IconProjectAddOutline16')) : null,
        ),
        E(AnimatedRows, {
          className: 'bw-tree',
          label: t('title'),
          rowKeys: bodyRowKeys,
          // Drag reorders rows itself; animating under it fights the gesture.
          ready: drag === null,
          // View-replacing switches (search, filter, density, count) settle
          // instead of gliding — official resetKey semantics.
          resetKey: JSON.stringify([density, showCount, searching, archivedOnly, normalizedQuery]),
          innerRef: treeRef,
          attrs: { 'data-bw-density': density, ...(showCount ? { 'data-bw-count': '' } : {}) },
        }, bodyRows),
        dialogElement,
        (ctx !== null && typeof ui.Menu === 'function') ? E(ui.Menu, {
          // Right-click opens the SAME menu surface the official ⋯ button
          // renders (primitives Menu, portal, dense): getAnchorRect feeds
          // the event coordinates as the anchor rect — portal mode positions
          // from it directly, no in-place wrapper needed.
          open: true,
          onClose: () => setCtx(null),
          items: menuEntries(),
          onSelect: handleCtxPick,
          align: 'start',
          dense: true,
          portal: true,
          getAnchorRect: () => new DOMRect(ctx.x, ctx.y, 0, 0),
        }) : (ctx !== null ? E('div', {
          className: 'bw-ctx-overlay',
          onMouseDown: () => setCtx(null),
          onContextMenu: (e) => e.preventDefault(),
        },
          E('div', {
            className: 'bw-ctx-menu',
            style: { left: Math.min(ctx.x, window.innerWidth - 190), top: Math.min(ctx.y, window.innerHeight - 240) },
            onMouseDown: (e) => e.stopPropagation(),
            onContextMenu: (e) => e.preventDefault(),
          },
            menuEntries().map((item, index) => item.type === 'separator'
              ? E('div', { key: 'sep-' + index, className: 'bw-ctx-sep' })
              : E('button', {
                key: item.id,
                type: 'button',
                className: cls('bw-ctx-item', item.danger && 'bw-ctx-danger'),
                onClick: () => handleCtxPick(item.id),
              }, item.label),
            ),
          ),
        ) : null),
        E(CustomizeDialog, {
          open: customize !== null,
          kind: customize ? customize.kind : undefined,
          // Row identity, not the rebuilt initial object, is what re-seeds the
          // draft (see the dialog's seed effect).
          seedKey: customize ? customize.entryKey : undefined,
          defaults: defaultAppearance,
          initial: customize
            ? { ...appearanceOf(customize.entryKey), icon: (styleEntry(customize.entryKey) || {}).icon || 'solid' }
            : undefined,
          onChange: (style) => { if (customize) shared.setStyling(customize.entryKey, style) },
          onReset: () => { if (customize) shared.setStyling(customize.entryKey, null) },
          onClose: () => setCustomize(null),
          t,
        }),
        E(ui.Modal, {
          open: errorText !== null,
          onClose: () => setErrorText(null),
          closeLabel: t('close'),
          title: t('error.title'),
          footer: E('div', { className: 'bw-modal-actions' }, E(BTN, { variant: 'primary', onClick: () => setErrorText(null) }, t('close'))),
        }, E('div', { className: 'bw-modal-body' }, E('div', { className: 'bw-error-text', role: 'alert' }, errorText || '')), StyleNode()),
      )
    }

    /* ============================ plugin ============================== */

    // Live title-cache store instance, set once per apply() and read directly
    // by BetterBrowser. NOT a registration store seat: remembered titles only
    // matter before the wire catches up, and every write happens when the
    // wire already carries the same truth, so selector-hook re-renders would
    // be pure noise. One instance per activation (never per mount) keeps the
    // persist key single-writer — dsh-client-store warns same-key instances
    // cross-pollinate one localStorage entry.
    let titleCacheRef = null

    const flowSource = (slots, hole) => ({
      getSnapshot: () => {
        try { return slots.entries(hole).length > 0 } catch { return false }
      },
      subscribe: (listener) => {
        try { return slots.subscribe(hole, listener) } catch { return () => {} }
      },
    })

    async function apply(ctx) {
      // Both faces ship as official package-local chunks (client.*.js), fetched
      // on demand through require.async. Each failure is local: the plugin keeps
      // every seat but that face renders unstyled / falls back to raw keys.
      try {
        localeTables = await require.async('./client.locales.js')
      } catch (localeChunkError) {
        console.warn('[dsh-better-workspace] locale chunk failed to load', localeChunkError)
      }
      try {
        const styles = await require.async('./client.styles.js')
        if (styles && typeof styles.CSS_TEXT === 'string') CSS_TEXT = styles.CSS_TEXT
      } catch (styleChunkError) {
        console.warn('[dsh-better-workspace] style chunk failed to load', styleChunkError)
      }

      const slots = ctx.get('slots')
      if (slots === undefined || typeof slots.register !== 'function') {
        console.error('[dsh-better-workspace] slots service unavailable; plugin idle')
        return
      }
      const sessions = ctx.get('sessions')
      const workspaces = ctx.get('workspaces')
      const uiWorkspace = ctx.get('uiWorkspace')
      if (!sessions || !workspaces || !uiWorkspace) {
        console.error('[dsh-better-workspace] required services missing', {
          sessions: !!sessions, workspaces: !!workspaces, uiWorkspace: !!uiWorkspace,
        })
        return
      }
      // The capability probe talks to the composed backend through this
      // service (list is served by browse alone), so the state module needs
      // the handle before any flow can open.
      pickerState.api = uiWorkspace

      // dsh 0.2.2-alpha.3 context menus. The service is acquired SOFTLY for
      // the same reason as remote.agentPresets: a hard inject would pend the
      // whole bundle forever on older hosts. The bridge is written by the
      // browser seat through browserInjected (a stable getter), so the
      // contribution resolves against the same dialogs and switches the
      // local menu uses.
      let contextMenus = null
      let menuBridge = null
      let menusRegistered = false
      const setMenuBridge = (bridge) => { menuBridge = bridge }

      // The OFFICIAL browser's own dictionary (NS 'workspace'), bound so the
      // context menu COPY follows upstream wording automatically — the menu
      // mirrors the official row menus item-for-item (Rows.tsx), and this
      // way upstream rewording lands here without a plugin release. Falls
      // back to this plugin's aligned dictionary when bind fails.
      let officialT = null
      try { officialT = ctx.locale.bind('workspace') } catch { officialT = null }

      // v0.32.2: the agent-preset face — {list, select} over the same remote
      // channels the official hero preset chip uses. Root cause of the hidden
      // menu row, straight from the dsh 0.2.1 source (cordis 4.0.5): 'remote'
      // is a fiber service provided by the api-gateway bundle, and
      // 'remote.agentPresets' is a NAMESPACE service installed by api-remotes
      // ($mount) on its own child fiber. `ctx.remote` resolves through the
      // property chain only along the reading fiber's ancestry — v0.32.1
      // probed it from a fiber outside that subtree, the chain threw, and the
      // row hid; v0.32.0's strict ctx.get ran before the gateway went ACTIVE
      // and read undefined. The fix keeps NO hard inject (the settingsScope
      // lesson: a service the host lacks would pend this bundle forever):
      // probe synchronously for the common case, then WAIT with a soft
      // ctx.inject child fiber that fires once the two services go ACTIVE —
      // or pends harmlessly forever on hosts without them. The face reaches
      // the sidebar as a stable GETTER prop (see browserInjected) because the
      // slot renderer caches the inject result per entry and would otherwise
      // bake in a null until the entry re-registers.
      let presetFace = null
      const presetFaceReady = (candidate) => candidate
        && typeof candidate.list === 'function' && typeof candidate.select === 'function'
      const buildPresetFace = (agentPresets) => ({
        // readRoster mirror: a gateway hiccup
        // ('gateway/invocation-unavailable') maps to an EMPTY roster,
        // exactly like the official selector does; every other failure
        // surfaces with its message.
        list: async () => {
          try {
            const result = await agentPresets.list()
            if (result && result.ok) return { ok: true, presets: (result.value && result.value.presets) || [] }
            const code = result && result.error ? result.error.code : undefined
            if (code === 'gateway/invocation-unavailable') return { ok: true, presets: [] }
            return { ok: false, error: result && result.error ? result.error.message : 'preset roster read failed' }
          } catch (error) {
            return { ok: false, error: error instanceof Error ? error.message : String(error) }
          }
        },
        // seat-store apply() mirror: a refusal carries the host's reason
        // (error.details.reason when present); the outer call can throw,
        // so a throw folds into the same {ok:false} shape.
        select: async (sessionId, presetId) => {
          try {
            const result = await agentPresets.select(sessionId, presetId)
            if (result && result.ok) return { ok: true }
            const details = result && result.error ? result.error.details : undefined
            const reason = details && typeof details.reason === 'string'
              ? details.reason
              : (result && result.error ? result.error.message : 'preset select failed')
            return { ok: false, refusal: reason }
          } catch (error) {
            return { ok: false, refusal: error instanceof Error ? error.message : String(error) }
          }
        },
      })
      try {
        let agentPresets = null
        try {
          const remote = ctx.remote
          agentPresets = remote && remote.agentPresets
        } catch { /* the property chain needs the service on this fiber's path */ }
        if (!presetFaceReady(agentPresets)) {
          try {
            const remote = ctx.get('remote')
            agentPresets = remote && remote.agentPresets
          } catch { /* strict get yields nothing while the provider pends */ }
        }
        if (presetFaceReady(agentPresets)) presetFace = buildPresetFace(agentPresets)
      } catch (presetFaceError) {
        console.warn('[dsh-better-workspace] agent-preset face unavailable', presetFaceError)
        presetFace = null
      }
      if (!presetFace && ctx && typeof ctx.inject === 'function') {
        // Late arrival: a soft child fiber that fires when the 'remote' +
        // 'remote.agentPresets' services go ACTIVE (the official
        // ui-agent-preset declares exactly these two). On hosts that never
        // mount them the fiber just pends — no effect, no error. The
        // namespace reads by its strict service name off the child fiber,
        // where the inject mechanism has cached it.
        try {
          ctx.inject(['remote', 'remote.agentPresets'], (fctx) => {
            try {
              const agentPresets = fctx && fctx['remote.agentPresets']
              if (presetFaceReady(agentPresets)) {
                presetFace = buildPresetFace(agentPresets)
                console.info('[dsh-better-workspace] agent-preset face ready (late arrival)')
              }
            } catch (lateError) {
              console.warn('[dsh-better-workspace] agent-preset late face failed', lateError)
            }
          })
        } catch (injectError) {
          console.warn('[dsh-better-workspace] agent-preset soft inject failed', injectError)
        }
      }

      // The official shared menu owns session/workspace rows from alpha.3 on.
      // The built-in contributions cover pin/rename/fork/copy/archive and
      // workspace rename/delete; these two bring the bw-only verbs (name
      // groups, Customize appearance, the workspace default preset) after
      // them. The first extra carries the separator, so the popup keeps the
      // same grouping the retired local menu had.
      const withMenuSeparator = (actions) => actions.map((action, index) => index === 0
        ? Object.assign({}, action, { separatorBefore: true })
        : action)
      const registerContextMenus = (menus) => {
        if (!menus || menusRegistered) return
        if (typeof menus.register !== 'function' || typeof menus.open !== 'function') return
        menusRegistered = true
        const sessionExtras = {
          id: 'bw-session-extras',
          target: 'session',
          order: 700,
          resolve: (target) => {
            const bridge = menuBridge
            if (!bridge) return []
            const title = String((target && target.displayTitle) || '')
            const actions = []
            if (bridge.slashes && bridge.slashes.session) {
              actions.push({
                id: 'bw-move-group',
                label: bridge.label('menu.moveToGroup'),
                run: () => bridge.moveGroup('session', { id: target.sessionId, title }),
              })
            }
            if (bridge.groupPrefix && bridge.groupPrefix(title) !== '') {
              actions.push({
                id: 'bw-move-out',
                label: bridge.label('menu.moveOutGroup'),
                run: () => bridge.moveOut({ id: target.sessionId, title }),
              })
            }
            actions.push({
              id: 'bw-customize',
              label: bridge.label('custom.title'),
              run: () => bridge.customize('session', { id: target.sessionId, title }),
            })
            return withMenuSeparator(actions)
          },
        }
        const workspaceExtras = {
          id: 'bw-workspace-extras',
          target: 'workspace',
          order: 700,
          resolve: (target) => {
            const bridge = menuBridge
            if (!bridge) return []
            const title = String((target && target.displayTitle) || '')
            const payload = { workspaceId: target.workspaceId, path: target.path, title, leaf: title }
            const actions = []
            if (bridge.slashes && bridge.slashes.workspace) {
              actions.push({
                id: 'bw-move-group',
                label: bridge.label('menu.moveToGroup'),
                run: () => bridge.moveGroup('workspace', payload),
              })
            }
            actions.push({
              id: 'bw-customize',
              label: bridge.label('custom.title'),
              run: () => bridge.customize('workspace', payload),
            })
            if (bridge.hasPreset && bridge.hasPreset()) {
              actions.push({
                id: 'bw-ws-preset',
                label: bridge.label('menu.workspacePreset'),
                run: () => bridge.workspacePreset(payload),
              })
            }
            return withMenuSeparator(actions)
          },
        }
        try {
          ctx.effect(() => {
            const disposers = []
            try { disposers.push(menus.register(sessionExtras)) } catch (registerError) {
              console.warn('[dsh-better-workspace] session context menu registration failed', registerError)
            }
            try { disposers.push(menus.register(workspaceExtras)) } catch (registerError) {
              console.warn('[dsh-better-workspace] workspace context menu registration failed', registerError)
            }
            return () => {
              for (const dispose of disposers) {
                try { dispose() } catch { /* already withdrawn */ }
              }
            }
          }, 'better-workspace: context menu contributions')
        } catch (effectError) {
          console.warn('[dsh-better-workspace] context menu effect failed', effectError)
        }
      }
      const adoptContextMenus = (candidate) => {
        if (!candidate || typeof candidate.register !== 'function' || typeof candidate.open !== 'function') return
        const changed = contextMenus !== candidate
        contextMenus = candidate
        registerContextMenus(candidate)
        if (changed) notifyMenuFace()
      }
      try { adoptContextMenus(ctx.get('contextMenus')) } catch (contextMenuProbeError) {
        console.warn('[dsh-better-workspace] context menu probe failed', contextMenuProbeError)
      }
      if (!contextMenus && ctx && typeof ctx.inject === 'function') {
        // Late arrival: the shared menu service mounts after this bundle on
        // some boots. A soft child fiber waits for it; old hosts simply keep
        // the fiber pending and the local menu stays in charge.
        try {
          ctx.inject(['contextMenus'], (fctx) => {
            try { adoptContextMenus(fctx && fctx.contextMenus) } catch (lateError) {
              console.warn('[dsh-better-workspace] context menu late face failed', lateError)
            }
          })
        } catch (injectError) {
          console.warn('[dsh-better-workspace] context menu soft inject failed', injectError)
        }
      }

      if (localeTables && ctx.locale && typeof ctx.locale.register === 'function') {
        ctx.effect(() => {
          try {
            return ctx.locale.register(NS, Object.assign({ zh: localeTables.zh, en: localeTables.en }, localeTables.LOCALES))
          } catch (localeError) {
            console.warn('[dsh-better-workspace] dictionary registration failed', localeError)
            return () => {}
          }
        }, 'better-workspace: dictionaries')
      }

      const searchSessions = async (query, signal) => {
        const result = await sessions.search(query, signal)
        if (!result || !result.ok) throw new Error(result && result.error ? result.error.message : 'session search failed')
        return result.value
      }
      // Rename performance (issue #14): sessions.using retains the session and
      // awaits reference.ready FIRST, so renaming a closed 5MB row stalled ~6s
      // loading its whole history just to send a 20ms rename RPC (the rename
      // itself is independent of the transcript). Tiered, cheapest first:
      //
      // 1. Open session → borrow binding directly. On 0.1.6+ hosts binding(id)
      //    only sees retained scopes (service.ts:539 `scopes.get(id)?.binding`,
      //    undefined when closed), so "a binding comes back" IS the open test;
      //    on 0.1.5-rc.x hosts every row is visible, identical to the old
      //    fallback. Same SessionBinding object the using path borrows, so
      //    title projection / list refresh behave exactly the same.
      // 2. Closed session → sessions.manager.rename(id, title): "Rename a
      //    Session ... without opening its history" (manager.ts:578) — a bare
      //    remote.session.rename plus the title projection. manager is a
      //    TS-private field of ClientSessions (service.ts:245), reachable at
      //    runtime; feature-probed so hosts without it skip the tier.
      // 3. Fallback → the 0.1.6-alpha.2 retention contract: sessions.using
      //    with an explicit source (slow — loads history — but the only legal
      //    path on hosts predating manager.rename). 0.1.5-rc.x hosts ship
      //    ISessions.binding only; tier 1 already served them. Then fail loud.
      // Fork and open go through the uiWorkspace navigation service: ISessions
      // no longer carries open() at all (navigation belongs to the view owner,
      // replaceMain).
      const renameSession = async (sessionId, title) => {
        const fail = (result) => new Error(result && result.error ? result.error.message : 'session rename failed')
        const binding = typeof sessions.binding === 'function' ? sessions.binding(sessionId) : undefined
        const face = binding ? binding.session : undefined
        if (face && typeof face.rename === 'function') {
          const result = await face.rename(title)
          if (!result || !result.ok) throw fail(result)
          return
        }
        const manager = sessions.manager
        if (manager && typeof manager.rename === 'function') {
          const result = await manager.rename(sessionId, title)
          if (!result || !result.ok) throw fail(result)
          return
        }
        if (typeof sessions.using === 'function') {
          const result = await sessions.using(
            sessionId,
            { source: 'workspaceOperation' },
            (reference) => reference.binding.session.rename(title),
          )
          if (!result || !result.ok) throw fail(result)
          return
        }
        throw new Error('session rename is unavailable on this host')
      }
      const forkSession = (sessionId) => {
        uiWorkspace.forkSession(sessionId)
          .catch(() => { /* keep current selection */ })
      }

      const browserInjected = () => ({
        // Official 'workspace' dictionary translate (menu copy follows upstream);
        // null when the bind failed — the menu then uses the aligned bw copy.
        officialT,
        // v0.32.2: the agent-preset face rides a stable GETTER, not a value.
        // The slot renderer caches the inject result per StoredEntry
        // (ui-renderer scoped-slots rootInjectCache), so a value prop would
        // bake in whatever presetFace was at first render — null whenever the
        // remote services arrived after this face was cached, permanently
        // hiding the workspace-preset menu row. The getter reads the apply
        // closure live, so every render and every menu build re-asks; hosts
        // without the service keep returning null, which simply hides the row.
        presetFaceOf: () => presetFace,
        // dsh 0.2.2-alpha.3: the shared context-menu service (getter for the
        // same late-arrival reason as presetFaceOf; null on older hosts, which
        // keep the local menu) and the live action bridge its contribution
        // reads. The getter is what openCtx probes on every right-click.
        contextMenuFaceOf: () => contextMenus,
        setMenuBridge,
        // Issue #13: the PRIVATE store face — a stable getter like presetFaceOf
        // (the slot renderer caches inject results; keep the same discipline
        // even though this face never changes).
        localStore: () => ({ useStore: useViewStore, actions: viewInstance.actions }),
        // The shipped sidebar's OWN face (dsh 0.1.7-rc.2): the shortcut request
        // channel and the catalog of effective keybindings. Both belong to the
        // entry this seat shadows, so they are read off the ledger and consumed
        // here (see shippedBrowserFaceOf) — otherwise Cmd/Ctrl+K and Cmd/Ctrl+O
        // would be consumed by the shipped command with no consumer left.
        shippedBrowserFace: () => shippedBrowserFaceOf(slots, BetterBrowser),
        // The shipped schedule mark's seat occupant (dsh 0.1.7-rc.2), rendered
        // inside our own row (see scheduleSeatOf); its copy is bound to the
        // occupant's OWN dictionary namespace, like the slot renderer would.
        scheduleSeatReader: () => {
          if (typeof React.useSyncExternalStore !== 'function') return null
          const seat = scheduleSeatOf(slots)
          if (!seat) return null
          let seatT = null
          if (seat.locale && ctx.locale && typeof ctx.locale.bind === 'function') {
            try { seatT = ctx.locale.bind(seat.locale) } catch (error) { seatT = null }
          }
          return { component: seat.component, face: seat.face, t: seatT }
        },
        // The shipped session-row seat occupants, read off the ledger in a
        // LIST (same shape as scheduleSeatReader): one reader serves every
        // seat name (menu.item / row.action / session.row.hover).
        seatEntriesReader: (name) => {
          try {
            const entries = slots.entries(name)
            if (!Array.isArray(entries)) return []
            return entries.map((entry) => {
              if (!entry || !entry.component || typeof entry.inject !== 'function') return null
              let seatT = null
              if (entry.locale && ctx.locale && typeof ctx.locale.bind === 'function') {
                try { seatT = ctx.locale.bind(entry.locale) } catch (error) { seatT = null }
              }
              return { component: entry.component, face: entry.inject(), t: seatT }
            }).filter(Boolean)
          } catch (error) {
            return []
          }
        },
        startSession: (workspaceId) => { uiWorkspace.startSession(workspaceId) },
        open: (sessionId) => { uiWorkspace.openSession(sessionId) },
        searchSessions,
        searchResultLimit: sessions.searchResultLimit !== undefined ? sessions.searchResultLimit : 20,
        renameSession,
        forkSession,
        renameWorkspace: (workspaceId, title) => workspaces.rename(workspaceId, title),
        deleteWorkspace: (workspaceId) => workspaces.delete(workspaceId),
        insertWorkspaceBefore: typeof workspaces.insertBefore === 'function'
          ? (workspaceId, beforeWorkspaceId) => workspaces.insertBefore(workspaceId, beforeWorkspaceId)
          : undefined,
        // Official contract exposes session reorder through the WORKSPACES
        // service (see dsh ui-workspace client index.ts); feature-probed so
        // older hosts degrade to "group-move only" instead of a TypeError.
        insertSessionBefore: typeof workspaces.insertSessionBefore === 'function'
          ? (workspaceId, sessionId, beforeSessionId) => workspaces.insertSessionBefore(workspaceId, sessionId, beforeSessionId)
          : undefined,
        // options rides through for the 0.1.7 stop-and-archive hop; older
        // services simply never receive a second argument.
        archiveSession: (sessionId, options) => uiWorkspace.archiveSession(sessionId, options),
        pinSession: typeof uiWorkspace.pinSession === 'function' ? (sessionId) => uiWorkspace.pinSession(sessionId) : undefined,
        unpinSession: typeof uiWorkspace.unpinSession === 'function' ? (sessionId) => uiWorkspace.unpinSession(sessionId) : undefined,
        unarchiveSession: typeof uiWorkspace.unarchiveSession === 'function' ? (sessionId) => uiWorkspace.unarchiveSession(sessionId) : undefined,
        createWorkspace: (input) => workspaces.create(input),
        pickDirectory: () => uiWorkspace.pickDirectory(),
        // Browse-side primitives: the in-app dialog needs them whenever the
        // Host composes the browse backend instead of the OS chooser.
        listDirectory: (path, signal) => uiWorkspace.listDirectory(path, signal),
        createDirectory: (path, name) => uiWorkspace.createDirectory(path, name),
        // v0.28.0: the shipped occupant's ledger entry for the SIDEBAR flow
        // hole (same read as the hero one, v0.22.0). The browse surface
        // registers into both holes, so its in-app dialog renders from the
        // sidebar too; a native entry read this way is renderless and would
        // only re-run the OS chooser the native branch already drives
        // directly, so the browse probe keeps choosing the path.
        sidebarFlowEntry: () => {
          try {
            const list = slots.entries('sidebar.workspaces.directoryFlow')
            const entry = Array.isArray(list) && list.length > 0 ? list[0] : null
            return entry && entry.component ? entry : null
          } catch (error) {
            return null
          }
        },
        hooks: {
          directoryFlow: flowSource(slots, 'sidebar.workspaces.directoryFlow'),
        },
      })


      // Registration helper: a thrown register (semantics drift, vanishing
      // hole declaration mid-transition) degrades this one seat, never the
      // plugin fiber — the whole web boot is all-or-nothing.
      const guarded = (slotKey, options, component) => () => {
        try {
          return slots.register(options, (props) => E(QuietBoundary, null, E(component, props)))
        } catch (registerError) {
          console.warn('[dsh-better-workspace] register skipped for ' + slotKey, registerError)
          return undefined
        }
      }

      // The SIDEBAR hole's directory flow is NOT occupied by this plugin
      // (v0.16.0): a child-hole declaration is exclusive — the shipped
      // browser entry keeps owning 'sidebar.workspaces.directoryFlow' even
      // after losing the render race, and re-declaring throws — so the add
      // flow probes the backend itself: the OS chooser through the same
      // official host service on native Hosts, and since v0.28.0 the SHIPPED
      // in-app dialog on browse Hosts, read off the hole's ledger and
      // rendered with this seat's owner conversation (the hero read,
      // v0.22.0). The HERO hole is likewise never declared here; the
      // empty-state picker reads its occupant the same way.

      // One shared store handle: the browser and the settings page must see the
      // same persisted state (expansion, folder list, prefs, styling).
      const viewStore = createViewStore()
      // Issue #13 hardening: our OWN store instance. The renderer synthesizes
      // props.useStore/actions from the seat's store handle — and a third-party
      // occupant wrapper (im-connect, issue #13) that shadows the workspace seat
      // replaces those props with ITS channel store, silently severing every
      // local read and write. The bundle therefore keeps one PRIVATE instance,
      // handed to the components through the inject face: local state no longer
      // depends on what the renderer (or anything shadowing it) put into props.
      // Same persist key, so on a healthy host both instances hydrate the same
      // snapshot; the renderer-side instance simply never writes again (no
      // consumer dispatches it) and ours becomes the only live one.
      const viewInstance = viewStore.create()
      const useViewStore = typeof React.useSyncExternalStore === 'function'
        ? (selector) => React.useSyncExternalStore(
          viewInstance.subscribe,
          () => { try { return selector(viewInstance.getSnapshot()) } catch (error) { return undefined } })
        : null

      // Cold-restart title fallback (see the title-cache block). Hydration
      // reads localStorage synchronously here, before the first render, so a
      // restart's first tree already shows every remembered title.
      loadTitleCache()
      titleCacheRef = {
        getSnapshot: () => titleCache,
        rememberAllTitles,
        // Manual renames clear a grafted display (see renameByUser).
        forgetDisplay: (id) => {
          const entry = titleCache.byId[id]
          if (entry && entry.display !== undefined) { delete entry.display; scheduleTitleSave(); return true }
          return false
        },
      }

      // Cross-device settings scope (manual sync, see the host-settings-sync
      // block). Binding is best-effort: a missing/failed bind leaves the
      // plugin fully browser-local — the pre-0.9.5 behavior.
      prefsScopeRef = null
      prefsScopeVia = null
      try {
        // dsh >= 0.1.7 removed the settings service, and READING the service
        // property on a host that never injected it throws on the cordis
        // Context proxy ("cannot get property \"settingsScope\" without
        // inject") — the pre-0.1.7 probe wrote a stack trace into the console
        // on EVERY boot, noise that hides real failures and made this seat look
        // broken during the rc.1 audit. ctx.get is the era-safe read: it
        // answers with the service when it exists (both eras) and simply
        // reports absence when it does not, so the property is never touched.
        const scopeHost = ctx && typeof ctx.get === 'function' ? ctx.get('settingsScope') : null
        if (scopeHost && typeof scopeHost.bind === 'function') {
          prefsScopeRef = scopeHost.bind({ namespace: 'better-workspace' })
          prefsScopeVia = 'settingsScope'
        }
      } catch (error) {
        console.warn('[dsh-better-workspace] settings scope bind failed; sync stays local', error)
        prefsScopeRef = null
      }
      // dsh >= 0.1.7: the settings service is gone; one ConfigForm per live
      // profile entry replaces it (same getSnapshot/set/subscribe contract).
      // Values then persist in THIS profile's patch — there is no shared home
      // any more, so the manual cross-device sync section stays hidden.
      try {
        if (ctx.inject) {
          ctx.inject(['configForms'], (fctx) => {
            try {
              if (prefsScopeVia === 'settingsScope') return
              const forms = fctx && fctx.configForms
              if (forms && typeof forms.get === 'function') {
                prefsScopeRef = forms.get('better-workspace')
                prefsScopeVia = 'configForms'
              }
            } catch (error) {
              console.warn('[dsh-better-workspace] configForms acquisition failed', error)
            }
          })
        }
      } catch (error) {
        console.warn('[dsh-better-workspace] configForms wiring failed', error)
      }

      // dsh 0.1.6-alpha.2+ hosts third-party configuration on the Plugins
      // panel's bundle page: plugins.bundle.config, keyed by PACKAGE name and
      // rendered with view: 'page'. This is the only settings seat now — the
      // legacy settings-list card (the pre-alpha.2 Settings → Plugins list)
      // went away with the raised host floor. The inject waits for the
      // declaration, so older hosts simply never grow this seat.
      slots.inject('plugins.bundle.config', guarded(
        'plugins.bundle.config',
        {
          name: 'plugins.bundle.config',
          key: 'dsh-better-workspace',
          locale: NS,
          store: viewStore,
          // Issue #13: the settings card reads/writes through our PRIVATE store
          // instance too (same rationale as the browser seat).
          inject: () => ({ localStore: () => ({ useStore: useViewStore, actions: viewInstance.actions }) }),
        },
        BetterWorkspacePluginCard,
      ))

      // the browser itself — lowest priority renders, shadowing the shipped
      // entry. NO children declaration here (v0.12.1): the child-hole
      // declaration is exclusive and the shipped entry already owns it —
      // re-declaring would throw and silently unregister this seat (the
      // v0.12.0 regression). The add flow rides the sidebar-hole occupation
      // registered above instead.
      slots.inject('sidebar.workspaces', guarded(
        'sidebar.workspaces',
        {
          name: 'sidebar.workspaces',
          priority: -1,
          store: viewStore,
          inject: browserInjected,
          locale: NS,
        },
        BetterBrowser,
      ))

      // The HERO hole (v0.22.0): the shipped picker is shadowed at priority -1
      // and this seat draws the sidebar's own tree instead of a flat title
      // list. Same rules as the sidebar seat — NO children declaration (the
      // shipped picker entry keeps owning HERO_FLOW_HOLE even while shadowed,
      // and re-declaring throws), so the add action renders the shipped
      // occupant component read off the ledger (see HeroWorkspacePicker).
      // Hosts without a primitives Menu keep the shipped picker: shadowing
      // there would leave the hero with no popover at all.
      if (typeof ui.Menu === 'function') {
        const heroInjected = () => ({
          createWorkspace: (input) => workspaces.create(input),
          /**
           * The shipped occupant's ledger entry for the hero flow hole: the
           * renderer picks the lowest-priority live entry, and so does this
           * read (entries arrive priority-sorted). Best-effort by design — a
           * host that hides the ledger costs the add action, never the picker.
           */
          heroFlowEntry: () => {
            try {
              const list = slots.entries(HERO_FLOW_HOLE)
              const entry = Array.isArray(list) && list.length > 0 ? list[0] : null
              return entry && entry.component ? entry : null
            } catch (error) {
              return null
            }
          },
          hooks: { directoryFlow: flowSource(slots, HERO_FLOW_HOLE) },
        })
        slots.inject('conversation.hero.workspace', guarded(
          'conversation.hero.workspace',
          {
            name: 'conversation.hero.workspace',
            priority: -1,
            store: viewStore,
            inject: heroInjected,
            locale: NS,
          },
          HeroWorkspacePicker,
        ))
      }
    }

    return {
      name: 'dsh-better-workspace',
      // v0.32.2: the list stays at the five era-guaranteed services (the
      // settingsScope lesson — a hard inject of anything a host may lack
      // pends this whole bundle forever). 'remote' + 'remote.agentPresets'
      // are acquired SOFTLY inside apply: a synchronous probe plus a
      // ctx.inject child fiber that waits for their ACTIVE transition
      // (see the agent-preset face block above).
      inject: ['slots', 'sessions', 'workspaces', 'locale', 'uiWorkspace'],
      apply,
    }
  },
})
