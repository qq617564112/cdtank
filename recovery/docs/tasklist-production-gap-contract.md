# 当前 tasklist 生产入口与战车装饰采用合同

本文按 `/workspace/cdtank` 的 main actual 核对 M2-04、M2-05、M4-03、M6-01
原文及直接链接，不把 `recovery/evidence` 中的独立对照模块误当成生产入口。

## 五候选核对

| 候选 | 当前正式入口与消费者 | 来源边界 | 结论 |
| --- | --- | --- | --- |
| M2-04 原弹丸与命中 | `battle/actors.ts` 的普通 fire 延后到 `fireProjectile`；`battle/projectiles.ts` 对 instant/穿障弹完成玩家、目标和场景端点分派，非即时弹进入 `advanceProjectiles`；World 同时接命中、场景破坏和终局 | 现有正式链是即时命中、目标查询和 server 权威命中。原速度、寿命、轨迹、炮口及全部弹种参数仍属原等价/实测，不把旧 360/2.2 原型复活为新的 flight | 已有普通 production 入口，不重写 |
| M2-05 死亡后续 | `battle/life.ts` 的 `damagePlayer` 在归零后完成 `finalizePlayerDeath`、状态3、死亡事件和 `respawnAt`；World 已消费该结果 | `recovery/evidence/combat/role-death-followup.ts` 是原 `423157` 对照模块，当前 main 没有把它 import 到 World。生产死亡业务不因未导入该独立模块而消失 | 仅原调用序列等价/后续实测，不重接重复死亡链 |
| M2-05 本机死亡计数 | `interface/battle/battle-hud.ts` 从权威 `alive/respawnAt` 生成显示值，`match/battle.ts` 消费显示变化触发计数音效；`LocalDeathCountdown` 保留客户端调度合同 | `role-death-runtime-bridge.ts` 只在 evidence 中，原 scheduler、当前状态类型和三个 observer 的完整等价仍未验。现有 Web 用户入口已存在 | 仅原 runtime 等价/页面实测，不改正式复活授权 |
| M6-01 拥有战车纹理 | `accounts/tank-shop.ts` 的 BUY 写默认 U/M/XY 到 `0x28/0x2c/0x30`；`accounts/tank-texture-change.ts` 与 `account-store.ts` 完成确认、扣费、状态和持久化；shared reader、snapshot、TankView 与 Home 预览均已消费 | 原属性32 producer、特殊车型和完整原商店事件仍可能未知，但这些不等于当前购买或换色缺少 writer/入口 | 已有完整普通购买、配置和显示入口 |
| M4-03 role array | `RoleCombatState` 建数组0/1/2/4；`battle/preparation.ts` 绑定快捷槽与部件；`battle/attributes.ts`、`roles/skills.ts`、`rooms/snapshot.ts` 消费当前技能、部件和快捷槽；标记从 profile 独立读取 | `recovery/evidence/combat/role-array-property.ts` 证明原 544c70/544950 编解码，当前 main 的普通生产链直接绑定账户确认结果。完整原网络接收/施放仍未验 | 已有实际 production 消费者，只余原 wire/World 组合等价 |

以上五项都不应再新增一套同名入口。本批采用 M6-01/M6-03 仍有明确缺口的一项：
**我的家已确认装备的装饰物，在普通战斗房间实际骑乘/炮塔模型上显示。**

## 选择依据

普通玩家入口已经真实存在，不需要伪造奖励、购买或新物品：

- Home “战车部件”面板已有“装饰”槽，候选来自账户实际拥有库存。
- Web 通过既有 `ReqEquipment {operation:'EQUIP', target:'DECORATION', instanceId}` 提交。
- Server 按账户、战车实例、库存归属、`ownedQuantity` 和 `equipmentTarget` 校验；确认回包为
  `ResEquipment.decorationInstanceId`。
