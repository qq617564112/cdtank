# M3-08 Castle伤害浮字入口

现正式单次Castle受损已输出onCastleDamageText(delta)，原45d16f每次调用45cc99(delta)；网页未绘制。只登记这个玩家可见缺环，不把通知当浮字恢复。

## 已确认来源

45cc99静态原指令将delta以10进制itoa转字符串，读取Castle+58原position，经过现相机服务投影，再由44ef2c/44ef47依viewport转屏幕坐标；465dfe selector1构造原记录，45ca48将0x48字节记录入Castle+1c8专属队列。上述未执行native，不算动态PASS。

selector1原字体名Damage。已正式发布ui-fonts.json的Damage记录来自Data/ui/fonts/Damage.font，Static原smjs_sz_0.imageset、AutoScaled true/800×600；0–9十精确原图已恢复，直接复用ui/regions/8对应asset，不制造数字替代。原构造+3c/+40/+44存0.5/1/40，更新合同见下表。

## 原记录更新

`castle-damage-text-update-native.py`直接执行原`46449f`，供给selector1记录字段，不hook更新指令或使用替代公式。九组记录覆盖零delta、0.5秒淡出边界、1秒删除边界与越界步长，结果见`castle-damage-text-update-native.json`，状态`PASS_RECORD_UPDATE_ONLY`。

| 字段 | 原消费者行为 |
| --- | --- |
| +04 | 屏幕Y，每步加delta×+44并存f32 |
| +28 | 绘制X/Y缩放；由Castle更新的相机距离分支生产 |
| +2c | 绘制alpha，初值1 |
| +30 | elapsed，每步加delta并存f32 |
| +3c | 淡出开始阈值0.5；严格超过后才更新alpha |
| +40 | 结束阈值1；elapsed≥1返回删除标志 |
| +44 | Y变化率40 |

alpha为`(1−elapsed)/(1−0.5)`，超时步长允许产生负alpha，更新函数不钳制。比较使用原x87尚未写回的elapsed和；1秒时alpha0且返回删除标志。该执行只证明记录算术与返回值，不证明队列实际删除或普通玩家显示。

## Castle队列与绘制入口

`45dbff`遍历Castle`+1c8`队列，调用`46449f(delta)`；返回true时经`45db55`移除当前记录。`45c08b`遍历同一队列并调用`465196`绘制。Castle析构`45d0ce→45caa0`清理队列。

`castle-damage-text-queue-native.py`执行原`45dbff/45db55/45caa0`及原CRT绝对值函数，供给原单记录ring布局；相机matrix stack/transform、CEGUI字符串释放和allocator为记录边界。四组正/负camera-depth与到期样本证明scale为`f32(250/abs(viewZ)+f32(0.2))`，更新时重新计算，而初始屏幕X/Y留在记录中；1秒时移除记录并释放其文字，记录storage仍由队列保留。队列dispose释放剩余文字、记录storage和table，最终count/capacity/table均0。输出`castle-damage-text-queue-native.json`为`PASS_CASTLE_TEXT_QUEUE_SERVICE_BOUNDARY`，不证明原完整相机对象或系统heap/GPU运行。

`castle-damage-text-draw-native.py`执行原`465196`selector1分支，通过CEGUI服务记录边界验证四组绘制：alpha正值提交字体`+34`、缩放`+28`与alpha`+2c`；屏幕X减去原Font.getTextExtent返回宽度的一半，Y使用更新记录值；clip为当前viewport，格式0、z0、X/Y相同scale。alpha0或负值不调用字体服务。结果`castle-damage-text-draw-native.json`为`PASS_SELECTOR1_FONT_SERVICE_BOUNDARY`。CEGUI字符串/颜色/矩形构造、测量和draw由记录服务供给，此执行证明调用参数，不证明实际原字体光栅或图字。

`castle-damage-text-static-gap.json`保留为历史静态输出；其中`45ce4e/45cc0f/45c7b1`与下游`40c4d6`的Castle队列归属不接受。当前队列依据以`castle-damage-text-update-native.json`的原反汇编与独立更新执行为准。

## 实施前具体缺环

正式事件`MsgRoomEvent.castleDamage{castleId,currentHP,maxHP,delta}`与`Battle→ScenePreview.damageCastle`已存在；位置可复用同castle的原sourcePlacement/entity，不需新增快照、伤害producer或服务器规则。

完整原相机/projection内部与原字体GPU像素保持未验；普通对局双端Web图字已由下方首次证据覆盖。隔离构造探针在CEGUI字符串/字体全局初始化边界未完成，不能据记录服务宣称原字体实绘。记录时序、字体调用参数、队列移除与dispose合同支持明确Web渲染供应的消费者模块；生产接线和本次普通浮字实战已完成，M3-08父项保持未完成。

