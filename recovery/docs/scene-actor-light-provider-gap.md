# 原角色选灯 provider 边界

M3-03/M4-07。`scene-actor-light-provider-source.json`记录与环境光setter不同的原角色SetLight入口。三部件46a571／46a580／46a58f经导入5c0a04调用gbActor::SetLight，mode1、局部方向vec3、所选对象+6c纹理依次入参。gbengine100099b0–100099e2原样保存mode至actor+94、xyz至+98／9c／a0、纹理指针至+a4。

多候选分支方向末端在46a528归一化，再读取63582c manager的+d4矩阵栈，通过GetTop与RotateIn变换。其上游46a366／46a40b／46a455读取scene+1ac的八字节记录及对象+d8；46a448调用469e2c后按所选记录两个index取对象，46a476–46a50e按两项权重组合方向。场景vector身份与ctl加载来源见下文；非零候选的对象恢复与选择权重算法仍未取得完整执行资格。地图02零候选默认分支另行记录。

角色skin原执行`role-skin-texture-sol-native.json`只复用其既有纹理覆盖合同，不将该原渲染入口执行冒称选灯分支资格。`tank-daylight.md`与`cartoon-outline.md`现有白光／轮廓消费者也没有关闭此provider或原texToon来源。

## 地图02的原加载与分支

46a26b角色更新从635830 manager+60取得场景。scene+1a8是八字节记录vector：417b49在begin为空时返回0，否则计算(end-begin)>>3。场景加载45b70e使用原字符串5c721c「.ctl」，45b751把scene+1a8交给45b3ea；该读取器读u32数量，kind0经45b33f恢复对象、kind1复制先前索引记录。45ac58初始化其begin／end／capacity，45a416经459771清理。

已安装的原`Data/scn/0002/0002.ctl`实际仅4字节`00000000`，即0记录。地图02的来源分支因此为46a2ae落入46a2b4，读取scene+70对象及该对象+d8；不是多候选权重分支。零记录不表示原场景无灯或固定白光。

## 地图02默认对象合同

场景加载45b4e4检查scene+70；为空时分配0xdc字节，调用463a9a构造并在45b50d保存。原vtable5c7c98的virtual+34在45b519接收资源名5c7244「0」，目标46400c按原格式`%s\\%s.bmp`、目录`data\\image\\toon`加载`data/image/toon/0.bmp`。46408e调用gbTexture::LoadTexture(1)，成功后4640ac将纹理保存在对象+d8；原actor读取其+6c作为SetLight纹理参数。已安装原BMP为822字节、128×2、24位。

45b51c–45b536把默认对象位置设置为[0,200,0]，Y原字节43480000。virtual+38的44db45复制xyz至对象+58，44dbc0返回该位置。零候选分支46a2ed–46a320将默认对象位置和actor+28位置分别经当前gfx矩阵栈的GetTop／Transform变换，46a328–46a352计算变换后的灯位置减角色位置并归一化，再跳至46a557 SetLight。这一分支不经过多候选末端的RotateIn。

默认对象、位置与纹理身份有具名静态来源，零候选方向与保存合同另有下述原执行；selected shader／texToon绘制资格尚未闭合，不能据此关闭生产表现。场景生命周期和共享provider由主线协调。当前没有生产接线或普通实战，不能以固定方向、白光或替代纹理填补原纹理采样。

## 原零候选分支执行

`tests/scene-actor-default-light-native.py`实际执行三部件46a26b与四部件46d756完整更新，原vector数量查询、gfx矩阵栈GetTop、Transform、Normalize与原CRT sqrt及100099b0 SetLight保存均未替换。观察hook只读setter入参，不改变调用结果。来源`scene-actor-default-light-native.json/.log`接受12组更新／42次组件保存：不同角色位置、平移／旋转view矩阵、scene清除；方向与独立位置差计算误差小于0.000001。scene清除分支写回mode0、零方向与零纹理。

场景指针、默认对象、空候选vector、角色组件与位置、gfx矩阵栈和纹理device handle为明确输入内存夹具；该执行不覆盖场景loader、纹理上传、实际shader提交或普通对局，也不覆盖非零ctl选择。

原`cartoon.gbf`的toon顶点阶段使用normalize(normal×mv)、max(dot(lightdir,N),0)和tex1.y=1；stage1使用texToon、POINT／无mip／CLAMP并乘当前颜色。原actor render10009f80只有mode非零、组件54／58／60非全有效、传入对象+c effect存在且effect+18含0x1000时，才通过10026780取得当前effect并提交lightdir／texToon。该effect资格与实际材质脚本选择的producer仍需确认，不能将所有现有MV3 shader无条件改成toon。

## 原effect注册与资格缺口

`scene-actor-toon-effect-gate-source.json`记录原effect管理器注册：100272be的0x1000对应cartoon.gbf，100272cf的0x1010对应cartoon_f2.gbf，10027313的0x1001对应geom_cartoon.gbf。这些是注册资格，不等于实际角色选择。

10012108–1001211b只有静态纹理s_texToon非空、flags不含6或0x800时才加0x1000。s_texToon实际为gbGeomNode导出的纹理指针100534b4，原镜像初值0；gbengine中该绝对地址仅有两处读取，CDTank与已安装DLL没有该符号的具名导入。随后材质名`_light`强制flags0x4000、`_water`加0x8000。现有范围没有取得s_texToon的实际填入producer，也没有证明计算写入或动态调用不存在。

角色缺环为普通Attach调用方及显式effect实参身份；几何缺环为s_texToon填入与相应材质资格。两者不互相替代。方向原执行直接复用，不重复shader注册、静态引用或原方向检查。取得对应入口前不新增无条件toon生产patch，不把注册表或纹理存在当成普通对局恢复。

## 角色与几何选择入口

`mv3-normal-d3d-state-sol-native.json`已保存完整MV3 selector1000d570来源与全部原材料零选灯执行，直接复用。正常角色分支1000d716–1000d7a1按alpha选1／0x81，RenderInfo+e4／e8存在灯记录时加4／8，按fog加0x10／20／40；该分支没有几何selector的0x1000追加。1000d6b7的非空显式effect参数则在1000d6e9／1000d705读取effect+18作为flags，而不走正常lookup。

因此s_texToon填入是几何资格缺口，不能单独解释角色toon选择。角色的实际显式effect安装caller仍缺；不能将SetLight调用直接等同于cartoon脚本已选。1001a250从queue+4010／count+4410查询、排序并按虚函数分类后填入RenderInfo灯记录，此字段流也不替代该显式effect安装资格。上述边界仅读取既有执行及具名原指令，不重新跑全材料selector。

角色显式effect转交接口现定位为gbActor::Attach(gbRenderEffect*)导出1000a0b0。gbActor构造1000a470写vtable1003f61c，Attach位于该表+10。1000a0d1读取调用方参数，1000a0dc通过actor+7c模型virtual+2c转交；原模型vtable1003f890的该slot为1000daa0，1000dacc／1000dad6将参数原样作为1000d570第三参数。尚缺普通游戏调用Attach的具体caller及effect实参身份；SetLight仅保存方向与纹理，不安装此effect。
