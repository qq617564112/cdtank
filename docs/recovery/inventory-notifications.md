# 库存通知与数量更新

原文件：`CDTank/CDTank.exe`。地址为PE虚拟地址，ImageBase为0x400000。

## UMsgDeleteInKitbag

0x44242c把0x440fd7注册为回调，0x442451把0x5c5798（字符串`UMsgDeleteInKitbag`）写入同一注册对象。不能仅凭数量扣减把这个回调认定为道具使用成功回包。

完整处理区间0x440fd7–0x441155：

- 从message+0x0c读库存实例ID；通过0x43bd3a先查manager+0x10/+0x14的vector，未找到再查+0x20/+0x24。匹配字段为record+4。
- 第一个vector找到时，读取record+0x0c查询ItemTable；manager+0xc4存在且查表成功时可显示消息。
- 第一vector的0x4410da/0x4410e2、第二vector的0x44111b/0x441123分别把record+0x20本局可用数量和record+0x10拥有数量减1。没有重新取min，也没有零数量检查。
- manager+0xb4存在时，调用其虚表+8，参数为实例ID和扣减后的本局数量。
- 两个vector都没有记录时不更新；第一vector匹配即停止搜索。回调本体没有删记录、清快捷槽，也没有读取message+0x10/+0x14来判定成功。

## 接入边界

快捷键请求本身不扣数量，见item-hotkeys.md。该通知已确认对应原packet类型3c92，包体仅实例ID32；socket接收链及与使用请求的关系仍待确认；当前生产库存尚未供给，不能以此通知推导初始库存或直接实现成功施放。下一切片恢复查询库存和通知来源，再用完整原处理器执行对照验证更新行为，最后接入CPU与真人共享输入链。

## 原处理器执行对照

`npm run test:combat:inventory`执行原0x440fd7及真实SEH helper0x57a6a8、查找0x43bd3a的600案例，随后与共享applyKitbagDeletion逐值比较。覆盖第一/第二vector、重复实例的首匹配、缺记录、两数量独立变化、零/unsigned最大值回绕、可选数量观察器及附加消息字段变化。返回后栈、EBP和fs:[0]恢复；数量回调在两个字段更新后执行。ItemTable存储由夹具供给，可选文字UI关闭。

原查询入口、导入与装备状态的执行对照见inventory-query.md；同一命令还验证查询→快捷槽数量初始化→请求不扣数量→独立删除通知→空槽提示的共享状态组合。这是已恢复函数之间的状态组合，不是已接通的真实传输或施放业务。

原包体解码→listener类型匹配→callback clone/receiver绑定→forward→440fd7更新链现有1800案例，具体依据inventory-wire.md。源消息没有成功标记、数量或技能ID。
