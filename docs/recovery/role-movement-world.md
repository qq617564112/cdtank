# 原水平运动贯穿正式对局

完整拥有来源的正常角色现从属性重算结果读取move/turn与TankType，经已与原程序逐样本核对的水平数学、多点NAV和包装器执行实际运动。源look与forward向量逐tick保留，避免将两种方向合并。缺属性与VIP分支仍保留明确的原型回退，本片不宣称M2-03完成。

## 实际职责与数据合同

- `server/battle/movement.ts`组装属性、许可、时间、原NAV包装与姿态提交，作为CPU预测和实际步进的唯一接线；`battle/roles`保留原水平核函数。实际NAV步进预测不同于原动态OBB控制器的NULL地图预测。
- `battle/actors.ts`调度普通输入、运动和射击；CPU仍通过原有输入门禁。`bot-controller.ts`消费本角色速度/转速及同一路径位置预测，不直接改位置或伤害。
- `battle/player-state.ts`保存原向量和独立bodyYaw；`battle/start.ts`与`battle/life.ts`负责首局、再战、复活清理。
- `rooms/snapshot.ts`投影附加bodyYaw。`shared/protocols/MsgRoomSnapshot.ts`仅承载合同与生成schema；运动算法不进入shared。
- `web/render/battle-players.ts`将bodyYaw用于车体，炮塔相对角为yaw+aim-bodyYaw，保持当前正式射击世界角yaw+aim。旧快照无bodyYaw时回退yaw。

## 验收与复现

所有命令从仓库根执行，读取已导出的原属性/NAV取证产物。拥有来源是显式测试夹具，不给正式账户或CPU默认授予装备。

| 命令 | 本片结果与证据 |
| --- | --- |
| `npm run test:combat:movement-world` | 21战车、84次正常World输入步进，原重算参数与已native核对wrapper的水平位置/双向量一致；快照方向、运动拒绝仍可瞄准/射击、复活与再战清姿态、失效来源停用。真实Babylon NullEngine车体/炮塔世界向量、跨π与生命周期通过；movement-world-integration.log、world-role-movement.json |
| `npm run test:runtime:original-movement-two-rounds` | 所有角色显式完整原属性，五种模式各自然两局，普通AI/CPU移动/射击/命中、结算冻结、再战、治疗消耗与重启保存通过；original-movement-match.log/json |
| `npm run test:runtime:cpu-two-rounds` | 现有回退属性的五模式两局回归通过；movement-world-cpu-two-rounds.log，不能当原运动接线证明 |
| `npm run test:network`、`npm run test:runtime:account-textures` | 联机、账户迷彩事务与重启通过；movement-world-network.log、movement-world-accounts.log |
| `npm run test:combat:movement:browser -- "$CDTANK_CDP" --autopilot --reentry --hd --original-movement` | 自启3138/5193，两个真实账户显式完整属性，1920×1080正常网页两局自然结束56330/78860ms，同tick快照32/44次一致，每局两网页观察bodyYaw，治疗原Effect11/GA15、再战门禁、退出实例/声音归零及重启重进库存保留通过；movement-world-browser.log、browser-account-autopilot-hd-original-movement.json及截图。默认CPU来源仍不完整 |
| `npx tsc --noEmit`、`npm run test:architecture` | 全仓类型及223可达正式模块依赖边界；movement-world-types.log、movement-world-boundaries.log |
| `npm run build:server`、`npm run build:web`、`npm run test:server:compiled` | 独立两端发行构建与编译服务联机、账户重启/保存和五模式CPU两局；movement-world-{server-build,web-build,compiled}.log |

原模块对照细节见role-movement-modules.md。集成测试依靠已验证核函数核对接线，不将同实现的预测/提交比较冒称新增原程序oracle。

## 明确剩余与下一片

当前使用原角色构造49×52初始尺寸；后续resize及各车最终尺寸尚未证实。Y仍由重建NAV高度贴地，未复原斜坡/垂直后处理；动态角色OBB控制器尚未接入正式步进，完整地图loader/upstream选择与acos错误路径仍待恢复。相机/射击aim语义的全原链继续独立验收。

本片当时暴露CPU中心/20半径路线与实际49×52采样的差异，模式5部分AI后期停滞。后续已用同一原采样合同修复，并有窄口/墙角/普通撞墙拒绝及两局清完117目标的证据，见cpu-original-navigation.md。两局通过仍不证明全地图/全对抗模式导航质量；下一片接原动态OBB，恢复最终尺寸和垂直来源。不得通过缩小正式碰撞尺寸或绕过输入门禁使测试变绿。

本片数字对应movement-world独立日志；通用original-movement-match与浏览器JSON会由后续正式验收刷新，后续CPU路线片保存独立cpu-original-navigation产物。

原CDTank保持不变；完整复刻与M2-03仍未完成。
