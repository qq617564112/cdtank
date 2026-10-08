# 原战车效果挂接恢复

`npm run assets:effects` 从已校验的原资源导出 `web-assets/effect-links.json`；`npm run test:effects` 校验原PE读取指令、所有文件完整消费、逐字节重建和截断/尾随字节拒绝。

## 原读取链

三部件初始化0x46a1e7–0x46a215、四部件初始化0x46d6d6附近使用0x5c87a4的`%s\%s.elk`及0x5c87b0的`data\effect\link`，调用0x47cf35，将数据存入角色+0x1f0。效果库由0x447d5f–0x447d6b加载`data\effect\effect.sav`，完整记录解析见下文。

0x47cf35按下列顺序读取，无额外版本头：u32组数；每组u32键、u32动作数；每动作16字节名称、u32记录数；每记录0x294（660）字节。0x47cf9f、0x47cfb9、0x47cfca、0x47cfe4、0x47cff5、0x47d01b分别提供读取依据。组键的业务含义尚未完全确认，保留原整数/十六进制值。

0x47baf1初始化记录+0x4及+0x148各0x144字节，另有+0x0、+0x28c、+0x290字段。导出保留660字节原记录以及两个字段的初始字符串，未把这些字段整体解释成纯路径或纯挂点名；尾部变换/控制参数仍需追踪。原记录首部含不稳定样式字节，保留而不当作Web指针使用。

## 已恢复内容与缺口

20份ELK全部解析，23条记录逐字节重建与原文件一致。21种战车中154缺少原ELK；不能直接复制其他车的配置。

所有20份文件包含键0x30330000、动作`attack1`，初始字符串`_root\online\004`和`tag_efattack`。105额外包含键0x30390000、动作`effect1`、`_root\online\006`与`tag_efcenter`；158包含额外`attack3`以及键0x30390000的`attack1`，后者第二字段为空。仅依据这些键不能认定所有战车有相同死亡爆炸。

死亡状态0的0x435b0e设置入口0x4647fe；该入口通过vtable+0x44进入0x468a03或0x46c3de切09动作。其状态回调0x435803和0x43bd98分别转发vtable+0x30/+0x34，两类战车表中对应0x43bd8e和0x49cc05。已读直接死亡入口未发现直接WAV播放，不能据此推断整个死亡路径无声音。

当前导出为后续恢复依据，`runtimeComplete=false`。下一步解析effect.sav、挂接记录参数、动作事件与动态tag变换，再接入运行时播放和生命周期验收。此次没有增加Web粒子或死亡音效。

## effect.sav完整记录结构

`recovery/effect_sav.py`按原0x47b8b3/0x47f9cf及分派0x47800e/0x478a67解析整个3,367,845字节文件，导出`effect-library.json`。头部f32版本1、u32节点数3118；每节点依次为类型、ID、324字节名称、三个4字节字段、资源定义、控制器数量/定义、子节点数量/ID。字段的运行语义仍保留待确认。

资源定义自身为u32长度加对应字节；类型0/9/10读空块，1/2/3/4/5/6/7/8/11按独立虚表载入。当前实际资源长度分别为0→0、1→670、2→381、4→329、5→661、6→341、7→717、8→337、10→0、11→8。类型3/9在本库中没有记录，解析器按原基础分派保留支持，但未声称实际样本验证。

每个控制器先读u32长度及9字节基础参数（原0x47607a读取两个4字节及一字节）；1/5/6/7/8/9类型继续读带长度的扩展参数，其余类型走基础定义。当前扩展块长度1→158、5→116、6→602、7→153、8→40；类型6原0x478626还按块大小判断追加字段，后续运行时不能固定假设所有版本都只有同样参数。JSON保留全部原始字节，原资源/控制器加载指令分别导出为证据。

原文件有16个同ID的_root和两个ID为0的节点，另有99条子引用找不到对应ID。导出保留原节点顺序与全部失效引用，未静默合并或修复。所有节点逐字节重建后与原SAV完全相同。

ELK引用的online004在库中唯一匹配，五个真实ID子节点包含yan、baozha、7034b、luohua1、xiao，名称前缀与引用图一致。online006唯一匹配，递归16个子节点，其中类型4节点含原GA12音效；类型和名字本身不证明该音效的触发时机。两个挂接子树无缺失ID/循环，不能据此声称库中其他99引用有效。

下一步恢复资源和控制器参数的运行语义（发射、轨迹、尺寸、颜色、时间、混合、声音）、原动作消息与动态挂点，再实现Babylon运行和实际像素/声音/退出清理验收。本轮完成库记录恢复，未实现Web粒子播放。

## 类型1/6纹理分帧参数

新增`effect_resources.py`将原类型1与6的1,522个资源定义关联到已发布PNG，并导出`textureGrids`。类型1由0x478275→0x4828f9建立运行对象，0x48321c读取资源+0x4作为纹理引用；类型6由0x4783ac→0x480ec0建立，0x4813dd同样读取资源+0x4。两个加载器0x4765ff/0x477077确认宽、高、帧数存入+0x148/+0x14c/+0x150，对应SAV资源字节偏移648/324。余下字段完整保留，尚未取未经验证的名字或值当作运行参数。

0x48325f–0x483273及0x481424–0x481438把帧数、帧宽、帧高交给0x482cc9/0x4812e3。原纹理宽高来自纹理对象+0x14/+0x18；配置帧宽/高为0时使用整张纹理对应尺寸。UV生成按像素游标`i * cellWidth`除以纹理宽，余数为X，商乘cellHeight为Y；再加单帧归一化宽高得到右下角。不是对帧序号除以像素宽，也不假设总帧数就是完整网格。

已解析1,454个节点的唯一源图与PNG路径（保留原文件大小写），68个节点引用的14种纹理在当前已校验源资源中缺失，未代换。15个已发布节点的原UV超出[0,1]，保留原公式并标记`uvWithinTexture=false`；之后需核对原纹理寻址方式，不能静默钳制成另一种表现。

online004五个子效果的原纹理均可定位：yan1、baozha1111、FlareBrightOrange_BLUE、dian、yan1。爆炸256×256纹理分64×64、16帧；帧0/3/4/15的UV分别为(0,0,.25,.25)、(.75,0,1,.25)、(0,.25,.25,.5)、(.75,.75,1,1)。这些UV保留原D3D计算结果，Web采样上下方向、透明混合、每帧时序和运动控制仍待运行证据确认，本轮没有裁切/翻转新特效图或播放粒子。

## 类型1原动画帧时钟

新增`effect_controls.py`从1,088份类型1控制器导出`spriteControls`。0x476319加载的扩展块在JSON中已剥除其4字节长度头：八个vec3共96字节、两个4字节字段、两个16字节字段，然后偏移136的f32帧间隔、140的u32标志。原对象位置分别为+0x98/+0x9c，不能直接用对象偏移读取序列化块。偏移144的一字节尚未确定；145、146、150分别为轨迹启用、保留数量、间隔，其用途见0x483161–0x4831cd；154字段继续原字节保留。

`apps/web/src/effect-frame-clock.ts`提供后续粒子运行使用的原帧时钟，目前未接入战斗渲染。0x482992–0x4829c2初始化顺序：bit2倒放→最后一帧；否则bit4随机→rand()%帧数；否则第0帧。更新0x4830e1–0x483161累加delta，达到或超过帧间隔时只减一次间隔、只改变一帧，保留余数；不循环追赶。更新顺序bit4随机优先于bit2倒放；bit1令正向到末帧或倒向到首帧后停留，否则循环。正常路径不调用随机函数。Web的随机分支由调用者注入，原CRT随机种子/全局随机序列尚未复刻。

浮点值在传参和状态写回时按f32处理；原x87先比较未写回的两f32输入之和，再将余数写回。本实现保留此顺序，并保留大delta后余数可仍大于间隔、后续零delta也能推进的行为。该模块不管理整个效果的开始/结束、控制器切换、运动、颜色或轨迹渲染，不能把帧时钟验收扩大成特效播放验收。

online004的baozha控制器基础参数为0/.5/0，帧间隔原f32为0.019999999552965164、标志1，16帧正向后停留。基础参数的二float来源0x47607a，控制器选择0x47f0eb使用其+4/+8结合角色时间；完整效果时序与触发调用尚待接入。源码字段均保留与PE调用证据，可重生成与原SAV逐字节比对。

## 节点延迟、寿命与控制器绝对边界

`nodeTimings`覆盖全部3,118节点：三个4字节字段对应原定义对象+0x14c的未定引用、+0x154的f32延迟、+0x158的f32寿命。控制器基础9字节对应start/end/flag，第二个float是相对节点开始的绝对结束时刻；此前`spriteControls.baseDuration`修正为`baseEnd`，避免误用于累加时长。

