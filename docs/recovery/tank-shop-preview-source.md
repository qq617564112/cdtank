# 正式商城商品战车预览来源（M5-10-T03-P）

正式Tank商品页可直接使用原战车3模型和tankshop默认U/M/XY30041/30042/30013。现有来源证明商城默认纹理的详情actor消费，不能证明商城与我的家使用同一初始镜头或自动转动。商城独立场景的取景和交互在本片明确采用Web重建；原镜头/像素精度父项保持未完成。

## 原商品与布局

`shop_tankpage.xml` 的 picModel 是没有Image属性的模型窗口，源位置(225,52)、大小218×217，沿商城根页的统一比例缩放。它不是应当寻找图片补齐的空StaticImage。左lstTank选择TankShop QUERY确认的商品3；模型来源是定义3，不能借用当前账户拥有战车或当前房间tankId。

原 `0x4b6ce1` 的详情状态0保存传入定义到UI+1a4；`0x4b6db6–0x4b6eef` 按定义查询tankshop，再按记录+10/+14/+18查询tanktexture，并调用U/M/XY设置入口46cc73/46cd15/46cdb7。该商城默认来源已经有11条原生执行结果，见role-tank-texture-producer-sol.md与output/role-tank-texture-producer-sol-native.json，本轮直接引用。

商品3实际三条默认纹理为30041→003U_004.tga、30042→003M_004.tga、30013→003XY_001_A.tga。正式TankView已有原M/U/X/Y组件、待机动作、挂点与组件级纹理覆盖实现，可复用模型与纹理加载能力；无需创建虚假拥有记录，也不把默认纹理授权给玩家。XY初始A同时覆盖X/Y的已有合同沿用，不能另外推定Y=B。

## 通用预览容器与镜头边界

商城详情创建代码 `0x4b6b6e–0x4b6b9b` 分配50hex字节，调用472c12并把容器存到页面+30。472c12初始化preview字段、取得引擎+ b8并调用44727c(mode2)。这些静态指令说明商城使用同一通用preview类型和mode2入口；原构造使用共享引擎状态，不能据类型复用推定相机姿态相同。

我的家自动转动证据限定MyTank `0x4e5e22–0x4e5e3a` 调用472e01(0,float32(.0075))。`home-preview-orbit.ts` 的每更新增量及float32合同属于这个页面caller；现有64样本没有执行商城caller。near10/far5000和mode2向量证据也限定已执行的Home绑定入口。现有证明不足以将Home orbit、初始视角、逐帧更新频率或裁剪参数认作商城完整原规则。

因此商城preview应直接复用TankView，不导入advanceHomePreviewOrbit。独立Babylon相机按原模型边界取景、使用选择的初始方位、照明和交互参数，均作为Web重建展示规则记录；是否允许用户拖动可由本次正式交互选择，不需等待未取得的Windows镜头producer。这里不增加原相机或转动native取证。

## 本片可验收行为

大厅商城进入Tank页后，picModel实际绘制商品3的原组件待机模型并应用三条默认纹理；画布随800/1920/3840页面实际像素尺寸更新。普通QUERY刷新、购买成功或拒绝保持当前场景，不把商品预览替换成账户装备状态。切回Item或关闭商城释放模型、场景与engine，重新进入重新加载且继续绘制。

这一验收识别空picModel、错误定义/默认迷彩、缩放后画布尺寸错误、交易刷新重复建场景及退出仍渲染等具体失效。既有购买/我的家选择/正式入场/保存证据直接复用，本片不重复两局或服务重启。

## 剩余范围

商城具体camera framing、原交互转动caller、原光照/投影完整参数、Windows逐像素精度及其他商品预览没有在本片恢复。通用容器静态指令与Home专属native证据分别保留其范围；商品可见预览闭环通过不关闭上述精度父项。

正式实现：resources/tank-product-preview.tsx持有Engine/Scene/camera与ResizeObserver；TankView按商品定义和默认三纹理加载，React仅页面状态与模型身份，模型依赖不包含query/busy。重建静态相机alpha=-pi/2.5、beta=pi/3，radius为原模型包围盒对角线×1.4，near10/far5000、半球光1.2；这些值不称商城原参数。无Home自动orbit或外部camera操纵。缩放提交与元素resize重算实际canvas像素；返回Item/关闭释放，迟到TankView加载结果立即dispose。介绍使用原edtDescription矩形并移出模型窗口，价格为当前Web映射。
