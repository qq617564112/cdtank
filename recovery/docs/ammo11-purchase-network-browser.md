# 付费2011弹药购买、托管消耗与恢复验收

2011问候炮弹的真实购买到消耗闭环通过。初始空库存账户以实验资金200金币购买两颗，每颗50金币，余额变为100；BUY分配的新实例通过普通Home配置到快捷槽1／战斗Digit2，托管AI合法发射两次并扣减2→1→0后继续默认弹。两轮自然结束，再战不补弹；正常Leave、实际停止并重启同一SQLite服务器后，原账户仍保留余额100、库存0及购买实例快捷槽。

## 真实网络

`tests/ammo11-purchase-network.cts` 使用实际index3225、临时SQLite与正常Account/Shop/Kitbag/CreateRoom/Join/Cpu/Autopilot/Ready/Rematch/Leave。拥有角色来源为已交付`world-role-attributes-native.json tank1/part0`，选择坦克实例72；两账户初始Inventory为空，只在原profile布局0x70、0x74显式写入实验资金，弹药实例由真实BUY分配。

| 验收项 | 实测 |
| --- | --- |
| 金币购买 | MONEY200→100，购买2011×2，新实例1，初始rawbattle0 |
| 请求幂等 | 同requestId重放不重复扣款；相同requestId改变数量拒绝 |
| 余额不足 | 第二账户MONEY20购买两颗拒绝，库存仍为空 |
| 软星币购买 | 第二账户独立TOKENS200→100，MONEY仍20，新实例1属于该账户 |
| 托管有限弹 | 两账户2011各发射2次，消费事件依次1、0，默认2001继续 |
| 双端与大厅 | 拥有者消费、发射、拒绝事件两端相等；第三大厅账户无该房事件 |
| 两轮与恢复 | mode4/map7、一个CPU、两次自然30秒TIME_LIMIT；Rematch库存0；同DB重启原token库存0、槽1实例1 |
| 重启余额 | 金币账户100／200软星币；软星币账户20金币／100软星币 |
| 恢复再开局 | 正常CreateRoom/Ready后battle0 |

完整闭环原始记录：`recovery/output/ammo11-purchase-network-2026-10-04T10-29-03-033Z.json`及`.log`。

PLAYING期间以合法新requestId购买被`SHOP_REJECTED`拒绝，消息为“请在准备阶段购买道具”。定向正常Ready房间中请求前后完整Inventory相等，余额100／200不变。独立记录：`recovery/output/ammo11-purchase-network-playing-buy-2026-10-04T10-32-14-127Z.json`及`.log`。

## 正式双网页

`tests/browser-ammo11-purchase.mjs` 使用实际index3226、正式Vite5386、独立Chromium9586与两张隔离1280×720页面。主账户实验资金200金币／200软星币，另一账户20金币／0软星币，双方初始空库存。全部购买、分组、快捷槽、建房、加入、托管、Ready、Rematch、Leave与恢复查看通过普通鼠标和表单键盘完成。

| 验收项 | 实测 |
| --- | --- |
| Weapon页购买 | 普通点击Weapon，只售2011，名称、原图标、50金币／50软星币与成功×2可见 |
| Item与Close | 切回原7商品1、2、4、5、6、7、8；关闭焦点回大厅商店按钮 |
| 真实实例 | BUY返回实例1，Home显示问候炮弹×2，配置槽1／战斗Digit2 |
| 余额不足账户 | 普通购买拒绝，库存空，余额20／0不变 |
| AI消耗与默认 | 主账户2011恰好2次，ammoConsumed1、0，2001继续45次；无客户端PlayerInput包 |
| 双端一致 | 主账户fire、ammoConsumed、itemRejected事件两页完整相等 |
| 两轮自然终局 | 两次TIME_LIMIT；Rematch主账户槽2为0，第二账户无弹药槽 |
| 正常退出 | 两页Leave后效果实例0、声音源0、声音状态stopped |
| 实际恢复 | 同DB实际服务器重启，原token保留；Home问候炮弹×0、实例1槽1；金币100／软星币200；第二账户仍空库存20／0 |

原始记录：`recovery/output/browser-ammo11-purchase-2026-10-04T10-30-45-580Z.json`及`.log`。Weapon购买整页截图：`recovery/output/browser-ammo11-purchase-2026-10-04T10-30-45-580Z-purchased.png`。

## 范围

商品名称、图标、说明与价格来自原表；商店可售范围、购买实例分配、账户扣款权威和AI有限弹选择是重建业务。2011发射的原绘声消费者直接复用已交付证据`ammo-ai-network-browser.md`所列2011记录；本轮记录消费者引用用于Leave资源清理。2007未上架，其9秒燃烧完整行为尚未恢复。

验收只涵盖mode4/map7、明确拥有角色、两颗2011、实验资金和30秒合法服务deadline。正式用户购买库存由BUY创建，无预置2011、生命、位置、伤害、事件或结果注入。

## 清理

正常Leave，断开网络连接，关闭index、Vite、Chromium，删除临时SQLite和浏览器目录。3225、3226、5386、9586均无监听进程。各运行独立runId，原始FAIL记录保留。
