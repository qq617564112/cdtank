# 地面掉落与拾取的客户端表现

M2-10 掉落子项的 Web 消费面。服务器权威实体为 `GroundItemSnapshot`，客户端只做
场景投影、原声音提示与丢弃请求，不写库存、不本地减量。业务与协议见
[ground-item-business-design.md](ground-item-business-design.md)。

## 视觉与贴图映射

`GroundItemsPresentation` 按快照中的 `id` 增量创建/销毁 `GroundItemVisual`：
`reconcile(snapshot.match?.groundItems ?? [], scope, phase === 'PLAYING')`。`scope` 是
`roomId:round`。非 `PLAYING`（含 `FINISHED`）时 dispose 全部根节点/材质贴图/
`AssetContainer`，但同 scope 保留待消费的掉落声音源，直至 pickup/removal 事件各消费
一次；scope 变化、离开或 `clear()` 时 source 记录与视觉一起清空。视觉复用现
`applyCartoonOutlines` 与原生 X 反射放置约定，`root.metadata` 带 `groundItemId`/
`groundItemModelId`/`groundItemTexture`/`sourceModel`。

几何是按 `modelId` 加载的 `Data/scnobj/<modelId>/<modelId>.glb`；贴图**不是**同目录
默认 GLB 内建变体，而是显式 `(modelId, texture)` 映射：

| modelId | A 变体 | B 变体 |
| --- | --- | --- |
| obj05006 | obj05006A.png | obj05006B.png |
| obj05007 | obj05007A.png | obj05007B.png |
| obj05008 | obj05014A.png | obj05008B.png |
| obj05001/02/03/04/05/09/10/11 | `<modelId>A.png` | 无（dropitem 未用） |

`obj05008+A` 明确落 `obj05014A.png`，不存在 `obj05008A.png`。加载成功后把变体贴图写入
网格 `PBRMaterial.albedoTexture`，未命中可变体时不回退默认 GLB，直接报错。
obj05* GLB 的 `extras.attachmentTracks` 保存原 CVD 节点的位移、旋转、缩放与帧时间。
`GroundItemVisual` 用既有 `EffectModelAnimation` 采样节点矩阵，在 GLTF 坐标反射根节点
之下应用原矩阵；morph 权重动画暂停后按同一个节点时钟逐帧定位，并按原节点周期循环。
首帧在加入绘制回调前完成采样，移除物件时同时注销动画回调。

`obj05001` 的原节点缩放为 `0.080484733`，局部网格宽 350，最终宽约 28.17；
`obj05006/07/08` 的各档缩放及旋转、浮动均读取各自轨道，不采用统一模型缩放。
这些掉落模型的直接来源为 CVD，场景元数据记录 `.CVD`。

原掉落接收 `0x441155` 经工厂 `0x45aeb6` 载入模型并放置 XYZ；基类构造
`0x44edcd` 将三个根旋转角初始化为零，`0x44de02` 按位移和这些角度组合根矩阵。
Web 根节点保持权威 XYZ 的 X 反射，CVD 节点轨道在 GLTF 反射根节点下采样。

## 掉落模型横向核对

原 `dropitem` 的 14 行涉及 `obj05001`–`obj05011` 共 11 个 CVD 模型。已静态核对
全部 GLB 与 A/B 映射贴图存在，每个模型均为单节点、mode-3 变换轨道；节点名与
morph 动画组名对应导出的 `node-0/0`。节点周期为 1.6666666 或 3 秒。
原各顶点帧的 UV 与法线保持相同，现 GLB 的固定 UV/法线适用于这些模型。
14 张所用贴图的 alpha 均为 255，当前贴图替换没有透明度丢失。

场景移除沿快照与 pickup/removal 消费；动画回调、外部变体贴图和模型容器由同一
`dispose()` 释放。异步贴图载入失败时也释放已经载入的模型容器。

## 事件与声音

- `groundItemDropped`：记录权威 `sourceId` 的模型/贴图/声音/特效与源位置；`EffectFile`
  是**掉落**提示，`_root\online\044` 经现 `EffectRuntime.spawnWorldEffect` 播放一次，
  不回放给晚加入快照补建的同名实体，也不为晚到记录补建视觉。
- `groundItemPickedUp` / `groundItemRemoved`：按 `id` 先取出所拥有记录的源位置与
  `soundId` 并消费记录，再移除并 dispose 视觉。FINISHED 先到时，先发出的 pickup 仍可
  在已释放视觉后播放一次声音；重复 pickup/removal 不会重播。`GA2x` 声音只在
  `playerId` 等于本机玩家时经现 `EffectRuntime.playSceneSound` 播放一次，远端领取
  不重复噪声。移除不改本地库存。
- `EffectRuntime` 已提供世界特效挂点，未新增假 HP/技能/VFX；`voiceSound0` 不补替资源。

## 地面事务与库存

正式战斗页不提供道具丢弃菜单、下拉框或按钮。弹药数量由原快捷栏显示，页面呈现见battle-play-page-source.md。
`BattleItemInventory` 在本机 `itemUsed`/`ammoConsumed` 或地面事务提交后的
`inventoryChanged` 通知上重查 Inventory RPC，并以响应 revision 丢弃过期结果；确认库存
发布后更新快捷栏真实实例与数量，拾取恢复的已装槽数量进入库存快照。真正拾取时，服务器为新
未装实例自动填入本局正确栏的首个空槽（Battle2..4 武器/陷阱、Battle5..8 消耗/宝物），不覆盖
满槽、不自动使用/切换；hotkeys 只在本局角色上变化，持久账户配置不改。地面实体含 `DISCARD`
统一 30 秒后消失，客户端仅按权威快照/`groundItemRemoved` 移除。

既有 `Battle.discardSelected()` 沿普通 `sendMsg('PlayerAction', …, action: GroundItemAction.DISCARD, value:
selectedInstanceId)`，携带 `roomId`/`round` 由服务器鉴权。服务器按 participant 真实
`hotkeys` 内拥有/存活/正数库存复核，普通错误原样返回并保留当前选择；客户端不先减
owned，不借 action1/2；真实接触由服务端自动拾取。

## 已知缺口

- 未运行任何 test/browser/build/type/lint/export 检查，未做真实联机。
- 拾取特效（如拾取时的 44 世界特效）来源未证；本片只按源 `EffectFile` 播放掉落提示，
  未把技能 44 作为拾取代理。
- 服务器丢弃校验与候选交集未与真实 World 联调；原服务器概率、类别 6 入账
  语义与完整生命周期仍由 M2-10 父项保留。
