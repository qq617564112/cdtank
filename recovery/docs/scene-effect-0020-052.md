# 0020场景Effect052启动与所有权

原0020物件269–273的Effect052已接正式地图owner；五棵保留式树使用原物件矩阵，两个无限橙黄sprite沿原角速度推进。普通双001、两CPU对局中，双端实际绘制同源269的两sprite，原纹理/alpha/中心与静默、Leave及普通重入全部PASS。原header/tail、地图startup、retain=1、矩阵绑定与stop/release限定原执行PASS。

## 原地图生产链

`SYcScnObjEffect`类名地址`0x5c7020`；注册`0x5bdf88 → 0x460689`保存creator`0x45edba`。creator分配0xdc字节并调用`0x45eaf2`；具体constructor写vtable`0x5c75d8`，初始enabled为0。原公共header loader`0x44ea18`读取实际序列化enabled，五放置均为1。

原map loader`0x45b4b6`在`0x45baa6–0x45bacc`取`scene+0x18c/+0x190`物件集合，以8字节slot遍历并调用functor`0x4581b3`。functor分派每个物件vtable+0x6c；Effect对应`0x46228f`。专属native执行完整`0x4489f8 → 0x4581b3 → 0x46228f`，五个真实Effect物件分别触发一次创建与绑定。地图loader前面的资源加载阶段未执行，末段生产调用保留原反汇编。

`0x46228f`先处理旧声音和旧效果，再以sub+0x60原名调用`0x47b535 → 0x47aead`。后者实际以retain=1调用`0x4795fa`并调用`0x47a770`加入活跃集合。`0x4620e9`将sub+0x7c矩阵置identity后右乘物件+0x78矩阵；`0x45bf6c`复制8字节矩阵smart pointer，再以node vtable+0x34绑定。结尾启用物件与更新变换。

原Effect逐帧槽+0x14是`0x45795d`，返回而不创建效果；已执行五物件回调并确认无创建、绑定或播放事件。树时钟由原效果manager更新。关闭`0x462934(0) → 0x461e8f`先调用node stop`0x47f3c4`，再release`0x47f262`并清空sub+0x84；五树均执行一次stop与release。

## 五个原放置与效果资源

原`Data/scn/0020/0020.obj`：公共stamp`0x77836c85`、enabled1、rotation全0、bounds(40,40,40)、matrix为identity加下表translation。

| id | 文件offset | 原position |
| --- | --- | --- |
| 269 | 10059 | (420.344390869,88,−90.256782532) |
| 270 | 10279 | (1303.993408203,90,−181.667404175) |
| 271 | 10499 | (922.109375,85,−1161.082397461) |
| 272 | 10719 | (−1215.026000977,79,−405.326324463) |
| 273 | 10939 | (−1045.338134766,90,768.150756836) |

五tail均42字节。公共stamp`0x778346a2`；field04、field24为空，field20、field5c、field88为0，field60为`_root\online\052`；derived stamp`0x77834705`。原`0x45e50b → 0x461f60 → 0x44ea18`实际逐放置消费完整header与tail。

原`effect.sav`节点2987/id1634131803为Type0容器，孩子顺序为2988/id3172639838与2989/id1107762992；两者均Type1，无孙节点、无Type4声音节点。三个节点delay/lifetime均0。现有`effect-lifecycle-native.json`的原`0x47f61c`合同确认零lifetime持续活跃；`effect-tree-create-native.json`确认retain递归传至各子节点，原保留标志在node+0x3c。

| sprite | scale | angleRate Z | RGBA |
| --- | --- | --- | --- |
| light / 2988 | (40,40,40) | 15 | (1,1,1,0.40000000596) |
| light_COPY / 2989 | (45,45,45) | −10 | (1,1,1,0.66000002623) |

两sprite初始angles、scaleRate、colorSubtractRate、motion与orbit均0；无trail、无animation-end。modifier baseStart/baseEnd/baseFlag为0，frameInterval为原float0.02500000037。两sprite使用同一原`data\effect\xy\flarebrightorange_yellow3.tga`引用，解析到`Data/effect/xy/FlareBrightOrange_yellow3.dds`，已发布同路径PNG。原与发布4096 decodedRGBA像素完全一致，64×64，单帧全图UV。

公共sub默认field58=1选择空间声音入口`0x485b1b`。专属silent native以真实空field24、selector−1及269position执行原入口和原manager，原路径为`data\sound/.wav`；目录查询返回不存在，资源loader未达，descriptorValid=false，原finished=true且stop不达device。052没有可播放的对象声音或树声音节点。

## 正式消费者与生命周期

`export_scene_effect20_052.py`发布`scene-effects-0020.json`五个原enabled/name/matrix/position；`assets/scenes/map-scene-effects.ts`持有地图句柄。Battle在environmentSound.load后加载scene owner，然后effects.start；Leave/销毁释放scene owner。正式新round producer调用clearRoundEffects。

