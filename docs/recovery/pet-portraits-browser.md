# 双页宠物头像来源与真实表现

普通Home选择、双页头像和生命同步、三分辨率源布局、Leave清理与切回pet1重入全部闭合。正式PlayerSnapshot携带选中拥有base+8的pet定义，战斗HUD以petId取原头像资源。同tank1的pet2与pet1在本机和远端分别显示各自原图；真实普通射击触发pet2攻击图，CPU自然伤害触发受伤图，两连接同tick确认pet2与生命状态一致。

本片对应M5-04-PET。原直接来源见`pet-portrait-source.md`，编号为PetTable定义ID。本机pet2正常／攻击／受伤来源为`data\ui\2\2_normal.tga`、`2_attack.tga`、`2_wound.tga`；远端使用`data\ui\zhandou\2_normal1.tga`。资源导出目录表达与跨端petId字段是重建运输，不将此字段称为原网络协议字段。

`tests/browser-pet-portraits.mjs`使用index3245、正式Vite5405、Chromium9605和两张隔离账户页面。专用夹具各明确拥有pet1实例73、pet2实例75及同tank1实例74，pet1基础生命600、pet2基础生命700。普通Home选择确认owner75／peer73，经CreateRoom／Join／CPU／Ready进入正常map7。没有购买、数据库重启、原生复验、相机或位置改写，也没有事件或伤害注入。

## 实际头像与正常事件

有效核心记录为`recovery/output/browser-pet-portraits-2026-10-04T13-04-51-712Z.json`及`.log`。该记录整体状态为FAIL，已完成的头像与权威生命证据如下。

| 场景 | 实测资源 | 实际解码尺寸 |
| --- | --- | --- |
| owner本机pet2正常 | ui/regions/51/1.png | 102×85 |
| peer观察同owner远端pet2 | ui/regions/77/25.png | 65×53 |
| owner观察远端pet1 | ui/regions/77/23.png | 65×53 |
| peer本机pet1正常 | ui/regions/50/1.png | 102×85 |
| owner普通Space攻击pet2 | ui/regions/51/0.png | 102×85 |

每个头像均通过实际backgroundImage、图片decode、非零可见矩形与正常整页截图核对。两页角色tankId均1，ownerpetId2、peerpetId1；CPU没有petId且原头像控件保持隐藏，不伪造宠物。

同记录`-owner-pet2-normal.png`、`-peer-remote-pet2.png`与`-owner-pet2-attack.png`保存正常整页画面。普通Space产生owner真实fire，攻击短窗口显示pet2原attack图。CPU真实命中后只读MutationObserver记录wound和`ui/regions/51/2.png`；该受伤观察是实际DOM状态，不作单独受伤截图的声明。

tick244两连接收到相同owner完整player，petId2、HP657／maxHp700。初始两页owner700、peer600；真实普通战斗事件与公开快照共同证明宠物定义和生命同步。

## 源布局、离房与宠物切换

限定后续记录`browser-pet-portraits-layout-lifecycle-2026-10-04T13-09-09-391Z.json`完成三分辨率源矩形与整页画面，复用上述核心头像与战斗记录。800／1920／3840宽度对应scale1／1.8／3.6；本机矩形基准(0,81)、102×85，远端基准(0,159)、65×53。三次测量按源布局缩放一致，`-portraits-800.png`、`-portraits-1920.png`、`-portraits-3840.png`保存实际原图显示。只比较可见且有petId的玩家控件，CPU空头像不计入实际可见图的矩形验收。

正式HUD清理后，`browser-pet-portraits-lifecycle-only-2026-10-04T13-13-34-434Z.json`记录两页普通Leave：world清空、HUD隐藏，头像roleimg与data-player-id控件数均0。owner随后普通Home SelectRole选择实例73，在新房R7以同tank1生成petId1、HP600／maxHp600，正常pet1资源`ui/regions/50/1.png`实际decode102×85且可见；`-reentered-pet1.png`保存该入口。该记录整体FAIL只表示最终等待房退出未完成，不将其原始状态改写为PASS。

最终等待房普通退出由限定单页PASS `browser-pet-portraits-waiting-reentry-exit-2026-10-04T13-16-56-076Z.json`及`.log`补齐：普通Home SelectRole pet实例73成功，同tank1入房petId1／HP600，本机1normal实际decode102×85且可见，点击原等待房源btnClose（data-waiting-close）发送正常Leave并成功确认，world清空、HUD隐藏、头像和玩家引用均0。该单页范围不重跑双页战斗、表情窗口或三分辨率。

以上核心头像、三分辨率、双页清理与最终等待房PASS共同完成本片范围；各原始整体FAIL状态保留，以其中具体已通过字段和画面引用有效范围。

本片不宣称原Windows像素一致，不包含宠物模型预览、五模式或原完整射击FX链。实际原图显示与有限表情窗口以本记录范围为准。

## 清理

本片已启动index、Vite、Chromium和连接全部停止，专用临时数据库及浏览器目录已删除。3245、5405、9605无监听进程，`/tmp/cdtank-pet-portraits-*`无残留。独立原始记录与截图保存。
