# 正式高级键位入口来源缺口

UI50 / M5-12。App 正式 Home navigation 的“键位设置”仍打开 KeySettingsView 临时纵向网页表单；系统设置使用原 settings.xml。当前高级表单保存 `INPUT_ACTIONS` 全部 20 个动作：移动/开火、炮塔左右 `aimLeft/aimRight`、快捷槽 `slot1..8`，以及 `useItem`、`prevWeapon`、`nextWeapon`、`prevItem`、`nextItem`。原页仅接 forward/backward/turnLeft/turnRight/fire 五个动作的主/备用键。

原 settings.xml 明确有 UseItem、NextWeapon、PrevWeapon、PrevItem、NextItem 各两控件，且这五个动作已接正式 `InputAction` 与现普通快捷槽消费：`useItem` 请求当前本机道具 cursor 一次，前后武器/道具只在本机确认候选内循环，武器选择仍读服务端 `selectedAmmoSlot`。高级入口继续支持 aimLeft/aimRight 和 slot1..8 等 20 项配置，保留现玩家能力，不能把武器循环映射为炮塔瞄准，也不能把原道具使用/循环填成任意八槽键位。keyboard.xml 是独立屏幕字符键盘，不能作为这十个高级绑定的新布局。

原 UseItem/循环武器道具不再作为未支持项阻塞 producer：设置捕获、保存/取消/默认/冲突与运行期消费均已具真实采用实现，五新动作主键可选并可清除。原 Windows 键位回调、`DirectInput` 扫描码到浏览器 `code` 的映射和“当前选择”写入函数仍未取得，本片只做静态来源与现 consumer 对照，不宣称原完整输入链或正式入口去重已完成。字段与接口清单见 formal-advanced-key-settings-source-gap.json；运行期接口见 battle-cycle-controls-runtime.md、settings-cycle-controls-client.md。
