# Map6 原05443完好材质消费者提案

M3-06 下一具名新资产为合法 mode1/2/3 地图6的六条 `SYcScnObjBreach/obj05443`，原ID为84、95、152、153、302、303。现正式静态GLB已加载，其完好材质尚未进入 `SceneBreachMaterial`。

`tests/scene-breach06-05443-intact-material-source.py` 直接读取原0006.obj、obj05443.POL与同目录DDS，核发布GLB全部141展开顶点的XYZ、UV、packedRGBA及内嵌PNG完整RGBA一致。原mesh为object568041500、FVF21、kind0，纹理为obj05443.tga；发布mesh为object568041500/0。证据 `scene-breach06-05443-intact-material-source.json/.log` 为PASS_SOURCE_INPUTS_ONLY。公共Breach加载器与geom_c1选择复用现已验证合同，不新增native执行。

正式接线范围仅两hunks：

- `apps/web/src/assets/scenes/scene-breach-material.ts` register namedunion/names/prefixes追加obj05443、object568041500/0、breach06-05443-intact，默认05467与其他model保持。
- `apps/web/src/assets/scenes/scene-preview.ts` 0006的Breach tuple追加obj05443，沿现class/model过滤、unique asset cache、revision与owner clear。05432未授权提案保持独立，不自动纳入本hunk；05433不纳入。

source302原位置[875.4176635742188,0.9999847412109375,-1011.3812255859375]附近的单候选[870,-1120]原NAV有效，73×76 footprint planner由正常出生[879.57,-1462.22]取得一段路径。`scene-breach06-05443-intact-entry-route.json/.log`仅证明离线路径候选，不证明玩家已到达或该位置可见。

未来普通玩家范围：正常mode1/map6选图、建房加入和Ready，host用正常W/A/D沿单点NAV接近source302，记录新完好材质实际draw与完整画布，guest限定正式加载与双normalLeave/owner clear。若普通输入受阻或原目标不可见，如实保gap，不修改spawn/camera/碰撞/破坏授权，不逐六实例扫描。两hunks已审定并接入，必要Web类型检查 `scene-breach06-05443-intact-material-types.log` exit0。普通首测使用 `tests/browser-scene-breach06-05443-intact-material.mjs`，端口3556/5586/9786，driver syntax exit0；保存证据合同为 `tests/scene-breach06-05443-intact-actual.py`。玩家可见范围与normalLeave以首测raw为准，工程等待统一Web发行。

普通首测 `browser-scene-breach06-05443-intact-2026-10-05T11-18-55-535Z.json` 为PASS_HOST_MATERIAL_NORMAL_LEAVE，正常单点路径完成。host source302同frame250实际141verts/worldmatrixexact，近浅石墙暗裂纹、蓝色基座和红瓦檐可辨；guest独立source像素未验。双Leave ownerfalse/material0，browserErrors为空，process清理PASS/三个端口空。有限证据wrapper为 `scene-breach06-05443-intact-material-player-evidence.json`，工程待统一发行。

有限主审：`scene-breach06-05443-intact-material-root-review.json`，状态 `ACCEPTED_HOST_MAP06_NEW05443_MATERIAL_NORMAL_LEAVE_SCOPE`。wrapper的mainReview已回链；统一Web工程由root登记。

统一工程发行：`shop-product-grid-map06-05443-production-web-build.log`，Web session29069 actualexit0/1m44，releasecopy session56785 exit0；root-review与wrapper工程已回链。
