# 正式对局结算页

M5-06/UI-19消费game_summary.xml的原800×600根，左右队伍各六行、主要上下底图和btnClose。React新增battle-summary-page.tsx/css持有资源、缩放、名单页码，主线battle-match拥有正式FINISHED分支和现请求owner。SourceButton消费原Close三态图片。当前Web采用min(viewportWidth/800,viewportHeight/600)居中，字形和原高清规则尚未证明。

合同为results:readonly ResultPlayer[]、playerId、round、mode、title、objective、status、pending、hasLocalPlayer、soundVolume、returnToRoom。soundVolume读取Battle当前运行中的音效音量。team直接使用computeMatchResult已冻结的真实字段。团队模式按真实team分列、rank排序；每队超过六人按页完整可达。个人模式4/5按整体rank依次填两列，不显示Cat/Dog队伍图，标明个人排名；数据中的team仍为真实值。超过十二条同页码完整可达。

原txtPlayerName、txtScore、txtExtra沿完整父链消费。Score随实际奖项逐项累加到冻结combatScore；Extra随原五模式列头显示击毁、碉堡伤害、VIP伤害、击毁、破坏目标。擒王列取累计实际敌方VIP HP损失，占领列累计实际扣除的敌方原CAS碉堡HP。排名、总分、结局加分、死亡和目标数保留在整行提示及辅助文字中，行内原奖章区域消费真实RoundAward。本人用原绿色底图；picWin/picLose/picDraw读取本人的冻结outcome。

原btnClose“继续”返回本局原等待房间，保留成员、队伍与房间设置；结算页没有再战提示和确认再战按钮。Rematch事务记录成员关闭结算，第一次继续使原房间进入WAITING并清空真人准备状态，CPU保持准备。冻结结果和同局号回执保留到下一局载入；尚未继续的参战者仍显示自己的FINISHED结算，必须继续后才能准备。全员重新准备后才载入下一局并递增局号；房主在所有仍在房的参战者返回后可修改设置，修改设置同样结束原局号。返回原房间、多人独立关闭结算及重新准备的完整流程尚未实测。

面板0.7秒入场，玩家行每隔0.3秒入场，再播放胜负图0.7秒缩放/位移、3秒滚分及每项2秒的实际奖项。成长进度从已提交receipt的rankPointsBefore逐级变化，每个等级段1秒；四种奖励数值由原game_summary_award消费，0.2秒滑入并于3.2秒自动衔接本局新称号。每条称号按原3.4秒横移动画自动继续，末段奖励层1秒渐隐。个人排名标识、分页、保留最终名单、提示文字及留边颜色为Web呈现。静态来源与接线见`battle-summary-sequence-source.md`。

九个原音效按结算阶段、实际奖项、升降级和新称号触发；玩家行阶段入口播放一次UI36。颁奖UI38循环在成长前停止，UI29沿滚分和经验帧请求短声部。资源准备完成后开始演出；声音载入失败显示状态并保留结算操作。声音生命周期及原调用点见`battle-summary-audio-source.md`。

结算宠物ID从真实选用owned base字段8冻结，包含中途离场者。原fenshujiesuan0的`${petId}_yeah_1/2.tga`每0.5秒轮换，败者/平局取`${petId}_die.tga`。ResultPlayer.petId、ResultAward.grantedTitles及RoundStats.vipDamage沿现TSRPC schema附加字段；称号查询复用同局已持久授予记录。详细来源见 `battle-ui-missing-runtime.md`。

## 验收范围

专属首次真实操作以两个资金导入但未导入拥有角色的普通账户，正式商城BUY3和Home选用，正式mode1/map7建房与加入、准备、普通Space开火、短TIME_LIMIT自然终局。检查两端冻结结果/真实队伍/十二源槽，800×600、1920×1080和3840×2160整页、后续投票快照不改变结果、pending/voted、下一局PLAYING与源Close大厅焦点。个人模式投影沿真实合同实现，本片不新跑其余模式。

## 未完成

全185控件、原Score细分语义、FontScoreHT与1:1高清规则仍未完成；道具/坦克奖励已由账户结算事务实际发放并沿回执显示，原发放资格与概率仍缺来源，采用规则见battle-equipment-exit-melee-rules.md。碉堡伤害、称号自动提示及结算时序已有代码接线，新增内容尚未实测，UI-19/M5-06父项不勾。下列历史证据只覆盖当时已验证的名单、导航与焦点。

首实际整页证据为browser-battle-summary-page-2026-10-04T18-16-45-123Z.json有效finished/rows/sizes字段与800/1920/3840三图，已逐图实际查看。两端同一TIME_LIMIT冻结结果、真实team/rank/name/combatScore/outcomeBonus/totalScore与十二原槽一致，普通Space未命中，combatScore=0保持真实；EXP奖励空白。图片中排名尚只保存在data属性，最终源码已在行内补“第N名 · 总分”，不因此重跑三res。

导航有效字段为18-18-49-239Z.json的firstVote/rematch/secondFinished/leave.lobbyVisible。真实pending disabled→voted disabled，第一票后的两端result与首freeze完全相同，另一端普通确认后两端均round2 PLAYING；第二自然终局两端原Close正常退出并显大厅。该raw的focus字符串记录实际body，不能采用其整体PASS作为焦点证据；最终runner改为直接matches当前焦点元素。没有真实拒绝返回场景，本片不宣拒绝状态已验。

最终退出焦点以独立--leave-focus-only真实新会话建房/原等待Close复用相同共享退出owner证明：当前activeElement是启用的data-room-card-create按钮，真实鼠标点击可再次打开原建房页。没有再次BUY3、投票、三res或第二自然终局；summaryClose的真实Leave业务与大厅可见复用前述导航字段。原等待Close首leaf在创建dialog仍open时被仪器阻止点击的raw保留，不作为功能失败或完成证据。最终accepted采用三res整页、投票导航与严格焦点的组合有效范围，父项仍未勾。
