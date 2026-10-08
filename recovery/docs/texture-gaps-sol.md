# 原模型纹理缺口分类（M3-03 / M3-06）

原纹理分类证据中的964个模型共有4436个首纹理材质引用：4381 个可通过转换器同目录精确名称/TGA 扩展名别名映射，11 个原材质首纹理为空，44 个非空引用仍未解决。44 项与 `asset-usage-index.json` 的逐模型/逐材质 `textureIssues` 一致，原材质顺序及名称与现存 GLB 一致。空材质不带 GLB baseColorTexture，不计入缺失。

| 分类 | 材质引用数 | 结论 |
| --- | ---: | --- |
| 同目录唯一纹理 | 4381 | 现有精确映射有来源 |
| 原空纹理材质 | 11 | 不属于缺失纹理 |
| 当前选定纹理资产无精确名称 | 40 | 保留未解决 |
| 精确名称仅见其他目录 | 4 | 原加载路径未确认，保留未解决 |
| 同目录别名歧义 | 0 | 当前选定资产未产生此情况 |

## POL：7 个引用 / 5 个模型

| 模型 | 材质索引 | 原名称 | 当前资产证据 |
| --- | --- | --- | --- |
| effect/effect/bing.pol | 0 | bing.TGA | 无精确纹理；bing.pol 本身不是纹理 |
| effect/effect/youlincat.pol | 0 | m120.TGA | 无精确纹理 |
| map/0009/0009.pol | 26、30 | 00026.tga | 仅 map/0015/00026.dds 存在 |
| map/0016/0016.pol | 33 | ct-01-1.tga | 无精确纹理 |
| map/0023/0023.pol | 32、134 | qiao.TGA | 仅 map/0006/qiao.dds 存在 |

同名跨目录文件只证明纹理文件存在，不能证明原模型使用它。上述 POL 缺口的原纹理列表均只有该名称，没有其他槽位提供精确替代路径。

## MV3：37 个引用

| 原模型目录 | 原名称 | 引用数 |
| --- | --- | ---: |
| role/053 | 053XY_001.TGA | 2 |
| role/153 | 153XY_001.TGA | 2 |
| role/155 | 155XY_001.TGA | 2 |
| role/158 | 158X_001.TGA | 11 |
| role/001 | lvdai.TGA | 10 |
| role/001 | dipan.TGA | 5 |
| role/001 | pao.TGA | 5 |

这些 MV3 材质的其余三个纹理槽位均为空。原角色 INI 的动作 section 提供 name/file，没有纹理覆盖字段；已安装的 XY_A/XY_B 或 M/U 编号皮肤不能直接作为上述缺名的替代。需要原材质替换与皮肤应用规则，才能确定每个动作/组件的纹理。

CVD在原首纹理映射范围内没有非空缺口。上述44项登记原同目录名称与原搜索路径来源边界。

当前生产已为0009的00026两处、0023的qiao两处采用跨目录同名原纹理，
0016的ct-01-1采用本图相邻岩壁di2；五处均已内嵌地形GLB，转换器保持精确地图/引用映射。
采用清单见scene-terrain-texture-adoptions.json及[extended-scene-render-runtime.md](extended-scene-render-runtime.md)。
这些采用映射消除了对应运行时无纹理输入，原搜索路径及ct-01-1精确原纹理来源仍未取得。

## 可复核证据

运行：

```sh
recovery/.venv/bin/python recovery/texture_gaps_sol.py
recovery/.venv/bin/python tests/texture-gaps-sol.py
```

输出 `recovery/output/texture-gaps-sol.json` 保存每个缺口的选定原文件、GLB、材质索引、原首纹理与全部纹理槽、精确同名跨目录候选，以及用途索引中的已发布引用位置；另保存全部 11 个空材质位置。

回归已通过：精确名称及 TGA 别名、目录边界、别名歧义、不把模型文件当纹理、枚举顺序不影响分类，以及实际 44 项原字段/GLB 名称/用途索引一致。输出统计为 `empty-material=11, missing-local-scope=4, missing-selected-texture=40, unique-local-texture=4381`。

## 剩余验收

“无精确名称”限定当前最终选定资产，不能证明原客户端任何时候都没有使用纹理；仍需查明原资源搜索路径、材质替换和皮肤规则。分类工具只核对首纹理，因为当前转换器只使用首槽；POL 多纹理混合、原光照、MV3 packedNormal/动画法线及皮肤覆盖不在该结果中。此次没有浏览器实载证据，M3-03/M3-06 保持未完成。
