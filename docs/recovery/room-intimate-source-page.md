# 房内密语对象菜单合同

UI-05 / UI-18 / UI-01 / UI-09 / M5-12。两个正式菜单已接现确认房内名单，正常双账户首次实际验收及主审通过限定范围；完整父项保持未完成。

WAITING 的 `chat_intimatelist.xml` 与 PLAYING 的 `game_main_intimatelist.xml` 均为3控件整菜单：all、biaoqingfuhaokuang、lstIntimate。前者118×124、后者118×139，原框与名单 SelectionImage 属性已在 `room-intimate-source-page-source.json` 保存。动态附着、原目录生成/筛选、点击回调和原滚动条 producer 尚未证实。

两个页面的 btnExpandIntimate 打开原三控件菜单，BattleChat 现 setTargetName(name) 与 draft 消费正常选择。ReqRoomWhisper 沿现 text/targetName/roomId/round，不能新增账户ID语义。

主线 BattleChatSnapshot.players 持确认的 id/name 数组，Battle.reconcile 消费现 snapshot.players，仅成员、顺序、id/name 变化通知，运动/hp等每tick变化不触发名单更新；clear退出/断线清名单。UI复用现chat订阅直接消费 state.players，没有新App/store/poll。UI不修改 Battle/RoomSnapshot/协议或controller生命周期。

整菜单消费真实名单与源几何，选择仅调用现 setTargetName，保留草稿/光标/输入focus。原名单 producer 未证实，因此呈现明确为 Web 确认房内名单投影，完整父项仍开放。首次实际只覆盖新菜单名单/选择/取消/键盘/组合输入/页面缩放与正常上下文，既有密语权限/投递/战斗结算不重复。

`source-chat-intimate.tsx/css` 由两正式消费者接入：props 为 ui/waiting/players{id,name}/selectedName/pending/composing/choose(name)，候选保持真实角色ID作DOM key，现事务仍只昵称。WAITING Web 附着(78,39)相对chat402；PLAYING(52,-12)采用菜单原静态坐标相对chat435，均不宣称原动态附着已恢复。缺少名单时仅空态，不生成临时玩家。源框/中心/选中图与Web原生overflow消费，原滚动条未恢复。

根Escape采用capture先于名单内部键盘隔离，组合guard与源toggle返回保留；名单鼠标及Home/End/Arrow/Enter由React持候选与焦点。独立模块不启动或刷新网络。UI owns BattleChatView presentation、WaitingChatSourceView/SourceBattleChat 的btnExpandIntimate及菜单互斥/outside/根captureEscape，原channel/emote/store/Ready业务保留。
## 实际与主审

`recovery/output/browser-room-intimate-source-page-2026-10-04T22-45-01-292Z.json` 为 PASS。两个普通账户正常建房/加入，WAITING 名单含两名玩家，正常增加两名 CPU 并经资源就绪门禁 Ready 后，PLAYING 名单含四名玩家。两阶段各保存800×600、1920×1080、3840×2160完整页面，源三控件、八框层与实际名单可辨。

鼠标及键盘选择保留中文草稿，WAITING caret=7、PLAYING caret=8，均返回输入焦点。取消保留原目标和草稿；native Escape 无外漏键并严格返回源 toggle；按住、移出、释放确认 capture 清除且按钮恢复 Normal。组合范围为合成昵称 composition 状态配合 native mouse/Escape。双端正常 Leave 后名单清空、聊天卸载、建房入口严格聚焦。此次未发送消息或购买。

`recovery/output/room-intimate-source-page-accepted.json` 汇总六图及实际字段。主线亲审代码、raw 和六完整图，结果见 `recovery/output/room-intimate-source-page-main-review.json`，状态为 `PASS_CONFIRMED_ROOM_TARGET_MENU_SCOPE`。工程复用 `battle-chat-roster.log`、`room-chat-roster-web-types.log` 和 `room-intimate-production-web-build.log`；统一类型检查与构建通过，构建耗时2m20。

## 尚未确认

原名单生成/筛选、动态附着、点击回调、CEGUI滚动条、原字体与完整页面1:1未确认。当前原生 Web overflow 未验长名单滚动，组合验收不覆盖操作系统 IME 候选。UI05/UI18/M5-12 及完整 WAITING/PLAYING 父项保持开放。
