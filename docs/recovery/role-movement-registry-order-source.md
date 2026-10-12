# 原动态运动角色索引顺序

原角色索引按uint32对象ID升序遍历，与角色入场或插入顺序无关。`426b92`分离首个重叠角色，`4272d7`动态门禁遇首个拒绝退出，均消费该索引遍历顺序。正式服务器目前用房间成员顺序，是既有明示重建边界。

## 来源与首次执行

角色收到入口`4264c4→4231fc`原attach调用`421673`。本片执行`421673`、原ID getter `431d4d`、已有ID删除`42162c`、原RB-tree插入和旋转、查找`48a226`及后继`42de86`。节点布局为left/parent/right三指针、+c uint32键、+10角色指针及+14/+15颜色/哨兵字节。

`421277`的`cmp/setb`及`cmp/jae`是unsigned比较。查找`4501fa→486351`也以unsigned比较取得键。遍历从head.left开始，用完整原后继到head结束。

| 首次条件 | 原遍历结果 |
| --- | --- |
| 空树 | 空 |
| 插入7、19、31 | 7、19、31 |
| 插入31、19、7 | 7、19、31 |
| 插入19、7、31 | 7、19、31 |
| 插入ffffffff、80000000、7fffffff、0 | 0、7fffffff、80000000、ffffffff |
| 插入31、7、19、7 | 7、19、31，7指向最后安装角色 |
| attach空角色 | 空，不分配节点 |

重复ID的完整attach先调用manager virtual+38=`42162c`。后者查到旧角色后调用其deleting destructor，再以原`421308`删除节点，最后插入新角色；不是只改角色指针或累加同键条目。测试捕获一次旧角色析构和一次节点释放，实际删除平衡及插入原指令保留。每个有效键均经原`48a226`确认返回最后安装角色，另有缺键返回0。

七条件只供给空树哨兵、角色记录、分配/释放端点及被删除角色析构sink。ID getter、比较、节点构造、RB-tree旋转/删除平衡和遍历执行原二进制。没有重跑旧19个controller、12个分离或全部车型；原碰撞/分离数学复用既有证据。

## 正式消费者与接线边界

当前`apps/server/src/battle/dynamic-movement.ts`的`predictControlledBattleMovement`与`separateBattleParticipants`都从房间Iterable取得角色；`id`为string，没有原uint32对象ID字段。由此不能将字符串字典序、账号ID、槽位或房间创建次序称作原索引顺序。

若主线取得真实`originalObjectId:number`来源，两个消费者应按该uint32键组装角色列表。现无该producer，保持现房间次序重建，尚不请求改World/协议/玩家状态，也不新增猜测ID映射。重复ID销毁行为仅证明原客户端角色索引，不移作当前账号/房间业务的重复登录规则。

## 证据与限制

执行命令：`recovery/.venv/bin/python tests/role-movement-registry-order-native.py`。产物`recovery/output/role-movement-registry-order-native.json`和`role-movement-registry-order.disasm.txt`，状态`PASS_ROLE_REGISTRY_ORDER_NATIVE`，7条件。检查检测插入序误当遍历序、signed/unsigned混淆、重复键错误及查找/遍历失配；差异应修正本索引合同。

原服务端对象ID分配、当前字符串ID的对应、完整角色管理器初始化与真实多人入场未恢复。本片未修改正式模块，不构成普通联机或全生命周期验收；M2-03父保持开放。
