# General06 原静态木箱材质

合法mode1/map6的六条启用SYcScnObjGeneral/obj05424现使用原geom_c1纹理乘packed diffuse材质。正式ScenePreview在revision有效后仅对0006/classGeneral/model05424的unique缓存资产注册一次，失败沿clear清理，离房在assets释放前还原原材质并释放shader。现有Castle06、地形、声音、Plant及其他场景owner维持原有边界。

原POL为单box01、FVF21/kind0、36展开顶点、obj05424.tga。scene-general06-material-source.json/log逐值确认原POL与发布GLB位置、UV、packedRGBA及原DDS→内嵌PNG的完整RGBA一致。具名General4606d3加载、44dd82对象矩阵与45e9d2→gbGeomNode.Attach直接复用General11来源，原shader selector复用terrain02，无新增native执行。

SceneGeneralMaterial.register具名model参数仅接受obj05431/obj05424，默认保留General11原接口、anangua04/0及materialname general11/；新资产明确匹配box01/0与general06/。真实GLB模块检查覆盖36顶点不变、两实例共用材质/不同世界矩阵、opaque/WRAP/LINEAR/LESS/write、owner还原释放与借用纹理保留，并检查原默认05431接口。scene-general06-material-module.json/log为PASS_MODULE_ONLY，focused Web类型出口0。

## 普通玩家有限交付

browser-scene-general06-2026-10-05T06-43-42-606Z.json为PASS_HOST_MATERIAL_NORMAL_LEAVE。正常React mode1/map6四认证帐号建房/加入/Ready；双网页普通出生W/A，host随后沿新物件原NAV七段候选路线以普通W/A/D抵达17.9,1459.19。保存598次实际按键采样，无位置、相机或场景状态注入。

host近点原box01/0实际硬件batch绘制1次、36原顶点，batch含242/243/244三个原放置；完整natural1280×720画布左前方木箱木纹、顶部板面与深色框边可辨。guest实际151次draw，batch含239–244六个原放置，完整画布面向墙与木桶，不据batch计数宣称guest木箱独立像素通过。scene-general06-actual.json逐值确认双端所记录放置世界矩阵。

双正常Leave等待worldnull后ownerfalse/material0，最终同样归零；browserErrors为空，3513/5543/9743及Chrome/Vite/server/临时目录全部清理。scene-general06-material-player-evidence.json保存精确范围和完整图索引，待主线有限主审及下一统一发行工程。

## 未完成范围

guest近处木箱像素、六实例逐个像素、原GPU/过滤精度、高清与整图父范围保持开放。本片不扩Castle06受损/81权限或声音旧缺口。
