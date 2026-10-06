# Plant02 原材质模块

原 `obj05413.POL` 的 `plane507/0` 使用 `plant80.gbf`：纹理乘 ambient，AlphaTest GREATER50、SRCALPHA/INVSRCALPHA、CLAMP。原 CPU 摆动与放置几何由现有 ScenePlantSway 提供。

具名来源链为 `gbPlantNode.LoadFromFile10019bd0 → NewMesh100279f0(type0) → gbStaticMesh`，原 Render 的 vslot8 调用 `DrawSubSetInstancing1001c200 → 1001b6f0`。有限原执行已到达参数104，实际值为 `[0.20000000298023224,0.20000000298023224,0.20000000298023224,1]`。证据 `scene-plant02-material-native.json/.log` 保持 INCOMPLETE，GPU dispatch terminal 为 0x26。

`scene-plant-material.ts` 已经由正式 `ScenePlant05413MaterialOwner` 接入 `ScenePlantSway`。原具名POL属性经正常资产pipeline发布，独立mesh借用原texture；owner在mesh释放前恢复原材质并释放shader。`tests/scene-plant02-material.mts` 的既有参数104、外供ambient更新、GREATER50/混合/CLAMP/深度配置及借用纹理检查复用，`scene-plant02-material-module.json/.log` 范围仍为 PASS_MODULE_ONLY。

## 未完成范围

正式材质有限消费者证据为 `scene-plant04-05413-material-player-evidence.json` 及其实际root-review，具名host447 shader/texture/materialfields/ambient provider与叶簇画面有限接受；同类05413模块复用到Map02。`scene-plant02-contact-player-evidence.json` 登记Map02新普通同局的实际Plant绘制与隐藏范围，不扩大为原GPU等价。

原完整 instancing draw 与原场景 ambient producer 未闭合。当前 Web 日光1属于重建 provider；模块外供颜色检查不证明原地图日光。M3-05/M3-06 父项保持开放。原native INCOMPLETE与Plant327两次旧路线失败保留。
