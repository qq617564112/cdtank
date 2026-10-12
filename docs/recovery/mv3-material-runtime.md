# 普通MV3原材质生产接入（M3-03）

普通MV3现在使用有原来源的环境光乘纹理路径。原`1000d570`与`1001b6f0`的3264执行样本覆盖全部816材质；无雾/无selected lights时opaque flag1选择newgeom，透明flag81选择geom_t，颜色不使用normal。公式与范围见mv3-normal-d3d-state-sol.md。

## 生产链

convert_mv3仅对MV3材料写入originalMV3 extras（17原float和4纹理名）；POL/CVD不附此标记。745 MV3 GLB已重新生成，位置/UV/法线/动画和源纹理字节保持。mv3-material.ts解析来源，只对有明确源标记且纹理已经解析的MV3创建ShaderMaterial；没有首纹理的原材质用白色采样，非空缺名继续保留可追踪缺口，不凭角色名填入皮肤。

TankView在实际动作加载路径应用实例级材质；viewer在ImportMesh后应用同一入口。原PBR对象释放但共享texture保留；新增材质登记在动作AssetContainer并跟随退出/动作清理释放。shader只对position做原morph加权，基础/动画normal仍保留资产数据，未用于普通newgeom照明。原初始环境光RGBA=[.2,.2,.2,1]，emissive factor0；正式Web场景现在显式提供重建日光ambientRGB=[1,1,1]，材质读取scene.ambientColor，未设置场景环境光的工具保留原0.2。战斗过暗修正及来源边界见tank-daylight.md/M3-03-L；颜色为f32环境光×原diffuse+f32emissive×原emissiveColor，alpha=opacity×原diffuse alpha。无sRGB/PBR光照处理。

opaque采用default设备基线的LESS/depthWrite/CW cull、不启用alpha test；geom_t混合且按八位AlphaRef100/GREATER比较。Web实现对alpha进行八位四舍五入后比较，以避免float纹理采样边界100错误；原D3D实际量化/舍入仍未证明。生产纹理已显式采用LINEAR缩小/放大过滤与U/V WRAP，对应default.gbf第39–42行及newgeom/geom_t的寻址设置；实际WebGL min/mag=LINEAR、wrapS/T=REPEAT及双线性中心/跨边界像素均通过。脚本没有显式指定MipFilter，当前Web使用无mip过滤的LINEAR；原设备继承的mip状态仍未证实。普通有效设备继承、所有场景灯/雾、自定义效果覆盖及原framebuffer尚未全部恢复，不能把此路径当全局原渲染闭合。

## 验证

- tests/mv3-material.cts：全部3264原ambient参数逐float一致（mv3-material-integration.log）。
- tests/browser-mv3-normals.mjs：21真实TankView/105动作样本保持基础/动画法线数据，2058次source ambient-only position morph shader检查通过；12次仍为未匹配纹理旧材质normal路径。逐车dispose后等待原异步ActionContainer清理，scene meshes/materials/textures均返回加载前数量；1080p/4K/DPR1实际画布与viewport一致、可见模型截图通过（browser-mv3-normals.json、mv3-material-browser.log）。
- tests/browser-mv3-material-sol.mjs：实际Web readPixels的颜色/纹理四象限、alpha100丢弃/101存活、position morph及GLB反射/cull通过（browser-mv3-material-sol.json、mv3-material-pixels-sol.md）；原LINEAR/WRAP状态与双线性/循环像素同样通过（mv3-sampler-browser.log）；不是原D3D framebuffer对照。
- 资源用途索引与44纹理缺口回归通过（mv3-material-usage-test.log、mv3-material-texture-test.log）。21车105动作的实际纹理samplingMode2/wrapU1/wrapV1及异步清理回归通过（mv3-sampler-tanks-browser.log）；此前构建证据mv3-material-build.log，采样变更构建另见mv3-sampler-build.log。

显式LINEAR/WRAP采样变更后的高清双网页普通输入自然两局/重启重入回归已通过：两局67.8/86.4秒自然目标终局，35/52同tick状态一致，治疗双端实际效果/声音、零库存不补回/结算冻结/再战同意/重启/新房保留槽4及默认手动保持，证据mv3-sampler-autopilot-hd-browser.log、browser-account-autopilot-hd.json。两端380/384战斗帧，实际1080p/DPR1/scaling1，SwiftShader下p50=393.2/388.7ms、p95=1041.4/1041.6ms，仍不流畅。本次构建及另一SwiftShader实验并行，镜头与负载变化使前后帧差不能当严格材质优化收益。完整原D3D/所有shader/光照/雾、账户皮肤选择与XY切换仍待验收。
