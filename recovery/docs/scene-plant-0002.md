# 0002 原植物摆动消费者

M3-05/M3-06：合法map2的29个SYcScnObjPlant/obj05413使用原余弦参数和顶点高度平方摆动。ScenePlantSway已接ScenePreview限定load/register/advance/clear；双端普通接触同局各13来源的两不同实际绘制位置、正式source327隐藏和整局重入清理已有限记录，摆动画面精度仍未完成。

地图线拥有export_scene_plant02.py、scene-plant-0002.json、scene-plant-sway.ts、专属native/module/browser/docs；共享文件仅export_scenes独立import/call与ScenePreview新Plant owner限定hunks。保water、Crush与revision晚加载取消。没有World、服务器碰撞、伤害、事件、React或主生命周期修改。

## 原合同

原构造45f407设置vtable5c7760；+0xc类名入口45f8ad读取SYcScnObjPlant，+0x18 update45e8a5、+0x24 render45e90a、+0x34 loader4616f8。loader创建gbPlantNode并加载原POL，SetRenderPriority(-1001)；gbPlantNode默认rotationY=false，不据类名增加billboard。

loader4617fd→45589c以0和120初始化phase；455880使用原rand15×范围×f32(1/32767)。461821复制object+c4到+108。原GetTotalOBBox10017cb0→GetOBBox10017b50读取原mesh bounds，经44ddc0保存尺寸；+c4为Y尺寸。obj05413原POL一mesh，height为f32(22.965776443481445−(-.04611053317785263))=23.011886596679688，29原放置的尺寸一致且rotation全0。

update45e8a5在node非空时phase+=2×dt；超过f32(6.28318)仅减一次，不按长帧取模。57ca74执行原FCOS，参数=f32(cos(phase)/height×f32(.15))。render45e90a每次调用gbPlantNode::SetParameter10018090再Attach。SetParameter保存node+150并沿原子节点传递；Attach参数向量包含位置xyz和该w。

效果管理器100273f5将100000注册到plant80.gbf（180/240容量变体保同一几何表达）。原shader为swayPos.x+=param.w×position.y×position.y，然后加实例位置，再投影；原source UV不变。当前片只恢复源几何摆动，未宣称全部原材质/实例批次/GPU精度。

## 生产消费者

export_scene_plant02发布原29个placementId、型号、enabled、原bounds和已证height，不重造模型。ScenePreview复用正式静态资源加载和原placement，将源Plant注册给ScenePlantSway。

每个原实例保独立几何缓冲，模板原GLB位置不改。ScenePlantSway按原余弦合同逐帧更新，从原顶点计算X偏移，不累积上一帧变形，保原Y/Z、UV、indices和位置/朝向。现浏览器以CPU执行原shader几何表达；具名原材质由ScenePlant05413MaterialOwner持有并释放，texture由资产owner持有。随机熵使用浏览器供给的15位rand范围；原种子序列及运行D3D精度未恢复。f32存储配合既有原CRT53-bit启动证据，不冒原D3D当前FPU控制确认。

每次更新顶点后computeWorldMatrix(true)将重建的local包围盒同步到原placement世界坐标，再供视锥剔除。clear释放独立克隆几何和owner表，随后既有场景容器释放模型/材质。晚load在dispose后不登记资源；帧更新不受快照频率驱动。

## 验证

- scene-plant02-sway-native.json/log：原GetTotalOBBox/44ddc0、45e8a5/CRT FCOS、45e90a/SetParameter执行，原POL bounds为模型边界输入，memcpy和最终Attach为记录端点。6个相位/长帧样本、null node门禁通过；不称完整loader/GPU执行。
- scene-plant02-sway-module.json/log：实际发布GLB位置与原native相位/参数对照，实例独立、源模板不变、零delta不累积、owner clear与晚load取消通过。NullEngine不证明玩家像素。
- scene-plant02-web-types.log：原完整接线Web类型检查exit0；主线trap3003-parts-feedback-production-web-build.log统一发行通过，包含当时完整Plant import。新增world-bounds最小修等待下一必要主线batch，不独立重复全build。

首次raw browser-scene-plant02-2026-10-05T01-46-35-594Z.json保留FAIL：双端各29owner，750普通输入，主端到(-1922.84,521.82)、客端到(-1260.98,750.45)，目标327/322过滤draw均0，没有正/负摆动capture。双端正常Leave后ownerfalse/mesh0，process清理通过。完整actual两图保存；该段不作为摆动像素验收。

ordinary scope为正式React mode1/map2选择/建房/加入/四正常玩家Ready；出生0距源327约238，普通NAV近点(-1984.56,520)，自然转向327(-1984.5618,404.0834)，取实际正/负摆动画布后正常源退出。无位置、相机、事件、伤害或胜负注入，不复跑受阻water bank。

第二raw browser-scene-plant02-2026-10-05T01-53-19-345Z.json同目标绘制缺口：468普通输入，两端目标capture/draw均0，双Leave ownerfalse/mesh0与process清理通过。原327实际absolutePosition为(1984.561767578125,0,404.0833740234375)，但变形后minimumWorld停在局部(-19.25,-.046,0)。Babylon geometry.updateVerticesData的updateExtends重建包围盒未带世界矩阵，原位视锥剔除失配；专属translated-placement回归复现了原遗漏；修正后world-bounds-after.log与module.json通过，世界包围盒保留placement，原参数/几何/清理断言仍通过。两次完整PNG亲审不接受摆动像素，本轮停止第三同路线。索引scene-plant02-player-gap.json。

## 未完成范围

`scene-plant02-contact-player-evidence.json` 回链实际 `plant02-contact-root-review.json`：new327普通接触双权威hidden/root禁用，host累计draw6/lastFrame321在隐藏后保持不增长，guest此前未draw仅接受禁用状态。同raw各13来源有两不同实际绘制位置。原raw的观察字段INCOMPLETE和上述两条旧路线FAIL保持，不从实际几何提交推定全部植物像素。

`map02-full-session-player-evidence.json` 回链实际 `map02-full-session-root-review.json`：两局同scene及正常Leave→新房重入各29 owner注册，两个load的source身份一致，两次dispose owner/resource/materialOwner归零。327在两局和新房始终unhidden，不证明hidden→visible再战恢复。

普通玩家可辨摆动画面、高清性能、完整原GPU/材质/批次/FPU状态及原随机种子序列尚未验收，M3父项保持未完成。同类放置的数据与消费者资格复用；全29记录不等于全29独立像素。
