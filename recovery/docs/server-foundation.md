# TSRPC 联机基础

## 已验证范围

`npm run test:network` 自动启动测试服务端（3109端口），建立三个独立Node WebSocket客户端。两个加入同一房间，一个加入另一房间，验证：

- 客户端自报相同clientId时仍分配不同玩家；服务端以连接ID绑定身份。
- 同连接重复加入保留玩家ID。
- RoomSnapshot仅发送给本房间连接。
- 服务端按输入计算移动与开火，另一连接收到位置和弹丸。
- 过期输入序号不能覆盖最新输入。
- PlayerAction不能直接修改分数。
- 断线移除玩家；人数不足时结束原型对局。

这些是新TSRPC协议的集成测试；旧Windows协议兼容仍未实现。

`tests/browser-battle.mjs` 另以两个Chromium窗口验证房间加入、原地图/城堡及原战车模型加载、源坐标映射、远端移动/开火和退出清理，输出JSON与截图。浏览器开启5秒心跳，服务端等待15秒；检查额外等待16秒确认连接保持。完整原版对局验收仍未完成。

## 启动

在工程根目录完成解包、数据表导出和 `npm ci` 后：

```bash
npm run dev:server
npm run test:network
npm run protocol:generate
```

默认WebSocket `ws://localhost:3001`，`PORT`、`TICK_RATE`（默认20）与 `CONTENT_TABLES`（默认 `recovery/output/verified/tables`）可通过环境设置。协议源在 `apps/shared/protocols`，server与shared以CommonJS运行，使用TSRPC发布包的CommonJS入口。

## 原始内容与原型规则

`config.ts` 读取21条tank原表记录和m001–m005共26条地图配置，保留原战车名称、攻防、移动/转向、地图时长和人数上限。m001–m005作为来源编号；与原界面五种模式名的精确对应仍待核对。

当前模拟用于验证联机：装填时间800ms、重生3s、出生数组选择/朝向解释、身体半径20、球体命中范围、移动/转向换算、HP与伤害公式均为原型参数，不代表恢复出的规则。原TankDelay的含义未确认。已加载原地图地形/虚拟盒体，服务端判定移动与弹丸碰撞；出生位置来自原.rpt，并与地形高度核对。原出生分组及导航语义继续还原。当前不实现占点、首领、动态破坏物、宠物、技能、道具或持久账号。详见 [原地图运行说明](battlefield-runtime.md)。各来源编号房间提供基础移动/开火模拟，不能作为五种模式完成证据。

## 下一步

浏览器已接入Join/RoomSnapshot/PlayerInput，双浏览器移动/开火通过。继续实现命中/重生/结算验收，并继续CVD节点动画、动态碰撞、原模式目标和数值校准，再扩展账户内容、结算和持久化。
