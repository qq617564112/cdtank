# 2007 有限弹药真实业务验收

实际服务器和两个正式 React 网页验收通过：两发燃烧弹逐发扣减2→1→0，第三次空量发射拒绝且切回默认弹，不产生发射或重载；随后正常默认弹发射不扣库存。同房两轮自然结算和再战不补弹，实际服务重启保留拥有者库存0、另一账户库存2及已配置快捷槽。全部库存消费使用正常接口和持久账户，没有注入生命、位置、伤害、事件或胜负。

## 真实网络

`tests/ammo-consumption-network.cts` 使用实际 index3218、临时SQLite、四条正常WebSocket连接。复用 `browser-combat-muzzle-2007.mjs` 的明确拥有角色fixture：`world-role-attributes-native.json tank1/part0`，两账户拥有坦克实例72，燃烧弹实例77的ownedQuantity2、原持久battleQuantity2。两账户正常Kitbag ASSIGN slot1配置战斗Digit2，两人和一个CPU正常mode4/map7房间Ready。

| 验收项 | 实测 |
| --- | --- |
| 两次合法2007发射 | fire2007恰好2次，ammoConsumed剩量依次1、0；每次内存owned/battle均扣1，持久owned扣1 |
| 最后一发 | 数量0后当前确认仍2007，保留合法末发 |
| 空量请求 | itemRejected，确认切2001；没有fire，reload状态不变 |
| 默认弹 | 新正常输入fire2001一次，持久owned仍0 |
| 真实CAS冲突 | 同token另一正常房先加载本局量2；主房两发使持久owned0后，另一房正常发射被CAS拒绝，保持2007/本局量2，无fire/reload |
| 两轮自然战斗 | 首轮tick595、第二轮tick596，合法30秒TIME_LIMIT；50fire、45hit、9destroy、8respawn |
| 再战库存 | round2本局库存0/0，默认确认2001，不补回燃烧弹 |
| 双端/大厅隔离 | 拥有者消费、发射及拒绝事件两端一致；大厅第三账户0房事件/快照 |
| 实际重启 | 停止并重新启动index，原token正常Account/Inventory；拥有者owned0，另一账户owned2，快捷槽首项均77 |
| 重启后开局 | 正常CreateRoom/Ready后，拥有者本局owned0/battle0 |

有效完整原始记录为 `recovery/output/ammo-consumption-network-2026-10-04T09-31-13-935Z.json` 及同名前缀 `.log`。CAS证据来自正常同账户多连接和两个合法房间，不改数据库构造冲突。

## 正式双网页

`tests/browser-ammo-consumption.mjs` 使用实际index3219、正式Vite5379、独立Chromium9579，两个隔离1280×720页面。两页通过大厅“我的家”正常鼠标选燃烧弹×2和快捷槽，再正常建房mode4/map7、房间卡加入、添加一个CPU、Ready。拥有者使用真实Digit2/Space输入完成两次发射、空量拒绝和默认发射；另一玩家只观察，保留自己的库存。

| 验收项 | 实测 |
| --- | --- |
| 可见拥有者数量 | `[data-ammo-slot=2]`本地显示2→1→0 |
| 旁观数量与隔离 | 两页room snapshot观察P1量2→1→0；另一页自己的可见库存始终2 |
| 双页发射绘声 | 两次2007均产生P1的Effect54/root3022图元提交、自然到期；两页GA09/sound50真实音源结束，输出peak大于0 |
| 默认绘声依赖 | 随后默认2001发射，双页root2429图元提交、真实默认音源输出 |
| 双页自然业务事件 | 117个fire/ammoConsumed/itemRejected/hit/destroy/respawn/finish一致 |
| 两轮自然结算 | 首轮tick598、第二轮tick596，均30秒TIME_LIMIT；正常同房Rematch，拥有者0、另一玩家2 |
| 正常退出/资源 | 两页Leave返回大厅；效果实例0、音源0、声音状态stopped |
| 实际重启网页 | 停止并重启index，原页面正常reload使用原token；可见燃烧弹分别×0/×2，槽instance77仍配置 |

有效完整网页记录为 `recovery/output/browser-ammo-consumption-2026-10-04T09-31-24-077Z.json` 及同名前缀`.log`，实际页面截图为同前缀`-consumed-1/2.png`和`-restart-1/2.png`。复用原EffectRuntime/BattleSound只读观察，不改绘声消费者；降低Babylon raster resolution，保留页面、相机和输入。验证消费业务的相关绘声依赖，不重复宣称源炮口1:1验收。

## 已知边界

有限2007消耗、空量切默认、持久CAS与再战不补库存属于明确重建规则，未声明原服务器耗弹资格。持久raw battleQuantity为导入原字段2，消费只写持久owned数量；WAITING可保留raw字段，PLAYING初始化再依据owned生成实际本局量0。这一字段不等于剩余拥有数量，不把重启raw2误写成补弹。

一个被接受的空量输入被清fire；网页后续独立普通输入包可发默认弹。本次使用短Space操作验证拒绝，无“必须松开后才可默认发射”的规则声明。持久false冲突由真实网络覆盖，持久throw由专属规则证据覆盖，不把throw声称为真实数据库故障验收。仅本片2007、mode4/map7、明确拥有tank1与有限2颗fixture；其他弹药、其他地图和完整原量规则不扩张声明。

## 清理

正常Leave、断开连接、关闭index/Vite/Chromium、删除临时SQLite与浏览器目录。交付时3218、3219、5379、9579均无监听进程。每次执行输出独立runId，完整失败记录保留，不覆盖有效或失败原始记录。
