# 我的家玩家页主要区域

M5-09/UI-36沿myhome.xml625×404原根和myhome_playerpage.xml子页，子页顶边36按完整父链累加。Web以800×600为基准、min(width/800,height/600)统一比例居中；原高清窗口规则尚未证明。

home-player-source-page.tsx用SourceStaticImage消费16原图区域：上部资料底图、下部总结底条、介绍条、左下快捷栏及金币/代币图条。原图片中的称号、家族、创意点、技能点、积分等图字保持原资源。txtPlayerName通过SourceStaticText显示现账户DisplayName只读查询结果，不创建昵称编辑或账户写入。

库存原rdoWeapon/rdoItem交由SourceButton消费原Normal/Hover/Pushed/Disabled与选中图规则；lstPlayerItem选中用原SelectionImage。现记录、数量、选择、拖入、点击配置及Delete/右键取消继续经Battle.inventory/configureKitbag确认，未修改协议或快捷槽资格。关于我/Pet/Tank/Close沿现导航接线。

原资料与总结区优先呈现。常用操作位于原根框下方的可滚动区域，保留对局记录、高级键位和系统设置业务；保存/错误提示同样位于框下，不盖原资料。宠物、战车与装备通过原页签导航，重复的框下角色和部件入口已移除。补充区域为Web业务入口，未声明原客户端依据。

归属：UI线home-inventory.tsx呈现及只读名字查询、home.css库存限定、新home-player-source-page.tsx、browser-home-player-source-page.mjs和本页证据；主线仅SourceButtonProps.suffix追加myhome_playerpage.xml。来源控制属性保存在home-player-source-page-source.json。

## 实际页面与业务证据

browser-home-player-source-page-2026-10-04T16-00-04-672Z.json前三checks覆盖800×600、1920×1080、3840×2160完整页面；同前缀-800.png、-1920.png、-3840.png全部已实际查看。原根框、主要图字和背景、库存图标、只读昵称可见；原资料数值与总结内容仍为空。

browser-home-player-source-page-2026-10-04T16-01-45-884Z.json为定向操作PASS4：普通库存301选择→武器槽1 ASSIGN→服务器hotkeys[0]=301→Delete取消归零；302道具选择→槽4 ASSIGN→hotkeys[3]=302；源Close/Escape恢复大厅我的家焦点、重开保持道具页；Pet/Tank源页签打开对应账户角色页并返回。选中物品使用原SelectionImage资源，保存恢复槽焦点。库存夹具明确导入301/2001/5与302/1/3，不声明普通获取或购买。

16-06-29-738Z.json为框下入口专项PASS5，三张-footer-800/-footer-1920/-footer-3840.png完整图已实际查看，覆盖当前独立滚动容器的三分辨率留边；原rdoItem普通Hover/Pushed/选中、鼠标滚轮滚动、打开快捷聊天设置并输入“中文快捷内容”保存、关闭恢复嵌套入口焦点与最终回大厅焦点通过。fieldset继续负责busy禁用，内部div负责实际滚动。

整页原raw 16-00-04为FAIL，只采用其前三整页checks；16-03-43原raw FAIL仅有页签图态check，不作为完整入口验收。最终范围由home-player-source-page-accepted.json关联，不以单raw状态证明整个原版页面。home-player-source-page-types.log记录最终Webtype通过，各次专属3365/5415/9615及临时目录清理均为true。

```sh
npm --prefix apps/web run typecheck
node --import tsx tests/browser-home-player-source-page.mjs
node --import tsx tests/browser-home-player-source-page.mjs --interactions-only
node --import tsx tests/browser-home-player-source-page.mjs --supplement-only
```

## 限制

确认余额与当前库存记录数见[余额资料](/workspace/cdtank/recovery/docs/home-player-confirmed-content.md)。原修改昵称按钮已接确认昵称业务，见[昵称页](/workspace/cdtank/recovery/docs/home-name-source-page.md)。右侧总结区域已接保存History统计与原奖章图区域，Battle/Award页签互斥，History保持挂载且不重复查询；见[统计证据](/workspace/cdtank/recovery/output/home-battle-summary-page-accepted.json)与[奖章区域](/workspace/cdtank/recovery/docs/home-award-summary.md)。

等级、称号、家族、创意点、技能点、积分、个人介绍、称号名单、奖章权威计数及贵重品业务仍未恢复。具体动态字段来源缺口见[字段记录](/workspace/cdtank/recovery/output/home-remaining-dynamic-field-source-gaps.json)，积分getter链见[定向来源](/workspace/cdtank/recovery/output/home-player-score-update-source.json)。这些字段不填零或模板。原介绍修改、终身统计完整含义、原动态挂载、Windows/GPU及高清1:1精度仍开放；完整66控件和M5-09/UI-36保持未勾。
