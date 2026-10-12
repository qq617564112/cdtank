# 正式对局玩家资源与表现

E-03本片将Battle中的玩家实例、待加载集合、上一帧运动/生命记录、战车与迷彩替换、开火/生命/运动动作、位置与方向表现、摄像机跟随和实例释放收进render/battle-players.ts。它消费服务器PlayerSnapshot，不计算伤害、得分、复活资格或胜负。

Battle继续持有唯一联机客户端、账户与房间会话、权威快照、入场资源门槛、局号/阶段切换、技能效果组装、输入、音频和界面。玩家模块只用attach/detach/remove/revive连接实际效果生命周期，不接收整个Battle。HUD世界状态在reconcile之前写入，角色life→revive→位置/方向→aim→motion→本地camera后再步进技能效果的既有顺序保留。

clear先递增加载代号并清空当前名单。晚到成功只允许当前代号、当前名单和相同战车/迷彩选择插入，否则立即dispose；晚到finally不能删除新会话同ID的待加载状态。旧选择的失败也不能阻断新选择准备。资源是否齐备由当前正式名单和已加载实例判断；资源/动作错误由所属模块返回给Battle既有提示。换局重置位置与运动/生命历史，退出继续先解除效果挂点和释放战车，再清效果、弹丸与场景。

## 验收

- `npm run test:render:players`：真实Babylon NullEngine/TransformNode，TankView.load可控延迟；检查退出重进同ID、旧finally、新选择替换、离场、旧错误/动作错误隔离、运动/死亡复活瞬移、换局、清场。它验证资源调度和坐标，不代替原模型或像素。
- `node tests/browser-life.mjs <CDP> <正式页面地址>`：实际原死亡模型可见、复活、动作/战车/地图晚到释放、HUD隔离。
- `node tests/browser-effect-camera-shake-leave.mjs <CDP> <正式页面地址>`：实际房间退出恢复原相机与释放；震动为明确诊断调用，不能作为原技能触发证明。
- `node tests/browser-cpu-entry.mjs <CDP>`：正常正式入口、目录失败重试、地图/四战车准备、CPU运动、返回。
- `node --import tsx tests/browser-healing-item.mjs <CDP> --autopilot --reentry --owned-textures`：双网页原拥有迷彩、本人托管及CPU普通输入自然两局、冻结结算/再战、原Effect11/GA15与声音释放、账户保存/服务重启重进。此命令使用缩小画布，不证明高清全内容性能。
- `npm run test:server:compiled`：编译服务真实账户/迷彩联机重启保存和五模式各两局。
- `npx tsc --noEmit`、`npm run test:architecture`、`npm run build:web`：类型、正式模块依赖、独立Web构建。

以上入口全部退出0：engineering-players-{resources,life,shake,cpu,two-rounds,compiled,types,boundaries,build}.log。双网页两局自然结束分别约62秒和96秒，后续服务重启正常重进通过；依赖门禁覆盖209正式可达模块。正式Web构建1分42秒完成，仍有主包体积提示，不把它当性能验收。夹具对Battle旧loadPlayer、玩家Map与loading集合的观察已改用实际快照接收和玩家模块；震动夹具新增可选origin以使用隔离服务。E-03仍进行中；原动画混合、全部资产/界面/玩法与高清实战仍按各M项恢复。
