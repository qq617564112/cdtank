# 类型5模型绘制

31个类型5源的绘制参数和生命周期已接入生产源树接口；现存`online/00012.CVD`的时钟、节点轨道和网格动画已恢复。原EXE／DLL执行对照与浏览器诊断结果如下。

| 对照 | 范围 | 结果 |
| --- | --- | --- |
| 生产源树生命周期 | 124序列、1364 tick | 状态与backend调用逐值一致 |
| 原完整type5绘制入口 | 1674绘制 | 递归blend／priority及push／pop一致，矩阵最大误差9.54×10⁻⁷ |
| 原完整CVD节点更新 | 4速率、44 tick | 时钟／循环次数一致，矩阵最大误差4.77×10⁻⁷ |
| 原动画mesh绘制 | 40帧、12120顶点 | XYZ／UV／法线逐值一致 |
| 原材质参数设置 | 23个原material section、138调用 | shader参数逐值一致 |
| Chromium原纹理诊断 | 44帧 | RGB误差0，改变像素4283–4741，清理残留0 |

## 模型矩阵与透明度

type5 vtable `0x5c9628`的绘制槽为`+0x20`，入口`0x47e56a`。alpha小于1时调用DLL `SetBlendRecursive` (`0x1001d980`) 设置blend1及当前alpha，递归priority (`0x1001d8e0`) 设置−2；其余设置blend0、alpha1和priority0。

矩阵栈按parent→Translate(position+orbit)→RotateX→RotateY→RotateZ→Scale组合。没有parent时再乘manager+0x68全局矩阵；零parent矩阵跳过模型提交。最后调用model backend vtable+0x10的Attach(0)，恢复矩阵栈。`effectModelDraw`保留这个顺序；精灵的全局矩阵与缩放顺序不能代替它。

`EffectRuntimeTree`通过显式model backend工厂创建`EffectModelNodeState`，复用原controller切换与release流程。world源保留世界起点，attached源使用零起点。完整原生命周期的SetTime、SetRate和Update调用由测试backend记录；`EffectRuntime`的战斗mesh路径尚未调用这个工厂。

## CVD时钟、轨道和顶点

`gbGeomNode::Update` (`0x100104a0`) 将engine delta与速率的乘积存为f32，再累加到f64时钟。严格超过duration才减duration并增加循环数，因此恰好duration仍采样末帧。节点采用自身轨道最长时间与mesh最长时间中的最大值。原loader `0x1000f510`将各轨道的时间减去首key时间。

本地唯一可解析的类型5 CVD `Data/effect/effect/online/00012.CVD`有一个节点，position／rotation／scale均为mode3。位置线性插值，rotation与scale的旋转采用原四元数slerp；节点矩阵按Translate→uniform scale→rotation（反转w）→scale rotation（反转w）→axis scale→scale rotation组合。source矩阵由原reader读入临时区，当前节点update不使用它。

原animated mesh DrawSubSet (`0x10016030`) 调用`0x10015ce0`选择相邻帧。XYZ与UV以f32比例线性插值；法线复制下一帧，保留原数值。time达到末帧时直接复制末帧。`effectModelVertices`按原UV／normal／XYZ记录转换为提交顺序XYZ／normal／UV。

## 材质

DLL默认模型脚本注册包含`newgeom`(1)、`geom_t`(0x81)、`geom_c1`(0x801)、`geom_t_c1`(0x881)。section kind1或节点透明度小于1选择透明脚本，FVF含顶点色选择c1分支。normal脚本的VS输出ambient；c1脚本使用原顶点色。透明脚本启用alpha blend，并以AlphaRef100／GREATER执行alpha test；未设置的设备状态继续继承。

原shader参数函数`0x1001b6f0`已完整执行。无fog／灯光分支的parameter4 RGB为f32(globalAmbient×materialDiffuse)+f32(emissiveFactor×materialEmissive)，alpha为node alpha×material第一个颜色的alpha。`effectModelAmbient`保留中间f32存储。gfx构造`0x10027f97`的初始ambient为[0.2,0.2,0.2,1]，emissiveFactor为0。

