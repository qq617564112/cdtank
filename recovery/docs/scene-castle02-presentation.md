# 田野路普通Castle受损表现

当前041树声ww098已发布独立补作并映射audio.json，死亡五挂点并发保留低音量余量。原Castle动作、挂点与GA48／SE03／SE07保持，资源与参数见[reconstructed-tree-audio-runtime.md](reconstructed-tree-audio-runtime.md)，新增实际声音输出待验。

M3-08-CASTLE02按单次正式受损事务消费原Castle动画、挂点效果和声音。原模型资源与放置由地图线提供，权威目标、HP与伤害由主线提供。

## 原合同与消费者

`recovery/evidence/castle/castle-damage-native.py`执行原45d16f至ret、45bdcb五挂点绑定及gbActor命名动作选择10009af0。输出`castle-damage-native.json`覆盖14个HP边界与8个连续事务。模型、特效管理器、声音与伤害数字服务是记录边界，不代表Windows实际绘制。

源构造阶段为2。首次HP0切阶段0/c3并在五spout发041与spout1位置se07；首次正HP小于整数max/3切阶段1/c2，在root发041与spout1位置se07。其余调用阶段1发n2、阶段2发n1；恢复不会自行将阶段改回2。c2/c3原mode0循环；n1/n2受损原mode4停尾，原命名入口初始time0。初次载入45dd2d最终动作n1/mode0。

每次原受损入口先在物件+58位置发GA48/selector1。整数f=max/5；HP进入(3f,4f]、(2f,3f]、(f,2f]、(0,f]各区间时，只有该区间bit尚未置位才分别在spout1、2、3、4发040，并停止对应旧声后发se03/selector−1。se03源位置均为spout4。跳过区间不会补发；重复同区间不叠效果。HP0首次bit4停止五旧效果槽，五spout发039，停止五持续声音。原五tag按名字tag_spout1..5绑定，不能按MV3轨道排列顺序取。

`SceneCastleState.damage({currentHP,maxHP,delta})`返回原顺序表现命令，消费已接受结果而不计算伤害。`SceneCastlePresentation.damage`接入原具名039/040/041树与实时矩阵、空间GA48/se07/循环se03；dispose只清本物件持有的效果与声音。`SceneCastleVisual`加载两原型号五动作GLB，复用原MV3材质、动作时钟和tag插值；动作与tag从真实帧推进。

`ScenePreview.load('0002',effects)`取地图线`scene-castle-0002.json`并以两原Castle独立visual替代首动作静态显示。`damageCastle(event.castleDamage)`仅接单次正式sceneObjectHit；advance推进视觉；round更新重置本Castle表现状态，clear释放视觉与声音。主线Battle已接load和sceneObjectHit，并避免Castle死亡误调用Breach破损。

## 当前证据

- `castle-damage-native.json`：上述原入口、tag名字与动作mode执行。
- `tests/scene-castle-state.cts`：14边界及连续事务命令顺序与原执行相同。
- `tests/scene-castle-presentation.cts`：实时矩阵引用、se03位置、重复阶段、死亡停止持续声与owner释放。
- `scene-castle02-source.json`及`scene-castle-0002-models.md`：地图线原CAS/INI、十MV3全帧几何、材质、纹理与挂点。
- `browser-combat-castle02-2026-10-04T15-49-11-515Z.json`及`15-50-50-052Z.json`保留WAITING入口失败，不作为Castle正式触发证据。该CPU点击入口交主线处理。
- `castle02-stopped-aux.json`保留正常Account/Join/Ready辅助玩家路线的未验收观察：正式PLAYING与双端受损/040实绘/原声已有记录；记录停止时尚未完成死亡与清理，不宣完整闭环。

