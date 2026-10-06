# 普通Shot世界显示

普通2001自由瞄准射击现在立即在原目标点播放世界效果007和二维SE30。两个网页以正常Space和CPU开火收到相同Shot显示数据，实际绘制原五节点、自然到期并播放/结束原声音；死亡09、满血复活01、离房和新房间重入清理通过。

## 原来源与触发

完整原item加载器439b55把columns27/28/29的ItemSkill1/2/3存入+108/+10c/+110。实际item2001为2001/4020/0。ShowShotEffect489ba8读取+10c，因此选择4020；完整原skill加载器43abfd把column7 Effect1存入+70，column8 Sound1初始化+7c字符串，实际4020为7/SE30。普通显示不是技能2001的0/0，也不由名字推断命中。

原本地4288fe自由瞄准分支在无玩家目标、无场景射线命中时读角色position+25c和look+274，逐f32计算position+look×1000，428a55立即调用423956→489ba8，然后发送3a9b请求并调用423092。原远端4245c9只在角色存在且不是当前本地角色时透传Shot消息+14/+18/+1c XYZ，随后调用423092。两端显示发生在射击处理时，不等待重建弹丸碰撞。

原45afc2的flag1调用gbGfxManager::ClipPoint，裁剪后可不创建世界对象；它不改变XYZ或贴地。世界对象按传入原位置开始，独立于角色挂点。4858f2接收声音名和enabled1，没有位置参数；SE30使用二维声音，不添加空间衰减。

## 正式接入

服务端原`createRoleFreeAim`已提供自由瞄准目标，普通fire事件附`shotDisplay:{itemId:2001,x,y,z}`。`TankShotDisplay`通过目录物件第二个技能和该技能第一效果选择名称/声音，原XYZ取f32后交给`EffectRuntime.spawnWorldEffect`；源视锥裁剪保留，独立声音由`playShotSound`复用二维效果声音后端。正式Battle接收事件调用该消费者，轮次和离场沿用效果运行时清理。

## 验证

`tests/combat-shot-loader-native.py`完整执行原item2001、skill2001、skill4020载入器，读取真实原表列值；表格单元解析和字符串赋值是供给边界。另执行8组完整4245c9的角色存在、本地排除和原XYZ透传。结果为`combat-shot-loader-native.json/.log`。

既有完整4288fe自由瞄准oracle和192组423956→489ba8显示链保留；`tests/combat-shot-display.cts`将其中21个实际成功末端的原XYZ向量交给正式消费者，逐项核对world007/SE30及位置透传。结果为`combat-shot-display-suite.log`。正式服务端及消息编码验收见[服务端Shot事件](combat-shot-server.md)。

`tests/browser-combat-shot.mjs`使用两网页、正常原105装备/皮肤、0007混战、CPU与Ready，随后正常Space。两页53条fire事件数组的顺序与全部字段严格相同，其中37条在双方都有世界007全部五节点实际绘制并自然到期；相同事件数据可能来自同位置重复开火，计数不表示新增原消息序列号。源root2432的绘制节点2433/2434/2435/2447/2448分别为烟、两爆炸sprite、光sprite和strip。本地36棵、远端29棵树记录全部五节点实绘并自然结束。

首个实际双端世界树handle1同处原端点[-781.5494384765625,0.32243087887763977,154.497802734375]。本地帧165、远端帧96保存自然画布；2433粒子网格558顶点，2434/2435/2447各6顶点，2448 strip120顶点，纹理分别来自原yan1、baozha1111、light-4、huoguang。图中远处亮光由这棵原世界树实际提交绘制；不把整张场景的全部像素归因于效果。

两页各53条SE30真实playing/ended，全部单次播放，实际duration1.172426秒；交付SE30 WAV与原CDTank/Data/sound/SE30.wav逐字节相同。双方记录P1死亡09、原满血200/200复活01。两次离房（包含新房间重新Ready）后实例、特效网格、效果声音、战斗声音及玩家五项数量均0。结果为`browser-combat-shot.json/.log`，自然画布为`browser-combat-shot-natural-1.png`与`-natural-2.png`。

## 同房再战

`tests/browser-combat-shot-rematch.mjs`通过原同房混战正常CPU达到10次击毁后FINISHED，双方原生点击再战进入round2。正式`EffectRuntime.clear`调用前，本地仍有句柄225/226/227及声音111/112，远端仍有句柄212/213/214及声音111/112；调用完成瞬间两页实例和声音都清为0，第一轮所有旧句柄消失。自然观察帧分别为1748/1686。随后双方正常Space开火，第二轮每页至少2棵世界007完成五节点实际绘制并自然到期，至少4条新SE30实际播放并结束；最终离房五类资源全0。结果为`browser-combat-shot-rematch.json/.log`。这项与首脚本的新房间重入分别记录。

专属server3271、Vite5301与CDP9501均已关闭，临时账户库、Vite缓存及Chromium profile已移除。

## 限制

正式服务器目前对普通fire采用已证自由瞄准分支；原玩家目标优先分支、场景射线命中分支和远端Shot服务端生产选择仍未完整恢复。世界007是射击目标点显示，不是权威弹丸实体、速度、寿命或尾迹。现有球形弹丸以及360速度、30/20炮口、2.2秒寿命仍保留重建标记。所选技能门禁与默认物件回退仍以原执行供给边界核对，未覆盖本片普通2001之外的业务。320×180 SwiftShader画布证明实绘，不代表高清性能。
