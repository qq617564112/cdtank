# 交易候选名单运行合同

Trade候选名单仍读取 `state.account` 的已确认 `owned`、`inventory` 与现有分类结果，行identity只使用 `TradeRecordView.kind + instanceId`；宠物、战车和物品即使数字串相同也不会共用选中或draft状态。候选内容复用现已确认的 Home 行provider：战车读取拥有记录字段 `0x24`、`0x34` 与 `catalog.tankTypes`，宠物读取字段 `8` 与 `catalog.petTypes`，物品读取 `catalog.items` 的真实名称/图标和该inventory记录的 `ownedQuantity`，部件与帽子/标志继续使用 `HomeEquipmentCommonRowContent` 的已确认类别文本。字段缺失时留空，不从当前选中角色补值。

三个Trade名单继续使用原 `trade.xml` 控件的 `192×217` 源边界和各自 `SelectionImage`。候选按钮在本页CSS作用域中恢复 Home 行的 `161×56` 布局和对应行data属性，不修改 Home/shared CSS；原offer十二格仍由原`trade.xml`消费。选中背景跟随本地draft membership，原黄色边框不再承担选择状态。

click、Enter与Space继续toggle当前候选。ArrowUp、ArrowDown、Home、End只移动焦点并调用`scrollIntoView({block: 'nearest'})`，跳过真实disabled候选，不自动添加、提交SHOW或修改draft/quantity；这些keyDown与keyUp不会继续冒泡到其它action。详情按钮与部分堆叠物品的数量输入位于候选源行之后的独立Web操作行，不嵌套button、不遮挡源行，并保持Tab与键盘可用。

资源失败后的“重试交易资源”只重跑本页资源effect，继续使用现有`loadSourceUi`和`loadCombatCatalog`成功缓存及失败释放promise，不修改session、revision、draft、amount、party，也不调用QUERY、SHOW或CONFIRM。已成功加载的UI与catalog保持可用；失败错误在重试期间保持可读，重试按钮在加载中禁用，Close仍按原pending合同可用。`aria-busy`只在必要资源实际加载或操作pending时生效，失败后不会永久busy；重试成功聚焦本页源Close，正常初次加载不额外抢焦点。

对方金钱、创意点和技能点继续由shared `SourceStaticText`及用户当前字体显示白字无shadow；仅 `txtOtherMoney`、`txtOtherOriginality`、`txtOtherTech` 在自己原有`65×13`、右对齐坐标内增加本页scoped深色backing，不改图片几何，也不声明原最终颜色。普通信息展示、金额输入和部分数量编辑保持原Web生命期；详情由既有`TradeSourceDetail`继续消费同一确认记录。

本方 OwnedTank/OwnedPet 候选行已接原状态语义的 N/B：N 来自同一确认 `TradeAccount.profile.bytes`，小端战车 `+0xa8`、宠物 `+0xa4`，与候选 `kind + instanceId` 相等即为当前实例；B 来自本地 `draft.records.some(kind+instance)` 成员关系，`draft.records` 仍是唯一 B 来源，不从 `aria-selected`/候选选中背景/`party.confirmed`/peer 记录/Home 当前候选推断。同一候选按原状态优先级先判 N，命中 N 不再画 B，仅 `!current` 且命中 draft 时显示 B。两个 glyph 都是原 `SmallHT`：N 复用 `n.tga`（`ui/regions/11/10.png`）、B 复用共享 `b.tga`（`ui/regions/11/8.png`），point `5,8`、14×14 随父 scale，ARIA「本方交易草稿」与 Trade attr 只落在 Trade 作用域。

非角色 `item` 候选使用同一确认 profile 与本地 draft：E 来自当前确认 `profile.bytes`，cat `5` 匹配五个部件槽 `+0x148 + 4*slot`（`0..4`），cat `3` 匹配帽子/气球装饰 `+0x118`，cat `4` 匹配标志 `+0x13c`；cat `7` 不画新 E。B 仍是 `draft.records.some(kind+instance)`，同一行按原顺序先判 E，`!current && offered` 才画 B。没有 profile、bytes 短于所用字段或字段不命中时不画对应标识；不使用 `inventory.records[].state===2` 的全账号安装标记，也不依据 selected、`bindingName`、`party.confirmed`、peer 或额外 `ownedQuantity` gate。原物品名单 `ownedQuantity>0` 过滤与装备无数量 gate 保持，不新增 Web E gate。

当前确认数据是每次 render 直接读取 `state.account.profile?.bytes` 的纯投影；没有专用 RoleProfile QUERY effect、currentRoles、query props、account generation effect 或 caller query callback。无 profile 或短 bytes 时对应 glyph 不画，不从其它页面、selected 或 draft 猜值。不新增 poll、缓存、query 写参数、API、schema、费用、取得或 UI gate。B/N/E 随既有 Trade 确认快照与本地 draft 生命周期：仅 session id 或本方确认 offer 变化时按既有 `own.offer` 重置本地 draft，revision 只用于请求一致性；对方 SHOW/UNSHOW 或单方 CONFIRM 增 revision 但本方 offer 不变时保留 draft，UNSHOW 与对方撤回保留本地 draft，CANCEL/COMPLETED/关闭/断线会话结束后不延续状态。既有 Trade 事务、双方 12 格、peer、详情、键盘、焦点、资源 retry 与 pending gate 保持。

## 限定

本次变更已在生产Trade页面接入。本轮状态接线未做页面、双端实际交互与HD布局、关闭重开实测；原交易服务端授权与逐148控件仍待验。原 Trade 本方 OwnedTank/OwnedPet 行工厂与其状态来源已有限恢复，非角色 Item/Equip 的原工厂、状态与 kind 区间另有来源，但完整业务字段与整表恢复仍未确认；本页候选行是采用已确认 Home 行内容的 Web 呈现。
