# 缺失类型5模型补作

原资源搜索已确认 `Data/effect/effect/bat/bianfu.cvd` 与 `bing/bing_1.pol` 至 `bing_13.pol` 没有实体，`effect.sav` 中的名称只是引用；这些结论与搜索证据保持。补作仅覆盖这14个实际缺失引用，不改变其余8个原模型，也不写入伪POL/CVD到`verified`。

## 资源合同

`recovery/reconstruct_effect_models.py`执行 `build_reconstructed_model(reference, source_root, web_root) -> dict | None`。仅支持上述14个引用；返回当前`effect-models.json`节点合同，`resolution`为`published`，并附顶层`provenance.kind='reconstructed'`、`basis`、设计尺寸、三角面数、时长和动画说明。静态节点顶点顺序为`[x,y,z,nx,ny,nz,u,v]`；蝙蝠动画节点帧顺序为`[u,v,nx,ny,nz,x,y,z]`，`times`严格递增。`animation.position`、`rotation`、`scale`均保留mode3，`value`为float1的uint bits。纹理输出到`reconstructed/battle/`，不依赖Blender或网络服务。

蝙蝠以9帧完成1.0秒振翅循环：展翼、下垂和收翼有明确顶点差；模型包含深紫低多边形躯干、宽膜翼、尖耳、眼与牙。冰块以原`bing.POL`的约±3.3边界、60三角面棱晶轮廓和同目录已有材质参数为风格基准；`bing.TGA`及同目录DDS缺失，因此绘制青蓝渐变、乳白高光和面片分界纹理，并用不同边数、高度、倾角及碎片数量生成13个不同轮廓。`textureProvenance.basis`记录该实际依据。

## 导出接入

`recovery/export_effect_models.py`在目标文件缺失时调用生成器。原文件存在时仍按原POL/CVD读取，原XYZ、UV、顶点色、section索引和材质不改写。只有原`youlincat.pol`的`m120.TGA`及同路径DDS都缺失时，导出器从`reconstruct_battle_media`调用`export_m120(model_path, web_root)`和`M120_PROVENANCE`；返回资源写入`part.asset`与`part.textureProvenance`，不会给无关模型调用替代纹理。

生成命令：

```sh
recovery/.venv/bin/python recovery/export_effect_models.py
PYTHONPATH=recovery recovery/.venv/bin/python recovery/preview_reconstructed_effect_models.py
```

离线预览位于`recovery/output/reconstructed-battle-preview/bat-flap.png`和`ice-13.png`，只用于审看生成轮廓与纹理。

## 已发布与未验收

当前22个唯一类型5引用均有发布节点：8个来自原实体，14个带`provenance.kind='reconstructed'`。原来源缺失证据、旧版本搜索范围和“不能把引用命中当实体命中”的结论仍成立。补作没有改变原`modelControls`，由原base/scale/motion/angles决定大小和行为。

未完成项是实际游戏内逐技能像素验收、原D3D framebuffer对照和`m120`实际游戏内表现验收；离线预览不能代替这些项。
