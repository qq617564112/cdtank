# 0020 obj05460首件破坏资源

首件选择原0020的obj05460，共7个放置（277、292、299、307、318、319、333）。它具有完整的原POL来源、独立同目录c9.CVD和有厚度的原bounds；首个放置277的bounds为`[96.14253234863281,75.77315521240234,148.7547149658203]`。0020其他型号首件中obj05434/35/36的z厚度接近零，本片不以它们代表可通行破坏范围。

原二进制loader执行`obj05460.pol`→`c9.cvd`，destroy分支执行`GA12`一次并以物件位置传入；重复destroy不再播放。证据为`tests/scene-breach20-05460-native.py`及`recovery/output/scene-breach20-05460-native.json/.log`。发布器`recovery/export_scene_breach20.py`仅发布`Data/scnobj/obj05460/c9.CVD`到`scene-breach-0020.json`，实际包含10个CVD节点和同目录纹理。

正式ScenePreview只在map0020且placement.model为obj05460时选择该资源库和GA12；map0021仍按四型号各自资源库及GA13。SceneBreachVisual通过必需的libraryAsset接口载入，不复用0021库或硬编码六节点假设。

普通双端原十节点c9/GA12/隐藏、碰撞释放、普通输入玩家进入和存活弹丸通行已由22-32-36改良运行取得，普通自然再战/离房由独立22-37-01专项PASS补齐，破坏段整体FAIL保持原样；实际范围见[普通战斗验证](scene-breach-0020-05460-browser.md)。0020其余型号和原NAV内核不在范围内。
