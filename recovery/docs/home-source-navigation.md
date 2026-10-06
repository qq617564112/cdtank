# Home 原导航整页收口

## 范围与归属

M5-07/UI31/UI32/UI34/UI36，限定移除与原 Home 页签重复的两个 Web 入口。原 `myhome.xml` 的 `rdoPetPage`、`rdoTankPage` 已进入拥有宠物/战车页面；`myhome_panzerpage.xml` 的 `rdoEquip` 已进入真实装备页。两者分别覆盖 App 框下“战车与宠物”和“战车部件”按钮的业务。

UI 线拥有专属导航 browser 与本说明；`apps/web/src/app.tsx` 中 `HomeInventoryView.navigation` 的两个按钮删除 hunk 由主线协调。其余对局记录、键位、系统设置、全屏入口继续保留。HomeEquipment 卸载焦点保护与主线显式大厅焦点保持现合同。

## 验收条件

从正常大厅进入 Home，以真实鼠标经过原宠物页签、战车页签、装备页签、关于我返回玩家页。确认页面所属与可操作状态，两个重复 Web 按钮不在正式 Home DOM 中，最后源 Close 返回可操作的大厅 Home 入口并严格检查 activeElement。只查询真实拥有/库存/装备，不购买、装卸或启动对局；原三分辨率主要根与各页已接受业务证据复用，本次只验被修改的导航。

此范围不关闭完整 Home 或任何原父项。保留常用操作区的其他业务，原页面全控件、附着关系、字体与完整 1:1 精度仍开放。

## 其他候选的来源缺口

### 装备资料拒绝时的正式根与导航

正常尚未建立角色资料的账户调用 Equipment QUERY 会被现权威合同拒绝；没有出击战车也会拒绝。当前 HomeEquipment 把源 UI/catalog 载入与这条业务查询放在同一 Promise.all，业务拒绝使源资源状态也未提交，正式根没有呈现。保留的历史证据数据库中 role_records/role_profiles 都为零，不能当作已拥有装备基线。

HomeEquipment 独立提交源资源，保留真实业务错误与未确认空白，源 Close/关于我/拥有战车导航继续可操作。仅拥有装备查询成功后呈现槽值与模型；保存事务、请求 owner、卸载焦点保护保持现实现。主线已确认本资源/业务失败/页签 hunk 与 App 两按钮删除归属。首次验收只需正常无角色账户的正式错误整页与普通源导航、1920 当前页面及严格大厅焦点，不购入战车、不装卸、不启动对局。

UI35 `myhome_petpage_skill.xml` 有原学习弹窗、当前/下一等级介绍和费用控件，但现有 RoleProfile、OwnedRoles、SelectRole 与 PetShop 合同没有真实学习/配置操作；原学习按钮所需的权威请求、资格、费用扣除与保存 producer 未取得，该业务保持未完成。

UI58 `shop_tankpage_part.xml` 有装饰/标记与五部件槽背景和动态图控件。当前 Equipment QUERY 返回出击战车的装备，RoleProfile 也不接受商城商品或拥有实例参数。不能将出击装备标为任意商城商品或候选战车的装备；原父附着及槽数据 producer 保持未完成。

## 实际交付

`browser-home-source-navigation-2026-10-04T19-00-38-417Z.json` 首次 PASS：新普通空账户经原宠物→战车→装备→关于我，Equipment QUERY 真实 `EQUIPMENT_REJECTED` / “账户角色资料尚未建立”；原资源根仍完整呈现，原页签可操作。重复两按钮 DOM 缺席，其余四个入口保留。最后原 Close 回大厅实际 activeElement 为 Home 按钮，enabled 且完整位于 viewport；没有 BUY、SelectRole 或装备写操作。

同批 `-1920.png` 实图已查看：正式主要框、源背景与未确认空白保持，框下真实中文错误清楚可辨，未补槽值/模型。当前源底图的装饰和扳手只是背景，不表示确认拥有装备。原800/1920/3840主要根和已有装配范围复用既有证据，不为两按钮或错误状态重验交易/三res。

`home-source-navigation-accepted.json` 保存限定范围，待主线审查与原位登记；专属3381/5431/9631已关闭，临时数据库/profile随 runner 清理。父项仍不勾，统一工程检查交主线。

## 原生 Escape 隔离

### Home 玩家/宠物/战车根范围

下一范围是同一正式 Home 整页的 HomeInventory 玩家根与 HomeRoles 宠物/战车根：仅初次源资源提交焦点和 Escape 隔离，复用现关闭/账户/候选/模型业务。两页专属 useLayoutEffect 可分别用现 dialog ref 在 activeElement 为 body/dialog 时聚焦源 Close，避免扩展共享 HomeSourceRoot；角色初始候选焦点若已有效则保持。昵称弹窗的中文 composition/取消处理仍由其自身管理。

`--home-roots-keyboard-only` 首次必要实际范围为普通空账户三根的 beforeEscape 原生焦点位置、真实 Escape 关闭、window 漏键空与大厅 Home 严格焦点；0购买/选用/装配/对局/截图，不重已接受鼠标导航或 Equipment Escape。主线已授权两页条件焦点/Escape hunk。首19-12-55-300Z整体FAIL保留，player原生焦点在dialog内且漏键空有效；pet/tank漏键失败。只修HomeRoles，不修改已经正确的HomeInventory。最终 browser-home-source-navigation-2026-10-04T19-13-32-803Z --role-roots-only raw PASS仅补pet/tank：各beforeEscape在dialog内，原生关闭/strictHome有效、window漏键空。两段组合接受范围待主审，不称首3root单次PASS。focused home-role-roots-escape-web-types.log exit0，无新图或事务。

当前装备页在源资源提交后，仅 activeElement 为 body 或 dialog 时聚焦原 `[data-equipment-close]`；已有玩家焦点不变。Escape 先 stopPropagation/preventDefault，再调用现 requestClose，保留 native cancel fallback、请求 owner、保存事务与卸载焦点保护。

独立 `--keyboard-only` 最终 browser-home-source-navigation-2026-10-04T19-09-14-251Z raw PASS：beforeEscape 为原 btnClose BUTTON 且 withinDialog=true，真实浏览器 Escape 关闭后 source Home 焦点有效，window escapedKeys=[]。未人为点击其他控件建立焦点，没有新截图/购买/配置/对局；focused `home-equipment-escape-web-types.log` exit0。该补充键盘范围交主线审查。

首 `19-04-50-573Z` 与 keydown 修正后 `19-07-00-422Z` raw FAIL 均保留，不能用于键盘隔离通过结论；其关闭/返回焦点有效。最终原生事件证据按本段单独引用，与首鼠标路径组合，不改旧状态。完整原页面与键盘/字体/1:1 父项仍保持未完成。
