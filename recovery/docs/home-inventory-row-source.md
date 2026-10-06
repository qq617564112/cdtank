# Home 原物品名单行

UI36 / M5-09。原MyPlayer/lstPlayerItem保存owner+1f4；4e2ea7更新入口筛选原Item类别1及正拥有数量，并将名称4d8366、类别4d83b3、数量4d5f95传给行构造器4b886d。其vtable5cee5c使用已执行getPixelSize4b923b，161×56；选择背景高51，图标32×32位于5,8，名称44,12，类别44,28。数量读取MyItem+10，十进制文字右/下锚点为图标原点各加37，再减原字体extent/height。

[来源记录](/workspace/cdtank/recovery/output/home-inventory-row-source.json)保存初始化、factory、ctor、draw及getter。现正式Item分支已接独立行组件，数量不再拼接名称；源整数位置随现整页高清缩放，字体extent仍由当前选定Web字体提供。Weapon原呈现及库存分类、选择、拖放、快捷槽和查询保持。

[接线状态](/workspace/cdtank/recovery/output/home-inventory-row-preparation.json)记录最终四文件mtime及Webtype exit0。正式商城在合法已购Part检查点副本QUERY确认Item1宠物饲料10金币/10代币，然后正常BUY一件。金币12000→11990，Inventory返回instance4/ownedQuantity1；未直接修改records或资金。随后正常Home→Item在800×600、1920×1080、3840×2160验新161×56行、32图标、名称、类别、独立数量和42/45右下锚点、鼠标选择及Close严格Home入口焦点。三张完整图已查看，postBUY/preuse合法数据库与凭据已保存。原Home数字、槽与拖放业务未重复验收。

[有限实际证据](/workspace/cdtank/recovery/output/home-inventory-item-row-accepted.json)保存原raw、三行metrics、完整截图及清理结果，主审接受限定新Item行范围；统一Map7/HomeItem Web构建exit0（1分45秒），发行复制exit0，工程已回链。

后续overlay状态、原字体度量/native framebuffer和完整66控件精度仍未验收。
