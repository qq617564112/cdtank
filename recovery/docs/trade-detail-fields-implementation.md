# 交易详情确认字段

对应M5-11、UI-61/62/63。详情使用双方当前已确认的`TradeRecordView`，显示当前提供物的独立拥有记录；确认记录变化时沿现主页面关闭旧详情，不从商品目录补当前拥有值。

战车原`txtAttack`、`txtAttackExtra`、`txtPanzer`、`txtPanzerExtra`分别读取确认记录的0x3c、0x40、0x4c、0x50，复用`home-tank-owned-attributes.md`的字段来源。实际购买建档的基础属性明确为现重建政策；缺字段保留空白。剩余天数沿现原分钟显示合同。

宠物六技能名称按确认的base ID加`max(0, rank−1)`查询原skill目录，名称与rank来自同一拥有记录；base为0或缺失的空槽不显示rank。生命、凶猛、好运和类别沿现确认字段及原PetTable目录。

`interface/resources/role-source-descriptions.ts`保存原`Data/table/pet.dat`的10条PetInfo及`Data/table/tank.dat`的21条TankInfo，内容读取现已解码`recovery/output/verified/tables/pet.json`与`tank.json`，仅按确认记录的定义ID选择说明。部件继续读取原ItemInfo。说明不改变拥有资格、购买、技能、战斗属性或账户数据。

原布局中明确的`Text`单位与符号（km/h、sec、%及% +）保留；没有原文本的控件不按名称猜填。三个原详情的控件坐标、图片、与主页面同scale及附件字体沿现实现。说明区支持键盘焦点与滚动，Esc仍沿现组合输入门禁关闭详情并恢复焦点，Web关闭按钮保留在原stage之外。

## 未完成范围

原战车成长等级、运动、侧背、装填、内部部件及加载进度等本批剩余动态参数已接确认`role.fields`与本地目录，详`trade-owned-role-parameters-source.md`、`trade-owned-role-parameters-runtime.md`；仅剩余仍无已确认字段/目录绑定的参数保持空白。本批没有运行测试、浏览器、构建或类型检查。原详情attachment/callback、完整逐控件1:1及新字段/文字实际表现未验收；M5-11与UI-61/62/63父项保持未勾选。
