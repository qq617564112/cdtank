# 商城目录查询失败时保留原根

M5-10/UI-51/UI-53。shop.tsx将ui.json、combat-catalog与原字体加载独立于真实Shop QUERY。静态资源完成即落原shop.xml根/Item主要区域/页签/Close，不由账户查询失败挡住整个原页面。目录未取得时商品和拥有名单空、确认余额未知、购买禁用，不填造库存或可购买对象。

归属shop.tsx仅独立资源加载、ui提交后body/dialog条件聚焦源Close与根Escape先stopPropagation/preventDefault再requestClose。原Shop load/refresh队列、owner session/query/inFlight/receipt、Purchase/Inventory确认、子页交易owner与cleanup保持；没有App、协议、账户事务、网络或模型生命周期改动。原native cancel仍调用requestClose。

专属tests/browser-shop-resource-error.mjs以空普通网页Account正常完成大厅初始化，实际停止独立server后普通商城入口打开。ui/catalog/fonts继续由正常Vite取得，Shop连接请求真实失败。验原根/Close/名单空与BUY禁用、resources commit严格Close焦点、Pet页签原主要区域→Item正常导航、原生Escape漏键空及严格大厅Shop焦点；仅Item错误1920一张实际整页，0BUY/配置/Ready/对局。原基准/三res和已有交易/保存证据复用。本片不证明原拒绝producer或全页1:1，父项未勾。

## 有效源错误根范围

20-03-19-050Z raw整体FAIL保留，已走完Item源根/Close初焦点、名单0与BUY禁用、Pet原区域→Item导航。Item-error-1920图已亲看源框和名单、白字真实连接失败可辨。末Escape虽关闭回Shop焦点，但window漏键Escape，未接受键盘范围。当前生产写窗口暂停，准备仅page/busy提交条件focus修正与独立keyboard-only，不重已有效图/源或交易。focused Webtypes exit0。

## 切页焦点与完整反馈

activePageBusy沿原aria-busy条件计算，仅ui/页面/busy提交后非busy且activeElement body/dialog才sourceClose.focus，不覆盖已有主动焦点。20-07-33-101Z --keyboard-only PASS：真实Pet→Item刷新完成后beforeEscape为btnClose/withinDialog true/busy false，原生Escape keys[]/closed/strictShop true，0截图/交易。首FAIL保留，不放宽漏键断言。

真实noCatalog状态的Web错误区置于空商品说明区域left12/top410/270×84，白字深底换行；有confirmed目录时原购买和商品说明位置不变。20-08-07-769Z --readability-only PASS，仅新Item错误1920图亲看完整原因两行可辨且区域全在viewport，未重复Pet/Item切页键位/源图/BUY。初资源提交和原生Escape清理焦点仍正确。最终focused Webtypes exit0；3388/5438/9638/temp清理，交主线下一batch统一必要发行。完整UI51/53/原错误producer/全状态与1:1父未勾。
