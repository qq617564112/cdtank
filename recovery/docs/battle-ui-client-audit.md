# 战斗 UI 原客户端核对与当前接入

范围为正式战斗主 HUD、八槽栏、小地图、五模式面板、战车头顶标签及战斗聊天。来源直接读取 `CDTank/CDTank.exe`、`recovery/output/current-exe.asm`、原 `Data/ui/layouts/game_main*.xml`、已发布 `web-assets/ui.json` 和已有取证文档。

## 控件覆盖

原 `game_main.xml` 共165控件。当前消费者分配为主HUD树121个、八槽栏41个、小地图及边框2个、真实退出按钮1个。五份模式面板另外含30控件，保留各自父树、原图标、乘号和时间矩形。

| 范围 | 当前正式显示 |
| --- | --- |
| 玩家侧栏 | 十二槽姓名、宠物头像及攻击/受击/击毁/死亡/复活表情、原生命进度、权威称号及默认首级称号；擒王VIP徽章 |
| 本机主生命及装填 | 原生命图、三段色、准星装填；弹匣宽度 `capacity×15`、剩余/容量进度 |
| 八槽 | 默认弹无限图、确认数量、确认选中弹槽、装填/道具剩余秒数、点击选弹/立即使用 |
| 小地图 | 原场景俯视图、25图独立NAV/RPT映射、八边框、敌我坦克/王/目标、光学迷彩过滤 |
| 五模式数字 | 双方剩余生命、整数占领分、双方王生命、本机击毁、剩余破坏目标；只显示当前模式 |
| 开场 | 当前模式原图2秒，随后Fight原图1秒；`MatchSnapshot.battleStartsAt`服务端deadline前所有坦克不动，提示完才计时/移动；切阶段和离房清理 |
| 战车头顶 | 其它玩家/队友/敌人的权威/默认称号、姓名/王标记、原96×4血条、生命数字与温和距离缩放；当前策略隐藏本人头顶标签 |
| 聊天与消息 | 闲置隐藏聊天、Enter编辑、确认发送退出、拒绝保草稿、新消息短显；原战斗消息最近五条、图文排版、8秒透明度及hover |

房间快照入口与渲染帧共同更新HUD。WAITING/LOADING隐藏战斗HUD，PLAYING显示，FINISHED保留终值，换局与离房清空旧数值。个人模式只将本人视为友方，个人模式的其它玩家按敌方着色。侧栏与可见敌我标签均无选用默认ID1。

## 本轮直接读到的原指令

- 小地图初始化 `0x47285c`：选择子0使用 `wotanke.tga`（字符串 `0x5c9308`）及颜色 `FF5DF587`；选择子1/2使用 `danke.tga`（`0x5c92ec`），颜色分别为 `FF80ACF7`（`0x47292c`）和 `FFF57E78`（`0x4729be`）。`0x4d1637–0x4d1642`将本人以0送入，`0x4d173c–0x4d1741`将本队其它成员以1送入，`0x4d2015–0x4d2020`将对方以2送入。Web沿这三个颜色着色原轮廓。
- 原三部件和四部件战车初始化分别在 `0x46a108`、`0x46d5f7`读取 `wanjiaxuecao.tga`（字符串 `0x5c87f0`）；四部件 `0x46d66b`读取 `wanjiaxuecao_jindukuai.tga`（`0x5c87c4`）。原图块为96×4，发布区域77/127、77/128。
- `picFight`缓存至HUD+0x72c（`0x4c7a97`）。`0x4cca4e–0x4ccac6`隐藏模式图及倒数，显示Fight并清计时+0x730。frame `0x4caf69–0x4caf9b`在Fight可见时累计dt，严格超过常量 `0x5cfb10`后隐藏；直接读取PE该常量为float32(1.0)。Web将Fight显示1秒，模式介绍前段采用2秒呈现政策；开始门禁由`battleStartsAt`统一供给，客户端只显示服务端剩余提示。
- 原主弹匣 `0x4cb52f–0x4cb5a2`对允许显示的角色状态设置宽度 `capacity×15`、进度 `remaining/capacity`。当前Web以确认弹匣及战斗阶段供给该消费者。
- 称号与VIP字段链沿 `battle-hud-title-source.md`；账户称号持有/选用与持久投影及 `PlayerSnapshot.title` / `HudPlayer.title`（`player.title?.name`）接线已接通（UI-39），有已选用称号时优先显示，缺值时才回退已确认原表ID1“嗷嗷待哺”。空玩家槽保持空白。
- 小地图底图未加载时，只要权威快照带固定地图边界就照常投影玩家与占领/破坏目标，权威坐标/目标不被吞掉；旋转只作用于坦克轮廓（按 `bodyYaw`，缺省 `yaw`），不旋转王徽章或定位。目标/占领着色选择器改为 `data-objective-side` 友/敌，与本机/本队/敌方三色一致。

控件映射见 `game-main-control-map.md`，状态及五模式映射见 `hud-m505-integration.md`。用户确认规则见 `battle-hud-confirmed-rules.md`，原动态俯视纹理与25图范围见 `hud-minimap-coordinate-source.md`。

## 生命周期状态

死亡及AI托管期间禁用手动键盘输入，死亡、切换控制与换局清除按键缓存。死亡和终局位置按权威快照收敛，FINISHED立即设置最终位置及朝向，并停止移动动作；最后一次快照也清理被击毁目标及已死亡王的标记。提前结算后的模式时钟由冻结的`match.result.endedAt`计算，结算窗口停留期间保持终值。

