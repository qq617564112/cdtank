# type10屏幕后处理原对象

原type10四个source的生命周期已恢复：start调用SYcScreenEffect::Select(5,0)，end调用Clear。供给后处理backend的原生命周期对照通过；实际index5对象在当前二进制中尚未找到。

`effect-postprocess-manager-native.py`执行原SYcScreenEffect构造(0x4854c4)与Select(0x485484)，供给actor registration、allocator和render-target/device构造。构造写入vector begin／end／capacity(+0x3c／+0x40／+0x44)均为0，selected(+0x20)为-1。Select(5,0)先clear，再在0x4854a9读取begin+5×4，即地址0x14。fixture在该原读取指令处停止，未供给任何子效果。

vtable(0x5c9e70)的create(0x485560)返回true，update(0x46888b)返回true，render(0x485459)直接从所选vector项调用virtual+8，下一方法(0x49cc05)直接return。没有这些初始化回调创建index5对象的代码。全EXE executable section的singleton global(0x6d2958)只有getter内的一次写入／一次读取；getter(0x4855ec)只有两个直接call，分别来自type10 start(0x47ee9a)与end(0x47eea7)。class vtable与factory name只被构造与getter注册引用。

生产`EffectRuntimeTree`保留type10节点及原start／end backend调用。生产已采用每 scene 唯一的 Web 屏幕效果 backend：`legacy-screen-effect.ts` 绘制常量全屏 25% 黑遮罩作为明确可见的采用反馈，`EffectScreenNodeState` 每次 type10 activation 生成 owner 并调 `selectEffect(5,0,owner)`，`end` 以当前 owner 调 `clearEffect`；replacement 先释放当前 overlay 再建新 owner，非当前 owner 的 clear 为 stale no-op，`EffectRuntimeTree.dispose`、`EffectRuntime.clear` 与 scene dispose 分别 end/clear/dispose，尺寸变化按 render 前 resize 重提交。四个type10与30个type11全source／306tick现均通过生产tree对照。没有为原空列表填充原后处理，也没有把backend调用对照作为原像素绘制验收；该遮罩不是原像素等价。

四个source位于other\\1000\\11014、11007、11008、11013的旧效果分支。当前skill.dat的342条技能记录有51个Effect1／2／3数值(含0)，按原_root\\online\\%03d根名收集全部source后代并遍历实际child ID可达371个节点，type10数量为0。当前技能表未引用这四个旧type10分支。type5 online019对应当前SkillTableID12「扫光光（扫把）」、TriggerType1、Target1、Effect1=19。

下一步需要找到原运行时index5的实际注册来源或额外实现。证据保存于`recovery/output/effect-postprocess-manager-native.json`。
