# 原音频与战场音乐

`npm run assets:audio`将原music.cpk已验证提取物的14份MP3与Data/sound的174份WAV按原字节发布到web-assets/audio，并生成audio.json。CPK与每首提取音乐的SHA256对照原提取manifest，输出保持文件哈希；地图及MusicString映射直接重读原.dat表，未从生成的Web资源倒推。仅发布WAV不代表原音效触发、空间衰减或混音已经恢复。

原战斗初始化0x4d055e调用0x435345读取模式，0x4d056b–0x4d0587读取地图ID并经0x413d25/0x411068选模式表记录；0x4d058c读取记录+0x94，0x4d0592加0xbf，0x4d0597以-1作为播放次数传给0x4d9517。Web以原m001–m005的MusicFile+191查询MusicString，得到GAM01–GAM10。26条模式/地图记录全部有对应原音乐，田野路为MusicFile2→ID193→GAM02。MusicString中183–191为UIM01–UIM09，192–201为GAM01–GAM10；原包仅含UIM01/02/08/09及全部10首GAM，UIM03–07保留未匹配，不替换曲目。

0x4d9517避免重复播放相同MusicString ID，并在更换时停止旧流；0x485e5f查询MusicString，0x485d96拼接data/music/<名称>.mp3，经0x48573b调用gbengine导入PlaySoundStream。gbengine.dll导出VA0x1003ae60将第三参数在0x1003aed3–0x1003aedc传给Mss32.dll的AIL_set_stream_loop_count。Web战场音乐设置loop；原Miles循环端点、解码延迟与引擎混音的逐采样一致性未验证。原SystemSetting.ini的MusicVolume/SoundVolume均为0.5，Web音乐初值与之相同。

BattleMusic按Join权威mode/mapId选择音频，与战场进入/退出/断线相连；停止时暂停并清除src，延迟目录响应用generation防止离开后开始播放。音乐启动后的异步步骤再次检查Battle会话，避免加载过程中退出后创建输入计时器。浏览器媒体许可拒绝时保留待播放状态，在实际点击/按键后重试，不绕过浏览器策略。当前工具面板提供独立音乐/音效滑杆，0可静音，用户选择在同一客户端换地图时保留；原设置窗口及账号持久化尚未恢复。原大厅/结算音乐调用、同曲在不同页面间的续播和其他WAV触发未接入。

验证：test:audio对照全部14MP3/174WAV输出与源哈希、26条原地图记录、原选择常量和默认音量。test:audio:browser实际解码14首MP3、逐条选择26记录并检查音频源/ID/时长、真实播放推进、静音/音量、切换保留、停止及待目录响应时退出；未设置autoplay策略豁免，通过真实鼠标输入取得媒体许可。test:combat:browser在真实两个客户端键盘战斗中记录GAM02/ID193、loop与音量，并检查返回后暂停/清除音源；同时保持命中/死亡/重生/退出与原头像回归。网络回归、TypeScript与生产构建通过。证据browser-audio.json、browser-combat.json的music/stoppedMusic、audio-test.log、build.log。测试证明媒体解码与运行状态，不代表人耳验听、原音效空间表现或高清联机性能已验收。

## 击毁音效与空间播放取证

新增`recovery/export_audio_events.py`直接从原PE读取选择器、调用指令、导入表和路径常量，生成`recovery/output/audio-events.json`，保存源SHA256及逐指令地址/字节；`assets:audio`同时更新此证据。audio.json新增原MusicString到WAV的174条soundIds映射，保持声音原字节。

击毁者路径0x429139–0x429149将攻击者传给callback+0x90→0x4cf12c。0x4cf154读取角色+0x2a4记录，+0x2c值1选14，值2选46；0x4d654d再加41，经0x485c1b/0x4178c9查询MusicString，得到ID55→GA14、ID87→GA46。其余值保留selector0，走ID41→UI41；此边界尚未在真实角色中验证，不用GA14替代。

0x4cf19e–0x4cf1c2：原HUD模式3/4直接播放，模式0/1/2仅在击毁者与本机角色属性0x11相同的时候播放。原getter的jump table项17跳至0x432492，读取角色记录+0x5c。不是仅本机击毁时播放；同队远端击毁也经过这条路径。声音位置取击毁者+0x310对象的vtable+0x1c、参数1，并传给空间播放，而非取被击毁者位置。

0x485c1b拼data\\sound/<MusicString>.wav，调用0x571d14→0x56fee9。原OpenAL32导入alSource3f/alSourcef/alSourcei明确设置position(0x1004)、velocity(0x1006)、direction(0x1005)、reference distance(0x1020)、rolloff factor(0x1021)、max distance(0x1023)，source relative(0x202)为false。0x5715e3管理器构造初值分别为参考距离10、衰减系数1、最大距离100；这些构造值随后被初始化覆盖，运行参数见下节。

原受击HUD入口0x4ceebd只设头像bit8；死亡HUD入口0x4cef02设死亡图并操作原窗口，没有通过上述声音入口播放。战车层另有0x46484b→GA43、0x464882→GA44、0x4648b9→GA20三个直接声音助手，调用者已列入证据，但事件含义仍待追踪，不能依据名称标成受击/死亡。下一步继续确认这些助手的角色消息来源、死亡/武器/技能音效和移动音源跟踪。

test:audio重新从PE生成证据与导出JSON完全对照，校验全部174条声音ID及击毁者两份WAV源哈希；test:audio:browser使用浏览器Web Audio实际解码全部174份WAV，记录每份时长、采样率、声道及峰值，检查样本有限，同时回归14MP3、26地图选曲和音乐生命周期。全部通过。全量解码覆盖不代表全部原音效已接入。

