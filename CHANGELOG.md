# Changelog — dsh-better-workspace

> 倒序排列,新版本条目在最上面。条目格式:`## vX.Y.Z — YYYY-MM-DD` + 类型(feat / fix / docs / chore)+ 要点 + 相关链接。
> 纪律见 AGENTS.md「变更记录纪律」:发版前先更新本文件并随版本提交;事故复盘、复现与真机验证记录也记在这里。

## v0.24.0 — 2026-09-25

**类型**:feat(设置开关「新增项自动配色 + 图标」,默认关闭;内置 13 色调色板 + 洗牌去重抽取)

### feat:新增项自动配色 + 图标(prefs.autoStyle,默认关)

**需求(用户原话)**:「新增一个功能设置开关,那就是自动随机颜色和图标,默认关闭启动后,新增的会话和新增的工作区都会随机这两个,对懒得一个个设置的人很方便。」颜色口径:「不能太随意…尽可能有区分度但不会导致和背景混合…不要导致字反而难以看清,内置定死十几个颜色,随机选择」。

**落地**:设置卡新增开关(与「会话右键菜单 / 会话行悬停按钮 / 状态呼吸灯」同款 `role="switch"`,键 `prefs.autoStyle`,**缺省即关**)。开启后,新会话分到一个内置色、新工作区分到一个内置色 + 一个图标。

**颜色作用面(决定了调色板怎么挑)**:本插件的行级外观里 `color` 落在 `rowStyleOf()` 的 `style.color`,也就是**整行文字色**(外加可选 textShadow/描边),不是装饰色点。因此调色板按**文字可读性**定标:每个色在 `#ffffff`(浅色侧栏)与 `#1c1c1e`(深色侧栏)上的 WCAG 对比度**都 ≥ 3.0**——这是 **WCAG 图形 / 大字号阈值**,不是正文级阈值。

**口径说准确(独立验收指出,已按此改写全部文案)**:行字号 13px(会话行 12.5px)、常规字重 ⇒ 属 WCAG **normal text**,AA 要求 **4.5**;**本池 13/13 都至少有一个背景 <4.5,且不存在任何一色能两个背景都 ≥4.5**。原因不是配色没做好,而是**固定 hex 的数学约束**:同一颜色要在纯白与近黑两个极端背景上都达标,亮度要求互相拉扯。所以准确表述是:**≥3.0(图形/大字阈值),未达正文级 AA,与插件既有手动色板同档**(且已排除其中 5 个对比度更低的旧色)。README(中/英)、21 门语言的设置卡说明与代码注释已全部按此口径重写,冒烟里也把这条约束写成断言,避免后人误以为"达标 AA"或反过来"没做好"。

**13 色内置调色板(定死在代码里,不随主题生成)**——前 4 个是仓库现有自定义外观 SWATCHES 原值,其余是同风格补齐(括号内为 浅底/深底 对比度):

| 色值 | 名称 | 浅底 | 深底 |
|---|---|---|---|
| `#f85149` | 红(现有 swatch) | 3.35 | 5.08 |
| `#d97706` | 琥珀 | 3.19 | 5.34 |
| `#65a30d` | 青柠 | 3.09 | 5.51 |
| `#46a758` | 绿 | 3.03 | 5.61 |
| `#0d9488` | 蓝绿 | 3.74 | 4.54 |
| `#0891b2` | 青 | 3.68 | 4.62 |
| `#0090ff` | 天蓝 | 3.26 | 5.21 |
| `#5b8def` | 蓝(现有 swatch) | 3.23 | 5.27 |
| `#7c66dc` | 靛 | 4.38 | 3.88 |
| `#a371f7` | 紫(现有 swatch) | 3.35 | 5.07 |
| `#d6409f` | 品红 | 4.12 | 4.13 |
| `#e93d82` | 粉 | 3.85 | 4.42 |
| `#6e7681` | 灰(现有 swatch) | 4.59 | 3.70 |

现有 9 个 swatch 里**未进池**的 5 个:`#3fb950`(2.54)、`#d29922`(2.52)、`#39c5cf`(2.09)、`#ff9f45`(2.04)、`#ec6cb9`(2.83)——它们在白底上作为文字色偏淡,正是用户点名的「字看不清」风险;池里用**同色相压深一档**的等价色替代(绿→`#46a758`、琥珀→`#d97706`、青→`#0891b2`),深色主题下观感基本不变。测试里直接断言这条可读性规则,防止后续随手改色。

**去重/轮转(不是纯随机)**:`createAutoStyler()` = **洗牌袋 + 近期回避窗口(3)**。袋空时用「池 ∖ 最近 3 个」重新 Fisher-Yates 洗牌;一袋之内绝不重复,跨袋也不会立刻撞上刚出过的 3 个,连续新增几项时肉眼可辨。颜色袋与图标袋**各自独立**抽取(同一个新工作区不会因为抽了色就影响抽图标)。随机源可注入 ⇒ 冒烟测试用固定种子复现。

**图标池**:从**既有** `ICON_CHOICES` 候选清单里取 12 个(分支/代码/数据/目标/地球/清单/勾选清单/浏览/下载/API/技能/闪光),运行时经 `resolveIconName()` 过滤宿主真实导出的字形(与图标选择器同一套规则);宿主一个都没有时只分配颜色。**图标只给工作区**:会话行的图标位是官方状态灯(v0.23.0 起空闲时归官方 `sidebar.session.row.leading` 座位),仓库不变量 12 已定死「会话行没有图标位」,给会话随机图标等于写一个永远不显示的字段,故不做(报告里已向用户说明)。

**「新增」判定(不轮询,全部走官方 store 快照)**:
- **新会话** = wire 仍报 `blank === true`(仓库既有认定的唯一可信出生标记,quote-on-land 同款判据),**且首份权威会话快照已播种**(`list.phase !== 'pending'`):首次权威快照里就已经 blank 的行属于"开关打开前就存在",只登记不染色 —— 与工作区侧同构。存量会话永不 blank ⇒ 刷新页面不会把既有会话重新染色,也不会把开关打开前就待在侧栏里的 blank 占位行染色。
- **新工作区** = 在 `phase === 'ready'` 且流已 settle 的**首份权威清单**播下已见集合之后出现的 id。列表渐进填充不会把存量误判为新增。
- 已见集合**在开关关闭期间同样维护** ⇒ 关闭期间创建的项不会在开启后被补分配,符合「关闭后不再自动分配」。

**三条红线(冒烟各一条断言)**:① `stylingMap[key]` 已存在(用户手设 / 跨端同步带入 / 上一次自动分配)⇒ 跳过,**绝不覆盖**;② 同一项幂等(已见集合 + 存在性双重门控,重跑不换色);③ 关闭开关只停分配,**不回收**已分配的样式。
另外新增 `makeSharedWrites.setStylingMany(entries)`:一次快照里可能同时分配多个键,而宿主副本是从渲染期 `stylingMap` 快照推导的——逐个写会让宿主副本只留下最后一个,批量写一次成型。

### 词典

新增 2 键 × 21 门语言:`settings.autoStyle`(开关名)、`settings.autoStyle.hint`(说明:只影响开启后新建的项、不覆盖手设、关闭不回收)。

### 测试

`npm test` 54 项全绿(新增 3 组断言):调色板固定性 + 每个色在两主题下 ≥3.0 + 现有 swatch 保留 + 图标池来自图标候选清单;洗牌袋「一轮覆盖全池」「refill 后避开最近窗口」「长跑无相邻重复」「空池降级」「随机源可复现」;开关默认关、仅 blank 会话、工作区须权威清单后、`!autoStyle || 已有 entry` 双向跳过、不清理已分配、`setStylingMany` 批量写。

### 验证(隔离 DSH_HOME + 独立端口 + Playwright,36/36 断言全过)

隔离环境:`DSH_HOME=/Users/kanna/sandbox/_work-bw-random/verify/home`(本地 tarball 装进 profile + `dsh.profile.bundles`)+ 端口 19412 + 本机 Chrome(`channel: 'chrome'`)+ `SSH_CONNECTION=<非空>`(让官方目录拾取走 browse,好在应用内浏览器里认领新目录当"新工作区")。**未触碰用户 `~/.dsh/profiles/*` 与 19387 GUI**;收尾已 kill 实例、删 verify 目录、确认端口关闭;证据 JSON 与两张截图留在 `_work-bw-random/evidence/`。

- **A 段(14/14)**:默认关(`prefs.autoStyle` 未设置、`styling` 空);真实点击设置卡开关后 `prefs.autoStyle === true`;开启前已存在的 blank 占位会话**不被染色**(关闭期间创建的项不补分配);点工作区行 `+` 新建会话 → 立刻拿到 `#6e7681`,行内联样式就是 `rgb(110, 118, 129)`;刷新后同一项仍是 `#6e7681`(不重抽)、行仍带色;静置多个快照后不变(幂等);console 0 报错。
- **B 段(15/15)**:新工作区走官方应用内目录浏览器认领 `ws-target-7` → 拿到 `{color:'#65a30d', icon:'IconBrowseOutline16'}`,两者都在内置池内,行渲染出该色且图标位出现字形;刷新后颜色 + 图标原样保持;真实点击关闭开关后再认领 `ws-target-8` → **新工作区没有任何 entry**(截图里 `ws-target-8` 是默认黑字,`ws-target-7` 仍是绿字 + 字形),已分配的 `#65a30d` 未被回收;console 0 报错。
- **C 段(7/7,「不覆盖手动设置」的正面证据)**:开开关 → `+` 新建会话自动染色 `#0090ff` → 右键该行「自定义外观」手动改成**不在自动池**的 `#3fb950` → 刷新页面(该会话仍是 blank,自动分配会再次看到它)→ 值仍是 `#3fb950`、行仍渲染 `rgb(63, 185, 80)`。⇒ 存在性门控确实挡住了覆盖。
- 补充观察:同一实例里先后创建的多项拿到 `#6e7681 / #65a30d / #e93d82 / #0090ff / #d97706 / #0090ff …` 等不同色,肉眼可辨(洗牌袋生效);`IconDataOutline16 / IconSparkle16 / IconBrowseOutline16` 等图标各自不同。

### 独立验收后的两处修改(复验)

1. **文案改成准确口径(必改)**:独立验收自己复算了 WCAG 公式,确认 13 色的白底最小 3.03、深底最小 3.70 且与注释数字逐色一致;但指出行字号 13px(会话行 12.5px)、常规字重属 WCAG **normal text**,AA 要求 **4.5**,而本池 13/13 至少一侧 <4.5、无任何一色两侧都 ≥4.5。结论是**不用改颜色**(相对既有手动色板仍是净改善),但「都保证可读」这类表述过度承诺 ⇒ README(中/英)、21 门语言的设置卡 hint、代码注释全部重写为「≥3.0(WCAG 图形/大字号阈值);正文级 AA 需 4.5,本池未达,与既有手动色板同档(已排除 5 个对比度更低的旧色)」,并点明**固定 hex 的数学约束**。冒烟里新增断言:每个色两侧对比度都 <4.5(把"未达 AA"写成事实)且 hint 文案必须同时出现 `≥3.0` 与 `4.5`、不得再出现「保证可读」。
2. **会话侧补首帧播种(建议改,已做)**:原先只有工作区侧有"首份权威清单播种",会话侧缺,导致"开关打开时就已存在的 blank 占位行"会在下次加载被染色,与文案「只影响开启之后新建的项」有轻微偏差。现按 `list.phase !== 'pending'`(Host 契约 `SessionListPhase = 'pending' | 'ready'`)在**首份权威会话快照**播种:首帧就已 blank 的行只登记、不染色;之后出现的 blank 会话才染色。冒烟新增 4 条断言(播种门控、`sessionsSeeded` 标志、首帧跳过分支、两侧同一形状)。
   **复验(隔离 DSH_HOME + 端口 19413 + Playwright,8/8)**:阶段 1 不带开关加载让系统自己建出 blank 占位行 → 阶段 2 在加载前把 `autoStyle` 写进 store 再刷新:首帧就存在的 blank 行**没有被染色**(store 无 `session:` 条目、DOM 行也无 color)== 新行为生效;阶段 3 用掉该 blank(发消息)后点 `+` 新建 → 新会话拿到 `#e93d82`;阶段 4 再刷新 → 已染色项保持同一色、且**没有多出被染色的 blank 占位行**。console 0 报错。
   ⚠️ 说明:A/B/C 三段共 36 项是在**补种之前**的构建上跑过的;补种只改了会话侧"何时算新增"这一处(工作区侧代码未动),因此补种后针对性重跑了上面 8 项覆盖新行为与刷新/幂等,未整体重跑 A/B/C。

### 独立验收第二轮后的两处修改(再复验)

3. **偶发染色窗口(必改)**:验收者在**首个冷启动**实验里抓到 blank 行与首帧工作区**都被染色**(`session-af0f6fff…=#a371f7`、`workspace:cf762dd8…=#46a758`),随后 7 次未复现,并给出可解释的窗口:`seen.sessionsSeeded = true` / `seen.seeded = true` 原先在**循环外无条件执行** ⇒ 若某个 `phase !== 'pending'` 的**中间态快照**(宿主刚起、真实行还在路上)里还没有那些行,播种标志就被提前消耗,后到的存量行于是被当成"新增"染色。**修法**:两侧标志改为"该快照**确实登记了项**才置位"(`if (sessionRowsSeen) …` / `if (workspaceRowsSeen) …`),空快照不消耗标志、下一份有内容的快照来播种;对外的语义不变(首份**有内容的**权威快照里的行只登记、不染色)。冒烟新增 4 条断言(两个条件置位 + 两条"不得无条件置位"的反向断言)。
   **复验(冷启动 × 3 轮,每轮重启宿主 + 端口 19414 + Playwright,13/13)**:每轮都在页面加载前把 `autoStyle` 写进 store、宿主刚起就打开页面 —— 3 轮**都没有任何会话/工作区被染色**(store 无 `session:`/`workspace:` 条目、行内联样式无 color),第 3 轮随后用掉 blank 再点 `+` 新建 → 新会话照常拿到 `#0891b2`(播种没有把功能"冻住")。console 0 报错;实例已 kill、verify3 已删、19414/19415 已关闭。第一轮的 home 是全新的(宿主自己建默认工作区 + blank 占位会话),正是验收者撞到的那个场景。
4. **文案守卫扩到 21 门(建议改)**:原先只有 zh/en 被断言保护,其余 19 门靠人工核对。现新增一条测试,把 21 份 hint 全部取出逐门断言:①出现 `3.0`/`3,0`(两种小数分隔符都接受);②出现 `AA` 且出现 `4.5`/`4,5`;③不得出现「AA 达标 / compliant / conforme / erfüllt / 準拠 / 준수」这类达标表述;④zh/en 各自的旧过度承诺措辞(`保证可读` / `stays readable`)不得回归。**匹配刻意不写死语序与小数符号**——ja `コントラスト 3.0 以上`、ko `대비 3.0 이상`、de/fr `3,0` 都通过,避免像验收者第一版正则那样把正确译文判成失败。


