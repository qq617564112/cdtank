# 类型2闪电动态挂点空间

对应M4-06/M4-07。生产`EffectRuntimeTree`现在把共享parent矩阵传给`EffectBoltNodeState`，每次原定间隔重建时读取当前矩阵。全部101源节点的505次原执行样本与生产源树逐值一致，覆盖端点、local/world分段、间隔余数和随机消费。

## 原执行依据

`tests/effect-sol-bolt-parent-native.py`映射原`CDTank.exe`、`gbengine.dll`和`msvcr71.dll`，执行原类型2重建入口`0x47e161`以及update入口`0x47e40a`。源资源来自`recovery/output/web-assets/effect-library.json`的全部101个type2节点，资源字节原样填入原对象。

`0x47dadc`读取node+0x20的parent矩阵。非零parent通过原IAT`0x5c09e8`调用DLL Transform，分别将resource+0x148/+0x154的起止端点变换为世界坐标；此分支不使用node+0x14世界启动位置。无target provider的结束端点也由相同parent矩阵变换。

原IAT`0x5c08f0`实际解析到DLL`0x10030030`，检查全部16个矩阵元素是否为零。零矩阵分支`0x47db04–0x47db10`清分段数量并执行原vector清理，保留已有起止端点且不消费随机值。随后parent恢复有效时照常重新生成。原update只重建一次并保留interval超额时间。

证据：`recovery/output/effect-sol-bolt-parent-native.json`同时保存逐条原指令及全部505个样本。每个节点连续经历identity、旋转平移、缩放平移、零矩阵、恢复identity，共享随机序列不在各样本间重置。

## 实现与验证

`apps/web/src/effect-bolt-node.ts`保留parent引用；重建时使用已恢复的原Transform加法顺序。零矩阵保留端点并清空两组分段。`apps/web/src/effect-runtime-tree.ts`为type2实例传入共享parent。

执行命令和本次结果：

```text
recovery/.venv/bin/python tests/effect-sol-bolt-parent-native.py
PASS: 101 source nodes / 505 attached matrix rebuild/update samples
npx tsx tests/effect-sol-bolt-parent.cts
PASS: 101 production source trees / 505 original attached bolt samples
npx tsx tests/effect-bolt-lifecycles.cts
PASS: 202 original lightning full source lifecycles
npx tsc --noEmit
exit 0
```

针对验证直接创建生产`EffectRuntimeTree`并逐样本修改同一parent数组。测试提供连续生命周期以隔离挂点重建行为；原202条world完整生命周期回归验证现存非attached行为。它们不构成M4-06/M4-07整项或技能对局完成证据。

## 局限

原storage分配由预留内存提供，CRT free只记录参数；原端点、矩阵、生成和update指令均执行。随机值由确定性供给接口提供，未复刻真实游戏完整随机调度。target provider保持为0，node+0x5c目标对象分支仍待恢复。测试未覆盖完整attached start、生命周期释放、heap所有权及D3D framebuffer；目前真实服务器技能通知入口仍未恢复，不能将生产源树测试计作真实技能战斗或原逐像素一致。

## Attached树绘制矩阵继承

原四棵纯闪电源树130、605、1940、1948按真实source child顺序构造，执行完整manager render入口`0x479192`、递归树render`0x47f011`、原type0/type2虚表和完整闪电draw`0x47d935`。共14个闪电节点，三种parent矩阵×两种进入manager前的gfx矩阵×两个相机，共168次真实绘制。原DLL GetMatrix/Push/LoadIdentity/Pop及最终triangle-strip vertex writer均执行，D3D buffer分配和submit使用记录接口。

全部source child的`0x47d56e`读取的是进入manager前的gfx矩阵，parent不会由manager或type0树render装入矩阵栈。parent已经在端点重建时应用。每次draw构建顶点后执行Push/LoadIdentity，在identity下提交，再Pop；每个兄弟节点及最终manager退出时仍保留原gfx矩阵和栈深度。这组结论只涵盖四棵纯闪电源树，未扩大到模型等其他类型父节点。

生产`EffectRuntime.draw`使用Web当前identity模型绘制矩阵，不再把tree.parentMatrix重复应用到已经变换过的worldSegments。底层`effectBoltDrawVertices`仍支持显式gfx矩阵输入。原168样本与该函数的顶点/UV/颜色逐值一致；其中identity gfx的84样本直接调用生产`EffectRuntime.draw`，检查实际Babylon mesh位置与UV、Web X反射及清理，最大绝对误差0。56样本能够检出重复parent变换。生产mesh检查采用NullEngine，不是浏览器framebuffer验收。

```text
recovery/.venv/bin/python tests/effect-sol-bolt-render-parent-native.py
PASS: 4 original source trees / 168 complete attached bolt draws; incoming matrix preserved, submit identity
npx tsx tests/effect-sol-bolt-render-parent.cts
PASS: 168 complete original attached draws / 84 production mesh submissions; max error 0; 56 detect repeated parent transform
npx tsx tests/effect-sol-bolt-parent.cts
PASS: 101 production source trees / 505 original attached bolt samples
npx tsx tests/effect-bolt-draw.cts
PASS: 606 original type2 ribbon / DLL vertices; maximum absolute error 0.000003814697265625
npx tsc --noEmit
exit 0
```

证据`recovery/output/effect-sol-bolt-render-parent-native.json`保存168组真实顶点和manager/tree/draw原指令。对象phase、controller、render enable及parent绑定由fixture供给，原树create/start不在此render执行范围；目标provider仍为0。本组未覆盖混合类型父节点改变gfx状态、原实际设备进入manager前的完整状态或D3D framebuffer。

## 完整attached节点生命周期

全部101个源type2节点经真实虚表`0x5c9ad0`执行attached start入口`0x47f065`、原类型2start`0x47e43d`、基础update`0x47f61c`与显式stop`0x47f3c4`。两种初始parent矩阵×自然到期/等待时停止/活动时停止三种路径，共606条序列，每条在同一原对象与共享随机序列上重复启动两次，总计8532个start/tick/stop操作。

真实start将node+0x20绑定到parent指针并进入类型2world start。测试逐tick改变共享parent，覆盖源delay一半及边界、持续平移、零矩阵与恢复、超寿命tick、结束后释放、停止后tick，以及结束后再次start。全部源timing原样使用，其中12个lifetime=0节点按原规则保持活动，最终显式stop；9个delay>0源节点覆盖真实等待与激活。全部type2源无controller，未补造controller或循环字段。

生产`EffectRuntimeTree`与原执行的phase/elapsed/controller、端点、local/world全部分段、interval余数、每操作共享随机消费及release事件逐值一致。原start/update/stop均执行，不再以人工phase/parent绑定代替本组节点生命周期。现有源码通过，测试无需改变生产行为。

```text
recovery/.venv/bin/python tests/effect-sol-bolt-attached-lifecycles-native.py
PASS: 606 source attached lifecycle sequences / 8532 start/tick/stop operations
npx tsx tests/effect-sol-bolt-attached-lifecycles.cts
PASS: 606 production source attached sequences / 8532 original start/tick/stop operations
npx tsc --noEmit
exit 0
```

证据`recovery/output/effect-sol-bolt-attached-lifecycles-native.json`保存全部操作状态。这组对象definition/geometry storage由fixture提供；managerrelease记录事件并将phase/clock置0，CRT free由无操作供给接口替代，未恢复heap/pool所有权。未配置children或target provider，不扩大为完整混合树或目标分支。前述四棵源树render证据与本组节点start证据分别验证，尚未将整棵树create/start/update/render组合为一条原oracle链路；D3D framebuffer及真实技能通知仍待恢复。
