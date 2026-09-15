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
      'schedule.active': '有活动定时任务',
      'menu.rename': '重命名',
      'menu.delete': '删除',
      'menu.fork': '分叉',
      'menu.archive': '归档',
      'menu.newSubfolder': '新增子分组',
      'menu.newSubWorkspace': '新增子工作区',
      'menu.renameFolder': '重命名分组',
      'menu.removeFolder': '删除分组',
      'menu.renameSgroup': '重命名会话分组',
      'settings.title': '更好的工作区',
      'settings.desc': '工作区树的外观与折叠偏好',
      'settings.expand': '展开',
      'settings.collapse': '收起',
      'settings.compactChains': '单链分组折叠显示',
      'settings.compactChains.hint': '单层链合并为一行,出现多个子级时自动展开为树状;拖拽工作区期间单链临时展开回文件夹树,可放入任意一级;展开状态与自定义外观保存在当前浏览器。',
      'settings.statusPulse': '状态呼吸灯',
      'settings.statusPulse.hint': '被折叠藏起的状态灯(完成绿 / 运行蓝 / 待交互琥珀)沿层级向外冒泡:工作区与分组行以图标呼吸发光(颜色随状态,自定义过发光的标题一起呼吸),会话分组行显示呼吸状态灯;默认开启,可在此关闭。',
      'settings.appearance': '默认外观',
      'settings.appearance.hint': '没有单独自定义过的行使用这套外观;字体描边默认开启——背景画面下不描边文字常常看不清。字体颜色留空即跟随主题。',
      'settings.appearance.reset': '恢复默认外观',
      'custom.title': '自定义外观',
      'custom.color': '颜色',
      'custom.glow': '发光',
      'custom.preview': '实时预览',
      'custom.preview.sample': '工作区示例',
      'custom.weight': '字体粗细',
      'custom.weight.regular': '常规',
      'custom.weight.medium': '中',
      'custom.weight.semibold': '半粗',
      'custom.weight.bold': '粗',
      'custom.shadow': '字体阴影',
      'custom.stroke': '字体描边',
      'custom.stroke.hint': '描边颜色默认灰色,可改黑 / 白 / 任意取色,或选「自动」按字体颜色取反差色(浅色字配黑边、深色字配白边);自动模式跟随主题明暗与背景插件的界面明暗。',
      'custom.strokeWidth': '描边粗细',
      'custom.strokeColor': '描边颜色',
      'custom.strokeColor.auto': '自动',
      'custom.weak': '弱',
      'custom.medium': '中',
      'custom.strong': '强',
      'custom.icon': '图标',
      'custom.icon.solid': '实心文件夹',
      'custom.icon.outline': '空心文件夹',
      'custom.icon.none': '不显示',
      'custom.none': '不显示',
      'custom.reset': '清除自定义',
      'custom.done': '完成',
      'settings.on': '开',
      'settings.off': '关',
      'sync.title': '跨端同步',
      'sync.desc': '外观自定义、显式分组与开关保存在本设备的浏览器里;通过宿主设置存储与另一端互传。平时的新修改会自动写入宿主,另一端点「获取」即可拿到;旧版本的历史数据首次需要点一次「发送」。',
      'sync.mode.overwrite': '覆盖本设备',
      'sync.mode.merge': '合并两端',
      'sync.pull.desktop': '从客户端获取',
      'sync.pull.web': '从 Web 获取',
      'sync.push': '发送本设备数据',
      'sync.done': '已同步',
      'sync.empty': '另一端暂无数据可获取',
      'sync.off': '当前环境不支持同步(需要宿主设置服务)',
      'sync.loading': '正在连接宿主设置…',
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
      'schedule.active': 'Has active scheduled task',
      'menu.rename': 'Rename',
      'menu.delete': 'Delete',
      'menu.fork': 'Fork',
      'menu.archive': 'Archive',
      'menu.newSubfolder': 'New subfolder',
      'menu.newSubWorkspace': 'New workspace here',
      'menu.renameFolder': 'Rename folder',
      'menu.removeFolder': 'Delete folder',
      'menu.renameSgroup': 'Rename session group',
      'settings.title': 'Better Workspaces',
      'settings.desc': 'Workspace tree appearance and folding preferences',
      'settings.expand': 'Expand',
      'settings.collapse': 'Collapse',
      'settings.compactChains': 'Merge single-child chains',
      'settings.compactChains.hint': 'Single-child chains merge into one row; levels with multiple children expand as a tree. Chains re-expand into folder rows while you drag a workspace, so it can drop into any level. State and custom styling persist in this browser.',
      'settings.statusPulse': 'Status breathing light',
      'settings.statusPulse.hint': 'Status dots hidden by collapse (done green / running blue / pending amber) bubble outward: workspace and folder rows breathe on their icon in the status color (custom-glow labels breathe along), session-group rows show a breathing dot; on by default, turn it off here.',
      'settings.appearance': 'Default appearance',
      'settings.appearance.hint': 'Rows that were never customized use this appearance; the outline is on by default — text without it is often unreadable over a background image. Leave the color empty to follow the theme.',
      'settings.appearance.reset': 'Reset to default',
      'custom.title': 'Customize',
      'custom.color': 'Color',
      'custom.glow': 'Glow',
      'custom.preview': 'Live preview',
      'custom.preview.sample': 'Workspace sample',
      'custom.weight': 'Font weight',
      'custom.weight.regular': 'Regular',
      'custom.weight.medium': 'Medium',
      'custom.weight.semibold': 'Semi-bold',
      'custom.weight.bold': 'Bold',
      'custom.shadow': 'Font shadow',
      'custom.stroke': 'Font outline',
      'custom.stroke.hint': 'The outline is gray by default — pick black, white, any color, or Auto to derive the contrasting pole from the font color (light text gets a black rim, dark text a white one); Auto follows the theme and a background plugin\'s light/dark switch.',
      'custom.strokeWidth': 'Outline width',
      'custom.strokeColor': 'Outline color',
      'custom.strokeColor.auto': 'Auto',
      'custom.weak': 'Subtle',
      'custom.medium': 'Medium',
      'custom.strong': 'Strong',
      'custom.icon': 'Icon',
      'custom.icon.solid': 'Solid folder',
      'custom.icon.outline': 'Outline folder',
      'custom.icon.none': 'Hidden',
      'custom.none': 'None',
      'custom.reset': 'Clear custom style',
      'custom.done': 'Done',
      'settings.on': 'On',
      'settings.off': 'Off',
      'sync.title': 'Cross-device sync',
      'sync.desc': "Appearance, explicit folders, and toggles live in this device's browser; they exchange with the other surface (web / desktop app) through the host settings store. New edits are written to the host automatically — the other surface just pulls. History created before this version needs one explicit Send.",
      'sync.mode.overwrite': 'Overwrite this device',
      'sync.mode.merge': 'Merge both sides',
      'sync.pull.desktop': 'Pull from desktop app',
      'sync.pull.web': 'Pull from web',
      'sync.push': "Send this device's data",
      'sync.done': 'Synced',
      'sync.empty': 'No data on the other surface yet',
      'sync.off': 'Sync unavailable here (requires the host settings service)',
      'sync.loading': 'Connecting to host settings…',
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
      return ''
    }

    /** Render a primitives icon by name; unknown names degrade to null, never crash. */
    const icon = (name, size) => {
      const C = ui[name]
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

    const pendingKindOf = (pending, id) => {
      if (!pending) return undefined
      const p = typeof pending.get === 'function' ? pending.get(id) : pending[id]
      if (!p) return undefined
      return p.kind || p.status || p.type || 'pending'
    }

    const sessionTitleOf = (summary, t, rememberedTitle) => {
      if (!summary) return ''
      if (summary.blank) return t('session.new')
      if (summary.title) return String(summary.title)
      // Cold-restart window: when the wire omits title, displayTitle is the
      // host's basename fallback (dsh list only serves the projection cache,
      // and fork-born/never-checkpointed sessions always miss it — the durable
      // title stays in the session log, unread for a list row). A title
      // remembered from an earlier snapshot restores the "/" grouping until
      // the session opens and the wire catches up.
      if (typeof rememberedTitle === 'string' && rememberedTitle !== '') return rememberedTitle
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
    function buildSessionTree(rows) {
      const root = { path: '', name: '', groups: [], sessions: [] }
      const byPath = new Map([['', root]])
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
     * Build the folder tree. Folders are virtual: they exist where workspace
     * titles contain "/", plus the explicit empty folders the user created.
     * Returns { path, name, folders, workspaces } with workspaces carrying
     * their leaf display name.
     */
    function buildTree(items, explicitFolders) {
      const root = { path: '', name: '', folders: [], workspaces: [] }
      const byPath = new Map([['', root]])
      // SEGMENT-driven, same as buildSessionTree: the joined path is only a
      // KEY; parsing it back on "/" would break URL authority segments.
      const ensure = (segs) => {
        let node = root
        let key = ''
        for (const seg of segs) {
          key = key === '' ? seg : key + '/' + seg
          let next = byPath.get(key)
          if (!next) {
            next = { path: key, name: seg, folders: [], workspaces: [] }
            byPath.set(key, next)
            node.folders.push(next)
          }
          node = next
        }
        return node
      }
      for (const folder of explicitFolders || []) {
        const segs = splitTitleSegs(normPath(folder))
        if (segs.length > 0) ensure(segs)
      }
      for (const workspace of items || []) {
        const segs = splitTitleSegs(workspace.title)
        const folderPath = segs.slice(0, -1).join('/')
        const leaf = segs.length > 0 ? segs[segs.length - 1] : (basename(workspace.path) || String(workspace.title || '') || String(workspace.workspaceId || ''))
        ensure(segs.slice(0, -1)).workspaces.push({
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

    const countWorkspaces = (node) => (node.kind === 'ws' ? 1 : node.workspaces.length + node.folders.reduce((sum, f) => sum + countWorkspaces(f), 0))

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

    const CSS_TEXT = [
      '.bw-root{height:100%;display:flex;flex-direction:column;min-height:0;position:relative;color:var(--dsw-alias-label-primary,#e6e6e6)}',
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
      '.bw-row-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:1px;margin:-1px}',
      '.bw-row-count{flex:none;font-size:11px;color:var(--dsw-alias-label-quaternary,#8a8a8a)}',
      '.bw-row-time{flex:none;font-size:11px;color:var(--dsw-alias-label-quaternary,#8a8a8a)}',
      // The outline is inherited from the row: the 11px meta column (session
      // count / relative time) opts out — stroked meta text outshines the title
      // it is supposed to support.
      '.bw-row-count,.bw-row-time{-webkit-text-stroke-width:0}',
      '.bw-schedule-badge{flex:none;display:inline-flex;align-items:center;color:var(--dsw-alias-label-tertiary,#9a9a9a);margin:0 6px}',
      '.bw-row-actions{flex:none;display:none;align-items:center;gap:2px}',
      '.bw-row:hover .bw-row-actions{display:flex}',
      '.bw-row:hover .bw-row-time,.bw-row:hover .bw-row-count,.bw-row:hover .bw-schedule-badge{display:none}',
      '.bw-dot{flex:none;width:6px;height:6px;border-radius:50%;background:transparent}',
      '.bw-session-row{font-size:12.5px;color:var(--dsw-alias-label-secondary,#b8b8b8);min-height:26px}',
      '.bw-sgroup-row{font-size:12.5px;color:var(--dsw-alias-label-tertiary,#9a9a9a);min-height:24px}',
      '.bw-sgroup-row:hover{color:var(--dsw-alias-label-secondary,#b8b8b8)}',
      '.bw-session-row:hover{color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-empty{padding:28px 12px;text-align:center;font-size:12px;color:var(--dsw-alias-label-dimmed,#7a7a7a)}',
      '.bw-swatch{width:20px;height:20px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));cursor:pointer;flex:none;background:transparent;padding:0}',
      '.bw-swatch-wide{width:auto;min-width:38px;padding:0 8px;font-size:11px;color:var(--dsw-alias-label-secondary,#b8b8b8)}',
      '.bw-swatch-active{outline:2px solid var(--dsw-alias-brand-primary,#5b8def);outline-offset:1px}',
      '.bw-color-input{width:36px;height:26px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));border-radius:6px;background:transparent;cursor:pointer;padding:0}',
      '.bw-seg{display:flex;gap:6px;flex-wrap:wrap}',
      '.bw-seg-btn{height:24px;padding:0 10px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));background:transparent;color:var(--dsw-alias-label-secondary,#b8b8b8);font-size:12px;cursor:pointer;font-family:inherit}',
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
      '.bw-ctx-menu{position:fixed;min-width:170px;background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay,rgba(28,28,32,.72)));-webkit-backdrop-filter:var(--dsh-any-blur-card-panels,blur(12px) saturate(1.15));backdrop-filter:var(--dsh-any-blur-card-panels,blur(12px) saturate(1.15));border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.3));border-radius:8px;padding:4px;box-shadow:0 8px 24px rgba(0,0,0,.35);display:flex;flex-direction:column}',
      '.bw-ctx-item{display:flex;align-items:center;gap:8px;height:28px;padding:0 10px;border:none;background:transparent;color:var(--dsw-alias-label-primary,#e6e6e6);font-size:12.5px;border-radius:6px;cursor:pointer;text-align:left;font-family:inherit}',
      '.bw-ctx-item:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}',
      '.bw-ctx-danger{color:var(--dsw-alias-state-error-primary,#f85149)}',
      '.bw-ctx-sep{height:1px;background:var(--dsw-alias-border-l1,rgba(127,127,127,.2));margin:4px 6px}',
      '.bw-settings{display:flex;flex-direction:column;gap:6px;max-width:640px}',
      '.bw-plugin-card{list-style:none;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.18));border-radius:12px;background:var(--dsw-alias-bg-layer-3,rgba(127,127,127,.05));transition:border-color .16s,background .16s}',
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
      '.bw-switch{box-sizing:border-box;position:relative;flex:0 0 auto;width:36px;height:20px;padding:2px;border:0;border-radius:10px;background:var(--dsw-alias-border-l3,rgba(127,127,127,.3));cursor:pointer;transition:background 120ms ease}',
      '.bw-switch:hover{background:var(--dsw-alias-label-dimmed,#7a7a7a)}',
      '.bw-switch-on{background:var(--dsw-alias-brand-primary,#5b8def)}',
      '.bw-switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#5b8def);outline-offset:2px}',
      '.bw-switch-thumb{display:block;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-label-primary-foreground,#fff);transition:transform 120ms ease}',
      '.bw-switch-on .bw-switch-thumb{transform:translateX(16px)}',
      '.bw-plugin-body .bw-hint{font-size:12px;color:var(--dsw-alias-label-tertiary,#9a9a9a)}',
      '.bw-rail{display:flex;flex-direction:column;align-items:center;gap:6px;padding:6px 0}',
      '.bw-rail-btn{width:36px;height:36px;border:none;background:transparent;border-radius:8px;display:grid;place-items:center;color:var(--dsw-alias-label-secondary,#b8b8b8);cursor:pointer;padding:0}',
      '.bw-rail-btn:hover{background:var(--dsw-specific-sidebar-nav-item-hover,var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12)));color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-modal-body{display:flex;flex-direction:column;gap:10px;min-width:300px;max-width:380px;box-sizing:border-box}',
      '.bw-field{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--dsw-alias-label-secondary,#b8b8b8)}',
      '.bw-appearance{display:flex;flex-direction:column;gap:10px}',
      '.bw-appearance-box{margin-top:8px;padding:10px 12px;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22));border-radius:8px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.06))}',
      '.bw-hint{font-size:11px;color:var(--dsw-alias-label-quaternary,#8a8a8a);line-height:1.5;white-space:normal;word-break:break-word}',
      '.bw-path-echo{font-size:11px;color:var(--dsw-alias-label-tertiary,#9a9a9a);word-break:break-all;max-width:380px}',
      '.bw-modal-actions{display:flex;justify-content:flex-end;gap:8px}',
      '.bw-btn{height:28px;padding:0 14px;border-radius:6px;font-size:12.5px;cursor:pointer;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));background:transparent;color:var(--dsw-alias-label-primary,#e6e6e6);font-family:inherit}',
      '.bw-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.bw-btn-primary{background:var(--dsw-alias-brand-primary,#5b8def);border-color:transparent;color:var(--dsw-alias-brand-text,#fff)}',
      '.bw-btn-primary:hover{background:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary,#5b8def))}',
      '.bw-btn:disabled{opacity:.5;cursor:default}',
      '.bw-error-text{font-size:12.5px;color:var(--dsw-alias-state-error-primary,#f85149);word-break:break-all;max-width:380px}',
      '.bw-dialog-input-row{display:flex;gap:6px;align-items:center}',
      '.bw-glow-row{display:flex;align-items:center;gap:10px}',
      '.bw-slider{flex:1;accent-color:var(--dsw-alias-brand-primary,#5b8def);height:22px}',
      '.bw-glow-value{min-width:44px;text-align:right;font-size:12px;color:var(--dsw-alias-label-secondary,#b8b8b8);font-variant-numeric:tabular-nums}',
      '.bw-preview{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px dashed var(--dsw-alias-border-l2,rgba(127,127,127,.3));border-radius:6px;min-height:28px}',
      '.bw-preview-icon{flex:none;display:grid;place-items:center;width:20px;height:20px;color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-preview-icon svg{width:18px;height:18px}',
      '.bw-preview-label{font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:18px}',
      '.bw-pulse{animation:bw-breathe 1.8s ease-in-out infinite}',
      '@keyframes bw-breathe{0%,100%{filter:drop-shadow(0 0 1px var(--bw-pulse-color));opacity:.55}50%{filter:drop-shadow(0 0 6px var(--bw-pulse-color));opacity:1}}',
      '.bw-pulse-text{animation:bw-breathe-text 1.8s ease-in-out infinite}',
      '@keyframes bw-breathe-text{0%,100%{text-shadow:0 0 1px var(--bw-pulse-color);opacity:.65}50%{text-shadow:0 0 7px var(--bw-pulse-color);opacity:1}}',
      '.bw-sync-modes{display:flex;gap:6px;margin-top:8px}',
      '.bw-sync-mode{flex:1;padding:5px 10px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));background:transparent;color:var(--dsw-alias-label-secondary,#b8b8b8);cursor:pointer;font-size:12px}',
      '.bw-sync-mode-on{border-color:var(--dsw-alias-brand-primary,#5b8def);color:var(--dsw-alias-label-primary,#e6e6e6);background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.12))}',
      '.bw-sync-actions{display:flex;gap:8px;margin-top:8px}',
      '.bw-sync-btn{padding:5px 12px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.3));background:transparent;color:var(--dsw-alias-label-secondary,#b8b8b8);cursor:pointer;font-size:12px}',
      '.bw-sync-btn:disabled{opacity:.45;cursor:default}',
      '.bw-sync-btn-primary{border-color:var(--dsw-alias-brand-primary,#5b8def);color:var(--dsw-alias-label-primary,#e6e6e6)}',
    ].join('')

    const StyleNode = () => E('style', null, CSS_TEXT)

    /* ========================== view store =========================== */

    const createViewStore = () => storeKit.defineStore({
      init: () => ({ folders: [], expanded: {}, sessionsExpanded: {}, sessionGroups: {}, sessionOrder: {}, prefs: { compactChains: true }, styling: {} }),
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
          if (Array.isArray(host.folders)) d.folders = host.folders.slice()
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
          if (Array.isArray(host.folders)) {
            const merged = new Set([...(Array.isArray(d.folders) ? d.folders : []), ...host.folders])
            d.folders = Array.from(merged)
          }
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
        byId[id] = { title: title, at: now }
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

    // Cross-device preferences: styling / explicit folders / the two toggles
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
    const makeSharedWrites = (actions, stylingMap, foldersList) => ({
      setStyling: (key, value) => {
        if (actions && typeof actions.setStyling === 'function') actions.setStyling(key, value)
        const next = { ...stylingMap }
        if (value === null) delete next[key]
        else next[key] = value
        scopeSet('styling', next)
      },
      addFolder: (path) => {
        if (actions && typeof actions.addFolder === 'function') actions.addFolder(path)
        const p = normPath(path)
        const base = Array.isArray(foldersList) ? foldersList : []
        if (p !== '' && !base.includes(p)) scopeSet('folders', [...base, p])
      },
      removeFolder: (path) => {
        if (actions && typeof actions.removeFolder === 'function') actions.removeFolder(path)
        const base = Array.isArray(foldersList) ? foldersList : []
        scopeSet('folders', base.filter(f => f !== path))
      },
      renameFolder: (oldPath, newPath) => {
        if (actions && typeof actions.renameFolder === 'function') actions.renameFolder(oldPath, newPath)
        const base = Array.isArray(foldersList) ? foldersList : []
        const oo = oldPath + '/'
        const nn = newPath + '/'
        scopeSet('folders', Array.from(new Set(base.map(f => (f === oldPath ? newPath : (f.startsWith(oo) ? nn + f.slice(oo.length) : f))))))
      },
      setPref: (key, value) => {
        if (actions && typeof actions.setPref === 'function') actions.setPref(key, value)
        scopeSet(key, value)
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
      const initialParent = props.initialParent || ''
      const actions = props.actions
      const [phase, setPhase] = React.useState('idle') // idle | picking | picked | submitting
      const [pickedPath, setPickedPath] = React.useState('')
      const [parentInput, setParentInput] = React.useState('')
      // All hooks run before any early return: the flow unmounts its dialog
      // while closed, but its hook sequence must stay stable.
      const snapshotItems = typeof useWorkspaces === 'function' ? useWorkspaces(s => s.items) : []
      const storeFolders = typeof useStore === 'function' ? (useStore(s => s.folders) || []) : []
      const storeStyling = typeof useStore === 'function' ? (useStore(s => s.styling) || {}) : {}
      const shared = makeSharedWrites(actions, storeStyling, storeFolders)

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
            setParentInput(initialParent)
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
            if (prefix !== '') shared.addFolder(prefix)
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

    /* ------------------- appearance: defaults + outline ------------------- */

    // Text outline. Width and color are DERIVED, never hand-picked: an outline
    // only helps when it contrasts with the label, and the label color is
    // whatever the theme — or a background plugin's light/dark switch — hands
    // us at that moment. contrastStrokeColor() reads the effective font color
    // and returns the opposite pole; rows without a custom color inherit
    // --bw-stroke-color, sampled from the live computed style (see the sampler
    // in BetterBrowser) so a palette flip needs no React render.
    const STROKE_MAX = 4
    // The outline color defaults to a plain gray: it reads on light and dark
    // backgrounds alike without shouting like pure black/white. "auto" derives
    // the contrasting pole from the font color instead.
    const DEFAULT_APPEARANCE = { color: '', glow: 0, weight: 0, shadow: false, stroke: true, strokeWidth: 1, strokeColor: '#808080' }
    const APPEARANCE_FIELDS = ['color', 'glow', 'weight', 'shadow', 'stroke', 'strokeWidth', 'strokeColor']
    const clampStrokeWidth = (raw) => {
      const n = Number(raw)
      if (!isFinite(n) || n <= 0) return DEFAULT_APPEARANCE.strokeWidth
      return Math.min(STROKE_MAX, Math.max(0.5, Math.round(n * 2) / 2))
    }
    // Persisted values arrive from older plugin versions and from the other
    // surface: every read tolerates missing keys and falls back to the default
    // (hydration replaces state wholesale — the 0.9.x hard rule).
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
    // row customized before this version (no stroke key) still inherits the new
    // default outline instead of losing it.
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
        const rgb = appearance.color ? colorToRgb(appearance.color) : null
        return rgb ? contrastStrokeColor(rgb) : STROKE_FALLBACK
      }
      return colorToRgb(picked) ? picked : DEFAULT_APPEARANCE.strokeColor
    }
    // paint-order keeps the stroke UNDER the fill, so the glyph does not thin
    // out — the whole point of an outer outline.
    const strokeStyleOf = (appearance) => {
      if (!appearance || appearance.stroke === false) return null
      return {
        WebkitTextStrokeWidth: clampStrokeWidth(appearance.strokeWidth) + 'px',
        WebkitTextStrokeColor: strokeColorOf(appearance),
        paintOrder: 'stroke fill',
      }
    }

    function FolderRow({ node, depth, expanded, onToggle, onContextMenu, dropInto, dragEvents, custStyle, iconMode, pulse, t }) {
      const total = countWorkspaces(node)
      const iconEl = iconOf(iconMode, expanded)
      // Hidden status dots breathe on the icon; with the icon hidden (mode
      // "none" or a missing primitive) the official StateDot stands in.
      const iconChild = pulse
        ? E(PulseGlow, { state: pulse }, iconEl || (typeof ui.StateDot === 'function' ? E(ui.StateDot, { state: pulse, size: 10 }) : null))
        : iconEl
      return E('div', {
        className: cls('bw-row', dropInto && 'bw-drop-into'),
        style: { paddingLeft: 4 + depth * 12, ...(custStyle || {}), ...(pulse ? { '--bw-pulse-color': PULSE_COLORS[pulse] || PULSE_COLORS.ongoing } : null) },
        onClick: onToggle,
        onContextMenu: onContextMenu,
        role: 'treeitem',
        'aria-expanded': expanded,
        ...(dragEvents || {}),
      },
        E('span', { className: cls('bw-chevron', expanded && 'bw-chevron-open') }, icon('IconTriangleRightFill14', 14)),
        E('span', { className: 'bw-row-icon' }, iconChild),
        // A row that already carries a custom label glow breathes in sync.
        E('span', { className: cls('bw-row-label', pulse && custStyle && custStyle.textShadow && 'bw-pulse-text') }, node.name),
        total > 0 ? E('span', { className: 'bw-row-count' }, String(total)) : null,
      )
    }

    function WorkspaceRow({ workspace, depth, count, sessionsOpen, onToggle, onStart, onContextMenu, currentInside, dropHalf, dragEvents, custStyle, iconMode, pulse, t }) {
      const iconEl = iconOf(iconMode, sessionsOpen)
      const iconChild = pulse
        ? E(PulseGlow, { state: pulse }, iconEl || (typeof ui.StateDot === 'function' ? E(ui.StateDot, { state: pulse, size: 10 }) : null))
        : iconEl
      return E('div', {
        className: cls('bw-row', currentInside && 'bw-row-current', dropHalf === 'before' && 'bw-drop-before', dropHalf === 'after' && 'bw-drop-after'),
        style: { paddingLeft: 6 + depth * 12, ...(custStyle || {}), ...(pulse ? { '--bw-pulse-color': PULSE_COLORS[pulse] || PULSE_COLORS.ongoing } : null) },
        onClick: onToggle,
        onContextMenu: onContextMenu,
        role: 'treeitem',
        'aria-expanded': sessionsOpen,
        ...(dragEvents || {}),
      },
        E('span', { className: cls('bw-chevron', sessionsOpen && 'bw-chevron-open') }, icon('IconTriangleRightFill14', 14)),
        E('span', { className: 'bw-row-icon' }, iconChild),
        E('span', { className: cls('bw-row-label', pulse && custStyle && custStyle.textShadow && 'bw-pulse-text'), title: workspace.title || workspace.leaf }, workspace.leaf),
        count > 0 ? E('span', { className: 'bw-row-count' }, String(count)) : null,
        E('span', { className: 'bw-row-actions', onClick: (e) => e.stopPropagation() },
          E('button', { type: 'button', className: 'bw-icon-btn', 'aria-label': t('session.new'), onClick: (e) => { e.stopPropagation(); onStart() } }, icon('IconPlusOutline16')),
        ),
      )
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

    function SessionRow({ node, depth, current, onOpen, onContextMenu, now, dropHalf, dragEvents, custStyle, breathing, t }) {
      const state = sessionStateOf(node)
      const status = state === null ? null : {
        state,
        title: state === 'warning'
          ? t('status.' + (node.pending === 'plan-review' ? 'planReview' : node.pending))
          : state === 'ongoing'
            ? (node.running ? t('status.running') : t('status.subagents', { n: node.subagents }))
            : t('status.completed'),
      }
      return E('div', {
        className: cls('bw-row', 'bw-session-row', current && 'bw-row-current', dropHalf === 'before' && 'bw-drop-before', dropHalf === 'after' && 'bw-drop-after'),
        style: { paddingLeft: 8 + depth * 12, ...(custStyle || {}) },
        onClick: () => onOpen(node.id),
        onContextMenu: onContextMenu,
        role: 'treeitem',
        ...(dragEvents || {}),
      },
        E('span', { className: 'bw-row-icon', title: status ? status.title : undefined },
          status && typeof ui.StateDot === 'function'
            ? (state === 'ongoing' && breathing
              // Running breathes blue ON the session row only (never relays);
              // the settings toggle covers this breathing too.
              ? E(PulseGlow, { state: 'ongoing' }, E(ui.StateDot, { state: status.state, size: 10 }))
              : E(ui.StateDot, { state: status.state, size: 10 }))
            : E('span', { className: 'bw-dot' }),
        ),
        E('span', { className: 'bw-row-label' }, node.leaf || node.title),
        node.hasActiveSchedule
          ? E('span', { className: 'bw-schedule-badge', role: 'img', 'aria-label': t('schedule.active'), title: t('schedule.active') }, icon('IconAlarmClockOutline16', 14))
          : null,
        E('span', { className: 'bw-row-time' }, timeLabel(node.updatedAt, now, t)),
      )
    }

    /**
     * Session sub-group inside a workspace (same "/" convention on session
     * titles). Deliberately NOT styled like a workspace folder — no folder
     * icon, tertiary color — so a session level never reads as a workspace.
     */
    function SessionGroupRow({ name, depth, expanded, count, onToggle, onContextMenu, dropInto, dragEvents, custStyle, pulse, t }) {
      return E('div', {
        className: cls('bw-row', 'bw-sgroup-row', dropInto && 'bw-drop-into'),
        style: { paddingLeft: 10 + depth * 12, ...(custStyle || {}) },
        onClick: onToggle,
        onContextMenu: onContextMenu,
        role: 'treeitem',
        'aria-expanded': expanded,
        ...(dragEvents || {}),
      },
        E('span', { className: cls('bw-chevron', expanded && 'bw-chevron-open') }, icon('IconTriangleRightFill14', 14)),
        // Session groups have no icon slot: a collapsed group with hidden
        // status relays through a breathing official StateDot instead.
        pulse ? E(PulseGlow, { state: pulse }, typeof ui.StateDot === 'function' ? E(ui.StateDot, { state: pulse, size: 10 }) : null) : null,
        E('span', { className: 'bw-row-label' }, name),
        count > 0 ? E('span', { className: 'bw-row-count' }, String(count)) : null,
      )
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
      'IconEditOutline16', 'IconEllipsisOutline16', 'IconFolderClose16', 'IconFolderOpen16',
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
      const color = appearance.color || ''
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
    function CustomizeDialog({ open, initial, defaults, kind, onChange, onReset, onClose, t }) {
      // Icons render only for workspace / workspace-folder rows. Session rows
      // already carry the official status dot (pending/running/done) in the
      // leading slot, and session sub-group rows have no icon either — so the
      // icon grid is offered only where it actually displays.
      const allowIcon = kind === 'folder' || kind === 'workspace'
      const fallback = readAppearance(defaults)
      const [draft, setDraft] = React.useState(DEFAULT_APPEARANCE)
      React.useEffect(() => {
        if (!open) return
        const base = readAppearance(initial)
        setDraft({ ...base, icon: (initial && initial.icon) || 'solid' })
      }, [open, initial])
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
        footer: E('div', { className: 'bw-modal-actions' },
          E(BTN, { variant: 'outline', onClick: () => { onReset(); onClose() } }, t('custom.reset')),
          E(BTN, { variant: 'primary', onClick: commit }, t('custom.done')),
        ),
      },
        E('div', { className: 'bw-modal-body' },
          E(AppearanceControls, {
            value: draft,
            onChange: (patch) => setDraft((prev) => ({ ...readAppearance(prev), ...patch, icon: prev.icon || 'solid' })),
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
      const localFolders = useStore ? (useStore(s => s.folders) || []) : []
      const compactChains = prefs.compactChains !== false
      const statusPulse = prefs.statusPulse !== false
      // Default appearance: the base every row inherits unless it carries its
      // own per-row entry. The outline ships ON — text over a background image
      // is often unreadable without it.
      const appearance = readAppearance(prefs.appearance)
      const setPref = (key, value) => {
        if (actions && typeof actions.setPref === 'function') actions.setPref(key, value)
        scopeSet(key, value)
      }
      const setAppearance = (next) => setPref('appearance', readAppearance(next))
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
        const folders = Array.isArray(localFolders) ? localFolders.slice() : []
        scopeSet('styling', localStyling)
        scopeSet('folders', folders)
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
        E('div', { className: 'bw-setting-label', style: { marginTop: 16 } }, t('settings.appearance')),
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
        E('div', { className: 'bw-setting-label', style: { marginTop: 16 } }, t('sync.title')),
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
      )
    }

    /* --------- settings → plug-ins card (accordion like official cards) --------- */

    function BetterWorkspacePluginCard({ useStore, actions, t }) {
      const [open, setOpen] = React.useState(false)
      const Chevron = ui.IconChevronDownOutline14
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
      const prefsMap = useStore ? (useStore(s => s.prefs) || {}) : {}
      const stylingMap = useStore ? (useStore(s => s.styling) || {}) : {}
      const sessionOrderMap = useStore ? (useStore(s => s.sessionOrder) || {}) : {}
      // Dual-write wrappers: every preference mutation lands in the local
      // store (immediate echo + scope-less fallback) AND the host settings
      // store (durable cross-device copy for the manual pull on the other
      // surface). Computed from the CURRENT rendered values.
      const shared = makeSharedWrites(actions, stylingMap, storeFolders)
      const compactChains = prefsMap.compactChains !== false
      const statusPulse = prefsMap.statusPulse !== false
      const archivedSet = React.useMemo(() => new Set(archivedSessionIds), [archivedSessionIds])
      const subCounts = React.useMemo(() => subagentRunningCounts(list ? list.byId : {}), [list ? list.byId : null])
      // Last-known real titles for the cold-restart fallback window (see
      // the title-cache block). Read per render via getSnapshot: no
      // subscription, because a cache write only happens when summary.title
      // exists — at that moment the row already renders the wire truth and
      // no re-render is wanted.
      const remembered = (titleCacheRef && typeof titleCacheRef.getSnapshot === 'function')
        ? (titleCacheRef.getSnapshot().byId || {})
        : {}
      const rememberedTitleOf = (id) => (remembered[id] ? remembered[id].title : undefined)

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

      const [query, setQuery] = React.useState('')
      const [searchOpen, setSearchOpen] = React.useState(false)
      const [flowOpen, setFlowOpen] = React.useState(false)
      const [flowParent, setFlowParent] = React.useState('') // parent path prefill for the add-workspace flow (context menu entry)
      const [dialog, setDialog] = React.useState(null) // { kind, ... }
      const [ctx, setCtx] = React.useState(null) // context menu { kind, payload, x, y }
      const [customize, setCustomize] = React.useState(null) // { kind, entryKey, name }
      const [errorText, setErrorText] = React.useState(null)
      const [drag, setDrag] = React.useState(null) // { kind: 'workspace'|'session', source, over } | null
      // Workspace drags arm their state one frame LATE (see workspaceDragEvents):
      // arming synchronously re-renders during the dragstart dispatch, the chain
      // expansion inserts rows above the drag source, the cursor leaves the
      // source element, and Chromium cancels the whole gesture. dragEnd clears
      // the timer so a same-tick cancel never leaves a ghost drag behind.
      const wsDragArmTimer = React.useRef(null)
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
        return renameSession(sessionId, title)
      }

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

      const fail = (text) => { setFlowOpen(false); setDialog(null); setErrorText(String(text || 'unknown error')) }

      const styleEntry = (key) => stylingMap[key] || null
      // Effective appearance = the settings card's default, overridden field by
      // field by this row's own entry.
      const defaultAppearance = readAppearance(prefsMap.appearance)
      const appearanceOf = (key) => mergeAppearance(defaultAppearance, styleEntry(key))
      const rowStyleOf = (key) => {
        const appearance = appearanceOf(key)
        const color = appearance.color || ''
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
        if (kind === 'folder') return 'folder:' + payload.path
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
          if (accounted.has(id) || !sessionVisible(summary, list.current, archivedSet)) continue
          ungrouped.push({
            id,
            title: sessionTitleOf(summary, t, rememberedTitleOf(id)),
            leaf: sessionTitleOf(summary, t, rememberedTitleOf(id)),
            blank: !!summary.blank,
            running: !!summary.running,
            completed: summary.completed === true,
            hasActiveSchedule: hasActiveScheduleOf(summary),
            subagents: subCounts.get(id) || 0,
            updatedAt: summary.updatedAt || 0,
            pending: pendingKindOf(pending, id),
          })
        }
        ungrouped.sort((a, b) => b.updatedAt - a.updatedAt)
      }

      // While a workspace drag is active, single-child chains render UNCOMPRESSED:
      // a merged "group/workspace" row hides every folder level of the chain inside
      // its label, and those levels are exactly the drop targets for "move into
      // this group". Suspending the merge for the drag's duration re-exposes each
      // level as a real folder row (folder expansion defaults apply); when the
      // drag ends, the chains merge back. Session drags keep the merged view —
      // their drop targets live inside workspace rows, which compression merges.
      const draggingWorkspace = drag !== null && drag.kind === 'workspace'
      const tree = React.useMemo(() => {
        const built = buildTree(items, storeFolders)
        if (!compactChains || draggingWorkspace) return built
        return { ...built, folders: built.folders.map((f) => materializeChain(compressTree(f))), workspaces: built.workspaces }
      }, [items, storeFolders, compactChains, draggingWorkspace])

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
          if (!sessionVisible(summary, list ? list.current : undefined, archivedSet)) continue
          rows.push({
            id,
            title: sessionTitleOf(summary, t, rememberedTitleOf(id)),
            leaf: sessionTitleOf(summary, t, rememberedTitleOf(id)),
            blank: !!summary.blank,
            running: !!summary.running,
            completed: summary.completed === true,
            hasActiveSchedule: hasActiveScheduleOf(summary),
            subagents: subCounts.get(id) || 0,
            updatedAt: summary.updatedAt || 0,
            pending: pendingKindOf(pending, id),
          })
        }
        // Browser-local reorder fallback (dsh 0.1.6-alpha.1 stopped injecting
        // insertSessionBefore): the local flat order wins for the workspaces the
        // user dragged in, and is empty everywhere else — so a host that still
        // exposes the action keeps its authoritative order untouched.
        // Host order stays authoritative wherever the action exists.
        const local = typeof insertSessionBefore === 'function' ? [] : sessionOrderOf(workspace.workspaceId)
        if (local.length === 0) return rows
        const remaining = new Map(rows.map((row) => [row.id, row]))
        const out = []
        for (const id of local) {
          const row = remaining.get(id)
          if (row) { out.push(row); remaining.delete(id) }
        }
        for (const row of rows) if (remaining.has(row.id)) out.push(row)
        return out
      }

      const searchAgent = (agent) => {
        // Returns a pruned copy of the tree node, or null when nothing matches.
        if (!normalizedQuery) return agent
        if (agent.kind === 'ws') {
          const ws = agent.workspace
          const sessions = sessionsOf(ws)
          const wsHit = ws.leaf.toLowerCase().includes(normalizedQuery) || ws.title.toLowerCase().includes(normalizedQuery)
          if (wsHit || sessions.some(s => s.title.toLowerCase().includes(normalizedQuery))) {
            return { ...agent, node: agent, folders: [], workspaces: [ws] }
          }
          return null
        }
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
      // A COLLAPSED workspace row relays its whole session tree; an open row
      // shows the real dots (deeper collapsed groups relay on their own rows).
      const wsPulseOf = (workspace) => (!statusPulse || searching || sessionsOpenOf(workspace.workspaceId))
        ? null
        : nodePulseOf(buildSessionTree(sessionsOf(workspace)))
      // A collapsed FOLDER hides everything below — including open workspaces —
      // so its aggregation ignores inner expansion states entirely.
      const wsAllPulseOf = (workspace) => (!statusPulse || searching)
        ? null
        : nodePulseOf(buildSessionTree(sessionsOf(workspace)))
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

      const openCtx = (kind, payload, e) => {
        if (e) e.preventDefault()
        setCtx({ kind, payload, x: e.clientX, y: e.clientY })
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
      // Session REORDER needs the host insertSessionBefore action; dragging a
      // session onto a sub-group row (a pure rename) stays available without it.
      // Session reorder keeps working either way: the host action is preferred
      // (authoritative, visible to every surface), while hosts that no longer
      // inject it — dsh 0.1.6-alpha.1 dropped insertSessionBefore from the
      // browser contract — fall back to the browser-local flat order.
      const canReorderSessions = true

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
          // Drag identity derives from the RAW title, never the displayed leaf:
          // a compressed single-chain row shows "group/workspace" as its leaf with
          // folderPath '' — carrying that would make move-into / cross-folder
          // drops rebuild titles like "x/group/workspace". The real leaf and
          // folder keep every drop target's rename correct.
          const segs = splitTitleSegs(workspace.title)
          const sourceLeaf = segs.length > 0 ? segs[segs.length - 1] : (workspace.leaf || String(workspace.workspaceId))
          const sourceFolder = segs.length > 1 ? segs.slice(0, -1).join('/') : ''
          // Deferred by one frame on purpose (Chromium cancels a just-started
          // drag whose source element is moved out from under the cursor; see
          // wsDragArmTimer above). By the next frame the gesture has settled
          // and the chain expansion is an ordinary mid-drag update.
          if (wsDragArmTimer.current !== null) clearTimeout(wsDragArmTimer.current)
          wsDragArmTimer.current = setTimeout(() => {
            wsDragArmTimer.current = null
            setDrag({ kind: 'workspace', source: { workspaceId: workspace.workspaceId, leaf: sourceLeaf, folderPath: sourceFolder }, over: null })
          }, 0)
        },
        onDragEnd: () => {
          if (wsDragArmTimer.current !== null) { clearTimeout(wsDragArmTimer.current); wsDragArmTimer.current = null }
          setDrag(null)
        },
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
        if (typeof insertSessionBefore === 'function') {
          Promise.resolve()
            .then(() => (anchor !== undefined ? insertSessionBefore(workspaceId, source.sessionId, anchor) : insertSessionBefore(workspaceId, source.sessionId)))
            .catch(fail)
          return
        }
        // Host channel gone: commit the same move into the browser-local order.
        if (actions && typeof actions.setSessionOrder === 'function') {
          actions.setSessionOrder(workspaceId, reorderIds(flat.map((s) => s.id), source.sessionId, anchor))
        }
      }
      const commitSessionMoveInto = (workspaceId, groupPath) => {
        const source = drag.source
        setDrag(null)
        const newTitle = groupPath !== '' ? groupPath + '/' + source.leaf : source.leaf
        if (newTitle === source.title) return
        Promise.resolve()
          .then(() => renameByUser(source.sessionId, newTitle))
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
              await renameByUser(row.id, nextTitle)
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

      const submitFolderNew = (parentPath, rawPath) => {
        const parent = normPath(parentPath)
        const sub = normPath(rawPath)
        if (sub === '') { setErrorText(t('folder.error.empty')); return }
        const p = parent !== '' ? parent + '/' + sub : sub
        // Existence check covers explicit folders AND every folder derived
        // from workspace titles, so "already exists" means either kind.
        const derived = new Set()
        for (const w of items || []) {
          const segs = splitTitleSegs(w.title)
          for (let i = 1; i < segs.length; i++) derived.add(segs.slice(0, i).join('/'))
        }
        if (storeFolders.includes(p) || derived.has(p)) { setErrorText(t('folder.error.exists')); return }
        shared.addFolder(p)
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
          .then(() => { shared.renameFolder(oldPath, newPath); setDialog(null) })
          .catch(fail)
      }

      const submitFolderDelete = (path) => {
        const node = findTreeNode(tree, path)
        if (node && countWorkspaces(node) > 0) { setErrorText(t('folder.error.notEmpty')); return }
        shared.removeFolder(path)
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
            pulse: (statusPulse && !open) ? nodePulseOf(group) : null,
            count: countSessionTree(group),
            onToggle: () => { if (!searching) actions.setSessionGroupExpanded(key, !open) },
            onContextMenu: (e) => openCtx('sgroup', { workspaceId, path: group.path, name: group.name }, e),
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
        current: list && list.current === session.id,
        now,
        onOpen: (id) => open(id),
        onContextMenu: (e) => openCtx('session', session, e),
        dropHalf: workspaceId ? sessDropHalf(session.id) : null,
        dragEvents: workspaceId ? sessionDragEvents(session, workspaceId) : undefined,
        custStyle: rowStyleOf('session:' + session.id),
        breathing: statusPulse,
        t,
      })

      const renderWorkspaceEntry = (entry, depth, pulse) => {
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
          // Starting a session force-expands the workspace row: the user must
          // SEE the new session appear, even if the row was collapsed.
          onStart: () => { actions.setSessionsExpanded(workspace.workspaceId, true); startSession(workspace.workspaceId) },
          onContextMenu: (e) => openCtx('workspace', workspace, e),
          dropHalf: wsDropHalf(workspace.workspaceId),
          dragEvents: workspaceDragEvents(workspace),
          custStyle: rowStyleOf('workspace:' + workspace.workspaceId),
          iconMode: (styleEntry('workspace:' + workspace.workspaceId) || {}).icon || 'solid',
          pulse,
          t,
        })]
        rows.push(...renderSessionTree(workspace, depth + 1))
        return rows
      }

      const renderPlainFolder = (node, depth) => {
        if (node.kind === 'ws') return renderWorkspaceEntry({ workspace: node.workspace }, depth, wsPulseOf(node.workspace))
        const expanded = searching || folderExpanded(node.path)
        const rows = [E(FolderRow, {
          key: 'f-' + node.path,
          node,
          depth,
          expanded,
          onToggle: () => { if (!searching) actions.setExpanded(node.path, !expanded) },
          onContextMenu: (e) => openCtx('folder', { path: node.path, name: node.name }, e),
          dropInto: wsDropInto(node.path),
          dragEvents: folderDropEvents(node.path),
          custStyle: rowStyleOf('folder:' + node.path),
          iconMode: (styleEntry('folder:' + node.path) || {}).icon || 'solid',
          pulse: expanded ? null : folderPulseOf(node),
          t,
        })]
        if (expanded) {
          for (const child of node.folders) rows.push(...renderPlainFolder(child, depth + 1))
          for (const workspace of node.workspaces) rows.push(...renderWorkspaceEntry({ workspace }, depth + 1, wsPulseOf(workspace)))
        }
        return rows
      }
      const renderSearchedFolder = (hit, depth) => {
        if (hit.kind === 'ws') return renderWorkspaceEntry({ workspace: hit.workspace }, depth)
        const node = hit.node
        const rows = [E(FolderRow, {
          key: 'f-' + node.path,
          node,
          depth,
          expanded: true,
          onToggle: () => {},
          onContextMenu: (e) => openCtx('folder', { path: node.path, name: node.name }, e),
          dropInto: false,
          dragEvents: undefined,
          custStyle: rowStyleOf('folder:' + node.path),
          iconMode: (styleEntry('folder:' + node.path) || {}).icon || 'solid',
          t,
        })]
        for (const child of hit.folders) rows.push(...renderSearchedFolder(child, depth + 1))
        for (const entry of hit.workspaces) rows.push(...renderWorkspaceEntry(entry, depth + 1))
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
        for (const workspace of tree.workspaces) bodyRows.push(...renderWorkspaceEntry({ workspace }, 0, wsPulseOf(workspace)))
        if (ungrouped.length > 0) {
          bodyRows.push(E('div', { key: 'ungrouped-label', className: 'bw-header-title', style: { padding: '10px 6px 2px' } }, t('group.ungrouped')))
          for (const s of ungrouped) bodyRows.push(renderSessionRow(s, 0))
        }
      }
      const isEmpty = bodyRows.length === 0
      if (isEmpty) {
        bodyRows = [E('div', { key: 'empty', className: 'bw-empty' }, searching ? t('empty.search') : (phase === 'pending' ? '…' : t('empty')))]
      }

      /* ------------------------- context menu ------------------------ */

      const ctxItems = () => {
        if (ctx === null) return []
        if (ctx.kind === 'folder') {
          const items = [
            { id: 'new-subfolder', label: t('menu.newSubfolder') },
            { id: 'new-subworkspace', label: t('menu.newSubWorkspace') },
            { id: 'rename-folder', label: t('menu.renameFolder') },
          ]
          if (storeFolders.includes(ctx.payload.path)) items.push({ id: 'remove-folder', label: t('menu.removeFolder'), danger: true })
          items.push({ sep: true })
          items.push({ id: 'customize', label: t('custom.title') })
          return items
        }
        if (ctx.kind === 'workspace') return [
          { id: 'rename', label: t('menu.rename') },
          { id: 'delete', label: t('menu.delete'), danger: true },
          { sep: true },
          { id: 'customize', label: t('custom.title') },
        ]
        if (ctx.kind === 'session') return [
          { id: 'rename', label: t('menu.rename') },
          { id: 'fork', label: t('menu.fork') },
          { id: 'archive', label: t('menu.archive'), danger: true },
          { sep: true },
          { id: 'customize', label: t('custom.title') },
        ]
        return [
          { id: 'rename-sgroup', label: t('menu.renameSgroup') },
          { sep: true },
          { id: 'customize', label: t('custom.title') },
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
        if (kind === 'folder' && id === 'new-subfolder') setDialog({ kind: 'folder-new', parentPath: payload.path })
        else if (kind === 'folder' && id === 'new-subworkspace') { setFlowParent(payload.path); setFlowOpen(true) }
        else if (kind === 'folder' && id === 'rename-folder') setDialog({ kind: 'folder-rename', path: payload.path })
        else if (kind === 'folder' && id === 'remove-folder') setDialog({ kind: 'folder-delete', path: payload.path })
        else if (kind === 'workspace' && id === 'rename') setDialog({ kind: 'ws-rename', workspace: payload })
        else if (kind === 'workspace' && id === 'delete') setDialog({ kind: 'ws-delete', workspace: payload })
        else if (kind === 'sgroup' && id === 'rename-sgroup') setDialog({ kind: 'sgroup-rename', target: payload })
        else if (kind === 'session' && id === 'rename') setDialog({ kind: 'sess-rename', session: payload })
        else if (kind === 'session' && id === 'fork') forkSession(payload.id)
        else if (kind === 'session' && id === 'archive') { Promise.resolve().then(() => archiveSession(payload.id)).catch(fail) }
      }

      /* --------------------------- dialogs --------------------------- */
      // TextDialog / ConfirmDialog are module-level components: a per-render
      // inline definition would remount on every parent tick and drop input.

      /* ---------------------------- render --------------------------- */

      if (!wide) {
        return E('div', { className: 'bw-rail' },
          StyleNode(),
          E('button', { type: 'button', className: 'bw-rail-btn', 'aria-label': t('rail.search'), onClick: () => { expandSidebar(); setSearchOpen(true) } }, icon('IconSearchOutline16', 18)),
          E('button', { type: 'button', className: 'bw-rail-btn', 'aria-label': t('rail.add'), onClick: () => { expandSidebar(); setFlowParent(''); setFlowOpen(true) } }, icon('IconProjectAddOutline16', 18)),
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
          initial: dialog.parentPath ? dialog.parentPath + '/' : '',
          onConfirm: (v) => submitFolderNew(dialog.parentPath || '', v),
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
          E('button', { type: 'button', className: 'bw-icon-btn', 'aria-label': t('add'), onClick: () => { setFlowParent(''); setFlowOpen(true) } }, icon('IconProjectAddOutline16')),
        ),
        E('div', { ref: treeRef, className: 'bw-tree', role: 'tree', 'aria-label': t('title') }, bodyRows),
        E(BetterFlow, {
          open: flowOpen,
          busy: false,
          initialParent: flowParent,
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
        ctx !== null ? E('div', {
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
            ctxItems().map((item, index) => item.sep
              ? E('div', { key: 'sep-' + index, className: 'bw-ctx-sep' })
              : E('button', {
                key: item.id,
                type: 'button',
                className: cls('bw-ctx-item', item.danger && 'bw-ctx-danger'),
                onClick: () => handleCtxPick(item.id),
              }, item.label),
            ),
          ),
        ) : null,
        E(CustomizeDialog, {
          open: customize !== null,
          kind: customize ? customize.kind : undefined,
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

    function apply(ctx) {
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
        // Official contract exposes session reorder through the WORKSPACES
        // service (see dsh ui-workspace client index.ts); feature-probed so
        // older hosts degrade to "group-move only" instead of a TypeError.
        insertSessionBefore: typeof workspaces.insertSessionBefore === 'function'
          ? (workspaceId, sessionId, beforeSessionId) => workspaces.insertSessionBefore(workspaceId, sessionId, beforeSessionId)
          : undefined,
        archiveSession: (sessionId) => uiWorkspace.archiveSession(sessionId),
        createWorkspace: (input) => workspaces.create(input),
        pickDirectory: () => uiWorkspace.pickDirectory(),
        hooks: {
          directoryFlow: flowSource(slots, 'sidebar.workspaces.directoryFlow'),
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
      // Since dsh 0.1.2-alpha.1 the shell's own directory picker occupies each
      // hole at priority 0, so shadow at -1 (ascending, lowest renders) exactly
      // like the sidebar.workspaces browser below.
      slots.inject('conversation.hero.workspace.directoryFlow', guarded(
        'conversation.hero.workspace.directoryFlow',
        { name: 'conversation.hero.workspace.directoryFlow', inject: flowInjected('conversation.hero.workspace.directoryFlow'), locale: NS, priority: -1 },
        BetterFlow,
      ))
      slots.inject('sidebar.workspaces.directoryFlow', guarded(
        'sidebar.workspaces.directoryFlow',
        { name: 'sidebar.workspaces.directoryFlow', inject: flowInjected('sidebar.workspaces.directoryFlow'), locale: NS, priority: -1 },
        BetterFlow,
      ))

      // One shared store handle: the browser and the settings page must see the
      // same persisted state (expansion, folder list, prefs, styling).
      const viewStore = createViewStore()

      // Cold-restart title fallback (see the title-cache block). Hydration
      // reads localStorage synchronously here, before the first render, so a
      // restart's first tree already shows every remembered title.
      loadTitleCache()
      titleCacheRef = { getSnapshot: () => titleCache, rememberAllTitles }

      // Cross-device settings scope (manual sync, see the host-settings-sync
      // block). Binding is best-effort: a missing/failed bind leaves the
      // plugin fully browser-local — the pre-0.9.5 behavior.
      prefsScopeRef = null
      try {
        if (ctx.settingsScope && typeof ctx.settingsScope.bind === 'function') {
          prefsScopeRef = ctx.settingsScope.bind({ namespace: 'better-workspace' })
        }
      } catch (error) {
        console.warn('[dsh-better-workspace] settings scope bind failed; sync stays local', error)
        prefsScopeRef = null
      }

      // Settings → Plugins card only (the tab dispatches the intersection of
      // served namespaces — registered host-side — and settings.plugin.item
      // cards). The old left-nav settings.section entry was removed: the
      // plugins-section card is the single settings surface now.
      slots.inject('settings.plugin.item', guarded(
        'settings.plugin.item',
        {
          name: 'settings.plugin.item',
          key: 'better-workspace',
          locale: NS,
          store: viewStore,
        },
        BetterWorkspacePluginCard,
      ))

      // 3. the browser itself — lowest priority renders, shadowing the shipped entry.
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
    }

    return {
      name: 'dsh-better-workspace',
      inject: ['slots', 'sessions', 'workspaces', 'locale', 'uiWorkspace', 'settingsScope'],
      apply,
    }
  },
})
