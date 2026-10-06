# 普通射击通知的原执行入口

`tests/projectile-sol-shot-native.py`执行完整422f25→42282e→464e53及三/四部件派生开火入口468a53/46c42e。384组覆盖角色存在/缺失、本机/远端、角色状态0–3、绘制对象存在/缺失、当前动作0/2/9和actor+19c门禁。6组完整4647df覆盖动作完成观察者有/无及roleId0/73/ffffffff。证据为`recovery/output/projectile-sol-shot-native.json`与同名log。

422f25按message+c查角色；缺失或本机角色直接退出。42282e对角色状态3、缺绘制对象和绘制对象当前动作2直接退出；其他情况通过角色virtual+4取得对象ID，调用actor virtual+84。三/四部件该槽均为464e53：actor+19c为0时调用virtual+3c，随后保存对象ID到actor+298。派生virtual+3c分别为468a53/46c42e，均派发动作index2、flags4，即原03动作；门禁打开时不派发也不替换对象ID。全部原角色记录保持不变。

actor+298不是弹速或寿命。完整4647df在actor+2a0观察者存在时，以保存的ID调用观察者virtual+8，回调期间ID仍保留，回调之后清零；观察者缺失时保留。三/四部件更新的468f35/46c885调用这一函数。此处恢复的是射击动作来源和完成通知。

原注册42b817–42b849将422f25绑定到UmsgPrNotifyBeforeShot；42b862–42b894将4245c9绑定到UmsgPrNotifyShot。4245c9对远端角色把message+14/+18/+1c转发到423956→489ba8的瞄准显示，并调用423092。489ba8通过item+10c（原439b55加载器映射ItemSkill2）选择skill，普通2001为4020/世界007/SE30，再格式化`_root\online\%03d`世界效果名称。该调用不证明创建弹丸实体。自由瞄准4288fe/3a9b已有独立证据，本次未重新实现。

普通item2001的ItemSkill1/2为2001/4020；skill2001为炮弹属性，skill4020为小型爆炸特效。源item/skill列均无弹丸Velocity/Lifetime字段；现有verified表目录没有Bullet表。完整相关表行与列保存在本次原执行证据tables段。动作ELK的attack1→online004和tag_efattack已有特效恢复证据，它证明视觉挂点，尚不证明权威弹丸起点。

| World参数 | 本次原执行结论 |
| --- | --- |
| 速度360单位/秒 | 未取得弹丸创建/更新赋值依据，保持原型 |
| 寿命2.2秒 | 未取得弹丸终止依据，保持原型 |
| 水平炮口30/高度20 | 未取得弹丸出生坐标依据；不能用视觉tag_efattack替代 |

执行命令：

```sh
recovery/.venv/bin/python tests/projectile-sol-shot-native.py > recovery/output/projectile-sol-shot-native.log
```

该验证用于区分射击动作、视觉世界效果和弹丸实体：若原执行产生其他字段或调用，需修正入口解释及下游追踪。本次完整入口与记录保持断言通过；参数证据不足以替换World原型值。

## 剩余范围

真实弹丸创建/更新入口、速度/寿命/出生点仍未定位。最小未闭合来源是actor+2a0观察者的非零绑定及其virtual+8末端业务，或独立弹丸创建/更新入口；Shot/BeforeShot的完整codec与接收分派已恢复，但没有弹丸运动字段。不能仅凭消息名赋予弹丸实体语义。权威发射、轨迹、碰撞与技能影响仍属M2-04未完成范围。

## Shot/BeforeShot完整消息载荷

原BeforeShot监听器虚表5c2d80：factory42c94a经4138e8申请16字节，真实402289安装基础头，最后安装消息虚表5c3cb8。type getter42c9b4返回3ac7。body+c角色ID未初始化；两种分配种子aa/55均原样保留。writer42571f只写roleId32，reader425ba6先清零目标DWORD再读32位。

原Shot监听器虚表5c2d98：factory42ca44申请32字节并调用完整42ca90；消息虚表5c3ce0，type getter42cbaf返回3aa2。constructor只清零body+14/+18/+1c的XYZ；body+c角色ID与+10物件ID保留分配种子。共享create函数以缺失identifier表示尚未初始化，不给它们赋默认0。

writer42cadf依次写XYZ各32位原始float、roleId32、itemId低16位，共144位LSB-first。reader42cb4f按同序先清每个目标再读取，itemId目标为DWORD，因此解码后高16位为0。BeforeShot为32位。它们是载荷，不包含外层消息header。

`apps/shared/combat/role-shot-notify.ts`恢复两种create/encode/decode合同。4组完整factory/type与416组真实codec覆盖roleId0/73/80000000/ffffffff、itemId0/2001/12345678/ffffffff、三组XYZ与八种位对齐，源writer、reader和402289实际执行，仅供给分配器。共享编码逐byte、解码逐字段匹配；消息名与此前handler对应关系由原监听器虚表确认。测试亦核验不完整共享载荷拒绝，避免把截断消息变为完整通知。

```sh
recovery/.venv/bin/python tests/projectile-sol-shot-wire-native.py > recovery/output/projectile-sol-shot-wire-native.log
npx tsx tests/projectile-sol-shot-wire.cts > recovery/output/projectile-sol-shot-wire-suite.log
npx tsc --noEmit > recovery/output/projectile-sol-shot-wire-types.log
```

全部通过；原执行记录为projectile-sol-shot-wire-native.json。两类identifier构造缺失、float32取整、itemId低16位及任意byte内对齐均明确验证。完整codec不证明原服务器弹丸创建、速度/寿命/炮口或消息socket生产接入；M2-04参数剩余范围不变。
