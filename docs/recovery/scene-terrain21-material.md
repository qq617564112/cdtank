# Map21 原地形材质

原0021.POL有57个mesh、104个分片，71个kind0、33个kind1，全部FVF21。发布GLB的25500个展开顶点保留原UV与packedRGBA，其中962个非白顶点。

`export_scene_terrain21_material.py`登记全部104个mesh／kind／shader／首纹理身份。kind0使用geom_c1，kind1使用geom_t_c1；颜色由纹理乘原顶点色输出，不乘PBR材质因子。

plane04/0原首纹理为空，原材质diffuse为[0.58431375,0.58431375,0.58431375,1]。geom_c1关闭Lighting，D3D9的空纹理规则停止当前及后续纹理阶段，因此消费者直接输出原FVF21顶点色，不额外乘材质diffuse，也不参与Babylon半球光。

原来源见scene-terrain21-material-source.json；现生产输入与逐图核对见[map-lighting-audit.md](map-lighting-audit.md)。贴地软阴影为独立视觉增强，见[ground-contact-shadows.md](ground-contact-shadows.md)。

## 限制

既有普通玩家证据scene-terrain21-material-player-evidence.json仅覆盖其记录的有纹理分片、普通移动或转向和退出清理。本次104片登记与空纹理路径未执行测试、浏览器验收、构建或类型检查；全部分片原GPU像素、CW与过滤精度仍未逐项实测。
