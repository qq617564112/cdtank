# 建房源视觉浏览器验收（UI-07-R）

正式页面资源与交互切片通过。`tests/browser-room-create-visual.mjs`沿正常大厅入口使用独立3270服务、5300 Vite和9500 Chromium；未注入游戏状态。证据为`recovery/output/browser-room-create-visual.json`及同前缀800×600、1080p、4K、权威拒绝和WAITING截图。

`--states-only`专项在三种分辨率等待React提交实际stage比例，再核对33个实际绘制源控件的XML父坐标、矩形、实际缩放宽高与可见边界，确认所有button中心真实hit目标；启用frame逐项对应源图，明确禁用frame不绘制。源字体实际加载，附加HTML边框移除。房名、密码掩码、人数边界、友伤选择、Tab/Enter取消、Escape关闭及原关闭按钮保持普通操作。

真实CreateRoom使用含Tab密码取得ROOM_CONFLICT，窗口保留草稿并恢复密码焦点；改为合法密码后进入权威WAITING。第二普通浏览器错误密码取得ROOM_JOIN_REJECTED，正确密码加入相同房间，人数和友伤与权威状态一致。两页普通Leave退出。

`--states-only`专项采集800×600原生截图，五枚状态为normal/hover/down/disabled/selected；断言正式控件实际asset与源状态引用一致。`tests/room-create-visual-pixels.py`将这些真实控件截图与对应原PNG比较。它只检查alpha=255的源图像素，透明边缘、混合后的底图、文字、frame和全页面原GPU输出不属于像素比较范围。证据为`browser-room-create-visual-states.json`与`room-create-visual-pixels.json`。五组不透明像素分别为2086、2086、2113、296和3470；normal/hover/down/selected的最大通道误差为0，disabled为5/255。disabled源PNG26×28投影到XML26×27，浏览器与Pillow采样有小幅差异；像素验收上界为8/255。全部专属进程和临时目录已清理。

完整1:1仍未完成：没有原运行截图，frame尺寸生成、字体继承/光栅、输入颜色alpha、完整原父alpha混合与原错误视觉未闭合。三分辨率几何以`browser-room-create-visual-states.json`为准。详细范围见`room-create-visual-source.md`。本页可交付源资源/几何/正式业务与所列状态图切片，不能将这些结果推广为完整原客户端像素恢复。