0x47f61c将delta与节点elapsed相加并写回f32，再按状态分派。等待状态0x47f572在elapsed>=delay时切状态2、调用初始化、逆序启动子节点，首次更新传入f32(elapsed-delay)。0x47eef0仅在lifetime>0且delay+lifetime<=elapsed时返回结束；加法比较发生在x87中，不能先把和舍入为f32。类型1的0x481953还可能根据控制器+0xa0和模型动画结束状态终止，这条附加条件尚未实现。

`apps/web/src/effect-timeline.ts`实现上述开始/寿命判断及0x47f0eb控制器选择计算。local=elapsed-delay第一次与首控制器start比较时未舍入，后续与end比较使用存储后的f32。local<首start置索引-1；索引-1时使用首start作边界，否则使用当前end。只有边界>0且local严格大于边界时推进，可一次经过多个控制器；切到索引>0时按顺序请求reset，超出最后索引时钳制且不再reset。相等保留旧索引，非正边界停止推进；原索引-1且首start=0时也保留等待行为，未人为纠正。

原0x47f2af在存在有效控制器时检查结束条件，随后调用结束或更新虚方法，并逆序更新子节点。0x47f311的结束状态继续更新子节点，只有无子节点且+0x3c满足条件时才释放。+0x3c所有权语义、子节点移除及动态挂点尚未恢复；当前模块仅计算时间与切换，不实现完整生命周期，也未接入战斗渲染。

`test:effects`逐条核对全部节点与控制器的源字节，覆盖延迟相等、寿命相等、x87比较与f32写回差异、首start/当前end严格边界、多次切换reset顺序、非正边界及原爆炸/烟雾样本。

## 类型1尺寸、角度、颜色与基础运动

全部1,088份类型1控制器新增`appearance`、`motion`、`orbit`和`endOnModelAnimation`。0x476319按顺序读取的八个vec3，对象偏移+0x10/+0x1c/+0x28/+0x34/+0x40/+0x4c/+0x58/+0x64分别对应尺寸、尺寸变化、初始位置、速度、加速度、角度、角度变化、环绕轴。序列化扩展块偏移分别为0/12/24/36/48/60/72/84。对象+0x70/+0x74对应序列化96/100的环绕半径与角速度；两份RGBA在序列化104/120，对应对象+0x78/+0x88。+0xa0的一字节对应序列化144，由0x481953读取为模型动画结束条件。

初始化0x482960与reset 0x481fc0将尺寸、角度、颜色等复制进80字节单实例状态；reset受基础flag等分支控制，完整reset行为尚未实现。渲染0x4819cb使用尺寸X/Y构造正负角点，即半宽/半高，不能直接作为Babylon平面的完整宽高。角度以度参与原三轴旋转；Web角度/坐标反射及渲染方式仍待接入校准。

`effect-sprite-state.ts`实现已确认的外观更新：尺寸与角度先通过0x422d4d将rate×delta存为f32，再与原状态相加并写回f32；颜色0x483039按`color - rate * delta`计算，先写回f32，再经0x464d7d钳制到[0,1]。负颜色变化值会增加通道，未替换为经验淡出算法。online004爆炸原RGBA=(1,1,0,1)、变化=(0,0,0,-5)，其alpha因此保持1；其他路径的透明/轨迹表现仍需独立恢复。

0x482ede–0x482f41先更新速度，再按更新后速度移动位置（逐帧半隐式积分）。X/Y的乘积直接用于x87加法；Z先把乘积存f32，再相加。不能改成连续运动公式的半加速度项，或将大delta拆小补步。`integrateSpriteMotion`仅执行这段基础算术，要求加速度已在原XYZ状态坐标系中；原全局RotateIn、模型方向对速度的覆盖、路径位置覆盖、环绕偏移和动态挂点不由该函数处理。

`tests/effect-sprite-native.py`使用Unicorn直接执行当前原EXE的尺寸/角度/颜色/积分指令块与原clamp/vector helper，不用另一份相同数学公式生成预期。尺寸块进入前执行0x482e08加载delta到ST(0)，保留原调用输入。所有源控制器各运行x87 53位/64位有效精度，爆炸另检查0.25秒，共2,178组；源EXE哈希与结果存`recovery/output/effect-sprite-native.json`，TypeScript逐组比较输出。进程全局x87控制字设置尚未恢复，因此两种精度都测试，未宣称仿真已经复现完整Windows运行环境。

`test:effects`还覆盖无尺寸钳制、正负角度、颜色减法与钳制、负变化、零delta、每帧积分与连续公式的差异、Z中间f32写回、颜色不提前舍入乘积及全部源字段。恢复环境增加`unicorn==2.1.4`。本轮未接入Babylon粒子或改变战斗画面，原混合/材质、轨迹历史、模型/路径/环绕/挂点及所有效果类型运行继续待恢复。

## 原GBF材质注册与类型1选择

0x47ad10–0x47ae78将11个`NewRenderEffect(path,0)`的结果按顺序加入效果管理器+0x30数组；0x4794c2按index读取+0x34指针数组。`effect_rendering.py`从原push指令与字符串取得路径，并解析对应原GBF，保存源SHA256、technique、按顺序的pass和显式状态赋值。解析器只接受当前已确认语法，未知语法拒绝，未将多pass拍平成一个状态字典。

| index | 原脚本 | 显式混合目标因子 | 深度测试/写入 | 过滤/寻址 |
| --- | --- | --- | --- | --- |
| 0 | AlphaBlend | INVSRCALPHA | 关/关 | LINEAR/WRAP |
| 1 | AlphaAdd | ONE | 关/关 | POINT/WRAP |
| 2 | AlphaBlend_Z | INVSRCALPHA | 开/关 | POINT/WRAP |
| 3 | AlphaAdd_Z | ONE | 开/关 | POINT/WRAP |
| 4 | ScreenBlend | INVSRCALPHA | 关/关 | LINEAR/CLAMP |
| 5 | ScreenAdd | ONE | 关/关 | LINEAR/CLAMP |
| 6 | AlphaAdd_NoCull | ONE | 关/关 | POINT/WRAP |
| 7 | AlphaAdd_Z_NoCull | ONE | 开/关 | POINT/WRAP |
| 8 | AlphaBlend_NoCull | INVSRCALPHA | 关/关 | POINT/WRAP |
| 9 | AlphaBlend_Z_NoCull | INVSRCALPHA | 开/关 | POINT/WRAP |
| 10 | AlphaBlend_Z_NoCull_Cylinder | 未显式设置 | 开/开 | POINT/WRAP |

前10份源因子均为SRCALPHA，颜色与alpha均TEXTURE×DIFFUSE、关闭Lighting。6–9显式CullMode=NONE；0–5未显式设置CullMode，不能仅凭文件名填默认。4/5为XYZRHW屏幕顶点且开启alpha test，但未设置AlphaFunc/AlphaRef。10有两个顺序pass：p0剔除CW、alpha>=100；p1剔除CCW、alpha>0，两者都写深度、开启混合，却没有显式SrcBlend/DestBlend。引擎默认状态、pass之间继承/重置继续待恢复，导出`implicitStatesResolved=false`。

类型1资源序列化偏移669的一字节对应原+0x2a4，选择屏幕空间分支；控制器偏移154的u32对应原+0xac。0x481a0b–0x481a72在普通分支按bit2/4/8选深度/加法/不剔除脚本，bit1影响几何朝向路径，不影响本段材质索引。屏幕分支仅bit4决定index4/5。`effect-render-selection.ts`实现此选择；高位标志仍原样保留，不擅自解释。

当前1,088份类型1控制器实际分布index0/1/2/3/6/7/8/9为57/39/108/136/186/269/141/152，没有屏幕分支，也没有选择index10。online004爆炸2431与7034b2785均flags=15，实际选index7：加法、深度测试、不写深度、不剔除、点采样与WRAP。原UV超过纹理边界的类型1因此不能一律钳制；类型6等其他选择与资源采样仍需独立追踪。

`tests/effect-rendering-source.py`验证11原文件哈希、12个顺序pass、显式状态和未设置字段；以Unicorn直接运行0x481a0b–0x481a72，对全部低8位和高位样本×两空间分支共520组及全部源控制器核对，并检查原FVF调用参数0x15/0x114。TypeScript选择逐组对照原x86结果，证据`recovery/output/effect-render-native.json`包含源EXE哈希。此次完成来源与选择映射，未实施Babylon材质或渲染像素验收。

## gbengine材质调用与四边形三角化

`effect_engine.py`新增原`CDTank/gbengine.dll` SHA256、导出符号地址、D3DXCreateEffect导入及材质创建/编译/Begin/Pass/End/Apply、RenderGeomQuad的指令证据。原DLL preferred base=0x10000000，仅作为静态证据地址，不能视为运行时固定地址。

