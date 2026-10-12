# 原通知整页共用消费者

M5-15/UI-40。notify_dialog.xml六控件根307×103，上下框有ClippedByParent=False，延伸315×108；基准800×600，沿现通知舞台等比缩放居中。两框各八frame与一个中心实际区域均20×20，原btnOK Normal/Hover/Pushed81×43，来源完整映射见source-notice-shared-consumer-source.json。原Frame/Image消费者与ButtonBase capture/hover XOR pushed/键盘状态已在等待及建房来源证明，本页无需重复原入口取证。

拟归属source-notice-view.tsx/CSS：两框和原静态根接SourceStaticImage，通知确认接共享SourceButton，显式SourceImageScale沿现scale；消息仍沿实际Error.message与原txtMessage只读矩形，长文滚动/plain text保持，未知原RichEditbox排版/文字继承/遮罩与原回调不冒恢复。picBackgroundMask无图隐藏及浏览器backdrop保持既有Web适配。Root owns SourceButton suffix notify_dialog.xml type合同，controller/WaitingRoom入口不改。

SourceNotice generation/show/clear/completion及父等待request owner/焦点资格完整保留。根Escape应先stopPropagation/preventDefault再notice.clear，composition继续隔离。界面消费者迁移不更改拒绝资格/消息或请求事务，不增加协议。

独立必要验收将以普通空账户正式建房→Invite无收件人真实拒绝为上下文，原通知整页800/1920/3840主要框/文字与原btnOK状态/capture正常拖出不确认、原生键盘确认及Escape隔离/源Invite焦点，最终普通Leave清理。0Ready/BUY/战斗，不重既有邀请权限或旧SourceNotice生命周期规则。完整原事件、RichEditbox与1:1父项保持开放；当前仅source登记，未运行新页面验收。

## 实际交付范围

source-notice-view.tsx原框/SourceButton/SourceImageScale/Escape迁移已stable，SourceNotice controller与WaitingRoom调用无改。原真实INVITE_EMPTY文案保持。20-38-45 raw整体FAIL中的800/1920/3840整页字段有效：六源控件、16frame与2center匹配原18图片，完整图片实际加载，源矩形和中文内容处于viewport。三张实际图均查看；通知按1/1.8/3.6缩放，父等待既有cap2差异保持。三res只复用该有效段，不冒其未执行尾段通过。

20-45-33 navigation-only raw PASS，只补普通新建房的真实拒绝、拖外释放/Space/Escape和离房尾段，无新截图，resolutions=[]。真实gotpointercapture确认btnOK捕获；pressed/capturedOutside hasCapture=true，pointerup仍送btnOK，lostpointercapture后hasCapture=false/Normal/pushed=false，提示保持open。原hover XOR pressed消费者在拖外状态为Hover。Space按下原Pushed图、释放确认通知await并回源Invite；再一次真实INVITE_EMPTY后native Escape window keys[]、严格源Invite焦点。正常源Close离房恢复大厅Create且enabled，0Ready/购买/战斗。

原成功CDP物理驱动合同为down按钮left/buttons1、heldMove按钮left/buttons1/modifiers16、up按钮left/buttons0；仅仪器补齐该显式合同。共享SourceButton生产代码没有修改，不增加window监听兜底。此前FAIL文件原样保留，有效来源/整页与失败尾段边界精确收在source-notice-shared-consumer-accepted.json；末raw声明scope模板包含three resolutions，但其实际resolutions=[]只代表navigation-only，组合三res来自20-38原有效段。

工程复用source-notice-shared-consumer-web-types.log与主线scene04-notify-equipment-web-build.log strict types/Vite1m30 exit0，未独立重复build。主线已审代码、三PNG与navigation-only raw，接受PASS_COMPOSED限定范围；UI40六源控件与本片普通操作可登记完成。M5-15、原callback/RichEditbox/遮罩/字体、waiting父4K缩放差异及完整1:1父保持未完成。专属3414/5444/9644与临时数据库/Chromium目录均清理。
