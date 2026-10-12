# 建房页面源视觉切片（UI-07-R）

正式 `RoomCreateDialog` 恢复源控件矩形、源 PNG、启用的静态框图、人数箭头与确认按钮状态，并沿既有草稿和权威 CreateRoom/Join 业务。页面以800×600为基准，1080p比例1.8、4K比例3.6；没有附加金色HTML窗口框。

来源为 `recovery/output/verified/assets/data/Data/ui/layouts/createroom.xml`，与下载补丁同名布局的既有来源核对保持有效。所有图像使用 `ui.json` 中DDS优先的图集裁块，源区域尺寸来自原imageset的Width/Height，透明像素保留PNG alpha。

原布局36个控件中：`all`作为布局根；`quxiaoditu`提供关闭按钮父坐标；`zhezhaoditu`是覆盖800×599的源遮罩；其余34个控件（含遮罩）由正式React节点绘制，包含新接入的`heseditu`和两枚只读CatVsDog标记。根与父坐标在sourceProps中累加后统一减(246,130)，保留现正式页的310×328裁切矩形。

`daditu`、`ditu2`、`ditu3`绘制八个FrameImage及中心Image，`xiaoditu`绘制左右FrameImage。局部renderer按原图块尺寸保留边缘，中心区域铺满剩余矩形。`tiao1`/`tiao2`明确`FrameEnabled=False`，不绘制其frame引用。CEGUIBase.dll的`Static::drawSelf`入口0x100ad480，在0x100ad4bc读取对象+0x328，0x100ad4c2测试，0x100ad4c4跳转0x100ad54f跳过frame；`Static::getUnclippedInnerRect`入口0x100ad090同样按+0x328决定是否应用四个frame inset（+0x494..0x4a0）。本切片读取原DLL指令建立开关依据，没有执行这些原函数或原GPU绘制。frame inset生成与目的矩形已执行原完整函数，来源与provider边界见`room-create-frame-source.md`。

字体加载沿既有source-ui-fonts，使用已发布的原MingLiU面。`SIMSUN.font`为Size9、NativeHorzRes800、NativeVertRes600、AutoScaled=true、AntiAlias=false；Web采用12px/16px行高、源字体和同一页面scale。它恢复原字体资源，不证明原默认字体继承、9号字体在原设备上的点/像素转换、行距、字宽或抗锯齿逐像素相同。

状态由正式RoomCreateButton消费原ButtonBase hover/pushed分派与WLButton/WLRadioButton图片层，见room-create-button-source.md。RadioButton按状态背景后CheckMark独立绘制，缺DisabledImage不替换Normal；禁用图片保持源alpha1。模式标记保持只读。

## 精度缺口

- 本机没有可运行的原客户端会话入口及Wine，未取得原程序800×600 framebuffer截图。正式React截图和源PNG的比对不是原客户端截图对照，完整1:1保持未完成。
- 原CEGUI frame inset生成、frame目的矩形及内框已执行并接入React。中心图格式化与clip相交已执行（见room-create-image-source.md），最终采样、颜色乘法和父alpha未执行，保留导出的原PNG alpha；完整透明混合仍未证明。
- 输入颜色/默认字体fallback消费者已执行，见room-create-input-source.md；无Font时取System默认Font的规则与WindowsLook覆盖颜色已有原入参证据，实际默认Font配置、字形排版与GPU保持父未完成。
- `zhezhaoditu`已按源矩形和PNG alpha接入正式React，native dialog backdrop透明。完整原父alpha/最终GPU混合未执行。载入/错误提示、焦点轮廓及密码圆点是Web界面表现。错误保留与权威拒绝已验证，原错误提示视觉未知。

## 源遮罩（UI-07-R-MASK）

`zhezhaoditu`是`all`的第一个child，源XML没有Visible、AlwaysOnTop或独立alpha覆盖。AbsoluteRect(-248,-141)..(552,458)累加父all@(248,140)后是原屏幕(0,-1)..(800,598)，尺寸800×599，ClippedByParent=False、FrameEnabled=False。引用`gy0/data\ui\gy\zhezhaotu.tga`对应DDS裁块`ui/regions/60/128.png`，30×30的每个像素alpha均153，主体RGB(0,33,74)，少量边缘色保留。

正式React在dialog中先绘制fixed source mask，再绘制相对定位舞台；mask保留alpha，pointer-events:none，native backdrop设透明。遮罩坐标置于居中的800×600基准区，以min(viewport/800,viewport/600)缩放，保留源顶部-1和599高度。原兄弟层级与未裁剪父节点能够证明此局部资源/几何投影；原客户端对宽屏基准区的完整自适应策略仍未执行。viewport宽高由React state保存；比例不变的宽屏resize仍更新居中偏移。关闭条件卸载dialog及mask，背景不再被遮罩覆盖。
