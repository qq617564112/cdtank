# Actor目标provider的具体来源

M4-06有限切片确认三类actor共享的真实世界中心getter、位置更新和观察者基类构造/析构。三个原闪电源节点×四种parent状态，共12序列、168操作与共享生产provider实现逐值一致。现存动作记录没有调用目标分支的bindingMode4，正常战斗目标接入尚缺原目标赋值来源。

## 具体actor接口

actor虚表`0x5c8468`、`0x5c8688`、`0x5c88c8`的virtual+0x1c均为`0x464836`，返回actor+0x180的vec3引用。原三部件actor更新`0x46910b–0x469158`写入该中心为`[actor+0x28, actor+0x2c + actor+0x16c, actor+0x30]`，即世界位置加Y方向height。它不同于挂点矩阵translation，也不能直接用Web root位置代替。此段原指令执行包括f32写回，getter执行真实虚表调用。

actor基类构造`0x46437e`调用实际观察者管理器构造`0x44d8b6`，初始化actor+0x34的链表。派生actor析构`0x468487–0x468489`进入基类`0x4643c7`，后者执行真实`0x44d8e8`遍历观察者并调用闪电弱绑定callback。测试实际执行完整基类构造和析构；派生类其余资源初始化/释放不在本组运行范围。

`tests/effect-sol-entity-provider-native.py`使用这组基类构造/析构和具体actor虚表，替换此前供给位置getter。源节点131、606、1941各覆盖无parent、identity、旋转平移与零矩阵，执行真实闪电绑定/换目标、actor中心更新、目标销毁、回退和重新创建后的绑定。全部端点、local/world分段、观察者数量、随机消费和getter调用与共享`EffectTargetProvider`/`EffectBoltNodeState`逐值一致。几何storage、operator new/free由供给接口替代。

## 动作链输入来源

原actor动作更新`0x468f3a`/`0x468fea`及四部件`0x46c88a`/`0x46c93a`将actor+0x214作为第二参数传入virtual+0x4c=`0x4675a1`。只有记录bindingMode4才在`0x467736`将该参数传给manager`0x47b322`；后者先以root virtual+0x40传播目标，再用原挂点矩阵attached start。

actor初始化`0x468656–0x468667`将+0x20c/+0x210/+0x214清零；本组真实执行该初始化片段并验证。当前已发布23个ELK动作记录bindingMode只有0和3，没有4。现阶段未证实actor+0x214何时被设置为具体非零实体，因此不能把getter类别兼容视为实际战斗目标类别已恢复。

`EffectRuntime`要沿此原动作入口接目标，至少需要确认动作记录mode4、当前actor+0x214对应的目标实体、该实体的世界中心高度及生命周期，以及原挂点名称共享矩阵。现有消息的action/event identifier只解决记录选择；仅凭玩家ID或root位置补入target会丢失这些原语义。当前source无mode4记录，本轮不新增未使用API，不改玩法入口。

## 验证

```text
recovery/.venv/bin/python tests/effect-sol-entity-provider-native.py
PASS: 12 original actor-center provider sequences / 168 bind/move/invalidate/draw operations
npx tsx tests/effect-sol-entity-provider.cts
PASS: 12 original actor-center provider sequences / 168 operations; production three-child binding/invalidation/disposal
recovery/.venv/bin/python tests/effect-sol-entity-provider-source.py
PASS: 3 concrete actor getter vtables; actor target initializes0; 23 source action records, mode4=0
```

证据为`recovery/output/effect-sol-entity-provider-native.json`及`effect-sol-entity-provider-source.json`，保存真实接口指令、完整原节点状态和实际记录数量。生产对照继续使用已有共享provider和真实源树三child绑定/失效/清理，没有新增生产API。

## 局限

完整派生actor创建/更新/销毁未执行；位置更新只执行已明确的原中心写入片段。原动作+0x214非零赋值条件仍缺，当前源没有mode4记录，实际`EffectRuntime`实体目标通知入口尚未接通。目标实体高度的生产来源、全部目标类别、全101节点target生命周期、混合树与D3D framebuffer继续恢复；不能将本组具体接口对照称为实际目标技能对局。
