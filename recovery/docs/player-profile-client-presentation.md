# 玩家公开资料客户端表现

本文登记M5-13/M6-09/UI-41、UI-42、UI-43的客户端表现边界。原来源事实为`playerlist.xml` 9控件、`playerlist_playerinfo.xml` 35控件、`playerlist_QQ_number.xml` 3控件和两张Home统计页；当前Web采用只改变消费者挂接，不改原资料sheet几何。

## 目录与资料sheet

在线/好友目录保留原`haoyou`根区域、`PlayerList` 9,58..179,478和源SelectionImage，`FriendTab`/`PlayerTab`仍为独立radio图态，`picFriendTabSelect`/`picPlayerTabSelect`按页显示。名单滚动、选择、键盘和普通Friends/Blacklist QUERY/ADD/REMOVE保持现有业务。

`PlayerInfoView`保留`playerlist_playerinfo.xml`的405×391源sheet、`picLowerPanel`底405、原图层、三态Close/Escape和modal焦点。Web外层可加宽到800以容纳伴随页，但原35控件坐标和内部图不变。

字段表现：

| 字段 | 当前表现 |
| --- | --- |
| 姓名 | 优先确认`PlayerProfile.name`，否则现有公开行name。 |
| 在线/房间 | 现有公开presence：在线、房间中、离线。 |
| 称号 | 确认`PlayerProfile.title`或公开行worn title；确认无title时清空旧行text。 |
| originality/tech/score | 确认growth；无growth时只接受已存原summary三字段；unknown为空。 |
| level | 仅Web summary caption显示确认level，不伪造`picLevelIcon`。 |
| family | 仅取同一目标已确认`PlayerProfile.family?.name`，显示在`txtPlayerFamily`原位置；未查询、不传query、确认无family或失败且无已确认family时为空，不猜填。 |
| description/QQ | producer未知，保持空，不猜填。 |
| 房间tank/pet | 仅房间详情已有真实来源可显示；目标公开资料不伪造图标。 |

资料查询pending禁用好友/黑名单/交易按钮，错误保当前目标并可局部retry。Close和原生Escape沿用原player row焦点返回；不存在时回退原列表根。

## 统计与获奖

`rdoBattleSummary`和`rdoAwardSummary`是原资料sheet中的两个独立radio。当前实现让它们打开Web父容器伴随页：

- 战斗统计使用`myhome_playerpage_battlesummary.xml`原页原图片、文字控件和内部几何，文字来自所选目标`PlayerProfile.statistics`。
- 获奖统计使用`myhome_playerpage_awardsummary.xml`原页原图片、文字控件和九计数，文字来自所选目标`PlayerProfile.awards`。
- 真实aggregate 0显示0；缺`statistics`、缺可选`roundStats`或缺awards时对应cell为空，不填unknown为0。
- hit rate和时间沿既有统计表现；shots/hits任一未知时命中率空。
- 两页不调用owner history，不复用Home owner-history fallback；没有第二来源替换所选目标response。

summary资源通过`prepareSourceUi([suffix])`准备实际图片并等待decode，失败保留目标资料和response，在summary内局部反馈并可重试。重试只处理该统计页资源，不重发`PlayerProfile`。

这是明确Web父容器附着，不声称恢复原资料页内统计子页附着或偏移；原统计父项仍未关闭。

## 未恢复

`playerlist_QQ_number.xml`只保留原151×59小页、九块框和居中文字事实，不展示空popup，不访问外链。原`btnQQ`、调用者、QQ号producer、原个人介绍、房号、level icon和原公开role icon仍未取得。目标当前family Web映射已知并落地，原public family producer仍未恢复；等待房间不传query保持空family，不虚构房间账户关联。

本次target generation、error retry和resource处理未实测。真实页面、真实联机、持久重启、高清和原统计/QQ父项保持未完成，UI-41/UI-42/UI-43/M5-13/M6-09不勾。
