# GitHub 开源游戏 AI 替换调研

## 结论

本项目已有可运行的服务端 CPU 与托管 AI。它们都通过 `BotController.input()` 产生普通 `MsgPlayerInput`，再由权威战斗循环处理移动、碰撞、射击、伤害、道具和存档规则。现有控制器不是一个可以直接替换的“寻路模块”：它还处理目标分配、模式 2 城堡和模式 5 破坏目标、友军挡线、固定炮塔、反应/扳机延迟、隐身、VIP 回避、脱困以及 13 类战斗道具。

因此，外部项目不能直接替换整套 AI 并保留现有玩法。当前已接入 **Mistreevous** 作为短时战术意图层：保留 `BotController` 的战斗执行和 `BotPathPlanner` 的权威移动边界，只让行为树选择撤退、脱困、目标推进、接近或交战。若要重做目标评估和感知，再评估 **YUKA**。行为树不会自动提高命中率或战术质量，需要用本项目的地图、坦克和模式数据编排节点。

## 本项目的接入边界

- [BotController](../../apps/server/src/battle/cpu/controller.ts#L59) 的 `input()` 接收 actor、其他参与者、目标快照、`Battlefield`、模式、时间步长和道具上下文，返回一个 `MsgPlayerInput`。
- [MsgPlayerInput](../../apps/shared/protocols/MsgPlayerInput.ts#L14) 同一帧可同时表达 `move`、`turn`、`aim`、`fire` 和一个 `useItem` 请求。行为树若把攻击、撤退、治疗做成互斥长动作，会错误地让坦克完全停止开火或错过道具时机。
- [advanceActors](../../apps/server/src/battle/actors.ts#L121) 在每个服务端 tick 调用控制器；服务端默认 20 tick/s。CPU 和托管共用这条路径，控制器只产生输入，不直接修改世界。
- [BotNavigationPolicy](../../apps/server/src/battle/cpu/navigation.ts#L10) 只有 `cacheKey`、`canTraverse` 和 `reachable`。正式原运动导航使用 49×52 的车体尺寸，每 6 个原单位采样，路径搜索每次最多 256 次展开且约 2 ms 预算。任何通用寻路库都必须适配这个合同，不能把自己的 agent 位置直接写回战场。
- 项目原创代码使用非商业研究许可（根目录 `LICENSE` 明确声明不是 OSI 开源许可）。引入外部库必须保留其版权和许可证；GPL 游戏代码不能因为本项目公开可见就视为兼容。

## 候选比较

| 项目 | 能解决的问题 | 许可证/维护证据 | 对本项目的适配判断 |
| --- | --- | --- | --- |
| [Mistreevous](https://github.com/nikkorn/mistreevous/tree/026f1ffe062309decda6059bb15430a73fc89f67) | TypeScript/JavaScript 行为树、组合节点、条件和 guard；固定版本 package.json 声明 Node 和浏览器支持，主入口为 CommonJS `dist/index.js` | 固定 HEAD `026f1ffe062309decda6059bb15430a73fc89f67`；GitHub 源码调查显示实际提交 2026-08-07，存在 v4.3.1 标签。仓库 LICENSE 为 MIT | **首选高层决策层**。节点应每个 tick 或短动作完成后重新选择意图；长时间 RUNNING 节点必须显式处理目标死亡、模式结束和导航失败 |
| [YUKA](https://github.com/Mugen87/yuka/tree/10591304811222d6856020d5de129b39ef43b58d) | JavaScript 游戏 AI 的 steering、感知、entity manager、goal/think 和状态组织；固定 package.json 版本为 0.7.8 | HEAD `10591304811222d6856020d5de129b39ef43b58d`；实际最新提交为 2023-01-16，不能用 GitHub 页面推送时间推断仍在维护；仓库提供 MIT 许可证 | **第二选择**。适合重做感知/目标评估，但其 Think 不会每帧自动重新仲裁，且 steering 产生连续运动，需转成项目离散 `move/turn` 并复用权威预测 |
| [recast-navigation-js](https://github.com/isaac-mason/recast-navigation-js/tree/8769e8b9995f127033af9f6e6eeac3fad7d66201) | Recast/Detour 的 WASM 导航网格、`NavMeshQuery.computePath`、Crowd agent、临时障碍物；支持 Web 和 Node | HEAD `8769e8b9995f127033af9f6e6eeac3fad7d66201`，实际提交 2026-02-04，版本 0.43.1；JS 包和其 WASM 许可证为 MIT，底层 Recast/Detour 为 zlib | **导航专项备选，不是 AI 替换**。需要把现有 NAV/地形导出为 positions/indices，异步 `init()` 和 ESM/WASM 运行时也要接入；Crowd 的位置、速度和避障不能绕过服务端坦克碰撞与垂直物理 |
| [behavior3js](https://github.com/behavior3/behavior3js/tree/31fd3bf634eae9722967b4cded4534ed50aff5fe) | 经典行为树编辑/运行模型 | HEAD `31fd3bf634eae9722967b4cded4534ed50aff5fe`，实际代码提交 2018-10-21 | 可作概念参考；维护年代和运行模型不如 Mistreevous，迁移收益不足 |
| [esengine/BehaviourTree-ai](https://github.com/esengine/BehaviourTree-ai/tree/ceea6339cb1fa994cc280dd18c23b13abdaa46c4) | TypeScript 行为树、Utility AI、FSM 的组合库，面向 Cocos/Laya | HEAD `ceea6339cb1fa994cc280dd18c23b13abdaa46c4`，GitHub 标注 MIT | 可作中文生态参考；需要先核对 Node 服务端的运行时和 API 稳定性，暂不优先于 Mistreevous |
| [Unity ML-Agents](https://github.com/Unity-Technologies/ml-agents/tree/ced666f054af966a0c9c29769783bf72338cc5a0) | Unity 环境中的强化学习训练、推理和示例 | HEAD `ced666f054af966a0c9c29769783bf72338cc5a0`；Python/Unity 工具链，许可证与仓库 LICENSE 为准 | **不能直接替换**。本项目是 Node 服务端、非 Unity 环境；需要另建训练环境、观测/动作协议和模型推理服务，适合长期实验而非当前接入 |
| [OpenRA](https://github.com/OpenRA/OpenRA/tree/e180e3225f3930272dd451917467631618f8976f) / [BZFlag](https://github.com/BZFlag-Dev/bzflag) | 完整 RTS/坦克游戏中的单位 AI、地图和战斗代码，可借鉴目标和编队思路 | OpenRA HEAD `e180e3225f3930272dd451917467631618f8976f`；两者均是完整游戏代码，许可证分别以各仓库 LICENSE 为准（OpenRA 为 GPL 系列） | **只做设计参考**。引擎、单位状态、网络和许可证边界都不同，移植完整 bot 会把 GPL/引擎依赖带入本项目，不能作为 npm 依赖替换 |

## 接入后的实现与后续方案

1. `apps/server/src/battle/cpu/tactical.ts` 使用 Mistreevous 的短动作树；每个 `BotController.input()` 都重置并重新评估存活、威胁、目标类型、可见性和上一帧阻塞状态。节点只写入意图并立即完成，避免保留过期的 RUNNING 分支。
2. `BotController` 的输入输出合同、普通战斗 authority、`BotPathPlanner`、原 NAV 采样和所有道具 handler 保持不变。行为树不直接修改位置、伤害或库存。
3. 移动意图继续使用权威的 5–8 号移动加转向弧线命令。控制器不再把转向时的 `move` 清零，也不再在预测失败时盲目改成直行或倒车；前进/倒车选择保留滞回，路线被碰撞拒绝时由现有阻塞检测重新规划。
4. 后续若需要更自然的感知和多目标评分，再引入 YUKA 的 goal/steering 子集。不要让 YUKA 的连续 steering 直接改写位置；它只能建议离散命令或候选 waypoint，最终仍调用本项目的 movement predictor 和碰撞规则。
5. 只有在确认当前 NAV 数据可稳定转换为三角网格、并能在服务端预生成/缓存网格后，才做 recast-navigation-js 原型。它是寻路替换项目，需要单独处理 ESM/WASM 初始化、网格版本和 49×52 车体 footprint，不应与决策层替换混在一个改动里。

## 已知限制

本调研核对了 GitHub 仓库、固定 commit 的 README/源码和许可证入口，以及本项目当前源码接口；没有安装候选依赖，也没有执行构建、测试、浏览器验收或实际对局对比。因此表中的“首选”表示接口和维护风险的判断，不表示外部库已经在本项目中运行或证明了更高胜率。GitHub 的 pushed-at 时间可能晚于实际 HEAD 提交，维护判断以固定 commit 的提交时间为准。
