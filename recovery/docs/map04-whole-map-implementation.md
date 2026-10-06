# 地图0004整体实现

对应tasklist：MAP-1-0004、MAP-3-0004，M3场景加载与状态映射。以完成的地图0002为正式实现基线。本图全部修改完成后统一构建和一次整图浏览器测试；实际问题集中修复后最多一次复测，不单消费者验收、不补证封装。

## 原始范围

scene-placements.json：147条放置、99个碰撞盒、terrain Data/map/0004/0004.glb，无Castle、水面、General或Crush。

| 内容 | 数量 | 实现范围 |
|---|---:|---|
| Breach05466 | 17 | 原intact材质、0004 c9、GA13及正式对象状态 |
| Breach05422 | 21 | 原intact材质、复用0021 c9、GA13及正式对象状态 |
| Plant05403/05405/05401/05413 | 29/38/32/7 | 106源ID位置/朝向/尺寸、原四材质与sway、正式隐藏状态/root恢复 |
| BG06/BG11/BG12 | 3 | 原source-ID/空间/循环、同场景续用与Leave停止 |
| Terrain | 1 | 原几何与具名材质、采样/culling及资源释放 |

## 整图代码缺项

- Preview现已注册两个Breach intact材质；0004破坏选择已补05422对应0021 library分支，全部38放置复用源模型与GA13消费者。
- Plant sway/material加载覆盖四型号，但snapshot root登记与预load快照保留已纳0004，完整106放置纳相同正式消费者。
- 主线接口已集成：map4 modes1/3完整106 Plant snapshot/contact状态；mode1 map4完整38ENV包含05466/05422。地图线不改伤害政策或协议。
- 两型号Breach的round/初载/Resume状态统一复用地图02 restoreObjects，不增加独立事件恢复路径。
- 全147放置具有正式asset或专属Sound消费者；Plant四材质、terrain合同、三BG资源已发布，直接复用，不重新导出或重复资格验收。

## 交付边界

整图原资源、模型映射、材质、环境动画/声音和所有权清理由地图线负责。权威碰撞状态/玩法授权由主线负责；原灯光/toon跨线研究不阻止本图使用正式地图02基线。共享Preview仅修改本图具名分支及Plant登记范围，与主线restore实现分离。

当前处于整图实现，浏览器测试次数0。正式接口集成、全部代码修改和统一工程完成后再进行正常玩家/CPU整图测试。

## 当前整图出口

地图owned Preview三处接线已完成，原terrain146材质part、四Plant材质、106摆动实例和三BG沿现正式加载/释放实现复用。主线106 Plant及38Breach权威参与接口已集成，地图线本图整体代码修改完成；统一构建再运行整图入口 `tests/browser-map04-full-session.mjs`；测试次数仍0。

入口固定modes1/3，在一个进程内各自然两局/正常Rematch、1920/3840实际尺寸、普通Autopilot输入、多端共同状态与正常Leave，最后新房重入清理。使用预房显式原tank1/pet1夹具，两rendered账户与两认证被动账户，不证明获取流程。只读加载数量、状态和资源清理；不逐实例像素或声音峰值门禁。独立端口3674/5674/9874待统一GPU窗口。
