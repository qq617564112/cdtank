# 我的家战车页确认文字与余额

UI-32正式整页现在消费现RoleProfile确认金币+70、OwnedRoles.equipment确认记录数与TankShop QUERY匹配车型的原说明。原txtMoney/txtListQuantity/edtTankDesc位置沿既有HomeSourceLayout完整父链；余额来自角色资料，不从商城价格推造。数量为已确认列表投影，未声明原数量producer完全还原。来源字段与原控件保存在home-tank-confirmed-content-source.json。

说明查询单独读取Battle.tankShop({operation:QUERY})，不阻拥有资料/出击/原导航；只有产品tankId匹配当前拥有记录+24才显示info。未返回车型或查询失败留空，不从现重建标签生成说明。原edtTankDesc采用标記Web-readable的#253740深色文字、普通滚动；原最终色、字体和滚动条绘制未证明。本批将txtOriginality接到普通RoleProfile的growth.originality优先、真实playerSummary.originality兜底，真0显示/缺留空；该显示明确为Web采用的账户成长，不是原Home txtOriginality producer恢复，未用软星币冒充；txtTankStatus仍未知留空。

归属：home-roles.tsx仅Tank readonly catalogue消费及props、home-tank-source-page.tsx三个原文字区域、home.css仅Tank描述、专属browser/source/doc。没有修改Pet、网络、账户事务、参数数值或Babylon生命周期；本批新增的Home显示实例→App→装备页目标接线及查询失败重试归属home-selected-tank-equipment-client-business-design.md，不在本片实测。

## 实际整页与操作

home-tank-confirmed-content-accepted.json索引组合证据。17-10-01-881Z raw中的sizes/descriptionScroll/changedDescription为已完成字段，800/1920/3840三张-home-tank-*.png全部已实际查看：原根/36Tank资源/名单/原模型/出击/描述/金币14000/数量2均在场，深色中文可辨，创意点为空。该raw整体FAIL，不作整体PASS或导航证据。

17-11-42-273Z --navigation-only rawPASS只补实际操作，不重复三res图。新Account显式20000/200资金，普通BUY3/4得到实例1/2，角色资料实际金币14000。正式我的家玩家页→原tank页签→候选游骑兵3，显示真实QUERY说明；普通mouseWheel scrollTop0→15阅读完整说明，候选4飞毛腿更新为其实际返回文字。普通源出击确认实例2→原rdoEquip开装备页→原tank页签回战车页，重新查询说明仍匹配4，正常Close恢复大厅我的家焦点，全程0TankTextures。候选/导航/确认字段由现业务拥有，不重测旧迷彩事务和模型生命周期。两个raw均记录3372/5422/9622/temp清理true。

home-tank-confirmed-content-types.log当前Webtype通过；必要batch发行由主线统一。

```sh
node --import tsx tests/browser-home-tank-confirmed-content.mjs
node --import tsx tests/browser-home-tank-confirmed-content.mjs --navigation-only
```

## 未完成

限定实际已购tank3/4说明与确认金币/数量；全部车型说明、原动态数量producer、原txtOriginality producer、属性/技能/参数、原说明色字形/滚动控件和完整93控件1:1仍未完成。说明查询失败的非阻塞分支已实现，本轮未模拟API失败，不称该分支已实测；本片新增的实例目标链、两页创意点与查询失败重试未做新页面实测，既有三res/导航证据不覆盖该范围。该片不能代我的家整页完全还原，UI-32保持未勾。
