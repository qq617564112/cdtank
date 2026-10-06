# 房间卡片原文字与普通加入验收（M5-02-C-TEXT）

`browser-room-card-text-accepted.json` 收录 `browser-room-card-text-2026-10-04T01-38-07-252Z.json`，7项 PASS、11张实际 PNG。专属 3302/5330/9530 服务、Vite、Chromium 与临时账户目录均清理。原来源见 `room-card-text-source.md`；全仓工程检查由主agent统一集成。

普通 API 创建8码点中文房名、密码房、个人房、满员房与实际全员 Ready 的 PLAYING 房。正常网页通过真实 ListRooms 显示目录。800×600、1920×1080、3840×2160逐四文本核对 SIMSUN/FFFFFFFF、HorzCentred/VertCentred、文字区域 hidden 裁剪及原95×16/30×12矩形；完整目录房名仍可从 textContent/title 读取，长名称在95宽区域裁剪。原人数 atlas 成功解码，个人模式总人数1与团队两个数字真实显示，隐藏组不参与显示。

独立 native-scale 800×440 截图验证文本状态回归：先普通选R7使R6未选；移出、移入、可信鼠标按下与释放分别核实际 Normal/Hover/Pushed 图片引用与 aria-pressed，再观察满员与 PLAYING 禁卡。六张截图的数字「1」各有12个源 opaque 样本实际白色、32个原透明样本保留底图。CSS浮点 glyph rect 和居中 advance 保留记录，浏览器原尺寸背景采样位置按实际栅格位置比较；这是本次实际图与有限 mono alpha 的局部对照。另有4个样本位于文字窗口之外，原样本均透明，不将其称为 opaque glyph 越界裁剪实测。原 draw clip 与 DOM窗口范围由独立来源/几何证据约束。

同一运行普通 ChangeTeam 将权威计数 [1,1] 改成 [2,0]，正常刷新更新两数字；普通鼠标与 Enter 选密码房。错误密码 Join 真实拒绝且无 world，重开保留当前页、同R7选择与密码草稿；正确密码普通 Join 进入同R7、同 playerId 的权威 WAITING，正常 Leave 清空 world。三res卡片图与密码拒绝重开、成功等待图均实际捕获；800与4K卡片图已查看。

## 边界

房名中的未知字使用已加载 SIMSUN Web fallback，本次原 mono 像素对照限定已知数字。卡片 stage 615×280、缩放上限3、外框、工具栏、R编号、按钮旧状态消费者与目录映射保持现有投影；本片只证明四文本及相关操作回归，未把旧按钮算法、外框或整页布局称为原1:1。原完整 Windows 大厅截图和 GPU/display没有取得。

主线集成：root独立核accepted运行与六像素状态并查看800/4K实际截图，room-card-text-root-review.json PASS；统一Web类型/构建1m22s及315运行模块边界PASS，见breach36-card-text-web-build.log、breach36-card-text-boundaries.log。此工程证据与05436地图切片共享，无服务端规则/账户改动，不重复五模式或重启。
