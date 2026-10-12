# 特效恢复进度

## 执行顺序

1. 收尾已实现的Web相机billboard适配文档与回归入口。
2. 恢复类型1轨迹历史初始化、采样、裁剪和控制器reset；以原x86执行对照。
3. 恢复节点状态机及子节点释放，提供独立播放接口。
4. 恢复ELK变换与动态挂点、模型/路径/环绕，协调战斗事件接入。
5. 按实际资源类型恢复其余控制器与材质继承，扩展真实渲染验收。

## 当前结果

已恢复全3,118节点记录与1,088类型1控制器，已有时间、外观、基础积分、帧选择、颜色、billboard和网格的原x86执行对照。Babylon独立检查通过原爆炸16帧完整64×64像素对照。Web相机适配24样本通过，保持原半尺寸与XYZ反射。

## 未完成

动态挂点、模型/路径/环绕变换、轨迹几何、特殊类型生命周期/结束与原池所有权、其余类型运行和隐式材质状态仍待恢复。基础轨迹历史、类型1reset、基础节点分派、mode0入口与MV3事件区间查询已完成；当前无战斗特效事件绑定，独立像素结果不等同完整对局验收。

## 轨迹历史完成

类型1历史初始化、完整80字节快照、头插复制、单次采样、尾裁剪、禁用时归一及f32时钟已实现。原1,088控制器×两x87精度共2,176初始化，13,056更新与Web逐条字节一致。已附模型/零环绕是初始化测试输入，外部空间转换和轨迹几何仍待恢复。

## 控制器reset完成

完整原reset执行4,352组与Web一致，基础flag非零保留外观/位置/速度，仅更新orbitOffset；flag零替换配置字段。帧索引和时钟不重置，旧轨迹历史保留。外部模型/路径/环绕解析继续待完成。

## 基础节点生命周期完成

`effect-lifecycle.ts`已实现原0/1/2/3分派、delay overshoot首更新、controller reset、寿命结束、逆序子节点及结束后释放顺序。全3,118配置×两retention=6,236序列、56,124 tick和4组父子树与原x86一致。虚方法/池释放是回调替身；model引用的子start空间路径、特殊类型结束与原池策略继续待恢复。

## 类型6发射时钟完成

678类型6节点/985控制器的发射与基础运动字段已由完整原loader执行核对。原发射时钟1,970序列/13,790步与Web一致，包括已结束burst仍消耗随机、连续分支f32余数和一次追加。继续恢复粒子初始范围、容量、逐粒运动/寿命/材质及真实渲染。

## 类型6完整基础粒子状态完成

完整spawn8,865组覆盖985源控制器、点/盒/圆盘、三个parent输入和三随机序列，完整update7,880组覆盖全部源运动0/1/2/3、角度/帧/alpha，Web逐值及RNG消耗一致。原gbengine+msvcr71直接映射执行，Normalize4,156与矩阵12,438样本一致。粒子池128原循环通过。独立批量Babylon粒子renderer已实现，尚待真实原纹理/多粒子像素及生命周期验收；原模型/路径/环绕动态解析仍待接入。

## ELK动作/挂点分派确认

原gbengine字符串ID执行证明ELK组键对应03/09。原事件入口区分attack1/effect1和goto_action；22条mode3使用持续共享tag矩阵，158的09/attack1 mode0调用世界原点入口。完整原字符串ID11样本通过。还需恢复tag动态矩阵维护、完整actor事件转发与战斗绑定。

## mode0世界入口完成

原0x47b510置零vec3再调用0x47b1f0。管理器关闭时不查找；开启后按ID查找，未找到才创建，成功后先加入活动列表，再调用节点+0x38世界位置start。16组完整原入口与Web返回值、回调顺序、零位置及栈平衡一致。查找/创建/列表和节点虚方法是记录替身，未把此结果扩大为原对象池恢复。`effect-world-start.ts`提供`startUnboundEffect`和`startEffectInWorld`接口。

## MV3事件区间与动作时钟完成

全部704部件动作的原timed messages已取出，旧MV3 parser的tags[].id是消息时间，名称在加载时转为字符串ID。完整原0x1000bdc0/0x1000be90对5780区间/全部源事件time lookup执行，Web查询结果一致：时间区间包含current、排除previous，跨duration先返回over，再按原存储顺序返回消息，多循环可以返回重复消息。

