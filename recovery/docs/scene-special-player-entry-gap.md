# 特殊场景物件入口与剩余接线

地图0008、0012、0013、0016已有普通选图、建房与等待房间换图入口。服务端`config.ts`的MAPS由`playableMapDirectory`在原模式表基础上读取已发布场景扩展；四图均有模式1/3/4/5，0008、0012、0013另有真实Castle的模式2入口。入口规则见[可玩地图](../../docs/playable-maps.md)。

| 地图 | 原ID | 类型 | 原模型 | 原enabled | 当前接线 |
| --- | --- | --- | --- | --- | --- |
| 0008 | 446、447 | Sequence | obj05023 | 1 | 普通消费者和metadata已接，实测待做。 |
| 0013 | 204、205 | Sequence | obj05023 | 1 | 普通消费者和metadata已接，实测待做。 |
| 0012 | 321 | Hook | obj05027 | 1 | special专属消费者与metadata已接，实测待做。 |
| 0016 | 328 | WaterFall | obj05202 | 1 | special专属消费者与metadata已接，实测待做。 |

记录来源为对应`Data/scn/NNNN/NNNN.obj`，经现`read_scene`解析；当前发布记录见`recovery/output/web-assets/scene-placements.json`。模型目录中有原Sequence POL/四序列DDS/INI delay100、Hook c1.MV3/INI、WaterFall POL/五DDS。

Sequence已由`ScenePreview`调用`SceneSequence`完成静态主体、screen与四帧的load/advance/clear及失败清理。`scene-sequence05023.json`已由定向publisher发布，四条记录的resolved已同步；普通加载、可见性、双端与高清仍待实测。来源与运行合同见[scene-sequence05023-source.md](scene-sequence05023-source.md)、[scene-sequence-runtime.md](scene-sequence-runtime.md)。

Hook与WaterFall已接专属消费者及发布metadata，分别消费c1/spout/059和原POL/透明材质/五序列纹理，见[scene-hook-waterfall-runtime.md](scene-hook-waterfall-runtime.md)。原loader/update/draw完整合同、Hook绑定与瀑布时基仍有采用规则边界。

本页状态来自静态核对。普通对局、双端可见性、像素、高清与完整原行为仍待各自验收，M3-05/M3-08父项保持未完成。
