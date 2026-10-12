# 首辆付费战车购买、选用与持久恢复

原tankshop表的战车3「游骑兵」以购买模式2、2500金币建立首个付费战车入口。正式TankShop BUY原子扣款并新增拥有装备；我的家通过既有OwnedRoles与SelectRole选择新实例，正常创建房间、准备、移动、射击与退出。同数据库重启后原token恢复拥有记录、选择及余额。

本片仅开放战车3的MONEY购买。原表250软星币价格保留在目录，模式2不允许TOKENS成交。购买构造为明确重建的未改装装备状态，使用源表默认贴图及基础攻防；不将重建构造声明为原客户端完整购买构造恢复。

## 夹具与范围

两个实验账户初始各有源字段布局的pet1实例73及tank1实例74，无战车3，无道具库存。owner资金3000金币／1000软星币，peer资金2000金币／1000软星币；资金和既有角色为专用实验夹具。新战车仅由正式BUY创建，首次空闲实例为1。没有预置战车3、直接改购买结果、运行中位置或事件注入。

网络runner为`tests/tank-purchase-network.cts`，独立正式index3240与SQLite。网页runner为`tests/browser-tank-purchase.mjs`，正式index3241、Vite5401、Chromium9601；一张购买账户页完成出击，另一张隔离账户页仅验证普通余额不足。网页使用实际源商城Tank页、原btnBuy、我的家战车页和原出击按钮；战斗使用正常KeyW与Space输入。

## 购买与权威状态

| 项目 | 实测 |
| --- | --- |
| 源商品 | tank3游骑兵，2500金币，默认U30041／M30042／XY30013 |
| 原子成交 | MONEY3000→500，TOKENS1000不变；返回OwnedRoles装备实例1 |
| 装备标识 | 0x1c=1、0x24=3，与原tank1实例74独立 |
| 默认贴图 | 0x28=30041、0x2c=30042、0x30=30013 |
| 基础攻防 | 0x3c=122、0x40=78、0x4c=17、0x50=44；其余购买装备字段为0 |
| 幂等 | 同requestId重放返回同装备实例、replayed=true、余额仍500，不重复新增 |
| 拒绝 | 未认证、TOKENS、非出售tank2、短requestId、余额不足及PLAYING购买均拒绝；同requestId改TOKENS请求拒绝 |
| 账户隔离 | peer仍只有tank1、资金2000／1000；不能SelectRole owner实例1 |
| 普通选择 | BUY后profile+0xa8仍74；普通SelectRole后变1 |
| 实际同DB重启 | 原token恢复同装备字段、profile+0xa8=1、余额500／1000 |

购买新装备默认弹药字段0x58为0，普通出击沿既有弹药解析路径使用2001；本片不添加持久弹药库存。

## 普通入场与网页结果

网络正常创建mode4／map7房间、添加CPU、Ready进入PLAYING。owner为tank3且公开tankTextures与购买字段一致；普通PlayerInput移动约140.00世界单位，实际owner fire事件skill2001，随后正常Leave并进行持久恢复验证。

网页owner购买成功后切换Item页，余额显示500金币／1000软星币。Home初始确认选择仍为74，点新拥有实例1后预览tank3、4个可显示网格、ready状态，实际源预览已渲染20帧；普通出击保存后确认选择1。

| 网页验收项 | 实测 |
| --- | --- |
| 普通余额不足 | peer点击原购买按钮得到「金钱余额不足」，余额仍2000／1000 |
| 普通购买 | 「已购买游骑兵，拥有实例1，请在我的家选择。」；余额500／1000 |
| 共用商城余额 | 成交后返回Item页显示500／1000 |
| 我的家选用 | 实例1，tank3，默认贴图30041／30042／30013，确认选择1 |
| 普通一局 | 正常mode4／map7、CPU、Ready；KeyW移动约91.01世界单位 |
| 真人射击 | 收到owner P1真实fire skill2001；使用普通Space输入 |
| 实际模型绘制 | 购买玩家模型实际draw32；源网格材质使用003U_004、003M_004、003XY_001_A纹理 |
| 正常退出 | Leave成功，battle-status.world清空 |

渲染观察仅订阅既有模型网格的onAfterRender，并读取材质纹理引用，没有修改模型、相机或玩家姿态。已加载动作网格清单不等同同帧显示网格；实际绘制以draw32记录为证。

网络PASS为`recovery/output/tank-purchase-network-2026-10-04T12-20-26-645Z.json`及`.log`。网页PASS为`recovery/output/browser-tank-purchase-2026-10-04T12-21-16-128Z.json`及`.log`。

对应网页画面：

- `browser-tank-purchase-2026-10-04T12-21-16-128Z-purchased.png`：原Tank商城购买确认与余额。
- `browser-tank-purchase-2026-10-04T12-21-16-128Z-home-tank3.png`：新拥有游骑兵的我的家源模型预览及出击按钮。
- `browser-tank-purchase-2026-10-04T12-21-16-128Z-battle-tank3.png`：正常地图、购买战车、CPU交战与战斗HUD。

## 已知边界

本片重建付费交易和装备拥有构造，不包含升级、改装、出售或其它商品战车。源默认贴图及模型使用既有恢复消费者；本片不宣称普通2001射击的完整原FX链已恢复。网络承担真实同DB重启，网页承担普通购买至出击单局入口。

## 清理

所有专属index、Vite、Chromium和连接已停止，临时SQLite及浏览器目录已删除。3240、3241、5401、9601无监听进程，`/tmp/cdtank-tank-purchase-*`无残留。专用输出独立保存。
