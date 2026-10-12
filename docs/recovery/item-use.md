# 原道具使用、陷阱许可与计时

共享item-use.ts恢复43d4dc普通使用和43d5f3陷阱请求。它们只产生请求，不能判定服务端成功或直接扣量。请求包constructor43c7bd写入vtable5c4f88/type3c9e；调用者写入packet+c实例ID，packet+10/+14没有在此处初始化，其意义/初始值仍未证明。

共享item-use-wire.ts恢复原writer43c7f0/reader43c83d包体：实例ID32位、packet+10未知unsigned32位、packet+14布尔1位，共65位，类型独立路由。writer将非零byte归一化为1，reader输出0/1。384样本执行原读写和真实401c7a/401d58位流，覆盖8起始位偏移、0/77/max实例、32位未知字段和原byte0/1/2/255；共享字节与字段逐值相同。证据item-use-wire-native.json，纳入test:combat:use。字段必须显式提供，不补造默认值或坐标含义。

## 普通使用43d4dc

缓存角色存在、43293d角色状态为2、两库存vector中首匹配实例存在、本局数量unsigned非零才可发送。分类439762为4时另需role+309 byte非零，调用432b78先清零该字节，再构造/发送请求。其他分类不受陷阱许可限制。普通使用不要求实例配置在快捷槽，也不检查此处的scene或引擎mode。原send返回值不影响普通使用最终true；true表示已发请求。

## 放陷阱43d5f3

引擎virtual+4需返回4（不是房间玩法编号），缓存角色/array0存在且七槽之一包含实例ID、两vector实例存在、分类必须4。随后需game+124对象的+60场景存在、game+118 controller非零、本局数量非零及role+309非零。先清许可，再构造相同请求。没有检查角色状态，原函数也没有稳定布尔成功返回；共享入口为void。

## 许可恢复与role timer43210e

原初始化431cf0写role+309为1，431cf7写+30c浮点3；432b78只清字节，不重设倒计数。共享RoleCombatState保留trapPermission=1/trapCountdown=3。advanceTimers采用原传入float32：许可0且倒计数>0时做减法、存回f32，未舍入结果<=0才恢复许可1并把倒计数重置3。许可非零时不减倒计数；开始即为0的倒计数不在此函数恢复。

原角色控制器42b563从422f0d取得相对秒时间，在42b59f–42b5a3计算差值并存f32；负差值归零。42b5f8–42b604把该float传给role vtable+40；两种原角色表5c2c68/5c41f8均指向43210e。422f0d调用40607b并减实例double+30，40607b的QPC分支为counter/frequency，故此处陷阱初始3的单位为秒，不是技能通知update的30Hz整数步。原QPC取值边界供给，实际422f0d/40607b执行三个样本验证秒商及相对epoch；虚调用字节校验。World在每个PLAYING模拟步对角色调用advanceTimers(dtSeconds)，真实服务端fixture验证3秒许可恢复及flag8过期。截止点保留原f32逐步算术，不要求固定第60tick恢复。

同一原timer还更新flag8：剩余时间>0才减，未舍入结果严格<0时清flag8并通知33；恰好减到0会保留flag。共享实现保留这个与陷阱不同的零边界，不能统一改成<=0。

## 验证与接入边界

`npm run test:combat:use`执行1308次原43d4dc/43d5f3，包括204源物件、两vector、数量0/1/max、各角色状态、许可0/1/255、缺角色/数组/分配/记录/场景及引擎mode。真实状态getter、搜索、分类、清许可、packet构造/析构和SEH执行；角色/数组/mode访问、发送及日志边界供给。原send观察到已清许可，共享请求回调和状态逐值相同，拥有/本局数量保持。

另执行108原43210e及嵌套431dbf样本，对照flag/倒计数/许可/通知和精确零边界；原初始化字节校验。共享组合请求→许可拒绝→计时恢复→再次请求通过，不消耗记录。证据item-use-native.json、role-item-timers-native.json。

真实账户库存与七槽已接入World。dispatchItemHotkey沿原分派、库存分类和许可产生TSRPC itemRequest事件，不提供未知原包字段默认值。房内Inventory返回实时角色数量。test:combat:item-input验证开局数量边界、未分配记录、陷阱重复许可拒绝及计时恢复、普通输入序列拒重，全部请求不扣量。World模拟步已修复忽略CPU updateInput返回事件的问题：CPU请求现在加入step事件流供正常广播；三CPU显式绑定fixture库存、仅替换普通键选择且保留BotController移动/开火输出，验证普通道具与陷阱请求、三身份/房间、重复陷阱拒绝、库存不消耗。证据cpu-item-events.json/log，npm run test:cpu:items；npm run test:cpu五模式各两局与npx tsc --noEmit通过（cpu-item-events-regression.log、cpu-item-events-types.log）。该准备测试本身不证明CPU自主选择道具、权威施放或消费；后续饲料实战证据见healing-item-runtime.md，M1-11仍未完整完成。普通饲料物件1/2目前已接明确的重建服务端自用恢复/成功消费事务及CPU自主普通输入，详见healing-item-runtime.md；其他物件仍仅请求。原成功回包/FuncType2/未知字段含义仍待恢复，不能把客户端许可组件验收计作完整原施放。