- 持久槽是原资料 selector44，`readRoleProfileCosmetics` 固定读取 `payload+0x118`；替换/卸下由
  `AccountTankEquipment` 和现有 profile writer 原子保存。`+0x118` 只作为账户资料声明和持久来源，
  不作为战斗拥有战车记录字段。

战斗表现输入在现有 `playerSnapshot` 上补公开模型身份：当前
`player.ownedRoles.equipment().decorationInstanceId` 提供确认槽，已有
`appearanceInstanceId` 仅用于 `isAppearanceEffectItem` 的被动外观效果选择，不能替代模型装饰。
本片采用“已确认装饰槽 -> 房间公开描述 -> 双方 TankView 挂点”的普通消费者。

## 客户端通信采用合同

不新增 endpoint、不新增购买或奖励。沿用现有 Equipment 请求/确认：

```ts
interface ReqEquipment {
  operation: 'QUERY' | 'EQUIP' | 'UNEQUIP';
  target?: 'PART' | 'DECORATION' | 'MARK';
  instanceId?: number;
  tankInstanceId?: number;
}

interface ResEquipment {
  decorationInstanceId: number;
  // existing slots, bindings and profile remain unchanged
}
```

房间快照只增加公开模型身份，不暴露实例归属或资料字节：

```ts
interface TankDecorationSnapshot {
  itemTableId: number;
}

interface PlayerSnapshot {
  decoration?: TankDecorationSnapshot;
  // existing tankId, tankTextures and battle fields remain unchanged
}
```

Server 产生 `decoration` 的唯一条件是：当前战车确认资料
`player.ownedRoles.equipment().decorationInstanceId` 指向本房间库存中的实例，实例
`state===2`、`ownedQuantity>0`，
且共享 item 定义的 `equipmentTarget==='DECORATION'`。不满足时字段缺失，不发空对象，
不发占位模型。
手工 schema117 中 `PlayerSnapshot.decoration` 为 property id48，公开对象仅含
`TankDecorationSnapshot.itemTableId`（id0）；既有字段编号保持不变。

Web 以 `itemTableId` 查同一共享 item 定义：

- `runtime.equipmentGroup==='hat'` 且 `resources.model` 非空的物品，加载
  `resources.model`，存在 `resources.texturePath` 时加载该纹理。
- 挂点取 `effects[0].tag`，仅接受现正式
  `TANK_DECORATION_TAGS` 索引 `0..3`，依次对应
  `tag_iteye/tag_itwing/tag_ithat/tag_itside`。
- `17031`–`17036` 这类 `appearanceEffect:true`、`resources.model:null`、`tag:-1`
  的物品继续只走既有被动效果队列，不加载网格，也不借用帽子模型。
- 共享定义所给模型、纹理或挂点不合法时显式失败并清理由本次加载创建的对象；不换成其它
  饰品、不改图、不退回本地伪模型。

`PlayerSnapshot.decoration` 缺失时，当前玩家无装饰网格；这表示权威确认槽为空或不可公开，
不是 catch 文件缺失后的 fallback。

## Web 消费与 async owner

`BattlePlayers` 在 `TankView.load` 成功后消费权威快照：

1. `sameSelection` 除 `tankId/tankTextures` 外比较 `decoration.itemTableId`；同一玩家换装饰时
   先释放旧 owner，再加载新模型。
2. 新增 `BattleTankDecoration` owner，直接在 `TankView.root` 下建立 anchor，逐帧调用
   `view.decorationTag(tag)` 取得本模型 native 挂点矩阵。该实现复用现有 Home
   `HomeTankDecoration` 已采用的转换：矩阵索引 `1/2/3/4/8/12` 取反，再乘
   `TankView.root.getWorldMatrix()`。
