# 捕兽夹3003表现准备

原item.dat的3003记录明确 `D3=3003`，技能为3003。真实资源 `Data/scnobj/03003/03003.POL` 是POL版本200、一个 `cylinder01` 网格、250顶点、206三角形；原材质引用 `03003A.tga`，同目录发布资源为 `03003A.dds`。现有 `Data/scnobj/03003/03003.glb` 转换索引记录206三角形、一个静态帧、无track、无缺失纹理，直接复用该已发布资产。

`tests/trap3003-presentation-source.py/json/log` 从原item/skill二进制表和原POL读取，保存 `PASS_ORIGINAL3003_DATA_AND_MODEL_ONLY`。这证明原资源与数据存在；数字ID到模型路径的正式ground身份/transform由主线明确重建接口提供，不冒原client trap factory。

两种技能表现必须区分：3003首槽 `010/SE02` 是表中的效果树，不能作地面夹子模型；触发技能4001首槽 `112/SE44`、次槽 `017/SE16`。许可计数下降的原观察者已由数值线取证，其播放消费者沿现原通知模块复用。是否在正式放置/捕获/期限结束调用哪个槽，取决于足源caller或明确重建接口，不能从槽号猜原业务。

主线明确ground快照为 `{id,ownerId,team,itemTableId:3003,modelId:3003,x,y,z,expiresAt}`，位置由角色serverworld提供，yaw0/scale1为明示重建。FX独立 `GroundTrapsPresentation(scene).reconcile(sources,roomRoundKey)` 现已实现：presence增删原03003模型，同身份不重复load，移除和room-round切换释放，`clear()`供正式Leave调用。不会用客户端时钟或expiresAt自行抢先移除，也不从对象存在推播010。

`Trap3003Visual(scene,id,nativeWorldMatrix)` 直接加载已发布GLB，沿现原POL路径进行世界X反射、Quaternion转换和材质描边；不放大原几何、不设置碰撞或触发半径。资源完成前对象被清理时，晚返回的container直接释放。

`tests/trap3003-visual.cts/json/log` 使用真模型模块/NullEngine及供给loader边界，PASS变换和早移除晚加载释放；`tests/ground-traps-presentation.cts/json/log` 使用真presence模块及供给visual边界，PASS同身份去重、移除、round与clear释放。模块验证没有冒充真实GLB加载或普通玩家画面。

`trap3003-presentation-web-types.log` 严格Web类型检查exit0。正式Battle hook由主线接入：PLAYING快照presence与room-round作用域调用reconcile，Leave调用clear；放置和作用通知另消费上述原效果合同。FX不修改Func12参数、CAS消耗、触发半径、权限计数、计时或服务器事件。

`tests/browser-ground-trap3003.mjs` 为首次独立模型验收入口，使用3453/5483/9683。双正常账户在预房拥有明确native tank1/pet1、射手资金100/0，库存从空开始；普通Shop BUY2、Home配置槽1、mode4/map7 Ready、Digit2放置、普通S倒退露出夹子。观测真实GLB、网格draw和640×360完整画布，服务器presence消失后网格释放，再正常Leave。地面模型可辨像素待亲审，捕获112与移动权限动作不属于此模型片。

`trap3003-ground-model-actual.json` 包装限定真实范围，原raw状态均保持INCOMPLETE。两端真实03003模型加载与绘制有效：转换网格为无索引618顶点，对应原206三角形，纹理来自GLB image0。合法实际购买的原生SQLite检查点用于模型补段，严格绑定原账户，未导入角色或库存；快捷槽普通放置后，服务器自然期限至tick607双端groundTraps为空，网格已移除。

真实onAfterRender完整640×360画布保存在01-43-08 pixel-tail六图。射手模型被本车遮挡；观察端在另一战车旁可辨夹子齿尖局部，完整几何与双端独立像素范围仍未接受。host离场后world已空，guest退出按钮命中失败，双正常Leave仍缺；独立进程清理完成。期限验证引用01-40-42，不在pixel-tail重复等待。

限制：完整模型可辨像素、guest正常Leave、捕获4001的112/SE44真实表现仍开放。地面对象资格、单位与时限为明示重建，资源与快照消费者不能代表原服务器trap规则已恢复。
