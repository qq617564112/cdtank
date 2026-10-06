# 首件付费饲料的定义与表现

空库存账户付费取得的新实例，仍由`itemTableId=1`选择原物件定义：D2图标1、技能1、首槽Effect11/GA15/Tag0/Method3。实例ID只用于归属、快捷槽与持久消费，不参与图标或技能定义选择。

`tests/feed-purchase-effect.cts`从空库存开始，显式导入原角色资料夹具并设置已归属余额金钱100、星币100；两次真实SQLite购买分别支付金钱10、星币20，新增实例1与2，余额90/80。实例2的目录ID仍为1。配置槽4后，普通Digit5解析为实例2请求，正式`applyHealingItem`经账户CAS扣减数量2→1、生命50→250，实例1数量保持1。产生正式技能1首槽通知，沿`BattleSkillEffects → createSkillEffectNotifications → EffectRuntime`播放。

原表`item.dat`的D2=1、ItemSkill1=1、ItemMoney=10、ItemCoin=10与发布目录一致。正式库存页面按目录定义生成`set:daoju0 image:data\ui\daoju\00001.tga`；原DDS imageset对应已发布`ui/regions/57/0.png`。本测试验证引用与资产存在；正常页面的实际图标显示由商城浏览器验收覆盖。

生产运行树与已有原递归创建证据2637非保留树逐节点一致。实际提交2664/2665/2667三个Type1精灵与2830/2834两个Type6粒子绘制；Tag0使用活`tag_efcenter`矩阵，移动挂点后提交几何同步改变。每次通知只分派一次GA15，selector=1；技能1无保留记录或复活队列，Stop通知不会停止当前一次性效果，复活不会重播。自然结束、显式handle停止、角色detach、整个runtime停止均释放实例、网格和材质。

既有`tests/healing-effect-life.cts`另验证正式BattlePlayers存活/死亡/复活快照：一次性效果继续，复活不重播；声音自然ended释放；角色移除清理几何，而已播放声音独立完成；整场停止释放声音。本次复验通过。

验收命令：

```bash
npx tsx tests/feed-purchase-effect.cts
npx tsx tests/healing-effect-life.cts
npx tsc --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Node --esModuleInterop tests/feed-purchase-effect.cts
```

证据：`recovery/output/feed-purchase-effect.json`与`feed-purchase-effect{,-life,-types}.log`。

## 限制

本片生产效果测试采用NullEngine和夹具纹理像素，声音分派通过正式运行入口；原像素和物理音频设备播放由正常浏览器验收承担。死亡角色动画采用TankView边界。本片证明现有链的购买实例接入及资源规则，不单独证明原服务器购买资格、奖励获得或原服务器自用治疗规则。
