# M1 account → slot 4 → Digit5 → restart audit

结论：**PASS**。

现有证据 `recovery/output/m1-first-item-browser.json`（由 `tests/browser-healing-item.mjs --reentry --hd` 产生）覆盖闭环：

- 明确账户库存实例 `77` 导入并在 MyHome 配置快捷槽 4（脚本断言 `data-kitbag-slot="4"` 为 `77`）。
- 正常网页 `Digit5` 输入触发道具事件；服务端库存从 3→2、再从 2→1，事件为 `itemUsed`，不是仅 UI 更新。
- 服务端进程停止并以同一数据库重启；`restartInventory` 显示 `宠物饲料 ×1`，槽 4 仍为实例 `77`。
- 重启后正常新房重新进入，`reentryInventory` 保持拥有/本局数量 1 与槽 4 实例 `77`；再次普通 `Digit5` 后 `reentryAfterUse` 为拥有/本局数量 0，槽 4 仍保留实例。

辅助证据 `recovery/output/browser-attack-drink.json` 也独立验证了槽 4、普通 Digit5 的权威消费（3→2）和服务端重启后的账户保存。该项不需要新增修复或重复完整浏览器回归。

已知边界：库存来自明确测试夹具；本审查证明重启与再进入的账户/快捷槽/数量闭环，不声称原始发放、认证或全部道具规则。
