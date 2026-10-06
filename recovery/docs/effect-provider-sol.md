# 类型2目标provider世界端点与弱绑定

对应M4-06的一个有限切片：共享特效模块恢复类型2目标provider的世界终点、绑定替换、观察者失效与回退。三个真实源节点131、606、1941×无parent/identity/旋转平移/零矩阵，共12条原执行序列、168次操作，与生产组件逐值一致。

## 原执行来源

`tests/effect-sol-provider-target-native.py`映射原EXE、gbengine.dll和msvcr71.dll，以原source resource字节建立类型2对象。完整原`0x47d3eb`设置target，向children传播后经`0x474196`解绑旧观察者并绑定新provider。provider的观察者管理器位于+0x34；真实链表insert/remove代码执行，operator new/free由内存供给接口替代。

`0x47dadc`重建端点时：有有效parent则变换起点，没有parent则使用源起点加world origin。target存在时，`0x47db79`调用其virtual+0x1c；返回的是vec3引用。原`0x44ef01`仅传回该指针，随后复制三个float作为世界终点，不应用parent或origin。target缺失才使用源终点的parent变换或world origin加法。零parent矩阵在到达target读取前清空分段，不调用provider getter。

原provider观察者析构`0x44d8e8`遍历真实链表并调用每个观察者的虚方法；类型2绑定观察者虚表`0x5c93d4`指向`0x474317`，将binding+4即node+0x5c清零。下一次闪电重建使用源终点。原provider getter由明确供给接口返回动态vec3存储，未假称恢复实体自身的位置getter。

12条序列分别覆盖绑定A、读取、A移动、换B、旧A失效不影响B、B失效清绑定、源终点回退、重新绑定新A、显式解绑与回退。共享随机序列逐操作连续消费。证据`recovery/output/effect-sol-provider-target-native.json`保存原指令、绑定值、观察者数量、getter调用、端点、local/world分段和随机值。

## 共享实现与接入

`apps/web/src/effect-target-provider.ts`提供`EffectTargetProvider`动态position与失效通知，以及`EffectTargetBinding`替换绑定。每次替换先解除旧观察者，失效清空目标引用。`EffectBoltNodeState`使用原世界目标端点语义；原零矩阵分支先返回，provider缺失保持既有源终点行为。

`EffectRuntimeTree`增加可选末尾targetProvider参数，传给实际type2节点，结束释放或dispose解除观察者。现有调用不传参数，保持原生产行为。正式共享组件的三个真实child绑定/失效/清理验证通过；当前`EffectRuntime`尚没有提供实体目标provider的玩法入口，这组测试不计作战斗技能通知或真实实体目标效果验收。

## 验证

```text
recovery/.venv/bin/python tests/effect-sol-provider-target-native.py
PASS: 12 original target-provider sequences / 168 bind/move/invalidate/draw operations
npx tsx tests/effect-sol-provider-target.cts
PASS: 12 original provider sequences / 168 operations; production three-child binding/invalidation/disposal
npx tsx tests/effect-bolt-lifecycles.cts
PASS: 202 original lightning full source lifecycles
npx tsx tests/effect-sol-bolt-parent.cts
PASS: 101 production source trees / 505 original attached bolt samples
npx tsc --noEmit
exit 0
```

## 局限

原provider的位置virtual getter、operator new/free和geometry storage由供给接口提供；绑定/解绑、观察者析构遍历与失效callback、端点重建和DLL算术实际执行。未恢复具体原实体provider的创建/位置更新/销毁触发条件，未合并target与全部101源完整生命周期、混合树/heap所有权或D3D framebuffer。共享树可选target参数完成模块接入，实际服务器通知和实体绑定仍待接通；不能把provider缺失的旧生命周期回归或本组三节点样本称为完整provider恢复。
