# 分层验收命令

E-06按运行规则、网络确认、浏览器交互、原程序取证和渲染夹具组织验收入口。现有专题命令保留，便于复现各专题记录中的独立结论。各组串行执行，首个失败即停止；网络与浏览器组使用固定端口，不应与同一夹具或独立服务并行运行。

## 环境和数据

从仓库根目录执行命令，先运行`npm ci`。运行和网络组使用支持`node:sqlite`的Node版本（验收环境为Node 22及以上），读取已经导出的`recovery/output/web-assets`与`recovery/output/verified/tables`。账户测试创建临时SQLite数据库，不修改开发账户库。

取证组另需`recovery/.venv/bin/python`及其恢复依赖、`CDTank/`原程序和已经导出的资产目录。浏览器和渲染组使用导出的网页资产；浏览器组另需启用CDP的Chromium及可用WebGL。资产恢复是准备步骤，验收命令不自动运行`npm run assets`。

## 五个入口

| 命令 | 验收内容 | 依赖和产物 |
| --- | --- | --- |
| `npm run test:acceptance:runtime` | 模块边界、账户持久化/隔离、规则/地形/导航、战斗与道具、CPU及五种模式各两局 | 无HTTP/WebSocket服务；CPU记录写入`recovery/output/autopilot-match.json` |
| `npm run test:acceptance:network` | 普通双连接、账户/装备保存并重启、账户CPU接管和道具广播、治疗道具、贴图选择确认 | 自启并关闭临时服务，依次使用3109、3129、3139、3137、3018；结果写入`recovery/output` |
| `npm run test:acceptance:browser -- '<Chromium CDP WebSocket URL>'` | 账户贴图选择/保存/重启、治疗道具、CPU接管及拥有贴图两局/重进 | 调用方提供Chromium；各测试自启服务和Vite，使用3019/5200、3138/5193；保存浏览器JSON与截图 |
| `npm run test:acceptance:evidence` | 拥有贴图与请求传递、角色姿态命令、原程序Ready规则、711条贴图目录比对 | 执行原程序取证与对应重建规则；读取原程序和导出资产 |
| `npm run test:acceptance:render` | 玩家与目标资源生命周期夹具及七个独立渲染入口构建 | `test:render:players`用NullEngine/延迟加载检查跨会话、选择替换与释放；输出到`dist/validation/`的七入口仅验证构建，像素和交互由下表浏览器命令验证 |

这些入口是明确列出的工程回归组。专题里的完整原程序取证、全部地图与性能扫描仍使用各自命令，按改动选择执行。

## 独立运行和网络入口

| 命令 | 范围 |
| --- | --- |
| `npm run test:runtime:accounts` | 账户库存、拥有角色、资料、装备、CPU接管、贴图购买与战斗来源；不启动网络服务 |
| `npm run test:runtime:rules` | 玩法、房间、战场表面、导航和头像状态 |
| `npm run test:runtime:combat` | 角色战斗状态/世界行为、道具请求、治疗和战斗技能效果 |
| `npm run test:runtime:cpu-two-rounds` | 五种模式各两局、CPU射击/命中/死亡/复活、道具库存和重进 |
| `npm run test:combat:movement-obb` | 原OBB核/矩阵预测/控制器筛选/命令停止/重叠分离逐层原oracle及TS；不等于完整正式运动完成 |
| `npm run test:combat:movement-dynamic-world` | 完整来源四人正常World出生分离、动态拒绝/普通倒退/独立瞄准开火及既有水平/墙角回归 |
| `npm run test:combat:movement-world` | 21辆完整原属性战车经正常World输入的水平运动接线、方向快照/渲染及生命重置；需要既有原属性取证产物 |
| `npm run test:cpu:original-navigation` | 原采样窄口/绕行/缓存隔离、12次原离散转向与实际NAV墙角普通输入、既有CPU射击协调回归；CPU聚合入口也包含新门禁 |
| `npm run test:runtime:original-movement-two-rounds` | 显式完整原属性的所有参与者，五模式普通AI/CPU各自然两局，消费与重启保存；不授予正式默认装备 |
| `npm run test:network:accounts` | 3129端口，两个账户连接、确认广播、保存/重启 |
| `npm run test:network:autopilot` | 3139端口，账户接管、道具广播、重启恢复 |
| `npm run test:network:textures` | 3018端口，选择/价格/购买/保存确认和重启恢复 |
| `npm run test:network:compiled` | 先独立构建服务端，再从临时cwd运行编译产物，复用账户和贴图网络验收及五种模式两局；使用3129和3018 |

