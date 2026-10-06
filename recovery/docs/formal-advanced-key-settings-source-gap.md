# 正式高级键位入口来源缺口

UI50 / M5-12。App 正式 Home navigation 的“键位设置”仍打开 KeySettingsView 临时纵向网页表单；系统设置使用原 settings.xml。当前原页仅接 forward/backward/turnLeft/turnRight/fire 五个动作的主/备用键，而既有高级表单保存 INPUT_ACTIONS 共 15 个动作，另含 aimLeft/aimRight 和 slot1..8。直接删除或转到当前原设置页会丢失十个已支持的玩家键位配置能力。

原 settings.xml 明确有 UseItem、NextWeapon、PrevWeapon、PrevItem、NextItem 各两控件，但当前未确认这些原动作的 producer 与现接口对应。不能把武器循环映射为炮塔瞄准，也不能把原道具使用/循环填成任意八槽键位。keyboard.xml 是独立屏幕字符键盘，不能作为这十个高级绑定的新布局。

保留现玩家能力，正式临时入口未符合最终去重目标，本父项保持未完。下一步需主线协调 App 入口/现 input-action interface，并有足够源映射支持全部业务后才能迁移；本片仅具名来源与现 consumer 对照，没有生产修改、原 setter 推造或重复设置实际验收。字段与接口清单见 formal-advanced-key-settings-source-gap.json。
