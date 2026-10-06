# 原全图环境目录

M3-07/M3-11/M4-09：`export_scene_ambient.py` 随标准 `export_scenes.py` 从原 `Data/scn` 的25份 OBJ 发布每图的 `scene-environment-sound-XXXX.json` 和 `scene-effects-XXXX.json`。原目录共73处 Sound、31处 Effect；没有 Effect 的图发布空数组。正式地图owner按相同四位 mapId 读取，原0020目录包含269–273，不依赖独立补导出步骤。

每个目录保留原 OBJ 来源。Sound 保留原 id、enabled、position、完整解码尾字段及 gain/intervalMs/randomGate，空间参数取既有原音频入口；73处 intervalMs/randomGate 均为0，沿现循环声音合同。0018的57–62六处使用原 BG07。Effect 保留原 id、enabled、position、matrix、原效果名、声音名和gain及剩余尾字段，不以近似名称替换资源。

31处 Effect 位于0005（4）、0008（4）、0012（4）、0013（2）、0016（12）、0020（5），引用原 `_root\online\042/052/056/057` 树。原放置均 enabled1、零旋转，matrix 平移与 position 相同。树节点复用现效果目录与type1/type6消费者；本目录不改变粒子参数、生命周期、随机相位或原声音规则。

Sound 同类原 loader/空间循环证据沿 `scene-environment-sound-0021.md`，Effect 同类原 startup/retain/矩阵绑定/stop-release 合同沿 `scene-effect-0020-052.md`。旧分图导出入口保留其原复现用途。旧实测证据只覆盖各自原地图、对象和验收范围，不扩大到本次全图接线。

## 未完成范围

本批未运行目录导出、浏览器、测试、构建或类型检查。源码与原放置数据范围不证明全部对象实载、像素、音频、高清性能或完整地图玩法。相关父项保持未完成。
