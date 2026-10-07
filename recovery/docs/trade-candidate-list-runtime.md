# 交易候选名单运行合同

Trade候选名单仍读取 `state.account` 的已确认 `owned`、`inventory` 与现有分类结果，行identity只使用 `TradeRecordView.kind + instanceId`；宠物、战车和物品即使数字串相同也不会共用选中或draft状态。候选内容复用现已确认的 Home 行provider：战车读取拥有记录字段 `0x24`、`0x34` 与 `catalog.tankTypes`，宠物读取字段 `8` 与 `catalog.petTypes`，物品读取 `catalog.items` 的真实名称/图标和该inventory记录的 `ownedQuantity`，部件与帽子/标志继续使用 `HomeEquipmentCommonRowContent` 的已确认类别文本。字段缺失时留空，不从当前选中角色补值。

三个Trade名单继续使用原 `trade.xml` 控件的 `192×217` 源边界和各自 `SelectionImage`。候选按钮在本页CSS作用域中恢复 Home 行的 `161×56` 布局和对应行data属性，不修改 Home/shared CSS；原offer十二格仍由原`trade.xml`消费。选中背景跟随本地draft membership，原黄色边框不再承担选择状态。

click、Enter与Space继续toggle当前候选。ArrowUp、ArrowDown、Home、End只移动焦点并调用`scrollIntoView({block: 'nearest'})`，跳过真实disabled候选，不自动添加、提交SHOW或修改draft/quantity；这些keyDown与keyUp不会继续冒泡到其它action。详情按钮与部分堆叠物品的数量输入位于候选源行之后的独立Web操作行，不嵌套button、不遮挡源行，并保持Tab与键盘可用。

资源失败后的“重试交易资源”只重跑本页资源effect，继续使用现有`loadSourceUi`和`loadCombatCatalog`成功缓存及失败释放promise，不修改session、revision、draft、amount、party，也不调用QUERY、SHOW或CONFIRM。已成功加载的UI与catalog保持可用；失败错误在重试期间保持可读，重试按钮在加载中禁用，Close仍按原pending合同可用。`aria-busy`只在必要资源实际加载或操作pending时生效，失败后不会永久busy；重试成功聚焦本页源Close，正常初次加载不额外抢焦点。

对方金钱、创意点和技能点继续由shared `SourceStaticText`及用户当前字体显示白字无shadow；仅 `txtOtherMoney`、`txtOtherOriginality`、`txtOtherTech` 在自己原有`65×13`、右对齐坐标内增加本页scoped深色backing，不改图片几何，也不声明原最终颜色。普通信息展示、金额输入和部分数量编辑保持原Web生命期；详情由既有`TradeSourceDetail`继续消费同一确认记录。

## 限定

本次只覆盖新Trade页面及两处名单本地资源重试，双端实际交互与HD布局尚未实测。原trade listfactory的完整恢复仍未确认；本页候选行是采用已确认Home行内容的Web呈现。