原actor Update用gfx delta double×actor f32 timeScale×4800后向零截断，每帧没有小数余量。100组原指令与实际CRT截断、两x87精度与Web一致。64位精度通过整数尾数保留乘法舍入，不能直接用JS double相乘：1/60秒、scale1在53位精度为80，64位为79。actor基类原构造器0x1001e475初始化scale1；三/四部件战车载入入口未设置另一个scale。原EXE CRT启动函数已执行确认53位；gbengine CreateDevice flags未含FPU_PRESERVE，D3D创建后的实际控制字仍待确认，接口要求调用者明确53/64。单个立即切换动作的边界结束与消息分派已恢复，混合多动作选择仍待恢复；不能仅用duration/4800替代逐帧时钟。001 attack1源time1920、105源time1760；这不是开火网络事件同刻启动。

## 攻击/死亡单动作时钟完成

原完整actor Update覆盖03/09全部152部件动作×两个stop选项，共304序列/5168 tick，与`EffectActorActionClock`一致。简化GotoAction原start1/end0；bit4启用时time>=duration夹为duration-100，发送并清除overMessage，之后仍逐帧累加time，下一次达到duration再夹回；小delta使槽时间在末100单位范围内变化。显式over优先于当帧timed messages；不夹持的循环动作time持续增长，由模型采样取余。原时钟/主槽选择/停止边界/真实事件查询执行；tag更新和消息接收是记录替身。多个混合动作的相互选择、角色回调更换动作仍待恢复。

## ELK局部挂点轨道采样完成

77条实际mode3 ELK挂点轨道以完整原gbengine 0x1000b800及原四元数/CRT/矩阵函数执行。所有源帧起点、间隔中点、下帧前一单位与循环边界，两x87精度共8570矩阵与`sampleEffectTag`逐值一致。原按最后轨道帧time取余，位置插值逐XYZ采用不同中间f32写回；四元数使用最短路径slerp及接近时线性插值，插值后将W取负再构矩阵。未使用整记录作为矩阵，也未规范化成另一姿态。

`effect-tag-tracks.json`发布这些轨道原字段，`effect-action-events.json`发布704动作/213消息。动态局部采样已完成，世界合成和共享引用见下节，未接入真实战斗特效。

## ELK主挂点世界合成完成

`composeEffectWorldTag`恢复三部件0x46a7a4–0x46a811与四部件0x46dd1d–0x46ddcf。三部件使用角色+0xbc车身角；四部件tag_efattack（主表index6）使用+0x34c炮塔角、+0x368/+0x370缓存枢轴，其他主挂点使用车身角。先RightMultiply旋转/枢轴矩阵，再加角色XYZ；之后原LeftMultiply +Z/180度四元数校正。原180度校正W为1.2167964413833943e-8，保留而未换成精确零。

77真实源轨道×三时刻×三姿态×三个三/四部件分支，共2079矩阵与Web逐值一致；执行原EXE变换指令及实际gbengine/CRT，外部查找/容器部分不在执行范围。世界接口接受已解析local矩阵与原角度/枢轴，共享引用由下述store维护。来源优先级已读指令：三部件只M；四部件先M，M无此tag时才查U。查询/共享引用已提供独立store，战斗动态更新仍待接入。

`EffectPrimaryTagMatrices`提供7个原主tag的共享数组，update原位写16个数，效果持有引用可持续跟随。默认原gbMatrix4构造器0x10031f30复制0x100531e8单位矩阵；无当前动作tag时写Zero。三部件只查M，四部件仅M缺失才查U。Web共享引用/来源顺序检查与真实原矩阵样本通过；原容器分配/引用计数未执行，仍不代表原池所有权。主任务TankView动作消息已提供part/action/time/identifier；下一步由主任务提供最新部件tag采样和原角度/枢轴，再绑定实际效果节点，当前独立接口没有改变战斗渲染。

### 炮塔主挂点动态补偿

`effectTurretPivotCorrection` 恢复 EXE `0x46cb49–0x46cc19` 的完整动态补偿，包含原 gbengine 四元数/矩阵与 CRT/EXE 轴旋转。144 个水平及倾斜上方向样本的 Web 数值与原执行结果逐值一致。接口显式接受原车身上方向；Web 战车当前水平姿态使用 `[0,1,0]`，原地形姿态的上游生成仍待恢复。