3. 模型 owner 持有 `AssetContainer`、anchor、纹理和 `onBeforeRenderObservable` 回调。
   纹理在 `new Texture(...)` 创建后、加载 await 前立即登记到 owner；此时 owner dispose
   已能立即释放加载中的纹理。
   `clear()`、玩家移除、离房、换局或场景 dispose 时全部释放；加载晚返回若 generation、
   player 或 `decoration.itemTableId` 已变化，立即 dispose，不重新挂接。
4. 装饰物跟随本模型原挂点矩阵和现有 `TankView` 位置、旋转；不改变战斗碰撞、NAV、
   炮口或伤害。

Home 预览现有 `HomeTankDecoration`、`HomeEquipmentPreview` 和 “装饰”槽不改行为，可以作为
同一模型/纹理/挂点合同的已接参照。若实现方选择提取公共 Web attachment，只能做机械复用，
不得改动 Home 确认、槽位、分类或持久化语义。

## 直接来源

### 请求、确认与持久槽

- `apps/shared/protocols/PtlEquipment.ts`
- `apps/server/src/accounts/api.ts`
- `apps/server/src/accounts/tank-equipment.ts`
- `apps/server/src/account-store.ts`
- `apps/server/src/accounts/profile/cosmetics.ts`
- `apps/web/src/interface/home/home-equipment.tsx`
- `apps/web/src/interface/home/home-equipment-source-list.tsx`

### 模型、纹理与挂点

- `apps/shared/combat/equipment-target.ts`
- `recovery/output/web-assets/Data/accessory/10001/10001.glb`
- `recovery/output/web-assets/Data/accessory/10001/10001A.png`
- `apps/shared/content/definitions/items/10001.json`（原 `tag:2`）
- `apps/shared/content/definitions/items/10002.json`（原 `tag:2`）
- `apps/shared/content/definitions/items/10001.json` 至 `10040.json` 中
  `runtime.equipmentGroup==='hat'` 的已解析条目
- `apps/web/src/assets/tanks/tank-view.ts`
- `apps/web/src/interface/home/home-tank-decoration.ts`
- `apps/web/src/interface/home/home-equipment-preview.tsx`

### 房间投影与正式战斗消费者

- `apps/shared/protocols/MsgRoomSnapshot.ts`
- `apps/server/src/rooms/snapshot.ts`
- `apps/web/src/render/battle-players.ts`
- `apps/web/src/render/battle-tank-decoration.ts`（新 consumer owner）

## 精确 owned 划分

| 划分 | 文件 | 合同 |
| --- | --- | --- |
| core | `apps/shared/protocols/MsgRoomSnapshot.ts` | 只加可选 `PlayerSnapshot.decoration.itemTableId`；保留所有现有字段 |
| core | `apps/server/src/rooms/snapshot.ts` | 从确认槽、房间库存和 `state2/ownedQuantity` 产生公开身份；保留 `appearance` 的被动效果语义 |
| Web consumer | `apps/web/src/render/battle-players.ts` | selection identity、加载/替换/清理和 generation 隔离 |
| Web consumer | `apps/web/src/render/battle-tank-decoration.ts` | 模型/纹理/挂点/逐帧矩阵 owner |
| UI | 无新增 | Home 请求、确认和装饰槽已接；不新增第二套 UI 或协议 |
| source | 本文件 | 只记录采用合同、来源事实和待验边界 |

## 真实剩余限制

- 当前没有执行网络、浏览器、构建、类型检查、native 或生成器；本文只固定生产合同。
- 本批集中静态走查已完成。
- 原完整装备装饰物的 3D 挂点像素、全部 hat/多部件车型组合、双方远距离观察、死亡/复活/换图
  时模型切换和高清性能仍需实际对局验证。
- 原客户端完整 attach callback、GPU/像素精度及全部原装备分类未恢复；本片只接已确认的
  profile selector44、共享已发布 hat 资源与现有 `TankView` 挂点。
- 不改变 M2-04 弹道原型、M2-05 死亡时序、M4-03 技能数组生产绑定或既有购买/换色业务。
