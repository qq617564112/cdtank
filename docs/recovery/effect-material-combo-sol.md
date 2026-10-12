# 类型5递归透明度与材质选择组合

8个现存原模型的23个material section，与原type5绘制oracle实际输出的21种blend／alpha组合，共483次原选择指令执行通过。生产模型renderer的462次mesh提交逐项保持原选择脚本、混合、剔除及深度配置；另外21次属于youlincat原缺失纹理，生产仍明确拒绝载入。

## 原执行

`tests/effect-material-combo-sol-native.py`从原POL／CVD读取section kind和FVF，与发布模型记录逐项核对。原DLL注册片段`0x100271fd–0x100272a1`实际执行，以编译接口记录原GBF路径及flag；其中1、0x81、0x801、0x881分别绑定newgeom、geom_t、geom_c1、geom_t_c1。

每个资源按源节点数量建立可遍历child／next链，完整执行`SetBlendRecursive` (`0x1001d980`)。168次调用逐节点验证blend与f32 alpha写入；该setter直接传播相同数值，不将alpha在父子间重复相乘。对象存储与child／next链接由fixture提供，未执行原模型loader构造这些对象。

随后执行原`AttachSelf`的`0x1001206d–0x10012121`选择片段，包含真实`GetBlend` (`0x1001d970`)调用。这不是完整AttachSelf函数验收。当前源section仅kind0／1；无section lights、无fog、selected light count为0。kind1始终设置透明flag0x80，kind0按已继承blend选择；FVF bit4另设置vertex-color flag0x800。源透明材质在node alpha=1时仍选择透明脚本，不能仅以alpha判断整个section的混合。

## 生产组合

`effectModelMaterialSelection`保留上述原flag及脚本选择。现有`effectModelScript`将原type5绘制的alpha转换为blend0／1，再调用该helper，公开接口及既有行为保持一致。

`tests/effect-material-combo-sol.cts`对全部483个原结果逐值检查helper与生产脚本入口，以每种独立首次提交各自创建renderer，并通过真实`EffectModelRenderer`／`EffectModelMesh`检查7个可载入模型的462次提交。NullEngine fixture供给texture对象；测试验证mesh material的alphaMode、needAlphaBlending、CullMode、ZEnable、ZWriteEnable，以及每个renderer释放后mesh数量为0。原default／选中section脚本提供显式状态输入；没有用shader名称推定缺省状态。透明源脚本未覆盖ZWriteEnable，因此本fixture保留default的TRUE。

```text
recovery/.venv/bin/python tests/effect-material-combo-sol-native.py
PASS: 168 complete recursive source model blends / 483 original section material selections
npx tsx tests/effect-material-combo-sol.cts
PASS: 483 original material selections / 462 production source mesh states; 1 original missing-texture resource rejected
npx tsx tests/effect-model-material.cts
PASS: 138 original shader material parameters exact
npx tsc --noEmit
exit 0
```

证据：`recovery/output/effect-material-combo-sol-native.json`，保存原注册调用、每节点递归状态、483个section结果及原指令。

## 局限

21种透明度取自现有原type5绘制oracle，并与每个现存资源组合为明确输入合同测试；这些组合不是原游戏逐帧实录。本片段不覆盖原完整AttachSelf；完整Attach与首次材质缓存的46条源序列见`effect-attach-material-sol.md`。完整模型load、fog／lights及自定义effect不在此片段。NullEngine检查没有执行图形采样或像素绘制。default与section的显式脚本组合不证明其他场景绘制之后的实际D3DX省略状态、pass保存／恢复或原D3D framebuffer。当前真实技能通知尚未接入，本组不计作技能对局，也不关闭M4-07整项。