角色 `+0x34c` 是炮塔绝对角，原部件绘制 `0x46d092`、`0x46d27d` 减去车身 `+0xbc` 才得到相对角。`+0x368/+0x370` 是动态补偿，来源为绕 `tag_c` 枢轴的相对炮塔旋转矩阵平移取负，再绕车身上方向按车身角旋转。EXE 此次轴旋转使用 `0.01745` 转弧度，与 gbengine 常数不同。

缓存 `+0x2cc` 由 M actor 的 `GetTagNodeTM(tag_c)` 写入，`+0x30c` 由 U actor 写入。M 缓存的平移 X/Z 为 `+0x2fc/+0x304`，用于上述动态补偿。资源加载 `0x46d4c7–0x46d4d8` 先以 flag0 进入 `01` 动作（标识由 `0x46c4fa–0x46c501` 对字符串 `01` 求取），随后初始化主挂点和 `tag_c` 缓存；动作初始 time1 的轨道采样与直接首帧坐标不同。

验证：`tests/effect-turret-pivot-native.py`、`tests/effect-turret-pivot.cts`。动态补偿数值已恢复；全角色地形姿态未恢复。

角色初始化的 `GotoAction(KH)` 包装函数 `0x10009d10` 明确传入 `start=1,end=0,overMessage=0x6f766572`，因此 `tag_c` 初始化缓存使用 M 的 `01` 动作 time1 轨道采样。角色角生成 `0x46c99a` 根据车身前向向量、炮塔前向向量计算绝对角；补偿使用的车身上方向 `+0x10` 是角色姿态字段。

### 类型6完整基础 tick 编排

真实节点17（`yan1`）的完整入口 `0x480889` 已执行九步：节点运动/发射 `0x4801d4`、原整数随机计数、容量分配 `0x47fbb1`、完整 spawn `0x47fdbb`，随后同帧执行完整粒子数组寿命/运动/角度/帧/alpha更新 `0x480857`。Web 组合已有 emitter/spawn/pool/update 与每步完整状态、发射余数、共享随机消耗逐值一致。容量150时失败分配不进入spawn、不消耗其随机；新粒子同tick立即更新；过期时尾复制及跳过保持原顺序。

验证 `tests/effect-particle-node-native.py`、`tests/effect-particle-node.cts` 使用原DLL/CRT，仅供应随机源、管理器实例和已分配容量内存。该节点没有路径/环绕，结果未扩大到这些节点空间分支或原heap所有权。真实纹理多粒子像素检查继续进行。

### 类型6真实纹理多粒子像素完成

原节点17的 `yan1.png`、GBF9材质、三个真实原spawn状态，经批量粒子renderer与pool组成独立128×128页。12幅画面覆盖三个旋转粒子重叠、倒置绘制顺序、visible过滤、七次完整原数组寿命/运动/角度/alpha步骤、重新发射、清空和mesh释放。每幅全部16,384像素的RGB与CPU原纹理/量化diffuse/原混合公式参考误差不超过2，重叠顺序具有可测差异；所有七步完整粒子状态同时与原EXE执行结果一致。清空后mesh关闭，dispose后scene无残留mesh且调用者纹理保留。

参考直接从已验证原billboard计算几何，使用浏览器 `SUBPIXEL_BITS` 精度分别栅格化原两个三角形并重心插值UV，读取实际PNG字节做POINT纹理采样及逐粒混合。未读取renderer顶点作为参考。验证 `tests/effect-particle-browser-native.py`、`apps/web/effect-particle-render-check.html`、`tests/browser-effect-particles.mjs`；结果 `recovery/output/browser-effect-particles.json`。该结果是Web渲染对原资源/数学的像素验证，原D3D设备截图、帧缓冲alpha和整效果树仍未完成。

### 类型6节点运动和环绕完成

`advanceEffectEmitterSpace` 恢复原 `0x4801d4` 非路径空间分支：无parent时速度经管理器全局旋转，存在parent时保留local速度；XYZ积分保留原Z乘积f32中间写回；环绕按节点elapsed减控制器baseStart计算角，原axis Normalize（零轴回退+Y）与gbengine quaternion/matrix旋转 `[0,0,radius]` 得出offset。所有976非路径控制器×两parent选项×五时刻，共9,760原完整空间更新与Web逐值一致，覆盖68个环绕控制器。原真实资源包含零axis而非零radius的环绕，已按原fallback执行。九个路径控制器另待恢复；发射入口在此空间oracle中跳过，完整发射顺序已由node17整体tick验证。

