# Skill12模型效果

M4-09-SKILL12-MODEL完整内容专项通过，无需修改生产代码。原skill12首槽选择Effect19、GA35、Tag0、Method3。原根2469包含2469、2470、2827、2484、2486、2487、2488、2489、2490、2491、2492；两个type5节点2470与2827使用发布00012.cvd及原00012A.png，实际模型材质保留原纹理。

Chromium正式BattleSkillEffects/createSkillEffectNotifications创建双角色一次性通知，各有两个实际模型section并绑定该角色实时tag_efcenter。模型材质/纹理核对和帧缓冲开关对照通过，移动第一方parent矩阵20单位后模型顶点随之移动20单位。显式stopEffect或clearRole/detach只释放第一方模型，另一方保持同一实例、mesh和可见像素。两路原GA35单次媒体实际推进；一次性通知不保留声音handle，模型停止或移除后声音独立自然结束，不改成持续声策略。另一方效果自然到期后模型释放，音频ended后voice归零。

同Scene stop/start重进恢复实际模型绘制和GA35，保留音频上下文；退出停止媒体、实例/voice归零，Scene销毁后上下文closed。现有原46组Attach材质选择/138提交及132次生产section缓存对照保持通过。

运行`npx tsx tests/effects-skill12-model.cts`和`node tests/effects-skill12-model-browser.mjs <CDP WebSocket URL>`，浏览器使用5209的skill-effect渲染入口。输出为effects-skill12-model.json及effects-skill12-model-browser.json。

## 验证范围

普通通知由专项供给，验证原表/资源到正式consumer、真实模型像素和原媒体，不代表skill12服务端授权及业务资格已恢复。原显式缓存clear后同实例reAttach缺少实际调用来源，本项未新增闲置重置API或把销毁新建视为同一合同。缺失m120/lazhu等资源没有本轮新增来源，保持父项未完成。
