/**
 * dsh-better-workspace — client half (plain JavaScript, no build step).
 *
 * Three registrations:
 *  1. `sidebar.workspaces` (priority -1): replaces the shipped workspace
 *     browser with a hierarchy tree derived from "/" inside workspace titles.
 *  2. `conversation.hero.workspace.directoryFlow`: the add-workspace picking
 *     interaction for the conversation empty-state menu — native directory
 *     pick, then a parent-group popup, then create + rename with the prefix.
 *  3. `sidebar.workspaces.directoryFlow`: the same interaction for the
 *     shipped sidebar browser (fills only when that hole is declared, i.e.
 *     whenever this plugin's own browser is not the occupying entry).
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

    /* ============================== i18n ============================== */

    const zh = {
      'title': '工作区',
      'search.placeholder': '搜索工作区或会话',
      'add': '添加工作区',
      'newFolder': '新建分组',
      'rail.search': '搜索',
      'rail.add': '添加工作区',
      'empty': '暂无工作区',
      'empty.search': '没有匹配的结果',
      'session.new': '新会话',
      'group.ungrouped': '未分组',
      'sessions.expand': '展开 {n} 个会话',
      'sessions.collapse': '收起',
      'time.now': '刚刚',
      'time.minutes': '{n} 分钟',
      'time.hours': '{n} 小时',
      'time.days': '{n} 天',
      'time.months': '{n} 个月',
      'time.years': '{n} 年',
      'status.running': '生成中',
      'status.completed': '已完成',
      'status.approval': '等待批准',
      'status.planReview': '等待计划确认',
      'status.question': '等待回答',
      'status.subagents': '{n} 个子任务运行中',
      'menu.rename': '重命名',
      'menu.delete': '删除',
      'menu.fork': '分叉',
      'menu.archive': '归档',
      'menu.renameFolder': '重命名分组',
      'menu.removeFolder': '删除分组',
      'menu.renameSgroup': '重命名会话分组',
      'flow.title': '添加工作区',
      'flow.picked': '所选文件夹',
      'flow.parent': '所属分组',
      'flow.parentHint': '输入或下拉选择分组路径,留空表示根分组;多级用 / 分隔',
      'flow.creating': '正在创建…',
      'error.title': '出错了',
      'cancel': '取消',
      'create': '创建',
      'confirm': '确定',
      'close': '关闭',
      'ws.rename.title': '重命名工作区',
      'ws.rename.hint': '名称中的 / 即层级分组,例如 web/前端',
      'ws.delete.title': '删除工作区',
      'ws.delete.body': '仅移除工作区登记,目录和会话记录都会保留。确定删除「{name}」?',
      'folder.new.title': '新建分组',
      'folder.new.hint': '分组路径,可用 / 表示多级,例如 web/前端',
      'folder.rename.title': '重命名分组',
      'folder.rename.hint': '重命名会同步更新组内所有工作区名称',
      'folder.delete.body': '删除空分组「{name}」?',
      'folder.error.empty': '分组路径不能为空',
      'folder.error.exists': '分组已存在',
      'folder.error.notEmpty': '分组内还有工作区,无法删除',
    }

    const en = {
      'title': 'Workspaces',
      'search.placeholder': 'Search workspaces or sessions',
      'add': 'Add workspace',
      'newFolder': 'New folder',
      'rail.search': 'Search',
      'rail.add': 'Add workspace',
      'empty': 'No workspaces yet',
      'empty.search': 'No matches',
      'session.new': 'New session',
      'group.ungrouped': 'Ungrouped',
      'sessions.expand': 'Show {n} more sessions',
      'sessions.collapse': 'Collapse',
      'time.now': 'now',
      'time.minutes': '{n}min',
      'time.hours': '{n}h',
      'time.days': '{n}d',
      'time.months': '{n}mo',
      'time.years': '{n}y',
      'status.running': 'Running',
      'status.completed': 'Completed',
      'status.approval': 'Waiting for approval',
      'status.planReview': 'Waiting for plan review',
      'status.question': 'Waiting for answer',
      'status.subagents': '{n} subagent(s) running',
      'menu.rename': 'Rename',
      'menu.delete': 'Delete',
      'menu.fork': 'Fork',
      'menu.archive': 'Archive',
      'menu.renameFolder': 'Rename folder',
      'menu.removeFolder': 'Delete folder',
      'menu.renameSgroup': 'Rename session group',
      'flow.title': 'Add workspace',
      'flow.picked': 'Chosen folder',
      'flow.parent': 'Parent group',
      'flow.parentHint': 'Type or pick a group path; empty means root. Nest with /',
      'flow.creating': 'Creating…',
      'error.title': 'Something went wrong',
      'cancel': 'Cancel',
      'create': 'Create',
      'confirm': 'OK',
      'close': 'Close',
      'ws.rename.title': 'Rename workspace',
      'ws.rename.hint': 'Use / inside the name to nest, e.g. web/frontend',
      'ws.delete.title': 'Delete workspace',
      'ws.delete.body': 'Only the workspace registration is removed; the directory and session logs remain. Delete "{name}"?',
      'folder.new.title': 'New folder',
      'folder.new.hint': 'Folder path; nest with /, e.g. web/frontend',
      'folder.rename.title': 'Rename folder',
      'folder.rename.hint': 'Renaming updates every workspace title inside the folder',
      'folder.delete.body': 'Delete empty folder "{name}"?',
      'folder.error.empty': 'Folder path must not be empty',
      'folder.error.exists': 'Folder already exists',
      'folder.error.notEmpty': 'Folder still contains workspaces',
    }

    /* ============================= helpers ============================ */

    const cls = (...xs) => xs.filter(Boolean).join(' ')
    const messageOf = (reason) => (reason instanceof Error ? reason.message : String(reason))

    const basename = (p) => {
      if (!p) return ''
      const s = String(p).replace(/[\\/]+$/, '')
      const i = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'))
      return i === -1 ? s : s.slice(i + 1)
    }
    const splitTitleSegs = (title) => String(title || '').split('/').map(s => s.trim()).filter(Boolean)
    const normPath = (p) => String(p || '').split('/').map(s => s.trim()).filter(Boolean).join('/')

    /** Render a primitives icon by name; unknown names degrade to null, never crash. */
    const icon = (name, size) => {
      const C = ui[name]
      return C ? E(C, { size: size || 16 }) : null
    }

    /** Folder-with-plus glyph for the new-group header button (absent from the primitives set). */
    const FolderPlusIcon = (props) => E('svg', {
      width: props.size || 16,
      height: props.size || 16,
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
    },
      E('path', { d: 'M1.75 4.6c0-.74.6-1.35 1.35-1.35h2.5l1.4 1.6h4.9c.74 0 1.35.6 1.35 1.35v5.9c0 .74-.6 1.35-1.35 1.35H3.1c-.74 0-1.35-.6-1.35-1.35V4.6z' }),
      E('path', { d: 'M8 7.2v3.6M6.2 9h3.6' }),
    )

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

    const pendingKindOf = (pending, id) => {
      if (!pending) return undefined
      const p = typeof pending.get === 'function' ? pending.get(id) : pending[id]
      if (!p) return undefined
      return p.kind || p.status || p.type || 'pending'
    }

    const sessionTitleOf = (summary, t) => {
      if (!summary) return ''
      if (summary.blank) return t('session.new')
      return String(summary.displayTitle || summary.title || '')
    }

    /**
     * Official visibility rule (dsh tree.ts sessionVisible): subagent children
     * live in their parent's catalog, archived sessions are visible nowhere,
     * and a blank row is the provisional New Session of the current selection.
     */
    const sessionVisible = (summary, current, archivedSet) => !!summary
      && summary.origin !== 'subagent'
      && !(archivedSet && archivedSet.has(summary.id))
      && (!summary.blank || summary.id === current)

    /**
     * Running subagent descendants per session (light lineage walk over
     * parentSessionId links) — a parent row keeps its "ongoing" ring while a
     * spawned subagent is still working.
     */
    const subagentRunningCounts = (byId) => {
      const children = new Map()
      for (const id of Object.keys(byId || {})) {
        const summary = byId[id]
        if (!summary || !summary.parentSessionId) continue
        let list = children.get(summary.parentSessionId)
        if (!list) { list = []; children.set(summary.parentSessionId, list) }
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
    function buildSessionTree(rows) {
      const root = { path: '', name: '', groups: [], sessions: [] }
      const byPath = new Map([['', root]])
      const ensure = (path) => {
        if (path === '') return root
        const known = byPath.get(path)
        if (known) return known
        const segs = path.split('/')
        const parent = ensure(segs.slice(0, -1).join('/'))
        const node = { path, name: segs[segs.length - 1], groups: [], sessions: [] }
        byPath.set(path, node)
        parent.groups.push(node)
        return node
      }
      for (const row of rows || []) {
        const segs = splitTitleSegs(row.title)
        const folderPath = segs.slice(0, -1).join('/')
        const leaf = segs.length > 0 ? segs[segs.length - 1] : row.title
        ensure(folderPath).sessions.push({ ...row, leaf })
      }
      const sortRec = (node) => {
        node.groups.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
        for (const group of node.groups) sortRec(group)
      }
      sortRec(root)
      return root
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
     * Build the folder tree. Folders are virtual: they exist where workspace
     * titles contain "/", plus the explicit empty folders the user created.
     * Returns { path, name, folders, workspaces } with workspaces carrying
     * their leaf display name.
     */
    function buildTree(items, explicitFolders) {
      const root = { path: '', name: '', folders: [], workspaces: [] }
      const byPath = new Map([['', root]])
      const ensure = (path) => {
        if (path === '') return root
        const known = byPath.get(path)
        if (known) return known
        const segs = path.split('/')
        const parent = ensure(segs.slice(0, -1).join('/'))
        const node = { path, name: segs[segs.length - 1], folders: [], workspaces: [] }
        byPath.set(path, node)
        parent.folders.push(node)
        return node
      }
      for (const folder of explicitFolders || []) {
        const p = normPath(folder)
        if (p !== '') ensure(p)
      }
      for (const workspace of items || []) {
        const segs = splitTitleSegs(workspace.title)
        const folderPath = segs.slice(0, -1).join('/')
        const leaf = segs.length > 0 ? segs[segs.length - 1] : (basename(workspace.path) || String(workspace.title || '') || String(workspace.workspaceId || ''))
        ensure(folderPath).workspaces.push({
          workspaceId: workspace.workspaceId,
          title: String(workspace.title || ''),
          path: String(workspace.path || ''),
          sessionIds: Array.isArray(workspace.sessionIds) ? workspace.sessionIds : [],
          leaf,
          folderPath,
        })
      }
      const sortRec = (node) => {
        node.folders.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
        for (const child of node.folders) sortRec(child)
      }
      sortRec(root)
      return root
    }

    const countWorkspaces = (node) => node.workspaces.length + node.folders.reduce((sum, f) => sum + countWorkspaces(f), 0)

    /* ============================== styles ============================ */

    const CSS_TEXT = [
      '.bw-root{height:100%;display:flex;flex-direction:column;min-height:0;color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-header{display:flex;align-items:center;gap:2px;padding:10px 10px 4px;flex:none}',
      '.bw-header-title{flex:1;font-size:12px;font-weight:600;letter-spacing:.02em;color:var(--dsw-alias-label-secondary,#b8b8b8);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.bw-icon-btn{flex:none;width:24px;height:24px;border:none;background:transparent;border-radius:6px;display:grid;place-items:center;color:var(--dsw-alias-label-secondary,#b8b8b8);cursor:pointer;padding:0}',
      '.bw-icon-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.15));color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-search-row{flex:none;padding:0 10px 6px}',
      '.bw-input{width:100%;box-sizing:border-box;height:26px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));border-radius:6px;color:inherit;padding:0 8px;font-size:12px;outline:none;font-family:inherit}',
      '.bw-input:focus{border-color:var(--dsw-alias-brand-primary,#5b8def)}',
      '.bw-input::placeholder{color:var(--dsw-alias-label-quaternary,#8a8a8a)}',
      '.bw-tree{flex:1;overflow-y:auto;overflow-x:hidden;padding:2px 6px 12px;min-height:0}',
      '.bw-row{display:flex;align-items:center;gap:6px;min-height:28px;padding:0 6px;border-radius:6px;cursor:pointer;user-select:none;font-size:13px;color:var(--dsw-alias-label-primary,#e6e6e6);position:relative}',
      '.bw-drop-before::after{content:"";position:absolute;left:8px;right:8px;top:-1px;height:2px;border-radius:1px;background:var(--dsw-alias-brand-primary,#5b8def);pointer-events:none}',
      '.bw-drop-after::after{content:"";position:absolute;left:8px;right:8px;bottom:-1px;height:2px;border-radius:1px;background:var(--dsw-alias-brand-primary,#5b8def);pointer-events:none}',
      '.bw-drop-into{outline:1.5px dashed var(--dsw-alias-brand-primary,#5b8def);outline-offset:-1.5px}',
      '.bw-row:hover{background:var(--dsw-specific-sidebar-nav-item-hover,var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12)))}',
      '.bw-row:hover{background:color-mix(in srgb,var(--dsw-specific-sidebar-nav-item-hover,rgba(127,127,127,.14)) 50%,transparent)}',
      '.bw-row-current{background:var(--dsw-specific-sidebar-nav-item-active,rgba(91,141,239,.15))}',
      '.bw-row-current{background:color-mix(in srgb,var(--dsw-specific-sidebar-nav-item-active,rgba(91,141,239,.16)) 40%,transparent)}',
      '.bw-row-icon{flex:none;display:grid;place-items:center;color:var(--dsw-alias-label-tertiary,#9a9a9a)}',
      '.bw-chevron{flex:none;display:grid;place-items:center;color:var(--dsw-alias-label-tertiary,#9a9a9a);transition:transform .15s ease}',
      '.bw-chevron-open{transform:rotate(90deg)}',
      '.bw-row-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.bw-row-count{flex:none;font-size:11px;color:var(--dsw-alias-label-quaternary,#8a8a8a)}',
      '.bw-row-time{flex:none;font-size:11px;color:var(--dsw-alias-label-quaternary,#8a8a8a)}',
      '.bw-row-actions{flex:none;display:none;align-items:center;gap:2px}',
      '.bw-row:hover .bw-row-actions{display:flex}',
      '.bw-row:hover .bw-row-time,.bw-row:hover .bw-row-count{display:none}',
      '.bw-dot{flex:none;width:6px;height:6px;border-radius:50%;background:transparent}',
      '.bw-session-row{font-size:12.5px;color:var(--dsw-alias-label-secondary,#b8b8b8);min-height:26px}',
      '.bw-sgroup-row{font-size:12.5px;color:var(--dsw-alias-label-tertiary,#9a9a9a);min-height:24px}',
      '.bw-sgroup-row:hover{color:var(--dsw-alias-label-secondary,#b8b8b8)}',
      '.bw-session-row:hover{color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-empty{padding:28px 12px;text-align:center;font-size:12px;color:var(--dsw-alias-label-dimmed,#7a7a7a)}',
      '.bw-rail{display:flex;flex-direction:column;align-items:center;gap:6px;padding:6px 0}',
      '.bw-rail-btn{width:36px;height:36px;border:none;background:transparent;border-radius:8px;display:grid;place-items:center;color:var(--dsw-alias-label-secondary,#b8b8b8);cursor:pointer;padding:0}',
      '.bw-rail-btn:hover{background:var(--dsw-specific-sidebar-nav-item-hover,var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12)));color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-modal-body{display:flex;flex-direction:column;gap:10px;min-width:300px;max-width:380px;box-sizing:border-box}',
      '.bw-field{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--dsw-alias-label-secondary,#b8b8b8)}',
      '.bw-hint{font-size:11px;color:var(--dsw-alias-label-quaternary,#8a8a8a);line-height:1.5}',
      '.bw-path-echo{font-size:11px;color:var(--dsw-alias-label-tertiary,#9a9a9a);word-break:break-all;max-width:380px}',
      '.bw-modal-actions{display:flex;justify-content:flex-end;gap:8px}',
      '.bw-btn{height:28px;padding:0 14px;border-radius:6px;font-size:12.5px;cursor:pointer;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));background:transparent;color:var(--dsw-alias-label-primary,#e6e6e6);font-family:inherit}',
      '.bw-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.bw-btn-primary{background:var(--dsw-alias-brand-primary,#5b8def);border-color:transparent;color:var(--dsw-alias-brand-text,#fff)}',
      '.bw-btn-primary:hover{background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary,#5b8def))}',
      '.bw-btn:disabled{opacity:.5;cursor:default}',
      '.bw-error-text{font-size:12.5px;color:var(--dsw-alias-state-error-primary,#f85149);word-break:break-all;max-width:380px}',
      '.bw-dialog-input-row{display:flex;gap:6px;align-items:center}',
    ].join('')

    const StyleNode = () => E('style', null, CSS_TEXT)

    /* ========================== view store =========================== */

    const createViewStore = () => storeKit.defineStore({
      init: () => ({ folders: [], expanded: {}, sessionsExpanded: {}, sessionGroups: {} }),
      // NOTE: hydration REPLACES the state with the persisted whole value —
      // init defaults never merge. Every action must tolerate a missing key
      // (states persisted by older plugin versions lack sessionGroups), and
      // every selector read takes a fallback.
      persist: 'dsh.betterWorkspace.view.v1',
      actions: {
        setExpanded: (d, key, value) => { if (!d.expanded) d.expanded = {}; d.expanded[key] = value },
        setSessionsExpanded: (d, key, value) => { if (!d.sessionsExpanded) d.sessionsExpanded = {}; d.sessionsExpanded[key] = value },
        setSessionGroupExpanded: (d, key, value) => { if (!d.sessionGroups) d.sessionGroups = {}; d.sessionGroups[key] = value },
        addFolder: (d, path) => {
          if (!Array.isArray(d.folders)) d.folders = []
          const p = normPath(path)
          if (p !== '' && !d.folders.includes(p)) d.folders.push(p)
        },
        removeFolder: (d, path) => {
          if (!Array.isArray(d.folders)) d.folders = []
          d.folders = d.folders.filter(f => f !== path)
        },
        renameFolder: (d, oldPath, newPath) => {
          if (!Array.isArray(d.folders)) d.folders = []
          const oo = oldPath + '/'
          const nn = newPath + '/'
          const next = d.folders.map(f => (f === oldPath ? newPath : (f.startsWith(oo) ? nn + f.slice(oo.length) : f)))
          d.folders = Array.from(new Set(next))
        },
      },
    })

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

    function ConfirmDialog({ title, body, onConfirm, onClose, t }) {
      return E(ui.Modal, {
        open: true,
        onClose,
        closeLabel: t('close'),
        title,
        footer: E('div', { className: 'bw-modal-actions' },
          E(BTN, { variant: 'outline', onClick: onClose }, t('cancel')),
          E(BTN, { variant: 'primary', onClick: onConfirm }, t('confirm')),
        ),
      }, E('div', { className: 'bw-modal-body' }, E('div', { className: 'bw-hint' }, body)), StyleNode())
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

    /**
     * The add-workspace picking interaction: native directory pick, then a
     * small parent-group popup, then create + rename with the chosen prefix.
     * Works as a directoryFlow occupant (owner conversation props) and as the
     * browser's directly composed flow (same props, owner state lives above).
     */
    function BetterFlow(props) {
      const { open, busy, onPicked, onCancel, onError, createWorkspace, renameWorkspace, pickDirectory, useWorkspaces, useStore, t } = props
      const actions = props.actions
      const [phase, setPhase] = React.useState('idle') // idle | picking | picked | submitting
      const [pickedPath, setPickedPath] = React.useState('')
      const [parentInput, setParentInput] = React.useState('')
      // All hooks run before any early return: the flow unmounts its dialog
      // while closed, but its hook sequence must stay stable.
      const snapshotItems = typeof useWorkspaces === 'function' ? useWorkspaces(s => s.items) : []
      const storeFolders = typeof useStore === 'function' ? (useStore(s => s.folders) || []) : []

      React.useEffect(() => {
        if (!open) {
          setPhase('idle')
          setPickedPath('')
          setParentInput('')
          return
        }
        let alive = true
        setPhase('picking')
        Promise.resolve()
          .then(() => pickDirectory())
          .then((path) => {
            if (!alive) return
            if (!path) { onCancel(); return }
            setPickedPath(String(path))
            setParentInput('')
            setPhase('picked')
          })
          .catch((reason) => {
            if (!alive) return
            setPhase('idle')
            onError(messageOf(reason))
          })
        return () => { alive = false }
      }, [open])

      if (!open || (phase !== 'picked' && phase !== 'submitting')) return null

      const folderOptions = (() => {
        const set = new Set(storeFolders)
        for (const w of snapshotItems || []) {
          const segs = splitTitleSegs(w.title)
          for (let i = 1; i < segs.length; i++) set.add(segs.slice(0, i).join('/'))
        }
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'))
      })()

      const confirm = () => {
        if (phase === 'submitting') return
        const prefix = normPath(parentInput)
        const base = basename(pickedPath)
        const fullTitle = prefix !== '' ? prefix + '/' + base : base
        setPhase('submitting')
        Promise.resolve()
          .then(() => createWorkspace({ path: pickedPath }))
          .then(async (workspace) => {
            try {
              await renameWorkspace(workspace.workspaceId, fullTitle)
            } catch (renameError) {
              onError(messageOf(renameError))
              onCancel()
              return
            }
            if (prefix !== '' && actions && typeof actions.addFolder === 'function') actions.addFolder(prefix)
            onCancel()
          })
          .catch((reason) => {
            onError(messageOf(reason))
            onCancel()
          })
      }

      const submitting = phase === 'submitting' || busy === true
      const datalistId = 'bw-folder-options'
      const body = E('div', { className: 'bw-modal-body' },
        E('div', { className: 'bw-field' },
          t('flow.picked'),
          E('div', { className: 'bw-path-echo' }, pickedPath),
        ),
        E('div', { className: 'bw-field' },
          t('flow.parent'),
          E('div', { className: 'bw-dialog-input-row' },
            E('input', {
              className: 'bw-input',
              list: datalistId,
              value: parentInput,
              autoFocus: true,
              placeholder: 'web/frontend',
              disabled: submitting,
              onChange: (e) => setParentInput(e.target.value),
              onKeyDown: (e) => { if (e.key === 'Enter') confirm() },
            }),
            E('datalist', { id: datalistId },
              folderOptions.map((option) => E('option', { key: option, value: option })),
            ),
          ),
          E('div', { className: 'bw-hint' }, t('flow.parentHint')),
        ),
      )
      const footer = E('div', { className: 'bw-modal-actions' },
        E(BTN, { variant: 'outline', onClick: onCancel, disabled: submitting }, t('cancel')),
        E(BTN, { variant: 'primary', onClick: confirm, disabled: submitting }, submitting ? t('flow.creating') : t('create')),
      )
      return E(ui.Modal, { open: true, onClose: () => { if (!submitting) onCancel() }, closeLabel: t('close'), title: t('flow.title'), footer }, body, StyleNode())
    }

    /* ============================== rows ============================== */

    function FolderRow({ node, depth, expanded, onToggle, onMenu, dropInto, dragEvents, t }) {
      const total = countWorkspaces(node)
      return E('div', {
        className: cls('bw-row', dropInto && 'bw-drop-into'),
        style: { paddingLeft: 4 + depth * 12 },
        onClick: onToggle,
        role: 'treeitem',
        'aria-expanded': expanded,
        ...(dragEvents || {}),
      },
        E('span', { className: cls('bw-chevron', expanded && 'bw-chevron-open') }, icon('IconTriangleRightFill14', 14)),
        E('span', { className: 'bw-row-icon' }, icon(expanded ? 'IconFolderOpen16' : 'IconFolderClose16')),
        E('span', { className: 'bw-row-label' }, node.name),
        total > 0 ? E('span', { className: 'bw-row-count' }, String(total)) : null,
        E('span', { className: 'bw-row-actions', onClick: (e) => e.stopPropagation() },
          E('button', { type: 'button', className: 'bw-icon-btn', 'aria-label': t('menu.renameFolder'), onClick: (e) => onMenu('folder', node, e) }, icon('IconEllipsisOutline16')),
        ),
      )
    }

    function WorkspaceRow({ workspace, depth, count, sessionsOpen, onToggle, onStart, onMenu, currentInside, dropHalf, dragEvents, t }) {
      return E('div', {
        className: cls('bw-row', currentInside && 'bw-row-current', dropHalf === 'before' && 'bw-drop-before', dropHalf === 'after' && 'bw-drop-after'),
        style: { paddingLeft: 6 + depth * 12 },
        onClick: onToggle,
        role: 'treeitem',
        'aria-expanded': sessionsOpen,
        ...(dragEvents || {}),
      },
        E('span', { className: cls('bw-chevron', sessionsOpen && 'bw-chevron-open') }, icon('IconTriangleRightFill14', 14)),
        E('span', { className: 'bw-row-icon' }, icon(sessionsOpen ? 'IconFolderOpen16' : 'IconFolderClose16')),
        E('span', { className: 'bw-row-label', title: workspace.title || workspace.leaf }, workspace.leaf),
        count > 0 ? E('span', { className: 'bw-row-count' }, String(count)) : null,
        E('span', { className: 'bw-row-actions', onClick: (e) => e.stopPropagation() },
          E('button', { type: 'button', className: 'bw-icon-btn', 'aria-label': t('session.new'), onClick: (e) => { e.stopPropagation(); onStart() } }, icon('IconPlusOutline16')),
          E('button', { type: 'button', className: 'bw-icon-btn', 'aria-label': t('menu.rename'), onClick: (e) => onMenu('workspace', workspace, e) }, icon('IconEllipsisOutline16')),
        ),
      )
    }

    function SessionRow({ node, depth, current, onOpen, onMenu, now, dropHalf, dragEvents, t }) {
      // Official status priority: pending interaction > running > running
      // subagents > completed reminder; idle rows show no dot at all.
      let status = null
      if (node.pending === 'approval' || node.pending === 'plan-review' || node.pending === 'question') {
        status = { state: 'warning', title: t('status.' + (node.pending === 'plan-review' ? 'planReview' : node.pending)) }
      } else if (node.running || node.subagents > 0) {
        status = { state: 'ongoing', title: node.running ? t('status.running') : t('status.subagents', { n: node.subagents }) }
      } else if (node.completed) {
        status = { state: 'done', title: t('status.completed') }
      }
      return E('div', {
        className: cls('bw-row', 'bw-session-row', current && 'bw-row-current', dropHalf === 'before' && 'bw-drop-before', dropHalf === 'after' && 'bw-drop-after'),
        style: { paddingLeft: 8 + depth * 12 },
        onClick: () => onOpen(node.id),
        role: 'treeitem',
        ...(dragEvents || {}),
      },
        E('span', { className: 'bw-row-icon', title: status ? status.title : undefined },
          status && typeof ui.StateDot === 'function'
            ? E(ui.StateDot, { state: status.state, size: 10 })
            : E('span', { className: 'bw-dot' }),
        ),
        E('span', { className: 'bw-row-label' }, node.leaf || node.title),
        E('span', { className: 'bw-row-time' }, timeLabel(node.updatedAt, now, t)),
        E('span', { className: 'bw-row-actions', onClick: (e) => e.stopPropagation() },
          E('button', { type: 'button', className: 'bw-icon-btn', 'aria-label': t('menu.rename'), onClick: (e) => onMenu('session', node, e) }, icon('IconEllipsisOutline16')),
        ),
      )
    }

    /**
     * Session sub-group inside a workspace (same "/" convention on session
     * titles). Deliberately NOT styled like a workspace folder — no folder
     * icon, tertiary color — so a session level never reads as a workspace.
     */
    function SessionGroupRow({ name, depth, expanded, count, onToggle, onMenu, dropInto, dragEvents, t }) {
      return E('div', {
        className: cls('bw-row', 'bw-sgroup-row', dropInto && 'bw-drop-into'),
        style: { paddingLeft: 10 + depth * 12 },
        onClick: onToggle,
        role: 'treeitem',
        'aria-expanded': expanded,
        ...(dragEvents || {}),
      },
        E('span', { className: cls('bw-chevron', expanded && 'bw-chevron-open') }, icon('IconTriangleRightFill14', 14)),
        E('span', { className: 'bw-row-label' }, name),
        count > 0 ? E('span', { className: 'bw-row-count' }, String(count)) : null,
        E('span', { className: 'bw-row-actions', onClick: (e) => e.stopPropagation() },
          E('button', { type: 'button', className: 'bw-icon-btn', 'aria-label': t('menu.renameSgroup'), onClick: (e) => onMenu(e) }, icon('IconEllipsisOutline16')),
        ),
      )
    }

    /* ============================= browser ============================ */

    function BetterBrowser(props) {
      const {
        wide, expandSidebar,
        useSessions, useSessionPendingInteraction, useWorkspaces,
        useStore, actions,
        startSession, open, renameSession, forkSession, renameWorkspace, deleteWorkspace,
        archiveSession, createWorkspace, pickDirectory, insertWorkspaceBefore, insertSessionBefore,
        t,
      } = props

      if (typeof useWorkspaces !== 'function' || typeof useSessions !== 'function') {
        console.error('[dsh-better-workspace] standard snapshot hooks missing; browser renders nothing')
        return null
      }

      const items = useWorkspaces(s => s.items)
      const phase = useWorkspaces(s => s.phase)
      const archivedSessionIds = useWorkspaces(s => s.archivedSessionIds) || []
      const list = useSessions(s => s)
      const pending = useSessionPendingInteraction ? useSessionPendingInteraction(s => s) : null
      const storeFolders = useStore ? (useStore(s => s.folders) || []) : []
      const expandedMap = useStore ? (useStore(s => s.expanded) || {}) : {}
      const sessionsExpandedMap = useStore ? (useStore(s => s.sessionsExpanded) || {}) : {}
      const sessionGroupsMap = useStore ? (useStore(s => s.sessionGroups) || {}) : {}
      const archivedSet = React.useMemo(() => new Set(archivedSessionIds), [archivedSessionIds])
      const subCounts = React.useMemo(() => subagentRunningCounts(list ? list.byId : {}), [list ? list.byId : null])

      const [query, setQuery] = React.useState('')
      const [searchOpen, setSearchOpen] = React.useState(false)
      const [flowOpen, setFlowOpen] = React.useState(false)
      const [dialog, setDialog] = React.useState(null) // { kind, ... }
      const [menu, setMenu] = React.useState(null) // { kind, payload, rect }
      const [errorText, setErrorText] = React.useState(null)
      const [drag, setDrag] = React.useState(null) // { kind: 'workspace'|'session', source, over } | null
      const normalizedQuery = query.trim().toLowerCase()
      const now = Date.now()

      const fail = (text) => { setFlowOpen(false); setDialog(null); setErrorText(String(text || 'unknown error')) }

      const accounted = new Set()
      for (const workspace of items || []) for (const id of workspace.sessionIds || []) accounted.add(id)
      const ungrouped = []
      if (list && Array.isArray(list.ids)) {
        for (const id of list.ids) {
          const summary = list.byId[id]
          if (accounted.has(id) || !sessionVisible(summary, list.current, archivedSet)) continue
          ungrouped.push({
            id,
            title: sessionTitleOf(summary, t),
            leaf: sessionTitleOf(summary, t),
            blank: !!summary.blank,
            running: !!summary.running,
            completed: summary.completed === true,
            subagents: subCounts.get(id) || 0,
            updatedAt: summary.updatedAt || 0,
            pending: pendingKindOf(pending, id),
          })
        }
        ungrouped.sort((a, b) => b.updatedAt - a.updatedAt)
      }

      const tree = React.useMemo(() => buildTree(items, storeFolders), [items, storeFolders])

      const sessionsOf = (workspace) => {
        const rows = []
        for (const id of workspace.sessionIds || []) {
          const summary = list && list.byId ? list.byId[id] : undefined
          if (!sessionVisible(summary, list ? list.current : undefined, archivedSet)) continue
          rows.push({
            id,
            title: sessionTitleOf(summary, t),
            leaf: sessionTitleOf(summary, t),
            blank: !!summary.blank,
            running: !!summary.running,
            completed: summary.completed === true,
            subagents: subCounts.get(id) || 0,
            updatedAt: summary.updatedAt || 0,
            pending: pendingKindOf(pending, id),
          })
        }
        return rows
      }

      const searchAgent = (agent) => {
        // Returns a pruned copy of the tree node, or null when nothing matches.
        if (!normalizedQuery) return agent
        const folders = []
        for (const folder of agent.folders) {
          const hit = searchAgent(folder)
          if (hit) folders.push(hit)
        }
        const workspaces = []
        for (const workspace of agent.workspaces) {
          const sessions = sessionsOf(workspace)
          const wsHit = workspace.leaf.toLowerCase().includes(normalizedQuery) || workspace.title.toLowerCase().includes(normalizedQuery)
          const matchedSessions = wsHit ? sessions : sessions.filter(s => s.title.toLowerCase().includes(normalizedQuery))
          if (wsHit || matchedSessions.length > 0) workspaces.push({ workspace, matchedSessions })
        }
        if (folders.length === 0 && workspaces.length === 0) return null
        return { node: agent, folders, workspaces }
      }
      const searched = normalizedQuery ? searchAgent(tree) : null
      const searching = normalizedQuery !== ''

      const folderExpanded = (path) => (expandedMap ? expandedMap[path] !== false : true)
      const sessionsOpenOf = (workspaceId) => (sessionsExpandedMap ? sessionsExpandedMap[workspaceId] !== false : true)
      const sessionGroupOpen = (key) => (sessionGroupsMap ? sessionGroupsMap[key] !== false : true)

      const openMenu = (kind, payload, e) => {
        const rect = e && e.currentTarget ? e.currentTarget.getBoundingClientRect() : null
        setMenu({ kind, payload, rect })
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

      const rowHalf = (event) => {
        const rect = event.currentTarget.getBoundingClientRect()
        return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
      }
      const dragMatches = (kind) => drag !== null && drag.kind === kind
      const canDragWorkspace = typeof insertWorkspaceBefore === 'function'

      /* --------------------- workspace drag & drop -------------------- */

      const wsDropHalf = (workspaceId) => {
        if (!dragMatches('workspace')) return null
        const over = drag.over
        return over && over.kind === 'workspace' && over.target === workspaceId ? over.half : null
      }
      const wsDropInto = (path) => dragMatches('workspace') && drag.over && drag.over.kind === 'folder' && drag.over.target === path
      const workspaceDragEvents = (workspace) => ({
        draggable: !searching && canDragWorkspace,
        onDragStart: (event) => {
          if (searching || !canDragWorkspace) return
          event.stopPropagation()
          try {
            event.dataTransfer.effectAllowed = 'move'
            event.dataTransfer.setData('text/plain', workspace.workspaceId)
          } catch { /* drag payload is best-effort */ }
          setDrag({ kind: 'workspace', source: { workspaceId: workspace.workspaceId, leaf: workspace.leaf, folderPath: workspace.folderPath || '' }, over: null })
        },
        onDragEnd: () => setDrag(null),
        onDragOver: (event) => {
          if (!dragMatches('workspace')) return
          event.preventDefault()
          event.stopPropagation()
          try { event.dataTransfer.dropEffect = 'move' } catch { }
          const half = rowHalf(event)
          setDrag(current => (current && current.over && current.over.kind === 'workspace' && current.over.target === workspace.workspaceId && current.over.half === half)
            ? current
            : (current ? { ...current, over: { kind: 'workspace', target: workspace.workspaceId, half } } : current))
        },
        onDrop: (event) => {
          if (!dragMatches('workspace')) return
          event.preventDefault()
          event.stopPropagation()
          const half = drag.over && drag.over.kind === 'workspace' && drag.over.target === workspace.workspaceId ? drag.over.half : rowHalf(event)
          commitWorkspaceDrop(workspace, half)
        },
      })
      const folderDropEvents = (path) => ({
        onDragOver: (event) => {
          if (!dragMatches('workspace')) return
          event.preventDefault()
          event.stopPropagation()
          try { event.dataTransfer.dropEffect = 'move' } catch { }
          setDrag(current => (current && current.over && current.over.kind === 'folder' && current.over.target === path)
            ? current
            : (current ? { ...current, over: { kind: 'folder', target: path } } : current))
        },
        onDrop: (event) => {
          if (!dragMatches('workspace')) return
          event.preventDefault()
          event.stopPropagation()
          commitWorkspaceMoveInto(path)
        },
      })
      const nextWorkspaceAfter = (folderPath, workspaceId) => {
        const node = findTreeNode(tree, folderPath)
        if (!node) return undefined
        const index = node.workspaces.findIndex(w => w.workspaceId === workspaceId)
        return index === -1 ? undefined : (node.workspaces[index + 1] ? node.workspaces[index + 1].workspaceId : undefined)
      }
      const commitWorkspaceDrop = (targetWorkspace, half) => {
        const source = drag.source
        setDrag(null)
        if (source.workspaceId === targetWorkspace.workspaceId) return
        const sameFolder = (targetWorkspace.folderPath || '') === source.folderPath
        const anchor = half === 'after'
          ? nextWorkspaceAfter(targetWorkspace.folderPath || '', targetWorkspace.workspaceId)
          : targetWorkspace.workspaceId
        const chain = sameFolder
          ? Promise.resolve()
          : Promise.resolve().then(() => {
            const newTitle = (targetWorkspace.folderPath || '') !== '' ? (targetWorkspace.folderPath || '') + '/' + source.leaf : source.leaf
            return renameWorkspace(source.workspaceId, newTitle)
          })
        chain
          .then(() => (anchor !== undefined ? insertWorkspaceBefore(source.workspaceId, anchor) : insertWorkspaceBefore(source.workspaceId)))
          .catch(fail)
      }
      const commitWorkspaceMoveInto = (folderPath) => {
        const source = drag.source
        setDrag(null)
        if (source.folderPath === folderPath) return
        const newTitle = folderPath !== '' ? folderPath + '/' + source.leaf : source.leaf
        Promise.resolve()
          .then(() => renameWorkspace(source.workspaceId, newTitle))
          .then(() => insertWorkspaceBefore(source.workspaceId))
          .catch(fail)
      }

      /* ---------------------- session drag & drop --------------------- */

      const sessDropHalf = (sessionId) => {
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
          if (!dragMatches('session') || drag.source.workspaceId !== workspaceId) return
          event.preventDefault()
          event.stopPropagation()
          try { event.dataTransfer.dropEffect = 'move' } catch { }
          const half = rowHalf(event)
          setDrag(current => (current && current.over && current.over.kind === 'session' && current.over.target === session.id && current.over.half === half)
            ? current
            : (current ? { ...current, over: { kind: 'session', target: session.id, half } } : current))
        },
        onDrop: (event) => {
          if (!dragMatches('session') || drag.source.workspaceId !== workspaceId) return
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
        if (source.sessionId === targetSessionId) return
        const workspace = (items || []).find(w => w.workspaceId === workspaceId)
        if (!workspace) return
        const flat = sessionsOf(workspace)
        const index = flat.findIndex(s => s.id === targetSessionId)
        const anchor = half === 'after'
          ? (index === -1 ? undefined : (flat[index + 1] ? flat[index + 1].id : undefined))
          : targetSessionId
        Promise.resolve()
          .then(() => (anchor !== undefined ? insertSessionBefore(workspaceId, source.sessionId, anchor) : insertSessionBefore(workspaceId, source.sessionId)))
          .catch(fail)
      }
      const commitSessionMoveInto = (workspaceId, groupPath) => {
        const source = drag.source
        setDrag(null)
        const newTitle = groupPath !== '' ? groupPath + '/' + source.leaf : source.leaf
        if (newTitle === source.title) return
        Promise.resolve()
          .then(() => renameSession(source.sessionId, newTitle))
          .catch(fail)
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
          .then(() => renameSession(session.id, title))
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
        const node = findSessionGroup(buildSessionTree(sessionsOf(workspace)), target.path)
        if (!node) { setDialog(null); return }
        const parentPath = target.path.includes('/') ? target.path.slice(0, target.path.lastIndexOf('/')) : ''
        const nextPath = parentPath !== '' ? parentPath + '/' + name : name
        const affected = collectSessionRows(node)
        Promise.resolve()
          .then(async () => {
            for (const row of affected) {
              if (row.blank) continue
              const nextTitle = nextPath + row.title.slice(target.path.length)
              await renameSession(row.id, nextTitle)
            }
          })
          .then(() => setDialog(null))
          .catch(fail)
      }

      const findTreeNode = (node, path) => {
        if (node.path === path) return node
        for (const folder of node.folders) {
          const hit = findTreeNode(folder, path)
          if (hit) return hit
        }
        return null
      }

      const submitFolderNew = (rawPath) => {
        const p = normPath(rawPath)
        if (p === '') { setErrorText(t('folder.error.empty')); return }
        if (storeFolders.includes(p)) { setErrorText(t('folder.error.exists')); return }
        actions.addFolder(p)
        setDialog(null)
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
          .then(() => { actions.renameFolder(oldPath, newPath); setDialog(null) })
          .catch(fail)
      }

      const submitFolderDelete = (path) => {
        const node = findTreeNode(tree, path)
        if (node && countWorkspaces(node) > 0) { setErrorText(t('folder.error.notEmpty')); return }
        actions.removeFolder(path)
        setDialog(null)
      }

      /* ---------------------------- rows ----------------------------- */

      const renderSessionTree = (workspace, depth) => {
        // Folder semantics: a closed workspace shows no sessions at all (the
        // row keeps its count badge); an open one shows the full session tree.
        if (!searching && !sessionsOpenOf(workspace.workspaceId)) return []
        const rows = sessionsOf(workspace)
        if (rows.length === 0) return []
        return renderSessionNode(buildSessionTree(rows), workspace.workspaceId, depth)
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
            count: countSessionTree(group),
            onToggle: () => { if (!searching) actions.setSessionGroupExpanded(key, !open) },
            onMenu: (e) => openMenu('sgroup', { workspaceId, path: group.path, name: group.name }, e),
            dropInto: sgroupDropInto(workspaceId, group.path),
            dragEvents: sgroupDropEvents(workspaceId, group.path),
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
        current: list && list.current === session.id,
        now,
        onOpen: (id) => open(id),
        onMenu: openMenu,
        dropHalf: workspaceId ? sessDropHalf(session.id) : null,
        dragEvents: workspaceId ? sessionDragEvents(session, workspaceId) : undefined,
        t,
      })

      const renderWorkspaceEntry = (entry, depth) => {
        const { workspace } = entry
        const count = countSessionTree(buildSessionTree(sessionsOf(workspace)))
        const rows = [E(WorkspaceRow, {
          key: 'ws-' + workspace.workspaceId,
          workspace,
          depth,
          count,
          sessionsOpen: searching ? true : sessionsOpenOf(workspace.workspaceId),
          currentInside: !!(list && list.current && (workspace.sessionIds || []).includes(list.current)),
          onToggle: () => { if (!searching) actions.setSessionsExpanded(workspace.workspaceId, !sessionsOpenOf(workspace.workspaceId)) },
          onStart: () => startSession(workspace.workspaceId),
          onMenu: openMenu,
          dropHalf: wsDropHalf(workspace.workspaceId),
          dragEvents: workspaceDragEvents(workspace),
          t,
        })]
        rows.push(...renderSessionTree(workspace, depth + 1))
        return rows
      }

      const renderPlainFolder = (node, depth) => {
        const expanded = searching || folderExpanded(node.path)
        const rows = [E(FolderRow, {
          key: 'f-' + node.path,
          node,
          depth,
          expanded,
          onToggle: () => { if (!searching) actions.setExpanded(node.path, !expanded) },
          onMenu: openMenu,
          dropInto: wsDropInto(node.path),
          dragEvents: folderDropEvents(node.path),
          t,
        })]
        if (expanded) {
          for (const child of node.folders) rows.push(...renderPlainFolder(child, depth + 1))
          for (const workspace of node.workspaces) rows.push(...renderWorkspaceEntry({ workspace }, depth))
        }
        return rows
      }
      const renderSearchedFolder = (hit, depth) => {
        const node = hit.node
        const rows = [E(FolderRow, {
          key: 'f-' + node.path,
          node,
          depth,
          expanded: true,
          onToggle: () => {},
          onMenu: openMenu,
          dropInto: false,
          dragEvents: undefined,
          t,
        })]
        for (const child of hit.folders) rows.push(...renderSearchedFolder(child, depth + 1))
        for (const entry of hit.workspaces) rows.push(...renderWorkspaceEntry(entry, depth))
        return rows
      }

      let bodyRows = []
      if (searching) {
        if (searched) {
          for (const child of searched.folders) bodyRows.push(...renderSearchedFolder(child, 0))
          for (const entry of searched.workspaces) bodyRows.push(...renderWorkspaceEntry(entry, 0))
        }
      } else {
        for (const folder of tree.folders) bodyRows.push(...renderPlainFolder(folder, 0))
        for (const workspace of tree.workspaces) bodyRows.push(...renderWorkspaceEntry({ workspace }, 0))
        if (ungrouped.length > 0) {
          bodyRows.push(E('div', { key: 'ungrouped-label', className: 'bw-header-title', style: { padding: '10px 6px 2px' } }, t('group.ungrouped')))
          for (const s of ungrouped) bodyRows.push(renderSessionRow(s, 0))
        }
      }
      const isEmpty = bodyRows.length === 0
      if (isEmpty) {
        bodyRows = [E('div', { key: 'empty', className: 'bw-empty' }, searching ? t('empty.search') : (phase === 'pending' ? '…' : t('empty')))]
      }

      /* ---------------------------- menus ---------------------------- */

      const menuProps = (kind) => ({
        open: menu !== null && menu.kind === kind,
        anchor: null,
        getAnchorRect: () => (menu && menu.rect) ? menu.rect : null,
        onClose: () => setMenu(null),
        onSelect: (id) => { setMenu(null); handleMenuPick(id) },
        side: 'bottom',
        align: 'end',
        dense: true,
        portal: true,
      })
      const handleMenuPick = (id) => {
        if (menu === null) return
        const { kind, payload } = menu
        if (kind === 'folder' && id === 'rename-folder') setDialog({ kind: 'folder-rename', path: payload.path })
        else if (kind === 'folder' && id === 'remove-folder') setDialog({ kind: 'folder-delete', path: payload.path })
        else if (kind === 'workspace' && id === 'rename') setDialog({ kind: 'ws-rename', workspace: payload })
        else if (kind === 'workspace' && id === 'delete') setDialog({ kind: 'ws-delete', workspace: payload })
        else if (kind === 'sgroup' && id === 'rename-sgroup') setDialog({ kind: 'sgroup-rename', target: payload })
        else if (kind === 'session' && id === 'rename') setDialog({ kind: 'sess-rename', session: payload })
        else if (kind === 'session' && id === 'fork') forkSession(payload.id)
        else if (kind === 'session' && id === 'archive') { Promise.resolve().then(() => archiveSession(payload.id)).catch(fail) }
      }
      const folderNodeOfMenu = () => (menu && menu.kind === 'folder' ? findTreeNode(tree, menu.payload.path) : null)

      /* --------------------------- dialogs --------------------------- */
      // TextDialog / ConfirmDialog are module-level components: a per-render
      // inline definition would remount on every parent tick and drop input.

      /* ---------------------------- render --------------------------- */

      if (!wide) {
        return E('div', { className: 'bw-rail' },
          StyleNode(),
          E('button', { type: 'button', className: 'bw-rail-btn', 'aria-label': t('rail.search'), onClick: () => { expandSidebar(); setSearchOpen(true) } }, icon('IconSearchOutline16', 18)),
          E('button', { type: 'button', className: 'bw-rail-btn', 'aria-label': t('rail.add'), onClick: () => { expandSidebar(); setFlowOpen(true) } }, icon('IconProjectAddOutline16', 18)),
        )
      }

      const dialogElement = (() => {
        if (dialog === null) return null
        if (dialog.kind === 'ws-rename') return E(TextDialog, {
          key: 'ws-rename',
          title: t('ws.rename.title'),
          hint: t('ws.rename.hint'),
          initial: dialog.workspace.title || dialog.workspace.leaf,
          onConfirm: (v) => submitWorkspaceRename(dialog.workspace, v),
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
        if (dialog.kind === 'sgroup-rename') return E(TextDialog, {
          key: 'sgroup-rename',
          title: t('menu.renameSgroup'),
          hint: t('ws.rename.hint'),
          initial: dialog.target.name,
          onConfirm: (v) => submitSessionGroupRename(dialog.target, v),
          onClose: () => setDialog(null),
          t,
        })
        if (dialog.kind === 'folder-new') return E(TextDialog, {
          key: 'folder-new',
          title: t('folder.new.title'),
          hint: t('folder.new.hint'),
          initial: '',
          onConfirm: submitFolderNew,
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
        if (dialog.kind === 'folder-delete') {
          return E(ConfirmDialog, {
            key: 'folder-delete',
            title: t('menu.removeFolder'),
            body: t('folder.delete.body', { name: dialog.path }),
            onConfirm: () => submitFolderDelete(dialog.path),
            onClose: () => setDialog(null),
            t,
          })
        }
        return null
      })()

      const flowOwner = {
        open: flowOpen,
        busy: false,
        onPicked: () => {},
        onCancel: () => setFlowOpen(false),
        onError: fail,
      }

      return E('div', { className: 'bw-root' },
        StyleNode(),
        E('div', { className: 'bw-header' },
          E('div', { className: 'bw-header-title' }, t('title')),
          (searchOpen || query !== '') ? E('input', {
            className: 'bw-input',
            style: { width: 130, flex: 'none' },
            value: query,
            autoFocus: true,
            placeholder: t('search.placeholder'),
            onChange: (e) => setQuery(e.target.value),
            onKeyDown: (e) => { if (e.key === 'Escape') { setQuery(''); setSearchOpen(false) } },
            onBlur: () => { if (query === '') setSearchOpen(false) },
          }) : null,
          E('button', { type: 'button', className: 'bw-icon-btn', 'aria-label': t('search.placeholder'), onClick: () => setSearchOpen(v => !v) }, icon('IconSearchOutline16')),
          E('button', { type: 'button', className: 'bw-icon-btn', 'aria-label': t('newFolder'), onClick: () => setDialog({ kind: 'folder-new' }) }, E(FolderPlusIcon, { size: 16 })),
          E('button', { type: 'button', className: 'bw-icon-btn', 'aria-label': t('add'), onClick: () => setFlowOpen(true) }, icon('IconProjectAddOutline16')),
        ),
        E('div', { className: 'bw-tree', role: 'tree', 'aria-label': t('title') }, bodyRows),
        E(BetterFlow, {
          open: flowOpen,
          busy: false,
          onPicked: flowOwner.onPicked,
          onCancel: flowOwner.onCancel,
          onError: flowOwner.onError,
          createWorkspace,
          renameWorkspace,
          pickDirectory,
          useWorkspaces,
          actions,
          useStore,
          t,
        }),
        dialogElement,
        E(ui.Menu, { ...menuProps('folder'), items: [
          { id: 'rename-folder', label: t('menu.renameFolder'), icon: icon('IconEditOutline16') },
          { id: 'remove-folder', label: t('menu.removeFolder'), icon: icon('IconTrashOutline16'), danger: true, disabled: !folderNodeOfMenu() || countWorkspaces(folderNodeOfMenu() || { workspaces: [], folders: [] }) > 0 },
        ] }),
        E(ui.Menu, { ...menuProps('sgroup'), items: [
          { id: 'rename-sgroup', label: t('menu.renameSgroup'), icon: icon('IconEditOutline16') },
        ] }),
        E(ui.Menu, { ...menuProps('workspace'), items: [
          { id: 'rename', label: t('menu.rename'), icon: icon('IconEditOutline16') },
          { id: 'delete', label: t('menu.delete'), icon: icon('IconTrashOutline16'), danger: true },
        ] }),
        E(ui.Menu, { ...menuProps('session'), items: [
          { id: 'rename', label: t('menu.rename'), icon: icon('IconEditOutline16') },
          { id: 'fork', label: t('menu.fork'), icon: icon('IconBranchOutline16') },
          { id: 'archive', label: t('menu.archive'), icon: icon('IconArchiveOutline20'), danger: true },
        ] }),
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

    const flowSource = (slots, hole) => ({
      getSnapshot: () => {
        try { return slots.entries(hole).length > 0 } catch { return false }
      },
      subscribe: (listener) => {
        try { return slots.subscribe(hole, listener) } catch { return () => {} }
      },
    })

    function apply(ctx) {
      const slots = ctx.get('slots')
      if (slots === undefined || typeof slots.register !== 'function') {
        console.error('[dsh-better-workspace] slots service unavailable; plugin idle')
        return
      }
      const sessions = ctx.get('sessions')
      const workspaces = ctx.get('workspaces')
      const uiWorkspace = ctx.get('uiWorkspace')
      const connection = ctx.get('connection')
      if (!sessions || !workspaces || !uiWorkspace) {
        console.error('[dsh-better-workspace] required services missing', {
          sessions: !!sessions, workspaces: !!workspaces, uiWorkspace: !!uiWorkspace,
        })
        return
      }

      if (ctx.locale && typeof ctx.locale.register === 'function') {
        ctx.effect(() => {
          try {
            return ctx.locale.register(NS, { zh, en })
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
      const renameSession = async (sessionId, title) => {
        const binding = sessions.binding(sessionId)
        const session = binding && binding.session
        if (!session) throw new Error('unknown session "' + sessionId + '"')
        const result = await session.rename(title)
        if (!result || !result.ok) throw new Error(result && result.error ? result.error.message : 'session rename failed')
      }
      const forkSession = (sessionId) => {
        sessions.fork({ sessionId, increaseTitle: true })
          .then((childId) => sessions.open(childId))
          .catch(() => { /* keep current selection */ })
      }

      const browserInjected = () => ({
        startSession: (workspaceId) => { uiWorkspace.startSession(workspaceId) },
        open: (sessionId) => { sessions.open(sessionId) },
        searchSessions,
        searchResultLimit: sessions.searchResultLimit !== undefined ? sessions.searchResultLimit : 20,
        renameSession,
        forkSession,
        renameWorkspace: (workspaceId, title) => workspaces.rename(workspaceId, title),
        deleteWorkspace: (workspaceId) => workspaces.delete(workspaceId),
        insertWorkspaceBefore: typeof workspaces.insertBefore === 'function'
          ? (workspaceId, beforeWorkspaceId) => workspaces.insertBefore(workspaceId, beforeWorkspaceId)
          : undefined,
        archiveSession: (sessionId) => uiWorkspace.archiveSession(sessionId),
        createWorkspace: (input) => workspaces.create(input),
        pickDirectory: () => uiWorkspace.pickDirectory(),
        hooks: {
          directoryFlow: flowSource(slots, 'sidebar.workspaces.directoryFlow'),
          connectionGeneration: connection ? connection.generation : undefined,
        },
      })
      const flowInjected = (hole) => () => ({
        createWorkspace: (input) => workspaces.create(input),
        renameWorkspace: (workspaceId, title) => workspaces.rename(workspaceId, title),
        pickDirectory: () => uiWorkspace.pickDirectory(),
        hooks: { directoryFlow: flowSource(slots, hole) },
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

      // 1+2. the two directory-flow holes (hero picker, shipped sidebar browser).
      slots.inject('conversation.hero.workspace.directoryFlow', guarded(
        'conversation.hero.workspace.directoryFlow',
        { name: 'conversation.hero.workspace.directoryFlow', inject: flowInjected('conversation.hero.workspace.directoryFlow'), locale: NS },
        BetterFlow,
      ))
      slots.inject('sidebar.workspaces.directoryFlow', guarded(
        'sidebar.workspaces.directoryFlow',
        { name: 'sidebar.workspaces.directoryFlow', inject: flowInjected('sidebar.workspaces.directoryFlow'), locale: NS },
        BetterFlow,
      ))

      // 3. the browser itself — lowest priority renders, shadowing the shipped entry.
      slots.inject('sidebar.workspaces', guarded(
        'sidebar.workspaces',
        {
          name: 'sidebar.workspaces',
          priority: -1,
          store: createViewStore(),
          inject: browserInjected,
          locale: NS,
        },
        BetterBrowser,
      ))
    }

    return {
      name: 'dsh-better-workspace',
      inject: ['slots', 'sessions', 'workspaces', 'locale', 'connection', 'uiWorkspace'],
      apply,
    }
  },
})
