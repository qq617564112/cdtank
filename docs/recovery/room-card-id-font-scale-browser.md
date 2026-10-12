# 房间编号 baseline 消费与缩放来源验收

browser-room-card-id-font-baseline-2026-10-04T03-00-18-525Z.json PASS4：正式 MediumHT 字体sourceViewport明确800×600，实际调用已恢复mediumHtMetrics，再沿现有Web舞台投影。800×600、1920×1080、3840×2160三张实际Normal PNG均包含可读完整数字1–10。32×17源窗口、native1 extent/7或10宽图片、14高、顶部2、居中/裁剪样式、白色颜色乘数下原黄色图像与图层顺序通过；每张图11glyph，共33观测的原opaque同质内区RGB逐项匹配。4K实际PNG已目视检查。

每个分辨率普通数字点点击选择R6，Hover/Pushed/离开后SelectedNormal均正确；可信Tab+Enter选R7、Tab+Space选R8，第一页边界/第二页R17/返回第一页保留完整业务ID，world保持null。SIMSUN页码、人数原raster glyph及现有房名outline fallback保持。此前IDTEXT四图态12PNG与PAGING正常Join/WAITING/Leave复用，未重跑未变业务。

room-card-id-font-scale-native.json PASS8通知、32extent/draw、8正负居中向量。纯TS consumer与七个AutoScaled原机器码输出逐字形尺寸/advance/baseline/lineSpacing精确相同，包括两个实际Web舞台尺寸向量。该原消费者有正式baseline调用，未将stage倍率当作原显示生产者。

## 边界

M5-02-C-IDTEXT-SCALE原HD display与window布局联接仍未完成。正式页面保留原800×600字体基准与明确Web高清投影；原System实际display生产者、原全窗锚点、编号字符串生产及完整GPU framebuffer仍留父项。

独立raw browser-room-card-id-font-scale-2026-10-04T02-56-49-601Z.json保留4完成几何/交互检查与12张stage-as-display裁剪PNG，以及未通过的opaque像素范围。它记录原double-factor行距在该未证实输入联接下产生的高清细线，未作为正式HD验收。三个此前oracle FAIL与截图均保留。baseline最终运行3313/5335/9535及临时目录全部清理。
