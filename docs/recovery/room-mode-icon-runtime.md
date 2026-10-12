# M5-02-CM 原房间卡片玩法图标

五种实际房间在picGameMode原矩形显示对应原gy0图像，替换此前文字回退。Web模式1–5与原模式0–4是不同编号，不能把Web数字直接传入原图片路径。

原模式选择radio回调把团队/占领/擒王/混战/破坏写成0/1/2/3/4；原目录producer5070b9–507168读取房间记录+38并直接格式化data\ui\gy\%d.tga，imageset=gy0，把结果setImage到实际RoomIconN/picGameMode绑定字段。source脚本50组模式×十卡槽及五个原radio回调真实执行PASS。精确映射与供给边界见room-mode-icon-source.md；上游网络原记录+38生产未证明，不能由此宣称完整原房间协议。

lobby/room-mode-icons.ts仅负责已知Web1..5→原0..4图引用；room-cards沿原source-ui-layout解析DDS imageset引用和picGameMode矩形42,7–121,29，提供模式title与aria标签。未知mode不猜配，保留文字；已知引用在当前导出缺失则文字与资源缺失提示，不把静默fallback计为成功。五图对应源region60/80、79、83、82、81.png，原图文字逐一为团队/占领/擒王/混战/破坏。

规则room-mode-icons.cts核对所有五引用实际解析为准确源DDS PNG且存在，0/6/负数/非整数/NaN/Infinity不返回猜测图片。初次规则检查检出路径双反斜线与导出单反斜线不匹配，已修正为原导出引用分隔符并复验PASS，不修改源资产/解析器。

检查范围是当前模式图表现和页面选房身份保持，不重做17房完整卡片业务、双端对局或账户重启；服务端/协议/战斗未改，保持原C有效证据。最终browser-room-mode-icons.json四检查PASS：实际五系统房权威模式1..5、精确原引用/79×22 PNG解码/原42,7–121,29控件矩形/1080p4K实际截图与可见边界、原生R3选房/EMPTY排序/真实刷新保持身份和图像。主agent实际检查截图五中文图均正确。room-mode-icons-types/boundaries/build-web.log全仓类型/263正式依赖边界/独立Web发行1m25s均PASS。3190/5225/9295与临时数据已清理，两个Sol停止，M5-02-CM原位勾选；原网络记录+38生产及完整目录分页回调仍由M5-02/UI-05保留未完成。不宣称CEGUI原framebuffer像素等价或全部大厅复刻。

命令：test:rooms:mode-icons及:browser；来源room-mode-icon-source.md/JSON，实际网页room-mode-icon-browser.md。
