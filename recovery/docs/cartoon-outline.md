# 地图与战车动漫描边

M3-03-O。正式TankView每个动作组件及ScenePreview独立放置模型使用唯一render/materials/cartoon-outline入口，原cartoon.gbf的silhouette黑RGB与Ink0.65沿法线外扩。Babylon OutlineRenderer使用原网格的实例、世界变换、位置及法线morph，不复制网格、材质或动画。坦克所有后续动作加载调用同入口，地图源网格将轮廓用于实例。

地图alpha混合表面保留原透明表现；alpha测试平面贴片保留纹理轮廓，避免给招牌或树叶的整个矩形描黑。非平面alpha测试物件进入带纹理alpha测试的轮廓通道。连续地形不启用模型外扩描边，避免地形分块/材质接缝显露黑线；地图独立物件保留轮廓。

## 验收

node tests/browser-cartoon-outline.mjs：隔离Vite5298/Chrome9368，实际原0007地图/TankView1，1920×1080固定镜头开启关闭轮廓。地图独立物件534像素发生变化、143新黑边像素；地图+坦克2929变化、1435新黑边像素。正式地形网格全部renderOutline=false。8类以上实际动作几何保留法线/morph、黑色和宽0.65；移动02、开火03、死亡09、复活01均沿正式action加载/激活绘制，实际OutlineRenderer提交记录保存于JSON。开启关闭不增加网格和材质；清理后meshes/materials=0，scene共用BRDF纹理1在scene.dispose时释放。数据cartoon-outline-browser.json/log，地图与坦克前后截图和comparison.png。

全仓类型、浏览器验收脚本语法和隔离Web发行构建/tmp/cdtank-outline-dist通过，日志cartoon-outline-types.log与cartoon-outline-web-build.log；生产行为只涉及绘制，未改协议、账户或战斗规则。

## 未完成原精度

这是按原黑色法线外扩思想与Ink值接入的Web轮廓。Babylon使用自身多阶段轮廓及深度偏移，不是原cartoon.gbf的CCW背面单通道逐设备状态复刻。原25图角色texToon分层颜色、默认lightdir与Silhouette脚本选择已接，详scene-actor-toon-runtime.md；几何toon资格、全场景脚本选择和原D3D framebuffer仍待恢复。当前仅验证0007/战车1及所列动作，未证明全地图/21车或性能；父项M3-03/M4-07保持未完成。
