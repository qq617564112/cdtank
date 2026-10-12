# 正式我的家装备根页（M5-07）

HomeEquipmentView与库存、战车/宠物页共用myhome.xml原625×404根框。正式装备页消费anniuditu、zkb、hongsexiaodi、youbiandaditu的原中心和边框图片，显示关于我/宠物/战车三原分类按钮与btnClose；装备页选中战车分类。原布局来源与StaticImage消费者执行合同复用home-page-source.md。

原myhome_panzerpage装备分栏、拥有装备列表、装饰/标记及五部件槽继续使用已接资源与坐标。原picModel的独立战车预览保留，分类、候选和确认更新不重建scene或engine。页面按原625×404根尺寸缩放，源关闭按钮替代外部返回按钮，灰色Web边框与padding移除。加载失败时仍可返回；业务状态位于右栏底部。

源关于我按钮打开现库存根页，宠物/战车按钮打开当前账户拥有角色页。App拥有页间切换，装备session关闭时释放预览并隔离未返回请求；普通装卸、Delete卸下、确认与拒绝语义沿既有Equipment API和React装备业务。#home-equipment > output以及data-equipment-tab/item/slot/target/close保持既有页面入口。

## 边界

三分类按钮到现账户页面的导航、装备详情/状态位置、浏览器键盘与统一比例缩放属于Web事务映射。原myhome全部事件回调、属性/改装及原renderer高清像素尚未完整恢复，M5-07/UI-31/UI-32保持未完成。此交付仅关闭正式装备根框、导航与预览生命周期范围，不替代完整战车业务。