## 消费者边界提案

FX独立文件为`assets/scenes/scene-castle-damage-text.ts`（记录/时钟/队列）与`render/scene-castle-damage-text-renderer.ts`（原Damage图字）。root拥有ScenePreview共享接线：真实damage事件一次创建记录，source castle位置用于当次投影，render update供给delta和当前viewZ，round/reset/dispose清文字owner；不从snapshot重播受损。

接口供应需要源坐标位置投影出的整数screenX/screenY、当前viewport与同castle当前相机view-space Z。screen位置在入队时确定；viewZ每次update读取以计算scale。原屏幕转换`44ef2c/44ef47`是`(ndcX+1)*width/2`与`(1-ndcY)*height/2`后原整数转换；完整原projection仍由Web相机适配，需明确原X坐标反射与当前render viewport。记录renderer使用原Damage数字图、字体advance/extent与AutoScaled800×600供应，消费者不能借用未知特效材质pass或新增React文字。

模块接口为`new SceneCastleDamageText(renderer)`、`show(screenX,screenY,delta)`、`advance(deltaSeconds,viewZ)`、`draw({width,height})`、`clear()`与`dispose()`。渲染器使用`new SceneCastleDamageTextRenderer(scene,font)`后`await load()`，字体provider取现`ui-fonts.json`的Damage记录，含原十图字asset/width/height与800×600/AutoScaled属性。未知字形无替代。Web screen shader、bilinear采样与alpha combine是明确渲染供应，不称原CEGUI完整GPU已复刻。

`tests/scene-castle-damage-text.cts`通过保存的九组原update向量、交错两事件独立到期、捕获X不变/仅Y推进、当前depth缩放及clear后重新入队/dispose。该CTS仅证明模块合同；正式事件验收另见下方browser原始输出。ScenePreview已正式导入两新模块，Web工程类型与生产构建已通过。

验收只补这一个玩家缺环：一张已有合法Castle地图、普通2001自然受损触发一次双端浮字，原delta/位置/时序/静默、到期与正常Leave清理；现Castle body、伤害、模型阶段和声音证据直接复用。共享hunk与正式接线已完成，本次普通双端实战范围见下方记录。

首次专属runner为`tests/browser-castle-damage-text.mjs`，端口3562/5592/9792，语法检查通过。复用旧合法map2/普通2001路线和明确预房tank1/pet1记录，四正常账户Ready；只guest自然开火，真实Castle HP首次下降即停止。只读show/create/mesh回调按castleId关联原delta与数字图片，保存完整640×360 callback画布；浮字画面未达到时记准确缺口，继续正常battle/summary Leave，检查worldnull与全部text mesh/material/texture释放。首次普通对局已完成，见下方有限验收。

## 普通Castle浮字验收

`browser-castle-damage-text-2026-10-05T12-32-49-649Z.json`为PASS。map2/mode1四正常账户使用明确预房tank1/pet1资料，guest普通移动/瞄准/Space使CASTLE304从2000降至1957；双端只收到一次相同delta43，消费者显示43。首事件停止开火，未注入活动位置、HP、事件或相机。

双端各有8次真实glyph mesh绘制，codepoint52/51对应原`ui/regions/8/2.png`与`7.png`。六张完整640×360 callback画布中，城堡下方黄色小数字可见，guest早期/淡出帧可辨43；屏幕Y随时间增加，alpha从1降至约0.25，队列在1秒阈值后自然release。host捕获X222、guestX304均保持固定，各自当前深度缩放约0.415/0.500。仅接受普通尺寸整体浮字表现。

ScenePreview一次读取Damage字体图字，伤害当次以原X反射位置投影并截断整数屏幕坐标；每帧使用同城堡当前view-space Z推进队列。round清队列，scene清理释放字体owner。正常host battle Leave与guest正式Leave后，双worldnull、castle/textmesh/material/texture均0；进程cleanup PASS，3562/5592/9792已亲核无监听。有限wrapper为`castle-damage-text-actual.json`，主线`castle-damage-text-root-review.json`已接受真实事件/绘制/生命周期范围；Webtype、专属CTS、生产构建及发布copy出口均0，wrapper已回链。

### 限制

原CEGUI完整GPU像素等价仍未证明，当前shader/采样属于明确Web渲染供应。原Damage字体只含数字，未映射符号保持blank。此验收不增加服务器伤害政策、购买资格或其它Castle实例覆盖，M3-08父项保持未完成。
