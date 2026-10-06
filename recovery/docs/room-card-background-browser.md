# 房卡原目录背景实际验收

browser-room-card-background-accepted.json收录原04-51-15-822Z的五个完成浏览器检查、六张实际PNG及独立离线像素PASS。原raw整体FAIL保持：五个检查和普通Join/Leave均已完成，末端输出过大的像素JSON超过Node默认缓冲。验收采用同六张PNG离线读取，不重跑已完成页面。

800×600/1920×1080/3840×2160各保存第一页R1–R10和第二页R11–R17实际图。背景源615×316窗口、0/0位置、全内区目的rect、源DDS615×317图片、Horz/VertStretched、frame0与pointer-events:none均正确。卡片与原按钮在背景之后绘制、elementFromPoint全部命中所属控件，完整编号保持。800实际PNG已目视检查。

tests/room-card-background-pixels.py比较图片同质3×3内区的实际截图，排除卡片及按钮遮挡区。各图784–898个opaque源RGB样本一致；1095–1115个透明或半透明样本按原RGBA与当前Web面板RGB(38,59,73)合成，误差不超过1级，其中每图5个非零非255alpha样本。完整图片边缘GPU插值未作为内区等价依据。

正常卡片选择/上一页下一页与R17完整身份正确；真实refresh pending禁卡片/全部源按钮、响应后选择恢复。普通双向排序保持现回首页规则，再选择第二页R17。源创建取消、Home/Shopping查询弹窗Escape均返回page2/R17/ID排序与来源焦点，中文昵称保持。可信Tab/Enter打开Home并返回，背景不抢键盘或指针。普通选R17 Join得到权威同roomId/playerId WAITING并mapLoaded，正式等待Close正常Leave清world。3318/5342/9542及临时目录全部清理。

## 边界

选源沿现共享sourceProps规则：同名gy0优先ui/imagesets_dds/gy_0.imageset，消费region60/0.png；TGA版本region27/0.png尺寸相同但RGBA不同。原运行manager实际选择尚未证明，本片仅关闭明确DDS选源的正式背景消费，不称原完整大厅1:1。原raw首个选源断言FAIL与末端缓冲FAIL均保持。all.top84与全舞台仍为明确Web投影，原客户端同状态截图、全窗锚点/高清配套/GPU及picTopBanner动态图片来源留父项。
