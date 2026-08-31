# AGENTS.md

面向后续在本仓库继续开发的 Agent / 贡献者。读完再动手。

## 项目一句话

「dsh-better-workspace」:DSH 插件,把侧边栏「工作区」列表升级为**命名层级树**——工作区名称里的 / 即虚拟分组;添加工作区的官方目录流附「所属分组」弹窗;重命名即时重排;可新建空分组。

## 环境与工具

- GitHub 操作一律用 gh(已认证 KannaKuron);git 走本地代理(端点见工作区总纲 AGENTS.md),偶发 TLS EOF 原样重试。
- 发布双通道同家族惯例:npm test → npm version → git push --tags → gh release create → Release published 触发 OIDC 自动发 npm(node 24 + id-token: write,见 .github/workflows/npm-publish.yml)。发布后 curl -X PUT https://registry.npmmirror.com/dsh-better-workspace/sync 同步 npmmirror。
- 本机 web profile 装本地开发版:npm pack 出 tarball → 在 (dsh home)/profiles/web 里 pnpm add <tarball> → profile cordis.patch.yml 加挂载行(- insert: - id: better-workspace / name: dsh-better-workspace)→ 重启 DSH。

## 目录地图

| 路径 | 作用 |
|---|---|
| src/client.js | **全部功能所在**。window.__ModuleLoader__.load({ id, factory }) 包装的浏览器插件:三处 slot 注册 + 层级树 UI + 目录流弹窗 |
| src/index.js | host 半,纯占位(有效 Node 入口 + 一行日志);未来宿主侧功能(分组宿主登记、设置页后端)的家 |
| cordis.patch.yml | dsh plugin add 官方安装通道的挂载声明(insert 一行插件 row) |
| dsh.plugin.json | 插件注册表清单(id dsh-external/dsh-better-workspace) |
| tests/smoke.mjs | 冒烟测试(纯文件级,无 Cordis 运行时):清单一致性、基线 require 白名单、slot 注册、zh/en 词典对齐、无 import/JSX/TS 语法 |

## 核心不变量(改代码前必读)

1. **无构建,单文件客户端**。src/client.js 必须保持 __ModuleLoader__ 包装;每个 npm 包只有一个 client entry(exports["./client"]),**不能 require 任何非基线模块**。基线白名单(dsh-client-web seed.ts):react、react/jsx-runtime、react-dom、react-dom/client、@deepseek-ai/cordis、@deepseek-ai/dsh-client-store、@deepseek-ai/dsh-client-ui-slots、@deepseek-ai/dsh-client-ui-primitives。冒烟测试强制执行。
2. **slot 契约**(对照 dsh 源码 packages/client/ui-workspace/src/client/):
   - sidebar.workspaces 是 **single** 槽;same-priority 二次注册会抛错,官方占用者优先级 0,本插件用 priority: -1(ascending, lowest renders)压制。
   - conversation.hero.workspace.directoryFlow 与 sidebar.workspaces.directoryFlow 是官方 **directoryFlow** 洞:owner 持有触发器/busy/错误弹窗(open/busy/onPicked/onCancel/onError),占位者拥有「open 之后、交付路径之前」的一切。本插件**自己 create + rename,然后调 onCancel() 收尾**;失败走 onError(message) 让 owner 显示错误弹窗。**绝不调用 onPicked**(那会让 owner 再 create 一次)。
   - 本插件自己的浏览器**直接内联** BetterFlow(不经子 slot),因此它的「添加」按钮**不得**以 directoryFlow 占用率为门控(自己就是流)。
   - sidebar.workspaces.directoryFlow 的注册包在 try/catch 里:该洞只在本插件浏览器未占用父槽时才被声明,过渡期消失是正常路径。
