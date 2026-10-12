# 我的家角色根整页浏览器验收

`tests/browser-home-roles-page.mjs`通过11项真实页面检查，证据为`browser-home-roles-page-2026-10-04T07-05-04-791Z.json`。同前缀`-tank-800/-tank-1920/-tank-3840`和`-pet-800/-pet-1920/-pet-3840.png`为六张实际完整页面，全部已人工查看；`-player-return.png`显示返回共用库存根。

三种分辨率800×600、1920×1080、3840×2160均显示完整625×404根框、三源页签及Close，缩放1/1.8/3.6。坦克原picModel源区域218×218实际画布随缩放提交对应像素尺寸，已拥有定义2及三槽迷彩实际渲染；左拥有列表与名称、源出击按钮和底部Web功能/保存提示清楚可见。宠物页保留源背景/拥有名称及出击，不绘制未恢复宠物模型。

账户拥有数据沿既有native owned pair rows[0]显式导入测试宠物71/战车72，不为新账户免费授予拥有。普通鼠标选战车72→源出击保存，实际服务器确认和数据库profile+a8一致；确认前后相同preview DOM/Engine/Scene保留。普通根Pet页签切换，旧preview Engine/Scene已dispose、DOM断连且帧数停止；选择宠物71→源出击保存，实际profile+a4一致。

Player源页签回正式库存根，源Close回大厅Home焦点。再次从大厅Home→源Tank进入当前已保存坦克并正常显示；源Close释放preview engine/scene、停止渲染并恢复大厅焦点。专用server3325、Vite5349、Chromium9549与临时数据库/浏览器目录全部清理。

Web类型检查通过；发行集成由root记录。账户重启/库存/CPU及全部21战车preview等既有未改业务证据复用。

## 限制

本项是正式根整页与有限普通角色保存/切页交付。原完整改装、费用、耐久、附件/属性、宠物模型/技能和原字体/GPU仍未完成；不据当前空白区域关闭父项。场景性能使用SwiftShader，不证明高清实时帧率。