0x10027070通过0x100266c0创建D3DX effect；0x10026400调用ID3DXEffect虚表+0xfc，参数为effect/count指针/flags=0，返回pass数量。BeginPass 0x10026890调用+0x100，随后可能覆盖顶点声明；EndPass调用+0x108；End 0x10026430先清wrapper+0x1c再调用+0x10c。另Apply 0x10026450使用Begin flags=3，依次BeginPass/EndPass且不绘制，再End。两条入口参数不同，不能用Apply行为代替实际绘制的Begin行为。

这些包装代码将状态管理交给D3DX，尚未确认GBF省略字段的设备初始值/其他绘制路径覆盖，以及D3DX保存/恢复与pass状态继承的实际结果。继续保留`implicitStatesResolved=false`，不补入凭经验选择的默认值。

`effect-quad.ts`实现原0x100258a0四边形展开：corner0/1/3、corner3/1/2两三角形，UV对应(左,上)/(右,上)/(左,下)与(左,下)/(右,上)/(右,下)。原FVF普通分支每顶点24字节XYZ/packedColor/UV；屏幕分支28字节XYZ/RHW=1/packedColor/UV。颜色原32位按原样保留，坐标/UV写f32，无UV钳制或经验翻转。此函数仍返回原坐标；Web反射、剔除与材质接入时需一起验证，不能单独反转三角形后宣称原朝向一致。

`tests/effect-quad-native.py`在Unicorn运行原DLL完整RenderGeomQuad，只模拟分配缓冲/提交绘制与memcpy，采集原顶点字节；普通/屏幕分支×三份UV（含溢出）×三份packedColor共18组与TypeScript一致，同时检查分配6顶点、提交参数、返回栈平衡。另直接执行原包装函数，用COM测试替身检查Begin flags0、两个顺序pass、End清声明与Apply flags3。这里的替身不执行D3DX，所以不提供默认值/继承语义或实际像素证据。

证据`recovery/output/effect-quad-native.json`带原DLL哈希；`test:effects`包含全量回归。Babylon特效渲染、挂点、完整生命周期、材质默认状态与浏览器像素验收仍未完成。

## 原diffuse量化与轨迹alpha

0x481ef2–0x481f55从实例状态读取RGBA：R/G/B/A分别+0x3c/+0x40/+0x44/+0x48，每通道乘原0x5c9160常量255并调用0x57bb64，取AL存入原顶点颜色字节。原float转整数助手使用x87并校正为向零截断；当前有限源数值验证不能替换为四舍五入。内存按B/G/R/A排列，对应u32 `0xAARRGGBB`。颜色转换本身不夹到[0,1]，越界有限输入保留低8位；上游逐帧颜色钳制是另一操作，初始颜色也不能自动套入钳制。

`effect-color.ts`提供原f32输入×255截断/字节打包，以及量化后供Web顶点使用的normalized RGBA。它尚未接入材质；原CRT超大值/NaN整数转换未恢复，当前测试范围为全部原控制器初始颜色和额外有限边界。

轨迹渲染0x481f60–0x481f87读取无符号历史数量、计算`(1/count)*index*(-255)`，经同一助手截断后将AL加到alpha字节，允许模256回绕；不做alpha钳制。count高位为1时原fild后追加2^32保证无符号含义。alpha基础值上游从当前实例索引0读取，而非每个历史条目独立读取（0x481eef/0x481f0d等）。`applyEffectTrailAlpha`只复刻此alpha算术，不能当作轨迹历史采样、保留数量、位置或完整渲染已恢复。

`tests/effect-color-native.py`直接执行原乘法/截断助手、轨迹数量修正/除法/字节加法，分别x87 53位与64位精度下覆盖全部1,088份初始颜色及额外5份边界，共2,186颜色样本；186轨迹样本含count1/2/3/4/7/16/100/0x80000000/0xffffffff和不同索引/alpha。Web结果逐组相等，证据`effect-color-native.json`保存EXE哈希。源常量与相关指令加入effect-library导出；`test:effects`覆盖全量回归，仍无浏览器特效像素或高清实战完成结论。

## Babylon特效网格与显式材质接入

`effect-sprite-mesh.ts`建立真实Babylon Mesh/ShaderMaterial，将原quad展开、packedColor解码、XYZ反射X接入顶点缓冲。着色器直接TEXTURE×DIFFUSE，不加入光照/色调映射。支持原GBF6–9的显式no-cull世界空间pass，设置原POINT/WRAP、不写深度，按ZEnable使用LEQUAL或ALWAYS；update更新位置/UV/颜色与包围盒，dispose幂等且不销毁调用者纹理。构造设置传入纹理的过滤/寻址，调用者须提供该pass专用或采样设置一致的纹理。

GBF0–5的剔除/alpha test等隐式字段、屏幕空间、圆柱多pass及其他不支持状态明确拒绝。RGB使用Babylon ALPHA_ADD/ALPHA_COMBINE对应SRCALPHA/ONE或SRCALPHA/INVSRCALPHA；Babylon对帧缓冲alpha使用不同因子，原SeparateAlphaBlendEnable状态未确认，尚未宣称帧缓冲alpha忠实还原。深度比较LEQUAL仍需原设备状态证据；浏览器检查证明当前遮挡行为，不证明原进程所有默认值。

`effect-render-check.html`和`src/effect-render-check.ts`为独立开发检查入口，未加入主游戏流程。`test:effects:browser <CDP URL>`在Chromium编译实际着色器，用RGBA=(200,100,50,128)纹理与量化顶点颜色，读取64×64画布中心像素，四pass的RGB调制/加法/透明公式误差不超过2。另加入深度写入前景平面，验证index7/9被遮挡、6/8继续混合。1×1纹理不能证明复杂UV朝向/POINT边界/WRAP寻址，多分辨率/实战性能未验收。

`test:effects`增加NullEngine顶点/UV更新、材质设置、拒绝隐式剔除、dispose幂等/纹理所有权检查；实际像素证据`browser-effects.json`。此轮推进到可执行渲染层，但没有自动加载全库或绑定开火/挂点/轨迹/节点生命周期，未改变战斗画面。

## 原爆炸图集、帧时钟与完整图块像素

`effect-sprite-atlas.ts`组合已恢复EffectFrameClock、原uvFrames和EffectSpriteMesh，按每次原更新最多推进一帧的规则更新真实顶点UV。reset选择原初始帧；配置帧数与图集数量不符拒绝。该类不推断节点触发、寿命结束或挂点，也不负责模型/轨迹历史，不替代完整特效生命周期。

浏览器检查新增实际原节点2431图集：PNG发布源哈希校验、256×256图的16个64×64原UV、控制器约0.02秒间隔/标志1、原初始RGBA量化0xffffff00、原selector7。Texture使用noMipmap=true/invertY=false/POINT/WRAP，保留PNG第一行对应原UV v=0。测试定义的四角顺序、原X反射与framebuffer底部起始读回共同决定像素方向；不能把此结果扩大成原相机/动态挂点几何朝向也已复刻。

每帧真实渲染并读取完整64×64区域，共65,536个像素，将原PNG对应图块按坐标反射/读回方向、原量化颜色和加法混合公式对照。16帧每个RGB像素误差均0，每帧有亮像素，16份实际像素SHA256互异，证据browser-effects.json.explosion.frames；不只检查资源载入或帧索引。半间隔不推进、两半间隔到达边界推进、末帧大delta继续停留通过。资源退出清理保留此前pass/深度/所有权检查。

该检查使用固定几何/黑背景与原初始颜色，验证原图实际采样与帧切换。没有按原尺寸/速度/寿命驱动对战粒子，没有检查亚像素过滤/复杂UV溢出/全部图集，也不代表高清联机性能。节点生命周期、坐标/挂点事件、轨迹、其他特效类型与隐式材质状态继续恢复。

## 原相机空间billboard四角

`effect-billboard.ts`实现0x481b62–0x481c38的billboard分支：中心已在原相机空间，尺寸X/Y为半宽/半高，Z尺寸不参与平面四角；角度取实例angles.z，使用原f32常量0.01745329238474369转弧度。cos先写f32、sin保留扩展值，部分乘积按原中间存储写f32，最后角点存f32。零角四角顺序为左下/右下/右上/左上。此函数不做相机变换、模型挂点矩阵或非billboard三轴旋转，调用者不得直接把世界中心当相机中心。

`effect-billboard-native.py`执行原角点指令和原CRT cos/sin路径，覆盖全部源控制器的位置/尺寸/角度数据及0/30/45/90/180/270/360/-30度样本，两x87精度共2,192组。当前全部Web结果与原f32四角精确相同，最大相对误差0；不推断所有可能巨大角度的JS与CRT三角函数都逐位相等。证据effect-billboard-native.json带原EXE哈希。

