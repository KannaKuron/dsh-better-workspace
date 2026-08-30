# AGENTS.md

面向后续在本仓库继续开发的 Agent / 贡献者。读完再动手。

## 项目一句话

「dsh-better-workspace」:DSH 插件,把侧边栏「工作区」列表升级为**命名层级树**——工作区名称里的 / 即虚拟分组;添加工作区的官方目录流附「所属分组」弹窗;重命名即时重排;可新建空分组。

## 环境与工具

- GitHub 操作一律用 gh(已认证 KannaKuron);git 走本地代理 [local-clash-proxy],偶发 TLS EOF 原样重试。
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
   - 分组来源是 WorkspaceView.title(按 / 切分);title 为空回退 basename(path)。
   - 会话标题是 SessionSummary.displayTitle(blank 会话显示本地化「新会话」);SessionListState = { ids, byId, current, phase, ... };WorkspaceSnapshot.archivedSessionIds 是注册表级归档集。
   - **会话可见性官方规则**(tree.ts sessionVisible):origin 非 subagent、不在归档集、blank 仅当前选中可见。子代理行(Side:*)永远不进浏览器列表。SessionSummary 还有 completed(完成提醒)与 parentSessionId(子代理血缘)。
   - **状态灯官方语义**(Rows.tsx sessionStatuses + StateDot):pending(approval/plan-review/question → warning 琥珀)> running(ongoing 蓝色运行环)> 子代理运行中(ongoing)> completed===true(done 绿);空闲不显示灯。绝不要用自绘圆点代替 StateDot。
   - 浏览器组件 props:wide/expandSidebar(owner)、useWorkspaces/useSessions/useSessionPendingInteraction(standard)、注入动作(startSession/open/renameSession/forkSession/renameWorkspace/deleteWorkspace/archiveSession/createWorkspace/searchSessions/pickDirectory)、useStore/actions(store)、t(locale)。注入工厂的非 hooks 条目按原名成为 props;hooks 舱条目被渲染器绑成 useXxx 钩子。
4. **收起语义**:工作区行点击 = 该工作区会话树整体 0↔全部(默认展开,收起后行上保留会话数角标);会话子分组默认展开、可收起;搜索时强制全展开。**不要**恢复旧的「收起仍显示 5 条」行为(用户明确要文件夹式收起)。
5. **会话层级**:会话标题同样按 / 分层(buildSessionTree);会话子分组**必须**与工作区文件夹视觉可辨——次级配色(tertiary)、无文件夹图标、只有 chevron。分组重命名 = 批量改写成员标题前缀(renameSession)。
6. **持久化**只用 dsh 客户端 store(defineStore + persist: dsh.betterWorkspace.view.v1,浏览器本地)。显式空分组(folders)、折叠状态(expanded/sessionsExpanded/sessionGroups)都在这里;不要为动态实验另起持久化。
   - **关键事实**:hydration 是整值替换(attachPersistence 直接 setState(JSON.parse(raw))),不会合并 init。新增 state 键必须同时:(a) 初始化默认值;(b) action 里容错缺失键;(c) selector 读取带回退。2026-08 曾因 sessionGroups 未容错导致「会话分组点不开合」——这是本仓库的硬性纪律。
7. **拖拽语义**(原生 HTML5 DnD,drag 状态机 { kind, source, over }):
   - 工作区:同分组拖到工作区行上/下半 → insertWorkspaceBefore(anchor);跨分组 → renameWorkspace(新前缀标题) + insertBefore(组尾);拖到分组行 → 移入该分组(rename + append)。root 分组 = 无前缀标题。搜索中禁用拖拽;
   - 会话:同工作区内拖到会话行上/下半 → insertSessionBefore(以扁平 sessionIds 序为锚);拖到会话子分组行 → renameSession(新前缀标题)。跨工作区拖拽被守卫拒绝。
   - 显示顺序 = 宿主手动序(sessionIds / registry 序);buildTree/buildSessionTree 只排序分组名,绝不按名称/时间重排成员行(否则拖拽结果不可见)。
7. **词典纪律**:NS = betterWorkspace;zh/en 两个词典 key 必须完全对齐,且覆盖文件里每个静态 t(...) 调用——冒烟测试逐 key 校验。动态拼 key(如 time. + unit、status. + kind)的取值集合也要在词典里配齐。
8. **React 纪律**:纯 React.createElement;组件必须定义在模块层(内联组件定义会在父组件每次渲染时重挂载、丢输入状态);所有 hook 调用必须先于任何 early return。
9. **防御式边界**:primitives 图标/组件一律经 icon()/BTN() 特征探测降级,不硬崩;require 只允许基线(测试强制)。

