# 商城拥有角色原说明与宠物预览

对应M5-10、UI-56和UI-57。商城Pet/Tank拥有模式直接使用当前确认的`OwnedRoles`记录：宠物实例字段为0、`PetTable`定义为8，战车实例字段为0x1c、`TankTable`定义为0x24。拥有名称继续使用记录本身的确认名称。

Pet拥有说明按字段8调用`interface/resources/role-source-descriptions.ts`的`sourcePetDescription`，Tank拥有说明按字段0x24调用`sourceTankDescription`。两者不再要求仅含可售定义的PetShop/TankShop QUERY返回项，未知定义或缺少拥有记录时保持空白。Pet生命值按`home-pet-owned-details.tsx`与`trade-source-detail.tsx`既有消费者读取确认base记录字段0x2c；Pet预览也直接使用拥有记录的字段8选择`PetModelPreview`。Tank预览继续使用拥有记录定义和`readOwnedTankTextures`，定义字段沿用`home-equipment.tsx`、`home-roles.tsx`和交易详情消费者。

Buy模式继续显示当前PetShop/TankShop QUERY确认的商品名称、说明、Pet生命值、商品价格和Tank默认纹理。拥有说明不改变拥有列表、出售资格、余额、购买/出售事务、属性、技能或角色选用。说明区保持原`edtPetDesc`/`edtDescription`坐标、统一比例缩放、附件字体和滚动样式，仅在确有说明时设置region名称并允许键盘焦点滚动。

说明切换只随当前确认拥有记录同步计算，没有新增描述请求或迟到响应。

静态走查范围为`f4b0d03..231c79c`，覆盖两页实现、确认字段、原说明目录及相关文档。确认记录取值、Buy数据、预览清理、选择/刷新、pending事务和原坐标/缩放/字体/焦点链正确，未发现P1/P2问题。

## 未完成范围

本批没有运行测试、浏览器、构建、类型检查或导出。新拥有说明、拥有Pet预览和商城未售定义的切换尚未做实际页面验收；UI-56、UI-57和完整商城1:1父项保持未完成。
