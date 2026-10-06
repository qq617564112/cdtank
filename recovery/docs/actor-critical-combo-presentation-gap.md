# 暴击与连击浮字正式生产缺口

M4-09普通Damage、HPobserver Benefit及Critical selector2组合消费者已有限交付；Combo生产资格仍缺。actor-critical-combo-static.json保存具名caller、constructor和附图静态绘制合同，不计该静态文件为原执行或普通实战。

Critical的原消息身份已由`role-shot-player-message-native.json`及`role-local-shot-hurt-native.json`确认：3aa3的message+14为一bit critical布尔值，reader42cf39／writer42ce56进入完整handler424614，再由467209提交浮字；true选择selector2，false选择selector1，同一伤害43均作为signed−43送入。`role-shot-hit-flags-native.json`与`role-shot-trigger8-presentation-native.json`另确认flag15／1c及Trigger8组合保持selector2。复用这些原执行，不重复caller或普通Damage验收。

Critical由424749读取原消息byte+14非零后，以message+20送4228f1，负值selector2、Critical字体。原服务端概率与倍率生产来源仍缺，本轮正式hit分类由主线明确的Web政策供给。hurtSelector只负责方向，不能代替暴击标志。Combo由4364c4以message+10、+c、+14送429443；两个role lookup须有效，第三参数>1且本机role state!=3，随后给第二role提交selector3。现destroy.kills不能证明该第三消息参数，不能自行建立次数政策。

原selector2/3还在record+38持有CEGUI附图，不是仅切换数字字体。Critical使用zhandou00/data/ui/zhandou/1_baojishuziditu.tga（原110×82，发布ui/regions/44/11.png），Combo为2_baojixianshidanwei.tga（128×99，44/9.png）。465196绘制附图并分别调整文字；Combo额外源常数46、17。原目录尺寸不证明原GPU矩形；Critical的Web组合度量见下文，Combo组合尚未实现。

Critical的原classification消息身份已确认。主线本轮明确采用Web重建概率／倍率政策，正式命中以shotPlayerResult.critical传入，概率抽样和伤害顺序由主线持有，不冒原服务端规则。Combo的count来源仍缺，不沿Critical接口恢复Combo。

## Critical组合消费者

`TankDamageText`可选selector2独立队列，普通selector1保持Damage字体；`TankCriticalTextRenderer`组合Critical原数字图与ui/regions/44/11.png原附图。原465270–465330以image实时尺寸×record scale计算居中附图，文字向上移半个字体高度。Web消费者读取ui.json的zhandou00图集AutoScaled／NativeHorzRes／NativeVertRes与ui-fonts.json的Critical字图尺寸，按实际viewport计算；附图先于数字绘制，signed负伤害不转abs，源字体缺minus保持空白。字体行高采用发布字图的最大高度28作为Web度量，原CEGUI font+bc的动态度量及原GPU逐像素一致仍未证明。

Players私有资源初始化加载共享Critical renderer，每角色持有独立队列；角色删除／换型／round清理释放记录，Leave释放共享字图及附图。主线已正式接入shotPlayerResult.critical、Battle同hit布尔值与Players.damage参数转交；主线报告两端类型检查、server build69787及release成功。概率／倍率和判定顺序仍明确属于本轮Web重建政策。

`tests/tank-critical-text.cts`及`tank-critical-text-consumer.json/.log`接受NullEngine实际组合网格、原图身份、本机Y−100、普通分支隔离、跨角色记录清理、淡出及一秒到期。加载纹理为明确夹具；该检查不证明GPU上传、正式命中或双端可辨画面。

## 正式普通命中有限交付

`critical-hit-browser-root-review.json`接受原生键盘普通2001自然普通／Critical双端命中、同tick状态、原字体和附图实际Web绘制及源退出范围。两页Critical各24个实际render frames：44/11附图6、Critical数字18；网格启用、quad处于viewport、alpha正值、纹理来源与附图alphaIndex0／数字1均有实际记录，最终字图队列及renderer maps清空。该范围不称原GPU逐像素等价。

总合审`shot-critical-root-review.json`接受网络与网页的有限普通／Critical双命中、双端状态、原生记录与重启保存、源字图Web绘制及summary／Home关闭范围。首UI raw FAIL保留，其七次普通命中与自然复活后地形未命中不被补段改写；补段使用新的普通房间。Critical selector2消费者不再列为缺失，原服务端概率／倍率公式、CEGUI font+bc实时度量、GPU像素等价、全部车型／弹药及Combo仍未完成。PetType2/dog120普通死亡及Map14目标148破坏已有限交付；cat119仅source/module。