- `browser-combat-castle02-2026-10-04T15-55-33-199Z.json`：普通四人PLAYING，两端47相同事务HP2000→0，n1/n2/c3及040/041/039实际绘制，GA48/se03/se07播放事件、死亡循环停止及Leave全0。原raw保留INCOMPLETE，唯一失败是两端c2未绘制。
- `browser-combat-castle02-2026-10-04T15-59-51-442Z.json`：仅单guest普通射击，host停火观察，32相同事务HP2000→624后释放Space。两端c2分别78/81次实际draw，low-1/2实际画布可辨原受损模型；Leave全0。此PASS只补c2，死亡与原声段引用上一记录。
- `castle02-composed-evidence.json`明确组合范围：原来源已恢复、模块已实现、普通事务已触发、该304原模型与效果双端可见已验。旧段第31事务HP667仍n1，第32事务HP624首次c2，第33事务HP581原stage1切n2；两端首low画面均为581且无c2 draw。事务frame/tick未记录，不能断言同tick。新补段未改变原动作覆盖时序。
- 补段gain后Analyser采样：射手页三路se03 peak为0.03449/0.02563/0.02324；观察页三路gain0/peak0。两端播放事件与输出可听分别登记；GA48/se07未作波形采样，本片未证明双端同时可听。

- `browser-combat-castle02-2026-10-04T16-07-15-234Z.json`：45秒正式时限，两页普通靠近，单射手10相同事务至HP1570启动原040/se03后松Space。两端GA48/se03增益后波形非零且masterGain0.5；自然TIME_LIMIT→四账户Rematch→round2，两原Castle HP2000、stage2/mask0、启用原n1，旧Castle effects/voices0、循环se03 stopped；Leave全0。只验证缺失声音输出与再战，不重复死亡/c2。round2记录动作与资源状态，未另存该时点实际画布。

- `browser-combat-castle02-2026-10-04T16-10-39-898Z.json`：仅首次se07输出补验，两端32相同普通事务至原低血HP624即释放Space，无死亡/再战/画布采样；原spout1位置两端一致，se07增益后peak0.82227/0.74528，gain0.77616/0.70675，masterGain0.5。Leave全0。至此GA48/se03/se07三声逐名均有双端非零输出，死亡se07播放范围仍引用原47事务，不声称另测死亡波形。

## 伤害浮字

`castle-damage-text-root-review.json`已接受Castle304普通受损事件的原Damage图字消费者。普通2001使HP2000→1957，双端各一次delta43；当次原位置投影捕获整数屏幕坐标，随后按当前viewZ缩放，原Y变化率40、0.5秒后淡出、1秒到期。实际双端glyph绘制、自然释放与正常Leave后text mesh/material/texture全部0已验。来源、独立模块和实际范围见`castle-damage-text-source-gap.md`与`castle-damage-text-actual.json`；原CEGUI GPU像素等价仍未证明。

## Castle305普通实战

`browser-castle02-305-2026-10-05T17-20-36-927Z.json`为PASS，有限主审回链`castle02-305-root-review.json`。地图0002／模式1四认证账户使用明确预房tank1/pet1资料。正常导航、Arrow瞄准和Space输入触发source305受损及破坏，没有活动位置、HP、事件或时钟注入。双端各47次真实damage调用、95条具名通知；c2/n2/c3实际mesh绘制分别为主端5/88/10、客端4/87/9。六张1280×720整图中，主端受损城堡、火烟及c3倒塌残件可辨；客端目标远小且局部遮挡，不证明独立动作或特效像素。

声音由同一真实305受损调用范围关联返回voice handle与原WAV。两端各47个GA48、4个循环SE03、2个SE07；主端增益后最大采样分别为0.213860929、0.323958099、0.246530712，客端均0，只确认播放／停止生命周期。GA48与SE07自然ended，SE03暂停停止；正常Leave后再次读取同voice引用均paused。双端players/castles/effects/sceneVoices/battleVoices为0、worldnull、输入interval关闭。地图线确认唯一runner88714实际exit0、3597/5627/9827无监听；进程清理文件另记录serverExit1、Chrome0与临时目录删除，不将服务端退出码写为0。此记录补305实际状态覆盖，不替代原服务器政策、双端可听或高清性能验收。

## 未完成范围

M3-08-CASTLE02的304普通受损→死亡实际视觉与Leave组合证据已交；双端GA48/se03可听与普通再战清理补段已验，se07首次低血双端输出补段已验；本项由主线按限定范围审定，完整父项保持未勾。305已取得上述普通受损／破坏实际覆盖，客端独立可辨画面与可听输出未证明。destroyCallback输出独立语义。原服务器伤害、可攻击资格和死后碰撞政策仍是主线明确的重建规则。其它地图Castle、恢复道具、完整Windows像素与高清性能不由本片完成。
