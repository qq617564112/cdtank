# 真购买无敌软星与独立生命消费者

本片普通联机补齐真实BUY8到已购买pet2生命来源的免伤作用：HP700自然受伤至655，使用后6次自然命中被免伤门禁拒绝且HP仍655，到期后自然炮击降至610。双方276共同PLAYING完整players相同，指定11个itemUsed/itemRejected/immuneHit/hit/skillStopped事件相同，双round1 Leave成功。

## 正常取得与输入

服务3346复制已验tank3/pet2真实购买账户的原生SQLite checkpoint：`tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z-checkpoint.sqlite`。资金来源沿该历史夹具披露，身份仅私有本地文件读取；本片没有创建角色、补库存或注入活动状态。当前OwnedRoles真实字段确认pet2+2c生命700及tank3装备来源完整。

正常Shop BUY8×2，以独立requestId购入；Kitbag ASSIGN slot4，再正常建mode4/map7两人房、Join、双Ready。射手用普通Arrow对应aim输入瞄准并持续普通fire。目标在自然受伤后useItem5施放，松开后重复useItem5被拒绝；不追加扣量。库存购入2→消费后1，旧checkpoint的3003余量未使用。没有Autopilot、CPU或活跃HP/姿态/时间注入。

199个共同活动快照中HP655/maxHp700保持，六个immuneHit value0。到期移除skill8后普通炮击再次扣45。当前伤害数值、免伤资格/CAS/10秒期限仍为既有明示重建政策；本片不恢复原完整伤害公式。

## 时间与作用

| 观察 | tick | 固定模拟秒 | 服务端ms | 接收墙钟ms |
| --- | ---: | ---: | ---: | ---: |
| 自然受伤后使用前 | 18 | 0.90 | 1791190358249 | 1791190358267 |
| 首活动快照 | 19 | 0.95 | 1791190358300 | 1791190358307 |
| 末活动快照 | 217 | 10.85 | 1791190368247 | 1791190368251 |
| 首无活动快照 | 218 | 10.90 | 1791190368298 | 1791190368302 |
| 到期后自然扣血 | 276 | 13.80 | 1791190371219 | 1791190371226 |

权威deadline为1791190368268。模拟秒为默认20Hz的tick×0.05，服务端时间与墙钟分别记录；末/首活动观察夹住deadline。普通射手弹匣与装填决定下一次命中，本片不把tick276当到期后的first-eligible开火期限测量。

## 证据与限定范围

- 原raw：`recovery/output/invincibility-purchased-life-network-2026-10-05T08-52-35-951Z.json`，原server完整log同stem。
- runner：`tests/invincibility-purchased-life-network.cts`，仅新I08消费者一房首验。
- 保存raw分析：`tests/invincibility-purchased-life-analysis.py`，全199活动快照/276完整players/11指定事件对照。
- wrapper：`recovery/output/invincibility-purchased-life-player-evidence.json`，PASS有限范围，root主审已接受并原位登记；回链 `recovery/output/invincibility-purchased-life-root-review.json`。

专属3346监听清空、服务与两客户端退出、临时库删除。runner限定NodeNext严格类型检查通过。既有原表/模块、FX100/静默、旧两局与重启证据复用；没有新Chrome、原native、生产或全仓build。未保原生消费后checkpoint，不声明本片SQLite重启证明。

建议M2-01及既有I08原位登记真BUY生命作用支路，不重开已完成旧子项，也不关闭完整数值/原服务器父项。
