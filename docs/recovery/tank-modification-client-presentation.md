# 战车改装客户端表现

本片接通 Home 战车详情的原两个改装入口与 `myhome_panzerpage_modify.xml` 的 24 控件弹窗。原 `myhome_panzerpage.xml` 中 `btnModifyFire` 为 action 1，使用 owned `+38` 资格和 `+44` 等级；`btnModifyPanzer` 为 action 2，使用 owned `+48` 资格和 `+54` 等级。两个按钮都保留 `tankeshengjiqu` 父级和原矩形，等级文本保留 `txtAttackLevel` / `txtPanzerLevel` 的 `94,5,112,21` 原坐标。资格为 0 时入口按 source flag 禁用，不在页面载入、选择或打开弹窗时补写。

`HomeTankUpgradeDialog` 消费原布局的全部 24 个控件：根 `all`、九切片 `kuang`、等级与当前值文本、下一等级上下限、成功/无效果/失败字面值与概率、两条费用底图和图标、`btnModifyTank` 与 `btnClose`。弹窗按 800x599 原几何定位，复用 `SourceStaticImage`、`SourceStaticText`、`SourceButton` 的用户字体与图片状态消费者。打开时按该布局引用的全部图片和按钮状态资源逐项准备；任一资源失败时保留原弹窗、显示可读错误，并提供同实例资源重试。资源未就绪时确认不可提交，重试只重新准备资源，不发送提交、不改变 requestId、不重挂查询或覆盖当前报价和草稿。关闭按钮和 Escape 保持返回实际 Home 入口，焦点在打开前元素仍可连接时恢复。

打开弹窗先发送只读 `TankUpgrade QUERY`，报价的等级、费用、字面成功率/失败率/无效果余量、当前属性与四项下一等级候选边界全部取服务端返回。确认按钮在报价不可执行时禁用并显示具名原因；资源读取失败时保留弹窗并提供同实例局部重试。提交使用当前 `instanceId` 与 action，每次新提交生成一个 `requestId`；网络失败后同一 `requestId` 原样重试，成功确认后才完成该 attempt，不产生第二次扣费。

确认响应中的 `owned` 和 `profile` 始终替换 Home 当前确认 state 与当前选中记录；`replayed:true` 时只把 `historicalConfirmation` 用于结果文字，不用历史 money 或属性覆盖当前 state。新确认的 `confirmation` 与当次提交 state 一致。客户端不自算收费、随机、等级或返回属性，也不签发 Ready 或构造房间快照；无房间和 `WAITING` 由服务端按合同处理，`LOADING`、`PLAYING`、`FINISHED` 保持拒绝。

## 来源与采用政策

直接来源覆盖 TankUp 表字段与费用比例、owned 等级和资格偏移、Home 两入口、24 控件父链/矩形/图片、原 3f94/3f95 请求确认字段以及现 owned 属性到战斗重算的消费者。原服务器结果采样、返回 attribute/bonus 生成公式、owned `+38/+48` 原始 producer 未取得；当前 Web 重建采用合同列明的 100 点结果域、Tank 表 Min/Max 增减和正常 `TankShop BUY` 写入 `+38=1/+48=1`。这些是采用规则，不声明原服务器逐值恢复。

现 `AccountConnection.tankUpgrade` 只做已认证 `TankUpgrade` 调用和 `isSucc` 错误传播，`Battle.tankUpgrade` 是该客户端方法的薄代理。共享协议、server 事务、receipt、房间 Ready 重绑与广播不属于本片。

## 未实测与边界

本片没有运行类型检查、构建、浏览器、双端、保存重启、HD 或 1:1 精度验收。真实账户无房间/WAITING 提交、LOADING/PLAYING/FINISHED 拒绝、同 requestId 网络重试、历史 replay 与 Ready 广播、升级后战斗属性重算仍需后续正式验收。现有旧 owned/导入记录的资格 0 不自动迁移；原完整 Home 93 控件父项、原服务器未知 producer 和 M6-03/UI-33 父项保持未完成。
