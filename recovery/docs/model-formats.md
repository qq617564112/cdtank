# GameBox 模型格式与转换依据

## MV3 version 100

依据本地 `CDTank/gbengine.dll` 的读取代码。首选基址 `0x10000000`；actor reader `0x1000c590`，attachment reader `0x1000c4a0`，material reader `0x1000b940`，mesh reader `0x1000aed0`，position decoder `0x1000b400`。RVA `0x3f858` 的浮点量化系数为 `0.015625`（1/64）。实现为 `recovery/mv3.py`。

所有整数和浮点均为小端。名称为 GBK、NUL 结尾。

| 区段 | 字段 |
| --- | --- |
| 文件头 | 7 × u32：MV3\0、100、duration、材质数、挂点轨道数、mesh数、tag数 |
| tag | u32 ID + name[16] |
| 挂点轨道 | name[64]、f32 value、u32 frameCount；每帧 u32 time + 16 × f32 位置/四元数及附加数据记录 |
| 材质 | 17 × f32；4个纹理名称，每个名称为 u32 长度 + 字节串 |
| mesh | name[64]、u32 vertexCount、6 × f32 bounds |
| 顶点动画 | u32 frameCount；每帧 u32 time，然后 vertexCount × (3 × i16 XYZ + u16 packedNormal) |
| UV | u32 uvCount + uvCount × 2 × f32 |
| part | u32 partCount；每part u32 materialIndex、u32 triangleCount、triangleCount × 6 × u16、u32 extraCount + extraCount × u32 |

每个三角形的前3个索引指向顶点，后3个索引指向UV。转换器展开三角形角点以保留两套索引。XYZ除以64，后续帧转换为位置 morph delta；采样权重依次选择对应帧并线性插值。当前把时间除以1000，原版播放速率与动作切换语义仍需校准。挂点记录包含位置与四元数，完整16个f32保留在解析器旧matrix字段；不能直接作为4×4矩阵使用。位置和炮塔组合依据见 `tank-runtime.md`，完整挂点动画仍待还原。

745个文件全部读取至文件尾。`tests/assets-geometry.py` 对战车普通动作、攻击动作、多part资源和宠物逐顶点比较原始数据与GLB，覆盖三角形、UV和所有morph帧。`tests/assets-validation.mjs` 检查全部生成文件的glTF结构和数值约束。

## POL version 200

gbGeomNode 的文件加载器处理 `.pol` 和 `.cvd`。CVD reader `0x10011150`，file reader `0x100117f0`。POL reader `0x10012440`：`POLY`、版本、节点数；节点描述为52字节，随后mesh数据。

静态mesh reader `0x1001cbb0`：bounds[24]、u32 FVF、u32 vertexCount、按FVF计算步长的顶点、subsets。步长函数 `0x1002b7e0`：bit1提供12字节位置，0x100提供16字节，bit2提供12字节法线，bit4和bit8各4字节，0x10/20/40/80各8字节UV；最高位置位时低31位为显式步长。

section reader `0x1001c440`：type[4]、material[68]、u32 textureCount、每个texture name[64]，然后4个字段（最后为triangleCount），每个三角形3 × u16索引。138个POL文件全部读取至文件尾，无越界三角形索引；1227个mesh，226740个三角形。所有观察到的文件版本为200。

文件顺序为头部、全部52字节节点描述、u32挂点数、挂点记录、全部mesh。POL挂点记录为name[32]、16×f32矩阵、u32 value、u32 textLength、text字节。其读取函数 `0x100102f0`。52字节节点描述的名称取前32字节，完整描述以hex保留在转换清单，剩余字段的运行语义仍待确认。

本地顶点FVF共两种：0x15步长24（XYZ[12]、BGRA颜色[4]、UV[8]）；0x13步长32（XYZ[12]、法线[12]、UV[8]）。原XYZ为float，不使用MV3的1/64量化。GLB保留源UV和BGRA转换后的RGBA顶点色；源法线归一化。section四字段的最后字段为三角形数，索引是每三角形3×u16。

