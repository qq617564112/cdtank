# Hook与WaterFall场景消费者

0012/321 Hook与0016/328 WaterFall通过发布的精确placement和专属消费者进入普通ScenePreview加载、动画推进与清理。两图普通房间入口已由现有地图目录提供。

## 原资源

- Hook：`SYcScnObjHook`、`obj05027`、enabled1；原INI的action_1为c1、文件c1.MV3，动作时长7681ms。原MV3有唯一`tag_spout1`轨迹48帧；原placement尾部offset17为字符串长度，offset21起为`_root\online\059`。模型复用已发布c1.glb与obj05027.png。
- WaterFall：`SYcScnObjWaterFall`、`obj05202`、enabled1；原POL为`_water`、FVF21、72顶点，kind1透明part，贴图引用obj052021.tga。原目录有obj052021–obj052025五张DDS及对应已发布PNG，原placement位置为0/0/0。

## 发布

`export_scene_special_objects.py`发布`scene-hook-0012.json`与`scene-waterfall-0016.json`，直接读取原MV3轨迹、POL顶点/颜色/UV/索引/材质和GBF状态。`scene-placements.json`对应两条记录新增`special.kind/library`并计入resolved。完整`export_scenes.py`调用同一publisher；定向publisher只更新这两条的special和resolved。

## 运行

Hook加载c1.glb，复用MV3材质与场景环境；实例位置取原position，矩阵保留旋转/缩放。c1按局时钟循环，插值spout轨迹并乘物件world，原059 retained效果使用同一可变parent矩阵。加载一次、启动一次，逐帧只更新挂点；普通离场、场景关闭及失败清理释放效果和模型，晚加载结果自行释放。disabled记录不显示或启动效果。

WaterFall消费原POL几何、顶点颜色和default/geom_t_c1透明状态，使用真实五张PNG。五帧按编号循环，100ms/帧；局内按共同局时钟选帧，非战斗预览按delta推进。纹理、模型与材质由消费者拥有；离场、失败和晚加载清理沿ScenePreview世代。模型加入同组场景排序与雾，不附加声、伤害、地面阻挡或交互。

## 采用规则与验收边界

Hook的c1循环及059绑定唯一spout、WaterFall五帧循环与100ms时基为结合客户端资源采用的规则。原类loader/update/draw完整合同、WaterFall原帧时基和Hook原绑定字段writer仍缺来源。

消费者与metadata已接并发布；普通对局、双端可见性、动画挂点、像素、高清与性能尚未实测。Sequence使用独立obj05023消费者，0002水面使用独立SceneWater；M3-05/M3-08父项保持开放。
