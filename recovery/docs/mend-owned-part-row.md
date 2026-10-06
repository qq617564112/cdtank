# 维修中心原 Part 名单行

UI54 / M5-10。原 ShopMendPage/lstPart 保存于owner+0x5c，三类部件名单在原更新入口建立161像素单列，使用构造器0x4b9e77及vtable0x5ceee0。原getPixelSize0x4b923b实际返回161×56。绘制代码的32×32图标位于5,8；名称位于44,12，类别位于44,28，时长位于104,28。

类别文字来自gamestring685+原分类0x439762，即现已有classifyItemId。图标来自原Item表+0x4c，使用daoju0图集。原时长函数0x4d849e读取同一个MyItem记录+0x10，以unsigned向上整除1440，再按gamestring624“（%d天）”格式化。现InventoryWireRecord.ownedQuantity通过账户Inventory查询原样返回；仅恢复这个读取与文字显示，不增加过期、维修或取得规则。

[来源与原执行](../output/mend-owned-row-source.json)包含原列构造、行构造、绘制、名称/类型/时长getter及原尺寸、时长执行向量。新Part呈现组件已接入现有Mend名单并通过Web类型；Tank、分类选择、查询生命周期与六个禁用维修按钮保留。高清由现整页缩放放大800×600基准行，完整原字体/renderer精度仍未验证。

正式商城在合法账户检查点副本购买14003一件，资金14000→12000，Inventory返回instance3/ownedQuantity1。800×600、1920×1080、3840×2160的非空Common Part行已实际显示原名称、图标、装甲类与“（1天）”，原生点击选择并取得焦点；Close返回商城入口焦点。三张完整图已查看，真实已购SQLite副本已保存。

[有限验收证据](../output/mend-owned-part-row-accepted.json)记录三分辨率行尺寸、图标尺寸、源文字、选择、Close与进程清理。工程复用统一Map18+MendPart批次49827，类型及Web发行均通过。既有维修中心整页、战车和空类别范围沿用shop-mend-source-page-accepted.json。

时长为原始读取格式；本次qty1属于当前重建购买初值，不证明原过期权威。六个维修动作及费用、其他非空类别、自然溢出与完整原字体/native renderer仍未验收。

统一Web发行 breach10-mend-part-ammo2017-production-web-build.log actualexit0/1m32s，发布复制退出0；验收范围以对应root-review为准。
