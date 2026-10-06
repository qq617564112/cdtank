# 商城战车商品源模型预览

正式商城Tank页的战车3「游骑兵」在原shop_tankpage.xml的picModel区域真实绘制源模型与默认材质。预览保持独立静态场景，刷新、购买等待、购买成功及余额不足拒绝均保留同一场景；切换Item页或关闭商城释放模型、scene和engine，再打开重新绘制。

本片对应M5-10-T03-P，仅验证商品页面预览、源布局与实际浏览器生命周期。付费交易、拥有装备、我的家选用、普通入场和持久恢复沿`tank-purchase-network-browser.md`既有结果，不增加网络实验、角色夹具、战斗或重启。商品默认选择3，默认贴图U30041／M30042／XY30013。

`tests/browser-tank-shop-preview.mjs`使用独立index3242、正式Vite5402与Chromium9602，一张普通页面及专用账户余额3000金币／1000软星币。实际点击刷新、BUY一次后余额500，再点击BUY收到余额不足，均用于同一预览跨业务状态保留验证。后续通过普通Tank／Item分类按钮和商城关闭按钮验证释放与重开。

## 实际模型与源布局

只读EngineStore定位picModel canvas所属engine、scene，读取四个已启用源网格及材质纹理，订阅其onAfterRender观察真实绘制。初次记录实际draw4；源车身网格684顶点、炮塔378顶点、两履带各180顶点。材质使用`003M_004.png`、`003U_004.png`、`003XY_001_A.png`。

相机保持商品预览静态重建构图，观察脚本没有修改相机、模型、灯光、材质或位置。普通全页截图中商品模型在原picModel区域可见。

| 视口 | 源缩放 | picModel相对stage位置 | 实际区域宽高 | Canvas像素 |
| --- | --- | --- | --- | --- |
| 800×600 | 1 | 225／52 | 218×217 | 218×217 |
| 1920×1080 | 1.8 | 405／93.59 | 392.39×390.59 | 392×391 |
| 3840×2160 | 3.6 | 810／187.19 | 784.80×781.19 | 785×781 |

三次普通视口Resize均保持同一element、engine与scene；Canvas实际像素等于区域尺寸四舍五入值。源基准矩形为(225,52)、218×217。

## 场景保留与释放

| 普通页面操作 | 实测 |
| --- | --- |
| 刷新余额 | busy true→false，预览element／engine／scene保留，累计draw388 |
| BUY成功 | busy true→false，余额3000→500，预览保留，累计draw444 |
| 再BUY余额不足 | busy true→false，预览保留，累计draw496 |
| Tank→Item | element断开，engine和scene均disposed，帧计数163停止 |
| Item→Tank | 新engine／scene，实际draw12 |
| 关闭商城 | element断开，engine和scene均disposed，帧计数20停止 |
| 再打开商城 | 新engine／scene，实际draw12 |
| 最终关闭 | element断开，engine和scene均disposed，帧计数19停止 |

busy期间通过MutationObserver读取商城aria-busy和现有预览引用，六个等待／确认样本均保持同一element和engine，scene／engine未释放。累计draw是源网格实际绘制次数，不作为每张截图的逐帧绑定证明。

有效PASS为`recovery/output/browser-tank-shop-preview-2026-10-04T12-33-17-667Z.json`及`.log`。同一记录的三分辨率正式全页画面为`-preview-800.png`、`-preview-1920.png`、`-preview-3840.png`；`-purchase-kept-preview.png`记录业务操作后预览仍正常显示。

## 已知边界

模型与默认贴图来自原恢复资源；静态商品相机、灯光和框取为重建展示，未声明原客户端商品镜头参数的像素一致恢复。当前商品范围仍限战车3；本片不扩展其它商品或原普通射击FX。

## 清理

所有专属index、Vite、Chromium和连接已停止，临时SQLite及浏览器目录已删除。3242、5402、9602无监听进程，`/tmp/cdtank-tank-shop-preview-*`无残留。独立原始记录与三分辨率画面保存。
