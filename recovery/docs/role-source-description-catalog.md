# 原角色说明目录

`interface/resources/role-source-descriptions.ts`提供原21条TankInfo和10条PetInfo，内容来自现已解码`output/verified/tables/tank.json`、`pet.json`。`sourceTankDescription`与`sourcePetDescription`只按原定义ID返回文字；没有ID或目录没有该ID时返回undefined。

该目录供交易详情和Home拥有角色页面共用。确认拥有记录的名称、属性、等级、技能、耐久及当前选用资格仍由各页面现权威查询返回，不从说明目录生成记录或补数值。商城出售过滤只决定商品目录，不决定已拥有角色是否能够显示原介绍。

交易详情保持现确认记录及原布局，部件仍使用原ItemInfo。Home战车、宠物与装备页的接线范围由`home-role-original-descriptions.md`登记；描述均从各页当前确认角色的原定义ID选择。

## 未完成范围

原介绍文字的目录来源确定，不证明原控件setter、attachment/callback或Windows最终像素一致。本批没有运行测试、浏览器、构建、类型检查或导出。新Home说明的实际显示、切换与释放验收保持所属M5父项开放。
