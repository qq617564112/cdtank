# 全图Breach原资源消费者

对应M3-05、M3-07、M3-08。`scene-breach-resources.ts`按原地图与型号选择自身c9库，优先保留既有13图的精确库映射；其它原图中的相同型号复用已发布原库。25个已发布型号共1046个放置能够获得自身c9消费者，不再由地图白名单限制资源注册。

`ScenePreview`从实际Breach放置收集已登记的25种完好材质型号，为每个真实asset注册现`SceneBreachMaterial`。网格名、原顶点色、texture乘法、kind1 alpha及各原shader合同沿用原型号；05446、05463和缺自身c9的05438、05440、05441没有新增猜配材质。

已有库未覆盖的型号读取放置`destruction.library`。该字段由`export_scene_breach_catalog.py`发布，破损消费者仍按`Data/scnobj/<model>/c9.CVD`选择同型号原资源；原参考路径保留在元数据与来源索引中。新共享库未导出前，旧放置没有该字段，05446和05463保持没有破损资源消费者。

每个破损owner在`load()`的await前登记到`breakables`，沿现revision/clear释放。原放置旋转、scale和geometry origin、破损淡出、快照与新局状态、声音和伤害数字没有新增规则。

## 未完成范围

本批未运行导出、测试、构建、类型检查或浏览器。新共享库和metadata尚未发布，新增地图中的实际材质、CVD播放和释放没有运行证据。

本项为Breach资源消费者接线，各图的地形、植物、General、特殊场景类、原声音及服务器规则仍由原任务分别恢复。正常入口继续由原m001–m005授权13图26组合；其它图没有玩家建房资格。M3与整图父项保持未完成。
