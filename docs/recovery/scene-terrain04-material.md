# Map04 原地形材质

原0004.POL有56个mesh、150个分片，127个kind0、23个kind1，全部FVF21。发布GLB的44298个展开顶点保留原UV与packedRGBA，其中4233个非白顶点。

`export_scene_terrain04_material.py`登记全部150个mesh／kind／shader／首纹理身份。kind0使用geom_c1，kind1使用geom_t_c1；颜色由纹理乘原顶点色输出，不乘PBR材质因子。

box2162/3、line589/3、line590/3、box2172/3的原首纹理为空。D3D9在COLORARG1=TEXTURE且纹理指针为空时停止当前及后续纹理阶段，因此消费者的无SOURCE_TEXTURE分支直接输出FVF21顶点色。这四片使用原unlit路径，不参与Babylon半球光。

原来源见scene-terrain04-material-source.json；现生产输入与逐图核对见[map-lighting-audit.md](map-lighting-audit.md)。贴地软阴影为独立视觉增强，见[ground-contact-shadows.md](ground-contact-shadows.md)。

## 限制

既有普通玩家证据scene-terrain04-material-player-evidence.json仅覆盖其记录的有纹理分片、普通移动和退出清理。本次150片登记与空纹理路径未执行测试、浏览器验收、构建或类型检查；全部分片原GPU像素、CW与过滤精度仍未逐项实测。