验证 `tests/effect-emitter-space-native.py`、`tests/effect-emitter-space.cts`；完整原DLL/CRT执行。该接口尚未组成真实战斗的完整效果树。

### 类型6原路径资源与采样证据

九个路径控制器引用实际 `quan1.3DS`、`quan4_*.3DS` 顶点路径。`effect_path_tracks.py` 发布原路径顶点、控制器mode和rate。原3DS顶点载入 `0x483bc4–0x483bef` 将源 `(x,y,z)` 转成 `(x,z,-y)`，实际执行与导出逐值一致。类型6初始化 `0x4814f6–0x481506` 读取 controller `+0x60` mode、`+0x1a8` rate；全部九条源为mode1、rate30。

完整原路径采样 `0x475f56` 的27序列/243tick已执行，覆盖九条源×rate0/原30/73.5；结果含frame、余数、插值坐标。Web对应与整节点路径组合继续完成中。路径内插为原向量减/乘/加函数，mode1到末索引后余数继续随时间变化，末点与额外末端源点的关系必须保留原接口。

路径末索引的原读取需进一步确认：`0x475fc1–0x475fc8` 允许 `nextIndex==vertexCount`，mode1夹到 `count−1` 后会读3DS顶点数组之后的一个vec3。原九条rate30路径可在自身效果寿命内到达该分支。当前采样oracle显式提供末端sentinel `[0,0,0]`，只证明此输入对应的原算术；原heap相邻数据没有恢复，不能据此称路径末端真实坐标已完成，也不能无证据改成固定末点。

### 类型6启动与控制器空间重置完成

`startEffectEmitterSpace`/`resetEffectEmitterSpace` 对976非路径控制器×两parent状态×world start/controller reset，共3,904原入口结果逐值一致。World start先重置节点time/controller/origin、发射余数与burst位，用控制器position（无parent时原全局TransformInPlace）加origin，并初始化活动orbit；它保留粒子数组count。Controller reset复制前一个控制器position，初始化活动orbit，保留发射余数、burst完成位和粒子count。验证预设余数 `.375`、burst1、count7后对比真实入口，未套用类型1reset语义。路径start/reset组合后续继续恢复。

### 类型6路径数学与空间组合

`EffectPathClock` 对27原序列/243tick的frame、余数、线性采样坐标逐值一致，末端相邻vec3由调用者显式提供，没有默认替代原heap。`advanceEffectEmitterSpace` 可接收path clock和节点origin；原先积分及orbit仍执行，随后path采样加origin替换position并清orbitOffset。985源控制器×两parent状态×五tick，共9,850完整原运动/orbit/path分派与Web一致，其中路径末端仍只证明显式sentinel输入。

验证：`tests/effect-emitter-reset-native.py`/`.cts`、`tests/effect-path-native.py`、`tests/effect-path-clock.cts`、`tests/effect-emitter-path-space-native.py`/`.cts`。3DS源顶点已发布；路径末端真实heap、原分配/释放与完整效果树继续待恢复。

### 类型6完整节点状态与基础生命周期组合

`EffectParticleNodeState` 提供start/reset/update/end，按原空间更新→发射count随机→容量分配→完整spawn→同tick粒子数组更新的顺序组成已恢复逻辑。Node17九tick与原完整入口逐值一致，包含全部随机消费、余数、状态。类型6vtable `0x5c9b98+0x2c` 指向 `0x47fbc9`：结束立即清粒子count/发射余数，并置burst完成1；18原结束样本与Web一致，未延长尾部粒子的寿命。

真实world start `0x4808ac` 后，经实际type6 vtable和基础 `0x47f61c` 分派执行九tick，Web `EffectNodeLifecycle`+`EffectParticleNodeState` 的phase/elapsed/controller、空间、随机消费、发射和全部粒子字段与原逐值一致。该oracle使用真实原方法，管理器release用回调供给，节点无子节点；原树创建、子空间start及原池所有权未纳入此结果。

验证：`tests/effect-particle-node-native.py`/`.cts`、`tests/effect-particle-end-native.py`、`tests/effect-particle-lifecycle-native.py`/`.cts`。完整效果树与特殊节点类型继续恢复。

