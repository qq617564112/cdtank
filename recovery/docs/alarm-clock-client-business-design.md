# 定时闹钟群体限制客户端业务设计与服务端实现合同

对应 M4-10-I3007、FUNC-03/04/05 及 M4-09。原表 item 3007 为 category 4、itemType 4、inventoryCategory 2、BattleUseMax 10，prices/getMethod 均为 0，Shop/CPU/trade 不可用，appearanceEffect 为 false；地面资源为 modelId 9、`Data/scnobj/00009/00009.glb`、`Data/scnobj/00009/00009.POL`、`Data/scnobj/00009/00009A.png` 与 icon 9。三个来源技能角色分别为 4024、4025、4026：均为 TriggerType 1、Target 3、Range 80、T 5，函数类型分别为 3、4、5。

## 终态流程

普通已合法 owned 实例沿现 category 4 快捷配置、`requestTrapPlacement`、`placeTrap`、`placeGroundTrap` 使用。服务端先完成 CAS 消费，成功后 owned 与本局数量各减 1，再创建 00009 地面对象。对象的显式地面期限为 60000 ms；到期、owner 死亡或 owner 退出时，未触发对象删除且不退款。零价不开放免费 BUY，不 gift，不 CPU 自动配给；普通取得来源和原 writer 未闭环，本设计只登记合法 owned 实例的既有放置 caller。

首个进入触发半径的合格敌方接触对象后，对象只处理一次并从地面列表移除。触发资格为对象未过期、owner 仍在房、接触者非 owner、alive、status 2，并按当前模式满足敌对关系。源表 Range 80 采用为 XZ 平面触发半径；Target 3 采用为触发瞬间当前房间全部真实 alive/status 2 敌方，触发集合不再按 80 距离过滤。mode 1–3 排除同队，mode 4–5 接受所有非 owner 的合格玩家。

## 权限与恢复

flags 9、10、11 是许可计数，不是约束叠数：初始许可 1，实际施加对应 lane 后扣为 0 以禁止该动作。现有状态已存在同类限制时，本次不叠加、不刷新原 deadline，也不重复贡献；其他 lane 未被限制时仍可新增。计数为 0 或 undefined 时跳过，不产生下溢；计数 2 扣为 1 时仍保留原许可。

move、turn、fire 三条 lane 分别对应 4024、4025、4026，实际成功时各自写入 `now + sourceT * 1000`，即源表 T 5 的 5000 ms 期限。到期或普通注射解除时，只恢复该 lane 自己的 1 份许可并删除该状态；其他来源或既有数值变更保持。目标死亡、复活、离房沿现三状态 reset；新 round 与结束沿 `clearGroundTraps` 清理地面对象和三条状态。已触发对象对其他目标造成的既有状态不因 owner 死亡或离房回滚。

## 表现与通知

每个实际成功的 lane 沿现有 `trapTriggered` 与 `playSkillEffect` 链发送首槽通知，`skillId` 为该 lane 的 4024/4025/4026，值为结算后的实际许可计数。已确认的首槽绘声为 4024 的 112/SE44、4025 的 115/SE47、4026 的 118/GA20，均为 effectIndex 0。move 的首槽仅在目标 `hp > 0 && !flag6` 时附加；turn 与 fire 仅在 `hp > 0` 时附加。第二槽的触发来源未恢复，因此不播放第二槽。

item 3007 自身三条 effects 全为零，`appearanceEffect` 为 false，所以放置阶段不发送 item placement `playSkillEffect`，也不把 primary 4024 冒充放置绘声；4024 只保留为对象身份元数据。实现未改 HP、伤害或原 actor 公式。

## 来源与 Web 采用

原字段事实包括 item 3007 的 category/itemType/inventoryCategory/BattleUseMax、零价格、Shop/CPU/trade 不可用、modelId 9、三个技能角色 4024/4025/4026，以及三技能各自的 TriggerType 1、Target 3、Range 80、FuncType 3/4/5、T 5 和首槽 effect/sound。以下业务解释是明确采用：TriggerType 1 采用为首个合格敌方接触触发；Range 80 采用为接触半径；Target 3 采用为触发瞬间的全部合格敌方；T 5 采用为 5000 ms 限制期限；60000 ms 采用为 Web 地面对象期限；owner 死亡/退出时删除未触发对象且不退款。原 writer、原 group dispatcher 和第二槽触发未取得，不把这些采用写成原枚举或原生命周期已恢复。

现有 `GroundTrapsPresentation` 与 `ContentItemVisual` 以数值 itemTableId/modelId 读取内容定义，00009 模型沿通用定义展示；现有 `PlaySkillEffect` 按 skillId/effectIndex 查表，无需新增 UI consumer、schema、API 或协议字段。

## 限制

完整原 source writer、普通取得来源、原 group dispatcher、第二槽触发、网页联机与 HD 重启尚未实测或恢复，M4-10-I3007、FUNC-03/04/05、M4-09 及父项保持未勾。3006 对 4027 的独立缺引用继续保留，不猜填 4027，也不因该缺口阻断 3007 的客户端业务还原。
