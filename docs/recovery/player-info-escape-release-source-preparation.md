# 玩家资料 Escape 松键隔离准备

UI41 / M5-13。既有名单有效证据保留，当前待关闭的独立缺口为玩家资料窗口 Escape 松键传播。player-info.tsx 的 keydown 在阻止冒泡后立即 onClose，React 卸载 dialog 并由原 cleanup 恢复名单行焦点；随后 native keyup 以名单行为目标，已卸载 dialog 的 onKeyUp 无法拦截。

提案仅调整 PlayerInfoSession Escape 生命周期：keydown preventDefault 并记下关闭请求；keyup 在窗口内 stopPropagation 后关闭，继续使用原 cleanup 恢复入口。native cancel、鼠标关闭、关系回调、资源加载与字体保持既有合同。未增加名单行 Escape 或全局监听。

专属 browser-player-info-escape-release.mjs 准备两普通账户、原玩家资料入口、原生 Escape down/up；只读确认 keydown 后仍开且焦点在 dialog，keyup 后关闭、严格回原名单行，window down/up=[]。resolutions=[]、screenshots=[]，无好友/黑名单写入、购买、房间或发送。旧三图、长名单与关系业务证据复用。生产归属已明确，原子修正与唯一 keyboard-only 首验已通过；最终交付见 player-info-escape-release.md。