`recovery/pol.py`读取原格式，`recovery/convert_pol.py`转换为GLB。138个POL全部通过glTF标准校验；`tests/pol-geometry.py`对每个三角形角点检查位置、UV、源法线和顶点色。清单 `pol-conversion.json` 保留原节点描述和挂点。25张基础地图均有POL；额外水面/波浪资源单独转换。

田野路 `Data/map/0002/0002.POL` 有29个源mesh、8909三角形，转为76个材质分区，浏览器已加载其地形和贴图。截图为 `recovery/output/map-0002.png`。它还不是完整运行场景：scn中的物件放置、CVD动画、NAV/BOX碰撞、水面和特效仍需接入。

## CVD cvdf

81个CVD全部由 `recovery/cvd.py` 读取至文件尾并转换局部网格动画，文件签名均为 `cvdf`（原加载器将其识别为0.4格式）；`cvds`识别为0.5但未在本地样本出现，不宣称验证支持。

文件头为signature[4]和u32根记录数。每个递归记录先有u8存在标志；存在时依次包含三组轨道、u32 value、动画mesh和16×f32矩阵；然后u32子记录数及对应递归记录。轨道为u32 keyCount，非零时u8 mode，随后固定大小记录。位置/旋转每key44字节，缩放每key60字节。轨道完整字节以rawKeys保留；浮点观察视图中的非有限值显示为null，不丢弃原字节或将其用于渲染。

动画mesh为u32 frameCount、u32 vertexCount、frameCount×vertexCount×32字节顶点、frameCount×f32时间、u32 partCount。顶点顺序经 `0x10016a03` 的复制路径确认：UV[2f]、normal[3f]、XYZ[3f]。原时间为浮点秒，本地样本可见0、0.06666667等序列。材质part为u8 kind、20字节材质、texture[64]、u32 triangleCount与3×u16三角形。cvdf后续不含0.5格式的材质关键帧段。

20字节材质含4个packed BGRA颜色与f32 power；`0x10015ad0`映射为ambient、diffuse、specular、emissive及power。当前glTF使用diffuse和首纹理，其余原字段保留待原光照还原。

`recovery/convert_cvd.py`转换局部位置morph动画，保留节点轨道/矩阵和材质记录于清单。`tests/cvd-geometry.py`逐文件比较8190个三角形、6168个part帧的位置/UV/归一化动画法线/源时间。CVD与POL中obj05444有同名文件，CVD输出使用 `.cvd.glb` 保留两份资源。全部964个GLB标准校验0错误。

局部动画不包含节点轨道变换、原插值与层级组合；当前CVD显示只能作为几何检查，不代表物件最终姿态或完整动画。

## 已知限制

POL尚有5个模型的7处材质纹理引用未匹配（2个特效各1处、地图0009两处/0016一处/0023两处）；未任意替换纹理。POL挂点未转换成场景动画节点，多纹理混合与原光照语义待还原。

MV3 packedNormal已由原 `0x1000bed0` 解码器恢复，745个模型中58951种源值全部执行对照通过，最大分量绝对误差约1.2e-7；转换保留基础法线与逐帧NORMAL morph delta，745个MV3 GLB已重建。依据与范围见 `mv3-normals-sol.md`。原CPU渲染1000e160的3模型/9样本确认法线线性插值不归一化（mv3-normal-sampling-sol.md）；21真实战车105动作网页法线数据、position morph及原ambient-only shader检查通过。3264原材质样本确认无雾/零selected lights的newgeom/geom_t不读normal，生产已接该路径并保留normal资产数据，详见mv3-material-runtime.md。原D3D实际像素、场景灯/雾及全动作混合仍待验收；挂点节点动画、皮肤覆盖、特效和材质光照行为尚未完整还原。glTF校验通过只能证明文件有效，不能证明与原版画面一致。

CVD后续定位：`0x100117f0`首先读取4字节签名和u32根记录数，然后逐根调用递归读取函数 `0x10011540`。节点reader `0x10011150`先读取1字节存在标志；非零时读取三组动画轨道（`0x1000fb00`、`0x1000fb80`、`0x1000fc00`），u32字段，再调用动画mesh reader `0x10016880`，最后读取64字节矩阵。不能使用POL静态mesh结构直接跳过CVD动画数据。
