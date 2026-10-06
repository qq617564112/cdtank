# 原库存记录传输格式

原文件CDTank/CDTank.exe。共同库存记录契约在apps/shared/protocols/PtlInventory.ts；原编解码入口在recovery/evidence/inventory/inventory-wire.ts。原记录构造43bcb5，写入42dddd，读取42e0b7。写/读直接调用原位流401c7a/401d58，整数来自x86 little-endian内存，位流以低位先行。

| 顺序 | 记录偏移 | 位宽 | 共享字段 |
| --- | --- | --- | --- |
| 1 | +4 | 32 | instanceId |
| 2 | +8 | 32 | field8（语义未定） |
| 3 | +0x0c | 16 | itemTableId |
| 4 | +0x10 | 24 | ownedQuantity |
| 5 | +0x24 | 32 | float24Bits（语义未定） |
| 6 | +0x28 | 32 | float28Bits（语义未定） |
| 7 | +0x2c | 32 | float2cBits（语义未定） |
| 8 | +0x20 | 24 | battleQuantity |

每条224位，字节对齐时28字节。写入超宽的整数会丢弃高位：ItemTableID低16位，两个数量低24位；读取前字段置零，不作符号扩展。+0x14、+0x18、+0x1c未传输，构造后均为0；state由后续查询/装备/状态通知更新。三个float字段的实际意义仍未确认，接口保留原始32位值，负零、无穷、NaN payload不经JavaScript数值转换。

## 原执行与取证实现对照

`npm run test:combat:inventory`包含1664次原构造/写/读往返，208物件ID（204源表ID加0、65535、65536、unsigned最大值）×8位偏移；数量覆盖0/1/255/65535/24位最大/超过24位/32位最大，float位值覆盖0、负零、正负1、无穷、NaN payload和最小subnormal。完整原位流、byte读写和容量推进函数均执行，没有读写回调替代。

取证encoder逐字节匹配原buffer，decoder全部字段逐值一致。另验证解码后的2001记录进入查询类别2，state仍0。证据inventory-wire-native.json；测试inventory-wire-native.py与inventory-wire.cts。

## 查询包候选与接入边界

虚表0x5c5328依次包含析构43f50b、类型getter43f3a0、reader43f42d、writer43f3cf。getter返回0x3c8f。reader先读packet+0x0c的32位字段，再读16位记录数，随后构造0x30字节库存记录并调用42e0b7、以实例ID插入树（42e702）。writer按树顺序用42dddd写记录。包字段+0x0c的业务语义及socket接收链仍待验证；完整包读写、有序树插入和取证codec现已完成原执行对照。已确认监听器构造43c0b4写入虚表5c4da4，虚表+c与packet虚表+4均指向43f3a0，返回3c8f；48baff按监听器虚表+c返回的数字类型注册，debug名称不是路由键。

本模块恢复原记录及下述完整查询/删除包体，未把原协议封装混入TSRPC，也未为账户填造初始库存。正式账户库存、快捷槽与治疗消费/CPU普通输入使用共同记录契约，原socket封装与全部原道具施放仍待对应tasklist恢复。

## 删除库存消息3c92

UMsgDeleteInKitbag监听器构造43c0f2写入虚表5c4dbc，虚表+c为43f5b7，返回3c92。其网络packet虚表5c5350的+4使用同一getter；+8 reader425ba6、+0x0c writer42571f均只传packet+0x0c实例ID32位，没有数量、成功标记或技能ID。取证encodeKitbagDeletion/decodeKitbagDeletion恢复这个包体，类型与包体分开，不猜测socket封装。

原listener clone43ca58构造callback虚表5c4f9c；setter48daa3把接收者放到callback+4；forward48b28c把+4与成员偏移+c相加作为ECX，再跳到callback+8的成员函数。1800完整案例执行原包writer/reader及位流、listener ctor/typegetter、clone/setter/forward，最终进入440fd7更新实际记录。覆盖实例ID0/77/unsigned最大值、位偏移0/2/7、两vector及数量边界。取证包体字节、解码ID、更新结果和观察器一致。分配callback内存及ItemTable由夹具供给，可选文字UI关闭；socket分发树查找未执行。

