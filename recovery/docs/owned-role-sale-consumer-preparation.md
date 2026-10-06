# 拥有战车与宠物出售消费者

TankShopView与PetShopView消费OwnedRoleSale正式QUERY/SELL。拥有页直接使用服务端完整owned、profile、money及quotes；选中角色、缺报价、不可出售或pending时禁用出售按钮。原709/713确认文字由现SourceConfirmView承载。

owner保存待确认请求与inFlight；请求ID为去连字符UUID，失败重试复用同ID。成功只采用确认投影刷新名单、报价和金币，经onMoney通知父页面余额头。页面session与mode generation拒绝晚返回更新。

浏览器driver `tests/browser-owned-role-sale.mjs` 语法检查通过，唯一首验session55293实际退出0。复制合法已购角色checkpoint，原资金fixture余额90500，不新增余额/记录。计划普通BUY Tank3/Pet2→我的家选择新实例→拥有页禁售→改选原持有角色→确认出售新实例，核名单/余额/父头及Close。800/1920/3840只记录新启用控件完整页，不重验旧行图。端口3610/5640/9840，已完成清理且三端口空。


实际有限记录见 `recovery/output/owned-role-sale-browser-accepted.json`。Tank3与Pet2新购实例均为4，普通选择后禁售，改选原角色后确认出售分别收入1250/1750；确认钱包为89250/87500，拥有名单移除售出实例，叶余额与父余额头一致。六张800/1920/3840完整启用控件图已亲看，出售按钮和原报价清楚，未遮盖列表与余额。双Close、Chrome/server/Vite/临时目录清理通过；未新增资金或记录注入。主审与父任务范围由root登记。


最终主审回链 `recovery/output/owned-role-sale-root-review.json`，范围为 `PASS_FINITE_OWNED_TANK_PET_PURCHASE_SELECT_GATE_SALE_CONFIRMED_LIST_WALLET_CLOSE_RESTART_SCOPE`。Numeric网络/native/重启证据由主审独立组合。

拥有Pet右侧六技能等级仍误用目录cap，属于独立投影缺口，SALE有限验收不代表整页恢复完成。最小confirmed owned六base/rank投影方案见 `recovery/output/pet-shop-owned-current-skill-projection-preparation.json` 与 `recovery/prepared/pet-shop-owned-current-skill-projection.patch`，尚未应用；原Shop具体右侧setter资格仍缺，Web接法复用已接受Home/M6-04字段与当前技能目录。
