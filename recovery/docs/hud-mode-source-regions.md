# 正式 HUD 模式主要区域

M5-05、UI13/14/15/17。正式`HudLayout`此前仅对mode2–5绘制SheetWindow和倒计时，原图标与乘号没有进入React树。当前原`game_main_info_conquer/vip/melee/destroy.xml`的根、原Image引用、矩形与`txtMultiply.Text=*`完整，可以恢复各模式主要原静态区域。

归属为`battle-hud-view.tsx`仅模式区域选择/原乘号及未绑定数字标识、新source/browser/doc。不改BattleHud发布/状态、协议、模式规则、伤害、账户或Battle/Scene生命周期；所有正常目标说明继续由现Webobjective显示。

已有producer索引一轮核对：`mode-runtime.md`确认模式根身份/计时路径；`destroy-info-source.md`确认原破坏txtInfo更新CatsInfo+DogsInfo、初始化只CatsInfo，角色0x15/+0x314覆盖CatsInfo，DogsInfo生产与对象递增触发未证。混战原0xa/+0x28同样只是CatsInfo一部分。VIP/占领数值setter没有给出可直接使用的现权威字段语义。不得把当前占领秒、王HP、kills或objectivesDestroyed注入这些原数字控件；本片数字留空，不扩大底层取证。原源星号是明确布局文字，并非推造数字。

验收只检查新模式主要区域。正常formalCreate/CPU资源gate/Ready为显示上下文，首mode2整页800/1920/3840验证根/图标/源引用/PNGdecode/未知数字空、timer和Webobjective可读；mode3/4/5各正常首1920整页确认相应原图标及源乘号，没有旧模式图标残留，普通Leave返回大厅焦点。0BUY/用户战斗输入/终局/玩法或旧五模式连续两局重跑。其余模式高清及所有原数字producer仍未完成。

实际证据：`browser-hud-mode-source-regions-2026-10-04T21-57-19-457Z.json` PASS。正常formal四上下文为mode2/map2、mode3/map2、mode4/map7、mode5/map20，每次普通3CPU/resource gate/Ready/Leave。首mode2三res整页、另三模式各1920整页共六图均实查。mode2/3六控件含两原图标；mode4/5五控件含一原图标和布局乘号。各原Image引用与正式DDS PNG逐值映射/解码，只有当前模式根可见，模式切换没有旧区域残留；未知原数字均data-mode-info-binding=unbound且无文字。

所有页面正常展开现对局控制后Webobjective文字及矩形可读、在视口内，没有把占领秒/王HP/击毁/摧毁值写入原数字。普通Leave均HUD隐藏/strict enabledCreate焦点。没有购买/聊天发送/用户战斗输入；CPU自然伤害只提供真实PLAYING背景，不作为新玩法/终局验收。3422/5452/9652和临时db/Chromium清理完成。

`hud-mode-source-regions-accepted.json`保存源码、六整图、raw与限定证据，focusedWebtypes exit0，主线标准npm run build通过（hud-mode-static-production-web-build.log），正式Web发行已含该hunk。只建议原静态主要区域有限登记；UI13/14/15/17数字与完整M5-05/HUD父继续未完成，其他三模式基准/4K页范围没有冒充已验。

## 当前接入

当前五份原数字已接确认快照，团队剩余生命、占领分、双方王血量、剩余目标的含义已由用户确认采用，mode2–5不再留空；teamScores整数截断、双方VIP生命、本机kills及剩余DESTROY目标详见 hud-m505-integration.md。上述旧静态验收仍只覆盖旧范围，当前数值不宣称原公告producer已恢复，本轮未实测。