历史`test:accounts`、`test:cpu:autopilot`和`test:runtime:account-textures`包含运行测试及网络测试，继续保留其原执行顺序。需要只验证运行规则时选择上表的新入口。

## 浏览器夹具

CDP参数是浏览器调试WebSocket地址，例如`ws://127.0.0.1:9222/devtools/browser/<id>`，可从Chromium调试端口的`/json/version`响应中取`webSocketDebuggerUrl`。它不是游戏服务器地址。聚合命令把同一个地址传给每个专题；调用方在整组完成后关闭Chromium。

`npm run test:match:input:browser -- "$CDTANK_CDP" [origin]`检查生产输入owner的独立诊断实例：真实键盘/控件焦点/计时，window blur为显式合成事件；正式网络输入另由两局浏览器验收证明。`npm run test:render:targets`检查真实NullEngine目标/VIP几何/材质/释放与原placement隔离。

可单独运行：

```bash
npm run test:tanks:textures:selection:browser -- "$CDTANK_CDP"
npm run test:combat:healing:browser -- "$CDTANK_CDP"
npm run test:cpu:owned-textures:browser -- "$CDTANK_CDP"
npm run test:combat:movement:browser -- "$CDTANK_CDP" --autopilot --reentry --hd --original-movement
npm run test:combat:healing:browser -- "$CDTANK_CDP" --reentry --hd
npm run test:combat:healing:browser -- "$CDTANK_CDP" --effect-only --hd
```

这些测试在正常执行和断言收尾时关闭自身的游戏服务与Vite，并删除临时账户库。`test:rooms:ready-team:browser`另有完整自启Chromium夹具，无需CDP参数，使用3020、5203和9256端口；通过`CDTANK_CHROME`指定本机Chromium路径。旧`test:browser`、房间/战斗/HUD等浏览器专题仍保留，所需服务和夹具以各专题文档为准。

## 渲染入口和浏览器验证

先在一个终端运行所需开发入口，再在另一个终端向专题浏览器测试传入CDP地址。测试使用下表默认URL，也可通过对应`CDTANK_RENDER_*_URL`环境变量覆盖；浏览器测试不会启动或关闭开发入口。

| 开发入口 | 默认端口 | 浏览器命令 |
| --- | --- | --- |
| `npm run render:model:dev` | 5204 | `npm run test:effects:model:browser -- "$CDTANK_CDP"` |
| `npm run render:bolt:dev` | 5205 | `npm run test:effects:bolt:browser -- "$CDTANK_CDP"` |
| `npm run render:effect:dev` | 5206 | `npm run test:effects:browser -- "$CDTANK_CDP"` |
| `npm run render:particle:dev` | 5207 | `npm run test:effects:particles:browser -- "$CDTANK_CDP"` |
| `npm run render:overlay:dev` | 5208 | `npm run test:effects:overlay:browser -- "$CDTANK_CDP"` |
| `npm run render:skill:dev` | 5209 | `npm run test:combat:effect-runtime:browser -- "$CDTANK_CDP"` |
| `npm run render:shake:dev` | 5210 | `npm run test:effects:shake:browser -- "$CDTANK_CDP"` |

浏览器验证结束后关闭开发入口。开发页位于`tests/render/`，发行客户端使用`build:web`，渲染验收产物位于`dist/validation/`。

## 专题取证和较长扫描

`test:effects`、`test:effects:model`、`test:combat:health`、`test:combat:inventory`等专题同时执行原程序取证和重建规则比对，仍按专题维护。`test:evidence:tank-textures`汇总拥有贴图和传递链；`test:combat:pose-source`保存角色姿态取证；资产专题仍通过`test:assets:*`复现。

