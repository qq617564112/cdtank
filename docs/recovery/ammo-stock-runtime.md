# 有限燃烧弹玩家闭环

账户已配置燃烧弹2007后，普通选槽确认实际库存表ID；合法开火按重建规则消耗一份。服务端在装填修改与shot之前提交账户CAS，成功才扣当前World拥有/本局数量；保存失败保留数量、装填和弹种，拒绝本次射击。最后一颗仍发出2007，下一次就绪射击无量时拒绝并切默认2001。下一普通输入可继续默认开火，默认弹种不扣库存。

数量策略与原服务器扣量producer尚未恢复的边界见ammo07-consumption.md。账户持久battleQuantity是原存储字段，不以当前局余量覆盖；重新入房按剩余owned数量与BattleUseMax初始化本局量。再战不补已消费库存，账户隔离沿现有consumeAccountBattleItem身份与CAS事务。

正式快照ammoSlots只发布特殊槽的ItemTableID、本局余量，不发布持久拥有数量或实例ID。原高位unsigned快捷槽与库存实例按unsigned相等解析。BattleMatch语义store独立发布本机余量，位置/弹丸等逐帧状态仍不驱动React应用；对方余量变化不改变本机账户显示，离房清理。该数量显示为Web业务投影，不以其声称原HUD弹量生产完整。

已验证实际unsigned库存槽/开局数量cap与生成TSRPC协议往返（ammo-stock-snapshot.json/log），本机2→1→0、对方隔离与clear的React语义变化（ammo-consumption-react-store.log），消费模块实际World/SQLite及原炮口阻挡（ammo07-consumption-world/muzzle-world证据）。真实联机、网页与服务重启记录单独登记，不以规则或语义测试代替。

实际验收已通过：ammo-consumption-network-2026-10-04T09-31-13-935Z.json覆盖两发2007、空量拒绝、默认不扣与真实同账户双房CAS冲突拒绝、两自然30秒对局及实际服务器重启；browser-ammo-consumption-2026-10-04T09-31-24-077Z.json覆盖正式双网页普通配置/入房/键盘射击、可见本人2→1→0而对方本人仍2、117自然业务事件一致、原绘声和退出清理、实际重启后库存×0/×2及快捷槽。WAITING仍可显示持久raw battleQuantity2，Ready按owned0初始化本局量0。完整范围、原始失败记录和清理见ammo-consumption-network-browser.md。相关两端独立构建与358正式模块边界PASS，复用ammo-stock-shop-build-server/-build-web/-boundaries.log；未复跑未受影响的五模式。
