# 效果场景销毁

M4-09-SCENE-DISPOSE修复正式EffectRuntime场景销毁后的声音与回调残留。Scene销毁触发运行器停止，释放效果树和绘制、清空两类声音、解除角色动作订阅及绘制观察者；EffectSkillSound关闭自己拥有的AudioContext，移除pointerdown/keydown解锁回调并断开主增益。常规stop/start仍保留上下文和音量，支持同一场景离房后重进。

`npx tsx tests/effects-scene-disposal.cts`验证销毁时仍播放的技能声和Type4媒体均暂停、句柄归零、上下文关闭、解锁回调移除。`node tests/effects-scene-disposal-browser.mjs <CDP WebSocket URL>`复用5209的skill-effect渲染入口，在Chromium创建两个独立场景：普通itemUsed/playSkillEffect通知生成Effect11及原GA15单次声音，五个节点提交几何且帧缓冲实际改变，音频时间推进；销毁时两类媒体仍活跃，随后媒体暂停、上下文closed、实例/声音/角色订阅/解锁回调均为0。第二个场景重新创建并完成同样流程。

专项JSON为`effects-scene-disposal.json`及`effects-scene-disposal-browser.json`。现有音量重进、首件死亡复活和skill501测试保持通过；其AudioContext夹具补齐真实close接口。

## 验证范围

浏览器使用正式通知和渲染、原GA15媒体；通知输入由专项供给，不代表本轮新验收服务端业务触发。该交付覆盖终端Scene销毁及独立场景重建，不扩展全部效果精确表现、未引用资源或原声音采样对照。
