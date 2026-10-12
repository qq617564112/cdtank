# 2007购买实例、持续伤害与持久恢复

2007燃烧弹以原价10金币／20软星币购买，新分配实例通过正常快捷槽配置和托管发射进入真实持续伤害。金币账户初始空库存与实验资金200，BUY一颗后余额190；自然命中43及4005三次70HP令目标600→347。两轮自然结束，再战库存0，实际同SQLite服务器重启后原token保留余额190、零库存及购买实例快捷槽。

## 真实网络

`tests/ammo07-purchase-network.cts`使用实际index3229与临时SQLite。正常Account/Shop BUY创建实例，Kitbag配置槽1（战斗Digit2），两玩家mode4/map7，无CPU。只有主账户Autopilot，2007自然fire后正常关闭托管并发送停火PlayerInput，保留真实命中和周期伤害。

显式拥有角色复用已验`tank-numeric-sol-network.cts`源充分pet1／tank1夹具，完整字段布局来自`world-role-attributes-native.json`。base0x2c=600、equipment攻击100经正常属性重算；profile0x70／0x74只写实验资金。所有账户初始Inventory为空，没有预置2007或修改运行生命、位置、伤害、事件、胜负。

| 验收项 | 实测 |
| --- | --- |
| 原价金币购买 | MONEY200→190，BUY2007×1，分配实例1，owned1、rawbattle0 |
| 余额不足 | 第二账户MONEY5／TOKENS0购买拒绝，余额不变、库存空 |
| 原价软星币购买 | 第三账户TOKENS40→20，MONEY0，独立账户分配实例1、owned1 |
| 真实命中 | tick71，伤43，目标600→557 |
| 4005持续伤害 | tick131／191／250各70，目标557→487→417→347 |
| 自然到期 | 后续无第四次4005，完整hit损失归因253 |
| 双端一致 | 共同fire／hit／ammoConsumed／finish事件相等 |
| 两轮自然结束 | 两次TIME_LIMIT；Rematch目标HP600，主账户槽2 quantity0 |
| 正常退出与实际重启 | Leave后关闭并重启同SQLite index，原token恢复实例1 owned0、hotkeys[0]=1、MONEY190／TOKENS0 |
| 其他账户恢复 | 余额不足账户仍空库存5／0；tokenbuyer仍owned1、0／20 |

周期相对实际hit为约60／120／180tick（3／6／9秒）；tick取接收事件时最近snapshot，允许一tick边界差异。

原始PASS：`recovery/output/ammo07-purchase-network-2026-10-04T10-51-22-853Z.json`及`.log`。

## 正式双网页

`tests/browser-ammo07-purchase.mjs`使用实际index3230、正式Vite5390、独立Chromium9590与两张隔离1280×720页面。主账户空库存／实验资金200金币，目标账户空库存／5金币，双方软星币0。普通点击商店Weapon，在2007与2011两项中选择燃烧弹2007并BUY一颗；该新实例由普通Home配置槽1／战斗Digit2。主账户正常Autopilot自然发射后，在对局控制普通点击关闭托管；输入组件正常发送停火，目标未启用托管。

| 玩家业务 | 实测 |
| --- | --- |
| 原商品购买 | 原图标2007、燃烧弹、10金币／20软星币、成功×1，余额190；分配实例1 |
| 目标余额不足 | 普通购买拒绝，余额5／0，库存空 |
| 实际战斗 | 一次2007 fire、命中43、三次4005各70，目标600→347 |
| 真实生命控件 | 双页目标“坦克手-6c7fa6生命”aria-valuenow347、aria-valuemax600、title347/600；主玩家“坦克手-357690生命”保持600/600 |
| 双端一致 | 共同fire／hit／ammoConsumed／finish共8个事件完全相等 |
| 两轮与到期 | 两次自然TIME_LIMIT；再战双方HP600、购买实例槽2量0；第二轮无旧4005 |
| 正常Leave | 两页效果实例0、声音源0、声音状态stopped |
| 同DB实际重启 | 服务器停止重启，原token不变；Home“燃烧弹 ×0”、slot1实例1，商店金币190／软星币0；目标仍空库存、金币5／软星币0 |

原始PASS：`recovery/output/browser-ammo07-purchase-2026-10-04T10-52-39-814Z.json`及`.log`。

仅两张必要截图：`recovery/output/browser-ammo07-purchase-2026-10-04T10-52-39-814Z-purchased.png`为首次源Weapon购买整页；`recovery/output/browser-ammo07-purchase-2026-10-04T10-52-39-814Z-burn-expired.png`为目标本人实际HP黄条和4hit反馈。

## 范围

2007名称、说明、图标和10／20价格来自原表；可售目录、购买实例分配、账户扣款和有限弹AI策略为重建业务。持续4005计时、禁止叠加／刷新和服务器生命权威为已交付重建策略。共同事务的幂等、冲突与PLAYING购买门禁复用`ammo11-purchase-network-browser.md`有效记录；自然燃烧死亡及复活清理复用`ammo07-burn-network-browser.md`有效定向记录。

原054／GA09及有限消费绘声直接依赖既有证据，本轮没有新增飞行、火焰动画或声音取样。持有、余额是明确实验源夹具；购买库存仅由真实BUY分配。

## 清理

正常Leave并断开网络，关闭index、Vite与Chromium，删除专属临时SQLite与浏览器目录。3229、3230、5390、9590均无监听进程，`/tmp/cdtank-ammo07-purchase-*`无目录残留。网络与双网页各首次完整验收通过，各自独立runId保存。