## 已知限制(改之前先看是不是已排期)

- 会话拖到「另一分组内的会话行」仅扁平重排(标题分组归属不变);改分组请拖到分组行或重命名。
- 搜索是本地标题过滤,未接 session.search 宿主内容搜索。
- 外观自定义的「发光」是文字级 textShadow(浏览器合成),不改变主题 token;颜色/发光只影响本插件树行。

## v0.4 追加不变量(设置页 / 压缩树 / 右键外观)

10. **压缩树**(compressTree):仅当一层恰好一个子级时合并——单文件夹链合成一行(名字用 / 连接,path 取最深 = 展开状态键);单工作区链合成工作区行(leaf 拼接,kind=ws)。**只对根的子文件夹应用,根自身绝不合并**;纯展示层变换,工作区原 title/workspaceId 不动。ws-kind 在工作区/会话树遍历处都要处理(搜索、渲染、计数)。
11. **右键即操作**:全行 onContextMenu 打开自绘菜单(fixed overlay,坐标来自事件),原 ⋯ 按钮已移除、不要加回;菜单动作与旧 ellipsis 完全一致(rename/delete/fork/archive/rename-sgroup)。文件夹的「删除分组」仅对显式空分组显示。
12. **外观自定义**:store.styling 键约定 folder:/workspace:/session:/sgroup: <id|path>;值 { color, glow(整数 0..14,连续), icon, weight(400/500/600/700,可选), shadow(bool,可选) }。**icon 只对 folder/workspace 行有意义**(2026-08:会话行图标位被官方 StateDot 状态灯占用、会话子分组行无图标位,自定义 icon 从来不会显示;因此 CustomizeDialog 对 session/sgroup 不渲染图标网格、提交不带 icon——重存会顺带清掉旧遗留的 icon 字段)。icon 兼容矩阵:legacy 三值 solid/outline/none(实心/空心文件夹/无)或任意 primitives 图标名(ICON_CHOICES 网格,**66 个**:3 legacy + ~63 primitives;`@deepseek-ai/dsh-client-ui-primitives` 是 `export * from './icons'`,全量导出,ui[name] 都能解析)。**发光只有文字**:textShadow 光晕只作用于行内文字,禁止行外圈 boxShadow(用户明确不要外框发光);**字体阴影是独立的第二个 textShadow**(`1px 1px 2px rgba(0,0,0,.85)`,与发光叠加)。外观对话框底部带**实时预览**(改颜色/发光/粗细/阴影/图标即时反映最终行效果)。default 提交 = null 清除;删除条目 = setStyling(key, null)。
13. **设置入口只有一个:settings.plugin.item 卡片**(2026-08 已删除左侧导航 settings.section 注册;settings.section 相关纪律——store 传**共享 handle**(apply 创建一次的 viewStore,同 persist 名多个 handle 会交叉污染)、组件用 useStore 读 prefs/actions.setPref 写——对卡片同样适用)。
    - **settings.plugin.item 卡片**:`{name:'settings.plugin.item', key:'better-workspace', locale:NS, store:viewStore}`,渲染 **BetterWorkspacePluginCard**(与官方卡片一致的折叠卡:标题「更好的工作区」+ 一句话 desc + Chevron 头按钮,默认收起,展开才是 BetterWorkspaceSettings 内容;CSS .bw-plugin-card 镜像 PluginCard.module.css 的 token,已要求第三方插件卡片必须手写此 chrome——组件不可导入 ui-settings-plugins)。tab 只派发「宿主已服务命名空间 ∩ 卡片」——宿主不注册同名命名空间,卡片永远不出现。
    - **宿主命名空间 schema 必须用 @deepseek-ai/schemastery**:settings 服务把 schema 当**函数调用**(`schema(mergeLayers(...))`);schemastery 的 schema 可调用、传 undefined 补默认值;zod 对象**不可调用**,register() 抛 `TypeError: ... is not a function` 后命名空间从未服务(2026-08 实测根因,zod 版卡片死活不出的原因)。dsh-context / dsh-better-sidebar 同为 schemastery。src/index.js 用动态 `import('@deepseek-ai/schemastery')`(冒烟零依赖);runtime 解析走 profile 共享 fallback(已实测可解析)。
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
