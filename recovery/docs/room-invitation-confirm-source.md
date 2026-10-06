# 大厅招募接收确认页来源合同

UI-06 / M5-03。当前正式 RoomInvitations 使用网页卡片，消息、忽略与 Join 已有业务闭环。原招募接收布局与 confirm_dialog 绑定尚未确认，七控件正式消费者与现收件业务已接入，实际组合验收已取得限定范围，完整原版父项仍未完成。

原 confirm_dialog.xml 包含七控件。SheetWindow 根307×103；两框分别315×54与315×57，累加整体315×108；txtMessage 为只读300×40；btnOK/btnCancel 各81×43，Normal/Hover/Pushed 引用完整。picBackgroundMask 为800×599但没有 Image 属性，不能补造遮罩图片。控件层次、属性和资源引用完整保存在 room-invitation-confirm-source.json。

候选正式消费者采用原双框、消息与两个源按钮，业务映射明确为 Web 重建。邀请队列、过期、密码资格、Join 权威返回、拒绝保留与原 validation 卡片能力沿已有合同。共享接线仅需 room-controls 向正式 RoomInvitations 传 formal；页端密码分支可复用现 RoomPasswordDialog，submit 仍调用原 join(message,password)。密码取消退回当前邀请，确定页取消沿 ignore 删除该条；入房清队列仍由 room-controls 原 owner 消费。共享 SourceButton 仅需追加 confirm_dialog.xml 类型后缀。页端不新增协议、广播、权限或轮询。

验收条件为正常两账户 Invite 接收后完整800×600/1920×1080/3840×2160页面，确认和取消、捕获释放、原生 Escape 隔离及返回焦点，真实 Join 拒绝和成功。旧广播/冷却业务证据复用；来源合同不能替代页面操作。

## 正式消费者

`source-confirm-view.tsx/css` 消费原七控件，双框和按钮采用共享原图片组件；无图源mask保留空绘制。根按800×600基准同比缩放，315×108实际框明确 Web 居中；状态文字放在原框下独立深色反馈区。根按键隔离、Escape取消、资源提交后仅body/dialog条件聚焦源Cancel，pending禁用两动作且不忽略消息。

`RoomInvitations formal` 仅消费现队列首条，现ignore删除该条。无密码确认直接原Join；密码确认切现RoomPasswordDialog，取消回同邀请，错误与密码输入沿现消费者，成功仍由room-controls入房清理原队列。validation旧卡保持。主线仅追加SourceButton suffix与正式RoomInvitations formal prop，未新增adapter。

工程：`room-invitation-confirm-web-types.log` 与主线 `invitation-confirm-root-web-types.log` 均exit0。正式业务实际只覆盖新增接收消费者，来源关联与完整1:1尚不构成完成。

实际上下文使用普通账户和正式建房/Invite/Join，未注入资金、角色、名单或邀请。原始raw均保存；后继尾段只覆盖尚未到达的确认页三res/capture/password取消拒绝成功范围。Escape关闭、keys=[]及严格建房焦点复用 `browser-room-invitation-confirm-2026-10-04T23-02-04-467Z.json` 有效字段，不能将该整体FAIL改作完整PASS。

## 组合验收

`room-invitation-confirm-accepted.json` 汇总真实字段。23-02-04 原raw的Escape关闭、keys=[]与strictCreate焦点有效；23-03-28 原raw的800/1920/3840完整七控件/16框层、中文邀请文字、capture拖外释放Normal保持open、密码取消回同确认并聚焦、真实ROOM_JOIN_REJECTED保wrong草稿和输入焦点有效。三完整图已亲看。两原raw整体FAIL状态保留，不作为单次全链PASS。

23-06-07 `--join-only` raw PASS，正常密码房招募后原生输入并严格核值，Join成功进入正式WAITING，两端源Close离房与严格Create焦点通过。该尾段无新截图、未重capture/取消/错密码；0Ready/BUY/发送。旧邀请时效、广播和权限证据复用。三个组合raw均为普通账户实际操作，无名单、邀请或角色注入。

主线统一 `invitation-confirm-production-web-build.log` 类型/Vite PASS（1m53），最终bundle确认包含七控件消费者及body-origin焦点返回。该工程记录不代替业务实际。原收件callback/动态挂载/字体/完整1:1及UI06/M5-03父项仍开放，主线已亲审代码、三个raw有效字段与三完整图，`room-invitation-confirm-main-review.json` 接受 `PASS_COMPOSED_INVITATION_CONFIRM_SCOPE`，UI06/M5-03原位有限登记，完整父项仍开放。
