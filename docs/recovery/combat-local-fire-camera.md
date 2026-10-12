# 三部件本机普通开火后坐

普通三部件角色本机开火触发原眼点后坐，参数`1,float32 .2,10`。原四部件开火和远端开火不调用该相机入口。开火及受击共同使用一个原相机抖动状态，新激活清除旧状态并替换duration/strength，elapsed回0，不叠加抖动。

原`464e53`在actor`+19c`死亡标志为0时调用派生virtual`+3c`并保存角色ID。三部件`468a53`派03/index2/flags4后，经真实`4269c4`比较本机role与actor`+258`，仅相同角色取当前相机virtual`+18`。原相机vtable`5c6dd0+18`是`4556e2`，duration常量`5c4794`为`0.20000000298023224`，strength`5e68c8`为10。四部件`46c42e`仅派03，没有相机调用。

`combat-local-fire-camera-native.json`16完整序列覆盖两种状态模式、三/四部件、本机/远端和死亡标志。真实执行派生入口、`4269c4`、相机`4556e2/45573f`；预置hurt duration.5/elapsed.3被本机fire替换为原f32.2/elapsed0，其他分支原状态不变。动作应用、状态模式和active-camera选择为供给边界。完整抖动数学/随机消费沿已有90激活/540更新原oracle。

`TankView.acceptsBattleActions`使用其原有alive/disposed动作资格，`BattlePlayers.fire`在已加载可行动view上派03并返回源三部件结构资格。`Battle`仅对本机fire调用`EffectRuntime.ordinaryFireCamera`；后者复用已有`cameraShake.activate`。原004炮口、GA07和Shot世界显示链不变。

## 验收范围

`tests/browser-combat-local-fire-camera.mjs`经独立`/validation.html`诊断页正常认证Create/Join、两CPU、Ready、Space输入验证正式Battle/render消费者。入场前原151角色记录为账户fixture，入场后不改位置、HP、相机、clock、通知或胜负。host151和guest001双端同fire，actual view与未抖动base独立矩阵对照；远端和四部件零激活，双端原004实际网格提交和GA07真实声音ended，自然死亡及满血复活，原90秒自然结算、同房再战与普通Leave清理纳入验收。

`browser-combat-local-fire-camera-2026-10-04T06-11-40-799Z.json`及独立`combat-local-fire-camera-actual.json`均PASS。28次本机P1普通fire激活，53实际active frame，view与未抖动base最大矩阵差5.930816650390625。远端网页0激活/base差0；19次四部件P2正常fire保持静默。双方P1原004网格实际提交分别251/267次，GA07/sound48实际播放并ended各28次。自然死亡后满血复活01，两端正常OBJECTIVE结束round1（配置90秒时限），同R6正常再战round2 clear activefalse/elapsed0，普通Leave八项资源/相机计数全0。两张原正常frame PNG供图像观察，逐帧矩阵证明变化和恢复，静图不单独证明运动。

原632×360首发记录未满足active帧验收，raw `06-10-12-053Z`保持FAIL；成功段为316×180。专属3313/5343/9543及临时目录已清理，见`combat-local-fire-camera-process-cleanup.json`。

命令：`recovery/.venv/bin/python tests/combat-local-fire-camera-native.py`；`node --import tsx tests/browser-combat-local-fire-camera.mjs`；`recovery/.venv/bin/python tests/combat-local-fire-camera-actual.py <raw>`。Web类型检查已通过；统一Web发行1m58s和330模块边界检查复用`lobby-presence-fire-release-web-build.log`及主线boundary证据，包含本片生产接口与Battle调用。

## 限制

诊断入口普通权限操作不代替正式大厅页面验收。相机在死亡后沿现有源激活/自然更新，不新增无来源死亡即清策略。软件渲染原帧图像不代表Windows整帧GPU像素或高清性能；原角色多动作混合和完整服务规则仍归父项。
