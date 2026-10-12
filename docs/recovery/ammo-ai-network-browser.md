# 自主托管有限2011弹药业务验收

实际网络与正式双网页自主弹药闭环通过。两个正常账户配置2011两颗并启用托管，AI通过普通选择输入自然使用2011，各两次合法发射扣减1→0，空量请求拒绝后继续2001默认弹；两轮自然结算、同房再战和实际服务器重启都保持有限库存0及快捷槽77。

## 真实网络

`tests/ammo-ai-network.cts` 使用实际index3223和临时SQLite，复用已交付拥有角色fixture：`world-role-attributes-native.json tank1/part0`，两账户坦克实例72、弹药实例77/表2011、owned2/rawbattle2、快捷槽1对应战斗Digit2。正常两人+一个CPU创建mode4/map7房间，双方只调用Autopilot/Ready API，客户端不发送PlayerInput选择/发射/移动；全部选择和发射由实际AI正常输入链产生。

| 验收项 | 实测 |
| --- | --- |
| P1有限弹 | 2011 fire恰好2，ammoConsumed依次1、0；默认2001继续56次 |
| P2有限弹 | 2011 fire恰好2，ammoConsumed依次1、0；默认2001继续44次 |
| 空量/有限资格 | 两次自然itemRejected；没有再消费2011，默认弹持续工作 |
| 自然两轮 | 首轮tick598、次轮tick597；合法30秒TIME_LIMIT |
| 实际战斗 | 两轮142fire、90hit、14destroy、13respawn |
| 再战 | 本局库存0，默认2001，不补回有限弹 |
| 实际重启 | 正常Leave、关闭并重启同一SQLite index；原token登录，双方owned0、快捷槽77 |
| 恢复后开局 | 正常CreateRoom/Ready后本局battle0 |
| 双端/大厅 | 拥有者消费/发射/拒绝事件两端一致；大厅第三账户0房消息 |

完整有效记录 `recovery/output/ammo-ai-network-2026-10-04T10-16-33-842Z.json`及`.log`。首个已保留FAIL只在弹药业务外的移动距离断言处提前停止，不作为完整业务证据。有效记录的observedMotion只记录首默认射击时P1位移0；近距离目标可合法驻车射击，不把死亡换出生点算自主移动验收。

## 正式双网页托管

`tests/browser-ammo-ai.mjs` 使用实际index3224、正式Vite5384和独立Chromium9584，两张隔离1280×720页面通过普通Home鼠标配置问候炮弹×2及槽77，正常建房/加入mode4map7、添加一个CPU，双方点击可见Autopilot托管按钮再Ready。没有PlayerInput客户端包：两次Autopilot API后全部移动、瞄准、选弹和发射由实际AI普通输入完成。

| 验收项 | 实测 |
| --- | --- |
| P1自主发射 | 2011恰好2次，ammoConsumed1、0；2001默认自然继续34次 |
| P2自主发射 | 2011恰好2次，ammoConsumed1、0；2001默认自然继续36次 |
| 可见数量 | 双方自己槽2数量耗至0；两页同room snapshot记录双方有限量 |
| 两轮自然终局 | 首轮tick597、次轮tick596，均合法30秒TIME_LIMIT |
| 双端一致 | 254个自然fire/hit/destroy/respawn/ammoConsumed/itemRejected/finish一致 |
| 正常再战 | 两票Rematch，同房双方本局量0、默认2001，不补弹 |
| 正常退出 | 第二轮结束后两页Leave；效果实例0、声音源0、声音状态stopped |
| 实际重启 | 停止并重启同一SQLite index，原页面reload保留原token；普通Home双方问候炮弹×0、槽77 |

完整记录 `recovery/output/browser-ammo-ai-business-2026-10-04T10-18-14-610Z.json`及`.log`。唯一自然PLAYING整页截图为 `recovery/output/browser-ammo-ai-business-2026-10-04T10-18-14-610Z-natural.png`，实际槽2显示0发；不把截图用作计时精度或原像素标准。原2011绘声消费者证据直接复用，不采集新五节点或音频peak。只读consumer引用用于确认Leave资源清理。


## 已知边界

自主有限弹选择是重建策略：保持正常治疗/饮料优先级，仅在可合法开火且当前默认弹时选择已配置、owned/battle均大于0的2007或2011槽；本片实际2011，不宣称原客户端AI或2007新真实验收。2007资格过滤由独立规则覆盖；2011持久CAS冲突、原绘声消费者分别复用已交付2011证据，本片不重复手动CAS或五节点采样。

持久rawbattle字段保留2，实际PLAYING有限battle量由owned初始化；重启owned0、原字段2不代表补弹。只验mode4/map7、明确拥有tank1与两颗fixture，不扩导航、其他弹种或全部模式。无生命、位置、伤害、时间、事件或结果注入，30秒为合法服务deadline。

## 清理

正常Leave、断开连接、关闭index/Vite/Chromium、删除临时SQLite与浏览器目录。交付时3223、3224、5384、9584均无监听进程。所有输出独立runId，首个完整FAIL保持，不覆盖或伪造单次历史。
