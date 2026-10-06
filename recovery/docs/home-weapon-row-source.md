# Home Weapon 原名单行

UI36 / M5-09。原MyPlayer/rdoWeapon字符串5d2428，初始化4df30d将控件存于owner+1fc。4e5123订阅该控件的选择变化，使用共同回调4e5041；原selected分支4e50b9→4e50db调用Weapon更新4e4bef。Tooltip取gamestring248“查看你的武器列表”。

[来源记录](../output/home-weapon-row-source-preparation.json)保存订阅、回调和独立factory。factory读取库存管理器+1c正数量记录，以原439762 kind3/4筛选炮弹及陷阱；名称4d8366、类别4d83b3、数量4d5f95传给同4b886d行构造器。原gamestring688/689为“炮弹”/“陷阱”。因此复用Item已证的161×56行、51高选择图、32×32图标5,8、名称44,12、类别44,28和数量右下42/45锚点。

现Weapon分支复用同HomeItemRowContent，仅增加原kind3/4文字及Weapon选择器；Item布局、库存查询、快捷槽、拖放和选择行为保持。记录[最终接线与类型检查](../output/home-weapon-row-preparation.json)。首验仅使用原正常购买后保存的trap检查点副本，类别2的instance3/item3003/qty1；不新增购买或消费。

MyItem+1c==2的后续overlay状态、完整66控件与原字体/framebuffer精度仍未完成。MyPlayer/lstPlayerValuable属于独立owner+254/factory4e30f9，本片不借作Weapon来源。

[三分辨率有限实际证据](../output/home-inventory-weapon-row-accepted.json)：800×600、1920×1080、3840×2160完整图已查看；捕兽夹/陷阱/独立数量1、原行与图标大小、数量42/45锚点、鼠标选择与严格Home入口焦点通过。原网络仅只读查询，runner exit0，Chrome/Vite/server/temp及3551/5581/9781端口已清理。主审接受限定Saved Trap新Weapon行范围；统一Map22/Weapon/2019 Web构建exit0（1分38秒），发行复制exit0，工程已回链。
