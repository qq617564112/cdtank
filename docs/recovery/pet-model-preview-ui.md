# 正式宠物模型预览入口

对应任务：M6-04-PREVIEW。

我的家宠物页和商城 Pet 分类在原 `picModel` 矩形挂载共享 `PetModelPreview`。我的家模型使用当前显示记录的字段 `0x08` 作为 PetTable ID，候选选择和当前选用回退仍沿用已有 `displayed` 规则；`kind="home"`。商城使用服务器目录 `product.petId`；`kind="shop"`。两处传入页面高清缩放 `scale`，复用原资源布局坐标。

模型生命周期由共享预览组件持有。切离宠物页、关闭我的家或商城、移除候选显示时，React 卸载对应实例；普通角色选用及购买请求、确认状态和持久化逻辑沿用现有模块。入口没有创建额外网络请求或修改角色规则。

入口选择器：我的家 `[data-home-pet-preview]`，商城 `[data-shop-pet-preview]`。共享组件提供 `data-pet-model-preview`、`data-preview-kind`、`data-pet-id` 和组件状态。模型路径恢复、实际绘制及生命周期验收由 M6-04-PREVIEW 共用证据记录。