完整基础生命周期组合进一步覆盖391个真实单控制器、无path/无target依赖的类型6节点，共3,128真实原tick。全phase/time/controller、空间/轨道、共享随机消耗、发射余数、完整粒子字段与生产Node+Lifecycle逐值一致，涵盖原delay overshoot、burst、不同帧/alpha、寿命结束与释放顺序。原manager释放仍为供给回调，多控制器、target/path依赖与树所有权继续恢复。验证 `tests/effect-particle-lifecycles-native.py`、`tests/effect-particle-lifecycles.cts`。

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

真实战斗已接入 `EffectRuntime`：载入原ELK分组、源节点树、GBF与PNG，订阅TankView原动作时钟消息；bindingMode3保持标签矩阵引用，bindingMode0按原world接口从零坐标启动。共享CRT随机序列、原正向绘制顺序、sprite逆序trail与当前颜色、particle正向粒子、strip几何/scrollUV/当前颜色直接使用恢复组件。GBF缺省字段按前次绘制继承，Web初始CullMode为CCW；材质支持原NONE/CW/CCW、深度与混合。声音由原reference匹配已导出音频，浏览器设备负责实际播放/结束，音量与战斗设置同步。回合重置、断线、离开玩家和退出清理；原无时限type0容器在所有实体节点释放后回收Web资源。

`EffectRuntimeTree`已直接替代两棵混合树测试中的手工组合。原online004/online006真实attached start `0x47f065`、逐tick改变原parent矩阵，共26attached整树tick的全部状态/随机消费/声音/child release顺序，与生产树逐值相同；既有26world整树tick继续通过。`effect-render-transform-native.py/.cts`执行原DLL matrix stack Translate/RotateXYZ/Scale，覆盖全部sprite/strip控制器×两parent，共3346朝向矩阵，最大绝对误差0.0000038147。

`browser-effect-battle.mjs`经实际服务器创建原0007个人战、真人105加三CPU，用真实开火/死亡动作确认源2431枪口贴片、2430烟粒子、2508朝向死亡贴片、2509死亡strip及其他原节点在联机场景绘制。冻结真实死亡帧后同画面隐藏特效的GPU读回对比，有5207像素改变；退出后原特效网格残留0。证据browser-effect-battle.json/png；TypeScript与Vite生产构建通过。此验收是Web真实画面，不是原D3D framebuffer对比。

本段局限：原gfx初始化的完整继承状态、设备FPU与最终像素仍未完整恢复；Web采用CCW初始状态和自己的camera/alpha通道。原无时限容器的池回收/ownership、source ww154声音reference的真实解析（导出音频目录无该名称）仍待恢复；GA12可由原音频目录播放。类型2/5/8/10/11未被现有ELK战斗链接引用，其实际渲染/provider/postprocess/shake仍需独立完成；路径mode1相邻heap vec3与外部provider限制沿用前文。高清流畅性未由此验收确认。

- 完整 `npm run test:effects`（含world/attached混合树、全部类型原生命周期与3346渲染矩阵栈样本）通过；原GBF/16爆炸帧与node17粒子浏览器像素回归通过。

原manager `0x4790dc` 对active root vector逆序update，`0x479192`/`0x479146`正序render；0–4根的原执行顺序已供给node callback记录验证，生产EffectRuntime先逆序更新全部树、再正序绘制，保持多棵树共享随机消费顺序。验证 `effect-manager-order-native.py/.cts`。

每类型pool `0x47f90a`/`0x47f1bc`的创建、复用、解绑回调、active-prefix交换与inactive重复release共17操作，与 `EffectObjectPool`逐值相同；factory/storage/unbind由供给callback替代。`EffectRuntimeStatePool`在battle sprite/strip复用时保存仍存在的时钟/scroll字段，源树通过额外26tick的原retained-state对照（初始trailElapsed0.013、strip scroll0.375）。原sprite启用trail的world start清trailElapsed，未启用时保留到首次update清零；strip start保留scroll，Web保持这些规则。完整原gfx绑定、堆资源分配/ownership仍待恢复。验证 `effect-object-pool-native.py/.cts` 与两source-tree `--retained`；843 sprite、567 strip生命周期及attached树回归通过。

## 类型2闪电最终绘制切片

