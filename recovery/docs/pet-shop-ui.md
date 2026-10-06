# 宠物商店购买页面

任务：M6-06-P02。

正式商城 `AccountShopView` 增加 Pet 分类，调用 `ShopSource.petShop`，商品名、说明、金币价格、余额和基础生命值均来自服务端 `PetShop` 目录。当前交付为大麦（pet2），金币购买；页面没有软星币购买按钮。商城返回 Item 时重新查询道具目录与账户余额。

`pet-shop.tsx` 使用原 `shop_petpage.xml` 的 `lstPet`、`btnBuy`、`edtPetDesc`、`txtName`、`txtHP`、`txtMoney` 和 `txtCoin`，背景及按钮复用原图片。`picModel` 没有静态图片引用，当前保留原背景框；本项不创建没有正式资源接线的宠物模型。

Pet、Tank、Item 各自持有购买请求。Pet owner 存在于持续挂载的外层商城；关闭页面保留未确认请求与 inFlight，相同宠物重试继续同一 requestId，成功才清除 pending。忙碌期间禁止商品和分类切换，允许关闭。新页面先查询权威余额；旧页面响应不写入新页面，关闭期间购买完成时刷新当前同类页面。候选保留在 owner 中，拒绝后仍可重试。页面沿用商城的 native modal、中文键盘隔离和焦点清理。

验收入口：`[data-shop-root-category="Pet"]`；`[data-pet-shop-item]` 值 `2`；`[data-pet-shop-buy]`；`[data-pet-shop-price]`、`[data-pet-shop-balance]`、`[data-pet-shop-hp]`、`[data-pet-shop-status]`；成功实例位于 output 的 `data-purchased-pet-instance`。页面仅在 Pet 分类挂载，卸载失活请求响应和移除 session 刷新引用。

真实购买、拒绝、我的家选择、对局绑定及重启保存由 M6-06-P02 集成验收记录。
