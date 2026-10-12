# 正式房间消息与快照

`match/room-feed.ts`持有当前房间、唯一已接收快照和到达时间，注册同一个认证运输上的RoomSnapshot/RoomEvent。换房时清掉旧状态，退出清掉房间、快照与时间；错误房间和已退出房间的消息不进入表现层。Battle消费该状态，继续管理入场会话取消、资源准备、输入及具体效果/界面组装。

接收分为三个实际阶段：beforeSnapshot接收下一快照与上一已提交快照，完成跨局清键盘、技能/通用效果和角色位置重置；随后提交快照与performance到达时间；snapshot触发界面/玩家/弹丸协调。首次转为FINISHED只清一次技能。事件携带同一已提交快照，Battle保持HUD→技能→聊天（仅聊天事件）→声音（已有快照和本机身份时）→开火（仅开火事件）的原有处理顺序。没有额外消息总线、重复快照或第二连接。

## 验收

`npm run test:match:feed`使用捕获的实际注册监听器验证无房间/错误房间/退出后过滤、快照对象身份、清理读旧状态/协调读新状态与时间提交顺序、WAITING→PLAYING→FINISHED→重复FINISHED→再战、首次快照前事件、切房/退出重进清理；已进入network验收分组。

`tests/browser-life.mjs`经实际TSRPC消息分派进入RoomFeed和Battle，验证通用效果清理与角色重置在提交前，reconcile在提交后、键盘清空、首次FINISHED清技能一次、错误房间事件隔离及HUD/技能/声音/开火顺序；继续加载实际原死亡模型并验证复活瞬移、晚到战车/动作/地图释放与HUD隔离。`tests/browser-effect-camera-shake-leave.mjs`通过实际房间退出验证相机恢复和资源释放。

正常CPU首页重试/资源准备/运动返回用`tests/browser-cpu-entry.mjs`；双网页不同拥有迷彩、本人托管与CPU普通输入自然两局、结算冻结/再战、Effect11/GA15与声音释放、账户持久化/服务重启正常重进用`tests/browser-healing-item.mjs --autopilot --reentry --owned-textures`。编译账户联机重启保存与CPU五模式各两局用`test:server:compiled`。最终类型、运行依赖和正式Web独立构建分别用`npx tsc --noEmit`、`test:architecture`、`build:web`。

本片日志：engineering-room-feed-{state,life,shake,cpu,two-rounds,compiled,types,boundaries,build}.log；以上命令全部退出0，依赖门禁覆盖211正式可达模块，正式Web构建1分58秒完成。双网页自然两局与服务重启正常重进通过。构建仍有主包体积提示，加载与高清性能继续由相应验收证明。

## 范围

死亡复活/相机夹具使用明确诊断消息与效果调用，不代替服务器自然对局；双网页画布缩小，不证明高清全内容性能。原动画、完整资产/界面/玩法按M项继续恢复。E-03仍待收拢正式界面和生产资源模块。
