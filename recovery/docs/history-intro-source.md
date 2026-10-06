# 原介绍窗口来源

原 `history.xml` 是木桶镇历史、居民、生产基地和幕后人员的介绍窗口。四页正文现已由原选择回调及原 gamestring 表定位：ID737至740分别对应四个选项。回调 `0x4c39e6` 仅处理选中状态，将原表中的字面 `\n` 转换为换行后写入只读 `edtMainText`，并将光标位置归零。该窗口不能接入玩家战绩列表，也不能以新写的介绍正文作为原内容。

## 布局与标签

来源：`recovery/output/verified/assets/data/Data/ui/layouts/history.xml`，10个控件。`edtMainText` 是 `WindowsLook/MultiLineEditbox`，父内矩形为34,62–758,441，没有 `Text` 属性或布局事件。四选项实际名称及原提示如下：

| 原控件 | gamestring ID | 原字符串 | 原初始化保存位置 |
| --- | --- | --- | --- |
| rdoTuntown | 193 | 木桶镇历史 | this+0x24 |
| rdoCharacters | 194 | 木桶镇的居民们 | this+0x28 |
| rdoCompany | 195 | 生产基地 | this+0x2c |
| rdoStaff | 196 | 幕后黑手 | this+0x30 |

第四控件是 `rdoStaff`，布局和原程序中均没有 `rdoCredits`。提示字符串是页签说明，不是介绍正文。`gamestring` ID321为“阿猫阿狗系列游戏的介绍”，仅是入口说明；四份正文位于ID737–740及对应语言分支100737–100740，两组当前内容相同。`WordString` 是游戏公告与提示；`linkstring` 包含官网、操作说明、积分活动和其他游戏网址，没有该窗口正文或四份正文的路径映射。

## 原初始化与显示入口

以下地址为只读 `CDTank/CDTank.exe` 的虚拟地址，ImageBase `0x400000`。`0x4c08eb–0x4c0b3d` 是原窗口初始化：

- `0x4c0934` 推入 `data\\ui\\layouts\\history.xml`（字符串 `0x5cf1ac`）。
- `0x4c099d` 查找 `History/edtMainText`（`0x5cf198`），`0x4c09c6` 保存到 `this+0x20`；随后 `0x4c09d8` 推入1并调用导入 `[0x5c01b0]`。
- `0x4c09e0 / 0x4c0a18 / 0x4c0a50 / 0x4c0a88` 分别查找四个 `History/rdo…` 控件，保存位置见表。
- `0x4c0af8–0x4c0b27` 分别给这四控件传入193、194、195、196并调用 `0x4d925c`，与原表页签说明一致。
- 原显示入口 `0x4c0b5d–0x4c0b93` 在显示参数非零时，将全局字节 `0x61eb3c` 清零，对 `this+0x24` 指向的首项先传0、再传1调用 `[0x5c0210]`，随后将该字节置1。此入口证明默认选择首项，不证明其正文内容。

## 正文与选择回调

原vtable0x5cf200的订阅入口0x4c3d9e为四个radio绑定同一EventSelectStateChanged回调0x4c39e6。回调先检查真实选中状态，再依据控件owner+0x24/0x28/0x2c/0x30选择ID0x2e1/0x2e2/0x2e3/0x2e4。0x417e17查询原字符串表，在语言分支中使用原ID或原ID+100000；没有记录时返回明确的NONE默认字符串。

0x411c88替换字面反斜线n，0x4c3b27调用原setText，随后0x4c3b31将正文光标位置归零。正文使用原保存字符串原样，不补全源数据的截断结尾、引号或姓名。它们是介绍内容，与账户对局记录无关。

[可复现来源证据](../output/history-intro-content-source.json)保存四份文本、布局、原订阅和完整回调。七个生产组件现由普通 Login 页正式入口接入：`login-source-view.tsx` 的 `btnHistory` 调用 `onHistoryIntro`，`app.tsx` 在非 validation 的 login 分支传入 `setHistoryIntroOpen(true)` 并挂载 `HistoryIntroSourceView`。该 Web 入口是当前正式消费者，不代表原认证频道、完整 native 父分派或 QQ 还原。原 `/validation.html` 诊断入口仍保留；validation 整页、自然纵栏、选项重置及关闭焦点证据仍只覆盖该入口，不能移作正式 Login 按钮、Close 焦点、键盘或高清新验收。完整页面滚动及字体/高清实际精度仍未验收，UI-23/M5-15 父项保持未完成。

## 原纵栏合同

[原执行证据](../output/history-intro-scroll-native.json)执行 WLMultiLineEditbox::layoutComponentWidgets0x1001a750，纵栏相对尺寸0.05×1，位置0.95×0；三种缩放的矩形换算为明确provider。正文724×379。原Scrollbar默认赋值块设thumb最小值10物理像素，history.xml没有覆盖；此值与其他名单页显式53不同。原gy0正文图片为上箭头28×26、下箭头28×27、thumb上片28×29、下片28×17、中片28×7。

独立消费者准备使用上述源尺寸、DOM真实文本范围与当前所选字体行距，保原比例thumb/两倍上箭头高度轨道合同。resize与scale提交后两RAF刷新，并清除blur、观察器、捕获及RAF。生产组件已import，三种缩放的metrics.scale与实际正文矩形/逻辑高度一致。原Staff正文29行自然溢出；实际执行箭头、滚轮、Home/End及thumb在控件外保持capture的单次移动快照，释放后capture为false。完整原字体和framebuffer仍未验。

## 页面实际范围

当前正式入口为普通 Login 页的 `btnHistory`；`/validation.html` 的 `[data-open-history-intro]` 继续作为诊断入口。两条路径挂载同一 `HistoryIntroSourceView`。四原页在800×600、1920×1080、3840×2160保原800×600几何；只读正文与gamestring737–740逐字一致，选项互斥，切换后正文滚动及caret归零。完整页面与返回按钮位于可用视口内，窗口打开时隐藏宿主滚动条，关闭后恢复宿主原overflow及严格opener焦点。Escape在down记录、up关闭。该 validation 证据仅覆盖原范围，不构成正式 Login 按钮、Close 焦点、键盘和 HD 新验收；正式入口实际网页尚未测试。

[实际证据](../output/history-intro-source-page-accepted.json)关联12张完整画面、原纵栏操作、网络只读请求及进程清理。原登录认证/频道、完整 native 父分派、QQ 还原及完整字体精度保持独立缺口；现 AccountHistory、Settings 及 Key 业务未改。
