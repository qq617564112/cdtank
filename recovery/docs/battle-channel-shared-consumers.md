# 战斗频道菜单原共用消费者

UI-10 game_main_channellist.xml七控件。原all48×124@(1,4)，biaoqingfuhaokuang48×123，五原radio：Public/Team/Friend/Private/GM。已有SourceBattleChat菜单使用简化固定20frame和普通Normal/CheckMark单层按钮；开菜单将channelChecked清false，使已生效频道无选中反馈。本片恢复该完整菜单来源消费者，保业务频道0/1/2/3及当前GM禁用。

拟归属source-battle-chat.tsx仅频道菜单/四toggle、source-battle-chat.css仅菜单span规则；原资源与已证共用StaticImage/Button规则复用。toggle布局取game_main_chat_shrinked.xml，sourceButton类型suffix由主线添加。根/框/radio按sourceProps原父坐标，offset(-1,-4)适配现菜单(2,10)附着；位置上游未证明确Web。SourceImageScale沿现stage scale，不改全chat/emotes/scrollbar等消费者。

保releaseKeys、channel变更、inputfocus、外部pointerdown/blur关闭。频道菜单keydown/keyup隔离，Escape恢复当前toggle，原四正常频道草稿能力不丢。无发送/权限/网络/战斗数值改动。验证本页首次800/1920/3840实际正式整页带完整菜单，源frame/state与正常频道/草稿/键盘/capture；仅必要普通合法开局作为上下文，旧五模式/伤害/发送/结算证据复用。原GM权限/字体/位置/fullUI09与1:1仍未完成。

UI-28 keyboard.xml原为软件字符输入键盘，不能映射当前15动作高级设置；该候选仅来源边界记录，无代码或额外取证。

## 实际交付

source-battle-chat.tsx频道7控件与四toggle已迁移Shared StaticImage/Button；删除人工channelChecked=false，用真实channel消费原radio Pushed背景+CheckMark二层。SourceImageScale仅包本菜单/toggle，旧消息框/表情/scrollbar及store/send/Scene/Battle生命周期不改。source-battle-chat.css仅菜单span的绝对定位/pointer-events:none。

21-11-33首raw PASS：正式大厅普通mode1/map7建房、三CPU、真实mapLoaded/resourcesReady/noLoadingError后sourceReady进入PLAYING；800/1920/3840完整正式页七控件/八frame+center/PNG加载和viewport通过。Public实际选中各res二层PushedImage+CheckMark，GM原DisabledImage空零图保持禁用。三完整图均亲看，菜单房间/队伍/好友/密语文字与根框可辨。nativeEscape window键[]且严格原btnPublic焦点；四正常频道切换“战斗频道草稿”保持、唯一input焦点；Tab/Enter普通选择后源Close正常Leave恢复严格enabled大厅Create。没有BUY或聊天发送；CPU自然活动是开局上下文，未对伤害或其他旧玩法做新验收。

21-13-36 capture-only raw PASS：resolutions=[]/0PNG/无旧三res或选择Escape重放，只补首scope模板提到但首未记录的helddrag状态。真实Team radio Hover→Pushed hasCapturetrue→拖外Hover+pushedtrue且capturetrue→外释Normal/pushedfalse/capturefalse，当前Public保持选中、菜单仍open；正常Leave清理。两个raw/三图组合索引battle-channel-shared-consumers-accepted.json待主线有限审查，完整原位置producer/GM/font/fullUI09/11及1:1父不勾。

Focused production Webtypes exit0；最终消费者尚待主线下一必要统一build，不独立全build。两run3417/5447/9647、临时sqlite/Chromium目录均finally清理。

主线已亲看800/1920/3840三完整PLAYING图并核两raw的有限操作与捕获段；battle-channel-shared-consumers-main-review.json限定接受，UI-10当前七控件菜单已原位勾选。原动态位置、GM、字体/1:1及UI09/11父保持开放。