断线立即禁用八槽操作，恢复原房间后按最新权威快照重置本机运动预测，并保留已载入地图和碰撞资源。死亡数字使用原Countdown图字资源，复活授权取服务端状态。接线范围见`battle-ui-lifecycle.md`，页面表现仍待实测。

## 附属界面接线

原 `game_main_chat_shrinked.xml` 有 `btnFamily`/`btnGM`。当前Family持久归属、operator、服务端路由及三页Web入口已接；GM沿频道6提交并持久保存，原自动回复、operator单条人工回复、认证查询／定向推送及Web回复入口已接，详`family-chat-runtime.md`和`gm-support-replies-runtime.md`。`game_summary_title.xml`（`wndDialog`/`txtMessage`）已消费本局账户事务授予的新称号，四值奖励阶段结束后逐个提示。`game_summary_dialog.xml`（`wndDialog`/`picItem`/`txtMessage`）原入口 `0x4aa7ab` 使用道具表与 `daoju0`，`0x4aa998` 使用另一队列与 `tanke0`；实际发放与网页展示合同见 `battle-summary-equipment-source.md`。原 `keyboard.xml` 为登录密码软键盘，不属于战斗附属界面。

原HUD `edtBattleInfo`由 `HudBattleInfoView` 复用既有 `ChatEmotes`，消费颜色、Imageset图片、序列表情和像素换行，沿原最近五条容量（`0x4d0278–0x4d028f`）及透明度生命周期。已定位的五类原模板583/584/585/586/591均由 `battle-info-messages.ts` 消费：公共击毁、换弹、使用道具、连续击毁及本机击毁积分；换弹和使用道具事件由服务端成功确认产生。`finish/leave/friendlyFire/itemRejected`采用当前确认文本，其原模板与生产来源尚未取得；本次没有定位到额外已证但未消费的原战斗公告模板。

结算已接原胜负大图、五模式列头、本人绿色条目、宠物胜负表情、九奖项逐项提示及真实新增称号。宠物ID冻结自已选用owned base字段8，胜者两帧每0.5秒切换，败者/平局用die图；每个实际颁发奖项展示2秒。擒王列累计敌方VIP实际HP损失，占领列累计实际扣除的敌方碉堡HP。来源及限制见 `battle-ui-missing-runtime.md`。

## 剩余接线与原操作差异

| 项目 | 当前状态与原来源 |
| --- | --- |
| 家族入口与业务 | 持久归属、operator、服务端路由及三页Web入口已接，实测待做；原频道4发送分支 `0x4913aa–0x4913ab`直接跳过，完整原通信仍缺来源，当前路由为Web采用 |
| GM人工处理与回复 | 提交、自动回复、operator人工回复、认证分页查询／定向推送及Web回复入口已接；原客服处理程序未取得，实际联机、重登录和持久实测待做 |
| Ctrl键绑定 | 共享校验、两个设置入口和BattleInput均接受`ControlLeft/ControlRight`；新默认`useItem`为ControlLeft，旧合法绑定保留，保存／重启实测待做 |
| 切换道具即使用 | 已接：原 `4ceac5/4cebf0`选槽后调用 `4cb2f5→43d4dc`请求使用；当前PageUp/PageDown选定槽后立即沿普通快捷槽入口发送一次使用请求 |
| 武器切换中的陷阱 | 已接：原槽2–4的类别4进入 `43d5f3`请求放陷阱；当前Home/End从已确认Inventory加入真实陷阱候选，切到该槽沿已有分派请求放置，实际炮弹仍取服务端确认 |
| 端点与耗尽槽 | 已接：两组循环越界保留旧索引，保留已配置零量项，数量0交统一入口播放UI28并拒绝；空槽无声，实际网页操作待测 |

端点和耗尽槽的原指令、采用规则与生产接线见 `battle-cycle-controls-source.md`及`battle-cycle-controls-runtime.md`。装备实际发放、原593/829退出确认及账户扣分、乱斗 `catsInfo+dogsInfo`均已接入，规则见 `battle-equipment-exit-melee-rules.md`。

正式PLAYING的弹药数量由八槽栏呈现，中央反馈只保留增益/错误文字，无重复弹量或滚动条。正式战斗页不提供道具丢弃入口、选择框或按钮；页面与地面事务范围见battle-play-page-source.md、ground-item-client-presentation.md。

## 限制

未运行测试、构建、类型检查或浏览器验收。控件覆盖和上述原指令核对不代表完整高清/原版视觉已验收。原始旧服务端producer未恢复属来源边界；角色 `m_iNowTitle` getter / 称号 table 事实与 typed Web snapshot 按 `title.name` 采用是两条独立事实，不写当前功能缺失。`game_main.xml`没有独立勋章控件，擒王VIP已接；未取得原世界标签勋章执行/资源合同，不列为已证漏接。原动态纹理相机/整数矩形、阶段生产与公告上游仍有取证边界。原装备概率、退出计数字段完整业务名及乱斗DogsInfo上游仍缺来源；当前采用规则与接线见battle-equipment-exit-melee-rules.md。其余模式数值、标签美观优先、剩余时间、介绍时长与现有聊天已由用户确认；M5-04、M5-05、UI-09父项继续待验收。