独立原爆炸检查改用此函数产生零角四角，修正此前手写左上起始的测试几何；原PNG参考行按此角点/UV/底部读回规则对应，无人为翻转Texture。16帧整图块像素检查继续通过。使用的中心/半尺寸仍为测试固定0/2，尚未接入原战斗相机和原尺寸运动，原相机映射方向和动态挂点继续待验收。

## Web相机billboard适配

`effect-camera.ts`将原XYZ中心经X反射转入当前Babylon view，在相机空间使用已对照原x86的billboard角点，再通过inverse view回到原XYZ；`EffectSpriteMesh`最后执行一次坐标反射。它适配当前Web相机，未恢复原相机控制器或挂点矩阵。

24组平移/旋转相机、中心与角度样本验证投影后角点及半宽/半高保留。独立原爆炸检查使用此适配函数，16帧真实像素检查通过；该检查仍使用固定测试中心和尺寸。

## 类型1完整轨迹历史顺序与采样

`effect-trail.ts`提供完整实例快照历史：原0x482b24启用轨迹时按limit数量预填相同的80字节初始状态，未启用时仅一份。实际478份启用控制器limit=1–64、interval=.005/.01/.025/.08（均按源f32）；每份历史包含位置、环绕偏移、速度、角度、尺寸、RGBA和帧索引。

0x483161累加delta并存f32，但达到间隔的比较仍使用尚未舍入的x87和；相等即采样。每次仅减一次间隔，将旧头状态复制到前面，再将新头替换为当前完整状态，超limit从尾部删除。未到间隔也更新头状态，旧条目不再各自积分。禁用轨迹裁为一份并将时钟归零。控制器切换到更大limit时并不立即补满历史，后续采样每次增长一条。独立模块不负责轨迹几何、模型变换或controller reset。

`effect-trail-native.py`直接执行原初始化分支、原ring push-front/push-back、查找和完整80字节赋值；分配/SEH复制构造器使用测试替身，禁用时resize(1)的容器裁剪使用替身。全部1,088控制器×两x87精度共2,176组初始化与源字段一致；每组6步共13,056步原采样/历史顺序/裁剪与Web逐条字节一致。初始化使用已附模型与零环绕输入，未证明外部模型或路径转换。证据`effect-trail-native.json`。

## 类型1控制器reset

原完整reset 0x481fc0不重置帧索引或帧/轨迹时钟。基础flag非零时保留当前位置、速度、角度、尺寸和颜色，只更新环绕偏移；flag零时用已解析的配置位置/速度/角度/尺寸/颜色替换头状态。历史条目不随头状态reset。

`effect-sprite-reset.ts`接收已完成原模型/路径/环绕变换的位置与环绕偏移，保留全部80字节状态的字段对应关系。`effect-reset-native.py`直接执行完整reset函数（已附模型、无路径/环绕输入，不使用回调替身），全部1,088配置×两flag×两x87精度共4,352组与Web逐字段一致，帧保留、栈平衡通过。证据`effect-reset-native.json`。该结果不证明外部变换或动态挂点已恢复。

## 节点生命周期分派与子节点顺序

`effect-lifecycle.ts`实现原状态0（未启用）、1（等待delay）、2（活动）、3（结束后等待子节点）的时间/控制器/回调分派。0x47eeb3开始时清elapsed与controller=0、进入1；状态0的tick不累加elapsed。达到delay时先进入2并调用activate，逆序启动子节点，随后以f32(elapsed-delay)执行第一次活动更新。普通活动更新使用传入delta，控制器reset按边界推进顺序执行；只有controller>=0才检查结束或执行类型更新，随后始终逆序更新子节点。

到寿命边界时当帧转3并调用end，仍更新子节点；下一次tick在无子节点且原+0x3c为0时release。若最后子节点在本次tick释放，父节点下一次tick才释放。+0x3c非零保留结束节点；模块名`retainWhenEnded`仅描述这段分支，未扩大为完整原所有权策略。普通子节点release从父列表移除。模型引用存在时使用另一条子节点start(+0x34)路径，其具体空间输入仍待恢复；当前模块hooks提供type-specific start/activate/update/end/reset/release/additionalEnd，外部负责模型空间与特殊类型行为。

原sprite虚表+0x28为无操作，+0x38才是0x482960完整实例初始化，不能在激活时再次初始化而重置帧/状态。源time dispatch/controller selection/lifetime/end分支直接执行，虚方法与池释放使用记录回调。全部3,118时间配置×两retention共6,236序列、56,124 tick与Web的状态、f32时间、controller及事件完全一致。另4组真实父子分派检查逆序start/update、子delay、跨控制器reset、结束后等子节点和父释放顺序；回调替身执行父列表移除，不验证原容器内存分配/池归还。证据`effect-lifecycle-native.json`。这恢复基础节点生命周期，不代表其余效果类型、动态挂点或实际战斗播放已完成。

## 类型6发射计数与随机消耗

`particleControls`导出678类型6节点的985控制器：已确认countRange、burst、发射器位置/速度、环绕、pathEnabled和renderFlags。全部985控制器由原0x478626完整执行读入，测试流读取替身仅传送实际原字节，再对导出字段逐一核对；不靠另一份手工偏移表构造原对象。

`effect-emitter-clock.ts`复刻0x480138。每次先调用原含端点整数范围抽样，burst首次发射所抽数量并标记已发射，后续仍抽随机但不发射。连续分支将count×delta向零截断成整数数量，把余数累加至f32 fraction；比较未舍入和达到1时只追加一粒，再从已存f32 fraction减1。不是按总elapsed取粒子数量，也不能省略已完成burst的随机调用。原985控制器×两x87精度共1,970时钟、13,790步，含零delta/大delta/端点抽样，与Web逐值一致。随机回调替身提供已选数量，未复刻原CRT全局种子/序列；原发射loop/粒子初始状态/容量和逐粒更新继续待恢复。

## 类型6逐粒初始化、更新与容量

`effect-particle-spawn.ts`按原0x47fdbb顺序抽样alpha、寿命、尺寸、RGB、角度变化、速度、加速度、初始角度、帧，再按点/盒/圆盘分布生成位置。原985控制器shape0/1/2数量603/17/365；圆盘抽的是均匀半径，不替换为面积均匀sqrt分布。原float范围先存f32(max-min)，rand整数乘范围再乘原f32(1/32767)后加min；即使min=max也消耗随机。圆盘cos使用未舍入抽样角度、sin使用该角度的f32副本。原parent matrix为零时只将visible清零；有效parent变换位置与速度，未变换加速度；无parent时用全局矩阵RotateIn速度和加速度。

`effect_native.py`映射当前原EXE、gbengine.dll、msvcr71.dll并按实际导入/导出绑定。初始化函数全程使用原矩阵与三角CRT，回调替身仅提供文件字节流、CRT rand值和全局manager指针。全985源控制器×3parent输入×3随机序列共8,865完整原spawn与Web全字段及随机消耗一致。原随机全局种子/调度仍由调用者负责，测试没有证明完整游戏随机序列相同。

`effect-native-space.ts`恢复原Normalize/Rotate/RotateIn/Transform：Normalize长度严格小于.005时返回+Y，相等则规范化；逆长度以f32存储长度为除数。4,156规范化、12,438矩阵样本（全部源轴/位置/速度与三矩阵、两x87精度）使用实际gbengine与msvcr71执行，对照Web逐值相同。原in-place Transform的加法顺序单独保留。

`effect-particle-state.ts`覆盖源985控制器的motion0/1/2/3与角度、帧、alpha更新。mode0/3为逐帧先更新速度后位置，mode3先更新加速度；mode1/2接收已解析原坐标target，保留规范化/长度/age-lifetime计算和各中间f32写回，不补连续运动项。原motion1/2/3分布7/14/19，其余945为0；alphaMode1减少delta/lifetime，2增加，0保持。原完整逐粒函数×两x87精度×4delta共7,880样本与Web全字段、随机次数相同；目标矩阵/模型获取仍由外部提供。

`effect-particle-pool.ts`保留原固定capacity。每次尝试发射先分配可用槽，满容量时不运行spawn（不消耗其随机）。原前向更新先累加age，达到寿命时用尾状态覆盖当前槽并减count，随后index递增，换入粒子当帧跳过。visible=false也仍更新age/运动；可见性仅影响draw。16组数组/128原循环验证该顺序、等值边界和tail-swap；memcpy与逐粒回调使用替身，分派/age/原循环执行。end原0x47fbc9清全部count与fraction、burst标记置1，不自动延续已发射粒子。

类型6GBF选择0x480fde与类型1普通分支一致；985实际选择和260原flags样本已对照。`effect-particle-renderer.ts`用原scalar半尺寸、angleZ、帧UV与颜色，把可见粒子按原数组升序合并在单draw内；`EffectSpriteMesh.updateQuads`复用原四边形对角线。当前仍只接受显式no-cull脚本6–9；新粒子渲染尚待浏览器实际图/生命周期验收，不能扩展此前单爆炸像素结论。

