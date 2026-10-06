# 角色队列效果重进

M4-09-ROLE-QUEUE-REENTRY通过，现有生产队列接线正确，无需修改生产代码。原skill13501/13502首槽分别选择Effect31/32，Sound1均为0，Tag0、Method3；两棵树没有声音节点，实际媒体voice为0。原资源完整发布，保留静默合同。

已有skill-effect-queue-native.json证明复活启动首条、多条队列注册5秒单次任务、恰好到0不回调、下一正delta轮换、尾部回首及角色/全量清理取消定时器；本项复用该来源和tests/skill-effect-queues.cts。

Chromium经正式BattleSkillEffects/createSkillEffectNotifications：两条普通通知只入队，复活入口启动Effect31的2601/2882两绘制节点，实际像素改变；5秒推进到0时保持同一实例，下一0.01秒停止它并启动Effect32的2828节点，实际像素改变；再推进轮回Effect31，使用新句柄并释放上一实例。所有树绑定实时tag_efcenter。clearRole和detach后再推进30秒无新实例，queue/timer/效果网格归零。同Scene stop/start重进入队并复活，重新验证Effect31/32实际像素；clear/stop后推进无新实例，终端Scene销毁关闭所属音频上下文。全程原静默、无替代声音。

运行`npx tsx tests/effects-role-queue-reentry.cts`、`npx tsx tests/skill-effect-queues.cts`和`node tests/effects-role-queue-reentry-browser.mjs <CDP WebSocket URL>`。浏览器使用5209现有skill-effect渲染入口，证据为effects-role-queue-reentry.json及effects-role-queue-reentry-browser.json。

## 验证范围

通知和复活调用由专项供给，证明正式consumer、实际绘制和队列生命周期；原13501/13502的服务端触发资格及实际复活因果不由本专项验收。秒数通过生产计时入口推进，不冒称墙钟等待。原完整像素精确对照及全部队列技能仍属于父项。
