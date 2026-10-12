# 普通战斗表现来源

现有M4-09原角色与世界效果生命周期中，`M4-09-LOCAL-FIRE-CAMERA`三部件本机普通开火相机后坐已完成正式消费者和实际双端验收，见`combat-local-fire-camera.md`。

| 表现 | 原来源 | 正式普通入口 | 缺口 |
| --- | --- | --- | --- |
| 三部件本机普通开火眼点抖动 | `468a53`派03后比较`4269c4`返回角色与actor`+258`，仅本机调用相机virtual`+18(1,float32 .2,10)`；原常量`5c4794=.20000000298023224`、`5e68c8=10` | 正常fire→BattlePlayers.fire→TankView03→原004/GA07 | 已接普通fire本机/源三件gate→ordinaryFireCamera；actual view、原004/GA07及roundLeave清理PASS。四部件`46c42e`仅派03，不调用相机 |
| 原角色画面生命条 | `465b62`读actor`+29c`缓存HP，role getter16读最大HP，再绘actor`+260`对象；`465b92/465ba8`按原.34/.67选红/黄/绿，actor`+25c`提供背景 | 普通hurt已通过`464bed`更新HP缓存；网页HP仅进HUD | 唯一待取入口是原actor`+25c/+260`资源对象初始化producer；资源及完整绘制资格未闭合，不能将HUD图移作此原角色图 |

`projectile-sol-shot-native.json`保存完整三/四部件Shot动作dispatcher，但其`4269c4`返回0，未执行本机开火相机分支。`combat-local-fire-camera-native.json`已补16序列本机caller至真实`4556e2`，并验证priorhurt状态被fire替换不叠加。双端普通fire、本机实际view后坐、远端及四部件静默、原炮口绘声、自然恢复及死亡/复活/再战Leave限定验收已PASS。

受损烟雾与独立残骸未有现成完整触发合同；已有死亡09和ELK006不作为独立残骸创建来源。以上生命条资源producer缺口保留，未据原缓存生命字段推断低血烟雾触发。
