# 商城已拥有道具行

UI53 / M5-10。原49e988加载shop_itempage.xml，根前缀ConvenientPage，49ea3f查找ConvenientPage/lstMyItem并在49ea68保存owner+40。此名单与Home名单分别构造。

原4a0e83按43bd13返回分类1筛选，4a0e95读取MyItem+10，unsigned非正时跳过。4d8366取得名称，4d83b3取得类型，4d5f95取得原数量文字，4d95eb取得额外文字；4a0f1a创建4b9251行，4a0f2f向owner+40插入。该行vtable5ceec0的尺寸getter为4b923b，绘制为4b96e3。

[原指令证据](../output/shop-owned-item-row-source.json)保存controller、factory、constructor、draw和常量。拥有模式constructor+1c置row+558，绘制原点横移1；选中区161×51，图标相对该原点(4,8)，名称/类型横移43，纵向分别4、18，数量使用原Cheap字体在图标右下按文字宽度定位。Home的4b886d绘制不能直接代替此行。

后续交付仅左侧Item拥有行与必要数据透传。正式QUERY、购买、选择、右侧商品名单及名单滚动保留。已保存合法宠物饲料实例可复用，不需购买。原尺寸getter已执行返回161×56。数量右边界37、底边界40，按字体文字宽度/高度对齐图标右下；现Cheap原字体metrics仍待恢复。独立shop-owned-item-row-content.tsx/css已准备且未导入。第四文本4d95eb→4d85e8读取Itemrecord+ec unsigned右移1并拼接gamestring81；没有已证现wire映射，保持空白。完成数据透传准备后协调生产接线及首次实际三分辨率验收。现仅左Item类别接入独立行组件，透传现Inventory的itemTableId与ownedQuantity，正数量过滤不改变原记录计数或右侧商品/Weapon名单。

[实际验收](../output/shop-owned-item-row-accepted.json)保存10-58-51唯一首验PASS及三完整800/1920/3840图。普通Shop读取合法保存的宠物饲料Item1/quantity1，原行名称、道具类型、图标与独立数量按源位置显示；选择焦点与strictShopClose通过，无购买/槽/房间写入。最终Webtype13537 exit0，Chrome/Vite/服务/临时目录已清理，3554/5584/9784空。统一工程与独立主审由主线程登记。
