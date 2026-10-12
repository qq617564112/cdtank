# M3-08 Crush07 原051普通射击表现

合法mode1/map7原76已通过普通2001射击完成限定玩家表现：正式ShotItem事务使对象隐藏，双端启动原051静默烟尘一次，源1秒效果自然结束；继续普通开火不重播，同房自然终局与四人正常再战恢复原enabled，离房释放全部owner、效果与声音。主线已亲审双端完整画布，接受范围见`scene-crush07-player-accepted.json`。M3-08父项保持未完成。

| 范围 | 证据 |
|---|---|
| 来源已恢复 | `scene-crush07-state-native.json`、`scene-crush07-matrix-native.json`、`scene-crush07-caller-source.json`、`scene-crush051-resource-contract.json` |
| 模块已实现 | `scene-crush051-consumer.json`、`scene-crush07-reconcile.json`、`scene-crush07-wire-order.json` |
| 普通实战已触发 | `browser-crush07-2026-10-04T18-02-22-466Z.json` |
| 双端可辨原烟尘、静默、结束与清理已验 | 上述raw双natural PNG及`scene-crush07-player-accepted.json` |

## 原合同与消费者

原45efb3先经461dd9隐藏，仅在+fc非空时复制+78八字节引用pair并调用效果vslot34。正式3aa4/4247aa近端经44e081 hidden guard分派virtual14，因此直接callee可重复启动不代表正式事件可重复接受。+78首项指向64字节gbMatrix4，次项是owner；原构造与44de02源position/rotation producer已执行，效果parent不使用OBBox矩阵或inline16float。

原根2970 `_root\online\051`与子2971 `teda`引用精确原yan1.dds恢复的64×64 `Data/effect/effect/yan1.png`，子lifetime1秒，树没有声音节点。普通SE30射击反馈独立于051，不能当作051声音或烟尘。

FX拥有`EffectRuntime.retainCrushEffect(parentMatrix,id)`、`startCrushEffect(handle)`、`stopCrushEffect(handle)`及`SceneCrushPresentation`。load保留inactive树，触发先hide再start，reset只stop而保留句柄，dispose停止并释放。地图拥有ScenePreview源transform/provider、enabled、load/clear与reconcile；主线拥有正式场景身份、2001查询许可、事件、协议与Battle接线。

实际tick为snapshot-before-event。ScenePreview以每round独立consumedShot门禁允许先hidden快照后的首次事务启动一次，快照自身不播放；换round清消费并恢复源enabled。

## 普通玩家证据

专属`tests/browser-crush07.mjs`使用四正常认证账户、两React与两静止辅助玩家；预房原tank1/pet1拥有记录及75秒时限在raw明示。普通NAV后host在40.17/−233.11，隔离复制field的正式query首目标CRUSH76才发送普通Space；guest仅附近观察。没有活跃位置、HP、事件、胜负或相机注入。

双端同一sceneCrushed/shotItemResult，handle2各start1，parent精确179.723571777/0/−404.040771484。先hidden快照使root已false，随后首次事件consumedShot false→true；四次普通fire后不再接受76。真实source2971 mesh提交420顶点/原yan1纹理，完整natural画布可辨原烟尘；guest另有普通射击亮光，不归作051。两端原soundNodes为空、子phase3自然结束。

自然TIME_LIMIT后四人正常Rematch进入round2，75保持禁用，76/77完整可见，原保留树停止、start仍各一次；双Leave的owners/effects/retainedCrush/meshes051/sceneVoices/battleVoices全部0。组合索引为`scene-crush07-composed-evidence.json`，专属进程清理为`crush07-process-cleanup.json`。首轮零Space入口与有效清理保存在`scene-crush07-first-player-gap.json`。

## 未完成范围

普通W穿越原footprint未测；75/77逐实例与高清性能未验。服务器许可、低物件水平OBB查询及立即动态碰撞退出为明确重建，完整原服务器producer未恢复。完整loader、非零旋转native样本、非空owner复制与释放尚未由当前来源样本证明。模块或draw计数不关闭这些父范围。
