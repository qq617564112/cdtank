# 房卡猫狗父裁剪实际页面验收

M5-02-C-IMAGECLIP 的正式两图源父裁剪、按钮状态和普通大厅流程通过。索引为 browser-room-card-image-clip-accepted.json；完整真实页面证据为 browser-room-card-image-clip-2026-10-04T05-28-01-746Z.json。

800×600、1920×1080、3840×2160 各完成 Normal/Hover/Pushed/selected 四状态截图。按正常鼠标位置与按住/释放断言实际 SourceButton 状态；选中后离开指针恢复 Normal，源图目的矩形与父 inset 保持。刷新 pending 的4K禁用卡另有截图，随后服务器确认恢复。其它 picGameMode 显式不裁父，保持原向右越界及空 clipPath。

13张正常页面截图对应13张图像消费者诊断基线。基线只临时将同页猫狗图的visibility隐藏以记录下层像素，随后恢复，普通操作与正常截图中原图均保持显示。room-card-image-clip-pixels.py 对照真实源DDS PNG及同页基线：父区域外存在源非零alpha的257–2136个采样点/图与基线完全相同；保留区域447–2592个均匀不透明源采样点/图的RGBA误差为0。源狗图31×22保持目的30×22，源坐标采样按完整目的尺寸映射，裁剪没有重新拉伸剩余图。

普通中文昵称“裁剪中文玩家”、第一/第二页及R6/R17选择、EMPTY/ID双向排序和重置页、刷新禁用/恢复与选择保持通过。原加入入口发送正常Join，R17 WAITING的playerId与权威响应一致、mapLoaded成立；等待源Close正常Leave后world清空。没有注入战斗状态。3319/5343/9543和临时数据库/profile全部清理。

## 边界与证据

像素判定覆盖被裁区域与均匀不透明保留区域，不宣称完整边缘滤镜、部分透明合成或Windows GPU等价。临时隐藏图的基线属于诊断夹具，不能作为普通页面截图。完整大厅锚点、原manager选源和MediumHT高清display缺口仍属父项。

visibility补证 browser-room-card-image-clip-2026-10-04T05-30-11-599Z.json 逐次确认诊断后两图inline visibility为空且computed visibility=visible，再普通Join/Leave，进程清理全true。主验收仍引用05-28-01完整证据；root统一执行相关Web类型和模块边界检查。

复核像素：

```sh
recovery/.venv/bin/python tests/room-card-image-clip-pixels.py recovery/output/browser-room-card-image-clip-2026-10-04T05-28-01-746Z-pixel-input.json
```
