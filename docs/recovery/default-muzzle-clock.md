# 默认炮口动作时钟定位

原001的03动作attack1位于1920tick、动作duration2881。生产 `effectModelEngineDelta` 保留小于0.5秒的帧差，达到0.5秒时返回0.1秒；`TankView.animate` 随后取float32并推进原动作时钟。

两个0.3秒帧分别使clock从1到1441，再达到动作完成条件。第二帧按原完成优先规则将time置2781，只派over，不查询该帧跨过的attack1。因此无需重复fire或动作重启，这个序列便没有attack1。该行为符合已有原时钟合同，不是已证代码缺陷。

相反，每帧1秒经源过滤变为0.1秒，连续第四帧到1921时派发attack1，第六帧完成。不能将这个过滤规则应用到0.3秒帧。默认001/03/attack1的ELK记录及effect4覆盖正确解析为原004。

验证：`npx tsx tests/default-muzzle-clock.cts`。专项仅检查上述两个序列与默认资源选择，已有完整native时钟对照直接引用 `effect-actor-update-native.json` 与 `tests/effect-actor-clock.cts`，不重复执行全部样本。结果在 `default-muzzle-clock.json` 与对应日志。没有运行浏览器或修改生产。

本夹具不确证具体远端缺失实例采用了两个0.3秒帧；主线需依实际事件、03clock和受击序列确认。保持原native时钟及正常fire策略，不据该夹具改变动作队列或绕过消息直接创建炮口。
