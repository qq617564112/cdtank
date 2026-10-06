# 正式对局结算页

M5-06/UI-19消费game_summary.xml的原800×600根，左右队伍各六行、主要上下底图和btnClose。React新增battle-summary-page.tsx/css持有资源、缩放、名单页码，主线battle-match拥有正式FINISHED分支和现请求owner。SourceButton消费原Close三态图片。当前Web采用min(viewportWidth/800,viewportHeight/600)居中，字形和原高清规则尚未证明。

合同为results:readonly ResultPlayer[]、playerId、round、mode、title、objective、status、pending、voted、hasLocalPlayer、requestRematch、leave。team直接使用computeMatchResult已冻结的真实字段，无协议或账户事务改动。团队模式按真实team分列、rank排序；每队超过六人按页完整可达。个人模式4/5原joiningTeam全部为0，按整体rank依次填两列，不显示Cat/Dog队伍图，标明个人排名；数据中的team仍为真实值。超过十二条同页码完整可达。

原txtPlayerName、txtScore、txtExtra沿完整父链消费。Score显示当前combatScore，Extra显示outcomeBonus，是Web业务投影；原Score/Extra语义与FontScoreHT未证明。当前总分、击毁、死亡、目标计数保留在行内原奖励空区，以可读文字呈现，不推造奖励图或将totalScore当作钱。重复动态header与奖励/等级/EXP producer未知，保持未完成。未启用没有行为证据的重叠高亮层、胜负和奖项图片。

原Close接现退出房间动作，不绑定再战；原Close回调语义仍未知。再战是独立Web按钮，沿现owner的pending、voted和错误状态，原下方空区显示当前业务状态。原EXP条与奖励数值不填账户值。个人排名标识、分页、再战、行内额外数据与留边颜色均为Web呈现。

归属仅新battle-summary-page.tsx/css、专属browser/source/doc。battle-match桥接、SourceButton suffix由主线维护；不改伤害、原奖励、ScenePreview或Battle生命周期。

## 验收范围

专属首次真实操作以两个资金导入但未导入拥有角色的普通账户，正式商城BUY3和Home选用，正式mode1/map7建房与加入、准备、普通Space开火、短TIME_LIMIT自然终局。检查两端冻结结果/真实队伍/十二源槽，800×600、1920×1080和3840×2160整页、后续投票快照不改变结果、pending/voted、下一局PLAYING与源Close大厅焦点。个人模式投影沿真实合同实现，本片不新跑其余模式。

## 未完成

全185控件、原动态可见producer、EXP/币/奖项/等级、原Score/Extra语义、原字体和1:1高清规则未完成；UI-19/M5-06父项不勾。当前证据记录完成后提交主线审查。

首实际整页证据为browser-battle-summary-page-2026-10-04T18-16-45-123Z.json有效finished/rows/sizes字段与800/1920/3840三图，已逐图实际查看。两端同一TIME_LIMIT冻结结果、真实team/rank/name/combatScore/outcomeBonus/totalScore与十二原槽一致，普通Space未命中，combatScore=0保持真实；EXP奖励空白。图片中排名尚只保存在data属性，最终源码已在行内补“第N名 · 总分”，不因此重跑三res。

导航有效字段为18-18-49-239Z.json的firstVote/rematch/secondFinished/leave.lobbyVisible。真实pending disabled→voted disabled，第一票后的两端result与首freeze完全相同，另一端普通确认后两端均round2 PLAYING；第二自然终局两端原Close正常退出并显大厅。该raw的focus字符串记录实际body，不能采用其整体PASS作为焦点证据；最终runner改为直接matches当前焦点元素。没有真实拒绝返回场景，本片不宣拒绝状态已验。

最终退出焦点以独立--leave-focus-only真实新会话建房/原等待Close复用相同共享退出owner证明：当前activeElement是启用的data-room-card-create按钮，真实鼠标点击可再次打开原建房页。没有再次BUY3、投票、三res或第二自然终局；summaryClose的真实Leave业务与大厅可见复用前述导航字段。原等待Close首leaf在创建dialog仍open时被仪器阻止点击的raw保留，不作为功能失败或完成证据。最终accepted采用三res整页、投票导航与严格焦点的组合有效范围，父项仍未勾。
