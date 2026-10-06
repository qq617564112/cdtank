# 地面掉落与拾取的客户端表现

M2-10 掉落子项的 Web 消费面。服务器权威实体为 `GroundItemSnapshot`，客户端只做
场景投影、原声音提示与丢弃请求，不写库存、不本地减量。业务与协议见
[ground-item-business-design.md](ground-item-business-design.md)。

## 视觉与贴图映射

`GroundItemsPresentation` 按快照中的 `id` 增量创建/销毁 `GroundItemVisual`：
`reconcile(snapshot.match?.groundItems ?? [], scope, phase === 'PLAYING')`。`scope` 是
`roomId:round`，变化或非 `PLAYING`（含 `FINISHED`、离开）或 `clear()` 时 dispose 全部
根节点/材质贴图/`AssetContainer`。视觉复用现 `applyCartoonOutlines` 与原生 X 反射
放置约定，`root.metadata` 带 `groundItemId`/`groundItemModelId`/`groundItemTexture`/
`sourceModel`。

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
obj05* 几何自带真实 morph 权重动画，掉落时播放一次（源模型确有动画）。

## 事件与声音

- `groundItemDropped`：记录权威 `sourceId` 的模型/贴图/声音/特效与源位置；`EffectFile`
  是**掉落**提示，`_root\online\044` 经现 `EffectRuntime.spawnWorldEffect` 播放一次，
  不回放给晚加入快照补建的同名实体。
- `groundItemPickedUp` / `groundItemRemoved`：按 `id` 先取出所拥有记录的源位置与
  `soundId`，再移除并 dispose 视觉。`GA2x` 声音只在 `playerId` 等于本机玩家时经现
  `EffectRuntime.playSceneSound` 播放一次，远端领取不重复噪声。移除不改本地库存。
- `EffectRuntime` 已提供世界特效挂点，未新增假 HP/技能/VFX；`voiceSound0` 不补替资源。

## 丢弃入口

`Battle.discardCandidates()` 由现确认库存 `hotkeys` 与 owned/battle 正数、类别 1/2 的
记录求交集给出候选；`BattleMatch` 在正式对局页提供“所选道具”下拉与“丢弃一份”按钮。
选择仅记录客户端当前 `value`，不发 `useItem`、不消耗、不改数量；也可由现 HUD 激活
热键同步选中，但选择本身即可丢弃，不依赖最后一次激活。

按钮沿现普通 `sendMsg('PlayerAction', …, action: GroundItemAction.DISCARD, value:
selectedInstanceId)`，携带 `roomId`/`round` 由服务器鉴权。服务器按 participant 真实
`hotkeys` 内拥有/存活/正数库存复核，普通错误原样返回并保留当前选择；客户端不先减
owned，不借 action1/2，不新增拾取按钮（真接触由服务端自动拾取）。按钮沿用现
`<button>` 焦点/Enter/Space 语义与中文字体，无自定义快捷键覆盖。

## 已知缺口

- 未运行任何 test/browser/build/type/lint/export 检查，未做真实联机。
- 拾取特效（如拾取时的 44 世界特效）来源未证；本片只按源 `EffectFile` 播放掉落提示，
  未把技能 44 作为拾取代理。
- 服务器丢弃校验、候选交集与 UI 选择未与真实 World 联调；原服务器概率、类别 6 入账
  语义与完整生命周期仍由 M2-10 父项保留。
