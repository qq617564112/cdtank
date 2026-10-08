# 资产来源与用途索引

`asset-usage-index.json`以`catalog/inventory.json`的4665个路径为闭集，逐条保存原selected、versions、selectionBasis和patchPending。所有4665条均有当前唯一已解码来源；32份下载补丁与当前归档内容相同的结论沿用来源清单，不重新选择补丁文件。

现有发布元数据明确关联3880条资产，785条未匹配。共27145个来源/产物引用，另有2570个不在闭集的引用、涉及381个不同key，单独列于outsideReferences。未匹配表示本次元数据范围尚无引用，不表示原游戏不会加载。

索引覆盖POL/MV3/CVD转换、原25场景及已发布测试/美术变体与battlefields、战车动作/INI、UI布局/图集/字库、声音、ELK/效果库/效果模型/路径/挂点，以及24张解码表与combat-catalog。每个引用保留metadata文件、JSON Pointer、原字符串、规范化路径、关联产物和用途。`loadingCode`一次扫描apps的`.ts`与`.tsx`源码，实际包含metadata文件名时记录文件、行号和原代码；Home、等待房间、结算及设置等正式React页面的加载入口纳入相同索引。这个入口是代码引用证据，不是单个资产已加载证据。没有代码引用的转换清单保持空数组。

React加载入口已随导出器写入当前全量索引；Home、等待房间、结算、设置、商城和交易页面的明确`ui.json`/`combat-catalog.json`加载入口均记录在对应引用的`loadingCode`中。该入口只是代码引用证据，不把`ui.json`或目录的加载算作其中任一资产的浏览器实载或原表现验收。

原1至25图的`scene-effects-XXXX.json`与`scene-environment-sound-XXXX.json`按两个地图owner的实际四位mapId路径模板记录加载入口，保留模板所在文件、行号和代码。只有这两种准确文件名参与此映射，不扩展到取证或其他相近名称。此范围随全图环境目录接线实现，已进入当前重新导出的全量索引；实际运行仍按对应实测范围登记。

解码表引用另记录服务端明确的`sourceTablePath('名称')`调用，以及`config.ts`中`readTable('tank')`、`readTable('pet')`与显式五模式范围生成的`m001`至`m005`入口。每条保留具名调用、共同读取函数及`CONTENT_TABLES`路径解析的文件/行号/代码；未找到调用的表仍为空，不把相近文件名算作加载来源。TS/TSX与表入口实现已在`ca86c6d...be2401c`范围完成一次集中静态走查，无P1/P2问题；表入口已进入当前全量索引，统一`runtimeAcceptance`保持原范围。

明确source→output/asset映射将glb/png使用反向关联源POL/MV3/CVD/DDS；战车动作file相对component.ini目录解析；UI裁切区域关联Imagefile原图集纹理，region名字不是同名独立TGA文件。场景OBJ/CAS/BOX、地形POL/出生RPT/NAV、城堡INI、effect.sav与combat三张源表由导出器明确构造源路径，记录sourceConstruction的代码文件、行号和语句，保留与直接元数据引用的区别。

路径统一Windows斜线与大小写，去除已提取data/Data或CDTank/Data前缀。不按相近文件名、后缀替换或资源名字猜来源。outsideReferences保留效果原TGA引用、未发布模型路径、独立music归档及非Data二进制证据引用；已有显式published source映射者另标publishedResolvedSource。外部引用并不统一解释成文件丢失。

199条原加载入口具有已有原执行证据：24份DAT、174份WAV及Logo.bik。各行originalLoading引用asset-loose-entry-sol.md及原执行JSON，原入口分别为41a2ff→418e4a→40483a、485920→575a03→575beb disk、447284→4484b9→448407。其余4466条的原入口统一标unknown；本索引没有进行新的EXE/DLL加载执行。

所有资产与引用的runtimeAcceptance均为`not-established-by-index`。转换文件、元数据关联及代码入口均不代表浏览器实载或原表现验收。已有单项浏览器/native测试的验收范围继续由对应运行文档维护，M3-02整体仍未完成。

复现：

```sh
recovery/.venv/bin/python recovery/export_asset_usage.py > recovery/output/asset-usage-export.log
recovery/.venv/bin/python tests/asset-usage-index.py > recovery/output/asset-usage-test.log
```

测试检查4665闭集顺序/唯一性、selected完整保留、引用路径规范化、每个JSON Pointer实际存在、每条加载/来源代码行精确一致、闭集外引用独立以及汇总数量一致。若失败，应修复来源关联或索引结构，不能据失败补造运行结论。`asset-usage-summary.json`提供未匹配后缀、外部引用来源根与各元数据引用计数，供后续按明确缺口继续恢复。


