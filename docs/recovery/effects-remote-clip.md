# 远端一次性效果裁剪

M4-09-REMOTE-CLIP修复相机转向后、下一帧渲染前收到通知时使用旧视锥的问题。EffectRuntime裁剪前读取当前view与projection，再构造六平面；无额外scene.render。世界效果与远端attached一次性效果共用该裁剪入口，本机角色和持续效果的例外保持。

原actor入口467a08调用gbengine ClipPoint（10027bd0），六平面外侧或边界返回裁剪；远端一次性效果返回0，本机及持续参数跳过相应裁剪。来源为已有skill-effect-actor-native.json及skill-effect-message.md。普通通知先调用attached，再独立调用声音；效果返回0不会取消声音，已有原通知callback顺序对照保持通过。

`npx tsx tests/effects-remote-clip.cts`核对原例外规则并覆盖相机转向/转回后、未渲染时的远端裁剪，以及本机和持续例外。`node tests/effects-remote-clip-browser.mjs <CDP WebSocket URL>`使用5209专项渲染入口和正式普通通知consumer：

- 远端转出当前视锥后通知不创建树，但原GA15单次媒体实际推进并自然结束，voice归零。
- 相机转回后通知创建Effect11并绑定实时tag_efcenter，五绘制节点提交几何；实际帧缓冲改变2461像素，树自然到期、声音自然结束后归零。
- 本机视锥外仍创建；runtime.stop停止媒体并清空实例/声音，Scene销毁关闭所属音频上下文及清理角色订阅。

证据为effects-remote-clip.json与effects-remote-clip-browser.json。

## 验证范围

原证据确定裁剪规则和通知声音分派顺序，当前相机矩阵刷新属于Web生产接线。浏览器验证正式通知consumer、实际几何/像素及原媒体生命周期，通知输入由专项供给，不代表本轮新的服务端业务触发验收。原角色死亡策略及所有内容的精确帧缓冲不在此单项范围。
