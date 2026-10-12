# 原通知窗口拒绝反馈（M5-15-N）

notify_dialog.xml现存六控件：SheetWindow、picBackgroundMask、shangkuang、xiakuang、txtMessage、btnOK。根307×103，两个框延伸到315×108且原ClippedByParent=False；Web315×108舞台保留这些外延。上/下框九图均来自原图集，每片20×20；四角保持20px，边与中心按源矩形拉伸，按钮使用源Normal/Hover/Pushed图。消息为原只读RichEditbox矩形，Web使用textContent和可滚动只读区域，不解析HTML。

SourceNotice仅负责资源和消息展示/确认。WaitingRoom.request正式拒绝分支先保存实际Error.message，再等待通知OK或Escape确认，随后恢复原房间控件与焦点，服务器资格和所有战斗状态不变。通知期间父dialog及战斗输入由浏览器模态隔离；clear取消尚未完成的载入/消息并释放等待Promise，离房不残留通知。资源载入失败保留原等待状态错误文本，不让玩家被空窗口挡住。

原XML的picBackgroundMask没有Image或明确颜色，本片保留其源矩形但隐藏无图节点，使用浏览器模态backdrop隔离；这属于明确Web适配，不能宣称原遮罩逐像素恢复。通知消息入口/确认与Escape行为亦为重建业务接线，原通知控制器完整回调/CEGUI文字排版仍留M5-15/UI-40父项。字体沿现有CDTank-SIMSUN资源，不声称恢复原继承skin字体属性。

正式代码归interface/dialogs，调用点仅WaitingRoom请求错误，未修改服务端、协议、伤害、CPU策略、账户或资源生产。旧招募浏览器专项增加正常通知确认后检查无收件者恢复，避免通过点击模态后的inert按钮制造结果。

验收：test:ui:notice:browser实际普通建房/原Invite无人接收拒绝、原六控件与十八图框/三按钮图资源、1080p4K原生鼠键/输入隔离/确认后恢复与继续操作/离房清理；类型、运行模块边界与Web独立构建。必要真实联机覆盖实际RoomInvite拒绝，服务器/账户与连续CPU对局未改，复用已有基线。
