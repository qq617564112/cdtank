# Home原拥有角色说明

对应M5-07、M5-08、UI-32、UI-34。战车、宠物和装备页的原介绍控件按当前确认的拥有记录选择完整原表说明，覆盖21战车和10宠物定义，包含商城未出售的定义。

`HomeRolesView`先从当前候选或当前选用实例匹配`OwnedRoles`，战车以字段0x24、宠物以字段8读取原定义ID；`HomeEquipmentView`从确认Equipment profile+a8取得战车实例，再匹配确认OwnedRoles equipment的0x1c实例字段，读取该记录0x24定义。没有确认记录或未知定义的说明保持空白。

三处页面共用`sourceTankDescription`/`sourcePetDescription`，原文字来源见`role-source-description-catalog.md`。不再为介绍请求仅包含可售定义的TankShop/PetShop QUERY。商城购买、出售资格、拥有记录名称/属性、选用、学习、装卸、迷彩和实际预览仍使用各自既有权威业务。

战车原`edtTankDesc`保持原位置、同viewport scale、附件字体和滚动样式，增加可用时键盘焦点与介绍region；宠物原`edtPetDesc`保持现键盘滚动。描述来源标记对应原TankInfo/PetInfo，切换候选时说明直接随确认记录变换，没有独立请求或迟到响应覆盖。

## 未完成范围

本批没有运行测试、浏览器、构建、类型检查或导出。旧正常角色页面证据保持其原范围，新完整说明目录的实际呈现与切换尚未验收。原控件setter、attachment/callback、全部拥有属性、成长、改装及页面1:1保持各父项未完成。
