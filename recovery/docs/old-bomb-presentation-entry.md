# 古老炸弹表现入口准备

3001古老炸弹属于原class4，正常已配置快捷槽2–4的原热键dispatcher输出placeTrap。原item.skillIds=[3001,0,0]、每局最大10；skill3001首槽Effect10/SE02/tag0/method3，Func13字段t5/x30/y3009/z3001。表字段不直接证明原服务器延时、伤害、对象或作用资格。

old-bomb-presentation-preparation.cts/json/log核真resolveItemHotkey的placeTrap，并核现SkillEffectNotifications收到skill3001且roleId0时走world010/f32[x,0,z]，不添加外层SE02。该测试为条件性模块准备，不证明放置结果实际应发送roleId0，也不证明放置或爆炸时刻。原010资源/tree/type4静默与renderer来源复用effects-skill13-world，不重跑其专项或把Func16轰炸规则移入本片。

正式接口与放置、到期、有限消费政策见`old-bomb-policy.md`，由主线提供权威对象和通知。3001成功放置对应skill3001首槽roleId0，3009到期对应其首槽roleId0；这是明确Websender映射，不证明原Func13 sender。原Func13／15／2执行与X30用途仍缺，不把仅播放010视为陷阱业务恢复。

## 原地面模型消费者

原资源`Data/scnobj/03001/03001.POL`与同目录03001A.dds已安装，发布`Data/scnobj/03001/03001.glb`包含box01/0、03001A.tga材质引用与嵌入PNG。`Trap3001Visual`仅加载该原GLB，复用现地面模型的native X反射；放置位置来自权威快照，yaw0／scale1为明确Webtransform。`GroundTrapsPresentation`按modelId3001创建该visual，快照存在维护owner，移除／换scope／Leave释放；客户端不自定五秒计时或伤害。

`tests/trap3001-visual.cts`与`trap3001-visual-module.json/.log`接受发布资源身份、3001分派、真实NullEngine模型transform、挂载及removed-before-load释放。AssetContainer是加载边界夹具，不证明GPU或普通放置绘制。现有skill3001→world010及3009→world009消费者复用；两棵原树完整children均无type4声音节点，roleId0分支不播放外层槽声音，保持静默。EffectRuntime树内声音后端为EffectSound（runtime.sound），独立角色技能声音后端为skillSound，两者不可混用。

## 普通放置与到期有限交付

`old-bomb-root-review.json`及`old-bomb-browser-root-review.json`接受普通BUY3001／Kitbag、五秒到期直接HP−300、原地面模型和010／009世界树实际绘制、双端状态、原生保存／同库冷重启与源summary／Home关闭。购买证据复用`old-bomb-browser-purchase-root-review.json`（session45229）；session2928补段仅配置／消费，没有新增BUY。旧instance14数量2保持，新instance15数量1→0。

双端原03001模型分别23／22次实际绘制；010各handle6、正alpha绘制3／8次，009各handle7、正alpha绘制6／5次。具名实际node／mesh、顶点alpha、双端完整共同snapshot369键与各网页own tick players由主线审查。两原树静默，正常退出后目标maps、模型和效果实例清零。session2928实际exit0，3663／5693／9893端口清理；工程回链`old-bomb-engineering.json`。

原生库除明确新库存消费及正常settlement＋1／history＋2外的记录全文保持，冷重启查询一致。独立网络首验与补段的两份FAIL按`old-bomb-network-first-root-review.json`／`old-bomb-network-tail-root-review.json`有限范围保留，不改为网络PASS。原Func13／15／2生产入口、X30解释、完整像素、高清及全会话留存仍缺；本片没有截图资格，M4-09/M4-10/Func13父项保持未完成。
