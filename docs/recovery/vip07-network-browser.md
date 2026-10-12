# 地图 7 擒王模式 CPU/autopilot 网络与双网页验收

真实服务器与两个正式网页验收通过。拥有玩家 VIP P1 正常移动超过 20、开火并命中；双方完成两轮自然 VIP 死亡、OBJECTIVE 结算、同房再战重置和正常 Leave。全部参与者使用地图源出生位，没有位置、伤害、状态、事件或结果注入。

## 真实网络

`tests/vip07-network.cts` 启动实际 index 服务器 3214 和临时 SQLite，三个客户端正常 Account 鉴权。两个人类分别使用坦克1、两队，房主正常加入 CPU105 和 CPU1，双方正常 Autopilot/Ready 开局。第三客户端留在大厅。默认地图时间上限300秒，战斗自然终结。

| 验收项 | 实测 |
| --- | --- |
| 房间/阵容 | R6，mode3/map7；两名人类 tank1、CPU105+1；P1/P2 为 VIP |
| 拥有玩家首轮 | 最大位移80.156098；fire1、hit1；最终 HP114、存活 |
| 首轮终局 | tick51，P2 VIP 自然死亡，OBJECTIVE，猫队胜利 |
| 再战 | 正常两票 Rematch，同房 round2；P1/P2 HP200、全员存活 |
| 第二轮终局 | tick51，同样自然 VIP 死亡和 OBJECTIVE |
| 双端/隔离 | 首轮所有房事件一致；两端各104份快照；大厅第三端0房事件/快照 |
| 退出 | 两端正常 Leave 后断开；服务器和临时数据库正常清理 |

完整 snapshots、全部事件、初始/结算/再战状态和源环境实例保存在 `recovery/output/vip07-network.json`；服务器日志为 `.log`。

## 正式双网页

`tests/browser-vip07.mjs` 启动实际 index 3215、正式 Vite 页面5375和独立 Chromium9575。两个隔离浏览器上下文以正常鼠标/键盘经过大厅账户名称、建房模式3/地图7、加入房间、房主两次 CPU 添加、双方 Autopilot、Ready、Rematch、Leave 控件。

网页阵容为两个人类 tank1 和两个正常默认 CPU1；与网络 CPU105+1 阵容分别记录。1920×1080 正式网页四辆坦克实际渲染。测试仅降低 Babylon raster resolution，保留界面矩形、相机和输入；只读实例观察等待资源完成后点击 Ready。

| 验收项 | 实测 |
| --- | --- |
| 拥有玩家首轮 | VIP P1 最大位移80.156098，fire2、hit1 |
| 两轮终局 | 两轮均 tick60，自然 VIP 死亡、OBJECTIVE |
| 再战/退出 | 同房 round2 全员存活；第二轮结束后两页正常 Leave 返回大厅 |
| 双页自然战斗事件 | fire28、hit16、destroy2、finish2；两页48个战斗事件完全一致 |
| 正常操作请求 | CreateRoom1、Join1、CPU2、Autopilot2、Ready2、Rematch2、Leave2 |

完整网络解码记录、业务状态、源 ENV 族和实例保存在 `recovery/output/browser-vip07.json`；服务器日志为 `.log`。截图为同名前缀的 `-waiting.png`、`-playing.png`、`-finished.png`、`-round2.png`。

## 已知边界

本验收仅覆盖 mode3/map7。原首轮诊断保存在独立 `vip07-diagnostic.json`，不以本次双人类阵容代替原 autopilot-match 的 CPU 阵容证据。当前正常场景 ENV 四族为 obj05466/05467/05468/05462，实际实例列在输出；不把本次没有自然命中的 ENV 声称为破坏验收。两个正式网页已经全流程运行，不宣称全部地图或全部坦克覆盖。

## 清理

两轮验收均正常断开客户端、关闭服务器、Chromium及Vite、删除临时 SQLite 和浏览器目录。交付时3214、3215、5375、9575均无监听进程。
