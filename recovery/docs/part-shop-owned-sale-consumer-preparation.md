# 拥有零件整实例出售入口

原 `shop_partpage.xml` 与 `shop_itemdesc.xml` 均无 `btnSell`。具名原普通动作是拥有名单 `lstMyEquip` 的 `EventMouseDoubleClick`：5162cc注册515ec0，`getItemAtPoint`取得行+9c实例后进入515c54；确认文字gamestring711为“你确定出售该零件吗？”。确认绑定5140f9，从controller+38选中行+9c读取instance，经owner+20以kind4调用495e90，分派494927只传instance，不带部分数量。选择变化通过516275注册513ef7，将`getFirstSelectedItem`保存至controller+38。

正式PartShopView以PartSale QUERY提供完整Inventory、quotes、profile与确认money。拥有行双击及Web键盘Enter触发711确认；owner保存UUID去连字符请求与inFlight，失败复用同请求。只接受result1作为出售确认，由完整Inventory替换名单并经onMoney通知父余额，session/generation拒绝晚返回。BUY后重查PartSale报价，Buy目录保持。

报价canSell决定动作资格，不推断equipped状态禁售。root重建清理政策处理已资格118/13c/148和hotkey，未声称原生清引用已证明。两个原XML均无btnSell，因此不增加虚构原按钮。

源证据 `recovery/output/part-shop-owned-sale-entry-source.json`，consumer与driver准备记录 `recovery/output/part-shop-owned-sale-consumer-preparation.json`。浏览器driver `tests/browser-part-sale.mjs` 语法检查通过，端口3615/5645/9845实际已清理。复用已维护14003合法checkpoint，无新资金或记录注入；仅原双击取消→Enter确认SELL→完整名单/余额/Close及三个分辨率拥有行，避免重做BUY维修。父确认余额在普通Item页实际挂载的txtMoney观察。统一工程 `recovery/output/part-sale-engineering.json`。


有限浏览器记录见 `recovery/output/part-sale-browser-accepted.json`。原三完整拥有行图已亲看，原售价1000、名单/余额及普通选中行可读。普通原双击711确认取消保持完整库存且无SELL；Enter重开确认后一次SELL14003实例4/result1成功，完整Inventory删除售出实例，叶余额及普通Item父余额均179000，StrictClose通过。session76254实际退出0，清理四项通过、三端口空；尾段无新截图、BUY、维修或资金注入。引用清理与network/native/restart由root独立审阅，未称完整父任务完成。

最终主审回链 `recovery/output/part-sale-root-review.json`，状态 `PASS_FINITE_PART_WHOLE_SALE_SOURCE_CONFIRM_WALLET_READY_DUAL_STATE_RESTART_CLOSE_SCOPE`。浏览器confirmation/list/wallet/Close与独立network/native/双状态/restart组合范围由主审记录。
