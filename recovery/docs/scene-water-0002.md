# 0002 原水面与波浪

M3-05/M3-06：合法田野路0002的原water/waves环境消费者。原具名纹理矩阵、材质选择和提交顺序已核，SceneWater及ScenePreview限定load/advance/clear已接；普通玩家主机画布河面可辨、双离房清零，双端动画可见验收未完成。地图线拥有独立export/module/source/native/browser/docs，不改变Crush、主生命周期、声音或服务器资格。

## 原来源与绘制

地图加载45a8d6调用SYcSceneWater loader462f24，分别加载地图目录water.pol/waves.pol。water设置RenderPriority(-101)；waves存在时加载32张CAUST并ReplaceTexture第0张。发布两原GLB及原CAUST DDS逐张解码PNG。原loader请求jpg，原资源为同目录同stem DDS；完整VFS解析未在本片执行。

场景更新4596d3→462d14：原wall timer574e1e与f32(.05)严格比较，超过才(index+1)&31并重置574dfe，长帧只推进一次。offset以f32累加delta*f32(.05)，大于64减64一次。scene-water02-native.json执行原更新及计时器，QPC/ReplaceTexture/update为记录端点。

场景绘制459757→462dc6：gfx+d8栈Push/Translate(0,offset,0)/water Attach/Pop，随后waves独立Attach。gbRenderEffect构造10026260读取参数表100531ac，其中index9为matex0；1001bea9把d8栈顶传给index9。原water_effect.gbf以alltm变换位置，以matex0变换纹理坐标。因此滚动改变water纹理V，不改变几何高度；waves不滚动。scene-water02-draw-matrix-native.json执行原462dc6及DLL Push/Translate/Pop，捕获water的matex0[13]=1.25、world不变，waves两矩阵均未变；Attach与memcpy为记录端点。

原AttachSelf对原FVF21、kind1和名字进行效果选择。限定native执行1001206d→10012164，在fogMode0时_water得到8881、_waves得到881；效果管理器分别注册water_effect.gbf与geom_t_c1.gbf。含_water名字才设置8000，不能将waves误用滚动shader。原两个模型顶点RGBA为白色；所选shader使用vertex diffuse，不使用POL opacity .5882353186607361作为最终透明度。water为SRCALPHA/INVSRCALPHA混合，waves另启AlphaTest GREATER100。原default.gbf设置深度LESS及写入，shader本身不关闭深度。shader/source状态见scene-water02-shader-contract.json；没有原GPU全状态捕获。

1001a110记录node优先级及d4/d8/dc矩阵，1001a5a0首比较为rhs.priority−lhs.priority，1001a6a0用于qsort。native执行priority0对−101结果−101：waves默认0在water−101之前。SceneWater用相反alphaIndex对应Babylon升序，不改变原几何或terrain。

## 正式消费者

SceneWater保原GLB绝对坐标和glTF空间转换。water高度约−27.614，waves约−31.159；两个POL各25原顶点。材质使用原纹理/白顶点色、unlit、源混合及waves cutoff100/255，保深度写入。water纹理vOffset由原更新offset驱动，waves替换CAUST；wall timer由performance.now提供。没有快照或命中事件启动。

ScenePreview只在0002加载水面owner，逐帧advance；clear释放两container及32纹理。晚load检查disposed和revision，不在离图后添加资源。正常round复用常驻水面owner。

## 证据范围

| 证据 | 有效范围 |
| --- | --- |
| 18-29-08-653Z raw FAIL | 492普通输入、实际移动、双Leave清零；远点观察门禁未采样 |
| 18-32-43-031Z raw FAIL | 72普通输入、双water/waves实draw、CAUST32/26种；末guest Leave未完成 |
| 18-35-56-856Z clear leaf PASS | 正常入图和当前phase源退出；双ownerfalse/meshes0/textures0 |
| draw-matrix-native | 原纹理矩阵作用域、优先级比较、效果selector；无玩家像素 |
| shader-contract | 具名原shader与原道路贴图；无河面玩家PASS |
| scene-plant02-contact-player-evidence | new327同局双端water/waves各96vertices、三实际纹理/offset推进及正常Leave；不证明whole画面动画时序 |
| map02-full-session-player-evidence | mode1自然两局同scene续用、正常Leave→新房重入两次waterDispose containers/textures0、water/wavefalse |

原lu02.dds/lu09.dds与发布PNG解码RGBA一致，原道路贴图已有蓝白花纹与石板蓝边。18-32完整waves-1画布的道路纹样不能独立证明CAUST覆盖道路，也不能证明新水面可见。两FAIL raw保留，限定scope见scene-water02-player-gap.json。

01-20-04-843Z正式React mode1/map2选择/建房/加入/Ready后428普通输入，两个北岸目标相隔120。主机最终(-1196.43,247.87)，客机(-1019.65,495.39)，建筑阻挡使两端未到观察门禁，raw保持FAIL、当前动画draw采样0。亲审完整actual-1：左侧原河岸内水面清楚；actual-2仅建筑/南瓜后的一条远处水面，未达到独立无遮挡动画可见。两端正常phase源退出，ownerfalse/mesh0/texture0；process清理另存。限定组合索引scene-water02-bank-evidence.json，不重复此受阻路线。

## 未完成范围

双端正确水面动画的无遮挡时间序列、原GPU全状态/光照像素一致性、完整VFS解析、高清性能、全部地图水面和M3父项尚未完成。静态来源、实draw或模块通过不替玩家可见验收。
