# 登录与频道整页依赖

M5-01 / UI29 / UI30。已整理login.xml16个原控件与lobby_select.xml48个原控件，原图及几何可供呈现；login有edtAccount/edtPassword、登录、注册、保存账号和其他入口，频道页有lstLobbyServer及等级/区域/状态控件。布局未提供事件生产者。

现正式GameConnection在连接后以ReqAccount.token恢复持久身份，ResAccount返回accountId/token；没有账户密码接口，也没有源频道目录合同。原账户密码与保存账号字段不能直接绑定opaque token，频道列表不能用虚构条目补齐。

整页接入需要主线协调App启动导航/连接生命周期、原登录字段与按钮的实际业务语义、权威频道目录及进入大厅成功/失败/返回合同。本线可拥有新login/channel呈现模块与CSS；当前只准备来源，未import或浏览器实际，不修改现持久身份业务。原来源未证语义保持未完成。

具名初始化来源补充：login-control-initialization-source.json/log与专属脚本记录0x4c1361–0x4c17c1。Login/edtAccount存this+0x20、Login/edtPassword存this+0x24；两个Editbox调用setMaxTextLength(20)，密码调用setTextMasked(true)。同初始化0x4c17bc引用keyboard.xml/Keyboard前缀，证明原键盘根由登录页加载，未证明显示或插入回调。此为静态原指令/具名DLL导入依据，没有native执行或Web实际结论；未知登录/频道producer保持未完成，停止该轮扩查。
