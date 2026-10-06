# 宠物2的Home与商城模型预览来源

原Home MyPet与商城ShopPet都创建真实宠物3D actor，pet2“大麦”有可直接使用的原模型及现存GLB。两个页面的picModel空框可以正式接入模型；头像资源不能替代这条原模型链。

## 直接加载caller

Home `0x4dd31f–0x4dd344` 从页面+24的PetTable记录取+c定义ID，经5c1ad4字符串`%.3d`格式为002，调用页面+e8的472e4c(name,1)。商城 `0x4b1884–0x4b18a6` 从页面+2c的PetTable记录取同一+c，格式化为002并调用页面+44的472e4c(name,1)。两入口使用的是定义，不是PetType、中文名称或拥有实例。

通用预览472e4c先清旧actor；其第二参数1分支 `0x472ed3–0x472f0b` 分配b0hex对象、执行46abcd构造，并调用该对象virtual+4。原5c8860虚表确认virtual+4为46add4。`0x46add4–0x46ae2d` 用5c73a0常量`%s\%s\%s.ini`、5c8880常量`data\pet`以及传入编号两次构造路径，通过引擎actor manager的IAT5c0a00加载。pet2路径明确为 `data\pet\002\002.ini`。

`0x46ae63–0x46ae8f` 设置actor成员并经46ad9a调用GotoAction，5c733c为原常量`n1`，另一参数0。原pet2 INI只有action_1，name=n1、file=n1.MV3。因此本片默认状态为原n1动作，不套用坦克01/02动作命名，不推定攻击/受伤模型存在。

## 可实现资产

原最终选中资产 `recovery/output/verified/assets/data/Data/Pet/002/002.ini`、`n1.MV3`与`11005.dds`存在；现导出 `recovery/output/web-assets/Data/Pet/002/n1.glb` 与 `11005.png`存在。模型可通过现存Babylon glTF loader加载；不需要新的MV3格式、另一套转换器或虚假GLB。采用该模型自带材质及源纹理，不把宠物头像20图集用作3D材质。

这条actor加载没有按PetType找路径，没有额外按名字查纹理，也没有使用战车U/M/XY覆盖；pet2的n1模型/材质已有转换源。正式实现可针对pet2加载上述一个GLB并保存独立actor/root生命周期，使用原n1轨道与现有动画播放能力。当前切片不审计全动画插值、所有宠物或原GPU像素。

## 相机、旋转与坐标范围

原MyPet更新 `0x4dc0c7–0x4dc102` 在preview存在时调用472e01(0,float32(.0075))，随后将页面delta传给472cd9。这个MyPet caller明确存在，故Home宠物自动orbit有独立页面依据，不是从MyTank名称推定。原常量5cded4静态值为0.007499999832361937。

Home/Shop都复用472e4c的pet actor，但本片没有取得两页完整初始camera framing、缩放/位置赋值和商城自动转动caller。46ac92原渲染用成员+28/+2c/+30平移、+48角度旋转；46ae49之后复制源+7c/+80/+84和当前位置成员，不能据这些消费者给源未取得的页面坐标编造值。正式页面按模型边界取景、独立相机初始角、灯光与缩放是明确Web重建展示规则。商城不自动沿用Home .0075；Home若复用该orbit算法需标记这是已定位caller但本片没有新增执行矩阵。

## 可接线合同与验收边界

Home按本账户选中拥有base+8解析到pet2定义，Shop按QUERY确认的商品定义2，均显示原n1模型。两者可以共享一个独立宠物模型预览组件，但各自不混用拥有实例/商品所有权。普通选用、QUERY刷新或交易状态变化保持scene，页面切换/关闭释放actor、scene、engine；重新进入继续实际绘制。使用源picModel矩形和实际canvas像素尺寸承担高清页面验收。

一次有限静态核对结果保存 `recovery/output/pet-model-preview-source-sol.json`。此来源足以接pet2可见模型与生命周期；不存在模型缺档阻塞。原camera/缩放坐标、商城旋转、n1逐帧精度和完整Windows图形仍未恢复，不因一个可见宠物预览关闭精度父项。本轮未修改生产/tasklist或运行native。
