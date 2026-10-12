# 原场景环境光 setter 调用来源

M3-03/M4-07。`gbengine.dll`导出`gbGfxManager::SetAmbientLight`地址100033b0，参数为四个32位颜色分量的指针。100033b0–100033d0逐分量原样复制到this+1a8／1ac／1b0／1b4，然后ret4；setter本身不提供场景身份、颜色选择或时序。

`scene-ambient-setter-caller-source.json`记录原CDTank.exe与gbengine.dll的最小静态引用范围：E8调用、E9跳转目标、绝对地址字节和具名字符串。CDTank.exe没有这些引用；gbengine.dll仅10050f4e导出名称，不是业务调用。已有`effect-model-source-state-native.json`的初始化RGB0.2／alpha1及setter导入检查直接复用，不重新执行原初始化。

缺口是实际场景caller及其颜色值producer。上述静态范围不排除计算调用或直接写颜色字段，不能由未找到引用宣称原对局不更新环境光，也不能把初始化0.2或当前重建白光作为原场景光照。角色SetLight、lightdir／texToon与完整shader选择属于尚未闭合的独立provider合同，详见`tank-daylight.md`。

本范围只有原二进制静态来源；没有新原执行、正式消费者或浏览器验收。ScenePreview的provider与场景生命周期由主线负责。取得具名业务producer前保持缺口，不修改生产颜色或重复同setter入口调查。
