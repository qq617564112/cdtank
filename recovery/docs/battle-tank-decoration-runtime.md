# 战车装饰战斗公开与显示

## 采用规则

已确认的 `DECORATION` 槽是唯一来源。Home 沿现有
`ReqEquipment { operation:'EQUIP'|'UNEQUIP', target:'DECORATION' }` 提交，服务器按账户、
战车实例、库存归属、数量和 `equipmentTarget` 校验，确认结果为
`ResEquipment.decorationInstanceId`。持久槽复用原资料 selector44，
`readRoleProfileCosmetics` 固定读取 `payload+0x118`；更换或卸下继续由
`AccountTankEquipment` 和现有 profile writer 原子保存。

房间只公开模型身份，不公开实例归属或资料字节：

```ts
interface TankDecorationSnapshot {
  itemTableId: number;
}

interface PlayerSnapshot {
  decoration?: TankDecorationSnapshot;
}
```

`PlayerSnapshot.decoration` 仅在当前战车确认资料指向房间库存中的实例，且实例
`state===2`、`ownedQuantity>0`、共享 item 定义
`equipmentTarget==='DECORATION'` 时存在；任一条件不满足时字段缺失，不发空对象、不发占位模型。
该可选字段手工并入 schema117，既有编号保持不变。

## Web 消费

`BattlePlayers` 在 `TankView.load` 成功后消费权威快照。`sameSelection` 除
`tankId/tankTextures` 外比较 `decoration.itemTableId`；同一玩家更换装饰时先释放旧
owner，再加载新模型。

`BattleTankDecoration` 以 `itemTableId` 查同一共享 item 定义：

- `runtime.equipmentGroup==='hat'` 且 `resources.model` 非空时加载该模型；
  存在 `resources.texturePath` 时加载对应纹理。
- 挂点取 `effects[0].tag`，只接受现正式 `TANK_DECORATION_TAGS` 的 `0..3`，依次对应
  `tag_iteye/tag_itwing/tag_ithat/tag_itside`。
- `17031`–`17036` 这类 `appearanceEffect:true`、`resources.model:null`、`tag:-1`
  的物品继续只走既有被动效果 queue，不加载网格，也不借用帽子模型。
- 模型、纹理或挂点不合法时显式失败并释放本次创建的对象；不换成其他饰品、不改图、不退回
  本地伪模型。

owner 直接在 `TankView.root` 下建立 anchor，逐帧调用 `view.decorationTag(tag)` 取得当前
模型挂点矩阵。Web 采用与 Home `HomeTankDecoration` 相同的转换：矩阵索引
`1/2/3/4/8/12` 取反，再乘 `TankView.root.getWorldMatrix()`。装饰只跟随当前模型位置和
旋转，不改变碰撞、NAV、炮口、伤害或 HUD 状态。

owner 持有 `AssetContainer`、anchor、纹理和 `onBeforeRenderObservable` 回调。
`clear()`、玩家移除、离房、换局或场景 dispose 时全部释放；加载晚返回若 generation、
player 或 `decoration.itemTableId` 已变化，立即 dispose，不挂到新场景。

同一次入场中，服务端向所有参与者发送同一 `TankDecorationSnapshot`，因此双方从同一公开
定义显示。Home 现有 `HomeTankDecoration`、`HomeEquipmentPreview` 和“装饰”槽不改行为，
作为同一模型/纹理/挂点合同的已接参照。Home 请求、购买、装备、账户和持久化语义均不变。

## 直接来源

- 请求、确认与持久槽：`apps/shared/protocols/PtlEquipment.ts`、
  `apps/server/src/accounts/api.ts`、`apps/server/src/accounts/tank-equipment.ts`、
  `apps/server/src/account-store.ts`、`apps/server/src/accounts/profile/cosmetics.ts`、
  `apps/web/src/interface/home/home-equipment.tsx`、
  `apps/web/src/interface/home/home-equipment-source-list.tsx`
- 房间公开字段：`apps/shared/protocols/MsgRoomSnapshot.ts`、
  `apps/server/src/rooms/snapshot.ts`
- 资源身份与挂点：`apps/shared/combat/equipment-target.ts`、
  `apps/shared/content/definitions/items/10001.json` 至 `10040.json` 中
  `runtime.equipmentGroup==='hat'` 的已解析条目、
  `recovery/output/web-assets/Data/accessory/10001/10001.glb`、
  `recovery/output/web-assets/Data/accessory/10001/10001A.png`、
  `apps/web/src/assets/tanks/tank-view.ts`、
  `apps/web/src/interface/home/home-tank-decoration.ts`、
  `apps/web/src/interface/home/home-equipment-preview.tsx`
- 正式战斗消费者：`apps/web/src/render/battle-players.ts`、
  `apps/web/src/render/battle-tank-decoration.ts`

## 真实剩余限制

当前没有执行网络、浏览器、持久、构建、类型检查、native 或生成器；实际双端入场、换装、
死亡/复活/换图和跨房间显示仍需真实验收。原客户端完整 attach callback、挂点像素、
GPU 精度、全部 hat/多部件车型组合和高清性能未证；本文不把静态合同或现有 Home 证据当作
原像素完成。本批实现结束后执行一次集中静态走查，父项保持未勾。
