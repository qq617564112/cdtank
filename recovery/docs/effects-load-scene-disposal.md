# 效果加载期间场景销毁

M4-09-LOAD-SCENE-DISPOSE修复Scene销毁后异步资源响应重新创建效果资源的问题。EffectRuntime在load入口、JSON完成、效果纹理完成及模型纹理完成后检查Scene终端状态；销毁后不创建音频上下文、不继续加载纹理、不发布效果库。运行库仅在所有纹理阶段完成后发布。Scene销毁清空运行器纹理引用；异步world播放在load返回后同样检查Scene终端状态。常规stop/start不触发这些终端条件。

`npx tsx tests/effects-load-scene-disposal.cts`将正式load读取的原发布JSON延迟至Scene销毁后返回，确认上下文未创建、纹理引用0、库未发布、解锁回调0。`node tests/effects-load-scene-disposal-browser.mjs <CDP WebSocket URL>`在Chromium重复该加载/销毁顺序，随后创建独立Scene并加载真实资源，经普通通知consumer生成Effect11五个绘制节点与可见像素，GA15媒体实际推进；活跃声音和绘制在Scene销毁后清理，所属上下文关闭。

证据为effects-load-scene-disposal.json及effects-load-scene-disposal-browser.json。既有effects-scene-disposal.cts清理回归保持通过。

## 来源和范围

本项恢复Web异步加载及Scene终端销毁的资源所有权，不新增原游戏行为或替代资源。新Scene绘制/音频通知由专项供给，不代表新的服务端技能触发验收。实际浏览器覆盖JSON等待阶段销毁；不宣称所有GPU下载中断或原精确帧缓冲已验收。

M4-06实体目标正式入口仍需原mode4动作记录、actor目标字段非零赋值、实体中心高度及生命周期来源；既有23个ELK记录仅mode0/3，不据此补造目标provider。
