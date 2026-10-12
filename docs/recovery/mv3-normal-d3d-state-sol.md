# MV3 普通模型原材质与 D3D 状态边界

745 个现存 MV3 的816个源材质，在原初始化环境光、无雾、未选择场景灯的条件下，完整执行原 RenderInfo 选择及材质参数设置通过。节点不透明时原效果flag为 `1`，绑定 `newgeom.gbf`；节点透明度0.45时为 `0x81`，绑定 `geom_t.gbf`。这两个原shader均不使用输入法线，输出颜色由原 `ambient` 参数决定。

## 原执行与源脚本绑定

`tests/mv3-normal-d3d-state-sol-native.py` 执行完整 `0x1000d570`：使用每个真实MV3的17个材质浮点、原mesh/part材质索引结构，生成RenderInfo的flag、effect与纹理数组指针。场景队列分配/加入接口 `0x1001a110`、`0x1001a250` 在对象边界提供记录存储，效果查询 `0x10026d70` 在边界记录实际传入flag。其余源alpha、节点透明度与flag分支实际执行。actor `+0x198` 的0/1写入通过原 `0x1000ae70` setter实际执行，该setter仅写byte，不调用D3D。原 `0x1000d3c0` 还有按actor数组索引写同字段的接口；没有证据将这个byte直接解释为D3D AlphaTest状态。

随后完整执行 `0x1001b6f0` 和原 `0x100264d0` 参数写入包装函数，记录ID3DXEffect的实际SetValue及CommitChanges调用。默认环境光由原 `0x10027f97`–`0x10027fe7` 初始化指令实际写入，而非测试猜测。

| 输入/输出 | 原值或合同 |
| --- | --- |
| 源 `properties[3]` | 全816个材质均为1 |
| 原GFX环境光RGBA | `[0.20000000298, 0.20000000298, 0.20000000298, 1]` |
| 原GFX emissive factor | `0` |
| 普通node opacity=1 | flag `1`，`newgeom.gbf` |
| node opacity=0.45 | flag `0x81`，`geom_t.gbf` |
| 原参数4 RGB | `globalAmbientRGB * properties[4:7] + emissiveFactor * properties[12:15]` |
| 原参数4 alpha | `nodeOpacity * properties[7]` |

`0x100271fd`–`0x10027228`加载 `Data\gfxscript\default.gbf` 和flag1的 `newgeom.gbf`；`0x1002722d`–`0x10027239`加载flag `0x81` 的 `geom_t.gbf`。原文件编译器 `0x100266c0` 读取所选GBF并调用 `D3DXCreateEffect`。相关指令与整个材质设置函数保存在输出证据。

`newgeom.gbf` 与 `geom_t.gbf` 都声明 `float3 normal : NORMAL`，函数体不读取它：

```hlsl
output.Diffuse = ambient;
output.Position = mul(position, alltm);
output.Texture0 = texcoord0;
```

两者pass均使用 `VertexShader = compile vs_1_1 mainvs()`，固定texture stage将TEXTURE与CURRENT颜色/alpha相乘。`geom_t.gbf`额外启用AlphaBlend/AlphaTest，AlphaRef=100、AlphaFunc=GREATER。普通不透明模型的颜色不是方向法线光照。

3264组原执行分别覆盖全部816个真实材质与两个节点透明度、两个actor byte值；每组检查原flag、原效果/纹理指针、ambient RGB与alpha。RGB/alpha分量误差阈值 `1e-7`。源文件材质不修改；透明节点是明确运行状态输入，不宣称为每个动作原实录。

## NORMALIZENORMALS 边界

`default.gbf` 显式设置：

```text
VertexShader = NULL;
Lighting = True;
NormalizeNormals = False;
```

原初始化 `0x10027660` 与设备reset `0x10020466` 存在默认效果Apply调用；Apply包装 `0x10026450`调用ID3DXEffect Begin、BeginPass、EndPass、End。真实MV3提交 `0x1000e741`–`0x1000e793`使用FVF `0x13`并提交原效果，原 `0x10026890` BeginPass包装将pass应用交给ID3DXEffect。

本切片确认源默认脚本要求D3DRS_NORMALIZENORMALS（143）为False，但没有执行D3DX BeginPass到设备SetRenderState，也没有证明真实绘制时143的有效状态或全部覆盖顺序。两个已验证普通shader不读取normal，所以其ambient-only颜色计算不依赖该状态；不能据此推定其他shader状态。

## alpha 与空纹理

全816个源材质的 `properties[3]=1`，actor `+0x198` byte0/1在本测试条件下给出相同flag：nodeOpacity=1均flag1，0.45均flag0x81。`0x1000e160`没有直接由该byte调用设备SetRenderState。默认脚本AlphaTestEnable=False；`newgeom.gbf`没有覆盖该状态，`geom_t.gbf`明确AlphaBlend=True、AlphaTest=True、AlphaRef=100、AlphaFunc=GREATER。普通opaque最终设备AlphaTest是否仍为False需要原D3DX应用链有效状态证据，不能把旧PBR MASK阈值0.1作为原合同。

原首texture名称为空时，`0x1000b99b`调用effectMgr `GetWhiteTexture`（`0x10026750`）；初始化从 `Data\gfxscript\white.tga`取得该资源。shader仍采用ColorOp/AlphaOp Modulate(TEXTURE,CURRENT)，通过白纹理得到当前颜色，而非禁用ColorOp。非空但未匹配引用不属于此路径。

## 生产接入依据与范围

无雾、无选中场景灯的普通MV3可依据上述flag与参数合同还原环境光乘源diffuse的颜色和纹理混合，不需将法线送入PBR方向照明。源法线与动画NORMAL仍应保留为资产数据。原全局环境光初始化证据与效果模型既有专题一致；运行中环境光变化应传入相同公式。

验证命令：

```bash
recovery/.venv/bin/python tests/mv3-normal-d3d-state-sol-native.py
```

证据：`recovery/output/mv3-normal-d3d-state-sol-native.json`，包含3264组源材质与原参数调用、完整RenderInfo/材质设置反汇编、源脚本全文、效果初始化/编译/BeginPass与默认Apply调用链。本切片未改生产代码。

## 未完成范围

原D3D设备有效143/AlphaTest状态及覆盖顺序、shader编译/执行、场景灯与雾效果flag、角色自定义效果覆盖及最终画面未验收。当前脚本仅对无雾/零selected lights原RenderInfo状态作结论；节点透明度0.45是显式输入合同测试。Babylon PBR归一化与原任意shader的最终光照一致性仍未证明。
