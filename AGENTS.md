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
7. **词典纪律**:NS = betterWorkspace;zh/en 两个词典 key 必须完全对齐,且覆盖文件里每个静态 t(...) 调用——冒烟测试逐 key 校验。动态拼 key(如 time. + unit、status. + kind)的取值集合也要在词典里配齐。
8. **React 纪律**:纯 React.createElement;组件必须定义在模块层(内联组件定义会在父组件每次渲染时重挂载、丢输入状态);所有 hook 调用必须先于任何 early return。
9. **防御式边界**:primitives 图标/组件一律经 icon()/BTN() 特征探测降级,不硬崩;require 只允许基线(测试强制)。

## 已知限制(改之前先看是不是已排期)

- 工作区拖拽排序未接管(官方顺序仍存于宿主);树内按名称排序。
- 搜索是本地标题过滤,未接 session.search 宿主内容搜索。
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
