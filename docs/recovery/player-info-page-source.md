# 玩家资料根页面

`playerlist_playerinfo.xml`包含35个控件。根SheetWindow为405×391，picLowerPanel下边405且ClippedByParent=False，因此网页可见内容区405×405。背景mask原坐标−209,0–591,598；分隔tiao为−6,188–401,239，按源坐标保留外延，网页native modal backdrop负责当前浏览器遮蔽。根居中与viewport/800×600缩放为网页窗口投影。

| 控件 | 来源与消费 |
| --- | --- |
| SheetWindow | 原透明根405×391 |
| picBackgroundMask | gy0/zhezhaotu原800×598遮罩 |
| anniulanditu | 蓝条397×37，lantiao3及左右lantiao1/2 |
| shangditu | 0,35–405,229原九块zkd框，左右zkd16/17 |
| anniuditu2 / btnEnlarge | 原透明附着框与无图按钮；展开业务未恢复 |
| heseditu | 上框内10,9–166,30原灰底 |
| picLowerPanel | 0,215–405,405原九块zkd框，左右zkd4/5 |
| xiaotiaoditu | 下框内11,144–298,172原按钮底纹 |
| rdoBattleSummary / rdoAwardSummary | 下框内原统计RadioButton，统计业务未恢复 |
| xiaochaditu / btnClose | 根370,0透明父框；Close根361,−1–398,36三态原小取消图 |
| shangmianditu | 9,44–388,203原ditu4资料背景 |
| txtPlayerName / txtPlayerStatus | 根29,50–169,66与179,50–249,66；真实账户姓名、连接/房间状态投影 |
| txtLobbyName | 原Visible=False，保持隐藏 |
| txtPlayerTitle / txtPlayerFamily | 源位置保留空文字 |
| txtPlayerOriginality / txtPlayerTech / txtPlayerScore | 源位置保留空文字，不填零 |
| picPetIcon / picTankIcon | 原无Image，保持空图标位置 |
| txtRoomNumber | 源位置保留空文字；布尔inRoom不造房间编号 |
| edtPlayerDescription | 源透明文本区225,81–375,180，空只读文本 |
| tiao | 原分隔图外延保留 |
| xiaodong / picLevelIcon | 原无Image，保持空位置 |
| btnAddFriend / btnRemoveFriend | 同根3,194–84,236；依权威isFriend显示Add或Remove原图 |
| btnAddBlacklist / btnRemoveBlacklist | 依权威isBlocked在同位置切换Add/Remove原图，见player-info-blacklist-source.md |
| btnInvite / btnExchange | 原按钮/位置保留禁用，无业务回调 |

所有图框和按钮沿共享SourceStaticImage/SourceButton原消费规则，文字沿SourceStaticText既有SIMSUN有限glyph/TTF fallback。SourceButton复用原hover/pushed/capture、disabled imagery和radio checkmark消费者；不新建图态规则。

## 账户投影接口

`PlayerInfoView`接open与真实player `{accountId,name,isFriend,online,inRoom}`、pending/status、onAddFriend/onRemoveFriend/onClose。UI不查询或写入账户；root控制正在查看的稳定accountId及权威关系确认。原Add/Remove同位置替换，pending禁用关系按钮，确认结束在原位恢复焦点；Close和Escape回打开资料的名单控件。姓名沿已认证目录，在线/房间中文状态是网页账户连接状态投影，不声称原字段codec。

## 限制

原统计子页`myhome_playerpage_battlesummary.xml`根0,198–375,332与`myhome_playerpage_awardsummary.xml`根0,197–375,330确实存在，但playerinfo布局没有附着引用/偏移；未取得调用链前不猜其位置或统计值。原称号、家族、技术/分数、介绍、等级/角色图标、房号、展开、邀请、交易、QQ等未恢复。单向好友规则和打开资料手势由对应业务文档明确为重建；完整资料/字体/GPU父项保持未完成。
