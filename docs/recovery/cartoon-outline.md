# 地图与战车动漫描边

M3-03-O。正式TankView每个动作组件及ScenePreview独立放置模型使用唯一render/materials/cartoon-outline入口，原cartoon.gbf的silhouette黑RGB与Ink0.65沿法线外扩。CartoonOutlineRenderer复用Babylon OutlineRenderer的绘制阶段、实例和世界变换，不复制网格、材质或动画。静态网格增加独立outlineNormal顶点流，在同一局部位置聚合并归一化法线，使硬边两侧沿相同方向外扩；原NORMAL继续用于光照。位置合并精度为0.0001模型单位。带morph、骨骼或烘焙顶点动画的网格沿原OutlineRenderer动画通道绘制。坦克所有后续动作加载调用同入口，地图源网格将轮廓用于实例。

地图alpha混合表面保留原透明表现；alpha测试平面贴片保留纹理轮廓，避免给招牌或树叶的整个矩形描黑。非平面alpha测试物件进入带纹理alpha测试的轮廓通道。连续地形不启用模型外扩描边，避免地形分块/材质接缝显露黑线；地图独立物件保留轮廓。

位置归组、法线合并与平面资格由资产阶段的 WASM 预计算，结果随 GLB 发布。客户端仅在合格静态网格首次注册时上传预生成法线，不在加载时遍历顶点或建立位置字符串与分组对象。生成入口、目录计数及本次验证范围见[几何数据离线预计算](../geometry-preprocessing.md)。

`createSceneRuntime` 在创建 `Scene` 后立即安装 `CartoonOutlineRenderer`，早于阴影、后处理和渲染循环。Babylon `ObjectRenderer.render` 会调用 `scene.getOutlineRenderer()`，即使当前还没有开启描边的模型；提前安装使离屏通道与模型共用自定义描边器，静态 `outlineNormal` 顶点流进入实际绘制。独立模型入口也调用相同初始化函数。

轮廓深度由 Ink0.65 外扩后的几何体决定，`CartoonOutlineRenderer` 将 `zOffset` 与 `zOffsetUnits` 设为0。Babylon 默认在颜色和深度两个轮廓通道使用负斜率及常量深度偏移；深度通道会将偏移后的外壳写入深度缓冲，可能遮挡后绘制的相邻车体部件。斜率偏移依赖屏幕投影，不能作为固定模型宽度的补偿。静态网格和带形变的坦克共用此深度设置，绘制通道、法线、贴图和动画采样保持现有实现。

每次轮廓绘制在调用 Babylon `OutlineRenderer.render` 前设置当前材质的面剔除、正面绕序与模板状态，绕序按有效网格的世界矩阵行列式处理镜像变换。Babylon 的颜色轮廓阶段位于 `Mesh.render` 的材质 `_preBind` 之前，仅调用原轮廓入口会沿用前一个物件的剔除状态；TAXI 等双面饰品接在单面战车之后时，颜色轮廓可能被剔除，而模型本体及后续深度轮廓已使用双面状态。当前颜色与深度轮廓均使用该物件的材质设置，实例和镜像相机沿相同规则处理。

## 静态几何证据

TAXI顶灯10003的59个三角形及顶点与原POL逐面一致，标牌顶部同位置存在分裂面法线。
发布HD模型含177个顶点，灯牌两端面保留，材质为 `doubleSided:true`；原图与HD源图的alpha全部为255，发布HD WebP为RGB。轮廓按当前双面材质绘制。
木栅栏obj05425的48个三角形及顶点与原POL逐面一致，焊接后的边均有两个相邻面，顶部封闭；
顶部角点同样具有不同面法线。沿原面法线独立外扩会在这些位置撑开描边，独立outlineNormal
使同位置的描边顶点保持重合。静态网格的新增顶点流随geometry释放，克隆及实例共享该流。

## 既有验收证据

node tests/browser-cartoon-outline.mjs：隔离Vite5298/Chrome9368，实际原0007地图/TankView1，1920×1080固定镜头开启关闭轮廓。地图独立物件534像素发生变化、143新黑边像素；地图+坦克2929变化、1435新黑边像素。正式地形网格全部renderOutline=false。8类以上实际动作几何保留法线/morph、黑色和宽0.65；移动02、开火03、死亡09、复活01均沿正式action加载/激活绘制，实际OutlineRenderer提交记录保存于JSON。开启关闭不增加网格和材质；清理后meshes/materials=0，scene共用BRDF纹理1在scene.dispose时释放。数据cartoon-outline-browser.json/log，地图与坦克前后截图和comparison.png。

全仓类型、浏览器验收脚本语法和隔离Web发行构建/tmp/cdtank-outline-dist通过，日志cartoon-outline-types.log与cartoon-outline-web-build.log；生产行为只涉及绘制，未改协议、账户或战斗规则。

## 未完成原精度

这是按原黑色法线外扩思想与Ink值接入的Web轮廓。Babylon使用自身多阶段轮廓，不是原cartoon.gbf的CCW背面单通道逐设备状态复刻。原25图角色texToon分层颜色、默认lightdir与Silhouette脚本选择已接，详scene-actor-toon-runtime.md；几何toon资格、全场景脚本选择和原D3D framebuffer仍待恢复。既有浏览器证据仅覆盖0007/战车1及所列动作，不覆盖静态outlineNormal通道。移除深度偏移与显式设置轮廓面剔除依据生产及已安装 Babylon 源码走查，未运行测试、构建、类型检查或浏览器验收，远处坦克的手机画面尚待确认。TAXI与木栅栏的视觉效果尚需浏览器实测，未证明全地图/21车或性能；父项M3-03/M4-07保持未完成。
