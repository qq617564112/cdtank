# Map02 实际渲染时序

M7-02/M8：`map02-render-timing-actual.json` 与同名 log 保存对 `browser-map02-full-session-2026-10-05T17-46-07-498Z.json` 的一次离线汇总，实际出口0。原 raw 状态为 FAIL；本证据仅记录真实 PLAYING 帧时序与尺寸。

实际主审 `map02-mode3-directed-root-review.json` 状态为 `INCOMPLETE_MODE3_HD_DISCONNECT_WITH_VIEWPORT_FIX_ACCEPTED`，runner33689实际出口1。统一工程回链 `map02-viewport-canvas-engineering.json`。两个标名playing的4K whole实际均为自然结果页，不用作PLAYING画面证据。

安装入口为 Login 后、Create/Join 前的 `installMap02RenderTimingObserver`。每次正式 reconcile 记录 scene 对应 room、round与phase；采样使用真实 engine backbuffer 尺寸与 hardwareScaling。实际 renderer 为 ANGLE/Vulkan SwiftShader Subzero。

| 端 | Room/round | 实际尺寸，scaling1 | 帧数 | 帧间隔中位数ms | ScenePreview.advance 中位数ms | Before→AfterRender 中位数ms |
|---|---|---|---:|---:|---:|---:|
| host | R6/1 | 3840×2160 | 14 | 1317.0 | 1.45 | 12.0 |
| guest | R6/1 | 1920×1080 | 2 | 1143.0 | 1.65 | 30.85 |
| guest | R6/1 | 3840×2160 | 8 | 1985.35 | 2.6 | 21.45 |
| host | R6/2 | 1920×1080 | 4 | 746.0 | 1.35 | 29.6 |
| guest | R6/2 | 1920×1080 | 4 | 744.3 | 2.55 | 38.5 |

全部原始样本及各组p95/max、active meshes/indices见JSON。Round2最大帧间隔主/客38809.1/38810.8ms；小样本与尺寸转换期间的间隔按实际记录保留。

## 范围与剩余缺项

environmentAdvance 为整个正式 ScenePreview.advance 的 wall区间。Before→AfterRender 含同步WebGL/backend等待；帧间隔还包含呈现和调度。这些区间不是纯CPU或GPU耗时，不能通过相减归因到某个模块。原 raw 的 gpuTimerAvailable=true 仅是capability字段；没有调用GPU query或收集GPU duration。

当前记录未证明环境更新是慢帧的主要来源，不据此更改Plant、水面shader或原动画方程。高清流畅性、后端耗时原因与原GPU表现仍开放。

当前执行环境没有暴露 `/dev/dri`，`/sys/class/drm` 仅有version，没有card或render节点；`/usr/share/vulkan/icd.d` 也不存在。该环境事实不证明独立设备的GPU能力，但本机数据只支持上述实际SwiftShader范围。硬件高清性能需要可用的真实GPU渲染设备及正式多人入口；继续相同软件4K长验收不能代替该证据。

失败时双端viewport/client/backbuffer均1920×1080，原15px布局尺寸缺口已修。原 raw 有双端webSocketClosed及解析undefined的JSON错误，cleanups为空；断联原因未证，断联资源清理不替代正常Leave。实际尺寸证据不补成正常双Leave、重入或完整Mode3验收；首次17-37-05 resize FAIL也保留。Map02整图父项未完成。
