# 商城说明标题文字

UI52 / M5-10。原ShopEquipPageItemPanel/txtType在513be2初始化并保存owner+80。选中行+9c经43bda2→413c74→411068取得原Item表记录；514658调用4d7e58读取record+14字符串，再由51466c设置控件文字。介绍独立读取record+34字符串。

[来源记录](../output/shop-description-type-source.json)保存两条调用链和输出身份。原Home主名称getter4d8366以MyItem+0c查询同43bda2，将EAX记录直接传入4d7e58，并传入调用者目标字符串；返回后只有参数栈清理，没有文字变换。原Home Item及Weapon工厂将该目标字符串传给4b886d名称列。Shop使用同表、同查找和同getter，随后直接设置返回字符串。因此商城此控件可消费现已确认的selectedproduct.name；不需要新协议字段，也不使用gamestring类别标签。

现正式四控件说明页及只读商品/Close证据保持有效。现精确接线只增加ShopItemDescriptionSource的name参数及Shop现选择商品的name透传；最终Web类型检查exit0，几何、字体与账户事务保持。首次仅验证真实QUERY后的名称随普通选择改变，介绍保持现确认内容；不购买、不复验旧完整商城。

完整native loader与原编码/字形精度仍未验收，现阶段不据此声明完整商城还原。

[名称显示验收](../output/shop-description-title-accepted.json)保存正式Shop QUERY后的两商品1/2与六完整截图。800/1920/3840下名称分别为“宠物饲料”和“大包的宠物饲料”，与当前商品name一致，介绍与原info一致；普通Close恢复Shop入口焦点。请求仅只读，未发生购买或库存写入。浏览器、Vite、服务、临时目录已清理，3553/5583/9783端口已空。此片有限接受名称getter消费者，统一Web工程由主线程登记。