⚠️ **未验证**:桌面端(Electron renderer)整条路径未跑——开关只读 `prefs` + 只写 `styling`,与 web 同构,但按仓库纪律如实标注。
✅ **blank 边界(独立验收后已收紧)**:会话侧原先缺少工作区侧那样的"首帧播种",导致"开关打开时就已存在的 blank 占位行"会在下次页面加载被染色,与文案「只影响开启之后新建的项」有轻微偏差。现已补上**首份权威会话快照播种**(`list.phase !== 'pending'`,与工作区侧同构):首帧已存在的 blank 行只登记、不染色;**开关开启之后新建的会话才被染色**。两条都有冒烟断言。存量有内容的会话永不 blank,本来就不受影响。

## v0.23.0 — 2026-09-25

**类型**:fix(rc.2 两处静默失效:定时任务角标与官方快捷键)+ feat/align(跟随官方 rc.2 的四处新语义与设计 token)+ 文档/冒烟同步

对齐目标:dsh **0.1.7-rc.2**(`git diff dsh-v0.1.7-rc.1 dsh-v0.1.7-rc.2 -- packages/client`)。本轮官方在侧边栏/会话树面动作最大,其中两条直接让本插件的既有能力**静默失效**——因为它们都走「官方 entry 自己消费」的通道,而该 entry 被本插件以 `priority: -1` 压制,消费者永不挂载。

### fix 1(静默全失效类):定时任务角标改读官方座位占用者

**机制**:rc.2 删除了 `packages/schedule/schedule/src/projection.ts` 与 `ctx.sessionProjections.register(scheduleProjectionDefinition)`(rc.1 仍在),官方 `Rows.tsx` 同时删掉 `ActiveScheduleIndicator` / `hasActiveSchedule` / `schedule.active` 词典键,把角标移进**两个新 list 座位** `sidebar.session.row.leading`(行首 16px 单元格)/ `sidebar.session.row.hover`(悬停卡),由 `@deepseek-ai/dsh-client-ui-schedule` 占用。本插件 v0.6.0 起的角标读的正是 `projectionValues.schedule` ⇒ rc.2 下**永远不显示**(无报错、无日志)。

**修法(跟随官方,不自绘)**:官方那两个座位由**被压制的官方 entry 声明**(`children` 表 = 声明 + 授权 + 运行时规格三合一),本插件作为 shadow 者拿不到渲染授权 —— 所以按 v0.22.0 hero flow 的同一套 ledger 手法,读 `slots.entries('sidebar.session.row.leading')[0]` 拿**占用者组件 + 它自己的注入面**,在自绘行里渲染官方 `SessionScheduleMark`:其 `hooks.catalog` 由本插件按 `ui-slots` 的 `use<Name>` 契约绑定(unsubscribe/getSnapshot 只捕获一次 + 选择器缓存,等价于官方 `bindSnapshotSelector`;其 `use-sync-external-store/shim/with-selector` 不在客户端基线白名单),`t` 按占用者自己的 locale 命名空间绑定,整个外来组件挂在 `QuietBoundary` 之后。官方行规则一并照搬:**该单元格只在行自身主状态空闲时归属角标**(有状态灯就不渲染座位)、归档行与 blank 行留空;座位缺席(Schedule overlay 关闭 = 官方默认,或更老的宿主没有这个座位)就什么都不渲染。
**旧宿主保留**:≤rc.1 的宿主只有投影、没有座位,自绘角标以 `node.hasActiveSchedule && !markNode` 门控保留 —— 两者在任何宿主上互斥,一行永远不会出现两个角标(冒烟断言)。

### fix 2(静默失效类):官方快捷键 ⌥⌘K / ⌥⌘O 在本插件下是死键

**机制**:rc.2 新增 `@deepseek-ai/dsh-client-shortcuts` + `ui-shortcuts` 与六条命令。`session.search` / `workspace.add` 的 `resolve` 只把请求写进官方 browser 的私有 store(`createWorkspaceShortcutControls`),**唯一消费者是该组件自己的 `useEffect`**;座位被压制 ⇒ 按键被消费(`preventDefault`)却什么也不发生(`session.new/rename/fork/archive` 走导航服务与 `shell.overlay`,不受影响)。

**修法**:同一套 ledger 读取(按 `requestSearch` 字段做版本门控,老宿主没有该字段 ⇒ 无通道也不消费)拿到官方 entry 的注入面,在本插件内**当它的消费者**:搜索键 = 打开并聚焦本插件的过滤框(本插件搜索是本地标题过滤,这是它自己的搜索面);添加键 = 跑与页头按钮同一个 `startAddFlow`;本插件自己的选择流程期间用 `setDirectoryBusy` 上报占用,第二次 ⌥⌘O 会得到官方那句「正在选择或添加工作区」而不是静默叠加;官方分叉失败的 toast 原本挂在被压制的浏览器上,这里用官方词典文案复现其通知并委托 `dismissForkError` 走官方通道。侧边栏同时按官方新版**显示当前键位**(`aria-keyshortcuts` + title 追加 `(⌥⌘K)` 这类键帽,覆盖搜索/添加/新建会话三个按钮)。

### align:跟随官方 rc.2 的四处新语义

1. **归档筛选三态**:官方视图菜单改为「隐藏已归档(`IconArchiveOffOutlineRegular`)/ 全部对话(显示已归档)(`IconQueueOutlineRegular`)/ 仅显示已归档(`IconArchiveCheckOutlineRegular`)」三条**直选**项,`selectedIds` 恒有一条选中,不再「再点一次回默认」;本插件自绘视图菜单照此对齐,**以 `viewOptions.hideArchived` 键做时代探测**:老宿主没有该键 ⇒ 保留原两态 toggle 语义(键探测降级,不猜版本)。
2. **「仅显示已归档」丢弃没有归档会话的工作区**(官方 `tree.ts groupByWorkspace` 新增 `if (archivedFilter === 'only' && members.length === 0) continue`):本插件按同一规则用 `sessionsOf()`(与行内渲染同一个可见性函数,不可能与列表打架)过滤工作区行,名称分组连同磁盘 `sub` 层一起递归判空 —— 分组成员消失后它自己也不再渲染。
3. **归档空态**:官方新增 `empty.noneArchived` / `empty.viewOthers`,空列表会点名当前筛选并给一键回退。本插件照做(官方词典优先、缺键回退本插件文案),回退直接写 `archivedFilter = 'default'`。
4. **首次使用的工作区命名**:官方删掉 `defaultWorkspace.title` 词典路径,新增 `@deepseek-ai/dsh-api-workspace-controller/default-workspace` 的 `workspaceDisplayTitle(title, t('workspace.defaultName'))` —— 标题等于常量 `default-workspace` 时**显示**本地化「默认工作区」,stored title 不动。本插件在侧栏与空态选择器两个出口做同一层显示替换(纯展示、绝不回写),词典自带该键(21 门语言,比官方只有 zh/en 更完整;官方其余 19 门靠 common 词典回退到英文)。**未替换前真机现象**:全新 DSH_HOME 里侧栏会显示裸 `default-workspace`。

### align:设计 token(圆角 / 焦点环)

