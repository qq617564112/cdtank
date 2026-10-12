# 编译服务端运行验收

`npm run build:server` 将 server/shared TypeScript 编译为 CommonJS，入口为 `dist/server/server/src/index.js`。编译产物由 Node 直接执行；测试驱动器使用 tsx。

```bash
npm run build:server
npm run test:server:build-runtime
```

`tests/server-build-runtime.cts` 使用仓库外的临时工作目录启动编译入口，并传入绝对路径的 `CONTENT_TABLES` 和 `WEB_ASSETS`。它顺序复用 `tests/account-network.cts`（3129）与 `tests/tank-texture-network.cts`（3018）的完整断言；各测试使用独立临时 SQLite 数据库并真正停止、重启服务端。

账号验收覆盖鉴权、库存与快捷栏、资料和拥有记录隔离、房间配置、装备及普通输入。贴图验收覆盖确认、扣费、源记录保留、WAITING 就绪刷新、PLAYING 拒绝和重启恢复。两个测试的默认执行方式仍启动 TypeScript 源入口；通过 `CDTANK_SERVER_ENTRY` 指定编译入口、`CDTANK_SERVER_CWD` 指定服务端工作目录。

结果写入 `recovery/output/server-build-runtime.json`，详细断言结果仍使用 `account-network.json` 和 `tank-texture-network.json`。

CPU 验收复用 `tests/autopilot-match.cts` 的完整普通输入、50ms 模拟时钟、五模式两轮 fixture。驱动器在临时目录生成副本，仅将 `AccountStore` 和 `World` 两个导入改为编译后的 `.js` 路径；断言、人数、时间和规则保持相同。它验证移动、开火、命中、来源库存消费及重开数据库、冻结结算、rematch 和最后人类离开后的房间清理。编译 World 的结果另存为 `recovery/output/server-build-autopilot-match.json`。

设置 `CDTANK_SERVER_ENTRY` 为仓库外部署目录中的绝对 `.js` 入口，可在同一断言集下验证独立安装生产依赖的服务端。驱动器始终为服务端另建临时工作目录，结果记录实际入口路径。CPU fixture 仍使用本仓库的编译 World 和 AccountStore。