## 原空间参数覆盖与击毁音效运行

初始化0x416a93–0x416aba将常量VA0x5c1540=100、0x5c1da4=1600、0x5ccff8=2传给0x571e9f。setter 0x571ebc/+0xc、0x571ec3/+0x10、0x571ecc/+0x14分别保存reference distance、rolloff factor、max distance，即100/2/1600。0x57178b–0x571790以0xd004调用alDistanceModel，明确为AL_LINEAR_DISTANCE_CLAMPED。

每帧0x45004a调用场景vtable+0x28取得相机结果；+0x18传给0x56fd88设置位置，+0x48与+0x3c传给0x56fdea设置forward/up。两个wrapper将原XYZ直接交给OpenAL，不做坐标反射。Web每帧使用Babylon相机globalPosition、getForwardRay、getDirection(Up)并反射X回原XYZ；声音位置使用权威击毁者的原XYZ，保持音源和监听器在同一坐标系。原完整相机模式、抖动与相机结果结构仍未完全复刻；当前监听器跟随当前Web相机。

实际Chromium离线输出发现Panner线性rolloffFactor=2仍按1衰减：距离475输出参考距离100处的0.75，距离850仍为0.5，与原公式应为0.5/0不符。因此BattleSound使用Panner equalpower/rolloff0负责声道定位，独立Gain计算`clamp(1 - 2 * (clamp(distance,100,1600)-100)/1500,0,1)`，在每帧相机改变时更新，距离>=850归零。后接SoundVolume master Gain，默认0.5；未声称Web equalpower与原OpenAL声像算法逐样本一致，也未恢复多普勒效应。

BattleSound在战场资源加载后预解码ID55/87/41，按权威RoomEvent.destroy和快照战车/队伍选择声音：Web模式1–3只播放己方击毁者，4–5播放所有击毁者；TankType1→55/GA14，2→87/GA46，3/4依原selector0走41/UI41。所有21战车源表映射已覆盖；第三/四类在原客户端的实际听觉表现仍待对照。声音在击毁者位置一次播放，不由本地按键触发。播放完释放source/panner/attenuation；离开/断线停止所有声音、清空事件历史、master gain归零；延迟目录或解码完成用generation阻止复活。浏览器挂起期间的一次性事件直接丢弃，真实交互只恢复context，不补播过期击毁事件。音乐与音效音量独立且同实例重入保留。

验证：test:audio检查运行参数/选择器与PE证据一致；test:audio:browser实际GA14音频图输出非零、声音自然结束清理、全部21战车选择、五模式敌方判断、音量/静音/重入、挂起丢弃、停止及加载退出通过。六组真实OfflineAudioContext运行同一BattleSound事件图，距离0/100/475/850/1600/2000的RMS比例与原公式匹配。test:combat:browser通过真实两个独立客户端键盘对战，在击毁者收到GA14/55、敌方无该击毁提示，以及退出声音清理的同时，命中/死亡/表情/满血重生回归通过。test:life:browser角色/地图异步退出回归、test:network、TypeScript通过。证据browser-audio.json的battleSound、browser-combat.json的sounds/stoppedSound。其他音效、原声像算法、人耳验听和高清联机性能仍待验收。

## 原技能开火声音与攻击头像

角色技能callback+0x8c在0x4d4338–0x4d435f注册0x4cefc9，0x42312d–0x423143传角色/技能编号。默认开火0x428cb2以2001调用0x423092；网络角色技能消息入口0x4245c9在0x424603/0x424608传消息+0x10技能编号与角色。0x4cefc9设置攻击表情，再把skillId减2001，范围0–20经0x4cf117的21字节映射与0x4cf107的4分支选择原WAV：2001/2004→GA07，2002/2003/2005/2006→GA10，2007–2010→GA09，2011–2021→GA08。角色+0x310位置与播放一次参数1传给0x485b1b，无击毁音效的队伍过滤。超出范围仍可设攻击表情，但该函数不播放这四份WAV。Skill表Sound1/2/3在这些记录中均为0，声音来自原EXE分支。

export_audio_events.py读取原偏移常量、字节分派、分支地址、WAV字符串并重读skill.dat的技能名/SHA256；audio.json新增battleFire的21条记录。TSRPC RoomEvent新增可选skillId，serviceProto已同步生成；服务器当前普通原型炮弹权威fire明确带默认2001，客户端仅按收到编号选声，未提供编号不猜音效。2002–2021完整伤害/治疗/特效规则未实现，映射支持不代表技能业务完成。BattleSound进入战场预解码四份WAV，共用原空间衰减、音量、生命周期；双方播放己方/敌方开火声，位置取权威角色原XYZ。

本轮test:audio全21记录与原字节通过；test:audio:browser21技能事件选择、未知编号不替换、四份原WAV实际OfflineAudioContext非零输出，以及174WAV/14MP3/26地图/距离/生命周期回归通过。test:network实收fire.skillId2001验证广播序列化；真实双客户端键盘双方GA07/ID48/skill2001与攻击者attack图块通过，击毁者GA14、敌方无团队击毁提示、受击/死亡/重生/退出回归通过。test:hud:browser高清attack PNG与严格到期边界及完整布局回归、test:portraits与TypeScript/生产构建通过；仍提示Babylon大分块。证据browser-audio.json的battleSound.skillSelections/fireOutput、browser-combat.json的sounds/expressions[].attack、browser-hud.json及build.log。命中/死亡/技能附加阶段和动态场景声音继续追踪。
