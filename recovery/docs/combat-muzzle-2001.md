# 普通炮弹实战炮口验收

M4-09-COMBAT-MUZZLE-2001：PASS。当前 React 入口的两个网页在地图 0007，通过普通建房、加入、添加 CPU、Ready 和 Space 输入，收到同一组服务端普通炮弹开火事件。两端均完成 Effect4 五节点实际绘制、实时炮口矩阵、自然到期、GA07 自然结束及离房清理。生产模块无需修改。

## 来源与模块

| 层 | 已确认内容 |
| --- | --- |
| 原来源 | 普通炮弹 2001 的物品表现槽为 Effect4/GA07；tank001 的 03/attack1 ELK 记录指向 `_root\online\004`，bindingMode 3，`tag_efattack`。原远端 BeforeShot→03 和 GA07 选择见 `projectile-source-sol.md`、`projectile-actor-binding-sol.md`。 |
| 原节点 | 根 2429；子节点 2430 烟粒子、2431 闪光精灵、2785 亮光精灵、2786 落花粒子、2787 小粒子。使用原 `yan1.png`、`baozha1111.png`、`FlareBrightOrange_BLUE.png`、`dian.png`。 |
| 正式模块 | `Battle` 将服务端 fire 交给 `BattleSound` 和 `BattlePlayers.fire`；角色动作消息交给 `EffectRuntime.message`，原 ELK 绑定与弹药表现选择创建树。声音使用原 `/audio/sound/GA07.wav`，目录 soundId 48。 |
| 实战接线 | 两个独立账号载入完整原战车/宠物角色源及独立皮肤。仅通过普通页面流程和真实键盘输入开火；没有注入 fire、动作通知或表现实例。 |

## 双端结果

复现：`node --import tsx tests/browser-combat-muzzle-2001.mjs`。脚本自建临时账号库、服务端 3271、Vite 5301、Chromium CDP 9501，并清理专属进程与目录。

| 观测 | 网页 1 | 网页 2 |
| --- | --- | --- |
| 同一服务端普通开火事件 | 17 | 17 |
| 开火角色 | P1、P3、CPU P2 | P1、P3、CPU P2 |
| 五节点完整提交且自然到期的实例 | P1：17、18 | P1：17、18；P3：19、20 |
| `tag_efattack` 引用及动作中矩阵变化 | 通过 | 通过 |
| GA07 AudioBufferSource | running、非循环、1.0233106576 秒、自然 ended | running、非循环、1.0233106576 秒、自然 ended |
| 离房实例/效果网格/战斗音源 | 0 / 0 / 0，stopped | 0 / 0 / 0，stopped |
| 实际内部画布 | 320×180 | 320×180 |
| 记录帧耗时中位数 / P95 / 最大值 | 19.2 / 179.1 / 373.9 ms | 78.2 / 182.2 / 416.1 ms |

五节点绘制证明来自各实际 Babylon 网格的 `onBeforeRenderObservable`，记录实际顶点数及原纹理；不是仅观察树创建或动作通知。网页 2 的 P1 是远端角色。实例保留原炮口矩阵对象且矩阵随动作变化，五节点完整绘制的同一实例按原生命周期自然移除。GA07 记录来自真实 `BattleSound.event` 创建并启动的 AudioBufferSource 的 ended 事件。

证据：`recovery/output/browser-combat-muzzle-2001.json`；两张 `browser-combat-muzzle-2001-1.png`、`browser-combat-muzzle-2001-2.png` 为实际战斗页面截图。

## 限制

截图没有进行单独效果开关的像素差归因。此次验收采用软件渲染及低分辨率内部画布，不证明 1080p/4K 性能，也不保证每个开火实例的短命节点在慢帧下都能提交。实际节点保留原 0.1–0.6 秒寿命，没有冻结或改写时间。服务端射击、CPU 策略、弹丸运动和命中规则仍按现有重建实现；本验收不补充原弹丸轨迹或命中爆炸触发来源。

## 当前证据复用

本片普通2001炮口、GA07与离房证据继续复用。2007炮口和持续燃烧消费者已有独立交付，见 ammo-burn-state-player-accepted.json；本片不再作为下一开发入口。

普通2001即时权威与玩家/场景结果组合范围见 ordinary2001-immediate-accepted.json。炮口原实战发生在地图0007，不能写成地图0002的新整链实战。地图0002当前新05427/source126普通破坏消费者的实际触发、六节点姿态、GA32与双Leave，须以其新首验记录证明；原炮口来源与模块直接复用。
