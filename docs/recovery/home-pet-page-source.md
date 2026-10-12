# 我的家宠物整页主要区域

M5-08/UI-34使用myhome.xml625×404原根与myhome_petpage.xml原子页，后者根顶边36沿完整父链累加；以800×600为Web基准按统一比例居中。

home-pet-source-page.tsx消费23原StaticImage，包括模型底图、右属性框与生命/凶猛/好运/技能图字、底熟练度背景与四车型标签、左数量/金币/技能点图条及maogou页签。SourceStaticImage复用原中心/八边框消费者；名称由原txtPetName/SourceStaticText显示。lstPet选中使用原SelectionImage，btnUseMe用SourceButton原Normal/Hover/Pushed/Disabled规则。右技能/成长数值及余额不补造。

现HomeRoles React session保持拥有查询、候选、选择确认与恢复流程；PetModelPreview仍按原picModel218×218显示定义ID对应的已恢复n1模型。不修改账户事务、网络、宠物数值、技能绑定或Babylon生命周期。原框下保留当前业务提示，避免覆盖熟练度区域。

归属：UI线home-pet-source-page.tsx、home-roles.tsx仅pet呈现与选中图、home.css pet限定、新browser-home-pet-page.mjs及本片文档；主线仅SourceButtonProps.suffix追加myhome_petpage.xml，无共享运行改动。模型与选择业务复用已有有效证据。

## 实际页面验收

browser-home-pet-page-2026-10-04T15-53-19-347Z.json为PASS7；同前缀-pet-800.png、-pet-1920.png、-pet-3840.png三张完整页面已实际查看，覆盖800×600、1920×1080、3840×2160。原主要背景、图字、属性框、熟练度区域、候选列表、模型和选择按钮在场，业务提示位于原框下方。

普通鼠标经过原btnUseMe Hover/Pushed并保存候选宠物71，权威RoleProfile的profile+a4返回71，按钮转Disabled，模型预览保留。源Tank/Pet切换恢复权威选中宠物；Player返回库存页，Close恢复大厅我的家入口焦点；宠物页源Close释放预览并恢复同一焦点。悬停、按下和返回页面截图同前缀-use-hover.png、-use-pushed.png、-player-return.png。

拥有夹具显式导入role-owned-pair-native.json rows[0]的宠物71和战车72，不代表普通获取流程。宠物定义2预览ready已独立检查；三张页面check的state.preview使用战车选择器而为null，不用该字段声明宠物像素尺寸或完整模型精度。模型照明偏暗沿现有预览范围保留。

home-pet-page-types.log记录Webtype通过。专属服务器3364、Vite5414、Chrome9614和临时目录清理均为true。本次验证覆盖主要区域、普通选择保存及导航，不代表技能培养或完整64控件验收。

```sh
npm --prefix apps/web run typecheck
node --import tsx tests/browser-home-pet-page.mjs
```

## 限制

确认金币/拥有数量与原picAlreadyUsed当前状态消费已接，普通购买到选择证据见home-pet-confirmed-state.md。完整64控件、生命/技能/成长数值与技能详情/培养仍未接入。原picAlreadyUsed显隐事件producer、原名单行高/滚动与字体/Windows/GPU/高清锚点未闭合，M5-08/UI-34保持未勾。已恢复静态区域不代表完整原宠物页1:1。模型镜头、照明和循环仍沿现有明确重建范围。