全部101个原闪电源的纹理reference解析为原`Data/effect/effect/Bolt.dds`与已发布`Bolt.png`，独立导出`boltTextures`。`effectBoltDrawVertices`恢复原EXE `0x47d56e`的矩阵变换、相机方向、未归一化叉乘宽度和递归平均边；DLL `0x10025dc0`每切片仅提交左／右顶点，首切片U=0，其余U=1，末切片重复最后一对边。`EffectSpriteMesh.updateTriangleStrip`保留交替三角绕序，输出Web X反射一次。

101原源×3相机×2矩阵共606组与原EXE／DLL执行对照，UV／颜色逐值一致，顶点最大绝对误差0.000003814697265625。101次完整原`0x47d935`绘制入口确认全部源flag=1选择GBF7、动态buffer格式0x15、原texturearray材质及Push→LoadIdentity→Render→Pop顺序；图形后端和manager lookup由供给callback记录。202完整原生命周期／2222 tick现直接验证生产`EffectRuntimeTree`。

Chromium节点131的六个相机／矩阵画面使用原纹理与GBF7，与原顶点输入的Web framebuffer逐RGB完全一致，可见像素142–989。生产`EffectRuntime.playWorldEffect(view, sourceName, nativeXYZ)`按原源全名和世界坐标创建源树、载入纹理并生成20顶点；stop后残留网格0。验证`effect-bolt-draw-native.py/.cts`、`effect-bolt-lifecycles.cts`及`npm run test:effects:bolt:browser -- <CDP端点>`；证据`effect-bolt-draw-native.json`、`browser-effect-bolt.json`。真实CPU个人战原开火／死亡效果回归通过，当前冻结死亡帧5207像素变化，退出残留0。

### 局限

闪电属于原技能引用分支，目前真实服务器技能通知入口未恢复；浏览器闪电验收是显式源调用，不能计作真实技能对局。以上Web framebuffer对照验证原几何输入的提交，不是原D3D framebuffer对照。原设备完整初始状态、alpha通道、camera、FPU和gfx／heap ownership继续恢复；类型5模型绘制、10后处理、11震动最终呈现仍未接入。

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

原完整基础相机运动／输入仍未复刻，Web保留当前基础相机并应用已恢复的原震动数学。原gfx／D3D最终framebuffer及实际FPU控制字仍未恢复。当前用原source入口显式触发，真实技能通知尚未接入，不能将房间内诊断调用称为真实技能对局。类型5模型绘制、10后处理最终呈现继续恢复。

## 类型5原绘制参数与现存CVD

生产EffectRuntimeTree的type5 backend已组合124原生命周期／1364 tick；1674完整原draw矩阵最大误差9.54×10⁻⁷。现存00012.CVD的44原node update时钟／loops一致，矩阵误差4.77×10⁻⁷；40原mesh draw／12120顶点XYZ／UV／normal和138原material参数调用逐值一致。Chromium44显式graphics-state诊断帧RGB误差0，4283–4741改变像素，mesh残留0。test:effects:model、test:effects:model:browser和effect-model-rendering.md保存入口／范围；原资源库存见type5-model-resource-inventory.md。战斗EffectRuntime模型backend、场景ambient／emissive覆盖与完整设备状态仍待接入／确认；不计作真实server技能触发或原D3D像素对照。

## type5生产模型接入与源状态

恢复POL描述仅用于名称、节点单位矩阵与gfx默认ambient／emissive；原gfx init/reset应用default.gbf，常规D3DX effect保存／恢复状态。新增effect-models资源发布和生产EffectModelRenderer backend，22个模型引用中8个有实物；missing模型／m120纹理保持资源错误。三个生产source诊断模型绘制均可见(1230／13／178 changed pixels)，clear后0mesh；44native矩阵／顶点帧RGB误差0。124生命周期、1674draw、44CVD动画、40顶点帧、138材质参数回归通过，tsc通过。普通CPU攻击／烟雾／死亡与退出清理通过。诊断source不计服务端技能触发，实际道具使用链仍缺失。

## type10原manager初始化缺口

原SYcScreenEffect构造后vector begin／end／capacity全0，create／update均returntrue且无注册逻辑；native执行Select(5,0)在0x4854a9读取地址0x14。全EXE singleton getter只有type10 start／end两个直接call，global只有getter内store／read。未找到实际index5对象，生产type10保持未支持；供给backend的生命周期对照不计作后处理绘制。详见effect-screen-postprocess.md与effect-postprocess-manager-native.py。
