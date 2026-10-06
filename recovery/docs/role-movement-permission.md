# 原角色运动许可接入正式对局

原432f91调用真实431d92字节flag getter和43293d状态getter。576原执行组合覆盖记录缺失/存在、status0–3、flag8–10的全部8组合及command0–8，所有返回值与栈通过独立断言；flags使用2/255/128而不是仅1，验证非零字节语义。没有替代原服务。

flag8非零或状态非2拒绝；command1/2需要flag9；command3/4需要flag10；其余command（本对照0、5–8）同时需要flag9/10。缺记录getter为零，状态为零，因此拒绝。

正式`apps/server/src/battle/roles/movement-permission.ts`持有该规则及已验输入命令映射，`battle/actors.ts`在更新位置/车体yaw前使用许可。输入仍接受正常序号，拒绝时保留独立aim及fire处理；权限恢复后同一普通输入路径恢复运动。直行/组合运动的几何、速度与地图碰撞仍使用明确原型，未用本片宣称原运动完整接线。426a54控制器virtual+40许可、422bc6渲染副作用及原碰撞包装是独立剩余验收。

## 验收

- `npm run test:combat:movement-permission`：576原许可/64原输入映射对照；真实World验证flag8同时冻结位移和车体转向但允许瞄准/射击，单独直行或转向许可缺失、组合要求两许可及恢复后的普通输入。
- `npm run test:runtime:cpu-two-rounds`：五模式CPU/本人托管各连续两局自然终局、结算冻结、再战、清房。
- `npm run test:network`：真实连接移动、开火、旧序号、身份/房间隔离及再战。
- `npm run test:runtime:account-textures`：账户原子费用/回滚/隔离、正常WAITING/PLAYING边界与重启保存。
- `npx tsc --noEmit`、`npm run test:architecture`、`npm run build:server`：类型、218正式可达模块不导入取证/渲染验证及独立服务端构建通过。

证据：movement-permission-native.json/log、movement-permission-runtime.log、movement-permission-cpu-two-rounds.log、movement-permission-network.log、movement-permission-accounts.log。本片不改资源或渲染模块，没有将历史资源验收充当新的原碰撞/姿态验收。