3. **数据事实**(dsh 0.1.2-alpha.1 实测):
   - 分组来源是 WorkspaceView.title(**引号感知 + URL 兜底切分** splitTitleSegs:① “…”/"…" 引号段**原样**,段内 / 绝不切(未闭合开引号吞到串尾);② 引号外文字走 splitPlainSegs——从第一个 :// 起尾部整体单 leaf(0.8 曾按 URL 语义聚树,用户实测后明确不要任何 URL 层级,0.9.1 回退),:// 前照常按 / 切)。**会话标题的 quote-on-land effect**(见不变量 4)是主机制,无引号兜底是显示层保险。title 为空回退 basename(path)。**buildTree/buildSessionTree 的 ensure 是段数组驱动**:join 后的 path 字符串只作 Map 键,绝不能再 split('/') 回拆;normPath 同样复用 splitTitleSegs。
   - 会话标题是 SessionSummary.displayTitle(blank 会话显示本地化「新会话」);SessionListState = { ids, byId, current, phase, ... };WorkspaceSnapshot.archivedSessionIds 是注册表级归档集。
   - **会话可见性官方规则**(tree.ts sessionVisible):origin 非 subagent、不在归档集、blank 仅当前选中可见。子代理行(Side:*)永远不进浏览器列表。SessionSummary 还有 completed(完成提醒)、parentId(子代理血缘;客户端 service 映射 parentSessionId → parentId,**读 parentId**,旧拼写仅作向下兼容兜底——2026-08-31 修正)与 projectionValues.schedule(活跃定时任务,非空即显示闹钟角标,见 Schedule 角标)。
   - **活跃定时任务角标**(dsh 0.1.2-alpha.2 起):官方行对 projectionValues.schedule 非空的会话显示 IconAlarmClockOutline16(v0.6.0 已同样接入 SessionRow,role=img/aria-label/title 齐全);该图标与 IconClockOutline16/IconDatabaseOutline16 同为 alpha.2 新增,ICON_CHOICES 已补(66→69)。
   - **状态灯官方语义**(Rows.tsx sessionStatuses + StateDot):pending(approval/plan-review/question → warning 琥珀)> running(ongoing 蓝色运行环)> 子代理运行中(ongoing)> completed===true(done 绿);空闲不显示灯。绝不要用自绘圆点代替 StateDot。
   - 浏览器组件 props:wide/expandSidebar(owner)、useWorkspaces/useSessions/useSessionPendingInteraction(standard)、注入动作(startSession/open/renameSession/forkSession/renameWorkspace/deleteWorkspace/archiveSession/createWorkspace/searchSessions/pickDirectory/insertWorkspaceBefore/insertSessionBefore——后两个由本插件 browserInjected 特征探测提供,分别桥接宿主 workspaces.insertBefore 与 workspaces.insertSessionBefore,见官方 slots.ts 契约)、useStore/actions(store)、t(locale)。注入工厂的非 hooks 条目按原名成为 props;hooks 舱条目被渲染器绑成 useXxx 钩子。
4. **收起语义**:工作区行点击 = 该工作区会话树整体 0↔全部(默认展开,收起后行上保留会话数角标);会话子分组默认展开、可收起;搜索时强制全展开。**不要**恢复旧的「收起仍显示 5 条」行为(用户明确要文件夹式收起)。行上 + 新建会话会**强制展开**该工作区(onStart 里 setSessionsExpanded(id,true) 先于 startSession——用户必须看到新会话出现)。**quote-on-land(0.9.1)**:宿主自动标题(LLM 或确定性兜底,线上形状相同)落地 = blank→titled 转移;此刻标题含 / 且无引号 → renameSession 整串包 “”。**首轮快照只登记不处理**(存量标题可能是用户手动分组,绝不动);已 seen 会话的用户改名永不触发;fork 子会话出生即 titled 无转移不触发;失败不重试(显示层兜底仍平铺)。客户端拿不到标题来源字段(SessionSummary 只有 title/displayTitle),转移时机是唯一近似。**状态呼吸灯**(prefs.statusPulse 默认开;0.9 起取代 0.8 的完成 toast,toast 全套已删):被折叠遮蔽的状态沿层级向外冒泡到最近可见容器行——工作区/分组行让 **icon 呼吸发光**(drop-shadow,keyframes bw-breathe;icon 为 none/缺失时回退官方 StateDot;行自定义过标题发光(textShadow)的 label 同步呼吸 bw-pulse-text),会话分组行(无 icon)在行首放呼吸 StateDot。**冒泡只含 warning 琥珀(#d29922)> done 绿(#3fb950),ongoing 一律不外渗**(relayStateOf 过滤)——运行中的蓝色呼吸只出现在会话行本层(官方运行环包 PulseGlow),用户明确觉得 running 外渗吵。聚合:nodePulseOf(会话子树)/wsPulseOf(仅折叠工作区)/folderPulseOf(折叠文件夹聚全部,**无视内部展开状态**——折叠文件夹下展开的工作区同样不可见)。**教训:useEffect 的 deps 数组在渲染期求值**——引用后面才声明的 const(如 searching)是 TDZ ReferenceError,会让整区 QuietBoundary 降级空白(2026-08 实测);deps 需要的派生值(normalizedQuery)必须先声明或用内联布尔表达式。
5. **会话层级**:会话标题同样按 / 分层(buildSessionTree);会话子分组**必须**与工作区文件夹视觉可辨——次级配色(tertiary)、无文件夹图标、只有 chevron。分组重命名 = 批量改写成员标题前缀(renameSession)。
6. **持久化**只用 dsh 客户端 store(defineStore + persist: dsh.betterWorkspace.view.v1,浏览器本地)。显式空分组(folders)、折叠状态(expanded/sessionsExpanded/sessionGroups)都在这里;不要为动态实验另起持久化。
   - **关键事实**:hydration 是整值替换(attachPersistence 直接 setState(JSON.parse(raw))),不会合并 init。新增 state 键必须同时:(a) 初始化默认值;(b) action 里容错缺失键;(c) selector 读取带回退。2026-08 曾因 sessionGroups 未容错导致「会话分组点不开合」——这是本仓库的硬性纪律。
7. **拖拽语义**(原生 HTML5 DnD,drag 状态机 { kind, source, over }):
   - 工作区:同分组拖到工作区行上/下半 → insertWorkspaceBefore(anchor);跨分组 → renameWorkspace(新前缀标题) + insertBefore(组尾);拖到分组行 → 移入该分组(rename + append)。root 分组 = 无前缀标题。搜索中禁用拖拽;
   - **工作区拖拽激活期间 compressTree 暂停**(drag.kind==='workspace' 时 tree memo 跳过压缩,依赖是 draggingWorkspace 布尔而非整个 drag 对象——over 高频变化不该重建树):合并行把链上所有分组层级藏进名字里,恰好删掉了「移入该分组」的投放目标;拖拽期间单链展开回文件夹行、任意一级可投放,拖完自动合并回去。**拖拽源身份(leaf/folderPath)必须从原始 title 按 / 切分推导**,绝不能读合并行的显示 leaf(其 folderPath 被重置为 ''),否则拖着合并行做移入/跨组放置会拼出 x/组/工作区 这类双重前缀标题;
   - **工作区 dragstart 的 setDrag 必须延迟一帧**(wsDragArmTimer setTimeout 0,dragEnd 清理):Chromium 在拖拽手势建立前,若同步重渲染把拖拽源元素从光标下移开(链展开恰好会把新行插到拖拽行上方),会立即取消整个拖拽(0.7.0 回归,参照 react-dnd #3649 的结论与同款 setTimeout 解法)。会话拖拽不改树结构,保持同步 setDrag 不受影响;
   - 会话:同工作区内拖到会话行上/下半 → insertSessionBefore(以扁平 sessionIds 序为锚);拖到会话子分组行 → renameSession(新前缀标题)。跨工作区拖拽被守卫拒绝。**会话行排序投放以 canReorderSessions(typeof insertSessionBefore === 'function')门控**——不可用时 onDragOver/onDrop 直接 return(浏览器自然显示禁止投放),绝不能裸调 undefined(≤0.7.1 拖会话排序即弹 TypeError: insertSessionBefore is not a function,根因是 browserInjected 漏注入该动作);会话行 draggable 不因此关闭:拖到子分组是纯 rename,永远可用。
   - 显示顺序 = 宿主手动序(sessionIds / registry 序);buildTree/buildSessionTree 只排序分组名,绝不按名称/时间重排成员行(否则拖拽结果不可见)。
7. **词典纪律**:NS = betterWorkspace;zh/en 两个词典 key 必须完全对齐,且覆盖文件里每个静态 t(...) 调用——冒烟测试逐 key 校验。动态拼 key(如 time. + unit、status. + kind)的取值集合也要在词典里配齐。
8. **React 纪律**:纯 React.createElement;组件必须定义在模块层(内联组件定义会在父组件每次渲染时重挂载、丢输入状态);所有 hook 调用必须先于任何 early return。
9. **防御式边界**:primitives 图标/组件一律经 icon()/BTN() 特征探测降级,不硬崩;require 只允许基线(测试强制)。

## 已知限制(改之前先看是不是已排期)

- 会话拖到「另一分组内的会话行」仅扁平重排(标题分组归属不变);改分组请拖到分组行或重命名。
- 搜索是本地标题过滤,未接 session.search 宿主内容搜索。
- 外观自定义的「发光」是文字级 textShadow(浏览器合成),不改变主题 token;颜色/发光只影响本插件树行。

## v0.4 追加不变量(设置页 / 压缩树 / 右键外观)

10. **压缩树**(compressTree):仅当一层恰好一个子级时合并——单文件夹链合成一行(名字用 / 连接,path 取最深 = 展开状态键);单工作区链合成工作区行(leaf 拼接,kind=ws)。**0.8 起为相对段制**:递归只向链前插 node.name 段、链顶 materializeChain 才拼显示名,且相对第一个未压缩的祖先(VS Code 同款;链 a/b/c/W 在多孩子文件夹 a 下显示 b/c/W)——≤0.7 旧实现每层都前缀完整 node.path,嵌套链渲染出 1/2/1/2/3/A 类重复前缀。**只对根的子文件夹应用,根自身绝不合并**;纯展示层变换,工作区原 title/workspaceId 不动。ws-kind 在工作区/会话树遍历处都要处理(搜索、渲染、计数)。**工作区拖拽期间压缩暂停是特性不是 bug**(见不变量 7):合并行藏掉了链上所有分组的投放目标。
11. **右键即操作**:全行 onContextMenu 打开自绘菜单(fixed overlay,坐标来自事件),原 ⋯ 按钮已移除、不要加回;菜单动作与旧 ellipsis 完全一致(rename/delete/fork/archive/rename-sgroup)。文件夹的「删除分组」仅对显式空分组显示。v0.8:分组菜单头部新增 new-subfolder(复用 folder-new 对话框,parentPath 预填、提交按 parent+'/'+sub 拼接,查重覆盖显式+派生分组)与 new-subworkspace(setFlowParent(path) 后打开内联 BetterFlow,选完目录所属分组输入框自动预填);**标题栏「新建分组」按钮已按用户要求移除**,新建分组的唯一入口是右键分组行(根级入口 = 右键任意分组后改路径,或直接靠改名/拖拽派生)。
12. **外观自定义**:store.styling 键约定 folder:/workspace:/session:/sgroup: <id|path>;值 { color, glow(整数 0..14,连续), icon, weight(400/500/600/700,可选), shadow(bool,可选) }。**icon 只对 folder/workspace 行有意义**(2026-08:会话行图标位被官方 StateDot 状态灯占用、会话子分组行无图标位,自定义 icon 从来不会显示;因此 CustomizeDialog 对 session/sgroup 不渲染图标网格、提交不带 icon——重存会顺带清掉旧遗留的 icon 字段)。icon 兼容矩阵:legacy 三值 solid/outline/none(实心/空心文件夹/无)或任意 primitives 图标名(ICON_CHOICES 网格,**69 个**:3 legacy + 66 primitives;`@deepseek-ai/dsh-client-ui-primitives` 是 `export * from './icons'`,全量导出,ui[name] 都能解析)。**发光只有文字**:textShadow 光晕只作用于行内文字,禁止行外圈 boxShadow(用户明确不要外框发光);**字体阴影是独立的第二个 textShadow**(`1px 1px 2px rgba(0,0,0,.85)`,与发光叠加)。外观对话框底部带**实时预览**(改颜色/发光/粗细/阴影/图标即时反映最终行效果)。default 提交 = null 清除;删除条目 = setStyling(key, null)。
13. **设置入口只有一个:settings.plugin.item 卡片**(2026-08 已删除左侧导航 settings.section 注册;settings.section 相关纪律——store 传**共享 handle**(apply 创建一次的 viewStore,同 persist 名多个 handle 会交叉污染)、组件用 useStore 读 prefs/actions.setPref 写——对卡片同样适用)。
    - **settings.plugin.item 卡片**:`{name:'settings.plugin.item', key:'better-workspace', locale:NS, store:viewStore}`,渲染 **BetterWorkspacePluginCard**(与官方卡片一致的折叠卡:标题「更好的工作区」+ 一句话 desc + Chevron 头按钮,默认收起,展开才是 BetterWorkspaceSettings 内容;CSS .bw-plugin-card 镜像 PluginCard.module.css 的 token,已要求第三方插件卡片必须手写此 chrome——组件不可导入 ui-settings-plugins)。tab 只派发「宿主已服务命名空间 ∩ 卡片」——宿主不注册同名命名空间,卡片永远不出现。
    - **宿主命名空间 schema 必须用 @deepseek-ai/schemastery**:settings 服务把 schema 当**函数调用**(`schema(mergeLayers(...))`);schemastery 的 schema 可调用、传 undefined 补默认值;zod 对象**不可调用**,register() 抛 `TypeError: ... is not a function` 后命名空间从未服务(2026-08 实测根因,zod 版卡片死活不出的原因)。dsh-context / dsh-better-sidebar 同为 schemastery。src/index.js 用动态 `import('@deepseek-ai/schemastery')`(冒烟零依赖);runtime 解析走 profile 共享 fallback(已实测可解析)。
    - **settingsNamespace() 时代(v0.6.0)**:dsh >= 0.1.2-alpha.2 的 @deepseek-ai/dsh-settings **移除了 settingsNamespace() 导出**(installSettingsSection/deepEqualJson 一并移除),register() 改为接受普通字符串。src/index.js 用 `typeof ds.settingsNamespace === 'function'` 探测 —— 新 register() 接受普通字符串,旧 register() 也接受(helper 只是编译期 branding),单次调用双 era 兼容。**改 register() 调用必须先过这个探测**,不要假设 helper 还存在。
14. **透明/磨砂适配纪律**(第三方主题插件(dsh-any-background)实测):自绘表面一律走「主题 token + 插件 CSS 变量」链,禁止写死不透明背景。右键菜单底色 = var(--dsw-specific-menu, var(--dsw-alias-bg-overlay, rgba(28,28,32,.72)))(官方菜单同款 token,插件覆盖它时自动生效);磨砂 = backdrop-filter: var(--dsh-any-blur-card-panels, blur(12px) saturate(1.15))(-webkit- 同步)。其他表面同理:行透明 / 输入用 bg-layer-2 / 弹窗用 primitives Modal(官方面)。新增自绘面板必须复用该链,v0.4.1 已全仓扫过无残留硬背景。
- flat 视图未接管。
- 显式空分组持久在浏览器本地,跨设备不共享。

## 验证清单(改动后)

1. npm test 全绿。
2. 真机(web profile 重启 DSH):
   - 层级树渲染:造 web/前端、web/后端、根层工作区,分组/层级正确;
   - 添加工作区:选文件夹 → 分组弹窗(输入/下拉/留空)→ 创建后名称带前缀、树上位置正确;
   - 重命名工作区:跨分组改名(如 web/前端 → design/前端)后树即时重排;
   - 新建分组:空分组出现、重启后仍在;删除空分组;
   - 会话:打开/重命名/分叉/归档、新会话按钮、当前高亮、运行圆点;
   - 对话空态页「添加工作区」同样带分组弹窗;
   - 卸载/禁用本插件 → 回到官方浏览器,hero 流回退官方默认。
3. 升级 dsh 后:对照 packages/client/ui-workspace/src/client/contract/slots.ts 复核 slot 契约与注入面是否漂移(重点:GlobalStandardProps、directoryFlow owner props、single 槽 priority 语义)。
