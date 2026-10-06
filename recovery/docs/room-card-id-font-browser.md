# 房间编号实际浏览器验收（M5-02-C-IDTEXT）

browser-room-card-id-font-accepted.json 收录一次 PASS 的四个完成检查范围、12张实际PNG与数字像素结果。原始证据 browser-room-card-id-font-2026-10-04T02-42-45-164Z.json 保留全部截图、几何、真实目录/网络与可信输入事件。源码及原机器码消费者见 room-card-id-font-source.md。

专属3312服务经普通API创建12房，与系统5房共同构成17房目录。800×600、1920×1080、3840×2160均观察第一页面真实R1–R10：完整文本/title/aria身份保留，数字1使用7×14图片，其余数字10×14，R不绘制不占advance。每个窗口−1/8/32/17源坐标、14行高、顶部2、居中extent、glyph矩形、overflow:hidden与源图片层先于文字层均通过。字形pointer-events:none，elementFromPoint命中所属卡片。真实编号均落在窗口内，本片不宣称取得被切断的opaque编号像素。

每个分辨率分别保存Normal、Hover、Pushed、Selected四张PNG。tests/room-card-id-font-pixels.py 在原数字RGBA的2×2同质opaque内区取目的坐标，全部132次glyph观测取得逐RGB相同的原黄色像素；白色FFFFFFFF乘数保留图片本色。800实际PNG已目视检查。完整插值边缘不作为此内区验证。

三分辨率在数字6图片中心普通鼠标按下/释放选择R6；Hover/Pushed源图态正确，离开指针后已选R6回Normal，未将选择状态转为永久Pushed。可信Tab定位R7并Enter、R8并Space分别选择完整身份。第一页禁用上一页不越界，下一页选择R17后返回第一页，Join前world为null。普通Join/WAITING/Leave复用 browser-room-card-paging-accepted.json 已完成范围。

同页SIMSUN yeshu保留数字、空格、斜杠原raster glyph与白色颜色，人数保留原raster glyph；房名保留既有全字符串outline fallback，当前真实名字含有限atlas之外的字符，未将其称为原mono字形。SIMSUN函数体未变；主agent另行记录有限atlas回归和统一工程验证。

## 边界

高清结果为当前Web stage对native1字形/advance的统一投影；原Windows HD字体AutoScaled与完整窗口framebuffer留父项。此片不扩展账户、长局或全大厅验收。3312/5334/9534专属进程及临时目录全部清理，未注入游戏状态。
