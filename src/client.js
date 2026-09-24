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
 *  2. settings.plugin.item (Settings → Plugins card) and
 *     plugins.bundle.config (the Plugins panel's bundle page, dsh
 *     0.1.6-alpha.2+; keyed by package name): the settings card, one seat
 *     per host era — a seat whose slot is never declared never registers.
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
        'viewOptions.label': '视图选项',
        'viewOptions.groupBy': '分组方式',
        'viewOptions.byWorkspace': '按工作区',
        'viewOptions.byWorkspaceTree': '按工作区树',
        'viewOptions.flat': '单列表',
        'viewOptions.orderBy': '排序方式',
        'viewOptions.manualOrder': '手动排序',
        'viewOptions.updatedOrder': '最近更新',
        'viewOptions.sessionSlash': '会话按"/"分组',
        'viewOptions.wsGroupBy': "工作区分组",
        'viewOptions.wsByDisk': "磁盘目录",
        'viewOptions.wsByDiskSlash': "磁盘 + 名称",
        'viewOptions.wsBySlash': "仅名称",
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
      'menu.renameFolder': '重命名分组',
      'menu.renameSgroup': '重命名会话分组',
      'menu.moveToGroup': '移动到分组…',
      'menu.moveOutGroup': '移出分组',
      'settings.title': '更好的工作区',
      'settings.desc': '工作区树的外观与折叠偏好',
      'settings.expand': '展开',
      'settings.collapse': '收起',
      'settings.compactChains': '单链分组折叠显示',
      'settings.compactChains.hint': '单层链合并为一行,出现多个子级时自动展开为树状;拖拽工作区期间单链临时展开回文件夹树,可放入任意一级;展开状态与自定义外观保存在当前浏览器。',
      'settings.statusPulse': '状态呼吸灯',
      'settings.statusPulse.hint': '被折叠藏起的状态灯(完成绿 / 运行蓝 / 待交互琥珀)沿层级向外冒泡:工作区与分组行以图标呼吸发光(颜色随状态,自定义过发光的标题一起呼吸),会话分组行显示呼吸状态灯;默认开启,可在此关闭。',
      'settings.workspaceGroup': "工作区分组",
      'settings.workspaceGroup.hint': "磁盘目录 = 只按官方文件夹(磁盘目录)嵌套;磁盘 + 名称 = 在磁盘层之上再按标题里的 / 分组;仅名称 = 只按标题里的 / 分组,完全不理会磁盘目录的嵌套关系。旧版本的开关状态会自动迁移。",
      'settings.sessionLimit': "展开时显示会话数",
      'settings.sessionLimit.all': "全部",
      'settings.sessionLimit.hint': "展开工作区时先只显示最近的部分会话,其余收进「展开 {n} 个会话」一行,点击展开该组全部;置顶、进行中和等待你的会话始终显示。全部 = 不限量(默认)。",
      'settings.sessionMenu': "会话右键菜单",
      'settings.sessionMenu.hint': "开启时右键点击会话行即可打开操作菜单(包含官方的置顶、归档、停止并归档等);关闭后改为在行尾悬停显示官方样式的 ⋯ 按钮,点击打开同一个菜单。默认开启。",
      'settings.rowActions': "会话行悬停按钮",
      'settings.rowActions.hint': "悬停会话行时在行尾显示置顶 / 归档快捷按钮,与官方行保持一致;关闭后这些动作只保留在菜单里。默认开启。",
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
      'sync.desc': "外观自定义与开关保存在本设备的浏览器里;通过宿主设置存储与另一端互传。平时的新修改会自动写入宿主,另一端点「获取」即可拿到;旧版本的历史数据首次需要点一次「发送」。",
      'sync.mode.overwrite': '覆盖本设备',
      'sync.mode.merge': '合并两端',
      'sync.pull.desktop': '从客户端获取',
      'sync.pull.web': '从 Web 获取',
      'sync.push': '发送本设备数据',
      'sync.done': '已同步',
      'sync.empty': '另一端暂无数据可获取',
      'sync.off': '当前环境不支持同步(需要宿主设置服务)',
      'sync.loading': '正在连接宿主设置…',
      'flow.creating': '正在创建…',
      'add.guide.title': "应用内添加工作区",
      'add.guide': "此主机不提供桌面目录选择器。请到「新会话」页,用官方的「添加工作区」打开应用内浏览器。",
      'heroPicker.error.title': "无法添加工作区",
      'heroPicker.retry': "重试",
      'error.title': '出错了',
      'cancel': '取消',
      'create': '创建',
      'confirm': '确定',
      'close': '关闭',
      'ws.rename.title': '重命名工作区',
      'ws.rename.hint': '名称中的 / 即层级分组,例如 web/前端',
      'ws.delete.title': '删除工作区',
      'ws.delete.body': '仅移除工作区登记,目录和会话记录都会保留。确定删除「{name}」?',
      'folder.rename.title': '重命名分组',
      'folder.rename.hint': '重命名会同步更新组内所有工作区名称',
      'folder.error.empty': '分组路径不能为空',
      'group.move.title': '移动到分组',
      'group.pick': '选择已有分组',
      'group.new': '新建分组',
      'group.new.title': "新建分组",
      'group.new.sess': "会话分组",
      'group.new.ws': "工作区分组",
      'group.new.both': "新建会话或工作区分组",
      'group.new.where': "选择创建位置",
      'group.new.placeholder': "分组名称,可用 / 嵌套",
      'group.new.nameHint': "名称中的 / 即嵌套层级,例如 前端/组件",
      'group.new.empty': "请输入分组名称",
      'group.new.root': "顶层",
      'group.new.independent': "新建顶层分组",
      'group.new.pickWorkspace': "选择一个工作区",
      'group.new.noWorkspace': "还没有工作区,请先添加一个",
      'group.new.pickFirst': "请先选择一个工作区",
      'group.delete.title': "删除分组",
      'group.delete.body': "「{name}」是空分组,删除后不可恢复。",
      'menu.deleteGroup': "删除分组",
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
        'viewOptions.label': 'View options',
        'viewOptions.groupBy': 'Group by',
        'viewOptions.byWorkspace': 'Workspaces',
        'viewOptions.byWorkspaceTree': 'Workspace tree',
        'viewOptions.flat': 'In one list',
        'viewOptions.orderBy': 'Order by',
        'viewOptions.manualOrder': 'Manual',
        'viewOptions.updatedOrder': 'Last updated',
        'viewOptions.sessionSlash': 'Group sessions by "/"',
        'viewOptions.wsGroupBy': "Group workspaces",
        'viewOptions.wsByDisk': "Disk folders",
        'viewOptions.wsByDiskSlash': "Disk + names",
        'viewOptions.wsBySlash': "Names only",
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
      'menu.renameFolder': 'Rename folder',
      'menu.renameSgroup': 'Rename session group',
      'menu.moveToGroup': 'Move to group…',
      'menu.moveOutGroup': 'Move out of group',
      'settings.title': 'Better Workspaces',
      'settings.desc': 'Workspace tree appearance and folding preferences',
      'settings.expand': 'Expand',
      'settings.collapse': 'Collapse',
      'settings.compactChains': 'Merge single-child chains',
      'settings.compactChains.hint': 'Single-child chains merge into one row; levels with multiple children expand as a tree. Chains re-expand into folder rows while you drag a workspace, so it can drop into any level. State and custom styling persist in this browser.',
      'settings.statusPulse': 'Status breathing light',
      'settings.statusPulse.hint': 'Status dots hidden by collapse (done green / running blue / pending amber) bubble outward: workspace and folder rows breathe on their icon in the status color (custom-glow labels breathe along), session-group rows show a breathing dot; on by default, turn it off here.',
      'settings.workspaceGroup': "Workspace grouping",
      'settings.workspaceGroup.hint': "Disk folders: nest only by the official folders (disk directories). Disk + names: layer slash-name groups on top of the disk tree. Names only: group purely by slashes in titles and ignore disk nesting entirely. A previous version's switch state migrates automatically.",
      'settings.sessionLimit': "Sessions shown when expanded",
      'settings.sessionLimit.all': "All",
      'settings.sessionLimit.hint': "An expanded workspace first shows only its most recent sessions, the rest behind one Show-more row; pinned, running and waiting-for-you sessions always stay visible. All = no limit (default).",
      'settings.sessionMenu': "Session context menu",
      'settings.sessionMenu.hint': "On: right-click a session row to open its action menu (including the official pin, archive, and stop-and-archive). Off: the row shows the official-style ⋯ button on hover instead, opening the same menu. On by default.",
      'settings.rowActions': "Session row hover buttons",
      'settings.rowActions.hint': "Show pin / archive quick buttons at the end of a hovered session row, matching the official rows. Off: these actions stay in the menu only. On by default.",
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
      'sync.desc': "Appearance customization and toggles live in this device's browser; they exchange with the other surface (web / desktop app) through the host settings store. New edits are written to the host automatically — the other surface just pulls. History created before this version needs one explicit Send.",
      'sync.mode.overwrite': 'Overwrite this device',
      'sync.mode.merge': 'Merge both sides',
      'sync.pull.desktop': 'Pull from desktop app',
      'sync.pull.web': 'Pull from web',
      'sync.push': "Send this device's data",
      'sync.done': 'Synced',
      'sync.empty': 'No data on the other surface yet',
      'sync.off': 'Sync unavailable here (requires the host settings service)',
      'sync.loading': 'Connecting to host settings…',
      'flow.creating': 'Creating…',
      'add.guide.title': "Add workspace in-app",
      'add.guide': "This host has no desktop directory chooser. Use the official \"Add workspace\" entry on the New Session page.",
      'heroPicker.error.title': "Could not add workspace",
      'heroPicker.retry': "Retry",
      'error.title': 'Something went wrong',
      'cancel': 'Cancel',
      'create': 'Create',
      'confirm': 'OK',
      'close': 'Close',
      'ws.rename.title': 'Rename workspace',
      'ws.rename.hint': 'Use / inside the name to nest, e.g. web/frontend',
      'ws.delete.title': 'Delete workspace',
      'ws.delete.body': 'Only the workspace registration is removed; the directory and session logs remain. Delete "{name}"?',
      'folder.rename.title': 'Rename folder',
      'folder.rename.hint': 'Renaming updates every workspace title inside the folder',
      'folder.error.empty': 'Folder path must not be empty',
      'group.move.title': 'Move to group',
      'group.pick': 'Pick an existing group',
      'group.new': 'New group',
      'group.new.title': "New group",
      'group.new.sess': "Session group",
      'group.new.ws': "Workspace group",
      'group.new.both': "New session or workspace group",
      'group.new.where': "Choose where to create it",
      'group.new.placeholder': "Group name, \"/\" nests",
      'group.new.nameHint': "A \"/\" nests further, e.g. frontend/components",
      'group.new.empty': "Enter a group name",
      'group.new.root': "Top level",
      'group.new.independent': "New top-level group",
      'group.new.pickWorkspace': "Pick a workspace",
      'group.new.noWorkspace': "No workspaces yet — add one first",
      'group.new.pickFirst': "Pick a workspace first",
      'group.delete.title': "Delete group",
      'group.delete.body': "\"{name}\" is an empty group; deleting it cannot be undone.",
      'menu.deleteGroup': "Delete group",
    }

    /* Third-language dictionaries, keyed by BCP 47 tag. Every entry must carry
       the SAME key set as zh: a key missing here falls back to English at
       lookup time, which is exactly the silent half-translated panel that
       tests/smoke.mjs refuses. This plugin does not resolve dictionaries
       itself — `t` arrives as a slot seat bound to NS by the host renderer,
       so one entry below is all a new language needs. */
    const LOCALES = {
      /* locale: ar */
      'ar': {
        'title': 'مساحات العمل',
        'search.placeholder': 'ابحث في مساحات العمل أو الجلسات',
        'add': 'إضافة مساحة عمل',
        'rail.search': 'بحث',
        'rail.add': 'إضافة مساحة عمل',
        'empty': 'لا توجد مساحات عمل بعد',
        'empty.search': 'لا توجد نتائج مطابقة',
        'session.new': 'جلسة جديدة',
        'viewOptions.label': 'خيارات العرض',
        'viewOptions.groupBy': 'التجميع حسب',
        'viewOptions.byWorkspace': 'مساحات العمل',
        'viewOptions.byWorkspaceTree': 'شجرة مساحات العمل',
        'viewOptions.flat': 'قائمة واحدة',
        'viewOptions.orderBy': 'الترتيب حسب',
        'viewOptions.manualOrder': 'يدوي',
        'viewOptions.updatedOrder': 'آخر تحديث',
        'viewOptions.sessionSlash': 'تجميع الجلسات حسب "/"',
        'viewOptions.wsGroupBy': "تجميع مساحات العمل",
        'viewOptions.wsByDisk': "مجلدات القرص",
        'viewOptions.wsByDiskSlash': "القرص + الأسماء",
        'viewOptions.wsBySlash': "الأسماء فقط",
        'group.ungrouped': 'بلا مجموعة',
        'sessions.expand': 'عرض {n} جلسات إضافية',
        'sessions.collapse': 'طيّ',
        'time.now': 'الآن',
        'time.minutes': '{n} دقيقة',
        'time.hours': '{n} ساعة',
        'time.days': '{n} يوم',
        'time.months': '{n} شهر',
        'time.years': '{n} سنة',
        'status.running': 'قيد التوليد',
        'status.completed': 'مكتمل',
        'status.approval': 'بانتظار الموافقة',
        'status.planReview': 'بانتظار تأكيد الخطة',
        'status.question': 'بانتظار الرد',
        'status.subagents': '{n} من الوكلاء الفرعيين قيد التشغيل',
        'schedule.active': 'توجد مهمة مجدولة نشطة',
        'menu.rename': 'إعادة التسمية',
        'menu.delete': 'حذف',
        'menu.fork': 'تفريع',
        'menu.archive': 'أرشفة',
        'menu.renameFolder': 'إعادة تسمية المجلد',
        'menu.renameSgroup': 'إعادة تسمية مجموعة الجلسات',
        'menu.moveToGroup': 'نقل إلى مجموعة…',
        'menu.moveOutGroup': 'إخراج من المجموعة',
        'settings.title': 'مساحات عمل أفضل',
        'settings.desc': 'مظهر شجرة مساحات العمل وتفضيلات الطيّ',
        'settings.expand': 'توسيع',
        'settings.collapse': 'طيّ',
        'settings.compactChains': 'دمج السلاسل ذات الفرع الواحد',
        'settings.compactChains.hint': 'تُدمج المستويات ذات الفرع الواحد في سطر واحد، وتتوسع الشجرة تلقائياً عند وجود أكثر من فرع؛ أثناء سحب مساحة عمل تُفكّ السلاسل مؤقتاً إلى مجلدات ليصبح الإفلات ممكناً في أي مستوى؛ تُحفظ حالة التوسيع والمظهر المخصص في هذا المتصفح.',
        'settings.statusPulse': 'مؤشر حالة نابض',
        'settings.statusPulse.hint': 'مؤشرات الحالة التي يخفيها الطيّ (مكتمل أخضر / قيد التشغيل أزرق / بانتظار تفاعل كهرماني) تتصاعد عبر المستويات: تصدر أسطر مساحات العمل والمجلدات وميضاً نابضاً للأيقونة بلون الحالة (وتنبض معها العناوين ذات التوهج المخصص)، وتعرض أسطر مجموعات الجلسات نقطة حالة نابضة؛ مفعّل افتراضياً ويمكن إيقافه هنا.',
        'settings.workspaceGroup': "تجميع مساحات العمل",
        'settings.workspaceGroup.hint': "مجلدات القرص: التداخل حسب المجلدات الرسمية (أدلة القرص) فقط. القرص + الأسماء: إضافة مجموعات الأسماء بشرطة مائلة فوق شجرة القرص. الأسماء فقط: التجميع بحسب الشرطة المائلة في العناوين وتجاهل تداخل القرص تماماً. تُنقل حالة مفتاح الإصدار السابق تلقائياً.",
        'settings.sessionLimit': "عدد الجلسات عند التوسيع",
        'settings.sessionLimit.all': "الكل",
        'settings.sessionLimit.hint': "تعرض مساحة العمل الموسعة أحدث الجلسات أولاً، والبقية خلف سطر عرض المزيد؛ الجلسات المثبتة والجارية والمنتظرة لك تبقى مرئية دائماً. الكل = بلا حد (افتراضي).",
        'settings.sessionMenu': "قائمة النقر الأيمن للجلسة",
        'settings.sessionMenu.hint': "عند التفعيل: انقر بزر الفأرة الأيمن على سطر الجلسة لفتح قائمة الإجراءات (بما في ذلك التثبيت والأرشفة الرسمية). عند الإيقاف: يظهر زر ⋯ بأسلوب رسمي عند تمرير المؤشر يفتح القائمة نفسها. مفعّل افتراضياً.",
        'settings.rowActions': "أزرار تمرير سطر الجلسة",
        'settings.rowActions.hint': "إظهار أزرار التثبيت / الأرشفة السريعة في نهاية سطر الجلسة عند تمرير المؤشر، مطابقة للأسطر الرسمية. عند الإيقاف: تبقى هذه الإجراءات في القائمة فقط. مفعّل افتراضياً.",
        'settings.appearance': 'المظهر الافتراضي',
        'settings.appearance.hint': 'تستخدم الأسطر غير المخصصة هذا المظهر؛ حدّ النص مفعّل افتراضياً — فبدونه يصعب قراءة النص فوق صورة خلفية. اترك اللون فارغاً لاتباع السمة.',
        'settings.appearance.reset': 'استعادة المظهر الافتراضي',
        'custom.title': 'تخصيص المظهر',
        'custom.color': 'اللون',
        'custom.glow': 'التوهج',
        'custom.preview': 'معاينة مباشرة',
        'custom.preview.sample': 'مساحة عمل نموذجية',
        'custom.weight': 'سماكة الخط',
        'custom.weight.regular': 'عادي',
        'custom.weight.medium': 'متوسط',
        'custom.weight.semibold': 'شبه عريض',
        'custom.weight.bold': 'عريض',
        'custom.shadow': 'ظل النص',
        'custom.stroke': 'حدّ النص',
        'custom.stroke.hint': 'الحدّ رمادي افتراضياً؛ يمكن اختيار الأسود / الأبيض / أي لون، أو «تلقائي» لاشتقاق اللون المتباين من لون النص (النص الفاتح بحدّ أسود والغامق بحدّ أبيض)؛ يتبع الوضع التلقائي السمة وتبدّل الوضع الفاتح/الداكن في إضافة الخلفية.',
        'custom.strokeWidth': 'سماكة الحدّ',
        'custom.strokeColor': 'لون الحدّ',
        'custom.strokeColor.auto': 'تلقائي',
        'custom.weak': 'ضعيف',
        'custom.medium': 'متوسط',
        'custom.strong': 'قوي',
        'custom.icon': 'الأيقونة',
        'custom.icon.solid': 'مجلد ممتلئ',
        'custom.icon.outline': 'مجلد مفرّغ',
        'custom.icon.none': 'مخفية',
        'custom.none': 'بلا',
        'custom.reset': 'مسح التخصيص',
        'custom.done': 'تم',
        'settings.on': 'تشغيل',
        'settings.off': 'إيقاف',
        'sync.title': 'المزامنة بين الأجهزة',
      'sync.desc': "يعيش تخصيص المظهر والمفاتيح في متصفح هذا الجهاز، ويجري تبادلها مع الطرف الآخر (الويب / تطبيق سطح المكتب) عبر مخزن إعدادات المضيف. تُكتب التعديلات الجديدة في المضيف تلقائياً، ويكفي أن يضغط الطرف الآخر «جلب»؛ أما بيانات الإصدارات القديمة فتحتاج ضغطة «إرسال» واحدة.",
        'sync.mode.overwrite': 'الكتابة فوق هذا الجهاز',
        'sync.mode.merge': 'دمج الطرفين',
        'sync.pull.desktop': 'الجلب من تطبيق سطح المكتب',
        'sync.pull.web': 'الجلب من الويب',
        'sync.push': 'إرسال بيانات هذا الجهاز',
        'sync.done': 'تمت المزامنة',
        'sync.empty': 'لا توجد بيانات لدى الطرف الآخر بعد',
        'sync.off': 'المزامنة غير متاحة هنا (تحتاج خدمة إعدادات المضيف)',
        'sync.loading': 'الاتصال بإعدادات المضيف…',
        'flow.creating': 'جارٍ الإنشاء…',
        'add.guide.title': "إضافة مساحة عمل داخل التطبيق",
        'add.guide': "لا يوفر هذا المضيف منتقي مجلدات سطح المكتب. استخدم إدخال \"إضافة مساحة عمل\" الرسمي في صفحة الجلسة الجديدة.",
        'heroPicker.error.title': "تعذر إضافة مساحة العمل",
        'heroPicker.retry': "إعادة المحاولة",
        'error.title': 'حدث خطأ ما',
        'cancel': 'إلغاء',
        'create': 'إنشاء',
        'confirm': 'موافق',
        'close': 'إغلاق',
        'ws.rename.title': 'إعادة تسمية مساحة العمل',
        'ws.rename.hint': 'الشرطة المائلة / في الاسم تصنع مستوى المجموعة، مثل web/frontend',
        'ws.delete.title': 'حذف مساحة العمل',
        'ws.delete.body': 'يُزال تسجيل مساحة العمل فقط؛ يبقى الدليل وسجلات الجلسات. هل تريد حذف «{name}»؟',
        'folder.rename.title': 'إعادة تسمية المجموعة',
        'folder.rename.hint': 'تحديث الاسم يعيد تسمية كل مساحات العمل داخل المجموعة',
        'folder.error.empty': 'لا يمكن أن يكون مسار المجموعة فارغاً',
        'group.move.title': 'نقل إلى مجموعة',
        'group.pick': 'اختر مجموعة موجودة',
        'group.new': 'مجموعة جديدة',
        'group.new.title': "مجموعة جديدة",
        'group.new.sess': "مجموعة جلسات",
        'group.new.ws': "مجموعة مساحات عمل",
        'group.new.both': "مجموعة جلسات أو مساحات عمل جديدة",
        'group.new.where': "اختر مكان الإنشاء",
        'group.new.placeholder': "اسم المجموعة، \"/\" للتداخل",
        'group.new.nameHint': "الشرطة المائلة \"/\" تنشئ مستوى أعمق، مثل frontend/components",
        'group.new.empty': "أدخل اسم المجموعة",
        'group.new.root': "المستوى الأعلى",
        'group.new.independent': "مجموعة جديدة في المستوى الأعلى",
        'group.new.pickWorkspace': "اختر مساحة عمل",
        'group.new.noWorkspace': "لا توجد مساحات عمل بعد — أضف واحدة أولاً",
        'group.new.pickFirst': "اختر مساحة عمل أولاً",
        'group.delete.title': "حذف المجموعة",
        'group.delete.body': "\"{name}\" مجموعة فارغة؛ لا يمكن التراجع عن الحذف.",
        'menu.deleteGroup': "حذف المجموعة",
      },
      /* locale: de */
      'de': {
        'title': 'Arbeitsbereiche',
        'search.placeholder': 'Arbeitsbereiche oder Sitzungen suchen',
        'add': 'Arbeitsbereich hinzufügen',
        'rail.search': 'Suchen',
        'rail.add': 'Arbeitsbereich hinzufügen',
        'empty': 'Noch keine Arbeitsbereiche',
        'empty.search': 'Keine Treffer',
        'session.new': 'Neue Sitzung',
        'viewOptions.label': 'Ansichtsoptionen',
        'viewOptions.groupBy': 'Gruppieren',
        'viewOptions.byWorkspace': 'Arbeitsbereiche',
        'viewOptions.byWorkspaceTree': 'Arbeitsbereichsbaum',
        'viewOptions.flat': 'In einer Liste',
        'viewOptions.orderBy': 'Sortieren',
        'viewOptions.manualOrder': 'Manuell',
        'viewOptions.updatedOrder': 'Zuletzt aktualisiert',
        'viewOptions.sessionSlash': 'Sitzungen nach "/" gruppieren',
        'viewOptions.wsGroupBy': "Arbeitsbereiche gruppieren",
        'viewOptions.wsByDisk': "Ordner",
        'viewOptions.wsByDiskSlash': "Ordner + Namen",
        'viewOptions.wsBySlash': "Nur Namen",
        'group.ungrouped': 'Ohne Gruppe',
        'sessions.expand': '{n} Sitzungen einblenden',
        'sessions.collapse': 'Einklappen',
        'time.now': 'gerade eben',
        'time.minutes': '{n} Min.',
        'time.hours': '{n} Std.',
        'time.days': '{n} T.',
        'time.months': '{n} Mon.',
        'time.years': '{n} J.',
        'status.running': 'Wird generiert',
        'status.completed': 'Abgeschlossen',
        'status.approval': 'Wartet auf Freigabe',
        'status.planReview': 'Wartet auf Planprüfung',
        'status.question': 'Wartet auf Antwort',
        'status.subagents': '{n} Unteragenten aktiv',
        'schedule.active': 'Aktive geplante Aufgabe',
        'menu.rename': 'Umbenennen',
        'menu.delete': 'Löschen',
        'menu.fork': 'Abzweigen',
        'menu.archive': 'Archivieren',
        'menu.renameFolder': 'Ordner umbenennen',
        'menu.renameSgroup': 'Sitzungsgruppe umbenennen',
        'menu.moveToGroup': 'In Gruppe verschieben…',
        'menu.moveOutGroup': 'Aus der Gruppe entfernen',
        'settings.title': 'Bessere Arbeitsbereiche',
        'settings.desc': 'Aussehen und Einklappverhalten des Arbeitsbereich-Baums',
        'settings.expand': 'Ausklappen',
        'settings.collapse': 'Einklappen',
        'settings.compactChains': 'Einzelketten zusammenfassen',
        'settings.compactChains.hint': 'Ebenen mit genau einem Kind werden zu einer Zeile zusammengefasst; bei mehreren Kindern klappt der Baum auf; beim Ziehen eines Arbeitsbereichs klappen die Ketten vorübergehend zum Ordnerbaum auf, sodass jede Ebene als Ziel dient; Klappzustand und eigenes Aussehen bleiben in diesem Browser gespeichert.',
        'settings.statusPulse': 'Status-Pulslicht',
        'settings.statusPulse.hint': 'Vom Einklappen verdeckte Statuspunkte (fertig grün / läuft blau / wartet amber) steigen die Hierarchie hinauf: Arbeitsbereich- und Ordnerzeilen lassen ihr Symbol in der Statusfarbe pulsieren (eigens gefärbte Titel pulsieren mit), Sitzungsgruppen zeigen einen pulsierenden Statuspunkt; standardmäßig an, hier abschaltbar.',
        'settings.workspaceGroup': "Arbeitsbereich-Gruppierung",
        'settings.workspaceGroup.hint': "Ordner: verschachtelt nur nach den offiziellen Ordnern (Festplattenpfade). Ordner + Namen: schichtet Namensgruppen über den Ordnerbaum. Nur Namen: gruppiert rein nach Schrägstrichen im Titel und ignoriert die Festplatten-Verschachtelung. Ein früherer Schalterzustand wandert automatisch mit.",
        'settings.sessionLimit': "Sitzungen beim Aufklappen",
        'settings.sessionLimit.all': "Alle",
        'settings.sessionLimit.hint': "Ein aufgeklappter Arbeitsbereich zeigt zuerst nur die neuesten Sitzungen, der Rest hinter einer Mehr-anzeigen-Zeile; angeheftete, laufende und auf Sie wartende Sitzungen bleiben immer sichtbar. Alle = unbegrenzt (Standard).",
        'settings.sessionMenu': "Sitzungs-Kontextmenü",
        'settings.sessionMenu.hint': "Ein: Rechtsklick auf eine Sitzungszeile öffnet das Aktionsmenü (inklusive offiziellem Anheften, Archivieren und Stoppen-und-Archivieren). Aus: beim Daraufzeigen erscheint stattdessen der offizielle ⋯-Knopf am Zeilenende und öffnet dasselbe Menü. Standardmäßig ein.",
        'settings.rowActions': "Sitzungszeilen-Schnellknöpfe",
        'settings.rowActions.hint': "Zeigt beim Daraufzeigen Schnellknöpfe zum Anheften / Archivieren am Zeilenende – wie die offiziellen Zeilen. Aus: diese Aktionen bleiben nur im Menü. Standardmäßig ein.",
        'settings.appearance': 'Standardaussehen',
        'settings.appearance.hint': 'Zeilen ohne eigene Anpassung nutzen dieses Aussehen; die Textkontur ist standardmäßig an – ohne sie ist Text über einem Hintergrundbild oft kaum lesbar. Bleibt die Farbe leer, folgt sie dem Thema.',
        'settings.appearance.reset': 'Standard wiederherstellen',
        'custom.title': 'Aussehen anpassen',
        'custom.color': 'Farbe',
        'custom.glow': 'Leuchten',
        'custom.preview': 'Live-Vorschau',
        'custom.preview.sample': 'Beispiel-Arbeitsbereich',
        'custom.weight': 'Schriftstärke',
        'custom.weight.regular': 'Normal',
        'custom.weight.medium': 'Mittel',
        'custom.weight.semibold': 'Halbfett',
        'custom.weight.bold': 'Fett',
        'custom.shadow': 'Textschatten',
        'custom.stroke': 'Textkontur',
        'custom.stroke.hint': 'Die Kontur ist standardmäßig grau; wählbar sind Schwarz / Weiß / eine beliebige Farbe oder „Automatisch“, das aus der Textfarbe den Gegenpol ableitet (helle Schrift bekommt eine schwarze Kante, dunkle eine weiße); Automatik folgt dem Hell/Dunkel des Themas und eines Hintergrund-Plugins.',
        'custom.strokeWidth': 'Konturstärke',
        'custom.strokeColor': 'Konturfarbe',
        'custom.strokeColor.auto': 'Automatisch',
        'custom.weak': 'Schwach',
        'custom.medium': 'Mittel',
        'custom.strong': 'Stark',
        'custom.icon': 'Symbol',
        'custom.icon.solid': 'Gefüllter Ordner',
        'custom.icon.outline': 'Umriss-Ordner',
        'custom.icon.none': 'Ausgeblendet',
        'custom.none': 'Keins',
        'custom.reset': 'Anpassung entfernen',
        'custom.done': 'Fertig',
        'settings.on': 'An',
        'settings.off': 'Aus',
        'sync.title': 'Geräteübergreifende Synchronisierung',
      'sync.desc': "Erscheinungsbild-Anpassungen und Schalter leben im Browser dieses Geräts; sie werden über den Host-Einstellungsspeicher mit der anderen Oberfläche (Web / Desktop-App) ausgetauscht. Neue Änderungen werden automatisch zum Host geschrieben — die andere Oberfläche ruft sie nur ab. Vor dieser Version entstandene Daten brauchen einmaliges Senden.",
        'sync.mode.overwrite': 'Dieses Gerät überschreiben',
        'sync.mode.merge': 'Beide Seiten zusammenführen',
        'sync.pull.desktop': 'Von der Desktop-App abrufen',
        'sync.pull.web': 'Aus dem Web abrufen',
        'sync.push': 'Daten dieses Geräts senden',
        'sync.done': 'Synchronisiert',
        'sync.empty': 'Auf der anderen Seite liegen noch keine Daten',
        'sync.off': 'Hier nicht verfügbar (erfordert den Host-Einstellungsdienst)',
        'sync.loading': 'Verbindung zum Host-Einstellungsspeicher…',
        'flow.creating': 'Wird erstellt…',
        'add.guide.title': "Arbeitsbereich in der App hinzufügen",
        'add.guide': "Dieser Host bietet keinen Desktop-Ordnerdialog. Nutze den offiziellen Eintrag „Arbeitsbereich hinzufügen“ auf der Seite „Neue Sitzung“.",
        'heroPicker.error.title': "Arbeitsbereich konnte nicht hinzugefügt werden",
        'heroPicker.retry': "Erneut versuchen",
        'error.title': 'Etwas ist schiefgelaufen',
        'cancel': 'Abbrechen',
        'create': 'Erstellen',
        'confirm': 'OK',
        'close': 'Schließen',
        'ws.rename.title': 'Arbeitsbereich umbenennen',
        'ws.rename.hint': 'Ein / im Namen bildet die Gruppenebene, z. B. web/frontend',
        'ws.delete.title': 'Arbeitsbereich löschen',
        'ws.delete.body': 'Nur die Registrierung wird entfernt; Verzeichnis und Sitzungsprotokolle bleiben erhalten. „{name}“ löschen?',
        'folder.rename.title': 'Ordner umbenennen',
        'folder.rename.hint': 'Umbenennen aktualisiert alle Arbeitsbereichsnamen im Ordner',
        'folder.error.empty': 'Der Ordnerpfad darf nicht leer sein',
        'group.move.title': 'In Gruppe verschieben',
        'group.pick': 'Vorhandene Gruppe wählen',
        'group.new': 'Neue Gruppe',
        'group.new.title': "Neue Gruppe",
        'group.new.sess': "Sitzungsgruppe",
        'group.new.ws': "Arbeitsbereichsgruppe",
        'group.new.both': "Neue Sitzungs- oder Arbeitsbereichsgruppe",
        'group.new.where': "Speicherort wählen",
        'group.new.placeholder': "Gruppenname, „/\" verschachtelt",
        'group.new.nameHint': "Ein „/\" verschachtelt weiter, z. B. frontend/components",
        'group.new.empty': "Gruppennamen eingeben",
        'group.new.root': "Oberste Ebene",
        'group.new.independent': "Neue Gruppe auf oberster Ebene",
        'group.new.pickWorkspace': "Arbeitsbereich wählen",
        'group.new.noWorkspace': "Noch keine Arbeitsbereiche — zuerst einen hinzufügen",
        'group.new.pickFirst': "Zuerst einen Arbeitsbereich wählen",
        'group.delete.title': "Gruppe löschen",
        'group.delete.body': "„{name}\" ist eine leere Gruppe; das Löschen kann nicht rückgängig gemacht werden.",
        'menu.deleteGroup': "Gruppe löschen",
      },
      /* locale: fr */
      'fr': {
        'title': 'Espaces de travail',
        'search.placeholder': 'Rechercher un espace de travail ou une session',
        'add': 'Ajouter un espace de travail',
        'rail.search': 'Rechercher',
        'rail.add': 'Ajouter un espace de travail',
        'empty': 'Aucun espace de travail',
        'empty.search': 'Aucun résultat',
        'session.new': 'Nouvelle session',
        'viewOptions.label': 'Options d’affichage',
        'viewOptions.groupBy': 'Regrouper par',
        'viewOptions.byWorkspace': 'Espaces de travail',
        'viewOptions.byWorkspaceTree': 'Arborescence des espaces',
        'viewOptions.flat': 'En une liste',
        'viewOptions.orderBy': 'Trier par',
        'viewOptions.manualOrder': 'Manuel',
        'viewOptions.updatedOrder': 'Dernière mise à jour',
        'viewOptions.sessionSlash': 'Grouper les sessions par « / »',
        'viewOptions.wsGroupBy': "Regrouper les espaces",
        'viewOptions.wsByDisk': "Dossiers disque",
        'viewOptions.wsByDiskSlash': "Disque + noms",
        'viewOptions.wsBySlash': "Noms seuls",
        'group.ungrouped': 'Sans groupe',
        'sessions.expand': 'Afficher {n} sessions',
        'sessions.collapse': 'Réduire',
        'time.now': 'à l\'instant',
        'time.minutes': '{n} min',
        'time.hours': '{n} h',
        'time.days': '{n} j',
        'time.months': '{n} mois',
        'time.years': '{n} an(s)',
        'status.running': 'Génération en cours',
        'status.completed': 'Terminé',
        'status.approval': 'En attente d\'approbation',
        'status.planReview': 'En attente de validation du plan',
        'status.question': 'En attente de réponse',
        'status.subagents': '{n} sous-agents en cours',
        'schedule.active': 'Tâche planifiée active',
        'menu.rename': 'Renommer',
        'menu.delete': 'Supprimer',
        'menu.fork': 'Bifurquer',
        'menu.archive': 'Archiver',
        'menu.renameFolder': 'Renommer le dossier',
        'menu.renameSgroup': 'Renommer le groupe de sessions',
        'menu.moveToGroup': 'Déplacer vers le groupe…',
        'menu.moveOutGroup': 'Retirer du groupe',
        'settings.title': 'Espaces de travail améliorés',
        'settings.desc': 'Apparence et repli de l\'arborescence des espaces de travail',
        'settings.expand': 'Développer',
        'settings.collapse': 'Réduire',
        'settings.compactChains': 'Fusionner les chaînes à un seul enfant',
        'settings.compactChains.hint': 'Les niveaux à un seul enfant se fusionnent en une ligne; dès qu\'il y a plusieurs enfants, l\'arborescence se déploie; pendant le glisser-déposer d\'un espace de travail, les chaînes se déploient temporairement en dossiers pour permettre le dépôt à n\'importe quel niveau; l\'état déplié et l\'apparence personnalisée sont conservés dans ce navigateur.',
        'settings.statusPulse': 'Voyant d\'état pulsant',
        'settings.statusPulse.hint': 'Les voyants masqués par le repli (terminé vert / en cours bleu / en attente ambre) remontent la hiérarchie: les lignes d\'espace de travail et de dossier font pulser leur icône dans la couleur d\'état (les titres à lueur personnalisée pulsent aussi), les lignes de groupe de sessions affichent un voyant pulsant; activé par défaut, désactivable ici.',
        'settings.workspaceGroup': "Regroupement des espaces",
        'settings.workspaceGroup.hint': "Dossiers disque : imbrique uniquement selon les dossiers officiels (répertoires disque). Disque + noms : ajoute les groupes de noms par barre oblique au-dessus de l’arborescence disque. Noms seuls : regroupe uniquement par barre oblique dans les titres et ignore l’imbrication disque. L’état de l’ancien interrupteur migre automatiquement.",
        'settings.sessionLimit': "Sessions affichées à l’ouverture",
        'settings.sessionLimit.all': "Tout",
        'settings.sessionLimit.hint': "Un espace ouvert montre d’abord ses sessions les plus récentes, le reste derrière une ligne afficher-plus ; les sessions épinglées, en cours et en attente restent toujours visibles. Tout = sans limite (par défaut).",
        'settings.sessionMenu': "Menu contextuel des sessions",
        'settings.sessionMenu.hint': "Activé : un clic droit sur une ligne de session ouvre son menu d’actions (épinglage, archivage et arrêt-avec-archivage officiels inclus). Désactivé : la ligne affiche plutôt le bouton ⋯ officiel au survol, ouvrant le même menu. Activé par défaut.",
        'settings.rowActions': "Boutons de survol des sessions",
        'settings.rowActions.hint': "Affiche des boutons rapides d’épinglage / d’archivage en fin de ligne au survol, comme les lignes officielles. Désactivé : ces actions restent dans le menu uniquement. Activé par défaut.",
        'settings.appearance': 'Apparence par défaut',
        'settings.appearance.hint': 'Les lignes sans personnalisation utilisent cette apparence; le contour du texte est activé par défaut — sans lui, le texte reste souvent illisible sur une image de fond. Laissez la couleur vide pour suivre le thème.',
        'settings.appearance.reset': 'Rétablir l\'apparence par défaut',
        'custom.title': 'Personnaliser l\'apparence',
        'custom.color': 'Couleur',
        'custom.glow': 'Lueur',
        'custom.preview': 'Aperçu en direct',
        'custom.preview.sample': 'Exemple d\'espace de travail',
        'custom.weight': 'Graisse de la police',
        'custom.weight.regular': 'Normal',
        'custom.weight.medium': 'Moyen',
        'custom.weight.semibold': 'Semi-gras',
        'custom.weight.bold': 'Gras',
        'custom.shadow': 'Ombre du texte',
        'custom.stroke': 'Contour du texte',
        'custom.stroke.hint': 'Le contour est gris par défaut; choisissez noir / blanc / une couleur quelconque, ou « Auto » pour dériver le pôle contrasté de la couleur du texte (texte clair: liseré noir, texte foncé: liseré blanc); Auto suit le thème et le passage clair/sombre d\'un plugin d\'arrière-plan.',
        'custom.strokeWidth': 'Épaisseur du contour',
        'custom.strokeColor': 'Couleur du contour',
        'custom.strokeColor.auto': 'Auto',
        'custom.weak': 'Faible',
        'custom.medium': 'Moyen',
        'custom.strong': 'Fort',
        'custom.icon': 'Icône',
        'custom.icon.solid': 'Dossier plein',
        'custom.icon.outline': 'Dossier vide',
        'custom.icon.none': 'Masquée',
        'custom.none': 'Aucune',
        'custom.reset': 'Effacer la personnalisation',
        'custom.done': 'Terminé',
        'settings.on': 'Activé',
        'settings.off': 'Désactivé',
        'sync.title': 'Synchronisation entre appareils',
      'sync.desc': "Les personnalisations d'apparence et les interrupteurs vivent dans le navigateur de cet appareil ; ils s'échangent avec l'autre surface (web / application de bureau) via le magasin de paramètres de l'hôte. Les nouvelles modifications sont écrites automatiquement vers l'hôte — l'autre surface se contente de récupérer. Les données antérieures à cette version nécessitent un envoi explicite.",
        'sync.mode.overwrite': 'Écraser cet appareil',
        'sync.mode.merge': 'Fusionner les deux côtés',
        'sync.pull.desktop': 'Récupérer depuis l\'application de bureau',
        'sync.pull.web': 'Récupérer depuis le web',
        'sync.push': 'Envoyer les données de cet appareil',
        'sync.done': 'Synchronisé',
        'sync.empty': 'Aucune donnée à récupérer de l\'autre côté',
        'sync.off': 'Synchronisation indisponible ici (service de réglages de l\'hôte requis)',
        'sync.loading': 'Connexion aux réglages de l\'hôte…',
        'flow.creating': 'Création…',
        'add.guide.title': "Ajouter un espace de travail dans l’application",
        'add.guide': "Cet hôte n’a pas de sélecteur de dossier natif. Utilisez l’entrée officielle « Ajouter un espace de travail » sur la page Nouvelle session.",
        'heroPicker.error.title': "Impossible d'ajouter l'espace de travail",
        'heroPicker.retry': "Réessayer",
        'error.title': 'Une erreur est survenue',
        'cancel': 'Annuler',
        'create': 'Créer',
        'confirm': 'OK',
        'close': 'Fermer',
        'ws.rename.title': 'Renommer l\'espace de travail',
        'ws.rename.hint': 'Un / dans le nom crée le groupe, par ex. web/frontend',
        'ws.delete.title': 'Supprimer l\'espace de travail',
        'ws.delete.body': 'Seule l\'inscription est supprimée; le dossier et les journaux de session sont conservés. Supprimer « {name} » ?',
        'folder.rename.title': 'Renommer le dossier',
        'folder.rename.hint': 'Le renommage met à jour tous les espaces de travail du dossier',
        'folder.error.empty': 'Le chemin du dossier ne doit pas être vide',
        'group.move.title': 'Déplacer vers le groupe',
        'group.pick': 'Choisir un groupe existant',
        'group.new': 'Nouveau groupe',
        'group.new.title': "Nouveau groupe",
        'group.new.sess': "Groupe de sessions",
        'group.new.ws': "Groupe d’espaces de travail",
        'group.new.both': "Nouveau groupe de sessions ou d’espaces de travail",
        'group.new.where': "Choisir l’emplacement",
        'group.new.placeholder': "Nom du groupe, « / » imbrique",
        'group.new.nameHint': "Un « / » imbrique davantage, par ex. frontend/components",
        'group.new.empty': "Saisissez un nom de groupe",
        'group.new.root': "Niveau supérieur",
        'group.new.independent': "Nouveau groupe de premier niveau",
        'group.new.pickWorkspace': "Choisissez un espace de travail",
        'group.new.noWorkspace': "Aucun espace de travail — ajoutez-en un d’abord",
        'group.new.pickFirst': "Choisissez d’abord un espace de travail",
        'group.delete.title': "Supprimer le groupe",
        'group.delete.body': "« {name} » est un groupe vide ; la suppression est irréversible.",
        'menu.deleteGroup': "Supprimer le groupe",
      },
      /* locale: hi */
      'hi': {
        'title': 'कार्यस्थान',
        'search.placeholder': 'कार्यस्थान या सत्र खोजें',
        'add': 'कार्यस्थान जोड़ें',
        'rail.search': 'खोजें',
        'rail.add': 'कार्यस्थान जोड़ें',
        'empty': 'अभी कोई कार्यस्थान नहीं',
        'empty.search': 'कोई मेल खाता परिणाम नहीं',
        'session.new': 'नया सत्र',
        'viewOptions.label': 'दृश्य विकल्प',
        'viewOptions.groupBy': 'समूहीकरण',
        'viewOptions.byWorkspace': 'कार्यक्षेत्र अनुसार',
        'viewOptions.byWorkspaceTree': 'कार्यक्षेत्र ट्री अनुसार',
        'viewOptions.flat': 'एक सूची में',
        'viewOptions.orderBy': 'क्रम',
        'viewOptions.manualOrder': 'मैन्युअल',
        'viewOptions.updatedOrder': 'हाल का अपडेट',
        'viewOptions.sessionSlash': 'सत्रों को "/" से समूहित करें',
        'viewOptions.wsGroupBy': "वर्कस्पेस समूहीकरण",
        'viewOptions.wsByDisk': "डिस्क फ़ोल्डर",
        'viewOptions.wsByDiskSlash': "डिस्क + नाम",
        'viewOptions.wsBySlash': "केवल नाम",
        'group.ungrouped': 'बिना समूह',
        'sessions.expand': '{n} सत्र दिखाएँ',
        'sessions.collapse': 'समेटें',
        'time.now': 'अभी-अभी',
        'time.minutes': '{n} मिनट',
        'time.hours': '{n} घंटे',
        'time.days': '{n} दिन',
        'time.months': '{n} महीने',
        'time.years': '{n} वर्ष',
        'status.running': 'बन रहा है',
        'status.completed': 'पूर्ण',
        'status.approval': 'स्वीकृति की प्रतीक्षा',
        'status.planReview': 'योजना पुष्टि की प्रतीक्षा',
        'status.question': 'उत्तर की प्रतीक्षा',
        'status.subagents': '{n} उप-एजेंट चल रहे हैं',
        'schedule.active': 'सक्रिय निर्धारित कार्य मौजूद',
        'menu.rename': 'नाम बदलें',
        'menu.delete': 'हटाएँ',
        'menu.fork': 'शाखा बनाएँ',
        'menu.archive': 'संग्रह करें',
        'menu.renameFolder': 'फ़ोल्डर का नाम बदलें',
        'menu.renameSgroup': 'सत्र समूह का नाम बदलें',
        'menu.moveToGroup': 'समूह में ले जाएँ…',
        'menu.moveOutGroup': 'समूह से बाहर निकालें',
        'settings.title': 'बेहतर कार्यस्थान',
        'settings.desc': 'कार्यस्थान वृक्ष का रूप और समेटने की प्राथमिकताएँ',
        'settings.expand': 'फैलाएँ',
        'settings.collapse': 'समेटें',
        'settings.compactChains': 'एकल-संतान श्रृंखलाएँ मिलाएँ',
        'settings.compactChains.hint': 'जिन स्तरों पर केवल एक संतान होती है वे एक पंक्ति में मिल जाते हैं; कई संतानें होने पर वृक्ष खुल जाता है; कार्यस्थान खींचते समय श्रृंखलाएँ अस्थायी रूप से फ़ोल्डरों में खुल जाती हैं ताकि किसी भी स्तर पर छोड़ा जा सके; खुलने की स्थिति और अनुकूलित रूप इसी ब्राउज़र में सहेजे जाते हैं।',
        'settings.statusPulse': 'स्थिति की साँस लेती बत्ती',
        'settings.statusPulse.hint': 'समेटने से छिपी स्थिति बत्तियाँ (पूर्ण हरी / चल रहा नीली / प्रतीक्षारत अंबर) पदानुक्रम में ऊपर उठती हैं: कार्यस्थान और फ़ोल्डर पंक्तियों का चिह्न स्थिति के रंग में साँस लेता है (अनुकूलित चमक वाले शीर्षक भी साथ साँस लेते हैं), सत्र समूह पंक्तियों पर साँस लेता स्थिति बिंदु दिखता है; डिफ़ॉल्ट रूप से चालू, यहाँ बंद किया जा सकता है।',
        'settings.workspaceGroup': "वर्कस्पेस समूहीकरण",
        'settings.workspaceGroup.hint': "डिस्क फ़ोल्डर: केवल आधिकारिक फ़ोल्डर (डिस्क निर्देशिका) से नेस्ट। डिस्क + नाम: डिस्क ट्री के ऊपर स्लैश नाम समूह जोड़ता है। केवल नाम: केवल शीर्षक के स्लैश से समूहित करता है, डिस्क नेस्टिंग की अनदेखी करता है। पुराने स्विच की स्थिति स्वतः माइग्रेट होती है।",
        'settings.sessionLimit': "विस्तार पर दिखने वाले सेशन",
        'settings.sessionLimit.all': "सभी",
        'settings.sessionLimit.hint': "विस्तारित वर्कस्पेस पहले केवल हाल के सेशन दिखाता है, बाकी एक और-दिखाएँ पंक्ति के पीछे; पिन, चल रहे और आपकी प्रतीक्षा में सेशन सदा दिखते हैं। सभी = असीमित (डिफ़ॉल्ट)।",
        'settings.sessionMenu': "सेशन संदर्भ मेनू",
        'settings.sessionMenu.hint': "चालू: सेशन पंक्ति पर राइट-क्लिक करने से उसका क्रिया मेनू खुलता है (आधिकारिक पिन, आर्काइव और रोककर-आर्काइव सहित)। बंद: पंक्ति पर होवर करने पर आधिकारिक शैली का ⋯ बटन दिखता है, जो वही मेनू खोलता है। डिफ़ॉल्ट रूप से चालू।",
        'settings.rowActions': "सेशन पंक्ति होवर बटन",
        'settings.rowActions.hint': "होवर करने पर सेशन पंक्ति के अंत में पिन / आर्काइव क्विक बटन दिखाता है, आधिकारिक पंक्तियों जैसा। बंद: ये क्रियाएँ केवल मेनू में रहती हैं। डिफ़ॉल्ट रूप से चालू।",
        'settings.appearance': 'डिफ़ॉल्ट रूप',
        'settings.appearance.hint': 'जिन पंक्तियों को अलग से अनुकूलित नहीं किया गया वे यह रूप इस्तेमाल करती हैं; पाठ की रूपरेखा डिफ़ॉल्ट रूप से चालू है — पृष्ठभूमि छवि पर बिना रूपरेखा वाला पाठ अक्सर पढ़ा नहीं जाता। रंग खाली छोड़ने पर वह थीम का अनुसरण करता है।',
        'settings.appearance.reset': 'डिफ़ॉल्ट रूप पर लौटें',
        'custom.title': 'रूप अनुकूलित करें',
        'custom.color': 'रंग',
        'custom.glow': 'चमक',
        'custom.preview': 'लाइव पूर्वावलोकन',
        'custom.preview.sample': 'नमूना कार्यस्थान',
        'custom.weight': 'अक्षर की मोटाई',
        'custom.weight.regular': 'सामान्य',
        'custom.weight.medium': 'मध्यम',
        'custom.weight.semibold': 'अर्ध-मोटा',
        'custom.weight.bold': 'मोटा',
        'custom.shadow': 'पाठ की छाया',
        'custom.stroke': 'पाठ की रूपरेखा',
        'custom.stroke.hint': 'रूपरेखा डिफ़ॉल्ट रूप से धूसर है; इसे काला / सफ़ेद / कोई भी रंग बनाया जा सकता है, या «स्वतः» चुनकर पाठ के रंग से विपरीत रंग निकाला जा सकता है (हल्के पाठ पर काला किनारा, गहरे पाठ पर सफ़ेद); स्वतः मोड थीम और पृष्ठभूमि प्लगइन के उजले/गहरे बदलाव का अनुसरण करता है।',
        'custom.strokeWidth': 'रूपरेखा की मोटाई',
        'custom.strokeColor': 'रूपरेखा का रंग',
        'custom.strokeColor.auto': 'स्वतः',
        'custom.weak': 'हल्का',
        'custom.medium': 'मध्यम',
        'custom.strong': 'तीव्र',
        'custom.icon': 'चिह्न',
        'custom.icon.solid': 'भरा फ़ोल्डर',
        'custom.icon.outline': 'रूपरेखा फ़ोल्डर',
        'custom.icon.none': 'छिपा हुआ',
        'custom.none': 'कुछ नहीं',
        'custom.reset': 'अनुकूलन हटाएँ',
        'custom.done': 'हो गया',
        'settings.on': 'चालू',
        'settings.off': 'बंद',
        'sync.title': 'उपकरणों के बीच समन्वयन',
      'sync.desc': "रूप अनुकूलन और टॉगल इस डिवाइस के ब्राउज़र में रहते हैं; वे होस्ट सेटिंग्स स्टोर के माध्यम से दूसरी सतह (वेब / डेस्कटॉप ऐप) के साथ आदान-प्रदान होते हैं। नए बदलाव स्वचालित रूप से होस्ट पर लिखे जाते हैं — दूसरी सतह को बस खींचना है। इस संस्करण से पहले के डेटा को एक बार भेजना होगा।",
        'sync.mode.overwrite': 'इस उपकरण को अधिलेखित करें',
        'sync.mode.merge': 'दोनों सिरे मिलाएँ',
        'sync.pull.desktop': 'डेस्कटॉप ऐप से प्राप्त करें',
        'sync.pull.web': 'वेब से प्राप्त करें',
        'sync.push': 'इस उपकरण का डेटा भेजें',
        'sync.done': 'समन्वित',
        'sync.empty': 'दूसरे सिरे पर अभी कोई डेटा नहीं',
        'sync.off': 'यहाँ समन्वयन उपलब्ध नहीं (होस्ट सेटिंग सेवा चाहिए)',
        'sync.loading': 'होस्ट सेटिंग से जुड़ रहे हैं…',
        'flow.creating': 'बनाया जा रहा है…',
        'add.guide.title': "ऐप में कार्यस्थान जोड़ें",
        'add.guide': "इस होस्ट में डेस्कटॉप फ़ोल्डर चयनकर्ता नहीं है। नए सत्र पृष्ठ पर आधिकारिक \"कार्यस्थान जोड़ें\" प्रविष्टि का उपयोग करें।",
        'heroPicker.error.title': "कार्यस्थान जोड़ा नहीं जा सका",
        'heroPicker.retry': "पुनः प्रयास करें",
        'error.title': 'कुछ गड़बड़ हो गई',
        'cancel': 'रद्द करें',
        'create': 'बनाएँ',
        'confirm': 'ठीक है',
        'close': 'बंद करें',
        'ws.rename.title': 'कार्यस्थान का नाम बदलें',
        'ws.rename.hint': 'नाम में / समूह स्तर बनाता है, जैसे web/frontend',
        'ws.delete.title': 'कार्यस्थान हटाएँ',
        'ws.delete.body': 'केवल पंजीकरण हटता है; निर्देशिका और सत्र लॉग बने रहते हैं। «{name}» हटाएँ?',
        'folder.rename.title': 'समूह का नाम बदलें',
        'folder.rename.hint': 'नाम बदलने पर समूह के सभी कार्यस्थानों के नाम भी बदल जाते हैं',
        'folder.error.empty': 'समूह पथ खाली नहीं हो सकता',
        'group.move.title': 'समूह में ले जाएँ',
        'group.pick': 'मौजूदा समूह चुनें',
        'group.new': 'नया समूह',
        'group.new.title': "नया समूह",
        'group.new.sess': "सत्र समूह",
        'group.new.ws': "कार्यस्थान समूह",
        'group.new.both': "नया सत्र या कार्यस्थान समूह",
        'group.new.where': "बनाने का स्थान चुनें",
        'group.new.placeholder': "समूह का नाम, \"/\" से नेस्टिंग",
        'group.new.nameHint': "\"/\" और गहरा स्तर बनाता है, जैसे frontend/components",
        'group.new.empty': "समूह का नाम दर्ज करें",
        'group.new.root': "शीर्ष स्तर",
        'group.new.independent': "नया शीर्ष-स्तरीय समूह",
        'group.new.pickWorkspace': "एक कार्यस्थान चुनें",
        'group.new.noWorkspace': "अभी कोई कार्यस्थान नहीं — पहले एक जोड़ें",
        'group.new.pickFirst': "पहले एक कार्यस्थान चुनें",
        'group.delete.title': "समूह हटाएँ",
        'group.delete.body': "\"{name}\" एक खाली समूह है; हटाने पर इसे वापस नहीं लाया जा सकता।",
        'menu.deleteGroup': "समूह हटाएँ",
      },
      /* locale: id */
      'id': {
        'title': 'Ruang kerja',
        'search.placeholder': 'Cari ruang kerja atau sesi',
        'add': 'Tambah ruang kerja',
        'rail.search': 'Cari',
        'rail.add': 'Tambah ruang kerja',
        'empty': 'Belum ada ruang kerja',
        'empty.search': 'Tidak ada hasil yang cocok',
        'session.new': 'Sesi baru',
        'viewOptions.label': 'Opsi tampilan',
        'viewOptions.groupBy': 'Kelompokkan berdasarkan',
        'viewOptions.byWorkspace': 'Ruang kerja',
        'viewOptions.byWorkspaceTree': 'Pohon ruang kerja',
        'viewOptions.flat': 'Satu daftar',
        'viewOptions.orderBy': 'Urutkan',
        'viewOptions.manualOrder': 'Manual',
        'viewOptions.updatedOrder': 'Terakhir diperbarui',
        'viewOptions.sessionSlash': 'Kelompokkan sesi per "/"',
        'viewOptions.wsGroupBy': "Grupkan ruang kerja",
        'viewOptions.wsByDisk': "Folder disk",
        'viewOptions.wsByDiskSlash': "Disk + nama",
        'viewOptions.wsBySlash': "Hanya nama",
        'group.ungrouped': 'Tanpa grup',
        'sessions.expand': 'Tampilkan {n} sesi',
        'sessions.collapse': 'Ciutkan',
        'time.now': 'baru saja',
        'time.minutes': '{n} mnt',
        'time.hours': '{n} jam',
        'time.days': '{n} hr',
        'time.months': '{n} bln',
        'time.years': '{n} thn',
        'status.running': 'Sedang dibuat',
        'status.completed': 'Selesai',
        'status.approval': 'Menunggu persetujuan',
        'status.planReview': 'Menunggu konfirmasi rencana',
        'status.question': 'Menunggu jawaban',
        'status.subagents': '{n} subagen berjalan',
        'schedule.active': 'Ada tugas terjadwal yang aktif',
        'menu.rename': 'Ganti nama',
        'menu.delete': 'Hapus',
        'menu.fork': 'Cabangkan',
        'menu.archive': 'Arsipkan',
        'menu.renameFolder': 'Ganti nama folder',
        'menu.renameSgroup': 'Ganti nama grup sesi',
        'menu.moveToGroup': 'Pindahkan ke grup…',
        'menu.moveOutGroup': 'Keluarkan dari grup',
        'settings.title': 'Ruang kerja yang lebih baik',
        'settings.desc': 'Tampilan dan pelipatan pohon ruang kerja',
        'settings.expand': 'Bentangkan',
        'settings.collapse': 'Ciutkan',
        'settings.compactChains': 'Gabungkan rantai beranak tunggal',
        'settings.compactChains.hint': 'Tingkat yang hanya punya satu anak digabung jadi satu baris; bila anaknya banyak, pohon terbentang; saat menyeret ruang kerja, rantai sementara terbentang kembali jadi folder sehingga bisa dijatuhkan di tingkat mana pun; status terbentang dan tampilan khusus disimpan di browser ini.',
        'settings.statusPulse': 'Lampu status bernapas',
        'settings.statusPulse.hint': 'Lampu status yang tersembunyi karena pelipatan (selesai hijau / berjalan biru / menunggu kuning) menggelembung ke tingkat atas: baris ruang kerja dan folder membuat ikonnya bernapas dalam warna status (judul dengan pendar khusus ikut bernapas), baris grup sesi menampilkan titik status yang bernapas; aktif secara bawaan, bisa dimatikan di sini.',
        'settings.workspaceGroup': "Pengelompokan ruang kerja",
        'settings.workspaceGroup.hint': "Folder disk: bersarang hanya mengikuti folder resmi (direktori disk). Disk + nama: menambahkan grup nama garis miring di atas pohon disk. Hanya nama: mengelompokkan murni dari garis miring pada judul dan mengabaikan struktur disk. Status sakelar versi lama bermigrasi otomatis.",
        'settings.sessionLimit': "Sesi saat dibuka",
        'settings.sessionLimit.all': "Semua",
        'settings.sessionLimit.hint': "Ruang kerja yang dibuka pertama menampilkan sesi terbaru, sisanya di balik satu baris tampilkan-lebih; sesi pin, berjalan, dan menunggu Anda selalu terlihat. Semua = tanpa batas (bawaan).",
        'settings.sessionMenu': "Menu klik kanan sesi",
        'settings.sessionMenu.hint': "Aktif: klik kanan pada baris sesi untuk membuka menu aksinya (termasuk pin, arsip, dan henti-dan-arsip resmi). Nonaktif: baris menampilkan tombol ⋯ gaya resmi saat dihover, membuka menu yang sama. Aktif secara bawaan.",
        'settings.rowActions': "Tombol hover baris sesi",
        'settings.rowActions.hint': "Menampilkan tombol cepat pin / arsip di ujung baris sesi saat dihover, mengikuti baris resmi. Nonaktif: aksi ini hanya ada di menu. Aktif secara bawaan.",
        'settings.appearance': 'Tampilan bawaan',
        'settings.appearance.hint': 'Baris yang belum disesuaikan memakai tampilan ini; garis luar teks aktif secara bawaan — tanpa itu teks sering tak terbaca di atas gambar latar. Biarkan warna kosong agar mengikuti tema.',
        'settings.appearance.reset': 'Kembalikan tampilan bawaan',
        'custom.title': 'Sesuaikan tampilan',
        'custom.color': 'Warna',
        'custom.glow': 'Pendar',
        'custom.preview': 'Pratinjau langsung',
        'custom.preview.sample': 'Contoh ruang kerja',
        'custom.weight': 'Ketebalan huruf',
        'custom.weight.regular': 'Normal',
        'custom.weight.medium': 'Sedang',
        'custom.weight.semibold': 'Semi tebal',
        'custom.weight.bold': 'Tebal',
        'custom.shadow': 'Bayangan teks',
        'custom.stroke': 'Garis luar teks',
        'custom.stroke.hint': 'Garis luar bawaannya abu-abu; bisa diganti hitam / putih / warna apa pun, atau «Otomatis» untuk menurunkan kutub kontras dari warna teks (teks terang dapat tepi hitam, teks gelap dapat tepi putih); Otomatis mengikuti tema dan pergantian terang/gelap plugin latar.',
        'custom.strokeWidth': 'Ketebalan garis luar',
        'custom.strokeColor': 'Warna garis luar',
        'custom.strokeColor.auto': 'Otomatis',
        'custom.weak': 'Lemah',
        'custom.medium': 'Sedang',
        'custom.strong': 'Kuat',
        'custom.icon': 'Ikon',
        'custom.icon.solid': 'Folder penuh',
        'custom.icon.outline': 'Folder bergaris',
        'custom.icon.none': 'Tersembunyi',
        'custom.none': 'Tidak ada',
        'custom.reset': 'Hapus penyesuaian',
        'custom.done': 'Selesai',
        'settings.on': 'Aktif',
        'settings.off': 'Nonaktif',
        'sync.title': 'Sinkronisasi antar perangkat',
      'sync.desc': "Kustomisasi tampilan dan tombol pengalih tersimpan di peramban perangkat ini; keduanya bertukar dengan permukaan lain (web / aplikasi desktop) melalui penyimpanan pengaturan host. Perubahan baru ditulis ke host secara otomatis — permukaan lain tinggal menarik. Data dari sebelum versi ini perlu satu kali Kirim.",
        'sync.mode.overwrite': 'Timpa perangkat ini',
        'sync.mode.merge': 'Gabungkan kedua sisi',
        'sync.pull.desktop': 'Ambil dari aplikasi desktop',
        'sync.pull.web': 'Ambil dari web',
        'sync.push': 'Kirim data perangkat ini',
        'sync.done': 'Tersinkron',
        'sync.empty': 'Sisi lain belum punya data',
        'sync.off': 'Sinkronisasi tidak tersedia di sini (perlu layanan pengaturan host)',
        'sync.loading': 'Menyambung ke pengaturan host…',
        'flow.creating': 'Membuat…',
        'add.guide.title': "Tambah ruang kerja di aplikasi",
        'add.guide': "Host ini tidak punya pemilih folder desktop. Gunakan entri resmi \"Tambah ruang kerja\" di halaman Sesi Baru.",
        'heroPicker.error.title': "Tidak dapat menambahkan ruang kerja",
        'heroPicker.retry': "Coba lagi",
        'error.title': 'Terjadi kesalahan',
        'cancel': 'Batal',
        'create': 'Buat',
        'confirm': 'OK',
        'close': 'Tutup',
        'ws.rename.title': 'Ganti nama ruang kerja',
        'ws.rename.hint': '/ di nama membentuk tingkat grup, mis. web/frontend',
        'ws.delete.title': 'Hapus ruang kerja',
        'ws.delete.body': 'Hanya pendaftarannya yang dihapus; direktori dan log sesi tetap ada. Hapus «{name}»?',
        'folder.rename.title': 'Ganti nama folder',
        'folder.rename.hint': 'Mengganti nama akan memperbarui semua ruang kerja di folder',
        'folder.error.empty': 'Jalur folder tidak boleh kosong',
        'group.move.title': 'Pindahkan ke grup',
        'group.pick': 'Pilih grup yang ada',
        'group.new': 'Grup baru',
        'group.new.title': "Grup baru",
        'group.new.sess': "Grup sesi",
        'group.new.ws': "Grup ruang kerja",
        'group.new.both': "Grup sesi atau ruang kerja baru",
        'group.new.where': "Pilih lokasi pembuatan",
        'group.new.placeholder': "Nama grup, \"/\" untuk bersarang",
        'group.new.nameHint': "\"/\" membuat tingkat lebih dalam, mis. frontend/components",
        'group.new.empty': "Masukkan nama grup",
        'group.new.root': "Tingkat teratas",
        'group.new.independent': "Grup tingkat teratas baru",
        'group.new.pickWorkspace': "Pilih ruang kerja",
        'group.new.noWorkspace': "Belum ada ruang kerja — tambahkan dulu",
        'group.new.pickFirst': "Pilih ruang kerja dulu",
        'group.delete.title': "Hapus grup",
        'group.delete.body': "\"{name}\" adalah grup kosong; penghapusan tidak bisa dibatalkan.",
        'menu.deleteGroup': "Hapus grup",
      },
      /* locale: it */
      'it': {
        'title': 'Aree di lavoro',
        'search.placeholder': 'Cerca aree di lavoro o sessioni',
        'add': 'Aggiungi area di lavoro',
        'rail.search': 'Cerca',
        'rail.add': 'Aggiungi area di lavoro',
        'empty': 'Nessuna area di lavoro',
        'empty.search': 'Nessun risultato',
        'session.new': 'Nuova sessione',
        'viewOptions.label': 'Opzioni vista',
        'viewOptions.groupBy': 'Raggruppa per',
        'viewOptions.byWorkspace': 'Aree di lavoro',
        'viewOptions.byWorkspaceTree': 'Albero aree di lavoro',
        'viewOptions.flat': 'In un elenco',
        'viewOptions.orderBy': 'Ordina per',
        'viewOptions.manualOrder': 'Manuale',
        'viewOptions.updatedOrder': 'Ultimo aggiornamento',
        'viewOptions.sessionSlash': 'Raggruppa sessioni per "/"',
        'viewOptions.wsGroupBy': "Raggruppa aree di lavoro",
        'viewOptions.wsByDisk': "Cartelle disco",
        'viewOptions.wsByDiskSlash': "Disco + nomi",
        'viewOptions.wsBySlash': "Solo nomi",
        'group.ungrouped': 'Senza gruppo',
        'sessions.expand': 'Mostra {n} sessioni',
        'sessions.collapse': 'Comprimi',
        'time.now': 'adesso',
        'time.minutes': '{n} min',
        'time.hours': '{n} h',
        'time.days': '{n} g',
        'time.months': '{n} mesi',
        'time.years': '{n} anni',
        'status.running': 'Generazione in corso',
        'status.completed': 'Completato',
        'status.approval': 'In attesa di approvazione',
        'status.planReview': 'In attesa di conferma del piano',
        'status.question': 'In attesa di risposta',
        'status.subagents': '{n} sotto-agenti in esecuzione',
        'schedule.active': 'Attività pianificata attiva',
        'menu.rename': 'Rinomina',
        'menu.delete': 'Elimina',
        'menu.fork': 'Dirama',
        'menu.archive': 'Archivia',
        'menu.renameFolder': 'Rinomina cartella',
        'menu.renameSgroup': 'Rinomina gruppo di sessioni',
        'menu.moveToGroup': 'Sposta nel gruppo…',
        'menu.moveOutGroup': 'Rimuovi dal gruppo',
        'settings.title': 'Aree di lavoro migliori',
        'settings.desc': 'Aspetto e compressione dell\'albero delle aree di lavoro',
        'settings.expand': 'Espandi',
        'settings.collapse': 'Comprimi',
        'settings.compactChains': 'Unisci le catene a figlio unico',
        'settings.compactChains.hint': 'I livelli con un solo figlio si fondono in una riga; con più figli l\'albero si espande; durante il trascinamento di un\'area di lavoro le catene si riespandono temporaneamente in cartelle, così puoi rilasciare su qualsiasi livello; stato di espansione e aspetto personalizzato restano in questo browser.',
        'settings.statusPulse': 'Spia di stato pulsante',
        'settings.statusPulse.hint': 'Le spie nascoste dalla compressione (completato verde / in esecuzione blu / in attesa ambra) risalgono la gerarchia: le righe di aree di lavoro e cartelle fanno pulsare l\'icona nel colore di stato (anche i titoli con bagliore personalizzato pulsano), le righe dei gruppi di sessioni mostrano una spia pulsante; attiva per impostazione predefinita, disattivabile qui.',
        'settings.workspaceGroup': "Raggruppamento aree di lavoro",
        'settings.workspaceGroup.hint': "Cartelle disco: annida solo secondo le cartelle ufficiali (directory disco). Disco + nomi: aggiunge gruppi di nomi per barra obliqua sopra l’albero disco. Solo nomi: raggruppa solo per barra obliqua nei titoli ignorando l’annidamento disco. Lo stato del vecchio interruttore migra automaticamente.",
        'settings.sessionLimit': "Sessioni mostrate all’apertura",
        'settings.sessionLimit.all': "Tutte",
        'settings.sessionLimit.hint': "Un’area aperta mostra prima le sessioni più recenti, il resto dietro una riga mostra-altro; sessioni fissate, in corso e in attesa restano sempre visibili. Tutte = senza limiti (predefinito).",
        'settings.sessionMenu': "Menu contestuale sessione",
        'settings.sessionMenu.hint': "Attivo: il clic destro su una riga di sessione apre il menu azioni (con pin, archiviazione e ferma-e-archivia ufficiali). Disattivo: la riga mostra il pulsante ⋯ ufficiale al passaggio, aprendo lo stesso menu. Attivo per impostazione predefinita.",
        'settings.rowActions': "Pulsanti al passaggio della sessione",
        'settings.rowActions.hint': "Mostra pulsanti rapidi di pin / archiviazione in fondo alla riga al passaggio, come le righe ufficiali. Disattivo: queste azioni restano solo nel menu. Attivo per impostazione predefinita.",
        'settings.appearance': 'Aspetto predefinito',
        'settings.appearance.hint': 'Le righe mai personalizzate usano questo aspetto; il contorno del testo è attivo per impostazione predefinita — senza di esso il testo è spesso illeggibile sopra un\'immagine di sfondo. Lascia il colore vuoto per seguire il tema.',
        'settings.appearance.reset': 'Ripristina l\'aspetto predefinito',
        'custom.title': 'Personalizza aspetto',
        'custom.color': 'Colore',
        'custom.glow': 'Bagliore',
        'custom.preview': 'Anteprima dal vivo',
        'custom.preview.sample': 'Area di lavoro di esempio',
        'custom.weight': 'Spessore del carattere',
        'custom.weight.regular': 'Normale',
        'custom.weight.medium': 'Medio',
        'custom.weight.semibold': 'Semigrassetto',
        'custom.weight.bold': 'Grassetto',
        'custom.shadow': 'Ombra del testo',
        'custom.stroke': 'Contorno del testo',
        'custom.stroke.hint': 'Il contorno è grigio per impostazione predefinita; puoi scegliere nero / bianco / un colore qualsiasi, oppure «Auto» per ricavare il polo contrastante dal colore del testo (testo chiaro: bordo nero, testo scuro: bordo bianco); Auto segue il tema e il passaggio chiaro/scuro di un plugin di sfondo.',
        'custom.strokeWidth': 'Spessore del contorno',
        'custom.strokeColor': 'Colore del contorno',
        'custom.strokeColor.auto': 'Auto',
        'custom.weak': 'Debole',
        'custom.medium': 'Medio',
        'custom.strong': 'Forte',
        'custom.icon': 'Icona',
        'custom.icon.solid': 'Cartella piena',
        'custom.icon.outline': 'Cartella vuota',
        'custom.icon.none': 'Nascosta',
        'custom.none': 'Nessuno',
        'custom.reset': 'Rimuovi personalizzazione',
        'custom.done': 'Fine',
        'settings.on': 'Attivo',
        'settings.off': 'Disattivo',
        'sync.title': 'Sincronizzazione tra dispositivi',
      'sync.desc': "Le personalizzazioni dell'aspetto e gli interruttori vivono nel browser di questo dispositivo; si scambiano con l'altra superficie (web / app desktop) tramite l'archivio impostazioni dell'host. Le nuove modifiche vengono scritte automaticamente sull'host — l'altra superficie deve solo recuperarle. I dati precedenti a questa versione richiedono un invio esplicito.",
        'sync.mode.overwrite': 'Sovrascrivi questo dispositivo',
        'sync.mode.merge': 'Unisci i due lati',
        'sync.pull.desktop': 'Scarica dall\'app desktop',
        'sync.pull.web': 'Scarica dal web',
        'sync.push': 'Invia i dati di questo dispositivo',
        'sync.done': 'Sincronizzato',
        'sync.empty': 'Nessun dato da scaricare dall\'altro lato',
        'sync.off': 'Sincronizzazione non disponibile qui (serve il servizio impostazioni dell\'host)',
        'sync.loading': 'Connessione alle impostazioni dell\'host…',
        'flow.creating': 'Creazione…',
        'add.guide.title': "Aggiungi area di lavoro nell’app",
        'add.guide': "Questo host non ha un selettore di cartelle desktop. Usa la voce ufficiale «Aggiungi area di lavoro» nella pagina Nuova sessione.",
        'heroPicker.error.title': "Impossibile aggiungere l'area di lavoro",
        'heroPicker.retry': "Riprova",
        'error.title': 'Si è verificato un errore',
        'cancel': 'Annulla',
        'create': 'Crea',
        'confirm': 'OK',
        'close': 'Chiudi',
        'ws.rename.title': 'Rinomina area di lavoro',
        'ws.rename.hint': 'La / nel nome crea il gruppo, ad es. web/frontend',
        'ws.delete.title': 'Elimina area di lavoro',
        'ws.delete.body': 'Viene rimossa solo la registrazione; cartella e registri delle sessioni restano. Eliminare «{name}»?',
        'folder.rename.title': 'Rinomina cartella',
        'folder.rename.hint': 'La rinomina aggiorna tutte le aree di lavoro nella cartella',
        'folder.error.empty': 'Il percorso della cartella non può essere vuoto',
        'group.move.title': 'Sposta nel gruppo',
        'group.pick': 'Scegli un gruppo esistente',
        'group.new': 'Nuovo gruppo',
        'group.new.title': "Nuovo gruppo",
        'group.new.sess': "Gruppo di sessioni",
        'group.new.ws': "Gruppo di aree di lavoro",
        'group.new.both': "Nuovo gruppo di sessioni o aree di lavoro",
        'group.new.where': "Scegli dove crearlo",
        'group.new.placeholder': "Nome del gruppo, «/» annida",
        'group.new.nameHint': "Una «/» annida ulteriormente, es. frontend/components",
        'group.new.empty': "Inserisci un nome di gruppo",
        'group.new.root': "Livello superiore",
        'group.new.independent': "Nuovo gruppo di primo livello",
        'group.new.pickWorkspace': "Scegli un’area di lavoro",
        'group.new.noWorkspace': "Nessuna area di lavoro — aggiungine una prima",
        'group.new.pickFirst': "Scegli prima un’area di lavoro",
        'group.delete.title': "Elimina gruppo",
        'group.delete.body': "«{name}» è un gruppo vuoto; l’eliminazione non è reversibile.",
        'menu.deleteGroup': "Elimina gruppo",
      },
      /* locale: ja */
      'ja': {
        'title': 'ワークスペース',
        'search.placeholder': 'ワークスペースまたはセッションを検索',
        'add': 'ワークスペースを追加',
        'rail.search': '検索',
        'rail.add': 'ワークスペースを追加',
        'empty': 'ワークスペースがありません',
        'empty.search': '一致する結果がありません',
        'session.new': '新しいセッション',
        'viewOptions.label': '表示オプション',
        'viewOptions.groupBy': 'グループ化',
        'viewOptions.byWorkspace': 'ワークスペースごと',
        'viewOptions.byWorkspaceTree': 'ワークスペースツリーごと',
        'viewOptions.flat': '1 つのリスト',
        'viewOptions.orderBy': '並べ替え',
        'viewOptions.manualOrder': '手動',
        'viewOptions.updatedOrder': '最近の更新',
        'viewOptions.sessionSlash': 'セッションを「/」でグループ化',
        'viewOptions.wsGroupBy': "ワークスペースのグループ化",
        'viewOptions.wsByDisk': "フォルダー",
        'viewOptions.wsByDiskSlash': "フォルダー + 名前",
        'viewOptions.wsBySlash': "名前のみ",
        'group.ungrouped': '未分類',
        'sessions.expand': '{n} 件のセッションを展開',
        'sessions.collapse': '折りたたむ',
        'time.now': 'たった今',
        'time.minutes': '{n} 分',
        'time.hours': '{n} 時間',
        'time.days': '{n} 日',
        'time.months': '{n} か月',
        'time.years': '{n} 年',
        'status.running': '生成中',
        'status.completed': '完了',
        'status.approval': '承認待ち',
        'status.planReview': 'プラン確認待ち',
        'status.question': '回答待ち',
        'status.subagents': 'サブエージェント {n} 件が実行中',
        'schedule.active': '有効なスケジュールタスクあり',
        'menu.rename': '名前を変更',
        'menu.delete': '削除',
        'menu.fork': 'フォーク',
        'menu.archive': 'アーカイブ',
        'menu.renameFolder': 'フォルダー名を変更',
        'menu.renameSgroup': 'セッショングループ名を変更',
        'menu.moveToGroup': 'グループに移動…',
        'menu.moveOutGroup': 'グループから出す',
        'settings.title': 'より良いワークスペース',
        'settings.desc': 'ワークスペースツリーの外観と折りたたみ設定',
        'settings.expand': '展開',
        'settings.collapse': '折りたたむ',
        'settings.compactChains': '一本鎖の階層を 1 行にまとめる',
        'settings.compactChains.hint': '子が 1 つだけの階層は 1 行にまとまり,複数の子がある階層はツリーとして展開されます;ワークスペースのドラッグ中は一時的にフォルダーツリーへ戻り,どの階層にもドロップできます;展開状態とカスタム外観はこのブラウザーに保存されます。',
        'settings.statusPulse': 'ステータス表示灯',
        'settings.statusPulse.hint': '折りたたみで隠れたステータス表示(完了は緑 / 実行中は青 / 操作待ちは琥珀)が上位の階層へ伝わります:ワークスペースとフォルダーの行はアイコンがステータス色で明滅し(グローを設定したタイトルも連動),セッショングループの行には明滅するステータスドットが出ます;既定はオンで,ここでオフにできます。',
        'settings.workspaceGroup': "ワークスペースのグループ化",
        'settings.workspaceGroup.hint': "フォルダー:公式フォルダー(ディスク ディレクトリ)のみで階層化。フォルダー + 名前:ディスク ツリーに加えてタイトルのスラッシュでもグループ化。名前のみ:タイトルのスラッシュだけでグループ化し、ディスクの階層は無視。旧バージョンのスイッチ状態は自動的に引き継がれます。",
        'settings.sessionLimit': "展開時に表示するセッション数",
        'settings.sessionLimit.all': "すべて",
        'settings.sessionLimit.hint': "展開したワークスペースは最近のセッションを先に表示し、残りは「さらに表示」行の後ろに収まります。ピン留め・実行中・対応待ちのセッションは常に表示。すべて = 無制限(既定)。",
        'settings.sessionMenu': "セッション右クリックメニュー",
        'settings.sessionMenu.hint': "オン:セッション行を右クリックすると操作メニューを開きます(公式のピン留め・アーカイブ・停止してアーカイブを含む)。オフ:行にカーソルを合わせると公式スタイルの ⋯ ボタンが表示され、同じメニューを開きます。既定はオン。",
        'settings.rowActions': "セッション行のホバーボタン",
        'settings.rowActions.hint': "セッション行にカーソルを合わせると行末にピン / アーカイブのクイックボタンを表示し、公式の行と揃えます。オフ:これらの操作はメニュー内のみ。既定はオン。",
        'settings.appearance': '既定の外観',
        'settings.appearance.hint': '個別にカスタマイズしていない行に適用される外観です;文字の縁取りは既定でオンです——背景画像の上では縁取りのない文字が読みにくいためです。色を空にするとテーマに従います。',
        'settings.appearance.reset': '既定の外観に戻す',
        'custom.title': '外観をカスタマイズ',
        'custom.color': '色',
        'custom.glow': 'グロー',
        'custom.preview': 'ライブプレビュー',
        'custom.preview.sample': 'ワークスペースの例',
        'custom.weight': '文字の太さ',
        'custom.weight.regular': '標準',
        'custom.weight.medium': '中',
        'custom.weight.semibold': '準太字',
        'custom.weight.bold': '太字',
        'custom.shadow': '文字の影',
        'custom.stroke': '文字の縁取り',
        'custom.stroke.hint': '縁取りの色は既定でグレーです;黒 / 白 / 任意の色に変更でき,「自動」を選ぶと文字色からコントラストの強い色(明るい文字には黒,暗い文字には白)を求めます;自動はテーマの明暗と背景プラグインの明暗に追従します。',
        'custom.strokeWidth': '縁取りの太さ',
        'custom.strokeColor': '縁取りの色',
        'custom.strokeColor.auto': '自動',
        'custom.weak': '弱',
        'custom.medium': '中',
        'custom.strong': '強',
        'custom.icon': 'アイコン',
        'custom.icon.solid': '塗りつぶしフォルダー',
        'custom.icon.outline': '枠線フォルダー',
        'custom.icon.none': '表示しない',
        'custom.none': 'なし',
        'custom.reset': 'カスタマイズを解除',
        'custom.done': '完了',
        'settings.on': 'オン',
        'settings.off': 'オフ',
        'sync.title': 'デバイス間の同期',
      'sync.desc': "外観のカスタマイズとトグルはこのデバイスのブラウザに保存され、ホスト設定ストアを通じてもう一方の面(ウェブ/デスクトップアプリ)とやり取りします。新しい変更は自動的にホストへ書き込まれ、もう一方は取得するだけです。このバージョンより前のデータは一度だけ明示的に送信する必要があります。",
        'sync.mode.overwrite': 'このデバイスを上書き',
        'sync.mode.merge': '両方を統合',
        'sync.pull.desktop': 'デスクトップアプリから取得',
        'sync.pull.web': 'Web から取得',
        'sync.push': 'このデバイスのデータを送信',
        'sync.done': '同期しました',
        'sync.empty': 'もう一方に取得できるデータがありません',
        'sync.off': 'この環境では同期できません(ホスト設定サービスが必要)',
        'sync.loading': 'ホスト設定に接続中…',
        'flow.creating': '作成中…',
        'add.guide.title': "アプリ内でワークスペースを追加",
        'add.guide': "このホストにはデスクトップのフォルダー選択画面がありません。「新規セッション」ページの公式の「ワークスペースを追加」から開いてください。",
        'heroPicker.error.title': "ワークスペースを追加できません",
        'heroPicker.retry': "再試行",
        'error.title': 'エラーが発生しました',
        'cancel': 'キャンセル',
        'create': '作成',
        'confirm': 'OK',
        'close': '閉じる',
        'ws.rename.title': 'ワークスペース名を変更',
        'ws.rename.hint': '名前に含まれる / が階層グループになります(例: web/frontend)',
        'ws.delete.title': 'ワークスペースを削除',
        'ws.delete.body': 'ワークスペースの登録だけを削除します,ディレクトリとセッション記録は残ります。「{name}」を削除しますか?',
        'folder.rename.title': 'フォルダー名を変更',
        'folder.rename.hint': '名前を変更すると,フォルダー内のすべてのワークスペース名も更新されます',
        'folder.error.empty': 'フォルダーのパスを入力してください',
        'group.move.title': 'グループに移動',
        'group.pick': '既存のグループを選択',
        'group.new': '新しいグループ',
        'group.new.title': "新しいグループ",
        'group.new.sess': "セッショングループ",
        'group.new.ws': "ワークスペースグループ",
        'group.new.both': "新しいセッション／ワークスペースグループ",
        'group.new.where': "作成先を選択",
        'group.new.placeholder': "グループ名、/ で入れ子",
        'group.new.nameHint': "/ でさらに深い階層になります(例: frontend/components)",
        'group.new.empty': "グループ名を入力してください",
        'group.new.root': "最上位",
        'group.new.independent': "最上位に新しいグループ",
        'group.new.pickWorkspace': "ワークスペースを選択",
        'group.new.noWorkspace': "ワークスペースがありません。先に追加してください",
        'group.new.pickFirst': "先にワークスペースを選択してください",
        'group.delete.title': "グループを削除",
        'group.delete.body': "「{name}」は空のグループです。削除すると元に戻せません。",
        'menu.deleteGroup': "グループを削除",
      },
      /* locale: ko */
      'ko': {
        'title': '워크스페이스',
        'search.placeholder': '워크스페이스 또는 세션 검색',
        'add': '워크스페이스 추가',
        'rail.search': '검색',
        'rail.add': '워크스페이스 추가',
        'empty': '워크스페이스가 없습니다',
        'empty.search': '일치하는 결과가 없습니다',
        'session.new': '새 세션',
        'viewOptions.label': '보기 옵션',
        'viewOptions.groupBy': '그룹화',
        'viewOptions.byWorkspace': '작업 공간별',
        'viewOptions.byWorkspaceTree': '작업 공간 트리별',
        'viewOptions.flat': '하나의 목록',
        'viewOptions.orderBy': '정렬',
        'viewOptions.manualOrder': '수동',
        'viewOptions.updatedOrder': '최근 업데이트',
        'viewOptions.sessionSlash': '세션을 "/"로 그룹화',
        'viewOptions.wsGroupBy': "작업 공간 그룹화",
        'viewOptions.wsByDisk': "디스크 폴더",
        'viewOptions.wsByDiskSlash': "디스크 + 이름",
        'viewOptions.wsBySlash': "이름만",
        'group.ungrouped': '미분류',
        'sessions.expand': '세션 {n}개 펼치기',
        'sessions.collapse': '접기',
        'time.now': '방금',
        'time.minutes': '{n}분',
        'time.hours': '{n}시간',
        'time.days': '{n}일',
        'time.months': '{n}개월',
        'time.years': '{n}년',
        'status.running': '생성 중',
        'status.completed': '완료됨',
        'status.approval': '승인 대기 중',
        'status.planReview': '계획 확인 대기 중',
        'status.question': '답변 대기 중',
        'status.subagents': '하위 에이전트 {n}개 실행 중',
        'schedule.active': '활성 예약 작업 있음',
        'menu.rename': '이름 바꾸기',
        'menu.delete': '삭제',
        'menu.fork': '포크',
        'menu.archive': '보관',
        'menu.renameFolder': '폴더 이름 바꾸기',
        'menu.renameSgroup': '세션 그룹 이름 바꾸기',
        'menu.moveToGroup': '그룹으로 이동…',
        'menu.moveOutGroup': '그룹에서 제거',
        'settings.title': '더 나은 워크스페이스',
        'settings.desc': '워크스페이스 트리의 모양과 접기 설정',
        'settings.expand': '펼치기',
        'settings.collapse': '접기',
        'settings.compactChains': '단일 체인을 한 줄로 접기',
        'settings.compactChains.hint': '자식이 하나뿐인 단계는 한 줄로 합쳐지고, 자식이 여러 개면 트리로 펼쳐집니다; 워크스페이스를 끌어 놓는 동안에는 체인이 잠시 폴더 트리로 펼쳐져 어느 단계에나 놓을 수 있습니다; 펼침 상태와 사용자 지정 모양은 이 브라우저에 저장됩니다.',
        'settings.statusPulse': '상태 표시등',
        'settings.statusPulse.hint': '접혀서 가려진 상태 표시(완료는 초록 / 실행은 파랑 / 대기는 호박색)가 상위 단계로 번집니다: 워크스페이스와 폴더 행은 아이콘이 상태 색으로 깜빡이고(글로우를 지정한 제목도 함께 깜빡임), 세션 그룹 행에는 깜빡이는 상태 점이 표시됩니다; 기본값은 켜짐이며 여기서 끌 수 있습니다.',
        'settings.workspaceGroup': "작업 공간 그룹화",
        'settings.workspaceGroup.hint': "디스크 폴더: 공식 폴더(디스크 디렉터리)로만 중첩합니다. 디스크 + 이름: 디스크 트리 위에 슬래시 이름 그룹을 얹습니다. 이름만: 제목의 슬래시로만 그룹화하고 디스크 중첩은 무시합니다. 이전 버전 스위치 상태는 자동으로 이전됩니다.",
        'settings.sessionLimit': "펼칠 때 표시할 세션",
        'settings.sessionLimit.all': "전체",
        'settings.sessionLimit.hint': "펼친 작업 공간은 최근 세션을 먼저 보여주고 나머지는 더보기 행 뒤에 둡니다. 고정, 실행 중, 대기 중인 세션은 항상 표시됩니다. 전체 = 제한 없음(기본값).",
        'settings.sessionMenu': "세션 우클릭 메뉴",
        'settings.sessionMenu.hint': "켬: 세션 행을 우클릭하면 작업 메뉴가 열립니다(공식 고정, 보관, 중지 후 보관 포함). 끔: 행에 마우스를 올리면 공식 스타일의 ⋯ 버튼이 표시되어 같은 메뉴를 엽니다. 기본값은 켬.",
        'settings.rowActions': "세션 행 호버 버튼",
        'settings.rowActions.hint': "세션 행에 마우스를 올리면 행 끝에 고정 / 보관 빠른 버튼을 표시하여 공식 행과 일치시킵니다. 끔: 이 작업들은 메뉴에만 남습니다. 기본값은 켬.",
        'settings.appearance': '기본 모양',
        'settings.appearance.hint': '따로 지정하지 않은 행에 적용되는 모양입니다; 글자 외곽선은 기본으로 켜져 있습니다——배경 이미지 위에서는 외곽선 없는 글자가 잘 보이지 않기 때문입니다. 색을 비우면 테마를 따릅니다.',
        'settings.appearance.reset': '기본 모양으로 되돌리기',
        'custom.title': '모양 사용자 지정',
        'custom.color': '색',
        'custom.glow': '글로우',
        'custom.preview': '실시간 미리보기',
        'custom.preview.sample': '워크스페이스 예시',
        'custom.weight': '글자 굵기',
        'custom.weight.regular': '보통',
        'custom.weight.medium': '중간',
        'custom.weight.semibold': '준굵게',
        'custom.weight.bold': '굵게',
        'custom.shadow': '글자 그림자',
        'custom.stroke': '글자 외곽선',
        'custom.stroke.hint': '외곽선 색은 기본적으로 회색입니다; 검정 / 흰색 / 원하는 색으로 바꿀 수 있고, 「자동」을 고르면 글자 색에서 대비가 큰 색(밝은 글자에는 검정, 어두운 글자에는 흰색)을 계산합니다; 자동은 테마의 밝고 어두움과 배경 플러그인의 명암 전환을 따릅니다.',
        'custom.strokeWidth': '외곽선 두께',
        'custom.strokeColor': '외곽선 색',
        'custom.strokeColor.auto': '자동',
        'custom.weak': '약',
        'custom.medium': '중간',
        'custom.strong': '강',
        'custom.icon': '아이콘',
        'custom.icon.solid': '채운 폴더',
        'custom.icon.outline': '빈 폴더',
        'custom.icon.none': '표시 안 함',
        'custom.none': '없음',
        'custom.reset': '사용자 지정 해제',
        'custom.done': '완료',
        'settings.on': '켜기',
        'settings.off': '끄기',
        'sync.title': '기기 간 동기화',
      'sync.desc': "외관 사용자 지정과 토글은 이 기기의 브라우저에 저장되며, 호스트 설정 저장소를 통해 다른 표면(웹 / 데스크톱 앱)과 주고받습니다. 새 변경 사항은 자동으로 호스트에 기록되고 다른 표면은 가져오기만 하면 됩니다. 이 버전 이전의 데이터는 한 번 명시적으로 보내야 합니다.",
        'sync.mode.overwrite': '이 기기 덮어쓰기',
        'sync.mode.merge': '양쪽 병합',
        'sync.pull.desktop': '데스크톱 앱에서 가져오기',
        'sync.pull.web': 'Web 에서 가져오기',
        'sync.push': '이 기기 데이터 보내기',
        'sync.done': '동기화됨',
        'sync.empty': '반대쪽에 가져올 데이터가 없습니다',
        'sync.off': '이 환경에서는 동기화할 수 없습니다(호스트 설정 서비스 필요)',
        'sync.loading': '호스트 설정에 연결하는 중…',
        'flow.creating': '만드는 중…',
        'add.guide.title': "앱에서 워크스페이스 추가",
        'add.guide': "이 호스트에는 데스크톱 폴더 선택기가 없습니다. 새 세션 페이지의 공식 \"워크스페이스 추가\" 항목을 사용하세요.",
        'heroPicker.error.title': "워크스페이스를 추가할 수 없습니다",
        'heroPicker.retry': "다시 시도",
        'error.title': '문제가 발생했습니다',
        'cancel': '취소',
        'create': '만들기',
        'confirm': '확인',
        'close': '닫기',
        'ws.rename.title': '워크스페이스 이름 바꾸기',
        'ws.rename.hint': '이름에 있는 / 가 단계 그룹이 됩니다(예: web/frontend)',
        'ws.delete.title': '워크스페이스 삭제',
        'ws.delete.body': '워크스페이스 등록만 제거하며 디렉터리와 세션 기록은 그대로 남습니다. 「{name}」을(를) 삭제할까요?',
        'folder.rename.title': '폴더 이름 바꾸기',
        'folder.rename.hint': '이름을 바꾸면 폴더 안 모든 워크스페이스 이름도 함께 바뀝니다',
        'folder.error.empty': '폴더 경로를 입력해야 합니다',
        'group.move.title': '그룹으로 이동',
        'group.pick': '기존 그룹 선택',
        'group.new': '새 그룹',
        'group.new.title': "새 그룹",
        'group.new.sess': "세션 그룹",
        'group.new.ws': "워크스페이스 그룹",
        'group.new.both': "새 세션 또는 워크스페이스 그룹",
        'group.new.where': "만들 위치 선택",
        'group.new.placeholder': "그룹 이름, \"/\"로 중첩",
        'group.new.nameHint': "\"/\"로 더 깊은 단계, 예: frontend/components",
        'group.new.empty': "그룹 이름을 입력하세요",
        'group.new.root': "최상위",
        'group.new.independent': "최상위 새 그룹",
        'group.new.pickWorkspace': "워크스페이스 선택",
        'group.new.noWorkspace': "워크스페이스가 없습니다. 먼저 추가하세요",
        'group.new.pickFirst': "먼저 워크스페이스를 선택하세요",
        'group.delete.title': "그룹 삭제",
        'group.delete.body': "\"{name}\"은(는) 빈 그룹입니다. 삭제하면 되돌릴 수 없습니다.",
        'menu.deleteGroup': "그룹 삭제",
      },
      /* locale: nl */
      'nl': {
        'title': 'Werkruimten',
        'search.placeholder': 'Werkruimten of sessies zoeken',
        'add': 'Werkruimte toevoegen',
        'rail.search': 'Zoeken',
        'rail.add': 'Werkruimte toevoegen',
        'empty': 'Nog geen werkruimten',
        'empty.search': 'Geen resultaten',
        'session.new': 'Nieuwe sessie',
        'viewOptions.label': 'Weergaveopties',
        'viewOptions.groupBy': 'Groeperen op',
        'viewOptions.byWorkspace': 'Werkruimtes',
        'viewOptions.byWorkspaceTree': 'Werkruimteboom',
        'viewOptions.flat': 'In één lijst',
        'viewOptions.orderBy': 'Sorteren op',
        'viewOptions.manualOrder': 'Handmatig',
        'viewOptions.updatedOrder': 'Laatst bijgewerkt',
        'viewOptions.sessionSlash': 'Sessies groeperen op "/"',
        'viewOptions.wsGroupBy': "Werkruimtes groeperen",
        'viewOptions.wsByDisk': "Schijfmappen",
        'viewOptions.wsByDiskSlash': "Schijf + namen",
        'viewOptions.wsBySlash': "Alleen namen",
        'group.ungrouped': 'Zonder groep',
        'sessions.expand': '{n} sessies uitklappen',
        'sessions.collapse': 'Inklappen',
        'time.now': 'zojuist',
        'time.minutes': '{n} min.',
        'time.hours': '{n} u',
        'time.days': '{n} d',
        'time.months': '{n} mnd',
        'time.years': '{n} j',
        'status.running': 'Wordt gegenereerd',
        'status.completed': 'Voltooid',
        'status.approval': 'Wacht op goedkeuring',
        'status.planReview': 'Wacht op planbevestiging',
        'status.question': 'Wacht op antwoord',
        'status.subagents': '{n} subagenten actief',
        'schedule.active': 'Actieve geplande taak',
        'menu.rename': 'Naam wijzigen',
        'menu.delete': 'Verwijderen',
        'menu.fork': 'Afsplitsen',
        'menu.archive': 'Archiveren',
        'menu.renameFolder': 'Mapnaam wijzigen',
        'menu.renameSgroup': 'Sessiegroep naam wijzigen',
        'menu.moveToGroup': 'Naar groep verplaatsen…',
        'menu.moveOutGroup': 'Uit groep halen',
        'settings.title': 'Betere werkruimten',
        'settings.desc': 'Uiterlijk en inklapgedrag van de werkruimteboom',
        'settings.expand': 'Uitklappen',
        'settings.collapse': 'Inklappen',
        'settings.compactChains': 'Enkelvoudige ketens samenvoegen',
        'settings.compactChains.hint': 'Niveaus met één kind worden tot één regel samengevoegd; bij meerdere kinderen klapt de boom open; tijdens het slepen van een werkruimte klappen de ketens tijdelijk terug naar mappen, zodat je op elk niveau kunt neerzetten; de uitgeklapte staat en het eigen uiterlijk blijven in deze browser bewaard.',
        'settings.statusPulse': 'Pulserend statuslampje',
        'settings.statusPulse.hint': 'Statuslampjes die door het inklappen verborgen zijn (voltooid groen / actief blauw / wachtend amber) borrelen door de hiërarchie omhoog: werkruimte- en mapregels laten hun pictogram in de statuskleur pulseren (titels met eigen gloed pulseren mee), sessiegroepregels tonen een pulserend statusstipje; standaard aan, hier uit te zetten.',
        'settings.workspaceGroup': "Werkruimtegroepering",
        'settings.workspaceGroup.hint': "Schijfmappen: nest alleen volgens de officiële mappen (schijfdirectories). Schijf + namen: stapelt naamgroepen bovenop de schijfboom. Alleen namen: groept puur op schuine strepen in titels en negeert schijfnesting. De oude schakelaarstand migreert automatisch.",
        'settings.sessionLimit': "Sessies bij uitklappen",
        'settings.sessionLimit.all': "Alles",
        'settings.sessionLimit.hint': "Een uitgeklapte werkruimte toont eerst de nieuwste sessies, de rest achter een toon-meer rij; vastgemaakte, lopende en op u wachtende sessies blijven altijd zichtbaar. Alles = onbeperkt (standaard).",
        'settings.sessionMenu': "Sessie-contextmenu",
        'settings.sessionMenu.hint': "Aan: rechtermuisklik op een sessierij opent het actiemenu (inclusief officieel vastmaken, archiveren en stoppen-en-archiveren). Uit: bij aanwijzen verschijnt in plaats daarvan de officiële ⋯-knop aan het rij-einde, die hetzelfde menu opent. Standaard aan.",
        'settings.rowActions': "Sessierij-snelknoppen",
        'settings.rowActions.hint': "Toont snelknoppen voor vastmaken / archiveren aan het einde van een aangewezen sessierij, gelijk aan de officiële rijen. Uit: deze acties blijven alleen in het menu. Standaard aan.",
        'settings.appearance': 'Standaarduiterlijk',
        'settings.appearance.hint': 'Regels zonder eigen aanpassing gebruiken dit uiterlijk; de tekstomtrek staat standaard aan — zonder omtrek is tekst op een achtergrondafbeelding vaak slecht leesbaar. Laat de kleur leeg om het thema te volgen.',
        'settings.appearance.reset': 'Standaarduiterlijk herstellen',
        'custom.title': 'Uiterlijk aanpassen',
        'custom.color': 'Kleur',
        'custom.glow': 'Gloed',
        'custom.preview': 'Live voorbeeld',
        'custom.preview.sample': 'Voorbeeldwerkruimte',
        'custom.weight': 'Letterdikte',
        'custom.weight.regular': 'Normaal',
        'custom.weight.medium': 'Medium',
        'custom.weight.semibold': 'Halfvet',
        'custom.weight.bold': 'Vet',
        'custom.shadow': 'Tekstschaduw',
        'custom.stroke': 'Tekstomtrek',
        'custom.stroke.hint': 'De omtrek is standaard grijs; kies zwart / wit / een willekeurige kleur, of «Automatisch» om het contrasterende uiterste uit de tekstkleur af te leiden (lichte tekst krijgt een zwarte rand, donkere een witte); Automatisch volgt het licht/donker van het thema en van een achtergrondplugin.',
        'custom.strokeWidth': 'Omtrekdikte',
        'custom.strokeColor': 'Omtrekkleur',
        'custom.strokeColor.auto': 'Automatisch',
        'custom.weak': 'Zwak',
        'custom.medium': 'Medium',
        'custom.strong': 'Sterk',
        'custom.icon': 'Pictogram',
        'custom.icon.solid': 'Gevulde map',
        'custom.icon.outline': 'Omtrekmap',
        'custom.icon.none': 'Verborgen',
        'custom.none': 'Geen',
        'custom.reset': 'Aanpassing wissen',
        'custom.done': 'Klaar',
        'settings.on': 'Aan',
        'settings.off': 'Uit',
        'sync.title': 'Synchronisatie tussen apparaten',
      'sync.desc': "Aanpassingen van het uiterlijk en schakelaars leven in de browser van dit apparaat; ze worden via de host-instellingenopslag uitgewisseld met het andere oppervlak (web / desktop-app). Nieuwe wijzigingen worden automatisch naar de host geschreven — het andere oppervlak hoeft alleen op te halen. Gegevens van vóór deze versie vereisen eenmalig versturen.",
        'sync.mode.overwrite': 'Dit apparaat overschrijven',
        'sync.mode.merge': 'Beide kanten samenvoegen',
        'sync.pull.desktop': 'Ophalen uit desktopapp',
        'sync.pull.web': 'Ophalen uit web',
        'sync.push': 'Gegevens van dit apparaat verzenden',
        'sync.done': 'Gesynchroniseerd',
        'sync.empty': 'Aan de andere kant staan nog geen gegevens',
        'sync.off': 'Synchronisatie is hier niet beschikbaar (hostinstellingenservice nodig)',
        'sync.loading': 'Verbinden met hostinstellingen…',
        'flow.creating': 'Bezig met aanmaken…',
        'add.guide.title': "Werkruimte in de app toevoegen",
        'add.guide': "Deze host heeft geen systeemmapkiezer. Gebruik de officiële optie \"Werkruimte toevoegen\" op de pagina Nieuwe sessie.",
        'heroPicker.error.title': "Kan werkruimte niet toevoegen",
        'heroPicker.retry': "Opnieuw proberen",
        'error.title': 'Er is iets misgegaan',
        'cancel': 'Annuleren',
        'create': 'Aanmaken',
        'confirm': 'OK',
        'close': 'Sluiten',
        'ws.rename.title': 'Werkruimte naam wijzigen',
        'ws.rename.hint': 'Een / in de naam maakt de groepslaag, bijv. web/frontend',
        'ws.delete.title': 'Werkruimte verwijderen',
        'ws.delete.body': 'Alleen de registratie wordt verwijderd; de map en sessielogs blijven bestaan. «{name}» verwijderen?',
        'folder.rename.title': 'Mapnaam wijzigen',
        'folder.rename.hint': 'Naam wijzigen werkt alle werkruimtenamen in de map bij',
        'folder.error.empty': 'Het mappad mag niet leeg zijn',
        'group.move.title': 'Naar groep verplaatsen',
        'group.pick': 'Bestaande groep kiezen',
        'group.new': 'Nieuwe groep',
        'group.new.title': "Nieuwe groep",
        'group.new.sess': "Sessiegroep",
        'group.new.ws': "Werkruimtegroep",
        'group.new.both': "Nieuwe sessie- of werkruimtegroep",
        'group.new.where': "Kies waar je maakt",
        'group.new.placeholder': "Groepsnaam, \"/\" nest",
        'group.new.nameHint': "Een \"/\" nest dieper, bijv. frontend/components",
        'group.new.empty': "Voer een groepsnaam in",
        'group.new.root': "Bovenste niveau",
        'group.new.independent': "Nieuwe groep op hoogste niveau",
        'group.new.pickWorkspace': "Kies een werkruimte",
        'group.new.noWorkspace': "Nog geen werkruimten — voeg er eerst een toe",
        'group.new.pickFirst': "Kies eerst een werkruimte",
        'group.delete.title': "Groep verwijderen",
        'group.delete.body': "\"{name}\" is een lege groep; verwijderen kan niet ongedaan worden gemaakt.",
        'menu.deleteGroup': "Groep verwijderen",
      },
      /* locale: pl */
      'pl': {
        'title': 'Obszary robocze',
        'search.placeholder': 'Szukaj obszarów roboczych lub sesji',
        'add': 'Dodaj obszar roboczy',
        'rail.search': 'Szukaj',
        'rail.add': 'Dodaj obszar roboczy',
        'empty': 'Brak obszarów roboczych',
        'empty.search': 'Brak wyników',
        'session.new': 'Nowa sesja',
        'viewOptions.label': 'Opcje widoku',
        'viewOptions.groupBy': 'Grupuj według',
        'viewOptions.byWorkspace': 'Obszary robocze',
        'viewOptions.byWorkspaceTree': 'Drzewo obszarów',
        'viewOptions.flat': 'Jedna lista',
        'viewOptions.orderBy': 'Sortuj według',
        'viewOptions.manualOrder': 'Ręcznie',
        'viewOptions.updatedOrder': 'Ostatnia aktualizacja',
        'viewOptions.sessionSlash': 'Grupuj sesje po "/"',
        'viewOptions.wsGroupBy': "Grupowanie obszarów",
        'viewOptions.wsByDisk': "Foldery dysku",
        'viewOptions.wsByDiskSlash': "Dysk + nazwy",
        'viewOptions.wsBySlash': "Tylko nazwy",
        'group.ungrouped': 'Bez grupy',
        'sessions.expand': 'Pokaż {n} sesji',
        'sessions.collapse': 'Zwiń',
        'time.now': 'przed chwilą',
        'time.minutes': '{n} min',
        'time.hours': '{n} godz.',
        'time.days': '{n} dni',
        'time.months': '{n} mies.',
        'time.years': '{n} lat',
        'status.running': 'Generowanie',
        'status.completed': 'Ukończono',
        'status.approval': 'Czeka na zatwierdzenie',
        'status.planReview': 'Czeka na potwierdzenie planu',
        'status.question': 'Czeka na odpowiedź',
        'status.subagents': '{n} podagentów w toku',
        'schedule.active': 'Aktywne zadanie zaplanowane',
        'menu.rename': 'Zmień nazwę',
        'menu.delete': 'Usuń',
        'menu.fork': 'Rozgałęź',
        'menu.archive': 'Zarchiwizuj',
        'menu.renameFolder': 'Zmień nazwę folderu',
        'menu.renameSgroup': 'Zmień nazwę grupy sesji',
        'menu.moveToGroup': 'Przenieś do grupy…',
        'menu.moveOutGroup': 'Przenieś poza grupę',
        'settings.title': 'Lepsze obszary robocze',
        'settings.desc': 'Wygląd i zwijanie drzewa obszarów roboczych',
        'settings.expand': 'Rozwiń',
        'settings.collapse': 'Zwiń',
        'settings.compactChains': 'Scal łańcuchy z jednym dzieckiem',
        'settings.compactChains.hint': 'Poziomy z jednym dzieckiem scalają się w jeden wiersz; przy większej liczbie dzieci drzewo się rozwija; podczas przeciągania obszaru roboczego łańcuchy tymczasowo rozwijają się do folderów, więc upuszczenie działa na każdym poziomie; stan rozwinięcia i własny wygląd są zapisywane w tej przeglądarce.',
        'settings.statusPulse': 'Pulsująca lampka stanu',
        'settings.statusPulse.hint': 'Lampki ukryte przez zwinięcie (ukończono zielona / trwa niebieska / czeka bursztynowa) bąbelkują w górę hierarchii: wiersze obszarów roboczych i folderów pulsują ikoną w kolorze stanu (tytuły z własną poświatą pulsują razem), wiersze grup sesji pokazują pulsującą kropkę stanu; domyślnie włączone, tutaj można wyłączyć.',
        'settings.workspaceGroup': "Grupowanie obszarów roboczych",
        'settings.workspaceGroup.hint': "Foldery dysku: zagnieżdżanie wyłącznie według oficjalnych folderów (katalogów dysku). Dysk + nazwy: dokłada grupy nazw nad drzewem dysku. Tylko nazwy: grupuje wyłącznie po ukośnikach w tytułach, ignorując zagnieżdżanie dyskowe. Stan starego przełącznika migruje automatycznie.",
        'settings.sessionLimit': "Sesje po rozwinięciu",
        'settings.sessionLimit.all': "Wszystkie",
        'settings.sessionLimit.hint': "Rozwinięty obszar pokazuje najpierw najnowsze sesje, reszta czeka za wierszem pokaż-więcej; przypięte, uruchomione i czekające sesje są zawsze widoczne. Wszystkie = bez limitu (domyślnie).",
        'settings.sessionMenu': "Menu kontekstowe sesji",
        'settings.sessionMenu.hint': "Włączone: kliknięcie prawym przyciskiem wiersza sesji otwiera jego menu akcji (w tym oficjalne przypinanie, archiwizację i zatrzymanie z archiwizacją). Wyłączone: przy najechaniu wiersz pokazuje oficjalny przycisk ⋯ otwierający to samo menu. Domyślnie włączone.",
        'settings.rowActions': "Przyciski najechania wiersza sesji",
        'settings.rowActions.hint': "Pokazuje szybkie przyciski przypnij / archiwizuj na końcu najechanego wiersza sesji, jak w oficjalnych wierszach. Wyłączone: te akcje zostają tylko w menu. Domyślnie włączone.",
        'settings.appearance': 'Domyślny wygląd',
        'settings.appearance.hint': 'Wiersze bez własnych ustawień używają tego wyglądu; obrys tekstu jest domyślnie włączony — bez niego tekst na obrazie tła bywa nieczytelny. Puste pole koloru oznacza podążanie za motywem.',
        'settings.appearance.reset': 'Przywróć domyślny wygląd',
        'custom.title': 'Dostosuj wygląd',
        'custom.color': 'Kolor',
        'custom.glow': 'Poświata',
        'custom.preview': 'Podgląd na żywo',
        'custom.preview.sample': 'Przykładowy obszar roboczy',
        'custom.weight': 'Grubość czcionki',
        'custom.weight.regular': 'Zwykła',
        'custom.weight.medium': 'Średnia',
        'custom.weight.semibold': 'Półgruba',
        'custom.weight.bold': 'Pogrubiona',
        'custom.shadow': 'Cień tekstu',
        'custom.stroke': 'Obrys tekstu',
        'custom.stroke.hint': 'Obrys jest domyślnie szary; można wybrać czerń / biel / dowolny kolor albo „Automatycznie”, co wylicza kontrastowy biegun z koloru tekstu (jasny tekst dostaje czarną krawędź, ciemny białą); automat podąża za motywem i jasnością interfejsu wtyczki tła.',
        'custom.strokeWidth': 'Grubość obrysu',
        'custom.strokeColor': 'Kolor obrysu',
        'custom.strokeColor.auto': 'Automatycznie',
        'custom.weak': 'Słaby',
        'custom.medium': 'Średni',
        'custom.strong': 'Silny',
        'custom.icon': 'Ikona',
        'custom.icon.solid': 'Wypełniony folder',
        'custom.icon.outline': 'Konturowy folder',
        'custom.icon.none': 'Ukryta',
        'custom.none': 'Brak',
        'custom.reset': 'Wyczyść dostosowanie',
        'custom.done': 'Gotowe',
        'settings.on': 'Wł.',
        'settings.off': 'Wył.',
        'sync.title': 'Synchronizacja między urządzeniami',
      'sync.desc': "Dostosowania wyglądu i przełączniki żyją w przeglądarce tego urządzenia; wymieniają się z drugą powierzchnią (web / aplikacja desktop) przez magazyn ustawień hosta. Nowe zmiany są zapisywane do hosta automatycznie — druga powierzchnia tylko pobiera. Dane sprzed tej wersji wymagają jednorazowego wysłania.",
        'sync.mode.overwrite': 'Nadpisz to urządzenie',
        'sync.mode.merge': 'Scal obie strony',
        'sync.pull.desktop': 'Pobierz z aplikacji desktopowej',
        'sync.pull.web': 'Pobierz z web',
        'sync.push': 'Wyślij dane tego urządzenia',
        'sync.done': 'Zsynchronizowano',
        'sync.empty': 'Druga strona nie ma jeszcze danych',
        'sync.off': 'Synchronizacja niedostępna (wymaga usługi ustawień hosta)',
        'sync.loading': 'Łączenie z ustawieniami hosta…',
        'flow.creating': 'Tworzenie…',
        'add.guide.title': "Dodaj obszar roboczy w aplikacji",
        'add.guide': "Ten host nie ma systemowego wyboru folderów. Użyj oficjalnej pozycji „Dodaj obszar roboczy” na stronie Nowa sesja.",
        'heroPicker.error.title': "Nie można dodać obszaru roboczego",
        'heroPicker.retry': "Ponów",
        'error.title': 'Coś poszło nie tak',
        'cancel': 'Anuluj',
        'create': 'Utwórz',
        'confirm': 'OK',
        'close': 'Zamknij',
        'ws.rename.title': 'Zmień nazwę obszaru roboczego',
        'ws.rename.hint': '/ w nazwie tworzy grupę, np. web/frontend',
        'ws.delete.title': 'Usuń obszar roboczy',
        'ws.delete.body': 'Usuwane jest tylko zgłoszenie; katalog i dzienniki sesji zostają. Usunąć „{name}”?',
        'folder.rename.title': 'Zmień nazwę folderu',
        'folder.rename.hint': 'Zmiana nazwy zaktualizuje wszystkie obszary robocze w folderze',
        'folder.error.empty': 'Ścieżka folderu nie może być pusta',
        'group.move.title': 'Przenieś do grupy',
        'group.pick': 'Wybierz istniejącą grupę',
        'group.new': 'Nowa grupa',
        'group.new.title': "Nowa grupa",
        'group.new.sess': "Grupa sesji",
        'group.new.ws': "Grupa obszarów roboczych",
        'group.new.both': "Nowa grupa sesji lub obszarów roboczych",
        'group.new.where': "Wybierz miejsce utworzenia",
        'group.new.placeholder': "Nazwa grupy, „/” zagnieżdża",
        'group.new.nameHint': "„/” zagnieżdża głębiej, np. frontend/components",
        'group.new.empty': "Podaj nazwę grupy",
        'group.new.root': "Najwyższy poziom",
        'group.new.independent': "Nowa grupa najwyższego poziomu",
        'group.new.pickWorkspace': "Wybierz obszar roboczy",
        'group.new.noWorkspace': "Brak obszarów roboczych — najpierw dodaj jeden",
        'group.new.pickFirst': "Najpierw wybierz obszar roboczy",
        'group.delete.title': "Usuń grupę",
        'group.delete.body': "„{name}” to pusta grupa; usunięcia nie można cofnąć.",
        'menu.deleteGroup': "Usuń grupę",
      },
      /* locale: pt */
      'pt': {
        'title': 'Espaços de trabalho',
        'search.placeholder': 'Pesquisar espaços de trabalho ou sessões',
        'add': 'Adicionar espaço de trabalho',
        'rail.search': 'Pesquisar',
        'rail.add': 'Adicionar espaço de trabalho',
        'empty': 'Nenhum espaço de trabalho',
        'empty.search': 'Nenhum resultado',
        'session.new': 'Nova sessão',
        'viewOptions.label': 'Opções de vista',
        'viewOptions.groupBy': 'Agrupar por',
        'viewOptions.byWorkspace': 'Áreas de trabalho',
        'viewOptions.byWorkspaceTree': 'Árvore de áreas',
        'viewOptions.flat': 'Numa lista',
        'viewOptions.orderBy': 'Ordenar por',
        'viewOptions.manualOrder': 'Manual',
        'viewOptions.updatedOrder': 'Atualização recente',
        'viewOptions.sessionSlash': 'Agrupar sessões por "/"',
        'viewOptions.wsGroupBy': "Agrupar espaços",
        'viewOptions.wsByDisk': "Pastas do disco",
        'viewOptions.wsByDiskSlash': "Disco + nomes",
        'viewOptions.wsBySlash': "Apenas nomes",
        'group.ungrouped': 'Sem grupo',
        'sessions.expand': 'Mostrar {n} sessões',
        'sessions.collapse': 'Recolher',
        'time.now': 'agora mesmo',
        'time.minutes': '{n} min',
        'time.hours': '{n} h',
        'time.days': '{n} d',
        'time.months': '{n} meses',
        'time.years': '{n} anos',
        'status.running': 'Gerando',
        'status.completed': 'Concluído',
        'status.approval': 'Aguardando aprovação',
        'status.planReview': 'Aguardando confirmação do plano',
        'status.question': 'Aguardando resposta',
        'status.subagents': '{n} subagentes em execução',
        'schedule.active': 'Tarefa agendada ativa',
        'menu.rename': 'Renomear',
        'menu.delete': 'Excluir',
        'menu.fork': 'Bifurcar',
        'menu.archive': 'Arquivar',
        'menu.renameFolder': 'Renomear pasta',
        'menu.renameSgroup': 'Renomear grupo de sessões',
        'menu.moveToGroup': 'Mover para o grupo…',
        'menu.moveOutGroup': 'Remover do grupo',
        'settings.title': 'Espaços de trabalho melhores',
        'settings.desc': 'Aparência e recolhimento da árvore de espaços de trabalho',
        'settings.expand': 'Expandir',
        'settings.collapse': 'Recolher',
        'settings.compactChains': 'Mesclar cadeias de filho único',
        'settings.compactChains.hint': 'Níveis com um único filho viram uma linha; com vários filhos a árvore se expande; ao arrastar um espaço de trabalho, as cadeias voltam temporariamente a pastas, permitindo soltar em qualquer nível; o estado de expansão e o estilo personalizado ficam neste navegador.',
        'settings.statusPulse': 'Luz de status pulsante',
        'settings.statusPulse.hint': 'As luzes escondidas pelo recolhimento (concluído verde / em execução azul / aguardando âmbar) sobem pela hierarquia: linhas de espaço de trabalho e pasta pulsam o ícone na cor do status (títulos com brilho personalizado pulsam junto), linhas de grupo de sessões mostram um ponto pulsante; ativado por padrão, pode ser desligado aqui.',
        'settings.workspaceGroup': "Agrupamento de espaços",
        'settings.workspaceGroup.hint': "Pastas do disco: aninhar apenas pelas pastas oficiais (diretórios de disco). Disco + nomes: acrescenta grupos de nomes sobre a árvore de disco. Apenas nomes: agrupa só pela barra nos títulos, ignorando o aninhamento de disco. O estado do interruptor antigo migra automaticamente.",
        'settings.sessionLimit': "Sessões ao expandir",
        'settings.sessionLimit.all': "Todas",
        'settings.sessionLimit.hint': "Um espaço expandido mostra primeiro as sessões mais recentes, o restante atrás de uma linha mostrar-mais; sessões fixadas, em execução e aguardando você permanecem visíveis. Todas = sem limite (predefinição).",
        'settings.sessionMenu': "Menu de contexto da sessão",
        'settings.sessionMenu.hint': "Ligado: clicar com o botão direito numa linha de sessão abre o menu de ações (incluindo fixar, arquivar e parar-e-arquivar oficiais). Desligado: a linha mostra o botão ⋯ oficial ao passar o cursor, abrindo o mesmo menu. Ligado por predefinição.",
        'settings.rowActions': "Botões de passagem da sessão",
        'settings.rowActions.hint': "Mostra botões rápidos de fixar / arquivar no fim da linha ao passar o cursor, como nas linhas oficiais. Desligado: essas ações ficam apenas no menu. Ligado por predefinição.",
        'settings.appearance': 'Aparência padrão',
        'settings.appearance.hint': 'Linhas sem personalização usam esta aparência; o contorno do texto vem ativado por padrão — sem ele, o texto costuma ficar ilegível sobre uma imagem de fundo. Deixe a cor vazia para seguir o tema.',
        'settings.appearance.reset': 'Restaurar aparência padrão',
        'custom.title': 'Personalizar aparência',
        'custom.color': 'Cor',
        'custom.glow': 'Brilho',
        'custom.preview': 'Prévia ao vivo',
        'custom.preview.sample': 'Espaço de trabalho de exemplo',
        'custom.weight': 'Espessura da fonte',
        'custom.weight.regular': 'Normal',
        'custom.weight.medium': 'Média',
        'custom.weight.semibold': 'Seminegrito',
        'custom.weight.bold': 'Negrito',
        'custom.shadow': 'Sombra do texto',
        'custom.stroke': 'Contorno do texto',
        'custom.stroke.hint': 'O contorno é cinza por padrão; dá para escolher preto / branco / qualquer cor, ou «Auto» para derivar o polo contrastante da cor do texto (texto claro ganha borda preta, escuro ganha branca); o Auto segue o tema e a alternância claro/escuro de um plugin de fundo.',
        'custom.strokeWidth': 'Espessura do contorno',
        'custom.strokeColor': 'Cor do contorno',
        'custom.strokeColor.auto': 'Auto',
        'custom.weak': 'Fraco',
        'custom.medium': 'Médio',
        'custom.strong': 'Forte',
        'custom.icon': 'Ícone',
        'custom.icon.solid': 'Pasta preenchida',
        'custom.icon.outline': 'Pasta vazada',
        'custom.icon.none': 'Oculta',
        'custom.none': 'Nenhum',
        'custom.reset': 'Limpar personalização',
        'custom.done': 'Concluir',
        'settings.on': 'Ativado',
        'settings.off': 'Desativado',
        'sync.title': 'Sincronização entre dispositivos',
      'sync.desc': "Personalizações de aparência e interruptores vivem no navegador deste dispositivo; eles trocam com a outra superfície (web / aplicativo de desktop) através do armazenamento de configurações do host. Novas edições são gravadas no host automaticamente — a outra superfície apenas puxa. Dados anteriores a esta versão precisam de um envio explícito.",
        'sync.mode.overwrite': 'Sobrescrever este dispositivo',
        'sync.mode.merge': 'Mesclar os dois lados',
        'sync.pull.desktop': 'Buscar do aplicativo de desktop',
        'sync.pull.web': 'Buscar da web',
        'sync.push': 'Enviar dados deste dispositivo',
        'sync.done': 'Sincronizado',
        'sync.empty': 'O outro lado ainda não tem dados',
        'sync.off': 'Sincronização indisponível aqui (requer o serviço de configurações do host)',
        'sync.loading': 'Conectando às configurações do host…',
        'flow.creating': 'Criando…',
        'add.guide.title': "Adicionar área de trabalho no app",
        'add.guide': "Este host não tem seletor de pastas do sistema. Use a entrada oficial \"Adicionar área de trabalho\" na página Nova sessão.",
        'heroPicker.error.title': "Não foi possível adicionar o espaço de trabalho",
        'heroPicker.retry': "Tentar novamente",
        'error.title': 'Algo deu errado',
        'cancel': 'Cancelar',
        'create': 'Criar',
        'confirm': 'OK',
        'close': 'Fechar',
        'ws.rename.title': 'Renomear espaço de trabalho',
        'ws.rename.hint': 'A / no nome cria o grupo, por exemplo web/frontend',
        'ws.delete.title': 'Excluir espaço de trabalho',
        'ws.delete.body': 'Apenas o registro é removido; o diretório e os logs de sessão são mantidos. Excluir «{name}»?',
        'folder.rename.title': 'Renomear pasta',
        'folder.rename.hint': 'Renomear atualiza todos os espaços de trabalho da pasta',
        'folder.error.empty': 'O caminho da pasta não pode ficar vazio',
        'group.move.title': 'Mover para o grupo',
        'group.pick': 'Escolher um grupo existente',
        'group.new': 'Novo grupo',
        'group.new.title': "Novo grupo",
        'group.new.sess': "Grupo de sessões",
        'group.new.ws': "Grupo de áreas de trabalho",
        'group.new.both': "Novo grupo de sessões ou áreas de trabalho",
        'group.new.where': "Escolha onde criar",
        'group.new.placeholder': "Nome do grupo, \"/\" aninha",
        'group.new.nameHint': "Uma \"/\" aninha mais, ex. frontend/components",
        'group.new.empty': "Digite um nome de grupo",
        'group.new.root': "Nível superior",
        'group.new.independent': "Novo grupo de nível superior",
        'group.new.pickWorkspace': "Escolha uma área de trabalho",
        'group.new.noWorkspace': "Ainda não há áreas de trabalho — adicione uma primeiro",
        'group.new.pickFirst': "Escolha uma área de trabalho primeiro",
        'group.delete.title': "Excluir grupo",
        'group.delete.body': "\"{name}\" é um grupo vazio; a exclusão não pode ser desfeita.",
        'menu.deleteGroup': "Excluir grupo",
      },
      /* locale: ru */
      'ru': {
        'title': 'Рабочие области',
        'search.placeholder': 'Поиск рабочих областей и сессий',
        'add': 'Добавить рабочую область',
        'rail.search': 'Поиск',
        'rail.add': 'Добавить рабочую область',
        'empty': 'Рабочих областей пока нет',
        'empty.search': 'Ничего не найдено',
        'session.new': 'Новая сессия',
        'viewOptions.label': 'Параметры вида',
        'viewOptions.groupBy': 'Группировка',
        'viewOptions.byWorkspace': 'По рабочим областям',
        'viewOptions.byWorkspaceTree': 'По дереву областей',
        'viewOptions.flat': 'Одним списком',
        'viewOptions.orderBy': 'Сортировка',
        'viewOptions.manualOrder': 'Вручную',
        'viewOptions.updatedOrder': 'По обновлению',
        'viewOptions.sessionSlash': 'Группировать сессии по «/»',
        'viewOptions.wsGroupBy': "Группировка рабочих областей",
        'viewOptions.wsByDisk': "Папки диска",
        'viewOptions.wsByDiskSlash': "Диск + имена",
        'viewOptions.wsBySlash': "Только имена",
        'group.ungrouped': 'Без группы',
        'sessions.expand': 'Показать ещё {n} сессий',
        'sessions.collapse': 'Свернуть',
        'time.now': 'только что',
        'time.minutes': '{n} мин',
        'time.hours': '{n} ч',
        'time.days': '{n} д',
        'time.months': '{n} мес.',
        'time.years': '{n} г.',
        'status.running': 'Генерация',
        'status.completed': 'Завершено',
        'status.approval': 'Ожидает подтверждения',
        'status.planReview': 'Ожидает проверки плана',
        'status.question': 'Ожидает ответа',
        'status.subagents': 'Выполняется субагентов: {n}',
        'schedule.active': 'Есть активная задача по расписанию',
        'menu.rename': 'Переименовать',
        'menu.delete': 'Удалить',
        'menu.fork': 'Ответвить',
        'menu.archive': 'В архив',
        'menu.renameFolder': 'Переименовать папку',
        'menu.renameSgroup': 'Переименовать группу сессий',
        'menu.moveToGroup': 'Переместить в группу…',
        'menu.moveOutGroup': 'Убрать из группы',
        'settings.title': 'Улучшенные рабочие области',
        'settings.desc': 'Внешний вид и сворачивание дерева рабочих областей',
        'settings.expand': 'Развернуть',
        'settings.collapse': 'Свернуть',
        'settings.compactChains': 'Объединять цепочки с одним потомком',
        'settings.compactChains.hint': 'Уровни с единственным потомком сливаются в одну строку; при нескольких потомках дерево разворачивается; во время перетаскивания рабочей области цепочки временно разворачиваются в папки, чтобы можно было положить элемент на любой уровень; состояние сворачивания и оформление хранятся в этом браузере.',
        'settings.statusPulse': 'Пульсирующий индикатор состояния',
        'settings.statusPulse.hint': 'Индикаторы, скрытые сворачиванием (завершено — зелёный / выполняется — синий / ожидает — янтарный), всплывают вверх по иерархии: строки рабочих областей и папок пульсируют значком в цвете состояния (заголовки со своим свечением пульсируют вместе с ними), строки групп сессий показывают пульсирующую точку; включено по умолчанию, здесь можно отключить.',
        'settings.workspaceGroup': "Группировка рабочих областей",
        'settings.workspaceGroup.hint': "Папки диска: вложенность только по официальным папкам (каталогам диска). Диск + имена: добавляет группы имён поверх дерева диска. Только имена: группирует лишь по косой черте в названиях, игнорируя вложенность диска. Состояние старого переключателя переносится автоматически.",
        'settings.sessionLimit': "Сессий при разворачивании",
        'settings.sessionLimit.all': "Все",
        'settings.sessionLimit.hint': "Развёрнутая область сначала показывает последние сессии, остальные — за строкой «показать ещё»; закреплённые, идущие и ожидающие вас сессии видны всегда. Все = без ограничения (по умолчанию).",
        'settings.sessionMenu': "Контекстное меню сессии",
        'settings.sessionMenu.hint': "Вкл: правый клик по строке сессии открывает меню действий (включая официальные закрепление, архивацию и «остановить и архивировать»). Выкл: при наведении в строке появляется официальная кнопка ⋯, открывающая то же меню. Включено по умолчанию.",
        'settings.rowActions': "Кнопки наведения строки сессии",
        'settings.rowActions.hint': "Показывает быстрые кнопки закрепить / архивировать в конце строки при наведении, как в официальных строках. Выкл: эти действия остаются только в меню. Включено по умолчанию.",
        'settings.appearance': 'Оформление по умолчанию',
        'settings.appearance.hint': 'Строки без своей настройки используют это оформление; обводка текста включена по умолчанию — без неё текст на фоновом изображении часто нечитаем. Пустой цвет означает следование теме.',
        'settings.appearance.reset': 'Вернуть оформление по умолчанию',
        'custom.title': 'Настроить оформление',
        'custom.color': 'Цвет',
        'custom.glow': 'Свечение',
        'custom.preview': 'Живой предпросмотр',
        'custom.preview.sample': 'Пример рабочей области',
        'custom.weight': 'Насыщенность шрифта',
        'custom.weight.regular': 'Обычная',
        'custom.weight.medium': 'Средняя',
        'custom.weight.semibold': 'Полужирная',
        'custom.weight.bold': 'Жирная',
        'custom.shadow': 'Тень текста',
        'custom.stroke': 'Обводка текста',
        'custom.stroke.hint': 'Обводка по умолчанию серая; можно выбрать чёрный / белый / любой цвет, а «Авто» выводит контрастный полюс из цвета текста (светлому тексту — чёрная кромка, тёмному — белая); авто следует за темой и переключением светлого/тёмного у плагина фона.',
        'custom.strokeWidth': 'Толщина обводки',
        'custom.strokeColor': 'Цвет обводки',
        'custom.strokeColor.auto': 'Авто',
        'custom.weak': 'Слабо',
        'custom.medium': 'Средне',
        'custom.strong': 'Сильно',
        'custom.icon': 'Значок',
        'custom.icon.solid': 'Залитая папка',
        'custom.icon.outline': 'Контурная папка',
        'custom.icon.none': 'Скрыт',
        'custom.none': 'Нет',
        'custom.reset': 'Сбросить настройку',
        'custom.done': 'Готово',
        'settings.on': 'Вкл.',
        'settings.off': 'Выкл.',
        'sync.title': 'Синхронизация между устройствами',
      'sync.desc': "Настройки внешнего вида и переключатели живут в браузере этого устройства; они обмениваются с другой поверхностью (веб / настольное приложение) через хранилище настроек хоста. Новые правки автоматически записываются на хост — другой поверхности остаётся только получить. Данные, созданные до этой версии, требуют одной явной отправки.",
        'sync.mode.overwrite': 'Перезаписать это устройство',
        'sync.mode.merge': 'Объединить обе стороны',
        'sync.pull.desktop': 'Получить из настольного приложения',
        'sync.pull.web': 'Получить из веба',
        'sync.push': 'Отправить данные этого устройства',
        'sync.done': 'Синхронизировано',
        'sync.empty': 'На другой стороне пока нет данных',
        'sync.off': 'Синхронизация недоступна (нужна служба настроек хоста)',
        'sync.loading': 'Подключение к настройкам хоста…',
        'flow.creating': 'Создание…',
        'add.guide.title': "Добавить рабочую область в приложении",
        'add.guide': "На этом хосте нет системного выбора папок. Используйте официальный пункт «Добавить рабочую область» на странице «Новый сеанс».",
        'heroPicker.error.title': "Не удалось добавить рабочую область",
        'heroPicker.retry': "Повторить",
        'error.title': 'Что-то пошло не так',
        'cancel': 'Отмена',
        'create': 'Создать',
        'confirm': 'ОК',
        'close': 'Закрыть',
        'ws.rename.title': 'Переименовать рабочую область',
        'ws.rename.hint': 'Символ / в имени задаёт группу, например web/frontend',
        'ws.delete.title': 'Удалить рабочую область',
        'ws.delete.body': 'Удаляется только регистрация; каталог и журналы сессий остаются. Удалить «{name}»?',
        'folder.rename.title': 'Переименовать папку',
        'folder.rename.hint': 'Переименование обновит все рабочие области в папке',
        'folder.error.empty': 'Путь папки не может быть пустым',
        'group.move.title': 'Переместить в группу',
        'group.pick': 'Выбрать существующую группу',
        'group.new': 'Новая группа',
        'group.new.title': "Новая группа",
        'group.new.sess': "Группа сеансов",
        'group.new.ws': "Группа рабочих областей",
        'group.new.both': "Новая группа сеансов или рабочих областей",
        'group.new.where': "Выберите место создания",
        'group.new.placeholder': "Имя группы, «/» вкладывает",
        'group.new.nameHint': "«/» вкладывает глубже, напр. frontend/components",
        'group.new.empty': "Введите имя группы",
        'group.new.root': "Верхний уровень",
        'group.new.independent': "Новая группа верхнего уровня",
        'group.new.pickWorkspace': "Выберите рабочую область",
        'group.new.noWorkspace': "Рабочих областей пока нет — сначала добавьте одну",
        'group.new.pickFirst': "Сначала выберите рабочую область",
        'group.delete.title': "Удалить группу",
        'group.delete.body': "«{name}» — пустая группа; удаление необратимо.",
        'menu.deleteGroup': "Удалить группу",
      },
      /* locale: sv */
      'sv': {
        'title': 'Arbetsytor',
        'search.placeholder': 'Sök arbetsytor eller sessioner',
        'add': 'Lägg till arbetsyta',
        'rail.search': 'Sök',
        'rail.add': 'Lägg till arbetsyta',
        'empty': 'Inga arbetsytor ännu',
        'empty.search': 'Inga träffar',
        'session.new': 'Ny session',
        'viewOptions.label': 'Visningsalternativ',
        'viewOptions.groupBy': 'Gruppera efter',
        'viewOptions.byWorkspace': 'Arbetsytor',
        'viewOptions.byWorkspaceTree': 'Arbetsyta-träd',
        'viewOptions.flat': 'I en lista',
        'viewOptions.orderBy': 'Sortera efter',
        'viewOptions.manualOrder': 'Manuellt',
        'viewOptions.updatedOrder': 'Senast uppdaterad',
        'viewOptions.sessionSlash': 'Gruppera sessioner efter "/"',
        'viewOptions.wsGroupBy': "Gruppera arbetsytor",
        'viewOptions.wsByDisk': "Skivmappar",
        'viewOptions.wsByDiskSlash': "Skiva + namn",
        'viewOptions.wsBySlash': "Endast namn",
        'group.ungrouped': 'Utan grupp',
        'sessions.expand': 'Visa {n} sessioner',
        'sessions.collapse': 'Fäll ihop',
        'time.now': 'nyss',
        'time.minutes': '{n} min',
        'time.hours': '{n} tim',
        'time.days': '{n} d',
        'time.months': '{n} mån',
        'time.years': '{n} år',
        'status.running': 'Genererar',
        'status.completed': 'Klar',
        'status.approval': 'Väntar på godkännande',
        'status.planReview': 'Väntar på planbekräftelse',
        'status.question': 'Väntar på svar',
        'status.subagents': '{n} underagenter körs',
        'schedule.active': 'Aktiv schemalagd uppgift',
        'menu.rename': 'Byt namn',
        'menu.delete': 'Ta bort',
        'menu.fork': 'Förgrena',
        'menu.archive': 'Arkivera',
        'menu.renameFolder': 'Byt namn på mapp',
        'menu.renameSgroup': 'Byt namn på sessionsgrupp',
        'menu.moveToGroup': 'Flytta till grupp…',
        'menu.moveOutGroup': 'Flytta ut ur gruppen',
        'settings.title': 'Bättre arbetsytor',
        'settings.desc': 'Utseende och ihopfällning för arbetsyteträdet',
        'settings.expand': 'Fäll ut',
        'settings.collapse': 'Fäll ihop',
        'settings.compactChains': 'Slå ihop enkelkedjor',
        'settings.compactChains.hint': 'Nivåer med ett enda barn slås ihop till en rad; med flera barn fälls trädet ut; medan du drar en arbetsyta fälls kedjorna tillfälligt ut till mappar så att du kan släppa på vilken nivå som helst; utfällt läge och eget utseende sparas i den här webbläsaren.',
        'settings.statusPulse': 'Pulserande statuslampa',
        'settings.statusPulse.hint': 'Statuslampor som döljs av ihopfällningen (klart grön / körs blå / väntar bärnsten) bubblar uppåt i hierarkin: rader för arbetsytor och mappar pulserar ikonen i statusfärgen (titlar med egen glöd pulserar med), sessionsgrupper visar en pulserande prick; på som standard, stängs av här.',
        'settings.workspaceGroup': "Arbetsytegruppering",
        'settings.workspaceGroup.hint': "Skivmappar: kapslar bara enligt de officiella mapparna (skivkataloger). Skiva + namn: lägger namngrupper ovanpå skivträdet. Endast namn: grupperar rent efter snedstreck i titlar och ignorerar skivkapsling. Den gamla reglagestatusen migreras automatiskt.",
        'settings.sessionLimit': "Sessioner vid utfällning",
        'settings.sessionLimit.all': "Alla",
        'settings.sessionLimit.hint': "En utfälld arbetsyta visar först de senaste sessionerna, resten bakom en visa-mer-rad; fästa, pågående och väntande sessioner syns alltid. Alla = obegränsat (standard).",
        'settings.sessionMenu': "Sessionens högerklicksmeny",
        'settings.sessionMenu.hint': "På: högerklick på en sessionsrad öppnar dess åtgärdsmeny (inklusive officiell fästning, arkivering och stoppa-och-arkivera). Av: raden visar istället den officiella ⋯-knappen vid hovring, som öppnar samma meny. På som standard.",
        'settings.rowActions': "Hovringsknappar för sessionsraden",
        'settings.rowActions.hint': "Visar snabbknappar för fäst / arkivera i radens slut vid hovring, som de officiella raderna. Av: åtgärderna finns bara i menyn. På som standard.",
        'settings.appearance': 'Standardutseende',
        'settings.appearance.hint': 'Rader utan egen anpassning använder detta utseende; textkonturen är på som standard — utan den är texten ofta oläslig ovanpå en bakgrundsbild. Lämna färgen tom för att följa temat.',
        'settings.appearance.reset': 'Återställ standardutseende',
        'custom.title': 'Anpassa utseende',
        'custom.color': 'Färg',
        'custom.glow': 'Glöd',
        'custom.preview': 'Liveförhandsvisning',
        'custom.preview.sample': 'Exempelarbetsyta',
        'custom.weight': 'Teckenvikt',
        'custom.weight.regular': 'Normal',
        'custom.weight.medium': 'Medium',
        'custom.weight.semibold': 'Halvfet',
        'custom.weight.bold': 'Fet',
        'custom.shadow': 'Textskugga',
        'custom.stroke': 'Textkontur',
        'custom.stroke.hint': 'Konturen är grå som standard; välj svart / vitt / valfri färg, eller «Auto» för att härleda motpolen från textfärgen (ljus text får svart kant, mörk får vit); Auto följer temat och en bakgrundsplugins ljus/mörker-läge.',
        'custom.strokeWidth': 'Konturtjocklek',
        'custom.strokeColor': 'Konturfärg',
        'custom.strokeColor.auto': 'Auto',
        'custom.weak': 'Svag',
        'custom.medium': 'Medium',
        'custom.strong': 'Stark',
        'custom.icon': 'Ikon',
        'custom.icon.solid': 'Fylld mapp',
        'custom.icon.outline': 'Konturmapp',
        'custom.icon.none': 'Dold',
        'custom.none': 'Ingen',
        'custom.reset': 'Rensa anpassning',
        'custom.done': 'Klart',
        'settings.on': 'På',
        'settings.off': 'Av',
        'sync.title': 'Synk mellan enheter',
      'sync.desc': "Utseendeanpassningar och växlar lever i den här enhetens webbläsare; de utbyts med den andra ytan (webb / skrivbordsapp) via värdens inställningslagring. Nya ändringar skrivs automatiskt till värden — den andra ytan behöver bara hämta. Data från före den här versionen kräver ett explicit skicka.",
        'sync.mode.overwrite': 'Skriv över denna enhet',
        'sync.mode.merge': 'Slå ihop båda sidor',
        'sync.pull.desktop': 'Hämta från skrivbordsappen',
        'sync.pull.web': 'Hämta från webben',
        'sync.push': 'Skicka denna enhets data',
        'sync.done': 'Synkroniserat',
        'sync.empty': 'Andra sidan har inga data ännu',
        'sync.off': 'Synk är inte tillgänglig här (kräver värduppläggets inställningstjänst)',
        'sync.loading': 'Ansluter till värduppläggets inställningar…',
        'flow.creating': 'Skapar…',
        'add.guide.title': "Lägg till arbetsyta i appen",
        'add.guide': "Den här värden har ingen systemmappväljare. Använd den officiella posten \"Lägg till arbetsyta\" på sidan Ny session.",
        'heroPicker.error.title': "Kunde inte lägga till arbetsytan",
        'heroPicker.retry': "Försök igen",
        'error.title': 'Något gick fel',
        'cancel': 'Avbryt',
        'create': 'Skapa',
        'confirm': 'OK',
        'close': 'Stäng',
        'ws.rename.title': 'Byt namn på arbetsyta',
        'ws.rename.hint': 'Ett / i namnet bildar gruppnivån, t.ex. web/frontend',
        'ws.delete.title': 'Ta bort arbetsyta',
        'ws.delete.body': 'Endast registreringen tas bort; katalogen och sessionsloggarna finns kvar. Ta bort «{name}»?',
        'folder.rename.title': 'Byt namn på mapp',
        'folder.rename.hint': 'Namnbytet uppdaterar alla arbetsytor i mappen',
        'folder.error.empty': 'Mappsökvägen får inte vara tom',
        'group.move.title': 'Flytta till grupp',
        'group.pick': 'Välj en befintlig grupp',
        'group.new': 'Ny grupp',
        'group.new.title': "Ny grupp",
        'group.new.sess': "Sessionsgrupp",
        'group.new.ws': "Arbetsytegrupp",
        'group.new.both': "Ny sessions- eller arbetsytegrupp",
        'group.new.where': "Välj var den skapas",
        'group.new.placeholder': "Gruppnamn, \"/\" nästlar",
        'group.new.nameHint': "Ett \"/\" nästlar djupare, t.ex. frontend/components",
        'group.new.empty': "Ange ett gruppnamn",
        'group.new.root': "Översta nivån",
        'group.new.independent': "Ny grupp på översta nivån",
        'group.new.pickWorkspace': "Välj en arbetsyta",
        'group.new.noWorkspace': "Inga arbetsytor än — lägg till en först",
        'group.new.pickFirst': "Välj en arbetsyta först",
        'group.delete.title': "Ta bort grupp",
        'group.delete.body': "\"{name}\" är en tom grupp; borttagningen kan inte ångras.",
        'menu.deleteGroup': "Ta bort grupp",
      },
      /* locale: th */
      'th': {
        'title': 'พื้นที่ทำงาน',
        'search.placeholder': 'ค้นหาพื้นที่ทำงานหรือเซสชัน',
        'add': 'เพิ่มพื้นที่ทำงาน',
        'rail.search': 'ค้นหา',
        'rail.add': 'เพิ่มพื้นที่ทำงาน',
        'empty': 'ยังไม่มีพื้นที่ทำงาน',
        'empty.search': 'ไม่พบผลลัพธ์ที่ตรงกัน',
        'session.new': 'เซสชันใหม่',
        'viewOptions.label': 'ตัวเลือกมุมมอง',
        'viewOptions.groupBy': 'จัดกลุ่มตาม',
        'viewOptions.byWorkspace': 'ตามพื้นที่ทำงาน',
        'viewOptions.byWorkspaceTree': 'ตามแผนผังพื้นที่ทำงาน',
        'viewOptions.flat': 'รายการเดียว',
        'viewOptions.orderBy': 'เรียงตาม',
        'viewOptions.manualOrder': 'ด้วยตนเอง',
        'viewOptions.updatedOrder': 'อัปเดตล่าสุด',
        'viewOptions.sessionSlash': 'จัดกลุ่มเซสชันตาม "/"',
        'viewOptions.wsGroupBy': "จัดกลุ่มพื้นที่ทำงาน",
        'viewOptions.wsByDisk': "โฟลเดอร์ดิสก์",
        'viewOptions.wsByDiskSlash': "ดิสก์ + ชื่อ",
        'viewOptions.wsBySlash': "เฉพาะชื่อ",
        'group.ungrouped': 'ไม่มีกลุ่ม',
        'sessions.expand': 'แสดงอีก {n} เซสชัน',
        'sessions.collapse': 'ย่อ',
        'time.now': 'เมื่อสักครู่',
        'time.minutes': '{n} นาที',
        'time.hours': '{n} ชั่วโมง',
        'time.days': '{n} วัน',
        'time.months': '{n} เดือน',
        'time.years': '{n} ปี',
        'status.running': 'กำลังสร้าง',
        'status.completed': 'เสร็จแล้ว',
        'status.approval': 'รอการอนุมัติ',
        'status.planReview': 'รอตรวจแผน',
        'status.question': 'รอคำตอบ',
        'status.subagents': 'ตัวแทนย่อย {n} รายกำลังทำงาน',
        'schedule.active': 'มีงานตั้งเวลาใช้งานอยู่',
        'menu.rename': 'เปลี่ยนชื่อ',
        'menu.delete': 'ลบ',
        'menu.fork': 'แยกสาย',
        'menu.archive': 'เก็บถาวร',
        'menu.renameFolder': 'เปลี่ยนชื่อโฟลเดอร์',
        'menu.renameSgroup': 'เปลี่ยนชื่อกลุ่มเซสชัน',
        'menu.moveToGroup': 'ย้ายไปยังกลุ่ม…',
        'menu.moveOutGroup': 'ย้ายออกจากกลุ่ม',
        'settings.title': 'พื้นที่ทำงานที่ดีขึ้น',
        'settings.desc': 'รูปลักษณ์และการย่อของต้นไม้พื้นที่ทำงาน',
        'settings.expand': 'ขยาย',
        'settings.collapse': 'ย่อ',
        'settings.compactChains': 'รวมสายที่มีลูกเดียว',
        'settings.compactChains.hint': 'ระดับที่มีลูกเพียงหนึ่งจะถูกรวมเป็นบรรทัดเดียว เมื่อมีลูกหลายตัวต้นไม้จะขยายออก ขณะลากพื้นที่ทำงาน สายจะขยายกลับเป็นโฟลเดอร์ชั่วคราวเพื่อให้วางได้ทุกระดับ สถานะการขยายและรูปลักษณ์ที่กำหนดเองจะถูกเก็บไว้ในเบราว์เซอร์นี้',
        'settings.statusPulse': 'ไฟสถานะหายใจ',
        'settings.statusPulse.hint': 'ไฟสถานะที่ถูกย่อซ่อนไว้ (เสร็จแล้วสีเขียว / กำลังทำงานสีน้ำเงิน / รอตอบสนองสีเหลืองอำพัน) จะลอยขึ้นตามลำดับชั้น: แถวพื้นที่ทำงานและโฟลเดอร์จะให้ไอคอนหายใจเป็นสีตามสถานะ (ชื่อที่มีการเรืองแสงกำหนดเองก็หายใจตาม) แถวกลุ่มเซสชันจะแสดงจุดสถานะที่หายใจ เปิดไว้เป็นค่าเริ่มต้น ปิดได้ที่นี่',
        'settings.workspaceGroup': "การจัดกลุ่มพื้นที่ทำงาน",
        'settings.workspaceGroup.hint': "โฟลเดอร์ดิสก์: ซ้อนตามโฟลเดอร์ทางการ (ไดเรกทอรีดิสก์) เท่านั้น ดิสก์ + ชื่อ: เพิ่มกลุ่มชื่อแบบเส้นทับทับต้นไม้ดิสก์ เฉพาะชื่อ: จัดกลุ่มจากเครื่องหมายทับในชื่อเท่านั้นโดยไม่สนการซ้อนดิสก์ สถานะสวิตช์เวอร์ชันเก่าจะย้ายมาโดยอัตโนมัติ",
        'settings.sessionLimit': "จำนวนเซสชันเมื่อกาง",
        'settings.sessionLimit.all': "ทั้งหมด",
        'settings.sessionLimit.hint': "พื้นที่ที่กางจะแสดงเซสชันล่าสุดก่อน ส่วนที่เหลืออยู่หลังแถวแสดงเพิ่ม เซสชันที่ปักหมุด กำลังทำงาน และรอคุณจะแสดงตลอด ทั้งหมด = ไม่จำกัด (ค่าเริ่มต้น)",
        'settings.sessionMenu': "เมนูคลิกขวาของเซสชัน",
        'settings.sessionMenu.hint': "เปิด: คลิกขวาที่แถวเซสชันเพื่อเปิดเมนูการกระทำ (รวมปักหมุด, เก็บถาวร และหยุด-แล้ว-เก็บถาวรแบบทางการ) ปิด: เมื่อชี้ที่แถวจะแสดงปุ่ม ⋯ สไตล์ทางการเปิดเมนูเดียวกันแทน เปิดตามค่าเริ่มต้น",
        'settings.rowActions': "ปุ่มเมื่อชี้แถวเซสชัน",
        'settings.rowActions.hint': "แสดงปุ่มด่วนปักหมุด / เก็บถาวรท้ายแถวเมื่อชี้ ให้ตรงกับแถวทางการ ปิด: การกระทำเหล่านี้มีเฉพาะในเมนู เปิดตามค่าเริ่มต้น",
        'settings.appearance': 'รูปลักษณ์เริ่มต้น',
        'settings.appearance.hint': 'แถวที่ยังไม่ได้กำหนดเองจะใช้รูปลักษณ์นี้ เส้นขอบตัวอักษรเปิดไว้เป็นค่าเริ่มต้น — บนภาพพื้นหลัง ตัวอักษรที่ไม่มีเส้นขอบมักอ่านยาก เว้นสีว่างไว้เพื่อตามธีม',
        'settings.appearance.reset': 'คืนค่ารูปลักษณ์เริ่มต้น',
        'custom.title': 'ปรับแต่งรูปลักษณ์',
        'custom.color': 'สี',
        'custom.glow': 'การเรืองแสง',
        'custom.preview': 'ตัวอย่างสด',
        'custom.preview.sample': 'ตัวอย่างพื้นที่ทำงาน',
        'custom.weight': 'ความหนาตัวอักษร',
        'custom.weight.regular': 'ปกติ',
        'custom.weight.medium': 'ปานกลาง',
        'custom.weight.semibold': 'กึ่งหนา',
        'custom.weight.bold': 'หนา',
        'custom.shadow': 'เงาตัวอักษร',
        'custom.stroke': 'เส้นขอบตัวอักษร',
        'custom.stroke.hint': 'สีเส้นขอบเริ่มต้นเป็นสีเทา เปลี่ยนเป็นดำ / ขาว / สีใดก็ได้ หรือเลือก «อัตโนมัติ» เพื่อคำนวณสีตัดจากสีตัวอักษร (ตัวอักษรสว่างได้ขอบดำ ตัวอักษรเข้มได้ขอบขาว) โหมดอัตโนมัติจะตามธีมและความสว่าง/มืดของปลั๊กอินพื้นหลัง',
        'custom.strokeWidth': 'ความหนาเส้นขอบ',
        'custom.strokeColor': 'สีเส้นขอบ',
        'custom.strokeColor.auto': 'อัตโนมัติ',
        'custom.weak': 'อ่อน',
        'custom.medium': 'ปานกลาง',
        'custom.strong': 'แรง',
        'custom.icon': 'ไอคอน',
        'custom.icon.solid': 'โฟลเดอร์ทึบ',
        'custom.icon.outline': 'โฟลเดอร์โปร่ง',
        'custom.icon.none': 'ไม่แสดง',
        'custom.none': 'ไม่มี',
        'custom.reset': 'ล้างการปรับแต่ง',
        'custom.done': 'เสร็จ',
        'settings.on': 'เปิด',
        'settings.off': 'ปิด',
        'sync.title': 'ซิงก์ข้ามอุปกรณ์',
      'sync.desc': "การปรับแต่งหน้าตาและสวิตช์อยู่ในเบราว์เซอร์ของอุปกรณ์นี้ และแลกเปลี่ยนกับอีกฝั่ง (เว็บ / แอปเดสก์ท็อป) ผ่านที่เก็บการตั้งค่าของโฮสต์ การแก้ไขใหม่เขียนไปยังโฮสต์โดยอัตโนมัติ อีกฝั่งแค่ดึงข้อมูล ข้อมูลก่อนเวอร์ชันนี้ต้องส่งครั้งเดียว",
        'sync.mode.overwrite': 'เขียนทับอุปกรณ์นี้',
        'sync.mode.merge': 'รวมทั้งสองฝั่ง',
        'sync.pull.desktop': 'ดึงจากแอปเดสก์ท็อป',
        'sync.pull.web': 'ดึงจากเว็บ',
        'sync.push': 'ส่งข้อมูลอุปกรณ์นี้',
        'sync.done': 'ซิงก์แล้ว',
        'sync.empty': 'อีกฝั่งยังไม่มีข้อมูลให้ดึง',
        'sync.off': 'สภาพแวดล้อมนี้ไม่รองรับการซิงก์ (ต้องมีบริการการตั้งค่าของโฮสต์)',
        'sync.loading': 'กำลังเชื่อมต่อการตั้งค่าโฮสต์…',
        'flow.creating': 'กำลังสร้าง…',
        'add.guide.title': "เพิ่มเวิร์กสเปซในแอป",
        'add.guide': "โฮสต์นี้ไม่มีตัวเลือกโฟลเดอร์ของระบบ ใช้รายการ \"เพิ่มเวิร์กสเปซ\" อย่างเป็นทางการในหน้าเซสชันใหม่",
        'heroPicker.error.title': "ไม่สามารถเพิ่มพื้นที่ทำงานได้",
        'heroPicker.retry': "ลองอีกครั้ง",
        'error.title': 'เกิดข้อผิดพลาด',
        'cancel': 'ยกเลิก',
        'create': 'สร้าง',
        'confirm': 'ตกลง',
        'close': 'ปิด',
        'ws.rename.title': 'เปลี่ยนชื่อพื้นที่ทำงาน',
        'ws.rename.hint': '/ ในชื่อคือระดับกลุ่ม เช่น web/frontend',
        'ws.delete.title': 'ลบพื้นที่ทำงาน',
        'ws.delete.body': 'ลบเฉพาะทะเบียนพื้นที่ทำงาน ไดเรกทอรีและบันทึกเซสชันยังอยู่ ลบ «{name}» หรือไม่',
        'folder.rename.title': 'เปลี่ยนชื่อกลุ่ม',
        'folder.rename.hint': 'การเปลี่ยนชื่อจะอัปเดตพื้นที่ทำงานทั้งหมดในกลุ่ม',
        'folder.error.empty': 'เส้นทางกลุ่มต้องไม่ว่าง',
        'group.move.title': 'ย้ายไปยังกลุ่ม',
        'group.pick': 'เลือกกลุ่มที่มีอยู่',
        'group.new': 'กลุ่มใหม่',
        'group.new.title': "กลุ่มใหม่",
        'group.new.sess': "กลุ่มเซสชัน",
        'group.new.ws': "กลุ่มเวิร์กสเปซ",
        'group.new.both': "กลุ่มเซสชันหรือเวิร์กสเปซใหม่",
        'group.new.where': "เลือกตำแหน่งที่สร้าง",
        'group.new.placeholder': "ชื่อกลุ่ม ใช้ / ซ้อนระดับ",
        'group.new.nameHint': "/ ใช้ซ้อนระดับลึกขึ้น เช่น frontend/components",
        'group.new.empty': "กรอกชื่อกลุ่ม",
        'group.new.root': "ระดับบนสุด",
        'group.new.independent': "กลุ่มระดับบนสุดใหม่",
        'group.new.pickWorkspace': "เลือกเวิร์กสเปซ",
        'group.new.noWorkspace': "ยังไม่มีเวิร์กสเปซ — เพิ่มก่อน",
        'group.new.pickFirst': "เลือกเวิร์กสเปซก่อน",
        'group.delete.title': "ลบกลุ่ม",
        'group.delete.body': "\"{name}\" เป็นกลุ่มว่าง ลบแล้วกู้คืนไม่ได้",
        'menu.deleteGroup': "ลบกลุ่ม",
      },
      /* locale: tr */
      'tr': {
        'title': 'Çalışma alanları',
        'search.placeholder': 'Çalışma alanı veya oturum ara',
        'add': 'Çalışma alanı ekle',
        'rail.search': 'Ara',
        'rail.add': 'Çalışma alanı ekle',
        'empty': 'Henüz çalışma alanı yok',
        'empty.search': 'Eşleşen sonuç yok',
        'session.new': 'Yeni oturum',
        'viewOptions.label': 'Görünüm seçenekleri',
        'viewOptions.groupBy': 'Gruplandır',
        'viewOptions.byWorkspace': 'Çalışma alanları',
        'viewOptions.byWorkspaceTree': 'Çalışma alanı ağacı',
        'viewOptions.flat': 'Tek liste',
        'viewOptions.orderBy': 'Sırala',
        'viewOptions.manualOrder': 'El ile',
        'viewOptions.updatedOrder': 'Son güncelleme',
        'viewOptions.sessionSlash': 'Oturumları "/" ile gruplandır',
        'viewOptions.wsGroupBy': "Çalışma alanlarını grupla",
        'viewOptions.wsByDisk': "Disk klasörleri",
        'viewOptions.wsByDiskSlash': "Disk + adlar",
        'viewOptions.wsBySlash': "Yalnız adlar",
        'group.ungrouped': 'Grubusuz',
        'sessions.expand': '{n} oturumu göster',
        'sessions.collapse': 'Daralt',
        'time.now': 'az önce',
        'time.minutes': '{n} dk',
        'time.hours': '{n} sa',
        'time.days': '{n} g',
        'time.months': '{n} ay',
        'time.years': '{n} yıl',
        'status.running': 'Üretiliyor',
        'status.completed': 'Tamamlandı',
        'status.approval': 'Onay bekliyor',
        'status.planReview': 'Plan onayı bekliyor',
        'status.question': 'Yanıt bekliyor',
        'status.subagents': '{n} alt ajan çalışıyor',
        'schedule.active': 'Etkin zamanlanmış görev var',
        'menu.rename': 'Yeniden adlandır',
        'menu.delete': 'Sil',
        'menu.fork': 'Çatalla',
        'menu.archive': 'Arşivle',
        'menu.renameFolder': 'Klasörü yeniden adlandır',
        'menu.renameSgroup': 'Oturum grubunu yeniden adlandır',
        'menu.moveToGroup': 'Gruba taşı…',
        'menu.moveOutGroup': 'Gruptan çıkar',
        'settings.title': 'Daha iyi çalışma alanları',
        'settings.desc': 'Çalışma alanı ağacının görünümü ve daraltma tercihleri',
        'settings.expand': 'Genişlet',
        'settings.collapse': 'Daralt',
        'settings.compactChains': 'Tek çocuklu zincirleri birleştir',
        'settings.compactChains.hint': 'Tek çocuklu düzeyler tek satırda birleşir; birden çok çocuk olduğunda ağaç açılır; bir çalışma alanını sürüklerken zincirler geçici olarak klasörlere açılır, böylece her düzeye bırakabilirsiniz; açılma durumu ve özel görünüm bu tarayıcıda saklanır.',
        'settings.statusPulse': 'Nefes alan durum ışığı',
        'settings.statusPulse.hint': 'Daraltmayla gizlenen durum ışıkları (tamamlandı yeşil / çalışıyor mavi / bekliyor amber) hiyerarşide yukarı taşar: çalışma alanı ve klasör satırlarının simgesi durum renginde nefes alır (özel ışıması olan başlıklar da birlikte nefes alır), oturum grubu satırları nefes alan bir durum noktası gösterir; varsayılan olarak açık, buradan kapatılabilir.',
        'settings.workspaceGroup': "Çalışma alanı gruplaması",
        'settings.workspaceGroup.hint': "Disk klasörleri: yalnızca resmî klasörlere (disk dizinleri) göre iç içe. Disk + adlar: disk ağacının üzerine ad grupları ekler. Yalnız adlar: yalnızca başlıklardaki bölü işaretiyle gruplar, disk iç içeliğini yok sayar. Eski anahtar durumu otomatik taşınır.",
        'settings.sessionLimit': "Açıldığında gösterilecek oturum",
        'settings.sessionLimit.all': "Tümü",
        'settings.sessionLimit.hint': "Açılan çalışma alanı önce en yeni oturumları gösterir, kalanı bir daha-göster satırının ardındadır; sabitlenmiş, çalışan ve sizi bekleyen oturumlar her zaman görünür. Tümü = sınırsız (varsayılan).",
        'settings.sessionMenu': "Oturum sağ tık menüsü",
        'settings.sessionMenu.hint': "Açık: oturum satırına sağ tıklayınca eylem menüsü açılır (resmî sabitleme, arşivleme ve durdurup-arşivleme dahil). Kapalı: satırın üzerine gelince resmî ⋯ düğmesi görünür ve aynı menüyü açar. Varsayılan açık.",
        'settings.rowActions': "Oturum satırı düğmeleri",
        'settings.rowActions.hint': "Üzerine gelince satır sonunda sabitle / arşivle hızlı düğmelerini gösterir, resmî satırlarla aynı. Kapalı: bu eylemler yalnızca menüde kalır. Varsayılan açık.",
        'settings.appearance': 'Varsayılan görünüm',
        'settings.appearance.hint': 'Özel olarak uyarlanmamış satırlar bu görünümü kullanır; metin konturu varsayılan olarak açıktır — arka plan görseli üzerinde kontursuz metin çoğu zaman okunmaz. Rengi boş bırakırsanız temayı izler.',
        'settings.appearance.reset': 'Varsayılan görünüme dön',
        'custom.title': 'Görünümü özelleştir',
        'custom.color': 'Renk',
        'custom.glow': 'Işıma',
        'custom.preview': 'Canlı önizleme',
        'custom.preview.sample': 'Örnek çalışma alanı',
        'custom.weight': 'Yazı kalınlığı',
        'custom.weight.regular': 'Normal',
        'custom.weight.medium': 'Orta',
        'custom.weight.semibold': 'Yarı kalın',
        'custom.weight.bold': 'Kalın',
        'custom.shadow': 'Yazı gölgesi',
        'custom.stroke': 'Yazı konturu',
        'custom.stroke.hint': 'Kontur varsayılan olarak grisidir; siyah / beyaz / herhangi bir renk seçebilir ya da «Otomatik» ile yazı renginden karşıt kutbu türetebilirsiniz (açık yazıya siyah kenar, koyu yazıya beyaz kenar); Otomatik, temanın ve arka plan eklentisinin açık/koyu geçişini izler.',
        'custom.strokeWidth': 'Kontur kalınlığı',
        'custom.strokeColor': 'Kontur rengi',
        'custom.strokeColor.auto': 'Otomatik',
        'custom.weak': 'Zayıf',
        'custom.medium': 'Orta',
        'custom.strong': 'Güçlü',
        'custom.icon': 'Simge',
        'custom.icon.solid': 'Dolu klasör',
        'custom.icon.outline': 'Çerçeveli klasör',
        'custom.icon.none': 'Gizli',
        'custom.none': 'Yok',
        'custom.reset': 'Özelleştirmeyi temizle',
        'custom.done': 'Bitti',
        'settings.on': 'Açık',
        'settings.off': 'Kapalı',
        'sync.title': 'Cihazlar arası eşitleme',
      'sync.desc': "Görünüm özelleştirmeleri ve anahtarlar bu cihazın tarayıcısında yaşar; ana makine ayar deposu aracılığıyla diğer yüzleyle (web / masaüstü uygulaması) alışveriş ederler. Yeni değişiklikler ana makineye otomatik yazılır — diğer yüz yalnızca çeker. Bu sürümden önceki veriler tek seferlik açık bir Gönder gerektirir.",
        'sync.mode.overwrite': 'Bu cihazın üzerine yaz',
        'sync.mode.merge': 'İki tarafı birleştir',
        'sync.pull.desktop': 'Masaüstü uygulamasından getir',
        'sync.pull.web': 'Web tarafından getir',
        'sync.push': 'Bu cihazın verilerini gönder',
        'sync.done': 'Eşitlendi',
        'sync.empty': 'Diğer tarafta alınacak veri yok',
        'sync.off': 'Bu ortamda eşitleme yok (ana makine ayar servisi gerekir)',
        'sync.loading': 'Ana makine ayarlarına bağlanılıyor…',
        'flow.creating': 'Oluşturuluyor…',
        'add.guide.title': "Uygulama içinde çalışma alanı ekle",
        'add.guide': "Bu ana makinede masaüstü klasör seçici yok. Yeni Oturum sayfasındaki resmî \"Çalışma alanı ekle\" girişini kullanın.",
        'heroPicker.error.title': "Çalışma alanı eklenemedi",
        'heroPicker.retry': "Yeniden dene",
        'error.title': 'Bir şeyler ters gitti',
        'cancel': 'İptal',
        'create': 'Oluştur',
        'confirm': 'Tamam',
        'close': 'Kapat',
        'ws.rename.title': 'Çalışma alanını yeniden adlandır',
        'ws.rename.hint': 'Addaki / grup düzeyini oluşturur, örn. web/frontend',
        'ws.delete.title': 'Çalışma alanını sil',
        'ws.delete.body': 'Yalnızca kayıt kaldırılır; dizin ve oturum kayıtları kalır. «{name}» silinsin mi?',
        'folder.rename.title': 'Klasörü yeniden adlandır',
        'folder.rename.hint': 'Yeniden adlandırma klasördeki tüm çalışma alanlarını günceller',
        'folder.error.empty': 'Klasör yolu boş olamaz',
        'group.move.title': 'Gruba taşı',
        'group.pick': 'Mevcut bir grup seç',
        'group.new': 'Yeni grup',
        'group.new.title': "Yeni grup",
        'group.new.sess': "Oturum grubu",
        'group.new.ws': "Çalışma alanı grubu",
        'group.new.both': "Yeni oturum veya çalışma alanı grubu",
        'group.new.where': "Oluşturulacak yeri seçin",
        'group.new.placeholder': "Grup adı, \"/\" iç içe koyar",
        'group.new.nameHint': "\"/\" daha derin iç içe koyar, örn. frontend/components",
        'group.new.empty': "Bir grup adı girin",
        'group.new.root': "En üst düzey",
        'group.new.independent': "Yeni üst düzey grup",
        'group.new.pickWorkspace': "Bir çalışma alanı seçin",
        'group.new.noWorkspace': "Henüz çalışma alanı yok — önce bir tane ekleyin",
        'group.new.pickFirst': "Önce bir çalışma alanı seçin",
        'group.delete.title': "Grubu sil",
        'group.delete.body': "\"{name}\" boş bir grup; silme geri alınamaz.",
        'menu.deleteGroup': "Grubu sil",
      },
      /* locale: vi */
      'vi': {
        'title': 'Không gian làm việc',
        'search.placeholder': 'Tìm không gian làm việc hoặc phiên',
        'add': 'Thêm không gian làm việc',
        'rail.search': 'Tìm kiếm',
        'rail.add': 'Thêm không gian làm việc',
        'empty': 'Chưa có không gian làm việc',
        'empty.search': 'Không có kết quả phù hợp',
        'session.new': 'Phiên mới',
        'viewOptions.label': 'Tùy chọn hiển thị',
        'viewOptions.groupBy': 'Nhóm theo',
        'viewOptions.byWorkspace': 'Theo khu vực làm việc',
        'viewOptions.byWorkspaceTree': 'Theo cây khu vực',
        'viewOptions.flat': 'Một danh sách',
        'viewOptions.orderBy': 'Sắp xếp theo',
        'viewOptions.manualOrder': 'Thủ công',
        'viewOptions.updatedOrder': 'Cập nhật gần đây',
        'viewOptions.sessionSlash': 'Nhóm phiên theo "/"',
        'viewOptions.wsGroupBy': "Nhóm không gian làm việc",
        'viewOptions.wsByDisk': "Thư mục đĩa",
        'viewOptions.wsByDiskSlash': "Đĩa + tên",
        'viewOptions.wsBySlash': "Chỉ tên",
        'group.ungrouped': 'Chưa phân nhóm',
        'sessions.expand': 'Hiện thêm {n} phiên',
        'sessions.collapse': 'Thu gọn',
        'time.now': 'vừa xong',
        'time.minutes': '{n} phút',
        'time.hours': '{n} giờ',
        'time.days': '{n} ngày',
        'time.months': '{n} tháng',
        'time.years': '{n} năm',
        'status.running': 'Đang tạo',
        'status.completed': 'Đã xong',
        'status.approval': 'Đang chờ phê duyệt',
        'status.planReview': 'Đang chờ duyệt kế hoạch',
        'status.question': 'Đang chờ trả lời',
        'status.subagents': '{n} tác nhân con đang chạy',
        'schedule.active': 'Có tác vụ hẹn giờ đang hoạt động',
        'menu.rename': 'Đổi tên',
        'menu.delete': 'Xóa',
        'menu.fork': 'Tách nhánh',
        'menu.archive': 'Lưu trữ',
        'menu.renameFolder': 'Đổi tên thư mục',
        'menu.renameSgroup': 'Đổi tên nhóm phiên',
        'menu.moveToGroup': 'Chuyển vào nhóm…',
        'menu.moveOutGroup': 'Đưa ra khỏi nhóm',
        'settings.title': 'Không gian làm việc tốt hơn',
        'settings.desc': 'Giao diện và cách thu gọn của cây không gian làm việc',
        'settings.expand': 'Mở rộng',
        'settings.collapse': 'Thu gọn',
        'settings.compactChains': 'Gộp chuỗi một nhánh',
        'settings.compactChains.hint': 'Các tầng chỉ có một nhánh con được gộp thành một dòng; khi có nhiều nhánh con, cây tự mở ra; khi kéo không gian làm việc, chuỗi tạm mở lại thành thư mục để có thể thả vào bất kỳ tầng nào; trạng thái mở và giao diện tùy chỉnh được lưu trong trình duyệt này.',
        'settings.statusPulse': 'Đèn trạng thái nhấp nháy',
        'settings.statusPulse.hint': 'Những đèn trạng thái bị thu gọn che đi (xong màu xanh lá / đang chạy màu xanh dương / đang chờ màu hổ phách) sẽ nổi dần lên các tầng trên: hàng không gian làm việc và thư mục cho biểu tượng nhấp nháy theo màu trạng thái (tiêu đề có đặt phát sáng cũng nhấp nháy theo), hàng nhóm phiên hiện một chấm trạng thái nhấp nháy; mặc định bật, có thể tắt tại đây.',
        'settings.workspaceGroup': "Nhóm không gian làm việc",
        'settings.workspaceGroup.hint': "Thư mục đĩa: lồng theo thư mục chính thức (thư mục đĩa) mà thôi. Đĩa + tên: thêm nhóm tên lên trên cây đĩa. Chỉ tên: nhóm chỉ theo dấu gạch chéo trong tiêu đề, bỏ qua lồng đĩa. Trạng thái công tắc bản cũ tự động chuyển đổi.",
        'settings.sessionLimit': "Số phiên khi mở rộng",
        'settings.sessionLimit.all': "Tất cả",
        'settings.sessionLimit.hint': "Không gian được mở rộng sẽ hiện các phiên gần đây trước, phần còn lại nằm sau một hàng xem-thêm; phiên ghim, đang chạy và đang chờ bạn luôn hiển thị. Tất cả = không giới hạn (mặc định).",
        'settings.sessionMenu': "Menu chuột phải phiên",
        'settings.sessionMenu.hint': "Bật: nhấp chuột phải vào dòng phiên để mở menu thao tác (bao gồm ghim, lưu trữ và dừng-rồi-lưu trữ chính thức). Tắt: dòng hiển thị nút ⋯ kiểu chính thức khi di chuột, mở cùng menu đó. Bật theo mặc định.",
        'settings.rowActions': "Nút hover dòng phiên",
        'settings.rowActions.hint': "Hiện nút nhanh ghim / lưu trữ ở cuối dòng khi di chuột, giống các dòng chính thức. Tắt: các thao tác này chỉ còn trong menu. Bật theo mặc định.",
        'settings.appearance': 'Giao diện mặc định',
        'settings.appearance.hint': 'Những hàng chưa tùy chỉnh riêng dùng giao diện này; viền chữ mặc định bật — trên ảnh nền, chữ không viền thường khó đọc. Để trống màu để theo chủ đề.',
        'settings.appearance.reset': 'Khôi phục giao diện mặc định',
        'custom.title': 'Tùy chỉnh giao diện',
        'custom.color': 'Màu',
        'custom.glow': 'Phát sáng',
        'custom.preview': 'Xem trước trực tiếp',
        'custom.preview.sample': 'Không gian làm việc mẫu',
        'custom.weight': 'Độ đậm chữ',
        'custom.weight.regular': 'Thường',
        'custom.weight.medium': 'Vừa',
        'custom.weight.semibold': 'Hơi đậm',
        'custom.weight.bold': 'Đậm',
        'custom.shadow': 'Bóng chữ',
        'custom.stroke': 'Viền chữ',
        'custom.stroke.hint': 'Viền mặc định màu xám; có thể đổi sang đen / trắng / màu bất kỳ, hoặc chọn «Tự động» để lấy màu tương phản từ màu chữ (chữ sáng viền đen, chữ tối viền trắng); chế độ tự động theo chủ đề và độ sáng/tối của plugin nền.',
        'custom.strokeWidth': 'Độ dày viền',
        'custom.strokeColor': 'Màu viền',
        'custom.strokeColor.auto': 'Tự động',
        'custom.weak': 'Nhẹ',
        'custom.medium': 'Vừa',
        'custom.strong': 'Mạnh',
        'custom.icon': 'Biểu tượng',
        'custom.icon.solid': 'Thư mục đặc',
        'custom.icon.outline': 'Thư mục rỗng',
        'custom.icon.none': 'Không hiện',
        'custom.none': 'Không',
        'custom.reset': 'Xóa tùy chỉnh',
        'custom.done': 'Xong',
        'settings.on': 'Bật',
        'settings.off': 'Tắt',
        'sync.title': 'Đồng bộ giữa các thiết bị',
      'sync.desc': "Tùy chỉnh giao diện và các công tắc sống trong trình duyệt của thiết bị này; chúng trao đổi với bề mặt kia (web / ứng dụng máy tính) qua kho cài đặt của máy chủ. Các chỉnh sửa mới được ghi lên máy chủ tự động — bề mặt kia chỉ cần kéo. Dữ liệu từ trước phiên bản này cần một lần Gửi rõ ràng.",
        'sync.mode.overwrite': 'Ghi đè thiết bị này',
        'sync.mode.merge': 'Gộp hai bên',
        'sync.pull.desktop': 'Lấy từ ứng dụng máy tính',
        'sync.pull.web': 'Lấy từ web',
        'sync.push': 'Gửi dữ liệu thiết bị này',
        'sync.done': 'Đã đồng bộ',
        'sync.empty': 'Bên kia chưa có dữ liệu để lấy',
        'sync.off': 'Môi trường này không hỗ trợ đồng bộ (cần dịch vụ cài đặt của máy chủ)',
        'sync.loading': 'Đang kết nối cài đặt máy chủ…',
        'flow.creating': 'Đang tạo…',
        'add.guide.title': "Thêm không gian làm việc trong ứng dụng",
        'add.guide': "Máy chủ này không có trình chọn thư mục trên màn hình. Dùng mục chính thức \"Thêm không gian làm việc\" ở trang Phiên mới.",
        'heroPicker.error.title': "Không thể thêm không gian làm việc",
        'heroPicker.retry': "Thử lại",
        'error.title': 'Đã xảy ra lỗi',
        'cancel': 'Hủy',
        'create': 'Tạo',
        'confirm': 'OK',
        'close': 'Đóng',
        'ws.rename.title': 'Đổi tên không gian làm việc',
        'ws.rename.hint': 'Dấu / trong tên tạo thành nhóm tầng, ví dụ web/frontend',
        'ws.delete.title': 'Xóa không gian làm việc',
        'ws.delete.body': 'Chỉ xóa đăng ký; thư mục và nhật ký phiên vẫn được giữ. Xóa «{name}»?',
        'folder.rename.title': 'Đổi tên nhóm',
        'folder.rename.hint': 'Đổi tên sẽ cập nhật mọi không gian làm việc trong nhóm',
        'folder.error.empty': 'Đường dẫn nhóm không được để trống',
        'group.move.title': 'Chuyển vào nhóm',
        'group.pick': 'Chọn một nhóm có sẵn',
        'group.new': 'Nhóm mới',
        'group.new.title': "Nhóm mới",
        'group.new.sess': "Nhóm phiên",
        'group.new.ws': "Nhóm không gian làm việc",
        'group.new.both': "Nhóm phiên hoặc không gian làm việc mới",
        'group.new.where': "Chọn nơi tạo",
        'group.new.placeholder': "Tên nhóm, \"/\" để lồng nhau",
        'group.new.nameHint': "\"/\" lồng sâu hơn, ví dụ frontend/components",
        'group.new.empty': "Nhập tên nhóm",
        'group.new.root': "Cấp cao nhất",
        'group.new.independent': "Nhóm cấp cao nhất mới",
        'group.new.pickWorkspace': "Chọn một không gian làm việc",
        'group.new.noWorkspace': "Chưa có không gian làm việc — hãy thêm trước",
        'group.new.pickFirst': "Chọn không gian làm việc trước",
        'group.delete.title': "Xóa nhóm",
        'group.delete.body': "\"{name}\" là nhóm trống; không thể hoàn tác sau khi xóa.",
        'menu.deleteGroup': "Xóa nhóm",
      },
      /* locale: zh-HK */
      'zh-HK': {
        'title': '工作區',
        'search.placeholder': '搵工作區或者對話',
        'add': '新增工作區',
        'rail.search': '搵',
        'rail.add': '新增工作區',
        'empty': '未有工作區',
        'empty.search': '搵唔到符合嘅結果',
        'session.new': '新對話',
        'viewOptions.label': '檢視選項',
        'viewOptions.groupBy': '分組方式',
        'viewOptions.byWorkspace': '按工作區',
        'viewOptions.byWorkspaceTree': '按工作區樹',
        'viewOptions.flat': '單一列表',
        'viewOptions.orderBy': '排序方式',
        'viewOptions.manualOrder': '手動排序',
        'viewOptions.updatedOrder': '最近更新',
        'viewOptions.sessionSlash': '對話按「/」分組',
        'viewOptions.wsGroupBy': "工作區分組",
        'viewOptions.wsByDisk': "磁碟目錄",
        'viewOptions.wsByDiskSlash': "磁碟 + 名稱",
        'viewOptions.wsBySlash': "僅名稱",
        'group.ungrouped': '未分組',
        'sessions.expand': '展開 {n} 個對話',
        'sessions.collapse': '收起',
        'time.now': '啱啱',
        'time.minutes': '{n} 分鐘',
        'time.hours': '{n} 小時',
        'time.days': '{n} 日',
        'time.months': '{n} 個月',
        'time.years': '{n} 年',
        'status.running': '生成緊',
        'status.completed': '已完成',
        'status.approval': '等緊批准',
        'status.planReview': '等緊計劃確認',
        'status.question': '等緊回答',
        'status.subagents': '{n} 個子任務運行緊',
        'schedule.active': '有進行緊嘅定時任務',
        'menu.rename': '重新命名',
        'menu.delete': '刪除',
        'menu.fork': '分叉',
        'menu.archive': '封存',
        'menu.renameFolder': '重新命名分組',
        'menu.renameSgroup': '重新命名對話分組',
        'menu.moveToGroup': '移動到分組…',
        'menu.moveOutGroup': '移出分組',
        'settings.title': '更好嘅工作區',
        'settings.desc': '工作區樹嘅外觀同收起偏好',
        'settings.expand': '展開',
        'settings.collapse': '收起',
        'settings.compactChains': '單鏈分組摺疊顯示',
        'settings.compactChains.hint': '單層鏈會合併成一行,出現多個子級就會自動展開成樹狀;拖拽工作區期間單鏈會臨時展開返做文件夾樹,可以放入任何一級;展開狀態同自訂外觀會喺呢個瀏覽器保存。',
        'settings.statusPulse': '狀態呼吸燈',
        'settings.statusPulse.hint': '被摺疊遮住嘅狀態燈(完成綠 / 運行藍 / 待互動琥珀)會沿住層級向外冒泡:工作區同分組行會以圖示呼吸發光(顏色跟狀態,自訂過發光嘅標題一齊呼吸),對話分組行就會顯示呼吸狀態燈;預設開啟,可以喺度閂咗佢。',
        'settings.workspaceGroup': "工作區分組",
        'settings.workspaceGroup.hint': "磁碟目錄 = 只按官方資料夾(磁碟目錄)巢狀;磁碟 + 名稱 = 在磁碟層之上再按標題裏的 / 分組;僅名稱 = 只按標題裏的 / 分組,完全不理會磁碟目錄的巢狀關係。舊版本的開關狀態會自動遷移。",
        'settings.sessionLimit': "展開時顯示會話數",
        'settings.sessionLimit.all': "全部",
        'settings.sessionLimit.hint': "展開工作區時先只顯示最近的部分會話,其餘收進「展開 {n} 個會話」一行,點擊展開該組全部;置頂、進行中和等待你的會話始終顯示。全部 = 不限量(預設)。",
        'settings.sessionMenu': "會話右鍵選單",
        'settings.sessionMenu.hint': "開啟時右鍵點擊會話行即可開啟操作選單(包含官方的置頂、封存、停止並封存等);關閉後改為在行尾懸停顯示官方樣式的 ⋯ 按鈕,點擊開啟同一個選單。預設開啟。",
        'settings.rowActions': "會話行懸停按鈕",
        'settings.rowActions.hint': "懸停會話行時在行尾顯示置頂 / 封存快捷按鈕,與官方行保持一致;關閉後這些動作只保留在選單裡。預設開啟。",
        'settings.appearance': '預設外觀',
        'settings.appearance.hint': '未單獨自訂過嘅行會用呢套外觀;字體描邊預設開啟——有背景圖嗰陣唔描邊嘅字經常睇唔清。字體顏色留空就會跟主題。',
        'settings.appearance.reset': '還原預設外觀',
        'custom.title': '自訂外觀',
        'custom.color': '顏色',
        'custom.glow': '發光',
        'custom.preview': '即時預覽',
        'custom.preview.sample': '工作區示例',
        'custom.weight': '字體粗細',
        'custom.weight.regular': '常規',
        'custom.weight.medium': '中',
        'custom.weight.semibold': '半粗',
        'custom.weight.bold': '粗',
        'custom.shadow': '字體陰影',
        'custom.stroke': '字體描邊',
        'custom.stroke.hint': '描邊顏色預設係灰色,可以改做黑 / 白 / 任意顏色,或者揀「自動」按字體顏色取反差色(淺色字配黑邊、深色字配白邊);自動模式會跟主題明暗同背景插件嘅介面明暗。',
        'custom.strokeWidth': '描邊粗細',
        'custom.strokeColor': '描邊顏色',
        'custom.strokeColor.auto': '自動',
        'custom.weak': '弱',
        'custom.medium': '中',
        'custom.strong': '強',
        'custom.icon': '圖示',
        'custom.icon.solid': '實心文件夾',
        'custom.icon.outline': '空心文件夾',
        'custom.icon.none': '唔顯示',
        'custom.none': '唔顯示',
        'custom.reset': '清除自訂',
        'custom.done': '完成',
        'settings.on': '開',
        'settings.off': '關',
        'sync.title': '跨端同步',
      'sync.desc': "外觀自訂與開關儲存在本裝置的瀏覽器裡;透過主機設定存放區與另一端互傳。平時的新修改會自動寫入主機,另一端點「取得」即可拿到;舊版本的歷史資料首次需要點一次「傳送」。",
        'sync.mode.overwrite': '覆蓋呢部裝置',
        'sync.mode.merge': '合併兩端',
        'sync.pull.desktop': '由桌面客户端獲取',
        'sync.pull.web': '由 Web 獲取',
        'sync.push': '發送呢部裝置嘅資料',
        'sync.done': '已同步',
        'sync.empty': '另一端暫時未有資料可以獲取',
        'sync.off': '呢個環境唔支援同步(需要宿主設定服務)',
        'sync.loading': '連接緊宿主設定…',
        'flow.creating': '建立緊…',
        'add.guide.title': "應用程式內新增工作區",
        'add.guide': "呢部主機冇桌面資料夾選擇器。請去「新工作階段」頁,用官方嘅「新增工作區」開應用程式內瀏覽器。",
        'heroPicker.error.title': "無法新增工作區",
        'heroPicker.retry': "重試",
        'error.title': '出咗錯',
        'cancel': '取消',
        'create': '建立',
        'confirm': '確定',
        'close': '關閉',
        'ws.rename.title': '重新命名工作區',
        'ws.rename.hint': '名稱入面嘅 / 就係層級分組,例如 web/前端',
        'ws.delete.title': '刪除工作區',
        'ws.delete.body': '只會移除工作區登記,目錄同對話記錄都會保留。確定刪除「{name}」?',
        'folder.rename.title': '重新命名分組',
        'folder.rename.hint': '重新命名會同步更新組內所有工作區名稱',
        'folder.error.empty': '分組路徑唔可以係空',
        'group.move.title': '移動到分組',
        'group.pick': '選擇已有分組',
        'group.new': '新增分組',
        'group.new.title': "新增分組",
        'group.new.sess': "工作階段分組",
        'group.new.ws': "工作區分組",
        'group.new.both': "新增工作階段或工作區分組",
        'group.new.where': "揀建立位置",
        'group.new.placeholder': "分組名,可用 / 嵌套",
        'group.new.nameHint': "名入面嘅 / 即嵌套層級,例如 前端/組件",
        'group.new.empty': "請輸入分組名",
        'group.new.root': "最頂層",
        'group.new.independent': "新增頂層分組",
        'group.new.pickWorkspace': "揀一個工作區",
        'group.new.noWorkspace': "仲未有工作區,請先加一個",
        'group.new.pickFirst': "請先揀一個工作區",
        'group.delete.title': "刪除分組",
        'group.delete.body': "「{name}」係空分組,刪咗冇得返轉頭。",
        'menu.deleteGroup': "刪除分組",
      },
      /* locale: zh-MO */
      'zh-MO': {
        'title': '工作區',
        'search.placeholder': '搵工作區或者對話',
        'add': '新增工作區',
        'rail.search': '搵',
        'rail.add': '新增工作區',
        'empty': '未有工作區',
        'empty.search': '搵唔到符合嘅結果',
        'session.new': '新對話',
        'viewOptions.label': '檢視選項',
        'viewOptions.groupBy': '分組方式',
        'viewOptions.byWorkspace': '按工作區',
        'viewOptions.byWorkspaceTree': '按工作區樹',
        'viewOptions.flat': '單一列表',
        'viewOptions.orderBy': '排序方式',
        'viewOptions.manualOrder': '手動排序',
        'viewOptions.updatedOrder': '最近更新',
        'viewOptions.sessionSlash': '對話按「/」分組',
        'viewOptions.wsGroupBy': "工作區分組",
        'viewOptions.wsByDisk': "磁碟目錄",
        'viewOptions.wsByDiskSlash': "磁碟 + 名稱",
        'viewOptions.wsBySlash': "僅名稱",
        'group.ungrouped': '未分組',
        'sessions.expand': '展開 {n} 個對話',
        'sessions.collapse': '收起',
        'time.now': '啱啱',
        'time.minutes': '{n} 分鐘',
        'time.hours': '{n} 小時',
        'time.days': '{n} 日',
        'time.months': '{n} 個月',
        'time.years': '{n} 年',
        'status.running': '生成緊',
        'status.completed': '已完成',
        'status.approval': '等緊批准',
        'status.planReview': '等緊計劃確認',
        'status.question': '等緊回答',
        'status.subagents': '{n} 個子任務運行緊',
        'schedule.active': '有進行緊嘅定時任務',
        'menu.rename': '重新命名',
        'menu.delete': '刪除',
        'menu.fork': '分叉',
        'menu.archive': '封存',
        'menu.renameFolder': '重新命名分組',
        'menu.renameSgroup': '重新命名對話分組',
        'menu.moveToGroup': '移動到分組…',
        'menu.moveOutGroup': '移出分組',
        'settings.title': '更好嘅工作區',
        'settings.desc': '工作區樹嘅外觀同收起偏好',
        'settings.expand': '展開',
        'settings.collapse': '收起',
        'settings.compactChains': '單鏈分組摺疊顯示',
        'settings.compactChains.hint': '單層鏈會合併成一行,出現多個子級就會自動展開成樹狀;拖拽工作區期間單鏈會臨時展開返做文件夾樹,可以放入任何一級;展開狀態同自訂外觀會喺呢個瀏覽器保存。',
        'settings.statusPulse': '狀態呼吸燈',
        'settings.statusPulse.hint': '被摺疊遮住嘅狀態燈(完成綠 / 運行藍 / 待互動琥珀)會沿住層級向外冒泡:工作區同分組行會以圖示呼吸發光(顏色跟狀態,自訂過發光嘅標題一齊呼吸),對話分組行就會顯示呼吸狀態燈;預設開啟,可以喺度閂咗佢。',
        'settings.workspaceGroup': "工作區分組",
        'settings.workspaceGroup.hint': "磁碟目錄 = 只按官方資料夾(磁碟目錄)巢狀;磁碟 + 名稱 = 在磁碟層之上再按標題裏的 / 分組;僅名稱 = 只按標題裏的 / 分組,完全不理會磁碟目錄的巢狀關係。舊版本的開關狀態會自動遷移。",
        'settings.sessionLimit': "展開時顯示會話數",
        'settings.sessionLimit.all': "全部",
        'settings.sessionLimit.hint': "展開工作區時先只顯示最近的部分會話,其餘收進「展開 {n} 個會話」一行,點擊展開該組全部;置頂、進行中和等待你的會話始終顯示。全部 = 不限量(預設)。",
        'settings.sessionMenu': "會話右鍵選單",
        'settings.sessionMenu.hint': "開啟時右鍵點擊會話行即可開啟操作選單(包含官方的置頂、歸檔、停止並歸檔等);關閉後改為在行尾懸停顯示官方樣式的 ⋯ 按鈕,點擊開啟同一個選單。預設開啟。",
        'settings.rowActions': "會話行懸停按鈕",
        'settings.rowActions.hint': "懸停會話行時在行尾顯示置頂 / 歸檔快捷按鈕,與官方行保持一致;關閉後這些動作只保留在選單裡。預設開啟。",
        'settings.appearance': '預設外觀',
        'settings.appearance.hint': '未單獨自訂過嘅行會用呢套外觀;字體描邊預設開啟——有背景圖嗰陣唔描邊嘅字經常睇唔清。字體顏色留空就會跟主題。',
        'settings.appearance.reset': '還原預設外觀',
        'custom.title': '自訂外觀',
        'custom.color': '顏色',
        'custom.glow': '發光',
        'custom.preview': '即時預覽',
        'custom.preview.sample': '工作區示例',
        'custom.weight': '字體粗細',
        'custom.weight.regular': '常規',
        'custom.weight.medium': '中',
        'custom.weight.semibold': '半粗',
        'custom.weight.bold': '粗',
        'custom.shadow': '字體陰影',
        'custom.stroke': '字體描邊',
        'custom.stroke.hint': '描邊顏色預設係灰色,可以改做黑 / 白 / 任意顏色,或者揀「自動」按字體顏色取反差色(淺色字配黑邊、深色字配白邊);自動模式會跟主題明暗同背景插件嘅介面明暗。',
        'custom.strokeWidth': '描邊粗細',
        'custom.strokeColor': '描邊顏色',
        'custom.strokeColor.auto': '自動',
        'custom.weak': '弱',
        'custom.medium': '中',
        'custom.strong': '強',
        'custom.icon': '圖示',
        'custom.icon.solid': '實心文件夾',
        'custom.icon.outline': '空心文件夾',
        'custom.icon.none': '唔顯示',
        'custom.none': '唔顯示',
        'custom.reset': '清除自訂',
        'custom.done': '完成',
        'settings.on': '開',
        'settings.off': '關',
        'sync.title': '跨端同步',
      'sync.desc': "外觀自訂與開關儲存在本裝置的瀏覽器裡;透過主機設定存放區與另一端互傳。平時的新修改會自動寫入主機,另一端點「取得」即可拿到;舊版本的歷史資料首次需要點一次「傳送」。",
        'sync.mode.overwrite': '覆蓋呢部裝置',
        'sync.mode.merge': '合併兩端',
        'sync.pull.desktop': '由桌面客户端獲取',
        'sync.pull.web': '由 Web 獲取',
        'sync.push': '發送呢部裝置嘅資料',
        'sync.done': '已同步',
        'sync.empty': '另一端暫時未有資料可以獲取',
        'sync.off': '呢個環境唔支援同步(需要宿主設定服務)',
        'sync.loading': '連接緊宿主設定…',
        'flow.creating': '建立緊…',
        'add.guide.title': "應用程式內新增工作區",
        'add.guide': "呢部主機冇桌面資料夾選擇器。請去「新工作階段」頁,用官方嘅「新增工作區」開應用程式內瀏覽器。",
        'heroPicker.error.title': "無法新增工作區",
        'heroPicker.retry': "重試",
        'error.title': '出咗錯',
        'cancel': '取消',
        'create': '建立',
        'confirm': '確定',
        'close': '關閉',
        'ws.rename.title': '重新命名工作區',
        'ws.rename.hint': '名稱入面嘅 / 就係層級分組,例如 web/前端',
        'ws.delete.title': '刪除工作區',
        'ws.delete.body': '只會移除工作區登記,目錄同對話記錄都會保留。確定刪除「{name}」?',
        'folder.rename.title': '重新命名分組',
        'folder.rename.hint': '重新命名會同步更新組內所有工作區名稱',
        'folder.error.empty': '分組路徑唔可以係空',
        'group.move.title': '移動到分組',
        'group.pick': '選擇已有分組',
        'group.new': '新增分組',
        'group.new.title': "新增分組",
        'group.new.sess': "工作階段分組",
        'group.new.ws': "工作區分組",
        'group.new.both': "新增工作階段或工作區分組",
        'group.new.where': "揀建立位置",
        'group.new.placeholder': "分組名,可用 / 嵌套",
        'group.new.nameHint': "名入面嘅 / 即嵌套層級,例如 前端/組件",
        'group.new.empty': "請輸入分組名",
        'group.new.root': "最頂層",
        'group.new.independent': "新增頂層分組",
        'group.new.pickWorkspace': "揀一個工作區",
        'group.new.noWorkspace': "仲未有工作區,請先加一個",
        'group.new.pickFirst': "請先揀一個工作區",
        'group.delete.title': "刪除分組",
        'group.delete.body': "「{name}」係空分組,刪咗冇得返轉頭。",
        'menu.deleteGroup': "刪除分組",
      },
      /* locale: zh-TW */
      'zh-TW': {
        'title': '工作區',
        'search.placeholder': '搜尋工作區或工作階段',
        'add': '新增工作區',
        'rail.search': '搜尋',
        'rail.add': '新增工作區',
        'empty': '尚無工作區',
        'empty.search': '沒有相符的結果',
        'session.new': '新工作階段',
        'viewOptions.label': '檢視選項',
        'viewOptions.groupBy': '分組方式',
        'viewOptions.byWorkspace': '按工作區',
        'viewOptions.byWorkspaceTree': '按工作區樹',
        'viewOptions.flat': '單一列表',
        'viewOptions.orderBy': '排序方式',
        'viewOptions.manualOrder': '手動排序',
        'viewOptions.updatedOrder': '最近更新',
        'viewOptions.sessionSlash': '工作階段按「/」分組',
        'viewOptions.wsGroupBy': "工作區分組",
        'viewOptions.wsByDisk': "磁碟資料夾",
        'viewOptions.wsByDiskSlash': "磁碟 + 名稱",
        'viewOptions.wsBySlash': "僅名稱",
        'group.ungrouped': '未分組',
        'sessions.expand': '展開 {n} 個工作階段',
        'sessions.collapse': '收合',
        'time.now': '剛剛',
        'time.minutes': '{n} 分鐘',
        'time.hours': '{n} 小時',
        'time.days': '{n} 天',
        'time.months': '{n} 個月',
        'time.years': '{n} 年',
        'status.running': '生成中',
        'status.completed': '已完成',
        'status.approval': '等待核准',
        'status.planReview': '等待計畫確認',
        'status.question': '等待回答',
        'status.subagents': '{n} 個子任務執行中',
        'schedule.active': '有進行中的排程工作',
        'menu.rename': '重新命名',
        'menu.delete': '刪除',
        'menu.fork': '分支',
        'menu.archive': '封存',
        'menu.renameFolder': '重新命名群組',
        'menu.renameSgroup': '重新命名工作階段群組',
        'menu.moveToGroup': '移動到分組…',
        'menu.moveOutGroup': '移出分組',
        'settings.title': '更好的工作區',
        'settings.desc': '工作區樹的外觀與收合偏好',
        'settings.expand': '展開',
        'settings.collapse': '收合',
        'settings.compactChains': '單鏈群組合併顯示',
        'settings.compactChains.hint': '單層鏈會合併成一行,出現多個子層級時自動展開為樹狀;拖曳工作區期間單鏈會暫時展開回資料夾樹,可放入任一層級;展開狀態與自訂外觀會保存在本瀏覽器。',
        'settings.statusPulse': '狀態呼吸燈',
        'settings.statusPulse.hint': '被收合藏起的狀態燈(完成綠 / 執行藍 / 待互動琥珀)會沿著層級向外冒出:工作區與群組列以圖示呼吸發光(顏色隨狀態,自訂過發光的標題一起呼吸),工作階段群組列則顯示呼吸狀態燈;預設開啟,可在此關閉。',
        'settings.workspaceGroup': "工作區分組",
        'settings.workspaceGroup.hint': "磁碟資料夾 = 只按官方資料夾(磁碟目錄)巢狀;磁碟 + 名稱 = 在磁碟層之上再按標題裏的 / 分組;僅名稱 = 只按標題裏的 / 分組,完全不理會磁碟目錄的巢狀關係。舊版本的開關狀態會自動遷移。",
        'settings.sessionLimit': "展開時顯示會話數",
        'settings.sessionLimit.all': "全部",
        'settings.sessionLimit.hint': "展開工作區時先只顯示最近的部分會話,其餘收進「展開 {n} 個會話」一行,點擊展開該組全部;釘選、進行中和等待你的會話始終顯示。全部 = 不限量(預設)。",
        'settings.sessionMenu': "會話右鍵選單",
        'settings.sessionMenu.hint': "開啟時右鍵點擊會話列即可開啟動作選單(包含官方的釘選、封存、停止並封存等);關閉後改為在列尾懸停顯示官方樣式的 ⋯ 按鈕,點擊開啟同一個選單。預設開啟。",
        'settings.rowActions': "會話列懸停按鈕",
        'settings.rowActions.hint': "懸停會話列時在列尾顯示釘選 / 封存快捷按鈕,與官方列保持一致;關閉後這些動作只保留在選單裡。預設開啟。",
        'settings.appearance': '預設外觀',
        'settings.appearance.hint': '未個別自訂過的列會使用這套外觀;字型外框預設開啟——在背景圖片上沒有外框的文字常常看不清楚。字型顏色留空即跟隨佈景主題。',
        'settings.appearance.reset': '還原預設外觀',
        'custom.title': '自訂外觀',
        'custom.color': '顏色',
        'custom.glow': '發光',
        'custom.preview': '即時預覽',
        'custom.preview.sample': '工作區範例',
        'custom.weight': '字型粗細',
        'custom.weight.regular': '標準',
        'custom.weight.medium': '中',
        'custom.weight.semibold': '半粗',
        'custom.weight.bold': '粗',
        'custom.shadow': '字型陰影',
        'custom.stroke': '字型外框',
        'custom.stroke.hint': '外框顏色預設為灰色,可改成黑 / 白 / 任意顏色,或選「自動」依字型顏色取對比色(淺色字配黑邊、深色字配白邊);自動模式會跟隨佈景主題明暗與背景插件的介面明暗。',
        'custom.strokeWidth': '外框粗細',
        'custom.strokeColor': '外框顏色',
        'custom.strokeColor.auto': '自動',
        'custom.weak': '弱',
        'custom.medium': '中',
        'custom.strong': '強',
        'custom.icon': '圖示',
        'custom.icon.solid': '實心資料夾',
        'custom.icon.outline': '空心資料夾',
        'custom.icon.none': '不顯示',
        'custom.none': '不顯示',
        'custom.reset': '清除自訂',
        'custom.done': '完成',
        'settings.on': '開',
        'settings.off': '關',
        'sync.title': '跨裝置同步',
      'sync.desc': "外觀自訂與開關儲存在本裝置的瀏覽器裡;透過主機設定存放區與另一端互傳。平時的新修改會自動寫入主機,另一端點「取得」即可拿到;舊版本的歷史資料首次需要點一次「傳送」。",
        'sync.mode.overwrite': '覆寫本裝置',
        'sync.mode.merge': '合併兩端',
        'sync.pull.desktop': '從桌面用戶端取得',
        'sync.pull.web': '從 Web 取得',
        'sync.push': '傳送本裝置資料',
        'sync.done': '已同步',
        'sync.empty': '另一端尚無資料可取得',
        'sync.off': '目前環境不支援同步(需要宿主設定服務)',
        'sync.loading': '正在連線宿主設定…',
        'flow.creating': '正在建立…',
        'add.guide.title': "應用程式內新增工作區",
        'add.guide': "此主機沒有桌面資料夾選擇器。請至「新工作階段」頁,用官方的「新增工作區」開啟應用程式內瀏覽器。",
        'heroPicker.error.title': "無法新增工作區",
        'heroPicker.retry': "重試",
        'error.title': '發生錯誤',
        'cancel': '取消',
        'create': '建立',
        'confirm': '確定',
        'close': '關閉',
        'ws.rename.title': '重新命名工作區',
        'ws.rename.hint': '名稱中的 / 即層級群組,例如 web/前端',
        'ws.delete.title': '刪除工作區',
        'ws.delete.body': '僅移除工作區登錄,目錄與工作階段記錄都會保留。確定刪除「{name}」?',
        'folder.rename.title': '重新命名群組',
        'folder.rename.hint': '重新命名會同步更新群組內所有工作區名稱',
        'folder.error.empty': '群組路徑不能為空',
        'group.move.title': '移動到分組',
        'group.pick': '選擇現有群組',
        'group.new': '新增分組',
        'group.new.title': "新增分組",
        'group.new.sess': "工作階段分組",
        'group.new.ws': "工作區分組",
        'group.new.both': "新增工作階段或工作區分組",
        'group.new.where': "選擇建立位置",
        'group.new.placeholder': "分組名稱,可用 / 巢狀",
        'group.new.nameHint': "名稱中的 / 即巢狀層級,例如 前端/元件",
        'group.new.empty': "請輸入分組名稱",
        'group.new.root': "最頂層",
        'group.new.independent': "新增頂層分組",
        'group.new.pickWorkspace': "選擇一個工作區",
        'group.new.noWorkspace': "還沒有工作區,請先新增一個",
        'group.new.pickFirst': "請先選擇一個工作區",
        'group.delete.title': "刪除分組",
        'group.delete.body': "「{name}」是空分組,刪除後無法復原。",
        'menu.deleteGroup': "刪除分組",
      },
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

    function buildTree(items, groupMode, explicitWs) {
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
        const sortRec = (node) => {
          node.folders.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
          for (const child of node.folders) sortRec(child)
        }
        sortRec(root)
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
      // Dropdown triggers (MenuPicker): the same surface as .bw-input so a
      // picker and a text field read as one family.
      '.bw-select{display:flex;align-items:center;gap:6px;width:100%;box-sizing:border-box;height:26px;padding:0 8px;background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1));border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));border-radius:6px;color:inherit;font-size:12px;font-family:inherit;cursor:pointer;text-align:left}',
      '.bw-select:hover{border-color:var(--dsw-alias-brand-primary,#5b8def)}',
      '.bw-select-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.bw-select-chevron{flex:none;display:inline-flex;align-items:center;color:var(--dsw-alias-label-quaternary,#8a8a8a);font-size:10px;line-height:1}',
      '.bw-select-icon{width:26px;flex:none;justify-content:center;padding:0}',
      '.bw-combo{display:flex;align-items:center;gap:6px}',
      // The Menu root is a <span>; these make it fill the field, or sit inline
      // as the chevron-only button beside an input.
      '.bw-menu-block{display:block;width:100%}',
      '.bw-menu-inline{display:inline-block;width:auto;flex:none}',
      '.bw-tree{flex:1;overflow-y:auto;overflow-x:hidden;padding:2px 6px 12px;min-height:0}',
      '.bw-row{display:flex;align-items:center;gap:6px;min-height:28px;padding:0 6px;border-radius:6px;cursor:pointer;user-select:none;font-size:13px;color:var(--dsw-alias-label-primary,#e6e6e6);position:relative}',
      '.bw-drop-before::after{content:"";position:absolute;left:8px;right:8px;top:-1px;height:2px;border-radius:1px;background:var(--dsw-alias-brand-primary,#5b8def);pointer-events:none}',
      '.bw-drop-after::after{content:"";position:absolute;left:8px;right:8px;bottom:-1px;height:2px;border-radius:1px;background:var(--dsw-alias-brand-primary,#5b8def);pointer-events:none}',
      '.bw-drop-into{outline:1.5px dashed var(--dsw-alias-brand-primary,#5b8def);outline-offset:-1.5px}',
      // Grouping drop lands on the header button / a group row: solid brand
      // rim + a tinted wash so "this drop joins a group" reads stronger than
      // the reorder dashes above.
      '.bw-drop-into-strong{outline:2px solid var(--dsw-alias-brand-primary,#5b8def);outline-offset:-2px;background:color-mix(in srgb, var(--dsw-alias-brand-primary,#5b8def) 16%, transparent)}',
      // Session drag whose source sits in a group: a quiet dashed line at the
      // bottom of the tree says "anywhere outside a group = out of it". Kept
      // faint on purpose — the row outlines are the loud feedback.
      '.bw-root-drop-out::after{content:"";position:absolute;left:10px;right:10px;bottom:6px;border-bottom:1px dashed var(--dsw-alias-border-secondary,rgba(230,230,230,.35));pointer-events:none}',
      // v0.17.0: the new-group entry is an ICON button now (same family as the
      // search / add buttons beside it); the wording moved into its tooltip.
      '.bw-newgroup-btn{flex:none}',
      '.bw-seg{display:flex;gap:0;width:fit-content;border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.25));border-radius:7px;overflow:hidden}',
      '.bw-seg-btn{border:none;background:transparent;color:var(--dsw-alias-label-secondary,#b8b8b8);font:inherit;font-size:12.5px;padding:5px 14px;cursor:pointer}',
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
      '.bw-gn-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;color:var(--dsw-alias-label-primary,#e6e6e6)}',
      '.bw-gn-input{width:100%;box-sizing:border-box}',
      '.bw-row:hover{background:var(--dsw-specific-sidebar-nav-item-hover,var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12)))}',
      '.bw-row:hover{background:color-mix(in srgb,var(--dsw-specific-sidebar-nav-item-hover,rgba(127,127,127,.14)) 50%,transparent)}',
      '.bw-row-current{background:var(--dsw-specific-sidebar-nav-item-active,rgba(91,141,239,.15))}',
      '.bw-row-current{background:color-mix(in srgb,var(--dsw-specific-sidebar-nav-item-active,rgba(91,141,239,.16)) 40%,transparent)}',
      '.bw-row-icon{flex:none;display:grid;place-items:center;color:var(--dsw-alias-label-tertiary,#9a9a9a)}',
      '.bw-chevron{flex:none;display:grid;place-items:center;color:var(--dsw-alias-label-tertiary,#9a9a9a);transition:transform .15s ease}',
      '.bw-chevron-open{transform:rotate(90deg)}',
      // Hero picker rows (v0.22.0): hierarchy rides the row itself — an
      // indentation gutter, a folder chevron or workspace glyph, and the
      // trailing check. The row mirrors the primitives menu cell (same hover
      // and focus fill) because the fixed 14px icon cell of that row crops any
      // indentation nested inside it.
      '.bw-pick-row{display:flex;align-items:center;gap:6px;width:100%;min-height:30px;padding:4px 8px;border:none;border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:13px;cursor:pointer;text-align:left}',
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
      '.bw-row-archived{opacity:.55}',
      '.bw-pin-indicator{flex:none;display:inline-flex;align-items:center;color:var(--dsw-alias-brand-primary,#5b8def);margin:0 4px}',
      '.bw-overflow-row{display:block;width:100%;text-align:left;border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#9a9a9a);font-size:12px;cursor:pointer;padding:4px 6px;font-family:inherit}',
      '.bw-overflow-row:hover{color:var(--dsw-alias-label-secondary,#b8b8b8)}',
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
      '.bw-preview-label{font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:18px;padding:3px;margin:-3px}',
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
      /*
       * In-app directory browser (Hosts composing the browse backend). Every
       * surface rides the theme token chain like the rest of the plugin — the
       * list panel uses bg-layer-2 so a transparent/background plugin still
       * reads correctly; nothing may hard-code an opaque background.
       */
    ].join('')

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

    // Issue #8 progressive listing (official collapsedSessionRows mirror):
    // blank, running, running-subagent and pinned rows stay OUTSIDE the
    // quota; idle rows beyond it hide behind one overflow row. limit 0 =
    // unlimited (default — the plugin's folder-style full listing), and a
    // lifted workspace renders everything again.
    const limitSessionsForRender = (rows, limit, lifted) => {
      if (!rows || !limit || lifted) return { rows: rows || [], hidden: 0 }
      const keep = []
      const idle = []
      for (const row of rows) {
        if (row.blank || row.running || row.subagents > 0 || row.pinned) keep.push(row)
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
      init: () => ({ expanded: {}, sessionsExpanded: {}, sessionGroups: {}, sessionOrder: {}, prefs: { compactChains: true, sessionLimit: 0 }, styling: {}, groupBy: 'workspace-tree', orderBy: 'manual', archivedFilter: 'default', workspaceGroupMode: 'disk', sessionTitleSlash: true, workspaceTitleSlash: false, ungroupedOpen: true, folders: { ws: {}, sess: {} } }),
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
    // holes) — but it can only be rendered by the entry that DECLARED the
    // child hole (the shipped WorkspaceBrowser), and a child declaration is
    // exclusive, so shadowing that seat forfeits the authorization for good
    // (ui-renderer: "not declared by this entry's children"). A native Host
    // still gets the official OS chooser; a browse Host is pointed at the
    // official in-app flow in the conversation empty state instead of a
    // second-hand imitation. The probe stays: it decides which of the two
    // this page gets, and a refused pick still classifies the backend.
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

    function FolderRow({ node, depth, expanded, onToggle, onContextMenu, dropInto, dragEvents, custStyle, iconMode, pulse, t }) {
      const total = countWorkspaces(node)
      const iconEl = iconOf(iconMode, expanded)
      // Hidden status dots breathe on the icon; with the icon hidden (mode
      // "none" or a missing primitive) the official StateDot stands in.
      const iconChild = pulse
        ? E(PulseGlow, { state: pulse }, iconEl || (typeof ui.StateDot === 'function' ? E(ui.StateDot, { state: pulse, size: 10 }) : null))
        : iconEl
      return E('div', {
        className: cls('bw-row', dropInto && 'bw-drop-into', dropInto && 'bw-drop-into-strong'),
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

    function WorkspaceRow({ workspace, depth, count, sessionsOpen, onToggle, onStart, onContextMenu, currentInside, dropHalf, dropInto, dragEvents, custStyle, iconMode, pulse, t }) {
      const iconEl = iconOf(iconMode, sessionsOpen)
      const iconChild = pulse
        ? E(PulseGlow, { state: pulse }, iconEl || (typeof ui.StateDot === 'function' ? E(ui.StateDot, { state: pulse, size: 10 }) : null))
        : iconEl
      return E('div', {
        className: cls('bw-row', currentInside && 'bw-row-current', dropHalf === 'before' && 'bw-drop-before', dropHalf === 'after' && 'bw-drop-after', dropInto && 'bw-drop-into', dropInto && 'bw-drop-into-strong'),
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

    function SessionRow({ node, depth, current, onOpen, onContextMenu, now, dropHalf, dragEvents, custStyle, breathing, sessionActions, t }) {
      const state = sessionStateOf(node)
      const status = state === null ? null : {
        state,
        title: state === 'warning'
          ? t('status.' + (node.pending === 'plan-review' ? 'planReview' : node.pending))
          : state === 'ongoing'
            ? (node.running ? t('status.running') : t('status.subagents', { n: node.subagents }))
            : t('status.completed'),
      }
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
      const strip = !node.blank && sessionActions && (sessionActions.trigger || sessionActions.quick)
        ? E('span', { className: 'bw-row-actions', onClick: (e) => e.stopPropagation() },
            sessionActions.trigger ? E('button', {
              type: 'button',
              className: 'bw-icon-btn',
              'aria-label': official('actions.session.aria', { name: node.leaf || node.title }) || '...',
              title: sessionActions.triggerTitle,
              onClick: (e) => sessionActions.openMenu(node, e),
            }, icon('IconEllipsisOutline16', 15)) : null,
            sessionActions.quick && sessionActions.pin && !node.archived ? E('button', {
              type: 'button',
              className: 'bw-icon-btn',
              'aria-label': official(node.pinned ? 'menu.unpinSession' : 'menu.pinSession') || '',
              title: official(node.pinned ? 'actions.unpin' : 'actions.pin') || undefined,
              onClick: (e) => { e.stopPropagation(); sessionActions.pin(node.id, !node.pinned) },
            }, icon(node.pinned ? 'IconPinFillRegular' : 'IconPinOutlineRegular', 14)) : null,
            sessionActions.quick && sessionActions.archive ? E('button', {
              type: 'button',
              className: 'bw-icon-btn',
              'aria-label': official(node.archived ? 'menu.unarchiveSession' : 'menu.archiveSession') || '',
              title: official(node.archived ? 'actions.unarchive' : 'actions.archive') || undefined,
              onClick: (e) => { e.stopPropagation(); sessionActions.archive(node.id, !node.archived) },
            }, icon(node.archived ? 'IconUnarchiveOutlineRegular' : 'IconArchiveOutline20', 14)) : null,
          )
        : null
      return E('div', {
        className: cls('bw-row', 'bw-session-row', current && 'bw-row-current',
          node.archived && 'bw-row-archived',
          dropHalf === 'before' && 'bw-drop-before', dropHalf === 'after' && 'bw-drop-after'),
        style: { paddingLeft: 8 + depth * 12, ...(custStyle || {}) },
        onClick: () => {
          if (node.archived) {
            // Official semantics (guardedOpen): an archived row is not
            // openable — the click explains instead of navigating.
            if (sessionActions && typeof sessionActions.explainArchived === 'function') sessionActions.explainArchived()
            return
          }
          onOpen(node.id)
        },
        onContextMenu: onContextMenu,
        role: 'treeitem',
        'aria-description': node.archived ? archivedTitle || undefined : undefined,
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
        node.pinned ? E('span', { className: 'bw-pin-indicator', role: 'img', 'aria-label': pinnedTitle || undefined, title: pinnedTitle || undefined }, icon('IconPinFillRegular', 13)) : null,
        strip,
      )
    }

    /**
     * Session sub-group inside a workspace (same "/" convention on session
     * titles). Deliberately NOT styled like a workspace folder — no folder
     * icon, tertiary color — so a session level never reads as a workspace.
     */
    function SessionGroupRow({ name, depth, expanded, count, onToggle, onContextMenu, dropInto, dragEvents, custStyle, pulse, t }) {
      return E('div', {
        className: cls('bw-row', 'bw-sgroup-row', dropInto && 'bw-drop-into', dropInto && 'bw-drop-into-strong'),
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
      const showLabel = official('viewOptions.showArchived')
      const onlyLabel = official('viewOptions.onlyArchived')
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
            // Both items are exclusive toggles (official semantics):
            // re-picking the selected one returns to the default view.
            { id: 'show-archived', label: showLabel, icon: icon('IconArchiveOutline20', 16) },
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
          .concat(filter === 'show' ? ['show-archived'] : [])
          .concat(filter === 'only' ? ['only-archived'] : [])
          .concat(workspaceGroupMode === 'disk' ? ['ws-disk'] : [])
          .concat(workspaceGroupMode === 'disk-slash' ? ['ws-disk-slash'] : [])
          .concat(workspaceGroupMode === 'slash' ? ['ws-slash'] : []),
        onSelect: (id) => {
          if (id === 'workspace' || id === 'workspace-tree' || id === 'flat') { onPick('groupBy', id); setOpen(false); return }
          if (id === 'manual' || id === 'updated') { onPick('orderBy', id); setOpen(false); return }
          if (id === 'show-archived') { onFilterPick(filter === 'show' ? 'default' : 'show'); setOpen(false); return }
          if (id === 'only-archived') { onFilterPick(filter === 'only' ? 'default' : 'only'); setOpen(false); return }
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
      const sessionMenu = prefs.sessionMenu !== false
      const rowActions = prefs.rowActions !== false
      // Progressive listing quota (v0.21.0, issue #8): 0 = unlimited.
      const rawLimit = Math.floor(Number(prefs.sessionLimit))
      const sessionLimit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 0
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
        E('div', { className: 'bw-setting-row', style: { marginTop: 10 } },
          E('div', { className: 'bw-setting-label' }, t('settings.sessionMenu')),
          E('button', {
            type: 'button',
            role: 'switch',
            'aria-checked': sessionMenu,
            'aria-label': t('settings.sessionMenu'),
            className: cls('bw-switch', sessionMenu && 'bw-switch-on'),
            onClick: () => { setPref('sessionMenu', !sessionMenu) },
          }, E('span', { className: 'bw-switch-thumb' })),
        ),
        E('div', { className: 'bw-hint' }, t('settings.sessionMenu.hint')),
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
        E('div', { className: 'bw-setting-row', style: { marginTop: 10 } },
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
        // Manual cross-device sync exists only where a SHARED host home does
        // (dsh <= 0.1.6 settings.yaml; both surfaces read one file). On
        // dsh >= 0.1.7 settings persist per profile, so the section hides.
        prefsScopeVia === 'settingsScope' ? E(React.Fragment, null,
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
        ) : null,
      )
    }

    /* --------- settings → plug-ins card (accordion like official cards) --------- */

    function BetterWorkspacePluginCard(props) {
      const { useStore, actions, t } = props
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
      // Occupancy is the only reactive fact here: the ledger read re-runs on
      // every render, so the count just forces the re-render when the shipped
      // occupant loads or unloads (its identity is stable while occupied).
      const flowCount = useFlowOccupancy(count => count)
      /** Picker-local collapse: the tree opens fully expanded (a chooser must show its targets) and a folder row folds only here. */
      const [folded, setFolded] = React.useState(EMPTY_FOLDERS)
      const [flowOpen, setFlowOpen] = React.useState(false)
      const [picking, setPicking] = React.useState(false)
      const [errorText, setErrorText] = React.useState(null)

      const items = snapshot && Array.isArray(snapshot.items) ? snapshot.items : EMPTY_LIST
      // Same construction the sidebar runs (buildTree + optional chain
      // compression), so both surfaces answer the same view options.
      const tree = React.useMemo(() => {
        const built = buildTree(items, groupMode, wsFolders)
        if (!compactChains) return built
        return { ...built, folders: built.folders.map((f) => materializeChain(compressTree(f))), workspaces: built.workspaces }
      }, [items, groupMode, wsFolders, compactChains])

      const rows = React.useMemo(() => {
        const out = []
        const flatMode = groupBy !== 'workspace-tree'
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
        useStore, actions,
        startSession, open, renameSession, forkSession, renameWorkspace, deleteWorkspace,
        archiveSession, createWorkspace, pinSession, unpinSession, unarchiveSession,
        insertWorkspaceBefore, insertSessionBefore,
        useDirectoryFlow,
        pickDirectory, listDirectory, createDirectory,
        officialT,
        t,
      } = props

      if (typeof useWorkspaces !== 'function' || typeof useSessions !== 'function') {
        console.error('[dsh-better-workspace] standard snapshot hooks missing; browser renders nothing')
        return null
      }

      const items = useWorkspaces(s => s.items)
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
      // Dual-write wrappers: every preference mutation lands in the local
      // store (immediate echo + scope-less fallback) AND the host settings
      // store (durable cross-device copy for the manual pull on the other
      // surface). Computed from the CURRENT rendered values.
      const shared = makeSharedWrites(actions, stylingMap)
      const compactChains = prefsMap.compactChains !== false
      const statusPulse = prefsMap.statusPulse !== false
      // Session-action surface gates (v0.20.0): the right-click menu and the
      // official-style hover strip can each be turned off; defaults follow
      // the plugin's historical behavior (right-click on, quick buttons on).
      const sessionMenuEnabled = prefsMap.sessionMenu !== false
      const rowActionsEnabled = prefsMap.rowActions !== false
      // Archived-row visibility (v0.20.0, official ArchivedFilter mirror);
      // persisted snapshots from older plugin versions lack the key.
      const archivedFilter = useStore ? (useStore(s => s.archivedFilter) || 'default') : 'default'
      const archivedSet = React.useMemo(() => new Set(archivedSessionIds), [archivedSessionIds])
      const pinnedSet = React.useMemo(() => new Set(pinnedSessionIds), [pinnedSessionIds])
      const subCounts = React.useMemo(() => subagentRunningCounts(list ? list.byId : {}), [list ? list.byId : null])
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
          if (accounted.has(id) || !sessionVisible(summary, currentId, archivedSet, archivedFilter)) continue
          const st = statusOf(id)
          ungrouped.push({
            id,
            title: sessionTitleOf(summary, t, rememberedTitleOf(id)),
            leaf: sessionTitleOf(summary, t, rememberedTitleOf(id)),
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

      // While a workspace drag is active, single-child chains render UNCOMPRESSED:
      // a merged "group/workspace" row hides every folder level of the chain inside
      // its label, and those levels are exactly the drop targets for "move into
      // this group". Suspending the merge for the drag's duration re-exposes each
      // level as a real folder row (folder expansion defaults apply); when the
      // drag ends, the chains merge back. Session drags keep the merged view —
      // their drop targets live inside workspace rows, which compression merges.
      const draggingWorkspace = drag !== null && drag.kind === 'workspace'
      const tree = React.useMemo(() => {
        const built = buildTree(items, workspaceGroupMode, wsFolders)
        if (!compactChains || draggingWorkspace) return built
        return { ...built, folders: built.folders.map((f) => materializeChain(compressTree(f))), workspaces: built.workspaces }
      }, [items, compactChains, draggingWorkspace, workspaceGroupMode, wsFolders])
      // UNCOMPRESSED tree, for the new-group dialog only. compressTree merges a
      // single-child chain into one row that stands for BOTH a group and the
      // workspace under it — fine for drawing, useless for choosing a
      // container: one half must stay unselectable and the other must be
      // selectable, and a merged row cannot be both. (It also carried no
      // `name`, which is how a lone "E" rendered blank.)
      const rawTree = React.useMemo(() => buildTree(items, workspaceGroupMode, wsFolders), [items, workspaceGroupMode, wsFolders])
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
            title: sessionTitleOf(summary, t, rememberedTitleOf(id)),
            leaf: sessionTitleOf(summary, t, rememberedTitleOf(id)),
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
        if (orderBy === 'updated') {
          const sorted = rows.slice().sort((a, b) => (b.updatedAt - a.updatedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
          const pin = currentId !== undefined && sorted.find((row) => row.id === currentId && row.blank)
          if (pin) {
            const at = sorted.indexOf(pin)
            if (at > 0) { sorted.splice(at, 1); sorted.unshift(pin) }
          }
          return pinnedPartition(sorted)
        }
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

      const openCtx = (kind, payload, e) => {
        if (e) e.preventDefault()
        setCtx({ kind, payload, x: e.clientX, y: e.clientY })
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
      const pinAvailable = typeof pinSession === 'function' && typeof unpinSession === 'function'
      const unarchiveAvailable = typeof unarchiveSession === 'function'
      const sessionActions = {
        ot: officialT,
        // Right-click is the default trigger; turning the setting off moves
        // the trigger to the official-style "..." hover button.
        trigger: !sessionMenuEnabled,
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
        return group ? group + '/' + leaf : leaf
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
        const treeView = groupBy === 'workspace-tree'
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
            setDrag({ kind: 'workspace', source: { workspaceId: workspace.workspaceId, leaf: sourceLeaf, folderPath: sourceFolder, disk: diskParentMap.get(workspace.workspaceId) }, over: null })
          }, 0)
        },
        onDragEnd: () => {
          if (wsDragArmTimer.current !== null) { clearTimeout(wsDragArmTimer.current); wsDragArmTimer.current = null }
          setDrag(null)
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
          if (dragMatches('session')) {
            if (!sessionSlash || drag.source.workspaceId !== workspace.workspaceId) return
            if (leafOf(drag.source.title) === drag.source.title) return
            event.preventDefault()
            event.stopPropagation()
            commitSessionMoveOut(workspace.workspaceId)
            return
          }
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
        const targetFolder = targetWorkspace.folderPath || ''
        // A disk-only tree has no name groups to move between: force the reorder
        // path even if the source was armed before the switch flipped.
        const sameFolder = !workspaceSlash || targetFolder === source.folderPath
        // The disk layer is a filesystem fact and never changes here: an
        // in-level drop keeps the manual order next to the anchor, a
        // cross-level drop only re-groups the title (the registry append
        // lands it at the end of ITS disk level).
        const sameDisk = source.disk === diskParentMap.get(targetWorkspace.workspaceId)
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
        // (blank/running/subagent/pinned stay visible); one overflow row
        // hides the rest until clicked. Search always shows everything.
        const limited = limitSessionsForRender(full, sessionLimit, limitLifted[workspace.workspaceId])
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
        breathing: statusPulse,
        t,
      })

      const renderWorkspaceEntry = (entry, depth, pulse) => {
        const { workspace } = entry
        const count = countSessionTree(buildSessionTree(sessionsOf(workspace), sessionSlash, sessFolders, workspace.workspaceId))
        const rows = [E(WorkspaceRow, {
          key: 'ws-' + workspace.workspaceId,
          workspace,
          depth,
          count,
          sessionsOpen: searching ? true : sessionsOpenOf(workspace.workspaceId),
          currentInside: !!(currentId && (workspace.sessionIds || []).includes(currentId)),
          onToggle: () => { if (!searching) actions.setSessionsExpanded(workspace.workspaceId, !sessionsOpenOf(workspace.workspaceId)) },
          // Starting a session force-expands the workspace row: the user must
          // SEE the new session appear, even if the row was collapsed.
          onStart: () => { actions.setSessionsExpanded(workspace.workspaceId, true); startSession(workspace.workspaceId) },
          onContextMenu: (e) => openCtx('workspace', workspace, e),
          dropHalf: wsDropHalf(workspace.workspaceId),
          dropInto: wsRootDropActive(workspace.workspaceId),
          dragEvents: workspaceDragEvents(workspace),
          custStyle: rowStyleOf('workspace:' + workspace.workspaceId),
          iconMode: (styleEntry('workspace:' + workspace.workspaceId) || {}).icon || 'solid',
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

      const renderLevelRows = (level, depth) => {
        const rows = []
        for (const folder of level.folders) rows.push(...renderPlainFolder(folder, depth))
        for (const workspace of level.workspaces) rows.push(...renderWorkspaceEntry({ workspace }, depth, wsPulseOf(workspace)))
        return rows
      }

      const renderPlainFolder = (node, depth) => {
        if (node.kind === 'ws') return renderWorkspaceEntry({ workspace: node.workspace }, depth, wsPulseOf(node.workspace))
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
          dragEvents: folderDropEvents(idPath),
          custStyle: rowStyleOf('folder:' + idPath),
          iconMode: (styleEntry('folder:' + idPath) || {}).icon || 'solid',
          pulse: expanded ? null : folderPulseOf(node),
          t,
        })]
        if (expanded) {
          for (const child of node.folders) rows.push(...renderPlainFolder(child, depth + 1))
          for (const workspace of node.workspaces) rows.push(...renderWorkspaceEntry({ workspace }, depth + 1, wsPulseOf(workspace)))
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
        return rows.map((s) => renderSessionRow({ ...s, leaf: s.title }, 0, undefined))
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
            style: { paddingLeft: 8 },
            onClick: () => { if (!searching && actions && typeof actions.setUngroupedOpen === 'function') actions.setUngroupedOpen(!open) },
            role: 'treeitem',
            'aria-expanded': open,
          },
            E('span', { className: cls('bw-chevron', open && 'bw-chevron-open') }, icon('IconTriangleRightFill14', 14)),
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
        // Official 'workspace' mode (v0.13): one level — every workspace at
        // the root, no name groups, no disk nesting, no chain compression.
        // Session rows keep the slash toggle; disk-nested children do not
        // recurse here because raw items carry no .sub level.
        // flatWorkspaceEntry, never the raw item: see its note — the raw one
        // has no `leaf` and the row would render nameless.
        for (const workspace of items || []) {
          bodyRows.push(...renderWorkspaceEntry({ workspace: flatWorkspaceEntry(workspace) }, 0, wsPulseOf(workspace)))
        }
        bodyRows.push(...renderUngroupedBlock())
      } else {
        for (const folder of tree.folders) bodyRows.push(...renderPlainFolder(folder, 0))
        for (const workspace of tree.workspaces) bodyRows.push(...renderWorkspaceEntry({ workspace }, 0, wsPulseOf(workspace)))
        bodyRows.push(...renderUngroupedBlock())
      }
      const isEmpty = bodyRows.length === 0
      if (isEmpty) {
        bodyRows = [E('div', { key: 'empty', className: 'bw-empty' }, searching ? t('empty.search') : (phase === 'pending' ? '…' : t('empty')))]
      }

      /* ------------------------- context menu ------------------------ */

      // Context-menu entries mirror the OFFICIAL row menus item-for-item
      // (ui-workspace Rows.tsx workspaceMenuItems / sessionMenuItems): same
      // ids, same icons, same danger semantics, and — through the official
      // 'workspace' dictionary — the same copy, so upstream rewording lands
      // here without a plugin release. What the official menus cannot
      // provide is the bw-only surface: name-group / session-group rename
      // and Customize appearance, appended after a separator.
      const ot = typeof officialT === 'function' ? officialT : null
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
        // "Leave the group" (v0.18.0) — the counterpart of move-group, offered
        // only where a group actually exists to leave: a SESSION row whose own
        // title carries a "/" prefix, with the session name layer on. A
        // top-level row gets no entry (there is nothing to leave).
        const ungroupItem = { id: 'move-out', label: t('menu.moveOutGroup'), icon: icon('IconRightUpOutline16', 16) }
        const wsGroupItems = workspaceSlash ? [groupItem] : []
        const sgroupItems = sessionSlash ? [groupItem] : []
        const sessionUngroupItems = sessionSlash && ctx.kind === 'session' && ctx.payload && groupPrefixOf(String(ctx.payload.title || '')) !== '' ? [ungroupItem] : []
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
        ]
        if (ctx.kind === 'session') {
          // Official 0.1.7 mirror (Rows.tsx session menu + the shipped slot
          // entries): pin, rename, fork, archive — same order, same icons,
          // same archived-state behavior (pin hides; archive becomes
          // unarchive). Copy rides the official dictionary, so upstream
          // rewording AND future item additions land without a plugin
          // release; every verb is gated on its service method so older
          // hosts simply never offer what they cannot do.
          const payload = ctx.payload || {}
          const archived = !!(payload.archived || (archivedSet && archivedSet.has(payload.id)))
          const pinned = !!(payload.pinned || (pinnedSet && pinnedSet.has(payload.id)))
          const official = (key, fallback) => {
            const value = typeof ot === 'function' ? ot(key) : null
            return typeof value === 'string' && value !== '' && value !== key ? value : fallback
          }
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
            { type: 'separator', id: 'bw-sep' },
            ...sessionUngroupItems,
            ...sgroupItems,
            customizeEntry,
          ]
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
        else if (kind === 'sgroup' && id === 'rename-sgroup') setDialog({ kind: 'sgroup-rename', target: payload })
        else if (kind === 'session' && id === 'rename') setDialog({ kind: 'sess-rename', session: payload })
        else if (kind === 'session' && id === 'fork') forkSession(payload.id)
        else if (kind === 'session' && (id === 'pin' || id === 'unpin') && pinAvailable) {
          Promise.resolve().then(() => (id === 'pin' ? pinSession : unpinSession)(payload.id)).catch((reason) => {
            fail(officialText(id === 'pin' ? 'toast.pinFailed' : 'toast.unpinFailed', undefined, reason instanceof Error ? reason.message : String(reason || 'pin failed')))
          })
        }
        else if (kind === 'session' && id === 'unarchive' && unarchiveAvailable) {
          Promise.resolve().then(() => unarchiveSession(payload.id)).catch((reason) => { console.warn('session unarchive rejected:', reason) })
        }
        else if (kind === 'session' && id === 'archive' && typeof archiveSession === 'function') {
          Promise.resolve().then(() => archiveSession(payload.id)).catch((reason) => {
            if (reason && reason.name === 'WorkspaceArchiveError') {
              setDialog({ kind: 'sess-archive-confirm', sessionId: payload.id })
              return
            }
            fail(reason)
          })
        }
        // Plain retitle back to the leaf: the row leaves its group and returns
        // to the top level of its workspace (v0.18.0).
        else if (kind === 'session' && id === 'move-out') {
          const leaf = leafOf(String(payload.title || ''))
          if (leaf !== payload.title) Promise.resolve().then(() => renameByUser(payload.id, leaf)).catch(fail)
        }
      }

      /* --------------------------- dialogs --------------------------- */
      // TextDialog / ConfirmDialog are module-level components: a per-render
      // inline definition would remount on every parent tick and drop input.

      /* ---------------------------- render --------------------------- */

      if (!wide) {
        return E('div', { className: 'bw-rail' },
          StyleNode(),
          E('button', { type: 'button', className: 'bw-rail-btn', 'aria-label': t('rail.search'), onClick: () => { expandSidebar(); setSearchOpen(true) } }, icon('IconSearchOutline16', 18)),
          flowAvailable ? E('button', { type: 'button', className: 'bw-rail-btn', 'aria-label': t('rail.add'), onClick: () => { expandSidebar(); startAddFlow() }, disabled: flowBusy }, icon('IconProjectAddOutline16', 18)) : null,
        )
      }

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
          const displayTitle = summary ? sessionTitleOf(summary, t, rememberedTitleOf(dialog.sessionId)) : ''
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
        if (dialog.kind === 'add-guide') return E(ui.Modal, {
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
      // A `browse` host refuses that pick by design, so the click explains where
      // the official in-app flow lives instead of opening a plugin-built copy —
      // the shipped dialog cannot be rendered from here (see the capability block).
      const startAddFlow = () => {
        Promise.resolve(pickerCapabilityNow())
          .then((kind) => {
            if (kind === 'browse') { setDialog({ kind: 'add-guide' }); return undefined }
            return Promise.resolve()
              .then(() => pickDirectory())
              .then((path) => (path ? adoptDirectory(String(path)) : undefined))
              .catch((reason) => {
                if (pickerRefusal(reason)) { setDialog({ kind: 'add-guide' }); return }
                fail(messageOf(reason))
              })
          })
          .catch((reason) => { fail(messageOf(reason)) })
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

      return E('div', { className: cls('bw-root', sessionCouldLeaveGroup && 'bw-root-drop-out'), ...rootDropEvents },
        StyleNode(),
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
          E('button', { type: 'button', className: 'bw-icon-btn', 'aria-label': t('search.placeholder'), onClick: () => setSearchOpen(v => !v) }, icon('IconSearchOutline16')),
          flowAvailable ? E('button', { type: 'button', className: 'bw-icon-btn', 'aria-label': t('add'), onClick: startAddFlow, disabled: flowBusy }, icon('IconProjectAddOutline16')) : null,
        ),
        E('div', { ref: treeRef, className: 'bw-tree', role: 'tree', 'aria-label': t('title') }, bodyRows),
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
      // The capability probe talks to the composed backend through this
      // service (list is served by browse alone), so the state module needs
      // the handle before any flow can open.
      pickerState.api = uiWorkspace

      // The OFFICIAL browser's own dictionary (NS 'workspace'), bound so the
      // context menu COPY follows upstream wording automatically — the menu
      // mirrors the official row menus item-for-item (Rows.tsx), and this
      // way upstream rewording lands here without a plugin release. Falls
      // back to this plugin's aligned dictionary when bind fails.
      let officialT = null
      try { officialT = ctx.locale.bind('workspace') } catch { officialT = null }

      if (ctx.locale && typeof ctx.locale.register === 'function') {
        ctx.effect(() => {
          try {
            return ctx.locale.register(NS, Object.assign({ zh, en }, LOCALES))
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
      // dsh 0.1.6-alpha.2 retention contract: rename borrows through
      // sessions.using with an explicit source — the old plain binding(id)
      // only ever saw already-retained sessions, so renaming a closed row
      // reported "unknown session". Fork and open go through the uiWorkspace
      // navigation service: ISessions no longer carries open() at all
      // (navigation belongs to the view owner, replaceMain).
      //
      // Host-era compat (0.1.5-rc.x hosts ship ISessions.binding only — the
      // 0.1.6-alpha.2 contract replaced it with using): calling sessions.using
      // there died with "sessions.using is not a function", which took down
      // every rename path (row dialog, session-group batch, group move). Prefer
      // the new contract, fall back to the old one, and only then fail loud.
      const renameSession = async (sessionId, title) => {
        if (typeof sessions.using === 'function') {
          const result = await sessions.using(
            sessionId,
            { source: 'workspaceOperation' },
            (reference) => reference.binding.session.rename(title),
          )
          if (!result || !result.ok) throw new Error(result && result.error ? result.error.message : 'session rename failed')
          return
        }
        const binding = typeof sessions.binding === 'function' ? sessions.binding(sessionId) : undefined
        const face = binding ? binding.session : undefined
        if (!face || typeof face.rename !== 'function') throw new Error('session rename is unavailable on this host')
        const result = await face.rename(title)
        if (!result || !result.ok) throw new Error(result && result.error ? result.error.message : 'session rename failed')
      }
      const forkSession = (sessionId) => {
        uiWorkspace.forkSession(sessionId)
          .catch(() => { /* keep current selection */ })
      }

      const browserInjected = () => ({
        // Official 'workspace' dictionary translate (menu copy follows upstream);
        // null when the bind failed — the menu then uses the aligned bw copy.
        officialT,
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

      // The SIDEBAR hole is occupied by our own picking flow at priority -1:
      // rendering the official occupant is impossible here (a child-hole
      // declaration is exclusive — the shipped browser entry keeps owning
      // 'sidebar.workspaces.directoryFlow' even after losing the render race,
      // and re-declaring throws), so the flow probes the backend itself — the
      // OS chooser through the same official host service on native Hosts,
      // the polished in-app dialog on browse Hosts. The HERO hole stays
      // untouched: the conversation empty-state flow is purely official.

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

      // dsh 0.1.6-alpha.2+ moves third-party configuration to the Plugins
      // panel's bundle page: plugins.bundle.config, keyed by PACKAGE name and
      // rendered with view: 'page'. The inject waits for the declaration, so
      // older hosts simply never grow this seat — the settings.plugin.item
      // card above remains the settings surface there.
      slots.inject('plugins.bundle.config', guarded(
        'plugins.bundle.config',
        {
          name: 'plugins.bundle.config',
          key: 'dsh-better-workspace',
          locale: NS,
          store: viewStore,
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
      inject: ['slots', 'sessions', 'workspaces', 'locale', 'uiWorkspace'],
      apply,
    }
  },
})