`npm run test:combat:configuration`从recovery/evidence/inventory执行原背包配置native及wire/规则CTS；真实账户请求和对局确认在server所属模块，生产无需执行该取证命令。迁移证据与原规则边界见kitbag-configuration.md。`test:combat:effect-messages`同样从evidence/skills执行Play/Stop原包与消息/队列native，随后验证实际生产通知和队列；共同Play/Stop类型归MsgRoomEvent，迁移/通信兼容证据见skill-effect-wire.md。库存record/query/deletion原包及三组native/CTS现由evidence/inventory执行，专题入口test:combat:inventory保持原顺序；共同记录归PtlInventory，双端查询规则仍为shared唯一实现，证据见inventory-wire.md。

`test:combat:profile`从evidence/roles执行原profile确认/更新/3aac wire对照；原外观native/CTS也已迁该目录并由test:combat:equipment执行。内部profile及实际装备外观写入归server/accounts/profile，正式服务无需原程序对照，验收见engineering-profile-boundary.md。

`test:combat:equipment`的槽数/装入/错误/卸下四组native/CTS现从evidence/roles执行，实际三规则归server/accounts/equipment；PtlEquipment不变，证据见engineering-equipment-boundary.md。

原tank/pet请求及selection-callback native同样从evidence/roles执行，test:combat:equipment已更新；实际已选角色reader归server/accounts/profile/selection，原setter仅供取证。正常网页账户选择与保存由browser-home-roles另验证，证据见engineering-role-selection-boundary.md。

原owned pair/receive native及CTS从evidence/roles执行；test:combat:health已更新，pair仍runpy底层recovery/evidence/roles/role-owned-equipment-native.py。AccountStore/World/BattleRoleSources消费server拥有来源契约；原decoder仅供测试数据显式导入，所有网络/browser fixtures使用新路径，证据见engineering-owned-receive-boundary.md。

Owned装备record/batch native及CTS从evidence/roles执行，pair runpy也指向迁移后的同目录native。新shared/contracts/owned-equipment只有唯一Map记录类型，正式账户和现有纹理/计算消费该类型；原decoder不进入发行，证据见engineering-owned-equipment-boundary.md。

Owned基础记录native/CTS也已迁evidence/roles；test:combat:health保持base→equipment→pair依赖顺序与原oracle路径。shared/contracts的两个owned记录纯类型与evidence全部原消息解码已分离，实际账户/对局技能来源仍用生产规则；证据见engineering-owned-base-boundary.md。

Owned定义解析native/CTS归evidence/roles，test:combat:health保持原入口顺序和pet/tank原表oracle依赖；正式解析由server/accounts/owned/definition唯一承担。原对照覆盖1984组合，账户授权/已选角色入场及重算由account-role-profile、account-battle-role-sources、role-recompute和正常roles页面另验，见engineering-owned-definition.md。

原recompute来源选择native/CTS已迁evidence/roles，test:combat:health使用新入口；原96阶段选择另验账户持久来源。实际selector归accounts/owned，battle/roles承担部件实例到表定义与属性/投影共用技能来源读取。account-battle-part-definitions、role-record-defaults与完整role-recompute分别验证真实部件/字段/属性链，见engineering-role-source-assembly.md。

原战车/宠物表base native/CTS归evidence/roles，test:combat:health入口已更新；输出oracle路径不变，owned-definition与table-binding/recompute仍依赖原表结果。正式config实际loader归server/config/role-base，CTS同时检查原字段与正式TANKS/PET_BASES；World完整属性另用world-role-attributes验，详见engineering-role-base-loading.md。

迷彩共同确认type归shared/contracts/tank-textures，Ptl schema生成已接通；test:combat:texture-selection仍验证唯一evidence原codec和实际server费用/确认规则。test:accounts:tank-textures检查SQLite事务、test:tanks:textures:network检查双连接等待同步/战斗拒绝/重启，正常选择页面用test:tanks:textures:selection:browser，见engineering-texture-change-boundary.md。

完整属性计算七组native/CTS已迁evidence/attributes，test:combat专题入口更新；完整native依赖base runpy和data-scale源码路径、World属性native的runpy也接通新路径，oracle输出不变。正式计算归server/battle/roles，共同基表与技能目录type归shared/contracts；test:accounts:sources和test:combat:world-attributes检查真实准备/冻结/再战及开局属性，见engineering-attribute-chain.md。

