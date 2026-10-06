# 我的家战车整页主要区域与选择

M5-07/UI-32的当前交付为36个原StaticImage主要区域、原名称与出击按钮状态、拥有列表原选中图和源装备导航。home-tank-page-source.json记录40个原控件的来源矩形及属性，来源范围见home-tank-page-source.md。

browser-home-tank-page-2026-10-04T15-41-40-251Z.json的前三项覆盖800×600、1920×1080、3840×2160实际完整页面；同前缀-tank-800/-tank-1920/-tank-3840.png全部已实际查看。完整原根框、模型区域、右属性框、底参数框、左数量/余额条与图字可见，迷彩与操作提示位于原框下方，不覆盖参数。原运行整体FAIL保留，不据其宣称全流程PASS。

browser-home-tank-page-2026-10-04T15-44-07-712Z.json为定向交互PASS，未重复三分辨率截图：普通源出击Hover/Pushed→SelectRole确认→数据库profile+a8为72→Disabled且已有预览保持；源rdoEquip打开当前装备页→根Tank返回同一已保存战车；Pet/Tank切换回当前战车；Player回库存根→Close回大厅Home焦点；重开Tank及源Close释放预览并恢复大厅焦点。对应-use-hover/-use-pushed/-player-return.png为操作证据。

验收账户显式导入既有role-owned-pair-native.json rows[0]的战车72/宠物71，并指定定义2和三槽原迷彩，不冒称玩家正常获得。保存、导航与关闭均为正式React页面普通操作。Webtype通过，home-tank-page-types.log；共享App导航与SourceButton suffix类型由主线接入，运行规则未改。

汇总为home-tank-page-accepted.json，联合两次实际范围；独立server3362/Vite5412/Chromium9612及临时目录清理均true。首次计数断言失败的原记录也保留，不参与通过范围。

```sh
npm --prefix apps/web run typecheck
node --import tsx tests/browser-home-tank-page.mjs
node --import tsx tests/browser-home-tank-page.mjs --interactions-only
```

## 限制

属性数字、等级/耐久、账户余额、改装资格、装填进度和完整93控件未恢复；本页不是完整1:1还原。图字按原资源放大，Windows/GPU/高清字体显示仍未闭合。原出击禁用无DisabledImage遵从已恢复源按钮消费者；未宣称原picAlreadyUsed运行时显隐。迷彩工具和状态提示、拥有列表行高/滚动是保留的Web业务接线。
