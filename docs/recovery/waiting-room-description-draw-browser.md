# 地图说明正常绘制页面验收

`browser-waiting-room-description-draw-2026-10-03T22-53-08-109Z.json`为 M5-03-R-DESC-DRAW 正式页面 PASS22，来源见`waiting-room-description-draw-source.md`与完整原入口 native PASS12/36 Font draws。命令：`node --import tsx tests/browser-waiting-room-description-draw.mjs`。

正式 map7 普通建房/原等待页读取在800×600、1920×1080、3840×2160截图，正文完整 textContent 与最新 RoomSnapshot.mapDescription相同；普通原 Close/Leave 后重建 mode5/map21，实际最长原正文无旧文，4K截图与读取一致。每个分辨率等待 viewport、SourceImageScale、当前 DPI face 与所有正文 atlas 同时提交，再逐行核对原行距/位置、逐字 ink/baseline/尺寸/atlas、未知 fallback 起点和独立文字 clip。

| 页面 | scale | DPI | 逻辑行距 | 已知点阵字形 | 未知 fallback 字形 |
| --- | ---: | ---: | ---: | ---: | ---: |
| map7，800×600 | 1.0741687979539642 | 103 | 14.513402157738094 | 2 | 64 |
| map7，1080p | 2 | 192 | 14.390625 | 2 | 64 |
| map7，4K | 2 | 192 | 14.390625 | 2 | 64 |
| map21，4K | 2 | 192 | 14.390625 | 2 | 76 |

独立正式生产组件长 props 夹具在相同三个 scale/DPI 下检查文档高度=行数×原行距、正常 wheel/End、原箭头步长、透明 thumb 拖动与位置裁剪；普通变文释放 held capture、短文位置归零、关闭卸载。夹具每次120个已知字形和208个未知 fallback；文字内容并非原地图正文，明确与真实网络页面分开。

800×600 原文字裁剪层高度102+5/scale=106.6547619047619，浏览器 inline style 序列化为106.655；差值0.0002380952380969248逻辑像素。CSS 几何允许0.001逻辑像素序列化误差，当前scale/face提交等待仍为0.0001。1080p与4K该高度差为0。22-52-13首轮失败完整保留。

选定截图为同前缀`-800x600-ordinary-description.png`、`-1080p-ordinary-description.png`、`-4k-ordinary-description.png`、`-4k-longest-map.png`及三res`-long-props-top/-long-props-dragged.png`。800正式图与4Kmap21实际图已观察，文字区域正常显示、最长说明可完整阅读。

所有专属进程/临时目录清理为true，3283/5313/9513无监听。业务/CPU/账户既有基线沿用；本片只覆盖正文绘制与阅读。

## 限制

已知字形是有限原 mono 采样；实际地图大多数汉字仍为 TTF/Canvas provider，此验收没有把 fallback 认定为原 Windows 字形。原完整 framebuffer/GPU/display、全字库、编辑/caret/selection保持未完成父项。源码正常消费者、原行距、已知 ink、clip 与正式读取闭环是本片完成范围。