- `EffectRuntimeTree`末尾`retain=false`传入`createEffectTree`并由factory的retain参数传给`EffectNodeLifecycle`。场景052用true；已有调用保留false默认。
- `EffectRuntime.spawnSceneEffect(name,matrix,placementId?)`按原名创建retain树，origin=(0,0,0)，parentMatrix为原物件矩阵；await实际subtree纹理后加入现活跃instances并标记场景所有权。该入口不作初始frustum丢弃，允许正式map载入在effects.start前创建。实际draw metadata保存原placementId。sceneRevision与scene disposal检查阻止clear/stop后的晚纹理加入。
- `releaseSceneEffect(handle)`限定场景owned实例，调用tree.stop后直接remove/dispose，对应原stop/release双操作。不能只等待quiescent：retain节点结束仍保留，owner必须显式释放。
- `clearRoundEffects()`只移除普通instances并清理round声音/相机作用；`clear()`与`stop()`保持全释放。Battle `beforeSnapshot`中真实新round调用clearRoundEffects。
- `MapSceneEffects.load(mapId)`先clear，以revision隔离晚加载；0020验证mapId后按原记录建立五树，每个成功句柄立即归owner。`clear()`立即释放已完成的树，迟到句柄独立释放；部分失败释放本次已分配句柄，未取消却返回0则报载入错误。EffectRuntime现update与render observer推进和绘制同一instances；owner无独立advance或逐帧重新生成。
- 052生命周期随地图载入与释放；round保留为当前Battle round清理适配地图所有权，原客户端再战业务producer尚未恢复。

## 验证产物与边界

`tests/scene-effect20-052-native.py`、`recovery/evidence/audio/scene-effect20-052-silence-native.py`、`tests/scene-effect20-052-source.py`全部PASS。对应`recovery/output/scene-effect20-052-{native,silence-native,source}.json`，生产链反汇编为`scene-effect20-052-native.disasm.txt`。

native供给边界为公共物件分配/初始化、stream和字符串存储/identifier登记、效果名→ID查询、树分配与活跃登记、矩阵运算及引用增计数、node绑定/stop/release、导航与物件变换回调；具体Effect constructor、header/tail读取分派、map遍历/virtual startup、manager retain选择、smart pointer复制、空声无效分支和关闭分派执行原指令。声音专项只供给heap、已初始化singleton及真实目录查询Windows接口。

`scene-effect20-052-rules.json`为PASS：生产NullEngine实例与原published配置验证场外start前五树/十五retain节点、round保留同一live树、全clear、sceneRelease不误删ordinary handle、stop/dispose晚纹理、owner晚句柄、第二棵pending时立即release第一棵且迟到第二棵不造第三棵、部分失败和unsupported map清理。纹理资源供给为单像素，声音未配置；实际纹理和业务入口见普通browser。既有tree-create与online006默认非retain合同由主任务限定回归PASS。

## 普通双端实战

`browser-scene-effect20-052-2026-10-04T01-52-08-527Z.json`为PASS。普通mode5/0020双001、两CPU、Ready与实际autopilot按钮，无position/HP/time/camera/通知注入。实际软件画布320×180，默认autoplay。

两端各五棵保留式原树，parentMatrix逐值对应269–273。自然观察时五棵tree均phase2，树时钟分别1.5383秒/0.6406秒；两sprite Z angle分别23.074499/−15.383000度与9.608999/−6.406000度，符合原15/−10度每秒，scale与float RGBA保持原值。每端map spawn计数5，没有逐帧重启。

共同269的sprite2988、2989实际draw计数各15次/4次；每sprite至少两组不同自然旋转顶点，实际顶点centre与原269反射X后的position相同，六顶点白RGB及source packed alpha分别102/255与168/255。实际材质texture均为原发布`FlareBrightOrange_yellow3.png`；两端自然截图保留。五位置独立补验复用保存实战观察，269–273各两端两个sprite三组自然姿态/原中心尺寸UV与十张实际PNG全部PASS，见[五位置资格](scene-effect-0020-052-positions.md)。

052没有Type4节点，原空空间声查找为invalid；正式scene owner不创建对象声，两端观测没有空声音名或052播放。正常场景音乐、环境sound、开火声仍独立存在。

双方普通Leave后instances/ownerHandles/sourceMeshes/sceneVoices/battleVoices五计数均0。普通新房0020双端重入各创建五个全新handle，累积spawn10，再次Leave五计数全部0。`scene-effect20-052-actual.json`独立逐源核矩阵、scale/color/角速度、实际顶点/纹理/packed alpha/centre与退出重入PASS。

`browser-scene-effect20-052-round-2026-10-04T02-03-25-402Z.json`为独立自然再战专项PASS。普通180秒第一局双端自然FINISHED，双方普通rematch按当前业务保留ready并自动进入round2 PLAYING。每端仍持原handle1–5、五个原matrix，累积spawn仍5，无restart。树时钟从FINISHED的182.331589/180.964798秒持续至round2的182.694992/181.251404秒，角度继续推进；共同269的两sprite每端各新增实际draw2次。普通Leave后instances/ownerHandles/sourceMeshes均0。`scene-effect20-052-round-actual.json`独立核同树/同matrix、时钟角度连续、round2双端实际draw与清理PASS。

独立`scene-effect20-052-process-cleanup.json`与最终再战专项`scene-effect20-052-process-cleanup-final.json`分别核3302/5332/9532无监听、专属临时目录无残留。统一Web类型/构建由主任务执行。

## 限制

decoded像素比较不证明原GPU采样；完整原地图load、矩阵DLL执行与NAV为明确供给边界。软件小画布不提供高清性能资格；原客户端再战producer未恢复。

主线集成最终：scene052-card-button-web-build.log Web类型与正式构建1m23s PASS，scene052-card-button-boundaries.log316运行模块边界PASS；两个限定切片共享同一工程证据。root独立saved业务与实际PNG核验见scene-effect20-052-root-review.json/room-card-button-root-review.json及scene-effect20-052-round-root-verifier.log。无账户/服务规则变更，不复跑五模式、账户重启或serverbuild。
