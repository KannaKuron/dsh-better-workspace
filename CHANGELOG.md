# Changelog — dsh-better-workspace

> 倒序排列,新版本条目在最上面。条目格式:`## vX.Y.Z — YYYY-MM-DD` + 类型(feat / fix / docs / chore)+ 要点 + 相关链接。
> 纪律见 AGENTS.md「变更记录纪律」:发版前先更新本文件并随版本提交;事故复盘、复现与真机验证记录也记在这里。

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
