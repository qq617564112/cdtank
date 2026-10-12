# 正价宠物目录与黄金母舰购买闭环

M6-06-PPAID将原表金钱价大于0的8个宠物作为正式MONEY商品，pet103「黄金母舰」以4000金币通过正常BUY创建完整拥有记录。玩家在Home选用后，原n1模型及本机／远端103头像实际显示，正常Ready生成750生命；真实CPU命中后双连接同tick确认707／750。普通Leave与同数据库真实重启后原token恢复拥有、资金与选用。

本片只新增pet103首次必要业务链，既有pet2购买、预览生命周期、头像状态与持久规则结果直接复用，不重验旧技能、全模式或两局。

## 商品与完整购买记录

`tests/pet-paid-network.cts`使用独立index3247和SQLite。owner初始5000金币／1000软星币、已有pet1实例73／tank1实例74，pet103不存在。余额不足peer为3000／1000，容量账户为5000／1000及10个明确pet1。启动账户资料为实验夹具，pet103只由正式BUY创建。

| 项目 | 实测 |
| --- | --- |
| 正价目录 | 2、3、4、5、102、103、104、105，共8项 |
| 黄金母舰 | pet103，MONEY4000，原表TOKENS400，MaxHP750 |
| 成交 | 资金5000→1000，TOKENS1000不变，新增base实例1 |
| 完整记录 | 31数值字段，+0=1、+8=103、+2c=750、+34=10、+3c=14 |
| 六技能 | 10811／10821／10831／10841／10851／10861 |
| 六等级 | 5／1／6／4／1／0；0级保留 |
| 其余字段 | 未确定购买／成长字段保持明确重建初值0 |
| 无自动选中 | BUY后profile+a4仍73，普通SelectRole写1 |

正价筛选来自原pet表金钱字段，不开放零价定义1／101的购买，也不将表代币价当作当前原入口允许币种。成功建档仍为明确重建未成长规则，保存的六技能不等同独立boundGear已绑定。

## 正式网络与恢复

查询目录、未认证、TOKENS、零价1／101、未知999、短requestId、余额不足、容量10与PLAYING购买拒绝均通过。容量拒绝后仍10条base、余额5000／1000。相同requestId重放返回同实例1／replayed=true、不再扣费；同requestId改成另一个正价pet104拒绝。peer不能选owner实例1，peer拥有和资金不变。

普通map7／mode4房间由两个真人账户与一个CPU进入。owner选用pet103后初始750／750，peerpet1仍600／600。普通PlayerInput移动、真实2001 fire及CPU自然hit通过。tick251两连接同owner完整player一致：petId103、HP707、maxHp750，实际CPU伤害43。双方正常Leave后停止并重新启动同DB服务器，以原token恢复完整base1、profile+a4=1、资金1000／1000。

网络有效PASS：`recovery/output/pet-paid-network-2026-10-04T13-48-26-648Z.json`及`.log`。

## 正式网页与源资源

`tests/browser-pet-paid.mjs`使用index3248、正式Vite5408与Chromium9608，两张隔离普通页面。owner在原Pet商品列表通过正常键鼠选择103、点击原btnBuy；「已购买黄金母舰，拥有实例1」与资金1000／1000确认后，返回Item页也显示更新资金。Home初始仍选pet1，普通点击新拥有实例1及原出击按钮保存选用。

Home源n1实际模型为`Data/Pet/103/n1.glb`，运行网格Box121/0、1296顶点，original-mv3-material，源嵌入纹理`m115.tga (Base Color)`ready=true，实际draw3。只读EngineStore／onAfterRender观察既有模型，不修改模型、镜头、姿态或灯光。

| 玩家显示 | 正式实际资源 | Decode／可见 |
| --- | --- | --- |
| owner本机pet103 | ui/regions/47/1.png，对应103_normal | 102×85，可见 |
| peer观察ownerpet103 | ui/regions/77/31.png，对应103_normal1 | 65×53，可见 |

两页正常CreateRoom／Join／CPU／Ready进入map7。owner普通KeyW移动约123.51世界单位、Space产生真实本人2001 fire；CPU自然命中后两页同tick251确认完整ownerpet103状态707／750，源生命控件aria-valuenow707、aria-valuemax750、title707/750。两页普通Leave成功，world清空。

网页有效PASS：`recovery/output/browser-pet-paid-2026-10-04T13-49-14-576Z.json`及`.log`。同记录`-purchased.png`、`-home-pet103.png`、`-local-pet103.png`、`-remote-pet103.png`、`-battle-pet103-health.png`保存正常源界面与实际资源画面。

## 已知边界

商品建档／资金权威属于重建事务，未知成长字段初值及技能保存遵循已声明规则。模型与纹理来自原资源，画面偏暗，原镜头、灯光及Windows像素一致仍未恢复。原普通2001声音未改直接复用，本片不扩FX链验证。

## 清理

专属index、Vite、Chromium和连接均停止，临时数据库及浏览器目录删除。3247、3248、5408、9608无监听进程，`/tmp/cdtank-pet-paid-*`无残留。有效PASS与原始独立记录保留，完成后停止运行。