## 地图资格与角色toon

动态地形材质文件从`hasSceneTerrainMaterial`的正则取得0001–0025资格，植物文件从`ScenePlantSway.load`完整跨行名单取得资格；1002读取`FIELD_ROAD_HD.sceneId`定义。每条保存原代码行和实际地图范围。放置动画与真实fallback破损库保留具体mapId/placementId/JSON Pointer及加载入口。

`scene-actor-toon.json`保留原`Data/image/toon/0.bmp`及25份ctl的source。BMP的显式派生关系指向`scene/actor-toon/0.png`，原文件与PNG均关联`SceneActorToon`元数据加载入口；引用数为27。来源和代码关系不改变runtimeAcceptance。

## 原模型纹理与嵌入产物

三种转换清单的964个原POL/MV3/CVD均实际解析首纹理字段，逐材质核对GLB的material.name。转换器明确以源模型同目录建立完整文件名及stem+`.tga`别名映射；这里只接受恰好一个原纹理候选。该规则来自convert_pol.py/convert_mv3.py/convert_cvd.py的实际代码，不把全局同名或后缀相近文件作为来源。

4381个材质纹理引用实际对应GLB image的bufferView内嵌PNG；本批GLB不使用image URI。每次关联均比较内嵌PNG字节与转换器同相对目录输出的PNG字节，记录原模型key、原纹理字符串、材质/image索引、PNG路径、GLB路径与转换器代码证据。该比较验证实际产物来源，避免仅凭产物名称关联；不证明原纹理显示行为或浏览器已解码。

964原模型4381处GLB嵌入纹理按同目录唯一来源与PNG字节核对；迷彩目录另关联711条记录/680个精确DDS请求的1361条source/asset引用。当前未匹配DDS360项。44处GLB纹理问题仍单列textureIssues，角色运行覆盖不修改静态引用来源。验证逐原字段核对同目录候选、内嵌PNG、选定DDS像素、JSON Pointer及代码行（owned-textures-asset-usage.log）。未匹配资源用途和全部原加载入口仍待恢复。

## 0021环境声音运行证据

`scene-environment-sound-0021.json`发布原0021 OBJ中Sound143/BG06、168/BG12、169/BG11的尾部参数与原坐标；资源继续使用`audio.json`已发布的原WAV。正式消费者为`audio/map-environment-sound.ts`，从Battle地图生命周期借用EffectRuntime声音上下文。原loader/启停执行和双网页普通CPU/AI实际循环、距离增益、静音恢复、重赛去重、离房/断线重入的范围见[0021环境声音](scene-environment-sound-0021.md)及`scene-environment-sound21-native.json`、`browser-scene-environment-sound21.json`。本专项运行证据仅覆盖0021三个BG；资产全量索引的统一runtimeAcceptance保持其原范围。

## 0020环境声音运行证据

`scene-environment-sound-0020.json`随标准场景导出发布原Sound268/BG08完整35字节尾部参数与原位置，沿用`audio.json`原WAV。`MapEnvironmentSound`从既有Battle地图生命周期消费0020。原构造器/loader/启停、完整字段与WAV字节、普通双001/两CPU/Ready/W-A-D移动的实际循环回绕、双端距离增益、静音进度与Leave断开证据见[0020环境声音](scene-environment-sound-0020.md)、`scene-environment-sound20-{native,source}.json`及`browser-scene-environment-sound20-2026-10-04T00-05-00-192Z.json`。本项运行资格覆盖Sound268/BG08，资产索引的统一runtimeAcceptance保持其原范围。

## 0002近障碍即时射击效果

普通场景目标射击沿item2001→skill4020消费原online007及SE30。`browser-muzzle-block-map2-first-shot-visual.json`从真实source玩家、同shotDisplay端点、实例handle2、双端实际几何/可辨截帧、SE30结束和自然到期记录建立独立视觉验收；离房五资源0单独关联同生产run8记录。范围见[0002近障碍炮口射击](combat-muzzle-block-map2.md)。此源即时效果不作为terrainHit独立碰撞效果或飞行消费者的恢复证据。

## 小勇士001原死亡与自然复活

