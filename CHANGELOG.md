# Changelog — dsh-better-workspace

> 倒序排列,新版本条目在最上面。条目格式:`## vX.Y.Z — YYYY-MM-DD` + 类型(feat / fix / docs / chore)+ 要点 + 相关链接。
> 纪律见 AGENTS.md「变更记录纪律」:发版前先更新本文件并随版本提交;事故复盘、复现与真机验证记录也记在这里。

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
