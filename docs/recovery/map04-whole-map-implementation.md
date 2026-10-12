# 地图0004整体实现

对应tasklist：MAP-1-0004、MAP-3-0004，M3场景加载与状态映射。以完成的地图0002为正式实现基线。当前按tasklist最高执行约束，仅进行整批集中代码走查，不运行构建、类型检查、测试或浏览器验收。

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

当前整图生产接线已实现。一次集中代码走查确认原型号资源、植物独立几何/借用材质、预load快照、Breach恢复和三BG清理路径正确。完好实例/root在创建时立即登记清理；加载中Leave或重新进入由clear统一释放。共享Castle字体消费者在创建后、await前登记所有权，字体JSON返回时检查本轮revision；该共享修复同时覆盖地图0005/0006。

## 当前整图出口

地图owned Preview三处接线已完成，原terrain146材质part、四Plant材质、106摆动实例和三BG沿现正式加载/释放实现复用。主线106 Plant及38Breach权威参与接口已集成，整体生产实现与一次静态走查已完成；整图双网页、原规则及高清父范围仍未验收，本轮未运行工程或浏览器检查。

既有未运行入口 `tests/browser-map04-full-session.mjs` 记录modes1/3、自然两局/Rematch、1920/3840实际尺寸、多端状态与Leave/重入的实测范围。当前只允许代码走查，不执行此入口，不将静态走查等同这些实测要求。
