# Map21 原完好木桶材质

归入M3-06原材质表现及M3-07原放置消费者覆盖；整图与全原材质父项保持开放。

原合法mode5/map21的八条启用Breach/obj05467由已执行原loader4610f1加载同目录obj05467.POL到+dc，默认+e4指向完好模型。loader身份直接复用scene-breach21-native.json，不重复执行原加载器或破坏通知。

POL为单object08、FVF21、kind0、obj05467.TGA。scene-breach21-intact-material-source.json/log核342展开顶点的原位置、UV和packedRGBA与发布GLB逐值一致，原材质factor一致。原shader selector复用scene-terrain02-material-native.json，geom_c1无照明texture乘packed diffuse；General11已验证相同原shader的实例矩阵消费机制。

正式ScenePreview仅在map0021的Breach/obj05467上按unique缓存资产注册SceneBreachMaterial。注册位于revision有效检查之后；加载失败沿现有clear清理，离场在资产dispose前还原原材质并释放shader。其余场景owner和破坏消费者保持现有所有权。

scene-breach21-intact-material-module.json/log通过真实原GLB输入、两实例不同世界矩阵、原纹理借用、opaque/WRAP/LINEAR/LESS/write以及owner还原释放。scene-breach21-intact-focused-types.log的Web类型检查出口0。

玩家验收起点为正常mode5/map21四帐号入房与Ready，随后普通出生W/A、完好木桶材质实际draw与完整画布，终点为双正常Leave worldnull与材质owner清理。专属browser-scene-breach21-intact-material.mjs使用3511/5541/9741；不涉及射击、破坏状态或GA13。

## 未完成范围

首段browser-scene-breach21-intact-2026-10-05T06-18-39-894Z.json保持FAIL。host普通W位移104.99769、A转向.192后八个原mesh各146次draw，natural完整画布木桶木纹与箍环可辨。guest普通W位移0、A转向.192，完整失败画布木桶可见；原仪器以位移20作为draw采样前提，guest记录0不能证明材质未绘制。该段无成功normalLeave字段，finally双ownerfalse/material0单独成立。具体范围见scene-breach21-intact-player-gap.json。统一发行待主线工程出口。八条放置逐实例像素、原GPU/CW/过滤精度、高清和整图父项保持开放。

M3-06本片正式起点为正常React选择原mode5/map21，双认证网页与两个正常认证辅助帐号建房/加入/Ready；仅普通出生W/A后观察原完好obj05467材质实际draw与双完整画布，普通Leave等待worldnull后检查材质owner和shader计数。原账户、地形、伤害及c9实际证据直接复用，首验不射击。

定向保存段browser-scene-breach21-intact-2026-10-05T06-24-21-348Z.json同样保持FAIL。普通W/A均完整释放后inputCompleted为true，host八个原mesh累计1160次实际draw；scene-breach21-intact-actual.json离线逐值确认342原顶点及八条放置世界矩阵。host自然完整图可辨木纹与箍环。guest完整失败图可见木桶，但专属材质draw记录仍为0，具体目标绘制归因缺口未知；首段位移门禁不是全部缺口原因。两段均缺成功normalLeave字段，双finally ownerfalse/material0与全部进程清理成立。该片保留host合同与画面有限范围，双端原材质draw、正常Leave、全八放置独立像素及原GPU/HD父范围未完成。
