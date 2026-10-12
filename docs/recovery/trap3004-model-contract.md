# 3004 原果酱地面模型

原 item3004 的 D3=3004，施放技能3004与受害者技能4002分开记录。原 `Data/scnobj/03004/03004.POL` v200 为 cylinder01、FVF21/kind0、75源顶点/76三角形，材质引用03004A.tga，同目录原03004A.dds和已发布GLB/PNG存在，无缺失纹理。`trap3004-presentation-source.json/.log` 为原数据和模型有限证据，不证明原 client trap factory。

正式地面模型 `Trap3004Visual(scene,id,nativeMatrix)` 加载原 `/Data/scnobj/03004/03004.glb`，输入 ground id 与完整原生坐标矩阵；X反射及Quaternion转换复用3003路径，几何与尺寸不改。`load():Promise<void>` 绑定原资产，`dispose():void` 释放模型、纹理与root，移除后晚返回的container直接释放。根及mesh元数据为 groundTrapId/sourceModel。

`tests/trap3004-visual.mts` 使用真实GLB、展开228顶点/76三角形、原texture、给定native矩阵与晚加载边界，检查变换、几何保留及所有模型自有纹理/mesh释放；场景共享BRDF纹理仍由scene所有者管理。

正式观察入口：mesh.metadata.sourceModel 为 `Data/scnobj/03004/03004.POL`，groundTrapId 与当前 snapshot.id 相同。原GLB为无索引展开几何，vertices228、indices0；实际提交用 onBeforeDrawObservable 或原 `_draw` 调用记录，不能以 indices>0 或 onBeforeRender 作为绘制条件。提交时保存 world matrix、原03004A纹理及完整正常画布；模型可辨资格需直接审图。移除后记录 ground owner 条目、该 ground id 的mesh与自有texture释放，Leave后等待worldnull再采样。

同一普通流程可直接导入 `tests/helpers/observe-trap3004-model.mjs`，调用 `observeTrap3004Model(scene,engine)`；返回data保存真实draw及after-render完整canvas，cleanup读取原模型mesh和world，dispose移除观察回调。该测试观察器仅syntax通过，未作为实际输出证据。

## 未完成范围

主线已在正式 GroundTrapsPresentation 按 modelId3004 选择 Trap3004Visual，presence、room-round切换和clear共用既有owner。Battle、World、协议和普通玩家放置/接触归主线。数字3004→ground模型路径、yaw0/scale1、XZradius30、ground30秒和turn许可贡献1/恢复5秒为主线明示重建合同；原Func12/4、原放置权限和完整父项未恢复。不以模块验证代替玩家表现。

## 玩家模型有限可见范围

复用 FX 的 `browser-trap4002-presentation-2026-10-05T03-16-34-386Z.json` INCOMPLETE：普通mode4/map7入房、Digit2放置3004后，两端相同ground R6:1:T1/model3004及坐标已记录。两完整失败页面PNG已亲看，主端果酱罐正面黄标签与浅色顶、客端背面及罐体均清楚可辨。原渲染canvas320×180，页面截图1280×720；不冒高清。原raw因普通观察者转向未就绪停止，未完成接触效果。

failureCleanup双worldnull/instances0/meshes0/voices0，进程清理引用FX；本raw没有独立ground owner条目、自有texture计数及ground draw矩阵仪器。有限模型画面索引 `trap3004-model-player-evidence.json` 由主线组合闭环接受索引引用，不将首FX整体INCOMPLETE改为PASS。独立模型runner仅准备，复用有效两图后不启动新模型对局。

接口已稳定并由 GroundTrapsPresentation 正式消费，统一 `trap3004-room-password-production-web-build.log` 已发行。最新 FX 普通接触流程 `browser-trap4002-presentation-2026-10-05T03-22-11-304Z.json` 为 PASS_TRAP115_SCOPE_PENDING_PIXEL_REVIEW，含同一原3004放置端点及双 Leave 的 worldnull/instances0/meshes0/voices0/treeVoices0；115独立画面和声音判定归FX及主审。模型有限可见仍引用已亲看的03-16两图，不为模型另开对局。

主线已在 `trap3004-business-accepted.json` 接受组合3004重建业务/实际表现，引用 `trap4002-presentation-actual.json` 首次原115双端可见/SE47输出/Leave。地图模型索引同步该主审引用；独立模型draw/texture计数缺口、原权限和HD范围不随组合接受关闭。
