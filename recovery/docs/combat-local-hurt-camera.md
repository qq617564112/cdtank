# 三部件本机普通受击相机

普通三部件角色本机受击现在触发原眼点抖动，参数`1,0.5,10`。四部件角色和远端角色的受击不触发此调用；原动作、声音、伤害及相机跟随保持其现有合同。

原`46897a`派发05–08后调用`4269c4`取得本机角色，与actor`+258`比较。仅相同角色取得当前相机并调用virtual`+18`。原第三人称相机vtable`5c6dd0+18`指向`4556e2`；其duration为0.5秒、strength为10，parameter1改变eye。四部件`46c396`没有该相机分支。`combat-local-hurt-camera-native.json`的32序列执行两种状态模式、四selector及本机/远端三/四部件入口，真实执行`4269c4`、`4556e2`和`45573f`，相机状态与调用均匹配。动作应用、角色field15、状态模式与active-camera选择为供给边界。完整相机更新与随机消费复用既有90激活/540更新原oracle。

`TankView.usesThreePartActor`按原U组件动作是否为空识别三部件结构。`BattlePlayers.hurt`在存在存活角色及合法selector时派发原动作并返回三部件资格；`Battle`只对当前本机目标调用`EffectRuntime.ordinaryHurtCamera`。该消费者使用已恢复的`EffectCameraShakeView`，自然更新及round/Leave清理共享既有相机生命周期。

## 实际双端

`browser-combat-local-hurt-camera-2026-10-04T05-50-15-720Z.json`和独立`combat-local-hurt-camera-actual.json`均PASS。独立`/validation.html`诊断入口正常认证建房、加入、添加两CPU及Ready，host151/guest001进入map7/mode4四人战斗。原151角色记录在入场前以账户fixture供给，战斗后未注入位置、伤害、相机、clock或事件。默认minimum为map7/mode4原规则1，四名实际玩家未改门槛。

| 观测 | 本机151网页 | 远端151／本机001网页 |
| --- | --- | --- |
| 相同普通151 selector2命中 | 4 | 4 |
| 普通hurt相机激活 | 4，原参数1/.5/10 | 0 |
| active实际渲染帧 | 8 | 0 |
| 实际view相对未抖动base的最大矩阵差 | 5.2357177734375 | 0 |
| 普通四部件角色命中事件 | 14 | 同房普通接收 |
| 自然恢复base view | PASS | 始终base |
| 原75秒自然TIME_LIMIT、同R6再战round2 | PASS | PASS |
| round清理active/elapsed | false / 0 | false / 0 |
| Leave玩家／树／网格／三类音源／相机active与elapsed | 全0 | 全0 |

实际view直接读取渲染相机矩阵；base由同一未改写的camera.position、target、up独立计算。原抖动只替换view，未改变这些base字段。保存的两帧PNG是正常渲染循环图像，不能由一张静态图单独证明运动；逐帧矩阵及原pose记录证明真实相机变化和自然恢复。

命令：`recovery/.venv/bin/python tests/combat-local-hurt-camera-native.py`；`node --import tsx tests/browser-combat-local-hurt-camera.mjs`；`recovery/.venv/bin/python tests/combat-local-hurt-camera-actual.py recovery/output/browser-combat-local-hurt-camera-2026-10-04T05-50-15-720Z.json`。Web类型检查通过。专属3312/5342/9542与临时目录已清理，见`combat-local-hurt-camera-process-cleanup.json`。

## 限制

普通输入和正式Battle/render消费者通过独立诊断页面验收，不代替正式大厅页面资格。632×360软件渲染图像不证明原Windows整帧GPU像素或高清性能；原三部件受击动作混合仍归M3-04父项。
