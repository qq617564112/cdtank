# 等待页高清主要文字来源缺口

M5-03-R-TEXT07保持未完成。800页面使用96/103DPI有限原SIMSUN点阵时主要文字可读；1920等待缩放2使用192DPI点阵时房名、地图名、时长和说明呈碎片。已确认碎片存在于发布192DPI atlas各源字形矩形自身，出现在浏览器CSS采样之前。

producer为`recovery/evidence/ui/waiting-room-font-native.py`：原CEGUIBase静态FreeType执行Load_Char得到bitmap，pixelMode=1，正pitch；按行读取mono bit生成atlas。实际PNG尺寸、glyph坐标和width/height与元数据一致。PE进口0x1010f148确为_setjmp3，0x1010f0ec为memmove；未取得具体解码/原FT轮廓消费者错因，不能把192碎片像素继续作为原正确字形证明。96/103已可读bitmap与192路径应分别保留来源结论。

来源记录`waiting-room-text07-source-gap.json`。实际完整等待页面证据`browser-waiting-room-text07-2026-10-04T08-46-48-498Z-1920/-800/-3840.png`；同run的JSON通过6项普通Join/Ready取消/换队/源Close回大厅/再入操作，但不接受主要高清文字可读性。运行期间使用有界glyph采样仍显示相同源碎片，相关三处生产文本改动已全部撤回，当前renderer继续原atlas消费。

唯一下一缺口是原192DPI FreeType轮廓bitmap执行/导出正确像素来源，需定位其具体原调用或仿真provider问题。没有更换字体、填造数据、改变排版或将交互通过当成文本完成。专属服务3332/Vite5356/Chromium9556及临时目录已清理。