角色状态/默认值与普通开火装填/瞄准归server/battle/roles。test:combat:state/reload/fire-reload/bullet-receive/ammo-observer/selection/change/receive/free-fire/defaults/bullet-count的原命令保持，CTS消费唯一正式规则和evidence/roles codec/通知；numeric接收不进入正式状态类。实际World生命周期和完整属性另验，见engineering-role-lifecycle.md。

其余原消息helper归evidence/combat，既有health/use/death/tracks/spatial/ammo等专题命令保持，CTS按唯一新入口执行；markDirty实际归server/battle/roles，扫描/字节比较只供原消息取证。entity-fire、shot-wire和item-resolver单项见engineering-e04-evidence.md，正式World与运行依赖门禁另验。

全地图CPU覆盖使用`test:cpu:all-maps`和`test:cpu:maps`，实时目标扫描使用`test:cpu:objectives`，性能记录使用`test:cpu:queries`和`test:cpu:profile`。它们的运行成本和断言范围与上述工程回归组不同，应按专题验收记录运行。

## 限制

渲染构建通过只说明夹具可以打包；视觉正确性需要对应浏览器断言。浏览器组需要有效CDP连接和空闲夹具端口；在服务启动或CDP连接阶段异常退出时，应检查该夹具进程是否仍在运行。网络/浏览器/CPU测试写入共享的`recovery/output`记录，同一专题应串行运行。

## 工程化迁移验证记录

运行账户与真实托管网络分组已通过（engineering-acceptance-accounts.log、engineering-acceptance-autopilot-network.log），战斗分组通过（engineering-acceptance-combat.log）。缺失CDP参数在启动服务前退出，使用提示见engineering-acceptance-browser-usage.log。真实浏览器总入口记录在engineering-acceptance-browser.log；各夹具仍保存自己的专题JSON。独立渲染构建及像素结果见engineering-render-entries.md，编译服务/CPU两局见engineering-shot-compiled.log。

浏览器总入口实际执行通过：迷彩选择费用/保存/拒绝/重启与清理、双网页治疗自然两局及一致结算/再战冻结、拥有迷彩的CPU托管自然两局与服务重启后重新进入。库存/快捷槽保持、原Effect11/GA15与释放检查均通过；记录engineering-acceptance-browser.log及browser-account-autopilot-owned-textures.json。E-06命令组织与这些迁移回归已验收；完整复刻仍按tasklist各项执行。

## 独立资源查看工具

`npm run tools:assets:dev`启动本地5211工具，`npm run tools:assets:build`输出dist/tools/asset-viewer；不进入正式Web部署。`node tests/browser-scenes.mjs <CDP浏览器WebSocket> [工具origin]`默认为5211，需先启动工具，覆盖三地图矩阵/实际顶点与画面记录。`node tests/browser-tank-actor-clock-sol.mjs <CDP>`自启工具5202并清理，需既有原时钟取证JSON。正式对局夹具不再等待模型查看器目录。详见engineering-asset-tool.md。

认证连接时序单项：`npm run test:network:connection`，已并入`test:acceptance:network`。它使用可控运输返回和内存token检查共用认证、关闭等待、重复退出、取消及迟到响应隔离，不声称真实socket验收；真实账户与连续两局仍由网络/浏览器夹具验证。

房间消息单项：`npm run test:match:feed`已并入network分组。它验证当前房间过滤、快照提交前后调用顺序、事件上下文、切房/退出清理，不验证服务器玩法。生产Battle清理/事件顺序及原死亡复活由`tests/browser-life.mjs`真实消息分派夹具覆盖，自然对局仍由双网页夹具覆盖。

首件饲料专题：`test:combat:healing`验普通施放/拒绝/事务消费与CPU两局；`test:combat:healing:network`验真实双连接满血拒绝/同tick状态/旧序列/重启；`test:combat:healing:effect`验原Effect11树/活tag0/几何及四种释放。浏览器`--reentry`在两局与重启后继续验证剩余1份再入房普通使用1→0并再次重启；`--effect-only`只跑普通施放、两端真实挂点/声音/自然到期与退出释放，不声称两局或持久化。本轮按M1-09-B/M1-12-B/M1-13-B业务子项验收，原服务端缺失范围保持父项未完成。
