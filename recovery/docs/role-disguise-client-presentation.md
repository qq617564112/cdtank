# FUNC-08 角色伪装 Web 表现合同

对应 FUNC-08 与 M4-10 的 item10/skill10/style1、item11/skill11/style2。本片只接线 Web 表现与 CPU 配置 UI；权威施放、库存、期限、互斥与生命周期归 root 与共享合同。

## 来源与已直接恢复事实

原 4173 收 style8、roleId32：style1 加载 `Data/scnobj/obj05428/obj05428.POL`，style2 加载 `Data/scnobj/obj05422/obj05422.POL`；先隐藏战车 actor，再按角色创建时 XYZ 生成替身世界对象并记录名称。原 4174 收 roleId32：恢复战车，再逐条删除该角色记录的替身。原消费者没有本机、队友、敌对显示区别，也不清除其它角色绘声。两类战车 render 均被 actor `+23d` 可见门禁拦截，隐藏时提交 0 个战车节点。

发布资源合同已核：obj05428 为 object01、FVF21/kind0、174 展开顶点与 128×128 原纹理；obj05422 为 cone78、FVF21/kind0、108 展开顶点与 128×128 原纹理。模型与内嵌纹理沿用 `Data/scnobj/obj05428/obj05428.glb`、`Data/scnobj/obj05422/obj05422.glb`，不做通用几何、emoji 或图标替代。

## 采用的表现策略

`PlayerSnapshot.roleDisguise` 是 presence、epoch 与激活位置的权威来源。`RoleDisguiseVisual` 用 `SceneBreachMaterial.register(asset, model)` 复用原 FVF21/kind0 语义，加载对应模型的完好 GLB，替身固定在快照给出的 x/y/z，不跟随角色后续位姿，不加载 c9 破坏模型，不额外描边、改透明度或猜 flag 索引。替身采用与场景/地面一致的 native X 反射变换。

`BattleRoleDisguises` 按角色持有替身，键为 skillId/style/startedAt/expiresAt/x/y/z。同 epoch 的快照与通知不重复创建副本；epoch 或样式改变先释放旧替身再按新快照创建。`PlayerSnapshot.roleDisguise` 为主、快照 reconcile 覆盖断线、晚加入和模型晚加载；4173/4174 只做身份核对，不合成状态、不重放通知、不建乐观队列。

actor 隐藏与替身创建分离：只要当前快照仍在本角色上持有受支持的 roleDisguise，`applyVisibility` 即在现有光学迷彩观察规则之外隐藏战车 root；角色位姿、动画、相机、插值与碰撞/命中/伤害/HUD/图片路径不变。非 PLAYING、死亡、复活前、新局、离房、reselect、clear 都释放替身并按权威相位恢复战车；不销毁或重载 Tank 以承载临时伪装。

## 生命周期与所有权

每个替身拥有自己的 `AssetContainer` 与 `SceneBreachMaterial`。register 在 await 之前登记条目，clear/expiry/epoch 变更/新局若早于加载完成，会 dispose 最终到达的资源而不晚插入或显示。加载错误冒泡到 `BattlePlayers.loadingError`，界面按既有战车载入错误路径显示。共享源纹理不额外改写或销毁。原 create 参数 2/0 与 duration 未确认，表现侧不猜时长、不设独立本地 TTL，以权威 expiresAt 为准。

## Root 集成

`BattlePlayers` 暴露 `changeRoleStyle(roleId:number, style:1|2)` 与 `restoreRoleStyle(roleId:number)`：前者仅在当前快照已含匹配 `P{roleId}` 的 roleDisguise 时刷新，后者仅在快照已无该 roleDisguise 时刷新。root 在 `Battle` 中把 `MsgRoomEvent.roleStyleChanged`/`roleStyleRestored` 转到这两个方法，并负责权威 presence、互斥与清理时序。CPU 配置 UI 槽 5–8 现允许 item 1–11 与 502，弹药槽仍限 2007/2011，quantity 上限取 `battleUseMax`（item10/11 为 5）；零价商品不开放免费商城获取，玩家只用已有归属库存，CPU 只用房主配置的有限库存。

## 待验收

正常施放与双端替身绘制、权威到期恢复、合法开火解除与拒绝开火保留、死亡/复活恢复、整局与再战清理、双端高清替身像素、施放首槽原绘声、CPU 槽 5–8 配置保存与重启恢复仍待实测。原未知创建参数、原完整 transport 与替换物体姿态更新保持开放。
