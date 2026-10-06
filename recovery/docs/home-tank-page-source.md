# 我的家战车整页主要区域

M5-07/UI-32采用myhome.xml的625×404根框与myhome_panzerpage.xml的原子页；子页SheetWindow顶边36，全部区域按父链累加，不另造坐标。React角色session保持拥有查询、候选、选择确认、预览与迷彩业务。

home-tank-source-page.tsx消费36个源StaticImage：模型底图、右侧属性框及黄条/装甲图字、底部参数框和移动/转向/射击/装填图字、左下数量及两余额条。每块中心与八边框复用SourceStaticImage，不使用CSS矩形替代原图；源DDS选择沿既有消费者，原运行时图集选择仍未闭合。

名称txtTankName复用SourceStaticText；原rdoTank/rdoEquip与btnUse复用SourceButton原状态消费者。rdoEquip调用既有装备导航；btnUse调用当前selectRole确认流程，pending与当前角色资格沿现账户业务。拥有列表选中项使用lstTank原SelectionImage；行高、滚动和文字列表仍为现Web适配。迷彩和状态工具位于原根框下方，避免覆盖底部参数区。页面使用原800×600基准的统一Web比例，窗口居中，模型仍按原picModel218×218区域显示。

文件归属：UI线home-roles.tsx的tank呈现及可选onEquipmentPage接口、home.css限定tank样式、新home-tank-source-page.tsx、browser-home-tank-page.mjs与本片文档。主线拥有App导航回调与SourceButtonProps.suffix类型扩展；不改共享按钮运行逻辑、网络、账户事务或预览生命周期。

## 限制

右属性文本、等级、耐久、余额、改装资格、装填进度及原完整93控件仍缺正式消费者与来源合同。本片只恢复有原图布局依据的主要区域，不填造数值或改装行为。部件业务仍由现独立装备页承载；迷彩编辑入口和业务提示仍是Web接线。完整原Windows截图、高清显示锚点、字体/GPU及全页1:1未完成，M5-07/UI-32父项不勾。
