# 原客户端本机死亡计数与复活取消

M2-05有限切片：原`4376bb`死亡世界服务、`437626`计数回调和`436464`复活世界服务完整执行，72组原EXE夹具与共享`role-death-runtime-bridge.ts`的有序服务调用一致。覆盖当前客户端状态类型2/4/5、本机角色有无、死亡角色ID匹配/不匹配、角色状态0/2/3、三观察回调有无，以及回调计数5/1/0、空复活角色。共享适配器保留调度、取消与观察者边界，未接World或网页。

## 调用合同

- `423157(role,0)`的世界服务`4376bb`读取角色ID，和`globalGame+114 → +6c`账户角色ID比较。相等才向`globalGame+110`调度器`437446`传出`(key63547c, float1, serviceOwner, callback437626, 0, 5)`；不匹配直接返回。原argument0没有参与计数设置。
- `437626(n)`首先读取`globalGame+e0[globalGame+ac]`当前客户端状态对象virtual+4；只有值4继续。这是客户端状态类型，不是World房间玩法编号。随后经真实`4269c4`重新取得本机角色，角色不存在或其真实`43293d`状态getter为2时，仅发可选owner+68回调。否则先发可选owner+60回调(n)，然后n减1；非负时按同一key/owner/callback及float1再次调度。n=0仍通知0，随后停止调度，没有此处的+68完成通知。
- 状态2通知链中的`436464(role)`先经`4269c4`取当前本机角色；两角色存在且ID相等时，调用调度器`4041fb(key63547c)`，丢弃其float返回值，再发可选owner+64回调。匹配的是当前本机角色ID，与死亡入口所比较的账户角色ID保持不同来源。
- `4269c4`在当前客户端状态类型2时取manager+40对象内嵌+20角色，其他类型取manager+3c。该选择及角色ID/status getter在原测试中实际执行。

计数回调的1.0调度参数与初始5是原客户端服务参数。调度器更新、key的运行期字符串内容和观察者内部行为由调用者提供。

## 生产接线

`applyRoleDeathFollowup`的`worldDeath(role,0)`可调用`startRoleDeathRuntime(role, services)`；`dispatchRoleLifecycleNotification`的状态2 `activateRole(role)`可调用`resetRoleDeathRuntime(role, services)`。scheduler需绑定同一个key及owner，把到期参数交给`advanceRoleDeathRuntime`；`cancel`取消该key的所有待执行条目。`accountRoleId`来自账户角色ID，`localRole`每次读取当前本机角色；`currentStateType`应来自客户端状态对象的真实类型来源。生命周期角色状态可读已有RoleCombatState的记录状态，角色ID从其绑定记录读取。

现网页`Battle.render`通过快照alive调用`TankView.life`，死亡09/复活01已经执行；复活转换另调用skillEffects.revive。新增服务适配器独立于这些已有渲染动作。正式接入仍需确认客户端状态对象类型与网页场景的映射、三个owner观察者的绑定与实际控件行为，以及页面退出时原调度器取消/释放合同。

## 验证

- `recovery/.venv/bin/python tests/death-runtime-bridge-sol-native.py`：72组通过，输出`recovery/output/death-runtime-bridge-sol-native.json`。
- `npx tsx tests/death-runtime-bridge-sol.cts`：72组逐有序调用对照通过，输出`recovery/output/death-runtime-bridge-sol.json`。
- `npx tsc --noEmit`：通过。

原执行检测角色ID来源、状态类型门禁、动态本机角色查询、计数边界、调度参数及复活先取消后回调的顺序；共享对照失败时按原执行修正适配器。类型检查检测服务与角色接口不兼容。调度器437446/4041fb和owner三个观察者为观察替身；原413f60、4269c4、431d4d和43293d实际执行。

## 局限

此切片不包含调度队列内部执行、观察者控件、死亡渲染virtual+a8指令、服务488678完整执行或普通输入网页验收。原客户端计数不提供服务端复活授权、生命次数、复活HP、出生分组或队伍选点规则，M2-05完整验收仍待完成。
