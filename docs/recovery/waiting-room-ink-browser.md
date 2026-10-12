# 等待静态字形实际验收

`node --import tsx tests/browser-waiting-room-ink.mjs`输出`browser-waiting-room-ink-2026-10-03T22-43-21-797Z.json` PASS10。一个普通中文账户正常创建原map7等待房间，依次800×600、1920×1080、3840×2160打开并阅读源区域，最后普通Close/Leave卸载。

每次resize后等待当前viewport、stage宽615×目标scale和全部已知glyph atlas DPI同时一致：800×600目标scale420/391、DPI103，1080p/4K目标scale2、DPI192。每个分辨率对正式已知mono文字逐glyph核对完整textContent、源extent、HorzCentred/RightAligned原对齐、inkX/inkY+baseline目的坐标、Image宽高、atlas和区域overflow裁剪；另确认未知TTF fallback、SIMSUN加载与权威地图说明完整读取。三张实际页面截图及关闭后图保持独立时间前缀，800和4K代表图已观察。Loader在atlas decode后才公布face，已知文字切换时真实图片可用。

源baseline/lineSpacing算术与provider边界见`waiting-room-ink-source.md`。本片限定静态字形位置与语义读取，复用既有Ready/取消控件业务，不将Webstage缩放/atlas切片、其它字符或原Windowsframebuffer声明为整页1:1。server/Vite/Chrome退出、临时目录删除，3283/5313/9513无残留。

最终JSON记录800各文字scale1.0741687至1.0741695/DPI103，1080p与4K各scale2/DPI192。此前运行文件完整保留，三分辨率当前frame采样以本最终文件为准。