`EffectModelMesh`接受明确供给的Cull／depth write／depth test／blend／alpha-test状态、原顶点、UV、矩阵、ambient或顶点色。它在提交Web几何时执行一次X反射。浏览器诊断使用原00012A纹理、显式设备状态及graphics参数；对照将原native顶点／矩阵送入相同Web绘制接口，再与恢复组件的输出逐RGB比较。

## 验证入口

`npm run test:effects:model`执行五组原指令oracle和生产组件对照。`npm run test:effects:model:browser -- <Chromium CDP WebSocket URL>`保存`recovery/output/browser-effect-model.json`。native输出为`effect-model-{lifecycles,draw,animation,vertices,material}-native.json`，浏览器fixture为`web-assets/effect-model-browser-native.json`。sprite／strip的3346矩阵样本与online004／online006生产树回归通过，TypeScript通过；构建3794 modules通过（2m01s）。

## 局限

资源库存见`type5-model-resource-inventory.md`。22个唯一模型引用只有8个在当前解码目录中可解析；bat／bianfu.cvd和bing_1..13.pol缺失，youlincat.POL的m120.TGA未解析。32个补丁payload尚未完整解码。

浏览器采用诊断source激活，serverSkillTriggered=false；对照为Web framebuffer输入一致，不是原D3D framebuffer。服务端道具使用链尚未实现。当前CVD实现仅覆盖上述实际mode3节点。无fog／灯光参数对照不覆盖其他分支。模型设备状态采用原default.gbf与选中脚本；场景其他直接设备操作造成的继承变化及全场景模型priority排序尚未完整追踪。

## 生产模型接入

`export_effect_models.py`发布原POL XYZ／UV／顶点色、section索引／材质，以及CVD轨道／顶点帧到`effect-models.json`。资源引用22个，8个具有模型文件；缺失模型和youlincat的m120纹理保持明确资源错误。原TGA引用按同目录DDS实物解析并发布PNG。

`EffectModelRenderer`作为`EffectRuntimeTree`的type5 backend，由原节点setTime／setRate／update驱动动画。`EffectRuntime`按原树顺序提交模型，使用原type5 draw矩阵和section脚本，绑定原材质或顶点色；结束、退出和clear释放模型mesh／material。三个生产source调用覆盖625103的5个POL网格、13022顶点色网格和00012的CVD动画网格，浏览器均产生可见像素，clear后保留mesh为0。此项source调用属于诊断。

`effect-model-source-state-native.py`执行完整原gbGeomNode与base构造，仅供给allocator，+0x7c与+0xbc矩阵均为单位矩阵。完整POL mesh reader仅将52-byte描述的前31字节复制为名称，载入路径的多网格子节点也未写入描述变换。原gfx初始化指令执行得到ambient=[0.2,0.2,0.2,1]、emissive=0；EXE无AmbientLight／Emissive接口或ordinal import，DLL全部可执行段无这些setter的直接call。

原gfx初始化0x10027665与device reset0x10020466读取effect manager+0x18默认effect并调用Apply(0x10026450)。Apply向D3DX Begin供给flags=3，遍历pass后End；常规Begin(0x10026400)供给flags=0，End(0x10026430)调用D3DX End。因此默认脚本写入设备基线，常规模型effect保留D3DX的状态保存／恢复语义。恢复代码解析default／newgeom／geom_t／geom_c1／geom_t_c1的显式状态。

原GetDeltaTime(0x10028030)从TLS+8读f64，当delta<0.5时原值返回，delta>=0.5时返回f64 0.1。11个原getter样本包含精确边界与长帧，`effectModelEngineDelta`逐值一致；生产model backend应用此getter限幅，节点lifecycle仍使用外部tick参数。动画fixture供给的delta属于getter之后的接口值。
