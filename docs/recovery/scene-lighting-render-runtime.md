# 场景灯光／雾与设备状态运行时

本文记录战斗场景环境（ambient／fog／selected lights）、原 D3D 设备状态继承与
模型绘制顺序的生产接线。原环境字段没有出现在已发布放置导出中，图级环境表按客户端
`0x1000d570` selector 与 `Data/gfxscript` shader 家族推断为项目采用规则。

## 原来源

- `0x1000d570` 正常角色分支按 actor `+0x590` 选择雾 flag：1→`_f1`、
  2→`_F2`、3→`_f3`（`or ebp,0x10/0x20/0x40`），并按 `+0xe4`／`+0xe8`
  两条 selected light 记录加 `0x4`／`0x8`（`geom_1L`／`geom_2L`）。
- `Data/gfxscript/geom_1L.gbf` 用 `atten * max(dot(normal,direct),0) * diffuse + ambient`
  计算顶点色；`geom_f3.gbf` 按 `(position.y+fogplane.x)/fogplane.y` 写 FOG，
  `geom_f1.gbf` 用 `dot(fogplane.xyz,position)`，`geom_F2.gbf` 用视空间
  `(fogplane.y-p.z)/(fogplane.y-fogplane.x)`。
- `Data/gfxscript/default.gbf` 是设备基线：`FogEnable=False`、`FogStart=0`、
  `FogEnd=1.0`、ambient `[0.2,0.2,0.2,1]`、emissive 0、`CullMode=CW`、
  `Lighting=True`、`AlphaTestEnable=False`。`0x10027660`／`0x10020466`
  应用该基线，`0x100271fd–100272a1` 注册 flag1/0x81/0x801/0x881 选择的
  newgeom/geom_t/geom_c1/geom_t_c1。
- `0x1001b6f0` 参数4为 `globalAmbientRGB * properties[4:7] + emissive *
  properties[12:15]`，alpha 为 `nodeOpacity * properties[7]`。

## 环境表

`apps/shared/maps/scene-environment.ts` 只发布纯数据与 `sceneEnvironmentFor(mapId)`，
不加载资源、不持有场景。字段：ambient、emissive、fogEnabled、fogMode、fogColor、
fogParams、lights、resolution。

已发布放置导出不含 fog／sectionLight，采用规则如下：

- 所有地图沿用设备基线的关闭雾状态：`fogEnabled=false`、`fogMode=0`、
  `fogParams=[0,0,0,0]`、`fogColor=[0,0,0]`。原25图同名INI的fog.enable均0，45a4cb／45a764读取并写入scene+2c；现关闭资格与该原字段一致。完整雾参数／D3D消费仍按各专题开放。
- 原十三张户外图及 `1002` 田野路高清图、未单列环境配置的室内图沿用
  `tank-daylight.md` 的 ambient `[1,1,1]`，保留植物材质的白光乘项。
  十二张扩展图使用各自环境配置。emissive 保持原0。
- outdoor 图提供一条常衰减远日光源 `position=[400,900,300]`、`atten=[1,0,0]`、
  `diffuse=[0.6,0.6,0.55]`，使法线参与着色；室内图不提供 selected light。
- 取得原 fog／sectionLight producer 后，改由该 producer 覆盖本表即可，消费者接口不变。

## 生产接线

- `apps/web/src/render/scene-environment.ts`：窄 shader helper。共享
  `SCENE_ENVIRONMENT_VERTEX_DECLARATION` 提供 `sceneLight()` 与 `sceneFog()`，供各
  材质复用，不按 GBH 组合复制 shader。`applySceneEnvironment()` 写 Babylon
  `ambientColor`／`fogMode`／`fogColor`／`fogStart`／`fogEnd` 并把解析值登记到
  scene 级 `WeakMap`。`bindSceneEnvironmentIfPresent()` 在 `onBindObservable` 内
  每帧重绑，切换地图后由 `resetSceneShaderEnvironment()` 清掉旧图 fog/ambient。
- `apps/web/src/render/materials/mv3-material.ts`：opaque／透明两条 MV3 路径读取
  同一 helper。无 light 注册（查看器/工具）时 `sceneLightCount=0`，颜色仍为已验收的
  ambient-only 公式；NORMAL define启用已有动画法线，normalUpdated与位置按同一权重插值后参与 `sceneLight` 的方向项，雾按视空间距离
  混合，避免把 `scene.fogEnabled` 打开而 shader 不消费。
- `scene-plant-material.ts`、`scene-terrain-material.ts`、`scene-general-material.ts`、
  `scene-breach-material.ts`、`effect-model-mesh.ts`：各自的 unlit 源 GBF 只追加场景雾；
  MV3 额外读取 selected light。
- `apps/web/src/render/scene-device-state.ts`：把 `default.gbf` 作为基线与选中的
  section 覆盖合并，逐材质写 cull／depth／alpha-blend／alpha-test，避免跨材质或跨图残留。
  `effect-model-renderer.ts` 的 section 状态缺键时保留基线而不是猜默认。
- `apps/web/src/render/scene-model-order.ts`：opaque先于transparent，共用深度并按source priority分组；同优先级不透明近到远、透明远到近；`scene-preview.ts` 在放置完成后对每个 root 的子 mesh 统一赋
  默认priority0／`alphaIndex`及同绘制group；动态CVD/破损/Type5逐次消费0/-1/-2，runtime不再按实例序覆盖模型alphaIndex。动态相机距离排序和清理恢复进入实际消费者。原队列入队排序
  （`0x1001a110`／`0x1001a250`／`0x10026d70`）的具名来源见
  `mv3-normal-d3d-state-sol.md`。
- `scene-preview.ts` 在任何资源／shader 载入前 `applySceneEnvironment()`，
  `clear()` 调 `resetSceneShaderEnvironment()`，异步 `await` 后仍按 revision 清理。

## 当前接线边界

静态root与动态CVD/破损/Type5共用group0深度及模型priority排序，CVD保留metadata。
MV3已消费NORMAL morph，插值后的normalUpdated进入selected light计算。
十二图1814个地形分片已接kind0/1原材质及图级metadata，三图五处采用纹理已内嵌GLB。
十二张扩展图按原地图主题采用独立环境光与灯光参数：工厂0009/0015使用室内灯，
其余采用独立户外色调与日光；原13图及1002继续使用既有光照provider。所有地图关闭雾。
来源、完整参数和当前生产行为见[extended-scene-render-runtime.md](extended-scene-render-runtime.md)，
集中状态见[battle-remaining-integration.md](battle-remaining-integration.md) P–T。

## 未实测范围

- 未运行测试、浏览器、构建、类型检查、lint或native EXE；地形材质与采用纹理的定向publisher已实际执行。
- ambient、光源位置与强度、衰减系数为项目采用规则，
  原场景 producer 仍未取得。
- 原 D3D 有效 143／AlphaTest 覆盖顺序、D3DX BeginPass 后状态省略、原 framebuffer
  仍未证明；本接线不宣称与原画面逐像素一致。
- 原 selected light 数量（0/1/2）在真实对局中的分布、原 ctl 候选选择权重仍未执行。

角色显式toon选择与默认灯另由scene-actor-toon-runtime.md记录，原25份零候选ctl和128×2原纹理已发布并由图级owner管理。MV3非角色材质保持现图级selected lights消费者；普通几何s_texToon保持空槽已有随包模块静态来源，见scene-geometry-toon-source.md；全环境／设备等价仍由对应验收追踪。
