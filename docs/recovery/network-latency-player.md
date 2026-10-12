# 固定延迟下普通操作与渲染收敛

两正式React账户通过真实WebSocket有序转发，两个方向各约100ms延迟。合法map7/mode4普通建房、加入和Ready后，host正常W移动、D车体转向、ArrowLeft炮塔转向，释放全部按键。服务端与客户端状态、时基和活跃位置不被替换。1280×720窗口采用hardwareScaling4，验收读取实际TankView坐标及动作。

`network-latency-player-accepted.json`接受实际raw `browser-network-latency-2026-10-04T19-35-58-070Z.json`：普通位移217.502单位，两端95共同权威tick玩家状态完全一致。停止后位置与车体误差均0，炮塔误差分别0.000032821和0.000064058弧度，动作回01。原始记录各最后8个不同PLAYING tick的位置、车体与炮塔值保持一致；正常guest/host按当时phase源控件Leave，两端world清空、view0，专属3389/3390/5449/9649服务和临时目录清理。

输入方向256帧延迟范围99.131–102.882ms，中位100.097ms；返回方向539帧（包含API与快照）范围99.090–106.898ms，中位100.182ms。预房native tank1/pet1拥有和空库存为显式夹具，不代表本次购买角色。真正输入由正式BattleInput发出，客户端呈现消费服务端RoomSnapshot。现有插值代码在该范围内正确，无需修改生产。

统一Web工程验证network-latency-pet-directory-ammo08-web-build.log类型与发行通过，包含本批稳定的宠物目录可读适配及2005/2008/2010消费者。

命令：`node --import tsx tests/browser-network-latency.mjs`。命中权威沿已有普通射击证据，本片不新增延迟命中结论。

## 未完成范围

原预测/插值算法、丢包/抖动/掉线重连、高清流畅及全部地图状态不在此次证据内，M7-05父项保持开放。原始代理启动失败保存在startup-failure.json，binary-proxy前的连接失败raw保留；协议二进制内容正确转发后才取得本次实际对局证据。
