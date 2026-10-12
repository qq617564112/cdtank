# 攻击饮料第一效果验收

物件4绑定技能4；第一效果槽为Effect106、SE38、Tag0、Method3。`tests/attack-drink-effect.cts`通过正式BattleSkillEffects的itemUsed通知，以skillId4、effectIndex0、duration0进入createSkillEffectNotifications和EffectRuntime。Tag0对应`tag_efcenter`，运行树持有该挂点矩阵引用。SE38以selector1分派，已发布声音为`audio/sound/SE38.wav`。

原`effect-tree-create-native.json`的2907非保留树包含11节点：2907、2908、2909、2910、2911、2912、2913、2914、2915、2916、3103。生产树节点顺序和retain状态与此证据一致。实际绘制为四个Type1精灵2908/2909/2910/3103及三个Type7条带2912/2913/2914；七个节点全部实际提交顶点。纹理为已发布的go、FlareBrightOrange_BLUE、huoguang_blue及xy/106，测试同时检查资源文件存在。

移动原挂点矩阵20单位后，2908最新四边形的Web X坐标相应移动20单位。自然到期、显式stopEffect、角色detach、runtime.stop均清理全部实例、网格和材质。四次通知均只分派SE38单次声音，不建立duration通知记录。测试通过，输出`recovery/output/attack-drink-effect-fidelity.json`；无需修改生产效果代码。

## 限制

原树还包含Type4声音节点2915，名称`_root\online\106\1\ww051`，控制器引用`ww051`。该引用没有`audio.json`声音映射，本地CDTank及恢复输出未找到同名资源，data.cpk现有验证清单4459条及music.cpk清单14条也没有ww051；现有导出器从`CDTank/Data/sound/*.wav`发布声音，因此缺失路径为`CDTank/Data/sound/ww051.wav`。生产EffectSound对未映射声音立即结束；本次几何与清理验证不能证明该原树内声音的实际播放和播放期间生命周期。声音内容仍不可恢复；已新增ww051-loader-boundary.md的实际原加载链执行：直接构造data\sound/ww051.wav，缺文件返回无效描述符、完成=true、stop无设备操作。tests/ww051-loader.cts将实际EffectSound对该缺引用无media播放/立即结束/停止与此原边界对照通过。此证据解释当前发行缺文件行为，不补造声音，不证明成功加载/设备音频或全效果像素精度。

NullEngine使用白色夹具纹理，验证生产顶点和原资源引用，不证明原像素、混合结果或实际WebAudio输出。SE38检查范围为原表选择、正式分派及发布文件存在。第二效果槽Effect10/SE02的触发阶段尚未确定，不属于本次第一效果验证；属性持续时间与原服务端施放时序由独立业务恢复记录说明。