## 未知请求字段的原执行证据

item-use-request-fields-native.json执行普通使用/陷阱共八个真实构造与调用样本，预置packet+10/+14后观察发送：0、0x11223344、0xffffffff、0x80000000和byte0/1/255/165均原样保留。43c7bd构造、43d4dc/43d5f3调用及413e8c发送没有为它们产生已证实的初值。原virtual+4的44294f实际返回4，证实陷阱门槛是活动游戏引擎状态。字段下游意义仍未知，M1-08保持未完成。

## 原序列化出口

item-use-send-native.json继续执行真实43d4dc/43d5f3、43c7bd、413e8c、402350/402090及43c7f0/401c7a，仅在socket virtual+18供给发送回调。八个样本输出type3c9e的16位type、16位身份、65位包体，共97位/13字节。packet+10仍原样进入位流，packet+14只由writer非零归一化；序列化前不存在已证实的默认值赋写。item-full-send-gates.log通过原许可、计时与384包体回归。服务器如何解释未知字段仍缺证据。原饲料1/2的八个请求监测样本只读取角色状态，不读取HP/技能/目标，也不扣量；已找到4363db Target过滤只经分类3弹药解析，不能证明分类1饲料自用或FuncType2成功条件。342加载/被动predicate、4解析、12Target过滤原执行证据与具体调用入口见healing-dispatch-sol.md。

## 库存接收消息注册

`tests/item-listener-registration-native.py`执行完整原构造4423ae、16个监听器构造/type getter、注册48baff及真实红黑树初始化、插入和查找；仅供给分配578620与进程退出析构调度57aa66。执行33个相邻类型查找、第二管理器复用已初始化静态监听器，以及16次重复注册；两棵树均保留16项，重复注册不分配节点。证据item-listener-registration-native.json，纳入`npm run test:combat:use`。

| 类型 | 原名称 | 回调地址 |
| --- | --- | --- |
| 3c8f | UMsgQueryItemsResult | 43ed18 |
| 3c92 | UMsgDeleteInKitbag | 440fd7 |
| 3c91 | UMsgMoveItemToKitbag | 43bf59 |
| 3c9a | UMsgCancelItemHotkey | 43bfd2 |
| 3c96 | UMsgDiscardItem | 441155 |
| 3ca9 | UMsgDiscardTreasure | 44233c |
| 3c98 | UMsgPickupItem | 441382 |
| 3caa | UMsgPickupTreasure | 44162c |
| 3ca0 | UMsgDeleteGroundItem | 441e13 |
| 3cab | UMsgDeleteTreasure | 43dab8 |
| 3c99 | UMsgUpdateAllItems | 423881 |
| 3ca2 | UMsgAloneItems | 423881 |
| 3ca3 | UMsgDeactiveSceneItem | 423881 |
| 3ca4 | UMsgActiveSceneItem | 43d1d0 |
| 3ca5 | UMsgChangeItemState | 43d766 |
| 3cac | UMsgShowTreasure | 423881 |

3c9e在此管理器的原树查找返回end节点，没有注册监听器；这里不能取得未知field10/field14的接收语义。该结论限定为4423ae注册的库存管理器，不证明其他管理器或已丢失的服务端如何处理3c9e。3c92仍只证明独立扣量通知，尚无请求与成功通知的对应条件。M1-08保持未完成。

## 通用接收入口与库存转发

`tests/item-receive-chain-native.py`执行原transport构造403096、静态管理器43bead/4423ae，以及完整库存构造43e8a1。后者将16个监听器通过原枚举器与注册函数402ec8装入game+bc和game+d4对应的两个真实注册树；回调clone、所属对象绑定与树插入均由原指令执行。

原接收virtual wrapper4038d5进入4027c3，用真实401d58读取type16/identity16。40266a通过40260b查注册树；找到后调用监听器factory创建包、把接收metadata写到packet+4、identity写到packet+8，再调用packet reader与绑定的业务回调。3c92路径实际执行425ba6、48b28c和440fd7，随后执行原析构43f605与池回收416f5e。

两transport各输入前轮item-use-send-native.json的八个实际13字节3c9e发送包，共16例；均仅读取32位头部，未调用3c9e reader43c83d、未分配包对象、未改库存。另输入12个3c92包：identity0/1234/ffff、匹配实例77/未匹配实例88；均读取64位，identity/metadata及回调context/connection逐值保持，匹配实例拥有5→4、本局3→2，不匹配不修改。包析构后返回16字节对象池，后续跨transport复用同一包地址。证据item-receive-chain-native.json与item-receive-suite.log，纳入test:combat:use。

供给边界为分配/释放、退出析构调度、logging、critical section、GetTickCount和可选ItemTable描述查询；没有替换包codec、消息查找、factory、转发或数量更新。此验收覆盖通用入口与库存管理器的两transport注册，不覆盖其他管理器、Winsock I/O或原服务端成功条件。原客户端可独立处理3c92，但当前证据不能把它与先前某个3c9e绑定为成功回执。
