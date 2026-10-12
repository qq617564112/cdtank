# 防御饮料首槽效果验收

物件5绑定技能5；验证后的原item/skill表与发布combat-catalog一致，首效果槽为Effect108、SE40、Tag0、Method3，第二槽为Effect10、SE02、Tag0、Method3。`tests/defense-drink-effect.cts`通过正式BattleSkillEffects的itemUsed通知，以skillId5、effectIndex0、duration0进入createSkillEffectNotifications及EffectRuntime。Tag0对应`tag_efcenter`，运行树持有挂点矩阵引用；矩阵平移20单位后，2918已提交顶点的Web X坐标移动20单位。技能5不建立持续通知记录，首槽按原动画树寿命自然结束；本次25毫秒步进在1.65秒完成清理，十秒属性期限独立于首槽动画期限。

Effect108的原源名称为`_root\online\108`，根节点2917。测试直接读取原`Data/effect/effect.sav`，将发布库中此树的11份节点记录按原二进制结构重建，逐字节核对类型、编号、名称、原字段、资源、控制数据及子节点引用。原递归创建夹具`effect-tree-create-native.json`的非保留树依序为2917、2918、2919、2920、2921、2922、2923、2924、2925、2926、3106；正式运行树的节点顺序和retain=false逐项一致。

四个Type1精灵2918/2919/2920/3106和三个Type7条带2922/2923/2924均实际提交顶点；条带源色为[0.5,1,1,0.800000011920929]，3106有八段精灵控制。公开纹理go、FlareBrightOrange_BLUE、huoguang_blue、xy/108均存在。八次首槽通知各以selector1分派一次SE40，发布`audio/sound/SE40.wav`存在。

自然到期、显式stopEffect、角色detach及runtime.stop均清理实例、网格、材质及声音。两角色同时播放时，stopEffect或detach第一角色均只清理其效果；另一角色的实例、七份实际几何及挂点引用保持，随后自然到期归零。`npx tsx tests/defense-drink-effect.cts`通过，证据为`recovery/output/defense-drink-effect-fidelity.json`及`defense-drink-effect.log`。生产效果模块无需修改。

## 限制

Type4节点2925引用ww051；发布audio.json无映射，现有data.cpk验证清单4459文件及music.cpk清单14文件均无对应项。复用`ww051-loader-boundary.md`及`ww051-loader-native.json`的原加载证据：直接构造`data\sound/ww051.wav`，缺文件得到无效描述符，完成=true，stop不进入音频设备。正式EffectSound配置下，2925确实执行声音启动，缺引用立即报告完成且无media voice，树正常结束并清理归零。ww051原内容仍缺失；SE40是独立技能声音，不能补足此嵌入资源。

第二槽Effect10/SE02的业务生产者仍未知。本片只验证首槽，不从十秒属性期限推导第二槽通知；第二槽及完整原内容父项保持未完成。

NullEngine使用白色夹具纹理，证明原树、实际提交几何、挂点引用、声音分派及清理；原像素、混合结果和实际WebAudio播放由独立网页验收覆盖。