rc.2 新增 `--dsw-radius-xs/sm/md/lg/xl/panel`(ui-theme base.css)与 `--dsw-focus-ring-width/color`(新 focus.css),并给官方 iconButton 加 `:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color);outline-offset:-2px}`(dense 控件把环画在内侧)。本插件自绘 CSS 原为硬编码 6/8/12px 且按钮无 focus 环,现改为 token 引用并**保留原像素值作 fallback**(老宿主只拿到原样外观):行/图标按钮/输入框/右键菜单项/分段控件/应用卡片等。**菜单材质不动**:官方把 `--dsw-specific-menu` 拆出 `--dsw-menu-surface-fill` 并引入 `MenuSurface`(含 macOS 不透明 backing 门户),但 `design-platform.css` **保留**了 darwin 近不透明回退给「不用 MenuSurface 的浮层」——本插件自绘右键菜单正是该路径,不变量 14 的 token 链依旧正确,故不改(依据:官方注释「Overlays without MenuSurface's opaque backing cannot blur page content over native vibrancy reliably」)。

### 复核结论:本轮**不需要**改的面

- **slot 契约零漂移**:`sidebar.workspaces` 仍 single / 官方 priority 0;两个 `directoryFlow` 洞与空态洞的声明、占用者、owner props 未变;`sidebar.workspaces.session.menu.item` 的 inject 新增 `shortcuts`(加法,本插件自绘菜单不注册该座位);`RowToastProps` 新增 store(官方自用)。新座位 `sidebar.session.row.leading/hover` 只由本插件的 fix 1 以「读占用者」方式使用,**绝不在自己的 registration 里声明 children**(不变量 2)。
- **设置面**(行 Config volatile / `configForms` 软探测)、**locale 契约**、`dsh.client.inject` 数组:rc.2 无变化,本插件照旧双时代探测。
- **语法高亮统一 / 单文件改动与纯增删差异更紧凑 / 「代码工作工具」统一控制轨迹-差异-新任务模式、独立模式选择开关移除**:分别落在 ui-primitives(code-block)、ui-chat/ui-tool、ui-agent-preset;本插件不渲染代码块、差异或模式选择,**不适用**。
- **open issue / PR**:0 个(`gh issue list --state all` / `gh pr list --state all` 全为 closed/merged),无待办。

### 验证(隔离 DSH_HOME + 独立端口 + Playwright,全部实测)

隔离环境:`DSH_HOME=/Users/kanna/sandbox/_verify-bw/home`(`dsh-better-workspace` 以本地 tarball 装进 profile、`dsh.profile.bundles` 挂载)+ 端口 19411 + 本机 Chrome(playwright `channel: 'chrome'`,缓存里的 chromium 与 playwright 1.61.1 期望版本不一致)。**未触碰用户 `~/.dsh/profiles/*` 与 19387 GUI**。22 项断言全过:

- **默认工作区**:全新 home 首启后侧栏行显示「默认工作区」(非裸 `default-workspace`),空态选择器同字。
- **⌥⌘K**:按下后 `.bw-input` 出现且 `document.activeElement` 即该输入框 ⇒ 官方 `session.search` 请求被本插件消费(不是死键)。web 端官方默认键位是 `primary+alt`,即 ⌥⌘K,不是 ⌘K。
- **视图菜单**:恰好三条归档项,文案 = 隐藏已归档 / 全部对话(显示已归档)/ 仅显示已归档,无旧的裸「显示已归档」项。
- **仅显示已归档**:工作区行数归零、空态出现「暂无已归档会话」+「查看其他会话」,点回退回到默认视图并恢复工作区行。
- **⌥⌘O**:browse 后端下弹出本插件的「应用内添加工作区」提示 ⇒ 官方 `workspace.add` 请求同样被消费。
- **键位显示**:搜索/添加/新建会话按钮的 title 与 aria-label 带当前键位(`搜索工作区或会话 (⌥⌘K)`、`添加工作区 (⌥⌘O)`、`新会话 (⌥⌘N)`),`aria-keyshortcuts` 已发布。
- **空态选择器**:rc.2 下仍是侧栏同源的树(含默认工作区行 + 添加工作区入口)。
- **Schedule 座位**(在隔离 profile 临时把 `time-context` / `schedule` / `ui-schedule` 三行 `disabled: false`):非 blank 且空闲的会话行上,诊断属性确认本插件**读到了占用者并挂载了官方 `SessionScheduleMark`**(无任务时它按官方语义返回 null,故不绘制;blank 行则完全不给座位),console 无任何插件报错。
- console **零插件自身报错**,无 `register skipped` / `SlotOwnershipError`。

⚠️ **本轮未覆盖**(留给桌面端集成轮或下一轮):① 有**活动定时任务**时角标实际绘制(隔离实例无法在不调用模型的前提下创建定时任务);② native 后端下 ⌥⌘O 的 OS 选择器真机点击;③ 桌面端 Electron renderer 路径(自绘菜单材质、hotkey 的 desktop:macos 默认键 ⌘K/⌘O 分支、座位渲染)。

## v0.22.0 — 2026-09-24

**类型**:feat(新会话页的工作区选择器换成侧栏同源的树)+ fix(自定义外观弹窗在会话运行时闪回默认)+ 文档/冒烟同步

### feat:对话空态的工作区选择器 = 侧栏那棵树

**问题**:新会话页「工作区」按钮的弹层是官方的一层平铺标题列表——连磁盘目录嵌套都没有,与左侧已经树化的侧栏完全对不上。

**修法**:本插件以 `priority: -1` 注册同一个 single 座位 `conversation.hero.workspace`(官方 picker 优先级 0,lowest renders),弹层改为复用侧栏的 `buildTree` + `compressTree` + 同一个 viewStore(`groupBy` / `workspaceGroupMode` / `compactChains`),所以**侧栏任何视图选项改动这边立刻同步**;工作区行带缩进与文件夹字形、当前工作区带勾选、分组行可开合(选择器内本地记忆,默认全展开),底部「添加工作区」保留。侧栏切到「单列表 / 按工作区」时,选择器退化为一层完整标题(选择器必须能选到每个工作区)。

**官方占用者照旧(关键)**:该座位**不声明任何 children** —— 子洞声明独占,官方 entry 即便被 shadow 也仍持有 `conversation.hero.workspace.directoryFlow` 的声明,而 `renderSlot` 授权只属于声明者。所以「添加工作区」改为从 slot ledger 直接读出**官方占用者的组件 + 它自己的注入面**(`slots.entries(HERO_FLOW_HOLE)[0].component` / `.inject()`),由本插件补上 owner 对话(`open` / `busy` / `onPicked` / `onCancel` / `onError`)后渲染:native 宿主弹官方 OS 选择器,browse 宿主弹官方应用内浏览器,**一行拾取交互都没有复制**。ledger 读不到时只是少一个「添加工作区」项(`try/catch`),选择器不退化。

**菜单行自绘**:官方 `MenuItemButton` 的 `.itemIcon` 是**固定 14px**,缩进塞进去会被裁掉(真机首版实测:工作区行图标缺角),因此行内布局自己画(缩进槽 / chevron 或文件夹字形 / 标题 / 勾选);列表卡片、滚动、外部点击、方向键走查、焦点恢复仍由官方 `Menu` 承担 —— 它的键盘走查只认 `button[role="menuitem"]` 与 `button:not(:disabled)`,自绘行正好就是这个选择器。宿主没有 primitives `Menu` 时不注册该座位,官方 picker 继续工作。

### fix:自定义外观弹窗在会话运行时「闪回默认」

**机制**:`CustomizeDialog` 的 seed effect 依赖 `[open, initial]`,而 owner 每次渲染都重建 `initial` 对象;运行中的会话让浏览器每个快照 tick 都重渲染 ⇒ effect 反复用**已保存值**覆盖正在编辑的 draft。用户实测:「点开自定义选颜色,几秒后自己弹回默认,自定义手速被迫很快」。

**修法**:seed 改由**行身份**驱动 —— owner 传 `seedKey`(`customize.entryKey`),effect 依赖 `[open, seedKey]`,`initial` 经 ref 读最新值。只有打开对话框或切换目标行才 seed;运行中的会话再怎么 tick 也不动 draft。冒烟新增防回归断言。

### 词典

新增 2 个键(21 门语言全覆盖):`heroPicker.error.title`(无法添加工作区)、`heroPicker.retry`(重试)—— 添加失败时的可重试错误弹窗,与官方 picker 同语义(错误来自 `createWorkspace`,「重试」重新打开官方目录流,洞空了则禁用)。

### 验证(隔离实例 + Playwright,全部实测)

- 隔离 DSH_HOME(复用 `dsh-shot-home` 的 profile 结构 + 自造 `storages/workspace.json` 与 10 个真实目录)+ 独立端口 3099 + 无头 Chromium(playwright 1.61.1,dsh 仓库 pnpm store 里那份;`~/Library/Caches/ms-playwright/chromium-1187`)。
- **树结构**:「磁盘 + 名称」模式下弹层 = `工作 > 平行帮 > Web/Back`、`工作 > Fis管理后台 > Back/Web`、根层 `用户目录 / 测试 / 双点破解 / DSH / proj` + 磁盘嵌套 `sub`(缩进 14px),缩进序列 0/14/28px 与侧栏逐行一致;当前工作区带勾选。
- **选项同步**:在**侧栏**视图菜单点「仅名称」→ 弹层立即变化(磁盘嵌套层消失,`sub` 缩进 14px → 0px),无需刷新、无需重开。
- **交互**:点工作区行 → 空态页按钮文字 `工作/Fis管理后台/Back` → `工作/平行帮/Web`(即 owner 的 `onPick` + `selectWorkspace` 生效);点分组行 → 13 行折叠为 7 行;再点展开复原。
- **添加工作区(browse 后端)**:`SSH_CONNECTION=<非空>` 启动隔离实例让 `directory-picker-auto` 判定 browse(`--host 0.0.0.0` 被 dsh 0.1.7 CLI 以安全理由拒绝,SSH 标记是等价且不暴露网络的复现手段)→ 点「添加工作区」→ 官方「选择工作区目录」分栏式应用内浏览器正常弹出(说明 occupant 组件 + 其注入面 + owner 对话三者都对)。
- console **零插件自身报错**,也没有 `register skipped for conversation.hero.workspace`。

⚠️ **未覆盖**:native 后端下点「添加工作区」的**真机点击**(会弹 macOS 系统选择器,隔离验证机上不便自动关闭)。渲染路径与 browse 完全同一条(同一个 ledger 读取 + 同一套 owner 对话),差别只在 occupant 内部那次 `pick()` 的调用时机。

## v0.21.1 — 2026-09-23

**类型**:fix(适配 dsh 0.1.7-rc.1 的复核轮:两个静默失效类加固 + 一个 console 噪音修复 + 图标集补齐 + 声明 dsh peer;契约面复核零漂移)

### fix 1(加固,静默全失效类):host 半的 schemastery 改成惰性导入

**机制(已实证)**:`src/index.js` 顶层 `import Schema from '@deepseek-ai/schemastery'`,而 schemastery 是 **peer**——普通 Node 从本包位置**解析不到**它(实测 `createRequire(<插件目录>).resolve('@deepseek-ai/schemastery')` → `MODULE_NOT_FOUND`),只靠宿主自己的解析(profile shared fallback)供上来。一旦那次解析失败,ESM 导入即失败,dsh Loader 把插件行的导入失败当**非致命跳过**(`vendor/loader/src/config/entry.ts` 的 `_init()`:`catch { this.ctx.logger.error(error); return }`,fiber 永不建立)→ 没有 host 半 → `ClientModuleRegistry` 扫不到 `dsh.client` → **client 半不进启动图 → 官方 occupant 静默接管座位,而宿主日志全绿**。与 issue #9 同一失败类(全绿日志 + 永久失效),触发点在 host 半而不是 exports。

**证据**:① 用两个"除这一行外完全相同"的夹具插件实证该失败类——同一个 probe profile 启动后,静态导入版的 `apply()` **从不执行**,`await import` + try/catch 版照常执行(只是 `mod=null`);② 在本机 rc.1 上,发布版 `dsh-better-workspace@0.21.0`(仍是静态导入)装在**干净隔离 DSH_HOME** 里时**能正常加载**(`.bw-root` 在、`__DSH_BOOT__.entries` 含本包)——说明这条 fallback 在常规安装里是可用的,本次是**加固**,不是已观测到的失败。

**修法**:`src/index.js` 去掉静态导入,改 `await import('@deepseek-ai/schemastery')` + try/catch:`Schema` 拿不到时 `Config` 导出 `undefined`(cordis `resolveConfig` 对 `!runtime.Config` 直接放行配置),插件**照常挂载**、浏览器功能完整,只有「行 Config 设置面」缺席。真机复核(rc.1 隔离实例):`.bw-root` 与层级树照常渲染、client 半在启动图里、console 插件自身告警 0;有 schemastery 时行为不变(Config 校验 + volatile 探测照旧,冒烟与真机双覆盖)。

### fix 2:settingsScope 软探测在 0.1.7 上每次启动都写一条堆栈

0.1.7 删除了 settings 服务,而**读一个从未注入的服务属性**会在 cordis Context 代理上抛 `cannot get property "settingsScope" without inject`;旧写法 `ctx.settingsScope && …` 虽然被 try/catch 兜住(行为一直是正确的本地降级),但**每次启动**都往 console 打一条插件自报错误的堆栈 —— 噪音掩盖真问题,也让这次审计第一眼以为该座位坏了。改走时代安全的 `ctx.get('settingsScope')`:服务存在即返回,不存在只是 `undefined`,属性永不被读。真机复核:rc.1 上插件自身 console 告警归零(仅剩会话恢复的本环境 symlink 产物)。

### fix 3:图标集补 rc.1 新增的两个字形

dsh 0.1.7-rc.1 相对 alpha.1 只新增 `IconUsersOutlineRegular` / `IconUsersOutlineMedium`(用于 agent-team / tool details 面),按不变量 12「新增字形一律先提交进候选清单」补入 `ICON_CHOICES`。真机确认这两个名字出现在外观对话框图标网格里(89 格,**无空格单元**);旧宿主由 `ICON_PICKER_CHOICES` 运行时过滤掉,不会变成空图标位(单测锁定);历史拼写 `IconUsersOutline16` 经代际回退落到 `IconUsersOutlineRegular`(真机:旧快照里存该拼写时,网格高亮到 Regular 那一格)。

### fix 4:声明 `@deepseek-ai/dsh` peer(rc.1 唯一被强制执行的兼容机制)

rc.1 的 `packages/boot/app-boot/src/plugin-compatibility.ts` **只**读取 `peerDependencies` 里 `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` 的 range(`semver.satisfies(..., { includePrerelease: true })`),不匹配就在安装前拒绝、启动时把整行置 `disabled`;`engines.dsh` 没有任何读取方。本插件此前虽有 `@deepseek-ai/dsh-settings`(满足门禁),但没有 umbrella 的 `@deepseek-ai/dsh`,兼容性语义不完整。现补 `"@deepseek-ai/dsh": ">=0.1.0"`:下界与 `engines.dsh` 同口径、**不设上界**——本插件跨版本靠运行时探测自愈,加 `<0.2.0` 之类的上界只会在下一次 dsh 升级时先行把它停用,而那时并没有任何真实破坏被观察到(`dsh-any-background@0.3.0` 被 rc.1 拦下并被迫授予机器级例外,就是这个失败模式的现实样本)。**两个 dsh peer 都标 `peerDependenciesMeta.optional`**:门禁不读 meta,但包管理器(`autoInstallPeers` 默认开启)会去 registry 解析 range,而 `@deepseek-ai/dsh` 与 `@deepseek-ai/dsh-settings` 在 npm 上**已发布的版本全是 prerelease**、普通 range 按 semver 排除 prerelease ⇒ 不标 optional 会让这类安装整体失败(`ERR_PNPM_NO_MATCHING_VERSION`)。冒烟新增断言锁死这两点。

### rc.1 契约面复核结论(逐条,以 `/Users/kanna/project/deepseek-harness` @ `dsh-v0.1.7-rc.1` 为准)

- `ui-workspace` 自 alpha.1 起**只有 8 行 zh 词典改动**(`子代理 → 子智能体`,commit `995caa05ed`)+ package.json 版本号;**`contract/slots.ts`、`Rows.tsx`、`session-actions/*` 逐字节未变**。菜单文案键(`rename` / `menu.fork` / `menu.archiveSession` / `menu.unarchiveSession` / `menu.pinSession` / `menu.unpinSession` / `archive.confirm.*` / `toast.pinFailed`)全部仍在 ⇒ `officialT` 键探测继续成立;官方行的图标也从 `…16/…14` 换成了 `…Regular`,本插件的代际回退正好接住。
- `sidebar.workspaces`(single/root,官方 occupant 优先级 0,本插件 -1)、`sidebar.workspaces.directoryFlow` / `conversation.hero.workspace.directoryFlow`(single)声明与 owner 契约未变,标准钩子仍是 `useResource/useWorkspaces/usePanelInfo/useSessions/useSessionStatus/useSessionRetainInfo`;本插件「两个 directoryFlow 洞都不占用」的形态继续成立。
- `useSessionStatus`(`SessionStatus = { running, pendingInteraction, completionUnread }`,**无 runningSubagentCount**)未变:子代理计数仍来自 SessionSummary 血缘,状态优先级 official = pending > running > subagents > completed;本插件 `sessionStateOf` 与之一致(真机三层树 + 子代理计数正常)。
- `WorkspaceSnapshot.pinnedSessionIds` / `archivedSessionIds` 字段仍在(`packages/api/workspace-controller/src/client/model.ts:33-42`)。
- `plugins.bundle.config` 仍是 keyed/root、按**包名**、`view: 'page'`;rc.1 上真机打开「设置 → 插件」:`更好的工作区` 卡片渲染完整(15 个分段按钮 + 2 个滑杆 + 全部开关文案),`locale/zh.json` 的标题/描述经 `package-meta.ts` 正确显示;跨端同步区按时代**隐藏**。
- **设置写入链路真机实测**:卡片里把「单链分组折叠显示」关掉 → 隔离 profile 的 `cordis.patch.yml` 落盘 `- id: better-workspace / config: { compactChains: false }`,确认 `configForms` 消费面在 rc.1 有效(不只是能读)。
- `exports["." "./client" "./locale/*.json" "./package.json"]` 四行齐全,issue #9 的断言仍在(冒烟测试强制)。
- 0.1.7 的侧栏**没有**新增终端 / 网页 / 子智能体行:官方会话行仍是 `SessionNode` 一种;子智能体行不进列表(本插件同样按 origin 过滤),其「运行中」以 `runningSubagentCount` 表达。

### 审计了但**故意不改**(留据)

- 官方 0.1.7 把会话菜单/行按钮做成了官方槽 `sidebar.workspaces.session.menu.item` / `.row.action`(list 槽,带 `useMenuOpenState`)。本插件仍是**自绘菜单**:不变量 11 要求插件条目排在官方条目分隔线之后、且菜单必须承载本插件动作(移动到分组 / 移出分组 / 自定义外观),官方官方行渲染器不提供这些;按仓库「禁止顺手重构」纪律,本轮不改。**建议(下版议题)**:本插件既已自绘行,可把 pin/rename/fork/archive 四项改为注册进这两个官方 list 槽,由官方条目自己渲染 —— 但那是行为重构,需要用户确认。
- 官方 zh 词典把 subagent 统一为「子智能体」(docs/i18n/terminology.md 术语表),本插件 `status.subagents` 仍是「{n} 个子任务运行中」;改它要动 21 门词典且纯文案,本轮不动,记一笔。
- 官方 0.1.7 的行内 Toast(归档撤销 / 置顶失败提示)未镜像(见 v0.20.0 已知限制),本轮不改。

### 验证与证据

- `npm test`:42 项全绿(新增 2 项守卫:`IconUsersOutlineRegular/Medium` 候选+过滤+代际回退、host 半惰性导入不得回退;1 项旧断言跟上 fix 2)。
- 隔离真机(`DSH_HOME=/tmp/dsh-adapt-bw/home`,profile `probe`,端口 3112,headless Chrome over CDP 9455/9456/9457):
  - 启动无插件加载错误;侧栏 `.bw-root` 在,**磁盘层嵌套**(`工作/前端` → `工作/前端/子模块`,padding 6px → 18px)+ 名称分组两态同屏正确;
  - console **无** `register skipped for sidebar.workspaces`、无 slot entry crash,插件自身告警为 0;
  - `plugins.bundle.config` 卡片渲染 + 写入落盘(上文);
  - 图标网格 89 格、0 空格、含两个新字形;
  - **旧快照容错**:写入只含 `expanded/prefs/workspaceTitleSlash/styling` 的老 localStorage 快照(含已不存在的 `IconUsersOutline16` 图标值)后刷新 → 树按老语义(名称层开启)正常渲染、无错误弹窗、图标网格正常、旧值高亮到 `IconUsersOutlineRegular`。
- **未覆盖(明确说明)**:① 桌面客户端(Electron renderer)端到端 —— 本机 `dsh-app` 实例属于用户日常环境,本轮按红线未启动/未改用户 profile,`exports["./package.json"]` 的桌面路径只做了静态断言与代码复核;② 旧宿主(0.1.0…0.1.6)运行时复跑 —— 无旧运行时可用,只做了「探测 + 降级」的代码与单测复核(新增写入路径均带 `typeof` 门控,`ctx.get` 为 cordis 全代 API);③ 官方 LAN/browse 后端的点击行为 —— 本轮未改该路径,未复跑 v0.16.0 那套流程。
- 收尾:按端口 kill 掉隔离实例并删除 `/tmp/dsh-adapt-bw`。

## v0.21.0 — 2026-09-23

**类型**:feat + fix(一次收掉全部四个 open issue:#9 双修复 + #6/#7/#8 三特性)

- **fix #9-1(阻断,桌面端)**:exports 缺 "./package.json" 导致 client 半在桌面渲染进程永不进启动图——宿主模块发现(ctx.loader.internal 不可用时)回退 require.resolve(<pkg>/package.json),遵守 exports map,缺行抛 ERR_PACKAGE_PATH_NOT_EXPORTED 被静默吞掉,包被永久缓存为非 client 包。补上 exports 行;冒烟测试加断言锁住。感谢 @EnderMas 教科书级定位。
- **fix #9-2**:自定义外观弹窗的 onChange 把 patch.icon 覆盖回旧值(icon: prev.icon || 'solid'),图标选择永远无效。改为 patch.icon 优先(patch.icon || prev.icon || 'solid')。
- **feat #6:「未分组」可折叠**——折叠行与工作区分组同款(chevron + 实时计数),状态存视图 store(ungroupedOpen,默认展开,老快照缺键容错);搜索时强制展开。
- **feat #7:工作区分组三态**——磁盘目录(默认)/ 磁盘 + 名称 / 仅名称。「仅名称」完全不理会磁盘嵌套(buildTree 用空父 Map),只按标题里的 / 分组;视图菜单新增「工作区分组」区与设置卡分段控件**双入口写同一个 store 键**;store 新键 workspaceGroupMode,旧 workspaceTitleSlash 布尔自动迁移(显式值照旧、0.13 前快照保持分组),迁移函数 workspaceGroupModeOf 有测试;旧布尔随写随带,插件降级也不乱树。官方 flat 视图下三态菜单项禁用。
- **feat #8:展开时限量显示会话(可选)**——prefs.sessionLimit(全部(默认)/5/10/25),开启后展开的工作区先只显示前 N 条,其余收进「展开 {n} 个会话」一行(复用遗留的 sessions.expand 词典键),点击后本挂载内全量;置顶/空白/运行中/子代理行不占额度(官方 collapsedSessionRows 语义);搜索与官方 flat 视图永不限量。
- **词典**:9 键新增、2 键退役,21 门补齐;冒烟 39 → 40(v0.21.0 守卫:#9 两修复、#6 折叠、#7 三态双入口与迁移、#8 额度语义;buildTree 模式化后三态各补功能断言)。

## v0.20.0 — 2026-09-23

**类型**:feat(适配 dsh v0.1.7 侧边栏官方更新:置顶 / 归档筛选 / 图标集换代,保持旧版本完全兼容)

- **修复:头部与菜单图标全部不可见**(用户报告的第一张图)。dsh 0.1.7 把 ui-primitives 图标集整体改名(像素尺寸后缀 …16/…14/…20 → 笔画粗细后缀 …Regular/…Medium),头部/栏轨/菜单直接调 icon('IconSearchOutline16') 一类旧名查不到就渲染 null → 空按钮。修法:resolveIconName 增加**代际回退**——精确名 → ICON_ALIASES → 剥掉尾部数字尝试 …Regular / …Medium;icon() 一律先过 resolveIconName。ICON_CHOICES 补入 0.1.7 新字形(pin / sliders / archive-check / unarchive / workspace-tree / flat-list / chevrons-up-down 等 19 个,旧宿主由 ICON_PICKER_CHOICES 自动过滤)。
- **官方 0.1.7 会话动作面镜像**(此前插件菜单缺官方新增的置顶,行上也看不到官方的置顶/归档按钮):
  - 右键菜单按官方 Rows.tsx 顺序对齐:置顶/取消置顶 → 重命名 → 分叉 → 归档/取消归档(归档行变取消归档,归档行无置顶);文案经 officialT(官方 workspace 词典)自动跟随上游措辞,缺键回退本插件词典;每个动词按 uiWorkspace 服务方法存在性门控,旧宿主只显示它支持的动作。
  - 运行中会话归档被宿主拒绝(WorkspaceArchiveError / workspace/session-active)时,弹官方文案的「停止并归档」确认框,确认走 archiveSession 传 stopActivity: true;置顶/取消置顶失败按官方文案报错。
  - 置顶语义对齐官方:置顶(非归档)会话在分组内前置(PinnedIndicator 角标,PinFill),置顶行与普通行不互相拖越(纯排序场景);归档行灰显、不可打开(点击给官方解释文案)、不参与拖拽。
  - 会话行悬停操作条:官方样式 ⋯ 按钮 + 置顶 / 归档快捷按钮(与官方行内一致,悬停替换时间格,点击不冒泡)。
- **设置卡两个新开关**(默认均开,四键 × 21 门词典补齐):
  - **会话右键菜单**:开 = 右键点击会话行打开操作菜单(原行为);关 = 右键不再弹菜单,改为行尾悬停显示官方样式 ⋯ 按钮、点击打开同一菜单(= 官方触发方式)。
  - **会话行悬停按钮**:开 = 跟随官方显示置顶/归档快捷按钮;关 = 这些动作只保留在菜单里。
- **视图选项新增「筛选会话」区**(官方 ArchivedFilter 镜像):显示已归档 / 仅显示已归档,再次点选回到默认隐藏;存进视图 store(archivedFilter,老快照缺键读作 default)。区条目与文案直接读官方词典——旧宿主官方词典无这些键,整个区自动隐藏(与该宿主原生菜单一致),即“官方有什么这边就有什么,官方没有的不凭空造”。会话树按官方 sessionVisible 语义过滤,搜索同滤。
- **dsh 0.1.7 状态钩子迁移**:0.1.7 把标准钩子 useSessionPendingInteraction 换成了统一的 useSessionStatus(running / pendingInteraction / completionUnread)。优先读新钩子,旧钩子保留为 pre-0.1.7 来源,summary 字段兜底——状态灯在两代宿主上都保持官方语义(警告琥珀 > 运行蓝 > 子代理 > 完成绿)。
- **冒烟测试**:38 → 39(新增 v0.20.0 官方镜像守卫:状态钩子双时代、pin/unarchive 注入探测、stopActivity 透传、归档筛选语义、置顶分区、两个设置门、官方词典键探测、图标代际回退);两条旧断言跟上新代码形态(store init 增键、菜单改 official() 包装)。

**已知限制**:置顶行暂不支持在置顶块内互相拖拽排序(官方支持,置顶行当前不可拖);官方 0.1.7 的行内 Toast(归档撤销等)未镜像——归档/置顶失败走插件错误弹窗。留待下版。

## v0.19.0 — 2026-09-22

**类型**:feat(适配 dsh v0.1.7-alpha.1 设置体系,保持旧版本完全兼容)

- **设置面双时代**(dsh 0.1.7 删除 settings.register/SettingsScope,设置 = 插件行 Config + profile patch 存储):
  - host 半静态导出 `Config`(compactChains/statusPulse/styling/appearance 四字段,volatile 探测;行 id `better-workspace` 与旧命名空间同串,旧 settings.yaml 一次性导入直接落位);旧宿主的 settings.register 注册路径原样保留(时代探测门控)。
  - client 半 inject 数组去掉硬声明的 `settingsScope`(0.1.7 上硬注入会让 fiber 永远 PENDING,树与卡片全死)——旧式软探测保留,新增 `ctx.inject(['configForms'], …)` 取 `configForms.get('better-workspace')`(与旧 scope 同契约,偏好写入落到本 profile 的 patch)。
- **跨端手动同步区按时代渲染**:0.1.7 起设置按 profile 存储,共享的 settings.yaml 之家不复存在,同步按钮区在 configForms 时代隐藏(偏好仍双写持久化到本 profile;旧宿主上同步功能不变)。
- **插件管理页展示资产**:新增 icon.svg + locale/{en,zh}.json 多语言标题/描述(旧宿主忽略)。
- 仓库新增 devDependencies(schemastery),冒烟测试前需 `npm install`;38 项全绿(更新客户端注入断言)。
- sidebar.workspaces 槽位契约、directoryFlow 官方占用、useWorkspaces/useSessions 注入面在 0.1.7 上复核无漂移。

## v0.18.0 — 2026-09-19

**类型**:feat / fix(把「拖出分组」做成真的:跨组落点改写名称前缀、工作区行成为组外落点、右键补「移出分组」;用户实测反馈)

### 根因:会话拖出分组"有落点提示,松手却没反应"

用户实测:把会话从 `测试1` 分组里往外拖,拖动过程中**落点提示照常出现**,松手后会话**仍在 `测试1` 下**。

两个原因叠在一起:

- **可见顺序由名称分组决定,拖拽却只重排扁平序**。会话的层级是标题里 `/` 前缀的投影,旧实现里跨组 drop 只调 `insertSessionBefore` —— 扁平序确实变了,但渲染不按扁平序画、标题也没动,于是屏幕上"什么都没发生"。
- **工作区行根本不接受会话拖拽**。「拖到组外」在树上没有落点:除会话行 / 会话分组行 / 新分组按钮之外,工作区行只认工作区拖拽。

### 修复

1. **跨组拖到会话行 = 真的移动**:`titleMovedToGroup(source.title, target.title)` 把源会话的叶子拼到目标行所在分组(目标在根层 → 去掉前缀),先改名、再按锚点排序;同组内仍是纯排序(名称层关闭时所有分组都是 `''`,等价于纯排序,语义不变)。
2. **工作区行 = 移出分组的落点**:会话拖到**它自己的工作区行**即离开分组(去前缀 + 追加到根层末尾);`drag.kind==='session'` 时该行高亮 `bw-drop-into`。已在根层的会话拖上去**不高亮、不接管**(没有可离开的组,不撒谎);别人的工作区行同样不接管(跨工作区移动仍被守卫拒绝)。
3. **组外任意处都是出口**:工作区行、根层的会话行、以及整棵树的空白区域(容器级 handler)都接住会话拖拽 —— 拖到任何不属于分组的地方松手,结果都是"离开分组";拖拽期间树底部有一条淡虚线提示这个出口(行级 handler 先 `stopPropagation`,所以只有没被行接住的 drop 才会走到容器层)。
4. **右键菜单补「移出分组」**(21 门语言全量):只在**带分组前缀的会话行**上出现(名称层关闭、或行本来就在根层时都不出现),排在分隔线之后的插件条目区。

### 验证(隔离 DSH_HOME + headless Chrome over CDP,合成拖拽分帧派发)

- 用标题记忆把非 blank 会话渲染成 `测试1/组内会话` → 树里出现会话分组行(深度 3)。
- 菜单:该行右键出现「移出分组」;根层行不出现(菜单仍只有「移动到分组…」)。
- 手势:`dragstart` → `dragover` 工作区行(class 变 `bw-drop-into bw-drop-into-strong`)→ `drop` → **分组行消失、会话回到根层(padding 44px → 32px)并追加到根层末尾**;根层会话拖到工作区行不接管(工作区行 class 保持 `bw-row`)。
- 空白落点:同一个会话拖到 `.bw-root`(树的空白处)时容器挂上 `bw-root-drop-out`(底部一条淡虚线),松手后同样**分组行消失、会话回到根层**;根层会话拖到空白处不接管(容器 class 保持 `bw-root`)。
- 合成拖拽必须**分帧派发**(每次事件之间让出一个 turn):同一 tick 连发 dragstart/dragover/drop 时 React 还没提交 `drag` 状态,onDragOver 读到的仍是 null —— 这是探针的坑,不是实现的坑。

### 测试

- 新增 `session drag out of a group` 冒烟用例:文本契约(落点、菜单、提交链)+ `titleMovedToGroup` 纯函数(锚点分组、锚点在根层时移出、根层行可移入、空锚点保持叶子)。
- 既有 `renameByUser` 调用点计数 5 → 8(新增三处都是用户动作:跨组 drop、工作区行 drop、菜单项)。

## v0.17.2 — 2026-09-19

**类型**:fix / feat(新建分组:顶层独立分组入口、容器树跟随视图模式、压缩链导致的空白行;用户实测反馈)

### 1. 工作区分组层只列「分组」,并补一个顶层独立入口

用户实测指出两点,都改了:

- **只看到分组本身**。工作区标题是「分组/名字」(A/B、A/C、D、E/F),其中 B、C、D、F 是**工作区**(叶子),不是容器 —— 把它们列出来等于邀请用户建一个以叶子命名的分组。现在候选**只有 A 和 E**。
- **能建与 A、E 同级的独立分组**。原来只有「顶层」一个可展开又可选的节点,读起来像"在顶层**里面**挑个位置",没法表达"给我一个和 A、E 平级的"。现在改成列表**最下面**一行独立的「新建顶层分组」(加号图标 + 分隔线),不属于上面任何一个容器。

### 2. 容器树跟随「分组方式」设置

用户要求:"根据这里的设置来决定平铺还是树状"。构造容器树时原来**直接遍历了扁平的工作区列表**,磁盘嵌套与名称分组全丢 —— 侧栏把子项目嵌在父目录下,对话框里却是兄弟。

现在按 `groupBy` 分支:`按工作区树`走**同一棵**树;一层模式(`按工作区` / `单列表`)回退平铺(侧栏此时本来就不画层级,承诺它没显示的嵌套是撒谎)。

### 3. 两个实测中发现的真 bug

- **单链压缩行的标签是空的**。`compressTree` 把单子级链合并成 `kind:'ws'` 行,`materializeChain` 对**单工作区链**产出的对象带 `segs` 却**没有 `name`** —— 渲染读 `.name` 得到空串。实测:`E/F` 是单链,侧栏正常、对话框里那行**完全空白**。新增 `folderLabelOf`(name → segs.join('/') → path)兜底。
- **合并行让工作区消失**。那一行同时代表"分组 E"和"工作区 F",而选容器时两者必须分开(一个不可选、一个可选,合并行做不到)。**对话框改用未压缩的 `buildTree` 结果**(`rawTree`),压缩只是侧栏的显示优化。

### 验证(隔离实例,标题 A/B、A/C、D、E/F + headless Chrome)

```
会话分组层(选工作区)        工作区分组层(选分组)
A ▸                        A
  B                        E
  C                        新建顶层分组
E ▸
  F
D
```

另测得「按工作区」模式下同一对话框三行全部平铺(缩进 6px,无嵌套),确认跟随设置生效。测试 **37 项全绿**。

## v0.17.1 — 2026-09-19

**类型**:fix(新建分组的容器树没跟着「分组方式」走,且丢了磁盘层级;用户实测反馈)

### 问题

v0.17.0 的「新建分组」对话框里,工作区是**平铺**的 —— 明明侧栏「按工作区树」把 `子项目` 嵌在 `演示父目录` 下面,对话框里两者却是兄弟。根因:构造容器树时**直接遍历了扁平的工作区列表**(registry 序),而没用已经建好的那棵树(`buildTree` 产物),磁盘嵌套与名称分组全部丢失。

### 修法

容器树**镜像侧栏当前的视图模式**(用户要求:按这里的设置来决定平铺还是树状):

- `按工作区树`(默认)→ 走**同一棵** `buildTree` 树:名称分组作为**只能展开的容器**(会话分组必须落在某个工作区上,名称分组没有 workspaceId 可挂),`工作区`节点在本层可选,其子节点 = 该工作区的**会话分组** + **磁盘嵌套的子工作区**(递归);
- `按工作区` / `单列表`(一层模式)→ 回退**平铺**工作区列表 —— 侧栏此时本来就不画层级,承诺一个它没显示的嵌套是撒谎。

工作区层同理:`按工作区树`下提供完整名称分组树,一层模式下只留「顶层」这一个目标。

### 验证(隔离实例,真实父子目录 + headless Chrome)

侧栏树 `演示父目录 / 子项目` 与对话框**逐行比对缩进**:

| 分组方式 | 对话框行缩进 |
|---|---|
| 按工作区树 | `演示父目录` 6px → **`子项目` 20px(嵌套)** → `better-workspace` 6px |
| 按工作区 | 三行**全部 6px(平铺)** |

测试 **37 项全绿**(相关断言已随形态更新)。

## v0.17.0 — 2026-09-19

**类型**:feat(真正的「新建分组」——允许空分组、树状选择父级、图标按钮;右键菜单整理)

### 用户可见变化

1. **区头「新建分组」改成小图标按钮**(与同排的搜索 / 添加同款 `bw-icon-btn`,`IconFolderOpen16`),文案移进悬停提示,并且**随开关变化**:两层都开 = 「新建会话或工作区分组」;只开工作区 = 「新建工作区分组」;只开会话(默认)= 「新建会话分组」。
2. **点击后是真正的「新建分组」**,不再是「移动到分组」的 picker 形态。
3. **允许空分组**(恢复 v0.12.0 退役的能力):新建一个没有任何成员的分组**立刻出现在树里**,可以往里拖东西。空分组右键有「删除分组」;**非空分组不提供该项** —— 它的分组身份来自成员标题,删掉声明在屏幕上什么都不会变。
4. **对话框里用树状图选父级**(可展开),不再是扁平下拉:直接选「建在哪个工作区下」或「哪层已有分组下」。顶部**两态单选**(会话分组 / 工作区分组);只有一层可用时不渲染开关,默认层按开关决定(工作区命名分组关闭时默认会话分组)。
5. **右键菜单整理**:「移动到分组…」移到分隔线**之后**,与「自定义外观」同组(它是本插件的能力,不是官方条目)。

### 根因(为什么以前做不出「新建分组」)

分组一直是**成员标题里 "/" 的投影** —— 没有成员的分组无法被表示,所以「新建分组」无物可写,按钮只能退化成「移动到分组」。要让空分组存在,必须补上**声明**这条写路径。

### 附带修复

- **「移动到分组…」一直没有图标**:它引用 `IconFolderOutline16`,而这个字形在宿主图标集里**不存在**(早期退役),`icon()` 探测静默失败 → 渲染成无图标行。改用 `IconFolderOpenOutline16`。

### 实现要点

- 视图 store 新增 `folders` 箱:`folders.ws` 按**磁盘层级 idPrefix** 分箱(`''` 顶层、`<wsId>` 下一层、`<a>//<b>` 更深),`folders.sess` 按 `workspaceId` 分箱,值是路径列表。与折叠状态同类:**每端本地,不进跨端同步**。
- 树构建时在每层 `ensure` **之前**喂入声明 —— 声明与成员共用同一套节点,所以「先建空组再拖进去」与「直接按名字建组」得到同一个东西(`ensure` 幂等)。
- 会话侧:工作区没有会话时不再直接 `return []`,有声明分组就照常渲染。
- `declaredPathOf` 统一规范化声明路径(按 `/` 切、逐段 trim、丢空段):`"  "` 与 `"a//b"` 都不会造出无名层级。
- `removeFolder` 连带删除**子路径**(删 `a` 会带走 `a/b`),否则父级会被留下的子声明重新隐式创建。
- hydration 是整值替换(不合并 init),因此所有读取都带 `EMPTY_FOLDERS` 兜底 —— 老快照没有该键照样工作。

### 测试

新增 4 条:store 声明写入 / 子路径连带删除 / 空值拒绝(真跑 reducer)、空分组进入渲染路径(含"会话为空但有声明"的短路解除)、对话框与按钮契约、组件模块级定义纪律。**37 项全绿。**

## v0.16.0 — 2026-09-19

**类型**:feat / fix(侧栏不再自绘目录浏览器,添加工作区改走官方交互;净减约 470 行)

### 为什么

官方本来就有一套应用内目录浏览器 —— `@deepseek-ai/dsh-client-ui-directory-picker-browse`(`DirectoryBrowser.tsx` 1052 行,分栏式,含「主目录 / 新建文件夹 / 编辑路径 / 显示隐藏文件」)。宿主 `@deepseek-ai/dsh-host-directory-picker-auto` 在启动时把 host 半与 client 半**成对挂载**:即便 `pick` 在 browse 后端被拒,那份浏览器照样加载并注册进两个 directoryFlow 洞。v0.11.3 只看到「browse 后端没有 pick」,误判为「官方没有界面」而自绘了一份,并以 `priority: -1` 把官方 occupant **静默遮蔽**(slot 规则:不同优先级是 shadow,不报错)。

### 为什么不能简单「换回官方的」

子洞渲染授权(`renderSlot`)绑定在**声明该子洞的 entry** 上 —— `ui-slots` 契约里 `children` 表是「声明 + 授权 + 运行时规格」三合一,而子洞声明**独占**(再声明直接抛 `already declared`,即 v0.12.0 事故)。官方 `WorkspaceBrowser` entry 输掉渲染竞争后仍在 ledger 上、仍持有 `sidebar.workspaces.directoryFlow` 的声明,于是接管该座位的第三方**永远**拿不到渲染它的授权(`ui-renderer` 硬检查:`not declared by this entry's children`)。**「插件自己的侧栏」与「官方对话框」在 dsh 当前版本下互斥。**

### 改了什么

- **删除**自绘的 `DirectoryBrowseDialog`(约 330 行)、`BetterFlow` 占用者、Windows 盘符探测、`createFolderIn` seam,以及 `.bw-browse-*` 全部样式(33 条规则)。
- **不再占用** `sidebar.workspaces.directoryFlow`:该洞现由官方 occupant 填充,与对话空态一致。
- 侧栏添加按钮改走 `startAddFlow()`:`native` 宿主直接用官方 OS 选择器(`uiWorkspace.pickDirectory`);`browse` 宿主弹一个极简提示,指向「新会话」页那份**纯官方**的应用内浏览器。采纳语义不变(仍由本插件 `createWorkspace` + `startSession`)。
- 词典:21 门语言各删 13 个 `browse.*` 键,新增 `add.guide` / `add.guide.title`。
- 冒烟测试:座位断言改为「两个 directoryFlow 洞都不占用」,并加防回归(自绘浏览器、占用者、`markPickerBrowse` 不得回归)。

### 影响

- **LAN / `0.0.0.0` 绑定下,侧栏不再提供应用内目录选择** —— 添加工作区请在**对话空态**(「新会话」页)使用官方入口。loopback 宿主的侧栏行为不变(仍是官方 OS 选择器)。
- 洞交给官方后,官方 occupant 的渲染由其 owner(官方 entry)负责,本插件只读占用率门控按钮。

## v0.15.1 — 2026-09-19

**类型**:fix(「按工作区」分组模式下工作区名字不渲染,用户实测 v0.13.0 起既有;对话框下拉改用官方 Menu,替换不适配主题的原生控件)

- **fix(分组方式选「按工作区」后,每个工作区行只剩图标和会话、名字消失;用户实测,v0.13.0 起既有)**:该模式(`groupBy='workspace'`,v0.13.0 随官方视图选项一起引入)把**原始 WorkspaceView** 直接交给 `renderWorkspaceEntry`,而原始 item **没有 `leaf`** 字段——`WorkspaceRow` 渲染的恰恰就是 `workspace.leaf`(同时传的 `title` 只作 tooltip)。树路径在 `buildTree` 里会算好 `leaf`,只有这条平铺路径漏了,于是表现为"图标在、会话在、名字空白"。修法:新增 `flatWorkspaceEntry()` 构造与树路径同形的 entry——标签取**完整标题**(该模式不渲染名称分组,`/` 没有可归的组,必须留在文字里),`title` 为空时按 `basename` 回退(与树路径同一条链)。测试**真驱动**该 helper,并断言 `items` 循环不再交原始对象;反证:退回 v0.13 写法即变红。
- **fix(「移动到分组」对话框的两个下拉是原生 select / datalist,弹层跟随系统、完全不适配主题;用户实测)**:操作系统自己绘制原生控件的弹层,于是深色半透明面板上弹出来的是**系统浅色列表**。同一个缺陷 dsh-ide-git 踩过两次(见其 RepoSelect / FilterSelect 的注释),它不得不把替代菜单**画在自己面板内**(dsh-better-sidebar 声明 `contain: layout`,portal 浮层会被摆到屏幕外);本插件位于 DSH 原生槽位、没有这个约束,因此直接用**官方 primitives Menu**:官方外观与键盘模型、portal 层级 1100 高于 Modal 的 1000、自带 max-height + 滚动(工作区 × 会话的目标列表需要)。新增 `MenuPicker` 承担两处——**目标选择器**(按钮显示当前项,菜单里勾选当前项)与**分组名候选**(输入框旁的 chevron 按钮;手输新组名完全不受影响,datalist 彻底移除)。**降级**:宿主 primitives 没有 Menu 时目标选择器回退原生 select,绝不出现"选不了"。
- **测试 32 → 34 项**:新增「按工作区」模式的行标签(真驱动 `flatWorkspaceEntry`)与下拉组件守卫(探测、当前项勾选、两处接线、原生控件只剩一个降级位、datalist 绝迹);两条均**反证过**。
- 相关:[Release v0.15.1](https://github.com/KannaKuron/dsh-better-workspace/releases/tag/v0.15.1)

## v0.15.0 — 2026-09-19

**类型**:feat + fix(工作区名称分组改为可选、默认关闭,开关移入设置卡片;分组入口按开关各自显示;两处 0.1.5-rc.x 宿主兼容回归修复 + 一处本次改动自身引出的拖拽语义空洞)

- **feat(工作区 "/" 分组改为可选、默认关闭;用户明确决定)**:插件的立身功能一直是「名称里 / 即分组」,而官方目录流(磁盘层)本身已能表达"组"——两层叠加对只用官方文件夹的用户是多余的噪声。#3 请求显式分组入口、#5 实测后建议直接用官方目录流,两者其实指向同一件事:**工作区这一层的归属应当由官方文件夹决定**。v0.15.0 把工作区名称层改成**可选开关,默认关闭**:关闭时工作区只按官方文件夹(磁盘目录)嵌套、标题原样完整显示、不再按 / 拆组;开启后恢复既有名称分组。**会话分组不受影响**,保持名称解析(独立开关,默认仍开)。
- **feat(开关从侧栏菜单移入设置卡片)**:原「工作区按"/"分组」藏在侧栏头部的视图选项菜单里(0.13.0 引入),对"我的树为什么是平的"这类疑问不可发现。现移入 **设置 → 插件 → 更好的工作区** 卡片并配说明文案;侧栏菜单只保留会话开关(菜单项与 21 门词典键同步迁移,不遗留死键)。
- **feat(默认值与升级语义:三类人群一次读分清)**:hydration 是整值替换、且只在快照存在时执行,因此一个键即可分清三类——① 存过 true/false 的浏览器(0.13/0.14 装过)按用户自己的选择照旧;② 快照存在但**缺该键**(0.13 以前的安装,当时默认分组且无开关)**保持开启**,升级绝不静默重排一个已经在用的树;③ 全新安装从不 hydration,落到 init 的新默认 **false**。判定收敛在 workspaceSlashOf 一处,树与设置卡片共用(两处读法不一致会让开关显示与树渲染互相矛盾,测试锁住)。
- **feat(采纳 PR #4 / @zhuhaoxiangAndy:分组入口的可发现性)**:区头「新建分组」按钮(兼拖拽投放区:组在第一个成员落位时存在,不引入空分组、不新增持久化键)+ 四类行右键「移动到分组…」+ 更强的投放高亮。**入口按开关各自门控**:工作区行/工作区分组行只在工作区名称层开启时出现,会话行/会话分组行只看会话开关;header 按钮在两层都关时不渲染,投放区拒绝未开启那一层的行(不高亮、不接管),picker 候选按开启的层收窄。
- **fix(0.13.0 引入、0.1.5-rc.x 宿主上会话重命名全线失效;PR #4 实测暴露,此前无人上报)**:0.13.0 按 alpha.2 保留契约把重命名改成**无条件**调用 sessions.using(),而该契约是 dsh **0.1.6-alpha.2**(2026-09-17 的代际重构)才引入的;0.1.5-rc.x 宿主的 ISessions 只有 binding(id),于是会话行重命名 / 会话分组批量重命名 / 拖拽归组全部抛 "sessions.using is not a function"。现先探测 using()、缺失回退 binding().session.rename(),两条契约都没有才明确抛错。**本机(dsh 0.1.6-alpha.2)不受影响,所以一直没暴露——这是一颗只对别人炸的雷。**
- **fix(同类回归第二处:0.1.5-rc.x 上当前会话不高亮、新建会话行看不见)**:0.13.0 同时把"当前会话"从 wire 字段 SessionListState.current 改成按 retainedBy.mainView 判定,而 **retainedBy 同样是 alpha.2 才有的字段**;0.1.5-rc.x 上该读取恒为 undefined → 当前会话永不高亮,且 blank 行(发出第一条消息前的新会话)被 sessionVisible 整体滤掉。现补 wire 字段回退,并把 list.current 纳入 currentId 的 memo 依赖(0.1.5 切换当前会话不保证换新 byId,只依赖 byId 会把高亮冻住)。
- **fix(本次改动自身引出的语义空洞:关掉名称层后拖拽会静默改名)**:拖拽源的 leaf/folderPath 必须从**原始标题**推导(压缩行的显示 leaf 是假的,0.12.0 的教训),这个推导不随开关变化;而树的 folderPath 在关闭时恒为 '' → 每次拖拽都被判成"跨组移动",触发 renameWorkspace("web/前端" → "前端"),**树上一个组都看不见却改了名字**。现两处对齐:拖拽源在关闭时不携带名称前缀,提交处再兜一道 !workspaceSlash 强制走排序路径;重命名弹窗的 "/" 提示也在关闭时不再显示。
- **perf(PR 自身的小隐患,合并时收掉)**:分组对话框的候选列表 collectGroupPaths(遍历全部工作区 + 会话标题)原本挂在渲染路径上,对话框开着且 agent 在跑时每个 store tick 都要重走一遍(~44/s)。改为**打开时快照一次**存进 dialog 状态(与既有的 targets 快照同模式)。属 0.9.6 那条教训(issue #1)的同族问题,量级小得多。
- **测试 25 → 32 项**:新增分组入口逐层门控、header 按钮/投放区的开关守卫、workspaceSlashOf 三态真驱动(undefined / true / false)、开关座位迁移、两代"当前会话"契约、disk-only 拖拽不改名;全部**各自反证过**(去掉回退 / 改回默认值 / 去掉拖拽守卫均如期变红)。
- 相关:[Release v0.15.0](https://github.com/KannaKuron/dsh-better-workspace/releases/tag/v0.15.0) · 采纳 PR [#4](https://github.com/KannaKuron/dsh-better-workspace/pull/4)(@zhuhaoxiangAndy) · closes [#3](https://github.com/KannaKuron/dsh-better-workspace/issues/3) · 回应 [#5](https://github.com/KannaKuron/dsh-better-workspace/issues/5)

## v0.14.0 — 2026-09-18

**类型**:feat + fix(右键菜单官方对齐:primitives Menu + 官方 workspace 词典跟随;归档语义修正)

- **fix(菜单文案与官方差太多,用户实测)**:bw 会话行菜单显示「分叉 / 删除(红)」,官方是「分叉会话 / 归档会话」——bw 把归档动作标成 danger 红色,视觉上像删除,实际却是归档,语义双重误导。对齐官方 Rows.tsx 语义:**会话行 = 重命名 / 分叉会话 / 归档会话,归档刻意非破坏性(不再红色)**——官方注释:归档经注册表全局归档集隐藏行、不碰会话日志;**工作区行 = 重命名 / 删除工作区(红色 danger)**,与官方逐项一致。
- **feat(官方词典跟随)**:菜单文案经 `ctx.locale.bind('workspace')` 直接读**官方 workspace 词典**——官方改词自动跟随,不再需要插件发版;官方词典仅 zh/en,其余语言跟随官方同为英文回退(与官方浏览器表现一致)。bind 失败降级 bw 自己的对齐词典。
- **feat(官方 Menu 渲染)**:右键菜单从自绘 fixed overlay 迁移到官方 **primitives Menu**(portal + dense,图标 / danger / 分隔线全官方样式),右键坐标经 `getAnchorRect` 直接作为锚矩形;Escape / 点击外部关闭与官方一致。`ui.Menu` 缺失的宿主降级回旧自绘 overlay(保留兜底)。
- **feat(自定义外观入菜单)**:每类菜单底部以分隔线追加「自定义外观」(IconPersonalizationOutline16)——bw 特有项统一放官方项之后;分组 / 会话子分组(bw 特有概念)保留重命名入口。
- **升级对照纪律**:官方未来给行菜单加新项时,bw 需在 `menuEntries()` 同步(已在 AGENTS.md 验证清单记录);文案与样式层已自动跟随。
- **测试 24 → 25 项**:新增官方对齐守卫(词典绑定、逐项 id / 图标 / danger、归档非破坏、primitives Menu 渲染、坐标锚定)。
- 相关:[Release v0.14.0](https://github.com/KannaKuron/dsh-better-workspace/releases/tag/v0.14.0)

## v0.13.0 — 2026-09-18

**类型**:feat + fix(dsh 0.1.6-alpha.2 适配:会话导航保留契约迁移;官方视图选项菜单回归 + 会话 / 工作区按 "/" 分组开关)

- **fix(点击会话无法切换,用户实测 alpha.2;Windows 0.1.5 世代正常、mac 更新 dsh 后失效即此根因)**:alpha.2 把会话导航交给视图所有者——`ISessions` 不再有 `open()`(contract 注释 "navigation belongs to view owners"),`SessionListState.current` 字段一并删除。bw 继续调 `sessions.open` → 点击会话行抛 TypeError、静默无反应;`list.current` 恒 undefined → 当前会话永不高亮、blank 会话(新建未命名)被可见性规则整体滤掉。修复四件套:`open` 走 `uiWorkspace.openSession`(replaceMain);`forkSession` 走 `uiWorkspace.forkSession`;当前会话按官方语义从 byId 找 `retainedBy.mainView > 0`(模块级 `mainSessionIdOf`);重命名改用 `sessions.using` + `source: 'workspaceOperation'`(旧 `binding(id)` 只见过已保留会话,改名未打开的会话报 unknown session)。
- **feat(视图选项菜单)**:侧栏头部新增视图选项按钮,复刻官方 ViewOptionsMenu(primitives Menu:label / separator / selectedIds,dense + portal + end 对齐;`ui.Menu` 特征探测,缺失即按钮不渲染):**分组方式**(按工作区 / 按工作区树 / 单列表)+ **排序方式**(手动排序 / 最近更新)。默认 = 按工作区树 + 手动排序(bw 立身行为,升级不突变)。`updated` = 组内会话按 updatedAt 降序(id tie-break)、当前 blank 会话置顶(官方 pinCurrentBlank 语义)、纯展示层不落盘;recency 期间抑制会话重排锚点(下一次渲染就会被重排的锚点是谎言);工作区行顺序永远宿主序(不变量 7)。
- **feat(两个 "/" 分组开关)**:菜单内新增「会话按"/"分组」「工作区按"/"分组」(selectedIds 勾选形态,切换不关菜单、可连续操作),默认均开 = 现状。关闭后:工作区行挂磁盘层直取完整名称、会话行平铺完整标题;**磁盘层嵌套永远生效**(文件系统事实,不受开关影响)。无效选项置灰:单列表下会话开关无效;工作区开关只在树模式有意义。状态进 `dsh.betterWorkspace.view.v1`(groupBy / orderBy / sessionTitleSlash / workspaceTitleSlash 四键:init 默认值 + selector 回退,遵守 hydration 整值替换纪律;`'workspace-tree'` 模式即既有两层树,`'workspace'` 平铺磁盘根层,`'flat'` 官方单列表语义——全部可见会话一个深度 0 列表、完整标题、无拖拽锚点)。
- **词典**:21 门 × 10 键(viewOptions.*)。
- **测试 23 → 24 项**:新增视图选项守卫(store 契约与回退读取、开关感知的 buildTree / buildSessionTree、菜单装配与置灰、recency 锚点抑制、alpha.2 保留契约 open/mainSessionIdOf)。
- 相关:[Release v0.13.0](https://github.com/KannaKuron/dsh-better-workspace/releases/tag/v0.13.0)

## v0.12.1 — 2026-09-18

**类型**:fix(0.12.0 回归事故:bw 浏览器整个没注册,官方浏览器接管——右键菜单消失、名称 / 不解析)

- **现象(用户实测 v0.12.0)**:升级后右键菜单(自定义外观)打不开、工作区名称的 `/` 不再分组。
- **根因**:v0.12.0 给 sidebar.workspaces 注册加了 `children` 子洞声明,想以官方 WorkspaceBrowser 的「声明洞 + renderSlot」模式渲染官方拾取流。但**子洞声明互斥**(ui-slots register:childKey 已被声明即抛 `slot ... is already declared`):官方 WorkspaceBrowser 的 entry 输掉渲染竞争(priority 被压制)却仍在 ledger 上、仍拥有 'sidebar.workspaces.directoryFlow' 的声明,bw 再声明同洞 → register 抛错 → guarded 捕获降级 → **bw 浏览器座位整个不注册**,priority 0 的官方浏览器接管渲染。renderSlot 授权是运行时强制的(SlotOwnershipError),**压制官方浏览器与渲染官方流不可兼得**——这是平台约束,0.12.0 的设计在两处官方源码(register 的声明检查 + renderer 的授权检查)交叉验证后彻底证伪。
- **修法**:注册去掉 children 声明(树、两层模型、右键、外观全部即刻恢复);侧栏添加流回归 0.11.x 占用模式——bw 以 priority -1 占用官方声明的侧栏洞,占用者 BetterFlow 探测后端:native 宿主调**同一个官方宿主服务** uiWorkspace.pickDirectory()(OS 选择器),browse 宿主渲染 v0.11.4/0.11.5 打磨的自绘 DirectoryBrowseDialog;选完路径 adoptDirectory = createWorkspace + startSession(官方浏览器同款行为,**无**所属分组弹窗——分组靠改名/拖拽)。**hero 洞(conversation.hero.workspace.directoryFlow)绝不占用**:对话空态添加流保持纯官方。v0.12.0 的其余成果(两层树/磁盘嵌套、拖拽磁盘层固定、显式空分组退役、设置双座位、词典清理)全部保留。
- **冒烟测试 23 项**:新增**防回归守卫**——children 声明(带 directoryFlow)必须永远不再出现、侧栏洞占用注册必须存在、hero 洞必须不占;0.11.5 的 createFolderIn 接缝测试恢复(自绘对话框回归,其守卫随之回归)。
- **隔离真机验证(独立 DSH_HOME + 3180 端口 + 0.0.0.0 绑定 + headless Chrome over CDP,全程不碰用户实例)**:① DOM 断言 `.bw-root` 渲染、console 零 "register skipped"(0.12.0 根因消失);② CDP 点击侧栏「添加工作区」→ **自绘应用内目录浏览器出现**(browse 分支正确);截图留档。
- 相关:[Release v0.12.1](https://github.com/KannaKuron/dsh-better-workspace/releases/tag/v0.12.1) · 事故根因的官方源码位置:packages/client/ui-slots/src/index.ts register 的 children 检查 + renderer.ts SlotOwnershipError

## v0.12.0 — 2026-09-17

**类型**:feat(对齐 dsh 0.1.6-alpha.2:两层树 + 官方添加流回归;自绘拾取交互整体退役)

- **理念**:愿意保留官方的功能,本插件只做增强——v0.11.x 为解决 LAN 绑定下官方流不可用而自建的整套目录拾取(DirectoryBrowseDialog、后端探测、所属分组弹窗),在 alpha.2 有了官方完整实现(ui-directory-picker-browse 双面占用者),全部让位;遮蔽官方 workspace-tree 分组也不再成立,本版把它**吃进树模型**并与名称分组正交组合。
- **两层树(buildTree 重写)**:**磁盘层**按官方 owningParentFolder 语义嵌套——工作区行嵌在其最近已注册祖先目录的工作区行下(工作区嵌工作区,不凭空造目录节点;文件系统事实,UI 不可改);**名称层**在每个磁盘层内按标题 / 段分组(本插件立身之本)。两层正交:改标题只动名称层,磁盘层永远稳定。子层的分组身份键(idPath = 拥有链前缀)避免同名分组跨层串折叠/样式状态;折叠工作区行的状态呼吸灯聚合扩到整个子树(含嵌套层)。
- **拖拽语义**:名称层操作原样保留(拖到分组行 = 改前缀移入;拖到工作区行上/下半 = 改前缀 + 手动序);磁盘层不可拖拽改变——**跨磁盘层的放置只重组名称前缀**(注册表追加落位到自身磁盘层末尾),同层放置才走锚点序。
- **添加工作区回归官方**:删除两处 directoryFlow 洞占用(优先级 -1);sidebar.workspaces 注册改为**声明** directoryFlow 子洞(官方 WorkspaceBrowser 同款 children + renderSlot 模式),对话空态 hero 流与侧栏流都由官方组合占用者承载(loopback+显示 = 原生选择器;其余 = 官方应用内浏览器)。选完目录由本插件 adopt:createWorkspace + startSession(与官方浏览器行为一致);占用率门控添加按钮(无占用者时隐藏,占用者中途卸载自动撤回流)。
- **显式空分组退役**(与用户理念一致:分组是名称的投影,不留第二份数据):新建空分组 / 新增子分组 / 新增子工作区 / 删除空分组入口删除;store folders 通道与宿主命名空间 folders 字段删除(旧持久化数据含 folders 键无害,不再读取);分组重命名(批量改写成员前缀)保留。
- **设置卡片双座位**:settings.plugin.item(≤alpha.1 的 设置→插件)与 plugins.bundle.config(alpha.2+ 的 插件面板 bundle 页,按包名 dsh-better-workspace 挂 key,view:'page' 平铺渲染)双注册,slots.inject 各等各的声明,任一宿主年代恰好一个座位活。
- **词典清理**:27 个死键(flow.* / browse.* / folder.new.* / folder.error.exists|notEmpty / folder.delete.body / menu.newSub* / menu.removeFolder)× 21 门 = 567 行删除;sync.desc 21 门改写(不再提显式分组);bw-browse-*/bw-path-echo 等 35 行死 CSS 删除。
- **冒烟测试 23 → 22 项**:三个 0.11.x 拾取交互测试随功能删除;新增 buildTree 两层语义真驱动测试(磁盘嵌套 / 名称分组 / sub 层 / idPath 链 / Windows 路径归一)与官方流守卫(children 声明 + renderSlot 消费 + 无 directoryFlow 占用 + 双设置座位 + adopt 行为);键集守卫正则兼容双引号值。
- **版本兼容**:children 声明与 renderSlot 是 dsh 早期即有的通用槽机制,0.1.2+ 宿主均可跑;plugins.bundle.config 洞仅 alpha.2+ 声明,旧宿主该座位静默不存在(设置卡片仍在)。升级 dsh 与升级插件谁先谁后都收敛。
- 相关:[Release v0.12.0](https://github.com/KannaKuron/dsh-better-workspace/releases/tag/v0.12.0)

## v0.11.5 — 2026-09-17

**类型**:fix(选择目录弹窗「新建文件夹」静默失败:重构丢掉了真正落盘的那一次调用)

- **根因(issue #2,0.11.4 引入)**:0.11.3 的 `submitCreate` 是两条链——`.then(() => createDirectory(currentPath, name))` 负责落盘、`.then(() => {...})` 负责收尾。0.11.4 为了「新建后自动选中刚建的那个目录」把两条**合并成一条**,只留下结果消费端 `.then((created) => {...})`:**发出 `directoryPicker/createDirectory` 的那一步没有了**。于是 `Promise.resolve()` 自己 resolve 出 `undefined`,表单照常收起、`setSelected` 因 `created` 不是字符串而跳过、`go(currentPath, true)` 照常刷新列表——界面一切正常,**宿主文件系统里什么都没有**,Network 面板里也没有任何 `directoryPicker/*` 请求。这正是上报文案的逐字现象,也是它「没有报错」的原因:失败路径根本没被走到。
- **修法**:把创建动作放回链首,并抽成模块级接缝 `createFolderIn(createDirectory, path, name)`;成功回调仍按宿主 `createDirectory(path, name): Promise<string>` 的契约(browse 后端返回 `join(parent, name)`)选中新目录;重名 `directory-exists`、非法段名、父路径不可写等失败照旧落进 `setCreateError`,留在对话框内。
- **冒烟测试 22 → 23 项**:0.11.4 那条只钉住 UI 契约,而这次的缺陷**恰恰是字符串级断言看不见的**(函数在、参数在、调用没了)。新测试因此**真的驱动这个接缝**:断言 wire 动词收到浏览层路径与输入名、返回值就是被选中的路径、拒绝与同步抛错都要变成 rejection;接线侧再钉死 `submitCreate` 必须经由接缝、且「链首就消费 `created`」的 0.11.4 形态不得回归。**两条守卫各自反证过**:把 `src/client.js` 换回 0.11.4 的写法 → 红(`the create seam is missing`);只把接缝调用换回空链 → 红(`submitCreate must run the create through the seam`)。
- **A/B 真机实录**(隔离 DSH_HOME + webserver `0.0.0.0`(宿主组装 browse 后端)+ headless Chrome over CDP,全程不碰用户实例):
  - 对照组 `dsh-better-workspace@0.11.4`:点「添加工作区」→ 应用内浏览器 → 路径编辑进入目标层 → 「新建文件夹」→ 输入名称 → 「创建」→ **表单收起、零报错、footer 回到「选择此文件夹」**;wire 上只有四条 `POST /api/directoryPicker/list` 而**没有任何 `createDirectory`**,宿主目录里**什么都没建**——上报现象逐条复现。
  - 修复版 `0.11.5`:同一操作 → wire 上出现 `POST /api/directoryPicker/createDirectory → 200`,宿主目录**真实落盘**,列表刷新后**自动选中新目录**、footer 变成「选择「verify-fixed-folder」」,控制台零错误。
- **验证边界**:该对话框只在宿主组装 `browse` 后端时出现(非 loopback / SSH / 无显示会话);桌面客户端在 loopback + 有显示会话下走 native `pickDirectory` 分支,本次未触碰该分支(能力探测四分支仍由冒烟测试覆盖),两端共用同一份 `src/client.js`。
- 相关:[issue #2](https://github.com/KannaKuron/dsh-better-workspace/issues/2) · [Release v0.11.5](https://github.com/KannaKuron/dsh-better-workspace/releases/tag/v0.11.5)

## v0.11.4 — 2026-09-16

**类型**:fix(应用内目录浏览器的可用性:路径、盘符、选文件夹)

- **用户的实测反馈**:0.11.3 的 browse 对话框「不方便选文件夹,不方便看当前文件夹路径,不方便选盘符」。三条都成立——那一版的面包屑按官方对话框的做法**以 Home 为根**,于是看不到自己在哪;整行单击即进入,想选子文件夹必须先钻进去再点按钮;Windows 的多盘更是**完全没有入口**(browse API 只有 list/createDirectory)。
- **面包屑改为从文件系统根开始**(\C:\ → Users → kanna → Desktop),当前层是纯文本、其余可点;深路径自动贴右端(scrollLeft = scrollWidth),保证「我在哪」这一段始终可见;新增**「主目录」**按钮一键回 home。
- **Windows 盘符**:browse API 只能列路径、没有枚举磁盘的接口,因此在首次打开时**探测 C:–H:**(六次廉价列举,不存在的盘静默失败),把应答的盘做成右侧 chips 并按页缓存(模块级 browseDrives)。当前盘高亮;探测不到的盘仍可用路径编辑手输——那才是通用兜底。
- **选文件夹不再需要「钻进去再选」**:行改为单击**选中**(高亮 + 蓝框)、双击或行尾 › 进入(触摸必须有 chevron,双击不是手势),底部主按钮随选中变为 **「选择「AppData」」**;无选中时仍是「选择此文件夹」= 当前层。新建文件夹后自动选中刚建的那个目录。行支持 Enter 进入 / 空格选中。
- 新增 3 个词典键 × 21 门语言:browse.enter / browse.drives / browse.selectNamed(后者的 {name} 走宿主 locale 座位既有的参数形式 t(key, { name }))。
- **真机实录**(隔离 DSH_HOME + webserver 0.0.0.0 + headless Chrome over CDP):打开即显示「↑ C:\ Users kanna」面包屑与 C: D: E: F: 盘符条(本机四块盘全部探到);单击 AppData → 行高亮、底部按钮变「选择「AppData」」;点 D: → 面包屑变 D:\、列表切到 D 盘内容;点「主目录」→ 回到 C:\Users\kanna;全程零异常、零 console 错误。
- 冒烟测试 21 → **22 项**:新增一条钉住这次的三处交互契约(面包屑不再以 Home 为根、行选中而非直接进入、盘符探测与按页缓存、主按钮随选中变化、三个新键齐备、深路径贴右)。

## v0.11.3 — 2026-09-16

**类型**:fix(webserver 非 loopback 绑定时「添加工作区」必然失败)

- **根因:把「宿主一定组装 native 目录选择器」当成前提。** 宿主侧的 `@deepseek-ai/dsh-host-directory-picker-auto` 只在 `bindHost === '127.0.0.1'`、非 SSH 启动、且平台有可用显示会话时才组装 `native`;其余一切绑定(含 `0.0.0.0`、局域网、SSH 端口转发、无头)一律组装 `browse`——它的 wire 动词**只有** `list` / `createDirectory`,`pick` 被 `DirectoryPickerController.requireCapability('native','pick')` 明确拒绝为 `directory-picker/unavailable`。本插件两个 `directoryFlow` 洞以 `priority: -1` 压过官方 `browse` 占位者(该 profile 下 boot graph 里只有 `dsh-client-ui-directory-picker-browse`),而 BetterFlow 无条件 `pickDirectory()` → 客户端走原生流程、宿主只服务 browse,于是**必然**报错、一个工作区也加不上。**本机 web profile 的 webserver 正是 `host: '0.0.0.0'`**,所以从桌面浏览器走 loopback 访问同样中招——这不是手机/远程独有。
- **修法:先探测宿主组装的后端,再决定交互。** 新增 `pickerState` 与 `pickerCapabilityNow()`:用 `list`(只有 browse 后端会成功)做一次性探测,`native` 侧以能力码拒绝即判定 `native`;无法归类的失败(连接尚未就绪)**不缓存**,下次打开重探并照旧尝试 `pick`;`pickerRefusal()` 同时认「能力码」与「宿主那句固定文案」两种形状,`markPickerBrowse()` 供「pick 被拒」这条硬路径回写判定。判定结果同时决定两处入口(两个 `directoryFlow` 洞 + 侧栏内联流,二者共用同一状态)。
- **browse 后端下改用应用内目录浏览器(`DirectoryBrowseDialog`)**:Home 起点的可点面包屑链、可编辑路径、行内新建文件夹、隐藏文件开关、截断提示;一行 = 进入该目录,底部「选择此文件夹」= 采用当前层。浏览失败(例如 Windows 上 `「开始」菜单` 这类 junction 报 `EPERM`)**留在对话框内**显示,既不关闭流程、也不占用 owner 的 `onError`。选定目录后**照旧弹「所属分组」**,功能一点没少。
- 宿主组装的是未知 kind 时不猜测:直接把宿主的拒绝交给 owner 的错误面(与官方「未知 kind 默认隐藏 picking 交互」的取向一致)。
- **顺带修掉的窄对话框布局**:浏览工具(显示隐藏文件 / 新建文件夹)移到列表上方独立一行,footer 只留「取消 / 选择此文件夹」——0.11.2 的四个按钮在 460px 宽里会挤成两行。
- **A/B 真机实录**(隔离 DSH_HOME、同一台机器、webserver `0.0.0.0`、headless Chrome over CDP,全程不碰用户正在跑的实例):
  - 对照组 `dsh-better-workspace@0.11.2`:点「添加工作区」→ 错误弹窗逐字复现上报文案 `directory picker failed: directoryPicker.pick needs the native capability; the composed picker serves "browse"`,应用内浏览器不存在;
  - 修复版 `0.11.3`:同一操作 → 应用内浏览器列出宿主主目录 → 进入 `Desktop` → 「选择此文件夹」→ 「所属分组」弹窗(填入 `web/验证`)→ 「创建」→ 侧栏树出现 **`web/验证/Desktop`**,控制台零错误、零异常。
- 冒烟测试 20 → **21 项**:新增一项直接驱动 capability 模块的四个分支(browse 判定与缓存、native 判定、未归类失败不缓存且可被硬路径改写、拒绝分类的两侧形状),并断言两处入口都注入了 browse 原语、流程确实查询探测结果。
- 文档:README 双语补上「用哪种选择器跟随宿主实际组装的后端」一段,并写明想强行走原生选择器的代价(LAN 客户端点不到、弹在服务器桌面)。

- 相关:[Release v0.11.3](https://github.com/KannaKuron/dsh-better-workspace/releases/tag/v0.11.3) · [上游讨论 deepseek-harness#6785](https://github.com/deepseek-ai/deepseek-harness/discussions/6785)(客户端拿不到 capability 的缺口已上报)

## v0.11.2 — 2026-09-15

**类型**:fix(回退 0.11.1 的描边实现)

- **0.11.1 的描边方向是错的,改回几何描边**。那一版把描边换成「八向偏移的字形拷贝」,依据是偏移落在整数设备像素上、实测「达到所选颜色的描边像素占比」从 0.19 升到 0.69。**指标变好了,观感变差了**:八个方向本质上只有四个斜向采样点,于是**每一条斜边、每一段曲线上的描边都碎成一串断开的方块**——字母 A / W / x 的斜线、中文「深」「远」的撇捺最明显,用户的原话是「碎碎的,填充的不好」。几何描边是真实的路径描边,轮廓**天然连续**,这是它不可替代的地方;它唯一的问题是太细时被抗锯齿稀释掉。
- **真正的修法:给几何描边足够的宽度**。`paint-order: stroke fill` 会把带宽的内侧一半盖掉,所以**绘制宽度必须是滑条承诺的两倍**——0.10.x 直接画配置值,留下的那 0.5px 外沿正是被稀释掉的一圈。现在 `WebkitTextStrokeWidth = 配置值 × 2`:滑条 1px 就是屏幕上 1px 的边,连续、饱满、不碎。滑条范围随之从 0.5–4 收敛到 **0.5–2**(对应可见 0.5–2px),默认仍是 1(可见 1px,比 0.10.x 明显、比 0.11.1 干净)。**嫌粗就滑到 0.5**,那正是 0.10.x 的观感。
- **0.11.1 引入的连带机制全部撤销**:描边不再经过 text-shadow,`--bw-stroke-shadow` / `--bw-glow-shadow` / `--bw-text-glow` 三个变量删除,呼吸灯 keyframes、11px 元信息列的 `-webkit-text-stroke-width:0`、以及「有光晕才让文字呼吸」的判据都回到 0.10.1 的写法——它们本来只是为了绕开 text-shadow 的整体替换语义,几何描边路线不需要。
- 保留 0.11.1 唯一站得住的部分:`.bw-row-label` 与 `.bw-preview-label` 的 3px 留白余量(覆盖滑条最大档的外扩)。
- **方法论教训**:「达到纯描边色的像素占比」是个会骗人的指标——它奖励「实」,而「实」可以用离散采样硬凑出来,代价是轮廓断裂。评估描边必须看**轮廓的连续性**,而连续性只有在放大到能看清斜边与曲线时才暴露;只测直线段、或只看统计量,都会得出错误结论。0.11.1 的验证记录因此也一并作废。
- 冒烟测试 20 项全绿:断言回到 `strokeStyleOf`,新增「绘制宽度 = 配置 ×2」与「必须仍是几何描边(不得再出现 STROKE_DIRECTIONS / strokeShadowsOf)」两条。

## v0.11.1 — 2026-09-15

**类型**:fix

- **字体描边不再"锯齿"**:描边从 `-webkit-text-stroke` 换成**八向偏移的字形拷贝**(text-shadow)。原实现是**几何描边**——带宽以字形轮廓为中心,`paint-order: stroke fill` 又把内侧一半盖掉,只剩约 0.5 CSS px 的外沿;而字形轮廓很少正好落在设备像素网格上,光栅器便把这半个像素摊到两三个像素上,描边于是**永远到不了自己选的颜色**,看上去又淡又毛——这就是"锯齿"的真正来源。改成偏移拷贝后,偏移量落在**整数设备像素**上(2x 下 0.5px 正好一个设备像素),描边是实心的:同一行文字在 2x 下实测「达到所选颜色的描边像素占比」从 **0.19 → 0.69**,而涂色面积只涨约 10%——**粗细不变,只是不再被稀释**。1x 屏同样改善(0.22 → 0.53),描边在非 Retina 上从"几乎看不见"变成看得见。
- **偏移量 = 粗细的一半,且不低于一个设备像素**:`strokeOffsetOf` 取 `max(width / 2, 1 / devicePixelRatio)`,所以既有配置的观感粗细不变(1px 设置仍是原来的宽度),而滑到最细一档也不会退化成一片模糊。
- **四处联动改写**:描边既走 text-shadow,(a) 行上额外发布 `--bw-stroke-shadow`(逗号结尾),呼吸灯的 keyframes 用 `var(--bw-stroke-shadow,)` 把描边带进动画——描边行呼吸时不再丢描边,空回退保证关描边的行呼吸行为与从前逐帧一致;(b) 11px 元信息列改为 `text-shadow: var(--bw-glow-shadow, none)`,继续只享受光晕、不带描边(0.10.1 的行为不变);(c) `--bw-text-glow` 取代原先的 `custStyle.textShadow` 作为"这一行要不要文字呼吸"的判据——描边默认开启后 text-shadow 恒非空,旧判据会让每一行都开始呼吸;(d) `.bw-row-label` 与预览标签的留白余量 1px → 3px,覆盖最粗一档的斜向外扩。
- **性能无回退**:400 行侧栏滚动重绘基准,中位帧时 16.7ms,与 `-webkit-text-stroke` 及完全无描边三者一致(DPR 2 / Chrome 152);八层 text-shadow 没有可测量的代价。
- **验证记录**(本机 Chrome 152 / macOS,13px 行、`#808080`、DPR 1 / 1.5 / 2 / 3 逐像素比对):真机页用插件自身 CSS + 真实行结构复现,确认 keyframes 变量展开、元信息列只去描边留光晕、空回退路径均符合预期。同时被试过并否决的方案——`text-rendering: geometricPrecision`(边缘变柔但纯色描边像素反而更少,且文字整体变细约 7%)、`-webkit-font-smoothing: antialiased`(同上)、把 `-webkit-text-stroke` 加宽到 2px(实心度 0.19 → 0.66,但视觉粗一倍)、`filter: drop-shadow` 与半透明描边色(均更差)。
- 冒烟测试 20 项全绿:原 `strokeStyleOf` 断言改写为 `strokeShadowsOf` / `strokeOffsetOf`(八向、颜色优先级、auto 反差、关闭即空数组、偏移钳到设备像素),0.10.1 用例增加预览留白、呼吸 keyframes 变量与"元信息只去描边"三条断言。

## v0.11.0 — 2026-09-15

**类型**:feat

- **界面支持 21 种语言**:原有 `zh` / `en` 两本词典之外,新增 19 门第三语言——`ar` `de` `fr` `hi` `id` `it` `ja` `ko` `nl` `pl` `pt` `ru` `sv` `th` `tr` `vi`,加繁体三件套 `zh-HK` / `zh-MO` / `zh-TW`(港式与台式各一份,`zh-MO` 复用 `zh-HK` 的用词)。每门语言在 `LOCALES` 表里只占一条,条目上一行是 `/* locale: <tag> */` 标记(冒烟测试据此切片),加一门语言 = 追加一条,不改任何逻辑。
- **词典交给 DSH 的 locale 服务**:`ctx.locale.register(NS, Object.assign({ zh, en }, LOCALES))` 一次注册,语言跟随 DSH 的 `ctx.locale`;`t` 仍是宿主渲染器按 slot 注册里 `locale: NS` 绑好的座位,切换语言经 locale revision 即时重渲染生效,本插件不自己解析词典、不缓存词典、也绝不调 `ctx.locale.addLanguage`(那是语言包插件的活)。
- **新增守护测试「每本词典的键集与中文完全相等」**:缺键在查表时静默回退英文,面板会变成半翻译状态而不报错,因此冒烟测试逐门比对 key 集(缺一个即红),并断言 19 门语言的标签顺序与单次注册调用不变。
- **译文为机器辅助翻译,欢迎在 issue / PR 里修正**:每门语言只占一处、互不影响,改一门不会动到别的语言。
- 顺带修掉的文档/文案 bug:README 双语把本地化说成「中英双语跟随界面语言」/「zh/en localization」(0.10.x 起早已不是事实),改为「界面文案跟随 DSH 的语言设置(内置 21 种语言,含简繁中文)」;`npm test` 说明同步改成 21 门词典键集对齐;AGENTS.md「词典纪律」按 21 门重写(标记、键集相等、不自己订阅语言、绝不 addLanguage)并更新目录地图里的冒烟测试描述。
- 冒烟测试 19 → 20 项,全绿。

- 相关:[Release v0.11.0](https://github.com/KannaKuron/dsh-better-workspace/releases/tag/v0.11.0)

## v0.10.2 — 2026-09-15

**类型**:fix + feat

- **图标集不再钉死(适配 dsh 0.1.6-alpha.1)**。新版换了一批 primitives 图标:删除 `IconSendOutline16`,新增 `IconPaperPlaneOutline14` / `IconWrapLinesOutline16` 等。旧实现把图标名钉在 `ICON_CHOICES` 里:**新宿主上会多出一个渲染为空的格子**,而且用户此前保存过该图标的话,那一行的图标会直接消失。现在 `ICON_CHOICES` 只是候选清单,渲染出口由 `ICON_PICKER_CHOICES` 运行时过滤(只留本宿主导出的字形、按解析后的名字去重),已保存的旧值经 `resolveIconName` → `ICON_ALIASES` 落到等价替代(`IconSendOutline16` → `IconSendOutline14`,两版都有)。新版新增的 5 个字形一并纳入候选清单,旧宿主自动滤掉;选过退役图标的行在新宿主上仍高亮正确的格子。
- **会话拖拽排序不再因宿主接口消失而失效**。dsh 0.1.6-alpha.1 把 `insertSessionBefore` 从浏览器注入面移除(官方改成 browser 本地排序),而本插件原来以 `typeof insertSessionBefore === 'function'` 门控——新宿主上拖拽排序会静默失效。现在双通道:宿主动作优先(权威、与其他界面一致),缺失时落到**浏览器本地扁平序**(store 新增 `sessionOrder`,按 workspaceId 存 id 数组;`reorderIds` 复刻 insertSessionBefore 的锚点语义)。本地序**只在宿主无该动作时生效**,且与折叠状态一样每端本地、不进跨端同步。
- 冒烟测试 17 → 19 项:图标解析 / 别名链 / 宿主过滤 / 已存值兜底、`reorderIds` 锚点语义、store 新键的 hydration 容错、两条通道的接线断言。

## v0.10.1 — 2026-09-15

**类型**:feat / fix

- **描边颜色可选**:新增「描边颜色」——预设**灰(默认)/ 黑 / 白 / 品牌蓝**加任意取色器,并保留「自动」(按该行字体颜色取 WCAG 反差色:浅色字配黑边、深色字配白边,且跟随主题与背景插件的界面明暗)。**默认改为灰色 #808080**——深浅背景上都可读,又不像纯黑/纯白那样抢眼。颜色随行级条目与「默认外观」一起持久化、跨端同步。
- **描边被裁切修复**:行标题 `.bw-row-label` 带 `overflow:hidden`(省略号所需),外描边在文字左边界溢出盒外会被切掉——实测「Web」「测试」等首字左侧缺边。改为 `padding:1px; margin:-1px` 预留 1px 余量:文字起点与省略号行为不变,描边四向完整。
- **右侧元信息不再描边**:行尾的会话计数与相对时间(`.bw-row-count` / `.bw-row-time`,11px 次级灰字)描边后比标题还重;统一 `-webkit-text-stroke-width:0`,只留标题、分组名等主干文字带描边。
- 冒烟测试 17/17 全绿:appearance 用例扩展(默认灰、手选色优先、非法色回退、auto 反差),并新增 0.10.1 的裁切补偿与元信息断言。

- **描边被裁切修复**:行标题 `.bw-row-label` 带 `overflow:hidden`(省略号所需),外描边在文字左边界溢出盒外会被切掉——实测「Web」「测试」等首字左侧缺边。改为 `padding:1px; margin:-1px` 预留 1px 余量:文字起点与省略号行为不变,描边四向完整。
- **右侧元信息不再描边**:行尾的会话计数与相对时间(`.bw-row-count` / `.bw-row-time`,11px 次级灰字)描边后比标题还重;统一 `-webkit-text-stroke-width:0`,只留标题、分组名等主干文字带描边。
- 冒烟测试新增样式断言(补偿规则与关描边规则存在),17/17 全绿。

## v0.10.0 — 2026-09-14

**类型**:feat

- **字体描边(新)**:行内文字可加外描边,**默认开启**(背景画面下不描边文字常常看不清),宽度 0.5–4px 可调、默认 1px,步进 0.5px。
- **描边颜色自动判定,不手选**:取该行**最终字体颜色**的反差色——浅色字配黑描边、深色字配白描边(WCAG 对比度取更亮的一极)。行有自定义颜色时按该色现算;没有自定义色的行读树容器采样的 CSS 变量 `--bw-stroke-color`(`getComputedStyle` 实时采样,html/body 属性 mutation + 1.5s 兜底轮询),因此**主题明暗与 dsh-any-background 之类插件的「界面明暗」切换都自动跟随**,且不需要 React 重渲染。`paint-order: stroke fill` 让描边画在填充之下,字形不会变细。
- **设置卡新增「默认外观」**:颜色 / 发光 / 字体粗细 / 字体阴影 / 字体描边开关 / 描边粗细一次配好,没有单独自定义过的行全部继承(其余项默认与「无自定义」一致,只有描边默认开)。行级「自定义外观」对话框与设置卡**共用同一组控件**,并新增描边开关与描边粗细;**实时预览同样显示描边**(默认色的预览按预览文字自身的实时颜色取反差色)。
- **行级条目按字段覆盖默认值**:老版本写下的条目(没有 stroke 键)照样继承新默认描边,而不是丢掉它;提交时若与默认外观完全一致则清除条目,不写冗余副本。
- **跨端同步**:默认外观随宿主设置命名空间 `better-workspace` 的 `appearance` 字段(形状自管,`Schema.dict(Schema.any())`),与其它外观项一样参与手动推送 / 获取。
- 冒烟测试新增 appearance 用例(默认开启、字段级合并、反差色取极、宽度钳制、`color(srgb …)` 解析、宿主字段与同步路径),16/16 全绿。

## v0.9.6 — 2026-09-13

**类型**:fix

- **标题缓存性能修复**([issue #1](https://github.com/KannaKuron/dsh-better-workspace/issues/1),已关闭):0.9.4/0.9.5 把冷重启标题记忆(`dsh.betterWorkspace.titles.v1`)做成了响应式 dsh-client-store——`rememberTitle` 每会话每次快照 dispatch 一次,每个 action 都是 immer produce + sync 广播 + 整串 JSON.stringify 持久化;大会话库下(报告环境 482 会话 × agent 运行时 ~44 快照/s)每秒数千次 action 直接冻结主线程(报告与复现:41% CPU、点击冻 ~0.9s)。修复:改为普通模块对象 `titleCache` + `rememberAllTitles(list)` 每快照**一次批处理**(同值零分配、只有真变化才置脏;淘汰每批一次)+ `scheduleTitleSave` 200ms 防抖整写 localStorage + `loadTitleCache()` 首渲染前同步恢复;`titleCacheRef = { getSnapshot, rememberAllTitles }` 组件直读不订阅;持久键与数据形状不变,升级无迁移。红线(已入 AGENTS.md):标题缓存绝不做响应式 store / 逐会话 dispatch——「reducer 内 no-op」不等于「action 免费」。
- 冒烟测试新增 title-cache 用例(mock localStorage),15/15 全绿;README 双语措辞更新(防抖本地缓存)。
- 相关:[issue #1](https://github.com/KannaKuron/dsh-better-workspace/issues/1) · [Release v0.9.6](https://github.com/KannaKuron/dsh-better-workspace/releases/tag/v0.9.6)

## v0.9.5 — 2026-09-09

**类型**:feat

- 手动跨端同步(web ↔ 桌面):宿主 settings 命名空间 `better-workspace`(~/.dsh/settings.yaml)承载 styling/folders/toggles 作为第三层持久化;偏好每次变更双写(本地即时回显 + 宿主);设置卡同步区按 IS_DESKTOP_SURFACE 方向感知,拉取支持覆盖/合并两模式,旧版本历史数据可显式「发送」。绝不自动镜像/自动迁移(用户明确决定);折叠状态永远每端本地。

## v0.9.4 — 2026-09-09

**类型**:feat

- 冷重启标题记忆:记住每会话最后真实 wire 标题(`dsh.betterWorkspace.titles.v1`),冷列表缺 title 时(fork 出生、从未写过检查点的低活动会话,官方列表只带投影缓存命中者)渲染记忆标题而非工作区 basename 回退;只学 summary.title 绝不学 displayTitle;声明 engines.dsh。——注:本版的响应式 store 形态即 issue #1 的性能根因,v0.9.6 已重写为普通对象 + 批处理。

## v0.9.3 — 2026-09-01

**类型**:chore

- 移除退役的 connectionGeneration 注入(上游已删该注入面);README 加 Awesome DSH Plugin 徽章(收录 PR #3961)。

## v0.9.2 — 2026-08-31

**类型**:fix

- quote-on-land 收紧:只对「本挂载内亲眼见过 blank 快照的会话」生效(0.9.1 按「首轮快照后首次出现」判新,store 渐进填充时存量旧会话被误包引号,实测事故);落地后过 20s 稳定期、期间标题再变即重置;孤立引号只是普通字符。

## v0.9.1 — 2026-08-31

**类型**:feat

- slash 标题 quote-on-land(自动命名带 / 的会话整串包引号,防误分层);移除 URL 嵌套(用户实测后明确不要任何 URL 层级,回到纯 / 切分)。

## v0.9.0 — 2026-08-31

**类型**:feat

- 状态呼吸灯取代完成 toast(toast 全套移除):被折叠遮蔽的状态沿层级向外冒泡到最近可见容器行;冒泡只含 warning 琥珀 > done 绿,ongoing 一律不外渗(用户明确觉得 running 外渗吵)。

## v0.8.0 — 2026-08-31

**类型**:feat

- URL 感知嵌套(0.9.1 已按用户要求回退)、相对链标签(VS Code 式)、右键菜单文件夹操作(新建子分组/子工作区)、完成 toast(0.9 已被呼吸灯取代)。

## v0.7.2 — 2026-08-31

**类型**:fix

- 注入 insertSessionBefore 并以 canReorderSessions 门控会话重排投放——≤0.7.1 拖会话排序即弹 TypeError(browserInjected 曾漏注入该动作)。

## v0.7.1 — 2026-08-31

**类型**:fix

- dragstart 的 setDrag 延迟一帧:Chromium 在拖拽手势建立前,同步重渲染把拖拽源元素从光标下移开会立即取消整个拖拽(参照 react-dnd #3649 同款 setTimeout 解法)。

## v0.7.0 — 2026-08-31

**类型**:feat

- 拖拽期单链展开:工作区拖拽激活期间 compressTree 暂停,单链展开回文件夹行、任意一级可投放,拖完自动合并。

## v0.6.0 — 2026-08-30

**类型**:fix / feat

- dsh ≥ 0.1.2-alpha.2 的 settingsNamespace() 移除适配(register 单次调用双 era 兼容);活跃定时任务角标(IconAlarmClockOutline16);图标网格扩充至 primitives 家族。

## v0.5.0 — 2026-08-30

**类型**:fix

- priority -1 影子化 shell 目录流选择器(hero 面目录流回退官方默认)。

## v0.4.3 — 2026-08-30

**类型**:release

- npm 正式通道切换为 Trusted Publishing(OIDC):0.4.2 用 npm login 令牌 bootstrap 建包,本版起 Release published 自动 OIDC 发布(实测全绿);README 截图排版(两栏布局)。

## v0.4.2 — 2026-08-30

**类型**:fix

- 纯文字发光(禁外框 boxShadow)、primitives 家族图标网格、RGB 输入、选中按钮 hover 态;npm 建包首版(令牌 bootstrap)。

## v0.4.1 — 2026-08-30(无独立版本 tag)

**类型**:fix

- 右键菜单适配透明/磨砂主题插件(dsh-any-background):自绘表面走「主题 token + 插件 CSS 变量」链。

## v0.4.0 — 2026-08-30(无独立版本 tag)

**类型**:feat

- VS Code 式单链压缩树、设置页(设置卡)、右键上下文菜单、外观自定义(颜色/发光/图标/字重)。

## v0.3.0 — 2026-08-30(无独立版本 tag)

**类型**:fix

- 恢复原生拖拽(工作区重排/移动、会话重排/移组),修会话分组折叠。

## v0.2.0 — 2026-08-30(无独立版本 tag)

**类型**:fix

- 对齐官方可见性/状态圆点语义,可折叠会话树,会话级层级。

## v0.1.0 — 2026-08-30(无独立版本 tag)

**类型**:feat

- 首版:侧边栏工作区列表升级为命名层级树(/ 虚拟分组、分组弹窗、重命名即时重排、空分组)。
