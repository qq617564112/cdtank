# M3-11 对局结算音乐

正式自然结算现已按玩家真实结果播放原胜利或失败曲一次，平局保留地图循环。普通2001射击、旧页面音乐和原MP3资源证据直接复用。

| 层次 | 已覆盖范围 |
| --- | --- |
| 原来源 | game_summary控制器、message+d4胜负字段身份、190/191单次音乐选择 |
| 正式消费者 | BattleMusic一次性曲目；PageMusic按roomId/round/flag消费FINISHED；Battle传正式玩家outcome |
| 普通触发 | 合法map7/mode4四账户，正常Arrow/Space击杀，自然60s TIME_LIMIT冻结WIN/LOSE |
| 双端声音与结束 | UIM08/UIM09各一次真实非零媒体输出，自然ended，正常summaryLeave回唯一大厅音乐owner |

## 原字段与调用

同controller虚表5cde80初始化槽38→4a8760，4a87ac直接加载game_summary.xml；51c962注册4ac736到owner+2500。message+d4在4ac8a0存同controller+510。

`result-music-semantics-source.py/json/log`实际执行原字段选择分支：1跳4acb4b查询DataScale31–34，原Name为“胜利…增加百分比”；2跳4acada查询39–42，Name为“失败…”；3跳4aca76查询35–38，Name为“平局…”。413d4e提供表，439184的原日志直接命名SYDataScaleTable::GetRateOfTheGame。此处仅以原记录名称识别结果字段，不接奖励规则。

`result-music-source.py/json/log`执行原4ac867–4ac88a五种字段情况：1选择190/UIM08并传播放次数1，2选择191/UIM09并传1，0/3/−1无调用。音乐服务在原直接call边界记录；完整receiver和原音频服务不由该source执行证明。

## 实现与模块验收

FX消费者为`apps/web/src/audio/battle-music.ts`；主线拥有`match/page-music.ts`和`match/battle.ts`正式生命周期。BattleMusic.playResult(1|2)读取原目录UIM08/UIM09，loop=false。ended停止真实交互恢复播放；同曲选择不重置或重播。Leave与再战选择原大厅或地图循环曲，音量、请求序号和资源清理沿现owner。

`result-music-consumer.cts/json/log`覆盖单次曲目、自然ended后交互和重复结果不重播、地图/大厅恢复循环、音量保持、晚目录销毁静默和监听释放。`result-music-routing.log`为主线路由验证。录制媒体模块不代普通播放；原MP3资源不重跑。

## 普通对局证据

`browser-result-music-2026-10-05T12-59-45-311Z.json`为PASS。四认证账户使用明确预房原tank1/pet1资料，host普通Arrow/Space瞄准guest。80条输入观察中，guest真实HP200→157→114→71→28→0，host获得一次击杀。43条Space意图不是射击次数。60s自然TIME_LIMIT冻结同一结果，host WIN、guest LOSE；不注入活动位置、HP、时间或胜负。

WIN端190/UIM08一次loop=false，captureStream峰0.953384757、RMS0.141115009，自然ended20.905938秒。LOSE端191/UIM09一次loop=false，峰0.128986746、RMS0.020802250，自然ended21.167188秒。两端observer errors为空，完整结算图显示各自真实胜负。

平局分支引用`browser-result-music-2026-10-05T12-51-49-217Z.json`的限定有效范围：四人均DRAW，没有190/191调用，保留199/GAM08循环；该原raw仍为INCOMPLETE，不将其改为完整胜负验收。

双端正式summaryLeave后worldnull，唯一音乐owner选择183/UIM01且loop=true；guest瞬时state stopped仅接受选择和清理。process清理PASS，server经SIGTERM停止、Chrome exit0，3565/5595/9795已亲核三空。`result-music-actual.json`组合来源、模块、路由和平局/胜负实际范围，权威runner79999 exit0；最终Webtype和构建38008 exit0，构建1m23、发布copy0，index mtime2026-10-05T12:59:19.048460339Z。主线主审原位回链。

## 限制

captureStream证明媒体输出，不是最终设备post-volume测量或人耳验听。自然伤害与胜负规则仍由主线记录为重建，原奖励表名称只证明字段身份。再战恢复地图曲和晚加载销毁仅复用模块/路由证据，本片没有新增浏览器再战或页面销毁验收。M3-11及全部战斗/地图表现父项保持未完成。
