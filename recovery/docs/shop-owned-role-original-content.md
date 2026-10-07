# 商城拥有角色原说明与宠物预览

对应M5-10、UI-56、UI-57、M6-03和M6-04。商城Pet/Tank拥有模式直接使用当前确认的`OwnedRoles`记录：宠物实例字段为0、`PetTable`定义为8，战车实例字段为0x1c、`TankTable`定义为0x24。拥有名称继续使用记录本身的确认名称。

Pet拥有说明按字段8调用`interface/resources/role-source-descriptions.ts`的`sourcePetDescription`，Tank拥有说明按字段0x24调用`sourceTankDescription`。两者不再要求仅含可售定义的PetShop/TankShop QUERY返回项，未知定义或缺少拥有记录时保持空白。Pet生命值按`home-pet-owned-details.tsx`与`trade-source-detail.tsx`既有消费者读取确认base记录字段0x2c；Pet预览也直接使用拥有记录的字段8选择`PetModelPreview`。Tank预览继续使用拥有记录定义和`readOwnedTankTextures`，定义字段沿用`home-equipment.tsx`、`home-roles.tsx`和交易详情消费者。

Buy模式继续显示当前PetShop/TankShop QUERY确认的商品名称、说明、Pet生命值、商品价格和Tank默认纹理。拥有说明不改变拥有列表、出售资格、余额、购买/出售事务、属性、技能或角色选用。说明区保持原`edtPetDesc`/`edtDescription`坐标、统一比例缩放、附件字体和滚动样式，仅在确有说明时设置region名称并允许键盘焦点滚动。

说明切换只随当前确认拥有记录同步计算，没有新增描述请求或迟到响应。

## 拥有属性

商城拥有Pet/Tank属性只按当前确认的所选`OwnedRoles`记录显示，不从商品目录、当前已装备角色或战斗最终属性补值。Pet在Owned模式读取base记录`txtCritical`=0x34、`txtLucky`=0x3c，fields现随mode/ownedRecord派生；`directory`模式仍用`petShopDirectoryDetails(petId)`原critical/lucky，不从拥有记录拼值。owned实际0必须显示，缺记录或字段显示空。既有owned六组技能base0x44/rank0x5c、技能弹窗/复制来源、HP0x2c、说明、预览、read-only状态及字体/缩放保持；熟练度仍是`petShopMastery`原目录，没有confirmed owned映射，不发明偏移或公式。

Tank Owned模式新增原同名控件`txtAttack`0x3c、`txtAttackExtra`0x40、`txtPanzer`0x4c、`txtPanzerExtra`0x50、`txtAttackLevel`0x44、`txtPanzerLevel`0x54，从当前选择实例0x1c的`ownedRecord/ownedFields`读取，实际0显示、缺值空，只在Owned模式渲染。Buy六目录属性与`TankShopBuyParametersView`不改；owned侧/背/速度/转向/间隔/容量本批不填。呈现沿现`SourceFeedbackStaticText`alias、用户选字体、白字、原布局及`SourceImageScale1`与CSS类；ownedpart、preview/description/texture、sale/purchase、pending/sale selection/source lifetime保持完整。不增API/server/schema/请求/余额/保存/升级业务。

独立只读归属可加明确data-binding/offset/value，不改交互；runtime接线与门禁见`shop-owned-role-attributes-runtime.md`。

静态走查范围为`f4b0d03..231c79c`，仅覆盖原说明批的两页说明实现、确认字段、原说明目录及相关说明文档。确认记录取值、Buy数据、预览清理、选择/刷新、pending事务和原坐标/缩放/字体/焦点链正确，未发现P1/P2问题。本次BH拥有属性改动不在该走查范围内，BH集中走查尚未发生。

## 未完成范围

本批没有运行测试、浏览器、构建、类型检查或导出。新拥有说明、拥有Pet预览和商城未售定义的切换尚未做实际页面验收；新拥有属性（Pet txtCritical/txtLucky、Tank txtAttack/txtAttackExtra/txtPanzer/txtPanzerExtra/txtAttackLevel/txtPanzerLevel）只登记固定采用范围，尚未做页面/source/HD/runtime实测，不把旧说明或旧目录cap验收算作拥有属性通过。UI-56、UI-57、M5-10、M6-03、M6-04和完整商城1:1父项保持未完成。
