# 全图Breach原资源消费者

对应M3-05、M3-07、M3-08。`scene-breach-resources.ts`按原地图与型号选择自身c9库，优先保留既有13图的精确库映射；其它原图中的相同型号复用已发布原库。25个既有型号共1046个放置与05438、05440、05441、05446、05463五种fallback共98个放置均获得自身c9/C9消费者，30个型号共1144个放置不再由地图白名单限制资源注册。

`ScenePreview`从实际Breach放置收集已登记的30种完好材质型号，为每个真实asset注册现`SceneBreachMaterial`。网格名、原顶点色、texture乘法、kind1 alpha及各原shader合同沿用原型号；五种fallback使用原型号材质，不新增猜配材质。

已有库未覆盖的型号读取放置`destruction.library`。该字段由`export_scene_breach_catalog.py`发布，破损消费者按`Data/scnobj/<model>/c9.CVD`或`C9.CVD`选择同型号原资源；原参考路径保留在元数据与来源索引中。05438、05440、05441、05446、05463的共享库和98个placement绑定已发布，其中17个使用小写`c9.CVD`、81个使用原始`C9.CVD`。

每个破损owner在`load()`的await前登记到`breakables`，沿现revision/clear释放。原放置旋转、scale和geometry origin、破损淡出、快照与新局状态、声音和伤害数字没有新增规则。

## 未完成范围

共享库和98个真实放置绑定已导出发布。新增地图中的实际材质、CVD播放和释放尚无浏览器或表现验收；未运行测试、构建、类型检查或浏览器。

本项为Breach资源消费者接线，各图的地形、植物、General、特殊场景类、原声音及服务器规则仍由原任务分别恢复。原m001–m005提供13图26组合的直接参数来源；当前房间目录已开放0001–0025，新增组合按同模式原基线采用参数，详docs/playable-maps.md。M3与整图父项保持未完成。
