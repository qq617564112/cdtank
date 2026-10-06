# 我的家正式昵称入口

M5-07/UI-36原myhome_playerpage.xml的xiugainicheng位于chaotiaodi，矩形10,5–91,47，按钮Normal/Hover/Pushed引用lobby_anniu30原三图。正式Home尚未消费该按钮，当前battle.displayName读取/写入账户确认昵称及lobbyPresence.refresh已存在，仅validation旧昵称栏可操作。

本片拟拥有home-inventory.tsx仅原昵称按钮与确认名字同步、新home-name-source-dialog.tsx/css和专属browser/source/doc；不改App、Battle方法、账户写入或协议。userinput_dialog.xml原输入/OK/Cancel主要框有完整资源，可承载现Web昵称业务；原昵称按钮回调到该弹窗的绑定未证明，明确Web附着与现业务映射。不能宣原服务昵称流程恢复，不恢复大厅无原布局的昵称栏。原输入NormalTextColour=00FFFFFF无当前原生输入消费依据，使用可读Web白字，保持中文组合输入。

原基准800×600。Home原框/根/源位置复用，输入框307×120的可见上下完整区域按同基准缩放居中，按钮沿原完整父链；原SheetWindow103高而子框可见到120，当前Web以120承载原ClippedByParent=False可见区域。状态/错误显示在原框下方独立可读区域，非原文案producer。

初次打开读取真实DisplayName；中文草稿取消不写，普通确认走现displayName(draft)并以返回值更新Home名字，成功刷新现大厅presence。实际错误保留草稿和确认名称，pending禁止重复确认；关闭晚返回只忽略已卸载页面显示，不重写已授权账户事务。Escape取消并恢复Home原按钮焦点，输入事件隔离现战斗键盘，组合Enter不能提交。validation旧入口能力保留。

验首Home整页与原昵称按钮/原输入框800×600、1920×1080、3840×2160，普通中文取消/确认、服务器真实非法昵称拒绝保草稿、成功返回确认显示与重开读取、源Cancel/焦点及键盘隔离；不重统计历史、购买、对局、全build。原回调绑定、原输入采样、完整UI36玩家资料及1:1未完，父不勾。

## 实际交付

新增HomeNameSourceDialog持有打开时读取/草稿/组合状态/请求owner，HomeInventory仅原按钮与服务确认返回名称同步。通过createPortal挂document.body，避免同为dialog的Home CSS zoom累乘，React状态仍由Home拥有。现输入深蓝源底使用白字作为Web可读呈现；原颜色消费者仍未证明。

18-43-51-673Z首完整PASS三图已亲看：800输入根307×120，1920为552.6×216，3840为1105.2×432，原上下九图/输入底/两源按钮可见居中，输入和标题可辨，Home背景主要区域保留。普通中文“中文取消候选”取消不发写入且原名保持/焦点回原修改昵称按钮；超过16字的实际请求被服务器“昵称应为1至16字”拒绝，草稿及Home原名保持；普通中文“普通中文昵称”确认实际DisplayName返回后Home显示同名、焦点回原按钮，重开GET同确认名称，最后Close回大厅Home焦点。

键盘定向只测试未到的组合门禁和Escape导航：合成compositionstart/end用于验证组合状态，真实浏览器Enter不保存，普通insertText中文草稿、真实Escape取消后焦点为原修改按钮，window keydown漏键为空。该证据不冒浏览器真实IME候选选择测试，不重复保存/拒绝/三res。所有Escape在React中先stopPropagation/preventDefault，composition期间保持窗口和草稿，正常Escape才取消；native cancel同样先preventDefault且组合期间不取消。18-46-24-849Z定向真实CDP Escape在组合状态下保持open/草稿/零保存；结束组合后的普通Escape取消/原按钮焦点及window漏键空。组合状态仍由合成composition事件建立，不宣真实操作系统候选选择。

18-43-05-125Z原缩放FAIL保留，不采用其失真整图。独立3379/5429/9629无监听，临时目录清理。accepted索引保存上述组合有效范围，原事件绑定/2000控件/完整Home资料及1:1父仍未勾；统一生产types/build由主线审查集成。
