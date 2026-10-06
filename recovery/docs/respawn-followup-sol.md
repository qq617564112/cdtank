# 原客户端死亡后续执行

M2-05有限切片：完整`423157(role,0)`与其实际生命setter/getter连续执行，72组原EXE样本及共享模块有序事件、状态一致。独立模块`apps/shared/combat/role-death-followup.ts`保留原调用边界，可作为`role-respawn-notification.ts`的`deathFollowup`服务；字段存储与渲染/世界服务由调用者提供。测试复用现有生产`setRoleHp`实现实际生命更新，未接World。

## 原调用链

`4259ae`状态3先执行角色死亡生命周期，发可选死亡回调与本机关系回调，再调用`423157(role,0)`。后者顺序为：

1. 角色virtual+24、selector15、value0 → 原`433250`写记录+54当前生命，通知12，再执行原下界/上界限制。
2. 管理器+74回调存在时，读取原selector15 getter`432417`及ID getter`431d4d`，回调(ID,当前生命)。
3. 读取角色绑定的宠物记录+2c；分类1向角色+310渲染对象virtual+a8发送`(0x77,3,0,1)`，分类2发送`(0x78,3,0,1)`，其他分类跳过。
4. `globalGame+11c`服务 → `4376bb(role,0)`。
5. 读取角色ID → `globalGame+128`服务 → `488678(ID)`。

角色为空时直接返回。记录为空时原setter不更新生命，也不通知12；可选管理器回调仍发生，ID和生命均为0。已存在的角色记录、绑定宠物与渲染对象在测试中明确供给。该函数不检查角色是否本机，也不重写记录状态；manager+74回调不以生命发生变化为条件，即使旧生命已为0仍执行。

原通知分派的生命周期与此后续调用是两个阶段：`432f50`将状态写3、清动作9/10/11及动作选择；生命归零发生在随后`423157`调用的setter，而非生命周期状态方法本身。原渲染死亡09入口及头像死亡回调来源保留在`tank-runtime.md`、`ui-runtime.md`，此处virtual+a8的额外指令参数按原值传出，未映射成09动作或声音名称。

## 验证

- `recovery/.venv/bin/python tests/respawn-followup-sol-native.py`：72组完整原死亡后续执行，通过。覆盖role/record有无、manager+74回调有无、宠物分类1/2/3与原生命0/73/350；实际生命setter、生命getter及ID getter均执行EXE代码。证据`recovery/output/respawn-followup-sol-native.json`。
- `npx tsx tests/respawn-followup-sol.cts`：共享死亡后续模块结合现有`setRoleHp`与原执行有序事件/状态逐项对照，通过。证据`recovery/output/respawn-followup-sol.json`。
- `npx tsc --noEmit`：共享接口及测试类型检查通过。

原执行与对照检测归零/通知时序、宠物分类分支、回调参数及后续世界服务顺序，失败时按原执行结果修正模块。使用明确原执行内存夹具；没有启动或替换3001/5173、没有玩家战斗位置/HP/结果注入，也不是普通输入网页验收。

## 局限

记录通知、manager+74回调、渲染virtual+a8及世界`4376bb/488678`内部为观察替身；原role+2bc的可选生命变化观察者未绑定，该setter的完整变化回调已有`combat-field-inventory.md`及`role-health-native.json`证据。宠物指令0x77/0x78的完整渲染语义仍待恢复。客户端死亡后生命清零不证明服务端伤害、生命次数、复活条件/间隔或复活HP规则；出生分组与队伍选点仍未恢复，M2-05保持未完成。