同一clone/setter/forward路径实际调用43ed18，12次查询各228记录的结果与共享保持一致，query listener和packet的typegetter均实测3c8f。数量通知不据此认定为使用请求3c9e的成功回包。

## 完整查询包3c8f

取证decodeInventoryQuery/encodeInventoryQuery恢复完整包体：fieldC32位、收到记录数16位、每条224位记录。原43f42d为每条记录执行构造/解码后，用42e702插入真实红黑树；无符号实例ID升序，重复ID保留首条，后续重复记录不覆盖。原43f3cf按唯一记录树大小写count、按树序输出。取证decode读取全部收到记录再保留首条并排序，encode也使用这一树语义。空库存包体为48位。

原inventory-packet-native.py实际执行完整包decoder/writer、42e793树构造、42e702比较/插入/重平衡、42de86迭代，以及全部记录和位流函数。仅578620原始内存分配由夹具供给，没有替换容器操作。40个完整包覆盖空/单条/204源物件/逆序/重复ID0及unsigned最大值，全部8位偏移；字段C覆盖0/77/max。取证完整解码字段、排序去重和规范化后的编码字节均匹配原程序，解码记录可直接进入applyInventoryQuery。证据inventory-packet-native.json，测试inventory-packet.cts，纳入test:combat:inventory。

该包体codec不含原socket帧封装、账号认证或库存持久化；fieldC沿用偏移名称。不能把完整包格式验收作为真实账户库存上线证明。

## E-04 真实库存链与工程所有权

InventoryWireRecord为共同协议类型，归PtlInventory并保持原InventoryItemRecord继承及字段；AccountStore、World及battle/player-state/start/attributes/healing、库存导入工具、role-battle-parts与业务CTS使用同一类型。真正双端inventory-query/item-hotkeys规则继续保留shared。原codec、常量、InventoryQueryPacket、排序/去重只供原程序验证，归evidence/inventory。没有旧shared副本或转发。

原wire/packet/notifications三native与三CTS迁入evidence/inventory，native ROOT改为新目录的parents[3]，oracle输出原路径不变。CTS引用同目录codec及库存删除取证，共同类型importtype PtlInventory。test:combat:inventory仍按原顺序执行迁移入口及真正共享查询/角色resolver/背包配置测试；正式运行不需要执行原二进制或codec。

生成协议25→26，只重命名InventoryWireRecord定义key与引用，继承链、属性ID、服务ID和类型保持一致。6组响应包含空库存、uint32实例边界、数量边界、状态及负零/NaN原位型、多记录/七槽，旧新编码字节一致且双向decode逐值一致（engineering-inventory-contract-proto-before.json、engineering-inventory-contract-wire-check.mjs、engineering-inventory-contract-wire.json/log）。

1664原记录、40完整树排序去重包、1800删除通知、12×228原查询、账户身份/隔离/七槽重启及正常World弹药、204物品类别/74被动选择、首局再战数量与普通道具/陷阱输入通过（engineering-inventory-contract-{evidence,rules}.log）。全仓类型和218运行模块边界通过（types/boundaries日志）。

集成验收继续检查两端独立构建、发行JS/map排除原codec、编译服务实际库存/配置/普通输入与重启保存、CPU五模式各两局、双网页AI自然两局/治疗Effect11与GA15/拥有迷彩/退出资源声音释放及重启库存快捷槽。本次全部通过：engineering-inventory-contract-{server-build,web-build,artifacts,compiled,two-rounds,browser}.log及独立engineering-inventory-contract-browser.json。304发行JS/map已排除codec并保留共同协议引用，双网页AI自然两局79219/57261ms、原Effect11/GA15/拥有迷彩、双方退出instances/voices归零、重启库存快捷槽与控制恢复通过。全部本片检查退出0，临时服务/Vite/Chromium已关闭；不代表完整原认证、全部道具效果或高清全资产性能已恢复。
