# 持续技能双角色隔离

M4-09-RETAINED-ROLE-ISOLATION验收通过，无需修改生产代码。原skill10与skill11首槽均为Effect3、GA16、Tag0、Method3。原通知保留白名单及duration条件决定持续记录，声音selector=-1；停止通知按roleId与skillId移除，角色移除调用clearRole，到期停止对应效果和声音。原通知规则对照沿用skill-effect-message-native.json，原声音loop选择沿用skill-effect-actor-native.json。

Effect3原非保留递归树为2427、2428、2436、2525、2627；持续通知保留handle而不改变子节点的原retain字段。四个绘制节点2428、2436、2525、2627使用已发布纹理，外层GA16音频已发布。

Chromium专项经正式BattleSkillEffects/createSkillEffectNotifications创建两个角色的持续通知：两棵实际树绑定各自tag_efcenter，八个实际绘制节点改变帧缓冲；两路原GA16均循环播放且时间推进。单方stop通知、单方clearRole及detach分别释放该角色记录、实例和声音，保留另一方同一实例/网格，实际音频继续推进。三次30Hz计数边界更新令3秒duration到期，持续声音暂停且记录、实例、voice及效果网格归零。同一Scene的stop/start重进重新生成八绘制与两路循环声，保留原AudioContext；退出再次全部归零，终端Scene销毁关闭上下文。

运行`npx tsx tests/effects-retained-role-isolation.cts`以及`node tests/effects-retained-role-isolation-browser.mjs <CDP WebSocket URL>`，浏览器使用5209的现有skill-effect渲染入口。对应JSON为effects-retained-role-isolation.json及effects-retained-role-isolation-browser.json。

## 验证范围

正式普通通知consumer、生产树/实际Chromium绘制与原媒体已验收，输入通知由专项供给。skill10/11的实际服务端授权与业务触发尚未由本项验收；未把持续时长的模拟计数更新称为真实墙钟三秒。原未知死亡策略、全部原帧缓冲和音频逐样本对照保持外部范围。
