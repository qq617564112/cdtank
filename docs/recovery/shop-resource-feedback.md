# 商城资源加载反馈

UI51 / M5-10。ShopSession的UI、catalog、字体加载与正常Shop QUERY共用status；源加载失败后查询成功可覆盖失败提示，原页面仍未显示。资源不可用分支目前只有返回按钮。

独立ShopResourceFeedback与CSS已接正式ShopSession。精确接入范围为独立resourceError、source loader catch，以及!ui反馈与原Return；隐藏未加载资源时的普通业务呈现。成功页面几何、字体、所有query、PurchaseOwner、pending/inFlight、事务重试与焦点合同保持。root已授权精确shop.tsx hunk，side确认无重叠。

反馈是Web资源恢复投影：“商城暂时无法显示”“请返回大厅后重新打开。”，不向玩家显示URL、HTTP或调试错误。返回后重新打开沿现生命周期加载，不新增恢复API。

browser-shop-resource-feedback.mjs已准备。唯一必要首验使用既有合法账户只读SQLite备份副本，原资金fixture明示，不注入新库存、资金或角色；真实HTTP503与成功Shop QUERY/Inventory响应后错误保持，625×404源stage同比等待与两RAF后拍800/1920/3840三完整反馈图，验证Return严格入口、正常重开同token恢复。0BUY、装配、角色选择或房间事务，复用旧成功页面与业务证据。

04-51-22-596Z rawPASS，三个完整反馈图已亲看，文字与Return可辨。真实503后Shop QUERY/Inventory成功均未覆盖resourceError，Return严格Shop入口、重开sourceRoot/noFeedback/sameToken成立。全部进程/临时目录清理，3489/5519/9719无监听。新shop-resource-feedback-web-types.log exit0；terrain14-ammo2017-shop-resource-production-web-build.log types/build exit0、Vite1m58，最终生产已同步发行。证据见shop-resource-feedback-accepted.json。

未完成范围：原native错误producer与完整商城父项。