## ELK动作键与tag绑定分派

原gbengine `gbCrc32Compute` 0x10032700对短字符串以首四字节大端排列；直接执行证明ELK键0x30330000为动作`03`，0x30390000为`09`。`effect_action_keys.py`仅复刻原发布接口的动作/字符串ID，未新增校验摘要。11个实际相关字符串与原函数一致，证据`effect-action-key-native.json`；导出新增actionKeys。

ELK尾部+0x28c为有符号bindingMode，22条=3，158的09/attack1=0；+0x290源float均0，实际使用语义尚未确认。首u32运行时会被0x4661c9替换为原目标effect名称ID（attack1），不能将原存储样式字节直接当运行指针或ID。原0x46610f另为goto_action批量替换目标ID。

动作事件分派0x4675a1先按角色当前动作+0x20c与回调event名字取记录。mode3检查指定tag存在（0x466676），取其共享gbMatrix4引用（0x46748f），0x47b29e按effect ID创建/复用节点并调用+0x34开始。有效矩阵引用会持续用于sprite渲染与particle空间转换；不能只取一次tag位置而丢失旋转/跟随。mode0在此分派调用0x47b510，以零位置进入世界start。mode1/2是世界位置分支，mode4额外绑定model目标，当前ELK没有实际1/2/4样本。

`goto_action`为独立事件路径，三/四部件函数从已保存ID找到效果并重开始/绑定；它不能替代真实attack1/effect1触发。原tag矩阵维护、MV3 tag动画与部件合成及动作事件实际时机继续待接入，当前不直接绑定Web开火或死亡。

## 世界入口与MV3消息时钟

`effect-world-start.ts`恢复0x47b1f0的查找→按需创建→加入活动列表→+0x38世界start顺序。0x47b510模式0构造(0,0,0)后进入此函数；158的09/attack1不能自动改为车体中心。16组完整原入口与Web一致，查找/创建/列表和虚方法使用记录替身，未验证原池实现。

`effect_action_events.py`导出704原部件动作的MV3消息时间和字符串ID。MV3头部的tags记录是u32时间+16字节事件名；原loader 0x1000c6d6计算名称ID并写运行时24字节记录+0x14。它与tag_efattack等空间挂点轨道是不同的数据。

`effect-action-events.ts`实现原0x1000bdc0区间查询：previous对duration取余，current-previous及其与余数的和都按u32回绕；消息时间严格大于previous余数、包含current边界。跨duration时最先加入ID0x6f766572（over），再按原存储顺序扫描消息，可经过多次循环。原0x1000be90按名称ID返回首次对应消息时间。完整原函数704动作/5780区间和所有源消息lookup与Web一致；不依赖另一份手工公式生成预期。

0x1000a7d5–0x1000a7ec的actor时间步读取gfx delta double，乘节点+0x34的f32 timeScale，再乘原常量4800.0，调用原CRT向零截断。f32 scaledDelta旁存用于混合，时间步使用未舍入的x87积；每帧无小数累积。100组实际原指令和CRT样本覆盖53/64位精度，Web逐值一致。64位路径保留两次乘法舍入；典型1/60秒在53位为80、64位为79，不能直接用JS相乘替代全部原情况。

原基类构造器0x1001e475写timeScale1，actor构造器0x1000a495调用它。三/四部件战车载入0x469f70/0x46d3dd保存actor、设置消息/初始动作，未设置另一个scale；已定位SetTimeScale导入0x5c0af8，其角色挂件初始化路径暂设0后恢复1。进程实际x87控制字仍待确认，因此`effectActorTimeStep(delta,timeScale,precision)`要求显式53/64。单动作范围终止与over优先分派见下节；混合多动作优先级及角色部件转发继续待恢复。001 attack1为1920、105为1760源时间单位；完整tag矩阵维护与战斗事件接入继续待完成。

## CRT精度、单动作停止与局部挂点

原EXE入口0x57dee3经0x57e021→0x57eacd(1)→[0x620998]=0x57a968→0x581b99，以mask0x30000/new0x10000调用原_controlfp。完整原助手从三初始控制字执行都将PC设为0x200（53位），证据`effect-fpu-native.json`。gbengine 0x10022c25–0x10022d0c的CreateDevice参数flags实际选择0x20/0x80/0x40/0x50/0，没有FPU_PRESERVE bit0x2；CRT初始化证明不能代替D3D创建后控制字的运行证据。

`EffectActorActionClock`提供简化GotoAction(id,flags)单个立即切换动作的原时间/消息接口：初始time1，循环时time持续增长，stopAtEnd在time>=duration后夹到duration-100，返回并清除overMessage。之后仍每帧累加time，达到duration时再次夹回duration-100；例如001M03完成后的1/60步长令time2781→2861→2781，over不再发送。显式over当帧不再查询其他事件。完整原actor Update对03/09全部152源部件动作×两个stop选项，304序列/5168tick与Web一致。原def矩阵更新和最终消息接收用替身，gfx delta由原FLD double返回替身提供；CRT、原主循环、停止判断与真实模型event query全部执行。多槽混合选择和回调切换动作尚未实现。

`effect_tag_tracks.py`从实际22条mode3 ELK记录关联03/09部件轨道，发布77条tag_efattack/tag_efcenter。`sampleEffectTag`恢复完整原0x1000b800：time按末帧time取余、选择相邻帧，XYZ分别保留原中间精度；四元数最短路径slerp或近值线性分支，W取负后按原gbQuaternion::ToMatrix写矩阵，再加入位置。额外九个源float仍保留，当前sampler不使用它们。末帧time而非模型duration决定挂点循环；例如03动作duration2881，但轨道末帧2880。

全部77真实轨道的每个帧起点/间隔中点/下帧前一时间单位及循环边界×两x87精度，共8570完整矩阵与Web逐值相同，证据`effect-tag-tracks-native.json`，未替换原CRT或Quaternion/Matrix为测试数学回调。这里恢复局部动态矩阵；原局部矩阵需继续经过下节的车体/炮塔世界合成后才可用于战斗世界挂点。

## 主挂点世界矩阵

原主挂点表0x6d2258的7个名字由0x5be501–0x5be57d初始化：tag_efcenter、tag_effront、tag_efback、tag_efleft、tag_efright、tag_efsoot、tag_efattack。三部件0x46a786仅从M查tag；四部件0x46dcde先M，失败后0x46dd03查U，再失败用Zero矩阵。有效矩阵才执行旋转/平移。

三部件0x46a7a4–0x46a811用车身角+0xbc生成Y轴矩阵、RightMultiply到tag矩阵，再加角色+0x28/+0x2c/+0x30。四部件0x46dd46对index6使用炮塔角+0x34c，并在旋转矩阵上加+0x368/+0x370缓存枢轴，其他index用车身角；然后相同RightMultiply及角色位置加法。后续以原+Z/180度四元数LeftMultiply校正。原构造出的四元数为(0,0,1,1.2167964413833943e-8)，不能用理想180度矩阵替代其微小非零项。

`effect-tag-world.ts`以原角度单位degree和未反射原坐标实现此段运算。测试77真实轨道×三时刻×三姿态×三分支=2079完整矩阵逐值一致，证据`effect-tag-world-native.json`；原EXE变换指令及完整gbengine Rotate/Multiply/Quaternion/CRT均执行，容器查找和矩阵来源由输入提供。共享矩阵由下节store维护；部件来源读取/最新动作时钟与真实战斗事件绑定继续待接入。

`EffectPrimaryTagMatrices`按原7个主tag名称缓存独立数组，get返回稳定引用，update逐元素改写而不替换。初值为原gbMatrix4默认构造器0x10031f30从0x100531e8复制的单位矩阵；未找到当前动作tag时用Zero。source.read提供M/U局部矩阵，threePart只M、fourPart在M缺失时才U。Web测试使用2079原世界矩阵中的真实连续样本，验证持有引用持续更新、缺失时Zero和M→U查询顺序；原map分配/共享引用计数不是此检查的执行对象。

战斗接入需将最新各部件原时钟用于sampleEffectTag，按body/turret原角度degree、缓存原枢轴与原XYZ更新矩阵store，再将get(name)引用交给mode3效果start。TankView当前actionMessages提供part/action/time/identifier，效果记录还需按角色当前动作/事件名查ELK。当前独立模块无战斗事件绑定，完整特效树与所有类型实战渲染仍待恢复。

`effectTurretPivotCorrection` 接受 M/01/time1 的 `tag_c` 缓存XZ、车身绝对角、炮塔绝对角和原车身up，恢复动态炮塔平移补偿；`EffectTagWorldPose.pivot` 接受该补偿XZ。144个完整原计算样本与Web逐值一致。当前战车水平姿态使用up `[0,1,0]`。

