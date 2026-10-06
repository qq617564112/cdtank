# Item/Weapon 数量出售消费者

正式数量出售使用已拥有列表真实 instanceId。原 controller+40 的 EventMouseDoubleClick 在4a1d93注册4a1b9d，按鼠标位置取得 row+9c实例，进入4a172d数量分支。4a0ac3读取正整数数量后按原分类1/2调用495e90 kind3。数量提示为gamestring55，控件沿userinput_dialog.xml的edtInput、btnOK、btnCancel；Web Enter共享这条激活入口。

StackItemSaleSource只在activation变化时打开数量确认。选择或refreshKey变化时QUERY安装服务器完整inventory与money，不弹窗；父页在购买成功后递增refreshKey。独立StackSaleOwner持有pending请求与inFlight，确认请求使用无连字符UUID；同请求失败重试保留身份。确认成功result2后父页安装完整返回投影。切页与关闭后generation忽略晚返回。

确认数量限制为正整数、拥有数量、24位数量上限和999999999余额上限。购买、查询、出售通过disabled/onBusy互斥。数量弹窗置于document.body，避开Shop父级zoom；原布局按一次视口比例缩放。动态状态使用SourceFeedbackText，数量输入使用配置的XiangJiao字体。

源证据：[stack-item-sale-entry-source.json](/workspace/cdtank/recovery/output/stack-item-sale-entry-source.json)。正式文件与mtime：[stack-item-sale-consumer-preparation.json](/workspace/cdtank/recovery/output/stack-item-sale-consumer-preparation.json)。网络与浏览器实证待统一工程和窗口释放；本消费者不涉及kind5整实例出售。

正式浏览器有限验证已完成。合法同库通过普通购买Item1×2、Weapon3003×2取得库存，各自先取消数量确认，再出售1件与剩余1件；四次独立result2回执各增加5金币，确认名单逐次减量并移除，最终金币178980、tokens360。原数量弹窗在800、1920、3840视口的三张完整图已亲看，提示、输入与按钮在边界内，输入使用XiangJiao字体。双击、Enter、父页余额及严格Close均实际到达。

[浏览器证据](/workspace/cdtank/recovery/output/stack-item-sale-browser-accepted.json)关联完整确认投影、原数量控件事件、工程和进程清理。网络持久化与双状态另由主线网络审查关联。

正式主审：[stack-item-sale-root-review.json](/workspace/cdtank/recovery/output/stack-item-sale-root-review.json)，`PASS_FINITE_STACK_ITEM_WEAPON_QUANTITY_CONFIRM_PARTIAL_FULL_DUAL_STATE_RESTART_CLOSE_SCOPE`。主审合收浏览器四次出售、两次取消、完整确认投影与独立网络双状态/同库重启；商城完整视觉父范围保持开放。
