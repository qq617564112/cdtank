# 库存弹药统一有限消费

正式选弹确认支持原439762分类3的库存实例。所有确认到非默认槽的弹药使用同一消费链：实例、表ID、拥有数量和本局数量核验通过，持久CAS提交后才扣计数并产生射击。保存失败或数量失配拒绝当前held输入，不改库存、装填或射击。最后一发消耗至0时保留当前选择；随后空仓开火拒绝并切回普通2001、停止held输入，新的普通输入才可射默认弹。默认槽1的普通2001无库存消费。

2002好炮弹和2003真！好炮弹现进入Shop的重建可购目录，价格分别沿原ItemMoney/ItemCoin 5/10和20/20，BattleUseMax30/15沿既有初始化。原GGet及购买授权语义未恢复，开放资格与每发持久消费属于既有服务端重建政策。

ammo-stock-purchase-network-2026-10-04T19-13-58-728Z.json通过普通3Account联机流程：最初无拥有和库存，两个账户仅显式资金资料；真正BUY tank3/pet2/SelectRole，2002用MONEY购2发、2003用TOKENS购2发，经Kitbag/选弹/heldfire各2→1→0，双端消费和射击事件一致。第三个无资金账户购买拒绝且库存仍空。空量held拒绝、显式新默认输入、自然TIME_LIMIT/Rematch不补库存、正常Leave与真实服务重启后余额/实例/槽/零库存恢复均通过。

ammo-stock-consumption.cts覆盖全部21个分类3定义的持久前置、失败不扣、耗尽拒绝和默认不写。旧2007/2011 World失败保存/有限射击基线通过；循环等待沿当前原装填duration，不再用固定1.5秒覆盖全部弹种。Shop原部件目录与旧品资格基线通过。

## 范围

原2002/2003受害者绘声的有限实际证据分别见combat-shot-player-result-2002-actual.json和2003-actual.json，使用公开预房库存夹具，不把它们写成上述购入库存的同场React验证。新购入2002双React正式Shop购买2发、Home配置、手动Digit2/Space耗尽至HUD0、正常源退出、Home×0及真正服务重启后的实例/槽/余额90/0恢复通过，组合索引ammo-stock-browser-accepted.json。角色取得使用网络证据；网页预房拥有tank1/pet1及资金100/0明确为夹具，库存初始为空。网页耗尽后释放Space，空量拒绝/fresh默认输入与再战不补库存沿网络验收。短条带绘制、原damage/flight、原计数producer/全部弹种业务与父项仍开放。

工程验证：ammo-stock-server-build.log独立服务端构建通过；ammo-stock-home-keyboard-web-build.log统一Web类型与构建通过，包含最终Home键盘及2004guard；ammo-stock-react-pet-details-web-build.log最终统一Web构建通过，包含宠物资料布局与2006guard。
