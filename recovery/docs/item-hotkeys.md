# 原库存与战斗快捷槽

Web数字键1–8发送一次`PlayerInput.useItem`快捷槽请求，长按重复不发请求；聊天等输入控件保留输入焦点。CPU开局通过同一普通输入选择默认弹药。服务端先核对比赛阶段、输入序号及存活状态，再处理快捷请求，`selectedAmmoSlot`随权威快照同步。0/1都使用默认弹药，现有普通弹丸规则保持。

## 原指令依据

原`0x4cb2f5`分派以游戏controller存在为前提，无controller返回false。槽号按unsigned1–8检查，范围外返回true且无动作。槽1请求`0x426419(1)`；槽2–8读取角色array0中的`array[slot-2]`库存实例ID。角色缺失返回false，数组或记录缺失、实例ID为0返回true且无动作。

`0x43d186`先搜索manager的vector+0x10，再搜索vector+0x20；`0x43ccac/0x43cccf`比较record+4实例ID。record+0x0c是ItemTableID，+0x10是拥有数量，+0x20是本局可用数量。+0x1c由`UMsgChangeItemState`更新，不作为数量字段。

可用数量为0时原UI消息ID28、flag1，返回false。槽2–4用原`0x43bd13→0x439762`的ID区间分类：类别3调用弹药选择，类别4以实例ID请求陷阱放置`0x43d5f3`，其他类别无动作。槽5–8以实例ID调用普通使用`0x43d4dc`，不再按类别筛选。外层分派不采用这些请求函数的返回值。ID区间分类与ItemType表值独立，例如12501分类7。

原`0x43d2e3`只对七个已指定且可找到的记录设置`battleQuantity=min_unsigned(ownedQuantity, ItemTable+0x104)`；+0x104为列26 BattleUseMax。记录外的数量保持不变，拥有数量不减。默认ItemTableID2001对应ItemSkill1/2的2001/4020；不能把所有物件ID视为技能ID，也不能仅凭默认物件推定被动技能装备。

## 验证

`npm run test:combat:items`在原EXE执行4936次完整快捷槽分派及56次数量初始化，使用实际库存搜索和ID分类，供给角色数组、ItemTable存储、UI及请求回调；共享逻辑逐值一致。覆盖204源物件、全部8槽、数量0/1/unsigned最大值、两个库存vector、缺controller/角色/数组/记录、空槽和越界槽。此测试不执行原传输或服务端道具消耗。

同一入口检查World等待期、旧序号、空库存槽、默认选择、另一角色隔离及无额外开火/计分。`npm run test:network`通过独立真实TSRPC客户端核对默认选择与普通移动/开火同时到达另一端，空槽不改变选择。`npm run test:cpu`五模式核对CPU普通快捷输入及完整对局生命周期。

`npm run test:combat:items:browser -- <CDP地址>`用1920×1080真实页面和独立真实服务端验证Digit键、聊天焦点抑制、长按重复抑制、空槽不变、默认选择、CPU自主自然计分和退出。证据browser-item-hotkeys.json，未注入库存或战斗状态，不证明渲染性能。

## 待恢复

当前服务端的库存来源尚未实现，array0初始化为空；线上可使用默认弹药选择，其他槽不会获得虚构物件。已恢复的库存数量初始化和非默认请求分派通过原指令夹具验证，尚未成为真实消耗品业务。完整库存/装备供给、槽位配置、使用请求的成功回包、消耗及状态变更、陷阱许可role+0x309、原装填属性重算和实际技能施放仍待恢复。Skill12「扫光光（扫把）」→Effect19的type5生产模型已可渲染，真实技能触发需这条业务链。

库存查询分类、装备状态和删除通知已恢复到共享模块，原执行对照入口`npm run test:combat:inventory`；依据见inventory-query.md与inventory-notifications.md。真实账户供给及施放传输仍待接通。
