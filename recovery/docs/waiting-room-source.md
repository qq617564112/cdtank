# 原等待房间名单来源

`recovery/.venv/bin/python recovery/evidence/rooms/waiting-room-source.py`：PASS。执行原客户端十二个名单位置读取、252次战车图选择和三种角色状态的准备显示谓词；结果为`recovery/output/waiting-room-source.json`。

`recovery/output/verified/assets/data/Data/ui/layouts/room_main.xml`定义十二个`PlayerPanelN`。0–5在左列，6–11在右列；左列横坐标12–191，右列414–593，六行纵坐标98、140、182、223、265、307。XML每个控件的原矩形和图引用都保留在结果的`controls`中。网页已发布资源位于`recovery/output/web-assets/ui.json`。

## 名单位置

原面板刷新`0x50ded9`每次循环`i=0..5`：`0x50df51`读取房间记录`+0x1c+4*i`的角色ID放左槽`i`；`0x50e3cd`读取`+0x34+4*i`放右槽`i+6`。两者调用`0x48a226`解析角色。当前消费者没有按角色ID、名字或进入时间排序，直接使用两组六位置数组。右列缓存键在`0x50e686`明确加6。

面板初始化将`PlayerPanelN`绑定控制器`+0x9c+4*N`、`txtPlayerNameN`绑定`+0x15c+4*N`、`picReadyN`绑定`+0x1bc+4*N`。名字由角色虚方法`+0x0c(0)`取得并通过`0x412649`交给对应名字控件。

XML猫队选择位于左列下方，狗队选择位于右列下方。初始化`0x50a209`将`btnCatTeam`绑定`+0x50`，`0x50a240`将`btnDogTeam`绑定`+0x54`；原猫队回调`0x50c191`向`0x426f0b`传1，狗队回调`0x50c215`传2。网页team0/1到猫/狗的映射及权威名单内的排列仍为重建契约，不能据此声称原房间数组生产过程已恢复。

## 准备图和按钮

十二个`picReadyN`都引用`set:lobby_ditu20 image:data\\ui\\lobby\\lobby_ditu2\\fangjiandegou.tga`。左侧准备图相对名单条位置为(112,0)–(162,41)，右侧为(18,0)–(68,41)。

刷新优先读取已存在的槽缓存准备布尔值；没有缓存时，`0x50e23a`及右侧`0x50e6c0`调用角色状态`0x43293d`，仅状态1显示。`0x50e304`与`0x50e786`将该布尔值传给对应准备图的可见性操作。无角色的槽隐藏准备图。

已有完整确认链证据`recovery/output/room-start-rules-sol-native.json`执行`0x4259ae -> 0x50e877`：确认更新角色状态与槽缓存，然后刷新名单。仅本机角色确认切换`btnReady(+0x90)`和`btnCancel(+0x94)`的可见性：未准备显示Ready，准备显示Cancel。准备确认禁用对侧换队；取消确认在原模式不是3或4时恢复对侧换队。控制器`+0x40=0`选择狗队按钮为对侧，`=1`选择猫队按钮。原Ready/Cancel请求本身不确认状态；网页应使用权威确认驱动显示。

## 动态战车图

`picPlayerTankN`初始化绑定控制器`+0xfc+4*N`。左侧`0x50e14d`、右侧`0x50e5cc`读取角色`+0x2a8`；非空时读取该记录`+0x0c`，格式化`data\\ui\\tanke\\%.3d.tga`，以`imageset=tanke0`写到对应槽。已发布`tanke0`的21个原图均经过两列十二位置的原指令选择验证，结果列出每个定义ID和`ui/regions/...png`资产。

`picPlayerIconN`是另一控件，绑定`+0xcc+4*N`；它读取角色`+0x2a4`记录`+0x0c`，生成`gy0/data\\ui\\gy\\maogou_%d.tga`。两类图不可互换。

## 限制

未恢复房间两组角色ID数组的上游构造、原服务器排列及其数字队伍编码。重建名单按权威team0/1分入左右列、保持快照内各队顺序，应标为重建排列。原动态战车图消费者已确定，但重建网络玩家到原角色`+0x2a8`定义ID的来源未确定；Web当前采用已恢复catalog/player.tankId作为图整数的适配，须明确标为重建接线；本消费者证据不能证明该适配就是原角色定义上游。头像、称号和完整原房间协议不属于本证据范围。
