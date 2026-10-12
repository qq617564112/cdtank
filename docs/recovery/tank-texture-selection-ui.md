# 拥有战车迷彩选择界面（M6-03）

我的家战车页提供“更换迷彩”入口，编辑所选拥有实例的 U/M/XY 三槽。组件预览和报价使用草稿；保存通过 `Battle.configureTankTextures` 获取服务器确认，结果3才更新拥有记录、角色资料余额和我的家预览。拒绝保存恢复已保存三槽和预览，账户余额保持不变。

## 原界面来源

`ui.json` 中 `myhome_panzerpage.xml` 提供拥有列表 `lstTank`、模型 `picModel`、出击 `btnUse` 与钱包 `txtMoney/txtOriginality`。`myhome_panzerpage_modify.xml` 是火力/装甲升级弹窗：等级、下级数值、成功/无效果/失败概率及 `btnModifyTank`，没有迷彩选择控件。

迷彩编辑采用 `shop_tankpage_texture.xml` 的 `btnDec/IncTurretTexture`、`btnDec/IncBodyTexture`、`btnDec/IncTreadTexture`、三个纹理名称和费用控件，以及 `shop_tankpage.xml` 的 `btnChangeTexture` 保存按钮图片。控件保留原名称、来源路径和主要位置；模型移至纹理选择条下方，报价显示明确币种。我的家导航入口是重建的拥有实例编辑入口。XML 导出的这些控件没有事件声明；浏览器箭头循环和入口组合是重建交互，不宣称已恢复 `shop_Tank_Detail` 原事件回调。

原选择入口 `0x493b5c`、请求 `0x3f98`、确认 `0x3f99` 及成功回调 `0x495a69` 的合同见 `role-texture-transfer-sol.md`。稀有度1使用金钱价、2使用代币价；只有修改的槽计费，钱包读取原资料 `+0x70/+0x74`。原稀有度0的当前选择保留可见，不能被误判成可购买方案。

## 目录与组件

名称、稀有度、金钱价、代币价和 A/B 资源状态直接来自 `/tank-textures.json`。候选须属于当前战车、对应槽、`selectable` 且资源可用；XY 要求 A/B 均 resolved。当前槽作为恢复原选择的选项保留。实际组件来自 `/tanks.json` 的非空动作组件，X/Y 合并为 XY；没有实际炮塔组件的战车显示“炮塔：无组件”并禁用炮塔箭头。缺少拥有三槽资料时界面报错，不合成默认三槽。

保存期间禁用箭头、保存和关闭，阻止 Escape，避免重复提交或丢失确认。载入期间允许返回，关闭使异步目录结果过期并清理模型。已保存相同三槽时禁用保存，符合原无变化请求门禁。

## 验证

`npx tsc --noEmit` 通过，检查界面与 Battle 确认合同的类型连接。浏览器交互验收由 `tests/browser-tank-texture-selection.mjs` 覆盖。
