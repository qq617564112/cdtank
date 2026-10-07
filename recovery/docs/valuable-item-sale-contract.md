# 贵重物品出售合同

M6-06。原495e90的kind5调用494bad(instance,quantity)，只接受4396e0类别6（定义20001–22000），不接受类别7。请求3f8e发送instance32/quantity24；回执3f8f收到instance32/quantity24/result8/完整money32。原codec复用数量出售既有资格，虚表分别5cb2b4/5cba08。

494bad要求模式2、资料与Itemrecord provider。4396c2对20001–21000返回true，按43cd5b取得拥有实例并检查请求量不大于MyItem+10；未取得拥有记录时该客户端检查仍会落入发送路径，不能当服务端授权。21001–22000强制请求数量1。报价为原439947无符号ItemMoney右移1后乘数量，乘法保低32位；金钱相加的uint32结果须不大于999999999。数量不足回调1，金额上限回调0。没有装备或Break禁售门禁。

495591只在result2成功时先替换资料money selector26，再调用43d583(instance,replyquantity,6)→43d122。类别6向量位于+6c，begin/end为+70/+74。20001–21000且拥有量大于回执量时只扣MyItem+10，不更新battle+20；否则释放完整实例并erase。该消费者没有资料引用或hotkeys清理。结果最终交owner+64回调，非成功结果不改金额或库存。

[最小来源索引](../output/valuable-item-sale-contract-source.json)保存新sender/receiver及删除合同。原Item表仅20001鱼骨、20002骨头，ItemMoney/ItemCoin/GGet/Durable均0，Break2、BattleUseMax0。正式consumableShopItems与partShopItems均不供应类别6。

当前玩家行为已闭合于现有地面取得、保存与普通使用链：正常取得并保存 `20001`
鱼骨或 `20002` 骨头后，可在账户持久 `ownedQuantity` 上出售；出售只按请求实例和
24 位数量扣减，不要求取得记录，也不生成新 grant。价格 `0` 不构成免费购买政策；
类别 7 既没有本表记录，也不能复用本 sender。

当前服务端合同采用独立 `ValuableItemSale` API58、共享 schema 114 和
`valuable_item_sale_receipts`。`QUERY` 只读当前 inventory/money/profile 并返回 exact
`20001/20002` quotes；`SELL` 只接受正 uint32 实例与 `1..0xffffff` 数量，在同一账户事务内
重读 owned，原子扣减并写同 requestId/instance/quantity 幂等回执。部分出售更新同实例；
完全出售删除实例及全部贵重品快捷槽引用；money/profile 其它内容与 `0x70` 钱包值保持。
回执为 `{instanceId,itemTableId,quantity,price,result:2}`，重复同参数只返回历史 receipt
和当前投影，不重复扣量。

原 receiver 在类别 6 部分出售后只扣 `MyItem+10` 的旧行为不是本次终态。当前采用规则把
已绑定真实 hotkey 的实例 `battleQuantity` 置为剩余 owned，未绑定为 `0`；完全出售清
hotkey 引用，不改皮肤、装饰、标记或部件 selector。

Web 采用规则：`SELL` 先按认证映射收集该账户全部当前实际 room session；无 room 或全部
`WAITING` 允许，任一 `LOADING/PLAYING/FINISHED` 拒绝。首次成功且未 replay 时，将同一
确认 inventory 安装到全部允许的当前 player，全部取消 Ready，并按真实 `roomId` 去重各
广播一次；历史 receipt replay 不重新取消 Ready。`QUERY` 任意阶段纯读，无 room 不写。
原 Windows 服务端 dispatcher、原 receiver 未命名字段和支付/授权实现仍未取得。

Web 消费以真实 `GameConnection` 认证结果和连接世代为 owner 身份，显式登录与自动
`ensureConnected` 认证同源；RPC 前按捕获身份核连接，旧账户查询、pending 和 confirmed
projection 不写入新账户。结果不确定的已发送 pending 用保存的 instance/quantity/requestId
独立重放，即使剩余不足或行已删除也能确认原 receipt；成功或明确未成交才释放。room、round
或阶段转换使显示世代失效并关闭数量弹窗，同 owner 未确定 pending 保留但不自动在不可售
阶段发新 `SELL`。普通 Inventory 刷新不得以迟到响应覆盖确认投影。

既有正式 Skill 目录中，`20001/20002` 为 Trigger1、Target1、Func20，参数分别 T1/T2、
X1、Y20001/Y20002；同物件第二技能 30005 为 Trigger1、Func2、HP30。物件描述 15 与技能
字段 30 不一致，不能据任一字段宣布最终治疗量，也不能把 Func20 的 T1/T2 自行命名为
猫狗资格。当前普通取得已由既有 ground acquire 账户事务写入 owned，普通 use 由
`treasure-item-use.ts` 沿现 CAS 治疗并扣减；出售链独立复用保存后的 owned，不冒充原
Windows 分派。
