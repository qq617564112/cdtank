# 正式认证连接职责

E-03本片将唯一WsClient构造、ws/wss同源game端点及心跳配置、Account token读取/认证/保存、并发就绪等待、退出关闭等待、断线与失败重试，以及账户/房间请求模块的组装归入network/game-connection.ts。Battle只使用该模块提供的同一个client/accounts/rooms，继续管理对局room/session、快照/事件、入场资源门槛、输入和界面/场景的生命周期。没有第二连接、重复账户接口或通用运输框架。

同一个认证promise服务并发账户与房间请求。退出立即使原promise失效，后续连接等待底层close完成；已开始的运输对应哪个promise单独记录，使旧close不能清掉已经排队的新认证。旧等待、旧connect和旧Account返回在每个await后检查身份，取消时拒绝并停止后续API与token写入。旧失败只清自己的就绪状态，不能清新状态。CPU入场资源失败可能在enter和startCpuMatch两层连续leave，因此同一个尚未完成的断线只调用底层disconnect一次，重复调用共用关闭promise。

认证状态失效由network先处理；Battle原有断线回调仍负责清键盘、停止音乐/声音/效果与提示返回。正式模块没有引入取证或渲染诊断依赖。客户端取消错误显示为“连接已取消，请重试”，普通连接/认证失败保留原返回信息。

## 验收入口

`npm run test:network:connection`已进入network验收分组。可控运输返回和内存token验证并发请求仅一次登录、socket/账户失败重试、等待旧close后重连、重复退出仅一次close、在开始connect前和connect期间取消后不发Account/Inventory、旧成功/失败不覆盖新就绪/token、非主动断线后认证恢复。此夹具不是实际socket或原协议证明。

真实网页：`node tests/browser-cpu-entry.mjs <CDP>`验证正常CPU入口、目录失败/重试/资源准备/运动/退出；`node --import tsx tests/browser-home-equipment.mjs <CDP>`验证账户装备操作、拒绝/隔离、1080p/4K与刷新/服务重启保存；`node --import tsx tests/browser-healing-item.mjs <CDP> --autopilot --reentry --owned-textures`验证双网页不同迷彩、本人托管与CPU普通输入自然两局、冻结结算/再战、原Effect11/GA15和声音释放、账户保存及服务重启正常重进。双网页缩小画布，不证明高清全内容性能。

`npm run test:server:compiled`验证编译真实账户/迷彩联机与重启保存、CPU五模式各两局。`npx tsc --noEmit`、`npm run test:architecture`、`npm run build:web`验证最终类型、正式依赖与独立构建。相关结果在engineering-connection-{races,cpu,equipment,two-rounds,compiled,types,boundaries,build}.log。

上述命令全部退出0；依赖门禁覆盖210正式可达模块。双网页两局自然结束分别约52秒与92秒，重启后正常重进通过。最终Web构建已通过；主包体积提示仍在，不宣称加载或高清性能优化完成。E-03仍需收拢对局快照/界面与生产资源模块；完整复刻、原玩法和全内容高清验收继续按各M项推进。