类型6节点17的完整发射/分配/spawn/同帧寿命更新九步与原执行结果及共享随机消费一致。独立真实 `yan1` 三粒子12幅128×128 Web画面全部RGB误差不超过2，包含重叠顺序、旋转/运动、隐藏、寿命删除、重启/清空/释放。使用 `npm run test:effects:particles:browser -- <CDP端点>` 运行，先执行 `npm run test:effects` 生成原状态fixture。原D3D设备画面及完整效果树尚待完成。

类型6完整基础生命周期组合覆盖全部649个非path、非target依赖源节点（含多控制器），共5,192真实原tick。生产Node+Lifecycle与原执行的phase/time/controller、各控制器space/orbit、共享随机消费、发射余数及全部粒子字段逐值一致。验证 `tests/effect-particle-all-lifecycles-native.py`、`tests/effect-particle-all-lifecycles.cts`；管理器release仍为供给回调，target/path组合与原树所有权继续恢复。

全部九个原路径类型6节点的world start、基础生命周期、path空间、发射和完整粒子数组组合，72原tick与生产Node+Lifecycle逐值一致。验证 `tests/effect-particle-path-lifecycles-native.py`、`tests/effect-particle-path-lifecycles.cts`。此结果仍使用显式提供的路径末端相邻vec3 `[0,0,0]`，不证明原heap相邻存储；无默认末端替代。

类型6全部20个目标运动源节点的完整world start/lifecycle/spawn/pool组合已验证，世界和旋转平移parent两组共320真实原tick。原 `0x480430–0x480459`、`0x48054d–0x480576` 以活动发射器position加orbitOffset为目标，存在parent时执行原TransformInPlace；生产Node自行解析该目标。mode1位置积分保持X未写回的rate、Y写回rate但未写回乘delta、Z两次写回的精度顺序。全部随机消费、空间、生命周期及粒子字段与原逐值一致。验证 `tests/effect-particle-target-lifecycles-native.py`/`.cts`、`tests/effect-particle-target-parent-lifecycles-native.py`/`.cts`。原节点+0x78的外部force provider分支、原树/heap所有权与D3D完整画面仍待恢复。

类型1 `0x482eba–0x482fbb` 的完整加速度空间转换、速度/位置积分与orbit组合已恢复为 `advanceEffectSpriteSpace`。1088原控制器×parent两状态×资源modelAligned两状态×五tick，共21,760原空间tick与Web逐值一致。无parent时原管理器全局RotateIn作用于加速度；有parent时保留local加速度。modelAligned资源跳过orbit，其余按elapsed减baseStart计算原axis quaternion，angularRate为0保留已有offset。共享orbit函数沿用已验证类型6原算术；类型6全部空间/path/reset回归通过。验证 `tests/effect-sprite-space-native.py`、`tests/effect-sprite-space.cts`，原DLL/CRT执行；此段不含前置model force方向速度解析、后置path/frame/trail或整类型1生命周期。

`EffectSpriteNodeState` 已组合类型1start/reset/update的原position/velocity/orbit、appearance、frame余数和完整trailhistory；类型1结束虚方法为无操作，由外部基础生命周期处理。843个全部非路径源节点（含多控制器），真实world start `0x482960`、type1 vtable `0x5c9bf0` 与原基础生命周期，共6,744tick的phase/time/controller、共享随机消费、frame余数、trail时钟和全部80字节历史状态，与生产Node+Lifecycle逐值一致。world start清历史并按trailLimit填充，启用trail时清trailElapsed，未启用时保留到首次update清零，controller reset只改当前历史entry、保留帧及两时钟；baseFlag保留position/velocity/appearance，orbit仍重置。源controller无parent时start/reset对velocity执行原globalRotate。验证 `tests/effect-sprite-lifecycles-native.py`、`tests/effect-sprite-lifecycles.cts`，原DLL/CRT执行；原历史clear/free/copy分配与managerrelease由供给storage/callback替代。当前full-node样本使用identity管理器旋转、无parent/force provider、无children；独立空间样本已另覆盖旋转/parent。唯一源路径节点107、模型force provider、树所有权和实际完整绘制继续恢复。

唯一类型1路径节点107（guihuo）引用实际 `guihuo.3ds`，49原顶点、mode0、rate12。原资源loader `0x4765ff` 读取pathFlag `+0x154`、mode `+0x158`、rate `+0x2a0`，绑定 `0x4832ce–0x4832e1` 将mode/rate传入路径。`effect-path-tracks.json` 的spriteRows保存真实顶点并由原3DS轴转换验证；路径数学oracle扩大为30序列/270tick。完整类型1节点107的11tick覆盖原mode0循环，Web全部生命周期/space/frame/trail/history与原执行逐值一致，start reset路径clock并采样0，update在运动/角度后以path+origin替换position并清orbitOffset。验证 `tests/effect-sprite-path-lifecycle-native.py`、`tests/effect-sprite-path-lifecycle.cts`；该源单控制器无controller reset分派，原heap/force provider与整树绘制仍待恢复。

类型4声音节点由真实vtable `0x5c96d0` 确认；resource `0x476b09` 读取324字节reference、u32 parameter、stopPrevious字节。230全部源声音节点×duration/finished两状态，共460原完整生命周期/3,220tick与生产 `EffectSoundNodeState`+Lifecycle的phase/time/controller、首次play/finished查询/stop/release顺序逐值一致。world start只清started标志，update首次调用 `0x4858f2(reference,parameter)` 并复制24字节handle到自身与共享 `0x6d2800`；后续update不重播。结束查询 `0x474086` 在原duration结束时先stop，随后end `0x4740ed` 再stop；原生命周期回调现在接收base lifetime结束值，始终执行该查询方法，保留这两个stop调用。backend finished也可使节点结束；end不清started/handle。验证 `tests/effect-sound-lifecycles-native.py`、`tests/effect-sound-lifecycles.cts`；原play/handlemanager/finished/stop和poolrelease使用记录供给backend，尚未验证原音频设备或接入战斗实际声音。全部源stopPrevious为0，共享previous停止分支已读原指令但未扩大这组源样本。类型1/6组合回归及6,236基础生命周期序列/56,124tick通过。

类型7 vtable `0x5c93d8`、原modifier loader `0x477337` 与update `0x474642` 已确认。567源节点的585控制器×parent两状态×五tick，共5,850原state更新与 `advanceEffectStripState` 逐值一致，覆盖position/velocity/orbit/angles/scale/color/frame余数和随机消费。原 `0x4746fc–0x474708` 旋转加速度到temporary，但 `0x474715` 随后从controller local acceleration调用积分，Web保留这一实际行为。scale增量为delta×scaleRate×baseScale，负结果夹0；color加rate，原重复夹alpha四次，RGB不夹。原UV strip写入 `0x4749b5–0x474a90` 在此oracle跳过，节点provider为0；无法据state验证声称完整geometry/render或生命周期已完成。全部类型7源pathFlag为0。验证 `tests/effect-strip-state-native.py`、`tests/effect-strip-state.cts`。

类型7真实纹理grid已纳入textureGrids（共2,089类型1/6/7源资源）。`advanceEffectStripUv`恢复原 `0x4749b5–0x474a90`：scroll按delta×rate累加，超过1才清0；V按向零取整去整数，U以f32步长在x87中逐段累加，允许超出单帧区间。全部585源控制器×两parent×五tick，共5,850完整原state+UV步骤与Web逐值一致。`initialEffectStripGeometry`恢复原 `0x474f60` 的交替半径、段角度/高度增长、四角、UV与packedcolor；1170源控制器/parent几何的每个68字节segment逐值一致，原CRT sin/cos执行。sin使用未写回的degree转rad、cos使用f32 rad，保留原精度。验证 `tests/effect-strip-uv-native.py`/`.cts`、`tests/effect-strip-geometry-native.py`/`.cts`；几何分配由预留storage供给，完整start/reset/provider/lifecycle、变换/材质和Web实际像素继续恢复。

`EffectStripNodeState` 已组合原type7geometry初始化、world start、controller reset、完整state/frame/scrollUV，567全部源节点（含多controller）共4,536真实原生命周期tick逐值一致。原binding几何初始化先使用controller0的color，start/后续controller变化不重写packedcolor；start清frame余数但保留scroll；reset重新选frame并清frame余数、重置color，baseFlag只保留position/velocity/angles/scale，orbit仍重置。原节点end为noop。验证 `tests/effect-strip-lifecycles-native.py`、`tests/effect-strip-lifecycles.cts`，执行真实vtable/worldstart/lifecycle/geometry/DLL/CRT；预分配geometry和managerrelease供给，provider/children为0。stripControls发布585真实controller与geometry参数。完整3D变换/材质/像素与tree/heap/provider继续恢复。

