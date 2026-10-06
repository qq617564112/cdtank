# 速度饮料首槽效果验收

物件6绑定技能6；首效果槽为Effect110、SE42、Tag0、Method3。`tests/speed-drink-effect.cts`经正式BattleSkillEffects的itemUsed通知，以skillId6、effectIndex0、duration0进入createSkillEffectNotifications和EffectRuntime。Tag0对应`tag_efcenter`，运行树直接持有挂点矩阵引用；修改矩阵平移20单位后，2928已提交顶点的Web X坐标相应移动20单位。SE42以selector1分派，发布文件`audio/sound/SE42.wav`存在。技能6不建立持续通知记录，十秒属性期限不改写原首槽动画寿命。

原`effect-tree-create-native.json`中2927的非保留树含10节点：2927、2928、2929、2930、2931、2932、2933、2934、2935、3108。正式运行树逐节点顺序及retain=false与原夹具一致。四个Type1精灵2928/2929/2930/3108和三个Type7条带2932/2933/2934全部实际提交顶点；四份公开纹理go、FlareBrightOrange_BLUE、huoguang_blue及xy/110均存在。自然到期、显式stopEffect、角色detach、runtime.stop均清理实例、网格、材质及声音；四次首槽通知只分派SE42单次声音。

命令`npx tsx tests/speed-drink-effect.cts`通过，输出`recovery/output/speed-drink-effect-fidelity.json`与`speed-drink-effect.log`。生产效果模块无需修改；普通双网页的声音播放和公开纹理绘制由独立网页验收提供。

## 限制

Type4节点2935引用ww051。已发布audio.json无该映射；现有data.cpk验证清单4459文件及music.cpk清单14文件均无对应项。该引用与攻击饮料Effect106节点2915相同，适用已有`ww051-loader-boundary.md`和`ww051-loader-native.json`的原加载边界：直接构造`data\sound/ww051.wav`，缺文件返回无效描述符、完成=true、stop不进入音频设备。本次正式EffectSound配置现有音频目录后，缺引用不播放media，树正常结束且声音清理归零；声音内容仍缺失，不能用SE42替代，也不能以此关闭全部特效父项。

第二槽为Effect10/SE02、Tag0、Method3。现有目录只规定槽值；SkillEffectNotifications按接收到的effectIndex消费通知，没有建立该槽的业务触发阶段，既有攻击饮料取证同样保留此缺口。本片不触发第二槽、不推定到期或其他阶段，M4-10-I06完整内容及原FuncType1父项保持未完成。

NullEngine使用白色夹具纹理，范围为原树、实际提交几何、挂点引用、声音分派与清理，不证明原像素、混合结果或实际WebAudio输出。

## 第二槽通知生产边界

现有`skill-effect-message-native.json`和`skill-effect-message.md`已确定客户端消费入口：listener注册0x488a79指向Play handler 0x488291；packet+0x0c为技能ID，+0x10为服务器消息携带的零起始效果槽。0x4882f1/0x48838a直接用该槽索引skill record+0x70，0x48851a/0x4885a5用同一槽索引Tag；没有从技能增加、移除或期限推导slot1。packet factory 0x48935a、writer 0x4893cb和reader 0x48944e证据覆盖构造及序列化，未覆盖向skill6消息+0x10写1的业务生产者。

原属性31技能观察者入口0x42f385的现有执行证据为`tests/role-skill-observer-native.py`和`role-skill-observer-native.json`。它比较role+0x320旧16槽与当前record+0xd0技能列表；只对已移除且TriggerType为2或3的技能调用客户端停止边界0x486d6f(roleId,skillId)，随后复制列表，本地角色置dirty并重算。技能6的TriggerType=1；已有skill6移除样本中，远端events为空，本地events只有recompute，没有停止或播放通知。该停止入口在此夹具为供给边界，不能借此宣称完整停止链；观察者自身未生产PlaySkillEffect，也未选择Effect2。

因此已有客户端通知、倒计数和技能列表观察证据没有建立skill6增加/移除/到期→effectIndex1的生产路径。下一缺失入口是原业务中产生`UMsgPlaySkillEffect`（type0x4170）、设置skillTableId6及effectSlot1并发送通知的调用点及触发条件；现存证据没有该生产者地址。客户端packet factory和消费handler地址不能替代此来源。M4-10-I06-AI复用首槽表现范围，第二槽和完整内容父项保持未完成。