原001四09 MV3、M/U定时effect1及完整001.elk无09组由`combat-death-t01-source.json`对应发布四GLB与ELK。`combat-death-t01-actual.json`关联普通0007同destroy双可见09/保留5501尾帧、独立双端四01自然复活、死者静默与击毁者GA14，以及普通离房重入五资源0。范围和总体FAIL来源的分段证据见[小勇士001死亡与复活](combat-death-t01.md)。该专项不改变全量索引的统一runtimeAcceptance，也不代表独立残骸或飞行实体已恢复。

## 0021破坏后的碰撞与实际通行

`breach21-collision-b-actual.json`关联普通双网页同原62/obj05468的六原c9节点及GA13结束、正式完整/渐隐覆盖与释放、真实CPU中心进入原水平footprint和存活弹丸B261穿越原OBB。独立普通自然再战恢复73覆盖、离房浏览器五资源及房间动态覆盖均0。来源整体FAIL和专项PASS分段保留，范围见[0021实际通行与弹丸穿越](scene-breach-0021-collision-b.md)。原NAV内核/收集器及覆盖策略仍为重建，不扩大统一runtimeAcceptance。

## 0020 obj05460首件破坏资源

`scene-breach20-05460-native.json`证明原obj05460 POL/c9 loader、GA12一次分派与重复静默；`scene-breach-0020.json`只发布该型号c9十节点及同目录纹理。正式ScenePreview按map0020/model05460选择独立资源库和GA12，范围见[0020 obj05460首件](scene-breach-0020-05460.md)。普通双网页同319原十节点c9/GA12、原旋转OBB释放、两个普通输入玩家进入及存活弹丸通行，与独立普通再战/离房专项已取得；分段实际范围见scene-breach-0020-05460-browser.md。其余0020型号及原NAV内核保持未恢复。

## 0020 obj05461原破坏与普通输入通行

`scene-breach20-05461-native.json`原完整POL/c9加载、GA41一次分派及重复静默PASS；`scene-breach-0020.json`独立05461六节点/同目录纹理，由ScenePreview型号资格消费。普通同274双网页完整PASS为`browser-breach20-05461-2026-10-03T22-49-39-834Z.json`：原c9实际绘制/GA41播放结束/隐藏、原OBB释放、普通输入玩家进入AND存活B34实际穿越、自然结算/再战恢复/离房五资源及动态覆盖0。初次整体FAIL保留，范围见[0020 obj05461](scene-breach-0020-05461.md)；原NAV内核及其余地图/型号不扩大统一runtimeAcceptance。

## 0020 obj05462原破坏与普通输入通行

`scene-breach20-05462-native.json`原POL/c9加载、GA41一次分派与重复静默PASS；`scene-breach-0020.json`独立七节点原资源/同目录纹理由正式ScenePreview型号资格消费。`browser-breach20-05462-2026-10-03T22-58-32-540Z.json`完整PASS：同320双端原完整POL/七c9/GA41结束/隐藏，原88度旋转OBB释放，普通输入P1/P4进入AND存活B52真实穿越，自然结算/再战恢复/离房五资源及动态覆盖0。范围见[0020 obj05462](scene-breach-0020-05462.md)；原NAV内核与其他放置不扩大统一runtimeAcceptance。

## 0020 obj05442原空根与普通输入通行

`scene-breach20-05442-empty-native.json`原gbGeomNode空根identity/无geometry及slot0保留PASS，`scene-breach20-05442-native.json`原POL/c9加载与GA41一次分派PASS。正式0020库保留八序列节点、七原geometry(1..7)及原纹理。`browser-breach20-05442-2026-10-03T23-21-05-452Z.json`完整PASS：同279双端七c9/GA41结束/hidden、OBB2014ms释放、普通输入P1/P4进入AND存活B76穿越、自然结算/再战恢复/双Leave五资源及动态覆盖0。范围与失败独立留存见[0020 obj05442](scene-breach-0020-05442.md)；原NAV内核及其余放置不扩大统一runtimeAcceptance。

## 0020普通001非致死05受击

`combat-hit-t01-0020-source.json`核四原05 MV3/INI duration2561、M/U time160消息及完整001.elk无05组PASS。`combat-hit-t01-0020-actual.json`局部记录核验PASS：同P4两个普通selector1 hit，双四原GLB实draw/非恒定morph逐clock原采样匹配、M/U静默及四over2461完成→01。原browser主FAIL保留，不把错误消息分类断言修复当作主PASS；PNG仅从原capture恢复，未执行Leave，未改消费者生命周期引用有效05442/001死亡证据。范围见[001/0020普通05受击](combat-hit-t01-0020.md)，不扩大父生命周期或全战车验收。