类型8唯一源节点905（liefen）的两控制器已导出overlayControls，真实pingmu2.tga与4帧grid纳入textureGrids；共2090源grid、2022发布纹理。生产EffectOverlayNodeState与真实type8 vtable/world start/reset/update/base lifecycle的19tick逐值一致，涵盖两控制器边界、帧余数保持、alpha积分夹取与结束释放。EffectOverlayDrawState恢复原screen rectangle初始化和UV保持/packedcolor；800×600与1920×1080、源生命周期颜色/帧、textured及原untextured分派共76绘制样本逐值一致。验证effect-overlay-lifecycle-native.py/.cts、effect-overlay-draw-native.py/.cts；原render接口、material初始化和poolrelease由记录callback供给，未验证D3D真实framebuffer或接入战斗画面。

类型10全部4源节点与类型11全部30源节点的真实vtable/base lifecycle组合，306tick与EffectScreenNodeState逐值一致，包含delay/start/controller/end/release及backend调用顺序。类型10激活调用原manager select(5,0)，结束clear；类型11仅lifetime>0时调用gfx虚方法的parameter/lifetime/strength三参数，screenControls发布原u32/f32字段。验证effect-screen-lifecycles-native.py/.cts；backend供给记录接口，尚未恢复原postprocess绘制或camera shake积分，未接入实际战斗。

类型5全部31源模型节点（含多控制器）×identity/旋转平移global×两parent状态，共124原完整生命周期、1364tick与EffectModelNodeState逐值一致，含world start/controller reset、position/velocity/orbit/angles/scale/alpha及模型backend setTime(0)/setRate/update调用顺序。原reset保持alpha，baseFlag保留原运动/角度/scale但orbit重置；全31源pathFlag为0。modelControls发布全部原控制字段、模型reference与animationRate。验证effect-model-lifecycles-native.py/.cts；模型backend与poolrelease用记录callback，未恢复模型动画采样/渲染/树所有权或接入实际战斗。

类型2全部101源lightning节点×两origin×连续四次共享随机生成，共808原端点/local segments/world segments样本与generateEffectBoltSegments/effectBoltWorldSegments逐值一致，包含所有随机消费、255中间段上限、末段补齐、原two-vector quaternion与全部40字节world segment。原direction Transform含translation后归一化，末段X差使用未写回length，生产实现保持原行为与精度。boltControls发布源端点、interval/width、length/angle ranges及颜色字段。验证effect-bolt-segments-native.py/.cts，原CRT/DLL算术执行、geometry预留storage；parent/target provider、完整生命周期、billboard/UV渲染与真实battle接入继续恢复。

类型2全部101源节点×两origin的完整world start/type2 vtable/base lifecycle/local+world geometry组合，202序列2222tick与EffectBoltNodeState逐值一致，覆盖共享随机消费与所有分段字段。原update每tick仅重建一次，保留interval超额时间而不循环消费；原world start立即构建。验证effect-bolt-lifecycles-native.py/.cts；无parent/target provider/children，geometry预分配与poolrelease供给。原billboard/UV/render及真实battle接入继续恢复。

原recursive tree creation 0x4795fa与真实lookup 0x479296已恢复createEffectTree/findEffectDefinition：按source child顺序递归create后attach，retain传递给全部后代，缺失definition跳过。lookup按source vector线性查找，ID0返回缺失，重复ID返回首条definition。3118个全部源查询×retain两状态，共6236原树创建、35218创建节点的顺序/attach/retain结果与Web逐值一致，含重复ID、99未解析引用与真实ELK根树。验证effect-tree-create-native.py/.cts；真实原lookup/recursion执行，pool allocation/attach使用记录供给；池所有权、attached空间start和整树状态/渲染继续恢复。

真实ELK链接根online004（node2429与两type1/三type6children）整树的原world start/base activation/逆序子启动与update/结束remove组合，13tick与生产Lifecycle+SpriteNode+ParticleNode逐值一致：phase/time/controller、共享随机消费、全sprite历史/frame/trail、emitter空间/余数/burst和全粒子字段，以及child remove/release顺序。验证effect-online004-tree-native.py/.cts；真实原vtable/CRT/DLL执行，供给history/particle storage及release callback，无attached parent/provider，未验证完整绘制。

真实ELK链接根online006的17节点混合树（type0/1/4/6/7）已执行全部原vtable、嵌套逆序child start/update与基础生命周期。13整树tick的共享随机、sprite历史/frame/trail、全部粒子与emitter、strip完整state/scrollUV、声音sharedhandle/play/finished/stop及子节点remove/release顺序，与生产组件组合逐值一致。验证effect-online006-tree-native.py/.cts；geometry/history/particle storage、声音backend和release由供给接口替代，无attached parent/provider，原材质/最终像素仍待验证。

## 战斗树调度与渲染

`EffectRuntimeTree`通过原lookup/create/attach组合真实源树；online004/online006的world及attached各13tick直接验证生产类，attached parent矩阵每tick改变。TankView发布原动作消息后，`EffectRuntime`按ELK动作key和event identifier选择记录；保留标签矩阵引用或执行world零坐标启动。运行时在TankView更新之后tick，按source子顺序绘制；sprite历史逆序且颜色取history0，strip当前颜色覆盖静态几何颜色。sprite/strip的Translate→RotateX→RotateY→RotateZ由原DLL矩阵栈3346样本验证（绝对误差上限0.0000038147），particle沿用已验证billboard。

GBF渲染状态继承由有序Map保存；缺省CullMode初始使用CCW，其后的原NONE/CW/CCW显式设置影响后续draw。PNG载入完成后允许进入战斗；退出玩家、回合重置和断线/退出处理特效资源，停止时屏蔽后续动作消息。无时限type0容器在所有非容器节点释放且无容器等待激活时回收Web绘制对象。原声音reference匹配audio目录，由实际浏览器Audio播放，音量与战斗设置相同。

实际协议CPU个人战的Chromium验收确认枪口、烟、105死亡朝向sprite/strip和原texture资源渲染；同一死亡帧隐藏特效后的GPU像素变化5207，退出残留0。脚本 `npm run test:effects:battle -- <CDP WebSocket URL>`，证据 `browser-effect-battle.json/png`。局限为原D3D framebuffer/设备初始完整状态、alpha通道、camera、FPU、池ownership、缺失ww154解析，以及非ELK引用效型的最终渲染。

原manager `0x4790dc` 对active root vector逆序update，`0x479192`/`0x479146`正序render；0–4根的原执行顺序已供给node callback记录验证，生产EffectRuntime先逆序更新全部树、再正序绘制，保持多棵树共享随机消费顺序。验证 `effect-manager-order-native.py/.cts`。

每类型pool `0x47f90a`/`0x47f1bc`的创建、复用、解绑回调、active-prefix交换与inactive重复release共17操作，与 `EffectObjectPool`逐值相同；factory/storage/unbind由供给callback替代。`EffectRuntimeStatePool`在battle sprite/strip复用时保存仍存在的时钟/scroll字段，源树通过额外26tick的原retained-state对照（初始trailElapsed0.013、strip scroll0.375）。原sprite启用trail的world start清trailElapsed，未启用时保留到首次update清零；strip start保留scroll，Web保持这些规则。完整原gfx绑定、堆资源分配/ownership仍待恢复。验证 `effect-object-pool-native.py/.cts` 与两source-tree `--retained`；843 sprite、567 strip生命周期及attached树回归通过。

## 类型2闪电最终绘制切片

全部101个原闪电源的纹理reference解析为原`Data/effect/effect/Bolt.dds`与已发布`Bolt.png`，独立导出`boltTextures`。`effectBoltDrawVertices`恢复原EXE `0x47d56e`的矩阵变换、相机方向、未归一化叉乘宽度和递归平均边；DLL `0x10025dc0`每切片仅提交左／右顶点，首切片U=0，其余U=1，末切片重复最后一对边。`EffectSpriteMesh.updateTriangleStrip`保留交替三角绕序，输出Web X反射一次。

101原源×3相机×2矩阵共606组与原EXE／DLL执行对照，UV／颜色逐值一致，顶点最大绝对误差0.000003814697265625。101次完整原`0x47d935`绘制入口确认全部源flag=1选择GBF7、动态buffer格式0x15、原texturearray材质及Push→LoadIdentity→Render→Pop顺序；图形后端和manager lookup由供给callback记录。202完整原生命周期／2222 tick现直接验证生产`EffectRuntimeTree`。

Chromium节点131的六个相机／矩阵画面使用原纹理与GBF7，与原顶点输入的Web framebuffer逐RGB完全一致，可见像素142–989。生产`EffectRuntime.playWorldEffect(view, sourceName, nativeXYZ)`按原源全名和世界坐标创建源树、载入纹理并生成20顶点；stop后残留网格0。验证`effect-bolt-draw-native.py/.cts`、`effect-bolt-lifecycles.cts`及`npm run test:effects:bolt:browser -- <CDP端点>`；证据`effect-bolt-draw-native.json`、`browser-effect-bolt.json`。真实CPU个人战原开火／死亡效果回归通过，当前冻结死亡帧5207像素变化，退出残留0。

