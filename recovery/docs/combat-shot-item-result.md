# 普通2001场景结果远端反馈

既有`scene-breach21-hit-native.json`保存完整4247aa原指令和20组破坏执行；本片复用它，不重复物件加载、c9/GA13或HP验收。

4247aa先按message+c找攻击者，再按message+14位置和+34类型查场景对象；任一缺失即结束。非type2将+38原参数传44e081并递增角色+314，type2跳过破坏。+38不解释为HP。既有ScenePreview与合法sceneObjectDestroyed/objectiveDestroyed已消费原破坏资源。

独立远端尾部424862比较攻击者与owner+3c，本机直接结束。远端将message+3c/+40/+44三个float送423956，再将message+10物件ID和攻击者送423092。结果端点XYZ与场景查找位置+14是两个坐标区。423956的world007/二维SE30已有TankShotDisplay；423092的owner+8c绘制记录与角色位置GA07已有来源。它不是BeforeShot，不追加03动作或004炮口。

## 正式消费者

TankShotItemResult.show(message,attackerId,localId,shotResult)只恢复普通2001远端资格：先复用TankShotDisplay显示端点，再调用Shot反馈回调。BattleSound.shotItemResult(event,snapshot,localId,itemId)复用已有GA07单次空间声音后端，保留实际场景事务类型，不伪造fire事件。角色位置、100/1600距离与rolloff2配置沿用既有后端；不调用BattlePlayers.fire。

root的shotItemResult字段为{itemId,x,y,z}，只由源场景对象合法致死事务产生；非致死仍属于当前重建HP政策，无结果字段。XYZ用当前查询端点映射至原结果坐标区，这是明确重建生产政策。地图0007模式4没有enabled ENV；不能将普通terrain命中当作3aa4。后续普通实战选择同图模式1/3真实源对象自然损坏，资格由权威主线决定。

## 验证与边界

combat-shot-item-result.cts使用正式catalog验证远端world007/f32XYZ/二维SE30/Shot反馈顺序，以及本机、非2001静默。声音边界验证场景结果实际事务类型、GA07、单次播放、攻击者XYZ、本机静默，严格types通过。模块与浏览器呈现证据分别记录。

原4247aa远端尾部明确再次调用423092；原服务器是否避免同一次射击的其他Shot通知重复未取得生产来源。Web在初次fire的GA07之外消费合法scene结果远端GA07，是依接收分支恢复的行为；不添加推定消息去重或宣称原服务器消息调度已恢复。


## 普通双端可见结果验收

`browser-combat-shot-item-result-2026-10-04T14-19-36-181Z.json/.log`为PASS。正式React双账户与CPU、地图0007/模式1、默认2001；P1出生点[182.31,0.32,420.93]最近合法源ENV:79（obj05462），中心[154.837692,19.261383,533.721313]。双方正常停止AI托管，以Arrow键面向同一源物件，第三人称相机自然跟随炮塔；P1普通Space开火。没有写入相机、位置、朝向、HP或通知。

五次正常损伤后同一sceneObjectDestroyed携带重建映射端点[156.373062,25,516.300842]。本机结果反馈0，结果效果和结果声音请求0；远端反馈1，root2432世界007句柄27全部五节点实际提交并自然结束：2433粒子546顶点，2434/2435/2447各6顶点，2448条带120顶点。原纹理为yan1、baozha1111、light-4、huoguang。远端实际画布帧234保存于result-canvas-2.png；actual-1/2.png为真实页截图。画布160×90，不是HD性能验收。

远端二维SE30实际playing/ended；GA07为单次id48、攻击者位置[182.31,0.32,420.93]并实际ended。双方ENV79破损模型各记录287次真实绘制，均包含七个原模型节点；该物件正确声音GA41各一次，单次playing/ended。既有物件资源和生命周期来源复用，不改变HP政策。

两端离房已记录的效果实例、效果网格和BattleSound声音为0；3345/5375/9575与临时数据库已清理，见combat-shot-item-result-process-cleanup.json。SE30与GA41在离房前均已自然结束；运行时空间/二维声音总计数未另行采样。BeforeShot03/004仍只在fire分支，场景结果消费者仅端点和Shot声音反馈。
