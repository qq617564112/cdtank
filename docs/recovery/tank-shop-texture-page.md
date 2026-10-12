# 正式战车商城拥有迷彩页

M5-10/UI-59已从正式Tank原rdoTexture接入真实拥有实例，复用Battle.ownedRoles/roleProfile/configureTankTextures既有合同。拥有战车必须来自确认equipment记录，实例键+1c/车型+24/三纹理由readOwnedTankTextures读取；不存在记录时名单空、保存禁用，可回原购买页取得战车。Home拥有迷彩能力由原入口导航至同一正式商城页，实例与返回候选/焦点见home-shop-texture-navigation.md。

## 页面和状态

根沿shop.xml625×404，原Tank38图主要区域和lstTank名单选中图复用；纹理子页消费3名称背景、3原点图、3软星币图，6箭头沿SourceButton正常/悬停/按下/禁用消费者。原txtTextureName/Expense映射现表名称/费用，原btnChangeTexture调用已有配置事务。不同币种的报价以文字明确，未证明原动态图切换。子页XML完整父链加Tank根y36作为当前组合，保留原模型picModel坐标，不迁移或缩小模型；该父附着为重建组合。三res图可见候选条在模型上方，当前tank3模型无遮挡可辨。

名单由React拥有候选、Home/End/方向键与焦点；真实texture catalog过滤当前车型、实际组件和resolved资源，保留已拥有默认槽，不补造槽ID/稀有度。草稿使现TankProductPreview消费实际候选，保存成功才接受result.owned/profile；拒绝恢复已确认选择。refresh/交易/候选保持同preview DOM/engine/scene，不改Babylon生命周期或原账户事务。纹理查询/保存归owner.texture，关闭active隔离，晚确认触发当前owner会话重新查询；并发查询排队刷新。

名称/费用深色为明确Web可读呈现，保存按钮无原DisabledImage，本页使用原NormalImage半透明显示不可用状态，data-presentation-state=web-disabled；保存后禁用按钮，焦点恢复当前拥有行。原完整禁用呈现仍未证。现刷新和事务状态在原框下，不代表原producer；原参数数值留空。

归属：tank-shop.tsx/css正式入口、shop.tsx ShopSource仅三个现合同可选方法、新tank-shop-texture.tsx与tank-shop-texture-source-regions.tsx、专属browser/source/doc。root的SourceButton suffix仅类型扩展。source.方法调用保留this；App Battle现方法直接满足，不改主入口。

## 实际整页和操作

browser-tank-shop-texture-page-2026-10-04T16-50-02-267Z.json PASS。800/1920/3840三张-texture-*.png已实际查看，正式根/原购买与换涂装入口/38Tank图及9texture图/拥有名单/三组件名/模型/保存和框下状态可见。初始新Account拥有为空，原购买页实际TankShop BUY商品3取得实例1，显式资金20000金币/200代币，购买后金币17500。正式rdoTexture重新查询真实拥有实例，不导入拥有记录。

普通拥有行点击/Home/End、原箭头逐项候选至炮塔警车31011→原更换按钮，真实TankTextures确认result3，U31011/M30042/XY30013，代币200→150，金币17500保持。模型由原默认炮塔换为警车110图，-candidate/-saved.png与三res均实际查看。确认后保存禁用，拥有行焦点恢复；刷新及回购买/再开迷彩查询均保确认三槽。切购买释放，重进新scene，Close释放/旧帧停止并恢复大厅商城入口焦点。

browser-tank-shop-texture-page-2026-10-04T16-52-58-465Z.json PASS为定向拒绝，未重复三res或成功配置。显式25代币、新账号正常BUY取得战车，普通原箭头选同50代币方案，实际API拒绝TANK_TEXTURES_REJECTED/代币余额不足；恢复确认默认三槽/预览，普通刷新真实RoleProfile确认25不扣费。-rejected.png已实际查看，错误可辨，Close资源清理和焦点通过。两份有效raw记录server3369/vite5419/chrome9619/temp清理四项true。

tank-shop-texture-page-types.log当前Webtype通过。当前Web发行和必要边界工程检查由主线统一batch，本片不重复构建。已存在Home双端纹理同步/重启等证据仅沿原tank-texture-selection-browser.md限定业务scope引用，本片未重新执行双端战斗同步，不作为商城新整页视觉证据。

```sh
node --import tsx tests/browser-tank-shop-texture-page.mjs
node --import tsx tests/browser-tank-shop-texture-page.mjs --rejection-only
```

## 未完成

原texture sheet动态父附着、币种图选择、字体/原最终文字颜色、完整禁用状态、原箭头循环事件与全部26控件/高清锚点/原截图1:1仍未闭合。当前可用链限定实际购入tank3实例及炮塔31011，未将名单/目录过滤扩大为全部车型或三槽所有方案精度通过。关闭保存晚响应沿owner隔离实现，本片操作证据在确认后关闭；未称该边界已新实测。M5-10/UI-59及完整商城父项未勾。