### 局限

闪电属于原技能引用分支，目前真实服务器技能通知入口未恢复；浏览器闪电验收是显式源调用，不能计作真实技能对局。以上Web framebuffer对照验证原几何输入的提交，不是原D3D framebuffer对照。原设备完整初始状态、alpha通道、camera、FPU和gfx／heap ownership继续恢复；类型5模型后端与11震动已接入生产树和绘制入口；10后处理index5仍缺实际后端，当前342技能可达树无type10节点，详effect-screen-postprocess.md。

## 类型8屏幕绘制脚本与顶点

原gfx初始化`0x447c66–0x447c79`加载`ui_TL.gbf`并保存gfx+0x24；`0x447c90–0x447ca3`加载`ui_notex_TL.gbf`并保存gfx+0x20。类型8实际节点905的textured资源通过`0x48349c`选gfx+0x24；GBF完整状态保存于`rendering.overlayScripts`，含XYZRHW、SRCALPHA／INVSRCALPHA、POINT、CLAMP和禁用depth写入／测试。

IAT`0x5c0b2c`为`gbDynVertBuf::RenderUIQuad`，DLL`0x10025650`按0,1,2／2,1,3提交六个XYZRHW顶点，rhw=1，无半像素偏移。原800×600／1920×1080矩形、两texture状态及全部19生命周期步共76组，与生产`effectOverlayVertices`逐值一致，包含原`[0,height,width,0]`矩形和UV方向。验证`effect-overlay-draw-native.py/.cts`已覆盖原完整type8入口及DLL真实vertex writer。生产`EffectOverlayMesh`按原ui_TL状态、XYZRHW屏幕像素与UV方向绘制，`EffectRuntimeTree`组合实际两控制器，原完整19生命周期步逐值一致。

Chromium原节点905的19颜色／帧样本覆盖全部四个atlas帧与淡出，原`pingmu2`纹理的POINT／CLAMP采样及SRCALPHA／INVSRCALPHA混合逐像素软件RGB对照最大误差0，最多3701改变像素。生产world源全名入口生成6个屏幕顶点，stop后残留0。脚本`npm run test:effects:overlay:browser -- <CDP端点>`，证据`effect-overlay-draw-native.json`、`browser-effect-overlay.json`；源资源／渲染脚本检查、TypeScript、闪电浏览器与原ELK树回归通过。

### 屏幕叠层局限

源ui_TL不设置CullMode／AlphaTest，浏览器像素fixture显式供给NONE／FALSE，生产runtime入口验证通过此前原闪电GBF7供给相同继承状态。原设备初始完整状态与D3D framebuffer仍未恢复，不能把这些Web RGB对照称为原D3D像素一致。节点905属于技能11009；真实技能通知入口尚未接通，生产源调用不计作技能对局。

## 类型11实际相机震动入口

实际gfx构造`0x45552d`安装vtable`0x5c6c48`，getCamera slot+0x28=`0x44726c`通过gfx+0x5c管理器`0x455ed8`返回+0x14当前camera。五种camera虚表的shake slot+0x18均指向`0x4556e2`：保存parameter(+0xc4)、duration(+0xc8)、strength(+0xd0)，parameter=0改target(+0x24)、parameter=1改eye(+0x18)，其他值强制1。

实际更新`0x4558bc–0x455a3f`两次消费共享CRT rand采样[-1,1]，以camera right(+0x30)和up(+0x3c)组合，再乘`(1-elapsed/duration)*strength*0.5`并加至保留基点。严格elapsed>duration清active并清clock，但当前tick继续计算offset。逐条原指令保存`effect-camera-shake-evidence.json`；完整camera基础更新、调用顺序及共享随机流组合仍需原执行oracle，本段尚未接入Web震动。

## 类型11相机震动生产切片

`EffectCameraShakeState`恢复原`0x4556e2`启动与`0x4558f2–0x455a3c`更新。全部30源×3相机基向量，共90序列／540完整camera tick，实际原`0x57cbcb`及TLS seed执行，与TypeScript的eye／target／active／clock和共享CRT随机消费逐值一致。原完整camera update先按序调用两个子更新，再调用基础运动，随后shake；子更新和基础运动由明确供给callback提供pose，随机函数执行原指令。参数0改target，1及源参数2改eye；每活动tick消费两次rand。严格超过duration清active／clock但当前tick继续以完整幅度计算offset，下一camera tick恢复基础pose。

原gfx`0x4500ff–0x450133`四组执行确认camera先更新、effect manager后更新。生产`EffectRuntime.update`先更新相机震动、再逆序更新特效树，所以新激活shake从下一帧开始；30类型11完整源生命周期现在直接验证生产源树。共享随机流与其他效型共用。相机适配器`EffectCameraShakeView`通过view-matrix observable应用原eye／target偏移，保留现有Web ArcRotate输入position／target和基础相机行为，结束或stop重建基础view。

Chromium源384／385／671共18相机帧与原pose的view矩阵最大误差0，测试网格画面累计变化1679／7186／5528像素。生产ArcRotate原源入口验证延迟至下一camera tick、两次共享runtime rand、保留输入pose、重复启动清除旧偏移、自然到期恢复和stop恢复，残留效果0。实际原0007房间UI退出路径也确认诊断源调用后的相机恢复、玩家与效果残留0；并未收到真实服务器技能触发。证据`effect-camera-shake-native.json`、`effect-camera-order-native.json`、`browser-effect-camera-shake.json`、`browser-effect-camera-shake-leave.json`。脚本`test:effects:shake:browser`／`test:effects:shake:leave`接受CDP端点。闪电／屏幕叠层浏览器、原ELK树、TypeScript回归通过。

### 相机震动局限

原完整基础相机运动／输入仍未复刻，Web保留当前基础相机并应用已恢复的原震动数学。原gfx／D3D最终framebuffer及实际FPU控制字仍未恢复。当前用原source入口显式触发，真实技能通知尚未接入，不能将房间内诊断调用称为真实技能对局。类型5模型后端已接入正式EffectRuntime；10后处理index5仍缺实际后端，当前技能引用范围见effect-screen-postprocess.md。

## 类型5矩阵、CVD与材质切片

`EffectRuntimeTree`已支持显式type5 model backend，124完整原生命周期／1364 tick直接验证生产源树。完整原`0x47e56a`绘制入口1674样本确认递归透明度／priority和parent→Translate→XYZ rotation→Scale→global顺序，矩阵最大误差9.54×10⁻⁷。现存00012.CVD的原完整node update44 tick、mesh draw40帧／12120顶点及138个material参数调用完成对照；原clock／循环、XYZ／UV／法线与shader参数逐值一致，节点矩阵最大误差4.77×10⁻⁷。

Chromium显式图形状态下44个CVD矩阵／顶点帧RGB误差0，改变像素4283–4741，mesh清理残留0。生产渲染组件为`EffectModelMesh`；当前战斗`EffectRuntime.createTree`已挂接`EffectModelRenderer`模型backend；场景ambient／emissive覆盖和完整继承device state仍待确认。本项是diagnostic source检查，serverSkillTriggered=false。完整依据、运行入口和局限见`effect-model-rendering.md`；原资源缺口见`type5-model-resource-inventory.md`。

### type5生产模型backend

`EffectRuntime`载入`effect-models.json`并为原type5树建立`EffectModelRenderer`。POL直接保留XYZ／UV／顶点色／section材质与索引，CVD按原setTime／setRate／update驱动轨道及顶点帧；绘制使用原type5矩阵和section GBF，结束／clear／退出释放mesh与material。source引用22个中8个具备模型实物；缺失模型与m120纹理仍为资源错误。原gbGeomNode/base完整构造验证+0x7c／+0xbc单位矩阵，POL描述仅复制名称。gfx ambient／emissive初始化原执行为[0.2,0.2,0.2,1]／0；EXE无对应setter或ordinal imports，DLL无setter直接call。原gfx init/reset应用default.gbf，Apply Begin flags3；常规Begin flags0与D3DX End保留状态保存／恢复语义。模型采用原default＋section脚本，其他场景直接设备状态修改的完整继承链仍待恢复。

浏览器通过三个生产source诊断：625103(5mesh／100vertices／1230changed pixels)、13022(1mesh／6vertices／13pixels)、00012.CVD(1mesh／303vertices／178pixels)，clear后0mesh；44原矩阵／顶点帧RGB误差0。sourceInvocation=diagnostic、serverSkillTriggered=false；该证据只覆盖模型生产后端诊断，正式道具/技能触发及实际双端表现按tasklist逐项登记。独立普通CPU实战的原攻击／烟雾／死亡sprite／strip与退出清理通过，不计作type5技能触发。
