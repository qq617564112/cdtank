# 猛虎王 105 普通战斗死亡表现

当前006树声ww154已发布独立补作并映射audio.json，原105死亡动作、ELK及GA12保持。资源与参数见[reconstructed-tree-audio-runtime.md](reconstructed-tree-audio-runtime.md)；新增实际播放未验，以下已有证据仅覆盖其原缺文件输入。

M4-09-COMBAT-DEATH-09：PASS。当前 React 双端在地图 0007 的普通 CPU 战斗中，由真实击毁进入原 09 死亡动作，触发原 ELK Effect6 与 GA12，自然结束并恢复满血 01。两端捕获到真实死亡渲染帧，离房和新房重入后模型、效果及声音清理通过。生产模块无需修改。

## 来源、模块和实战接线

| 层 | 已确认内容 |
| --- | --- |
| 原动作 | 猛虎王 105 的 M/U/X/Y 原 09 MV3，duration 均为 5601。M 部件在 time160 发 `effect1`，identifier1416378268。 |
| 原 ELK | tank105 的 09/effect1 指向 `_root\online\006`，bindingMode3，`tag_efcenter`。根2504；11个绘制节点2506/2507/2508/2509/2510/2511/2512/2513/2514/2515/2518。 |
| 原声音 | Effect6 的 type4 节点2973使用 GA12，原 WAV 实物与发布 WAV 字节一致。节点2516的 ww154 原声音实物缺失；当前项目已映射独立补作，以下实测覆盖原缺文件输入。 |
| 正式模块 | `BattlePlayers.render` 按权威 alive 调用 `TankView.life`；死亡切换09并停止攻击，M/U/X/Y 使用原单次动作时钟。`EffectRuntime.message` 消费实际09消息，通过原绑定创建完整Effect6。type4声音由 `EffectSound` 播放。 |
| 实战接线 | 两个独立账号加载完整原105角色来源和105原皮肤，经普通选车、建房、加入、CPU、Ready及Space开火。服务端真实destroy和respawn事件产生死亡及复活，没有注入动作、伤害、通知或位置。 |

`TankView` 09 完成后四个部件均停在原 `duration-100=5501`，overMessage清零，保留死亡模型直到服务端复活。复活通过正式 life(true) 恢复01。原本机死亡计数适配器 `death-runtime-bridge-sol` 的未接部分独立保留；此次不改变计数或服务端复活规则。

## 双端结果

本次目标 P1 在两端收到两次相同的真实 CPU 击毁事件。实际绘制记录来自目标网格的 Babylon `onBeforeRenderObservable`，包含原节点编号、非零顶点及纹理 URL。

| 观测 | 网页1，本机P1 | 网页2，远端P1 |
| --- | --- | --- |
| 11节点完整绘制且自然到期的实例 | handles98、120 | handle116 |
| `tag_efcenter` 同一矩阵对象且动作中更新 | 通过 | 通过 |
| 原M/U/X/Y09自然完成 | time5501 / duration5601 / overMessage0 | time5501 / duration5601 / overMessage0 |
| 自然复活01 | frame384，HP200/200 | frame245，HP200/200 |
| 自然死亡截图 | frame350，handle98 | frame594，handle116 |
| GA12真实playing、非循环、自然ended | 4次 / 4次结束 | 4次 / 4次结束 |
| ww154 | 4次无源、无播放 | 4次无源、无播放 |
| 离房效果实例/效果网格/效果音源/战斗音源/角色 | 全部0 | 全部0 |
| 新房CPU/Ready重入及再次离房 | 原105存活进入新局，再次全部0 | 原105存活进入新局，再次全部0 |
| 内部画布 | 320×180 | 320×180 |
| 记录帧耗时中位数 / P95 / 最大值 | 93.8 / 156.3 / 479.4ms | 97.3 / 172.4 / 540.9ms |

两张自然死亡图取自正常渲染循环的 `onAfterRender`，当P1权威死亡、原09已启用且其Effect6网格实际提交绘制时直接保存原canvas。可辨认原105死亡模型与原爆炸精灵/条带。没有隐藏背景、改材质、冻结时间或修改相机。两张图对应不同的实际死亡时刻；同一服务端事件一致性另由双端事件记录证明。

证据：`recovery/output/browser-combat-death-09.json`；实际死亡帧 `browser-combat-death-09-natural-1.png`、`browser-combat-death-09-natural-2.png`；页面截图 `browser-combat-death-09-1.png`、`browser-combat-death-09-2.png`。完整早期生命周期通过证据保留在 `browser-combat-death-09-lifecycle-accepted.json`。

## 复现

- `node --import tsx tests/combat-death-09-source.cts`：核对四09部件、原effect1、ELK中心绑定、11绘制节点、GA12原WAV和ww154资源合同。
- `node --import tsx tests/browser-combat-death-09.mjs`：独立临时账号库，服务端3271、Vite5301、CDP9501及独立Vite缓存；普通CPU击毁、原动作/绘声自然完成、复活、自然死亡帧及退出重入。

专属进程和临时目录在脚本finally释放；交付时3271/5301/9501均不监听。

## 限制

本片只覆盖具有原09 ELK的105。ww154缺失仍为原资源缺口；原001没有此死亡ELK，不添加通用爆炸或声音。BattleSound的destroy选择属于击毁者提示，GA14/GA46不作为死者GA12的替代。软件渲染慢帧或视锥裁剪可能使个别死亡实例仅提交部分节点，完整11节点证据来自上述具体实例；不是每次死亡完整实绘或高清性能证明。当前服务端CPU、伤害、复活时限/HP/出生点采用现有重建规则，此项不证明原服务器死亡复活规则，也不关闭本机计数调度与未恢复残骸父项。
