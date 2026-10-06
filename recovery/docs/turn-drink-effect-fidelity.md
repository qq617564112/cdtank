# 回旋饮料首槽效果验收

物件7绑定技能7；验证后的原item/skill表与发布combat-catalog一致，首效果槽为Effect113、SE45、Tag0、Method3，第二槽为Effect10、SE02、Tag0、Method3。`tests/turn-drink-effect.cts`经正式BattleSkillEffects的itemUsed通知，以skillId7、effectIndex0、duration0进入createSkillEffectNotifications及EffectRuntime。Tag0对应`tag_efcenter`，运行树持有挂点矩阵引用；矩阵平移20单位后，3017已提交顶点的Web X坐标移动20单位。技能7不建立持续通知记录，十秒属性期限不改写首槽动画寿命。

Effect113的原源名称为`_root\\online\\113`，根节点3010；`effect-tree-create-native.json`的非保留树依序包含3010、3011、3012、3013、3014、3015、3016、3017、3018、3111。正式运行树逐节点顺序及retain=false与原夹具一致。三个Type7条带3012/3013/3014和四个Type1精灵3016/3017/3018/3111全部实际提交顶点；条带源色为[0.5,1,1,0.800000011920929]，3111有八段精灵控制。此树的子节点顺序与速度饮料不同，编号纹理为xy/113。四份公开纹理huoguang_blue、FlareBrightOrange_BLUE、go、xy/113均存在。SE45以selector1分派，发布`audio/sound/SE45.wav`存在。

自然到期、显式stopEffect、角色detach及runtime.stop均清理实例、网格、材质及声音；四次首槽通知各分派一次SE45。命令`npx tsx tests/turn-drink-effect.cts`通过，结果为`recovery/output/turn-drink-effect-fidelity.json`及`turn-drink-effect.log`。生产效果模块无需修改。

## 限制

Type4节点3015引用ww051；发布audio.json无映射，现有data.cpk验证清单4459文件及music.cpk清单14文件均无对应项。该引用复用`ww051-loader-boundary.md`及`ww051-loader-native.json`的原加载证据：直接构造`data\sound/ww051.wav`，缺文件得到无效描述符，完成=true，stop不进入音频设备。配置正式EffectSound后，本测试确认缺引用不播放media、树正常结束且声音清理归零。ww051内容仍缺失，SE45是独立技能声音，不能替代它；完整原内容父项保持未完成。

第二槽Effect10/SE02的业务生产者仍未知。复用已有`skill-effect-message.md`及`speed-drink-effect-fidelity.md`的通知生产边界：消息携带零起始效果槽，客户端按槽消费，不从期限或技能列表变更推导第二槽。原表技能7的TriggerType=1；现有属性31观察者只对被移除且TriggerType为2或3的技能调用停止边界，没有提供skill7增加、移除或到期→effectIndex1的生产路径。本片只触发首槽，第二槽及完整内容父项保持未完成。

NullEngine使用白色夹具纹理，证明原树、实际提交几何、挂点引用、声音分派及清理；原像素、混合结果和实际WebAudio播放由独立网页验收覆盖。
