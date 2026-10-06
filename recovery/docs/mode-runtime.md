# 原模式身份与信息布局恢复

原EXE的HUD模式字段对象+0x80取值0–4，Web内容与房间使用1–5。原加载/选择链确认：

| Web模式 | 原编号 | 名称 | 原布局 | 加载路径常量 | 选择分支 |
| --- | --- | --- | --- | --- | --- |
| 1 | 0 | 团队 | game_main_info_team.xml | 0x5cfec0 / 0x4c9dd5 | 0x4d25a7 / +0x63c |
| 2 | 1 | 占领 | game_main_info_conquer.xml | 0x5cfd84 / 0x4ca055 | 0x4d298b / +0x65c |
| 3 | 2 | 擒王 | game_main_info_vip.xml | 0x5cfe24 / 0x4c9f15 | 0x4d2b27 / +0x64c |
| 4 | 3 | 混战 | game_main_info_melee.xml | 0x5cff38 / 0x4c9ccf | 0x4d2cdf / +0x630 |
| 5 | 4 | 破坏 | game_main_info_destroy.xml | 0x5cfcd8 / 0x4ca195 | 0x4d2db4 / +0x66c |

五布局各自的SheetWindow在(642,0)，宽115；团队/占领/擒王高103、混战/破坏高77。计时器为各自父节点内的原矩形，不能统一复用团队位置。每种布局建立独立控件映射，避免重复SheetWindow/txtRemainTime名字覆盖。模式切换只显示一份信息布局，退出/重入随快照重选；主HUD、玩家列表和头像仍共享。

TSRPC RoomSnapshot新增服务端mode，来自room.mode，生成serviceProto同步契约。HUD根据每帧权威模式选择对应原计时布局，采用原BigHT图块与800×600统一缩放。原运行更新0x4cab7b读取剩余时间、trunc后除60，0x4cab98使用0x5d0f6c的`%d:%.2d`，Web格式一致。原初始化0x4d257a另一格式有空格，运行更新覆盖后无空格。

五模式倒计时警示已接入：0x4cab80转换为整数，0x4cabf4、0x4cac6b、0x4cace5、0x4cad5c、0x4cadd0分别判断严格小于30秒；除2余数为1使用FFFF0000，否则FFFFFFFF，0x4cadfd设置四角颜色。Web先Math.trunc，再格式化与判断；SVG sRGB矩阵保留原BigHT图块的红通道和alpha、将绿蓝乘0，模拟CEGUI颜色乘法。每个HUD使用唯一filter ID。原>=30分支跳过颜色写入，Web保留该行为；退出时清理五份计时器颜色，避免重入沿用旧警示。各模式txtSelfInfo/txtEnemyInfo/txtInfo语义、目标计数、VIP生命、占领对象状态、破坏对象及结算均需原数据链进一步确认；不将模式身份/布局与倒计时通过当作玩法完成证据。

团队计数目前确认的数据链：初始化0x4d05dc调用0x43535a（返回游戏对象+0x30），0x4d0601–0x4d060d将结果对象+0xc/+0x10复制到HUD+0x38/+0x3c。更新函数是0x4cb6cb，0x4cb756–0x4cb76a复制输入+0xc/+0x10；0x4d40e6注册其回调，经0x4915d6存入所属对象+0x54。本队方位HUD+0x932决定txtSelfInfo/EnemyInfo的正反映射。0x4cb6ab仅重置HUD+0x78并操作+0xc8控件，不是计数更新函数；不能沿其0x4d42a8注册链推断团队规则。两计数是否为剩余生命、初始TankNum及耗尽结算仍待上游通知结构和规则证据，暂不绑定现有累计teamScores。 M5-05-T现已按完整4cb6cb消费者恢复%d和本队交换显示，Web接现有权威teamLives为明确重建适配；没有将Info生产规则或原剩余生命语义标为恢复。详见team-info-source.md和team-info-runtime.md。

服务端现有mode分支与终局判断是原型：团队击杀累计、占领仅按存活人数、擒王简单VIP存活、混战/破坏按得分排序；尚未证明与原版一致。m001–m005的26记录/25地图配置来自原表，但服务器没有实现完整目标/对象、资源掉落、奖励、原友伤/重生与原账号持久化。原PlayerMin条件也暂由两人技术演示替代。R3仍待逐规则恢复。

验证：网络集成检查模式1/2的独立连接快照归属，并切换3/4/5验证mode与Join/ListRooms一致；浏览器显式状态在1080p、1440p、4K、DPR2下核对五模式唯一可见布局、计时器实际矩形、字体图块解码及退出重入。真实联机战斗另外检查新协议可持续击毁/重生/退出。

本轮test:network、test:hud:browser、test:combat:browser和build通过。五模式20高清组合保存在browser-hud.json的modes；真实战斗新协议可用，原模式规则依然待恢复。

倒计时本轮验证：test:hud:browser五模式20高清组合通过，检查31/30/29.99/29/28/1/0边界及颜色保持/重入清理；build通过。实际29秒相同图块红/白截图像素对照：红通道无差异、267像素绿蓝降低、1,127背景像素相同，见timer-pixels.json。该检查不代表完整原模式玩法或高清对局性能通过。

## 战场公告对象定义

`recovery/export_bulletin_schema.py`直接读取原PE与Capstone指令，导出`recovery/output/bulletin-schema.json`，包含样本SHA256、每个注册/绑定地址与整段原指令字节。执行：`recovery/.venv/bin/python recovery/export_bulletin_schema.py`。类名OdlBattlefieldBulletin在0x522060注册，0x522029分配0x4c字节；字段在0x521f0f–0x52201d注册：

| 原属性 | 内存偏移 | 注册类型码 | 元素数 | 名称引用/绑定 |
| --- | --- | --- | --- | --- |
| m_iCatsInfo | +0xc | 5 | 1 | 0x521f28 / 0x521f40 |
| m_iDogsInfo | +0x10 | 5 | 1 | 0x521f51 / 0x521f69 |
| m_iDogTankNumb | +0x14 | 5 | 1 | 0x521f7a / 0x521f92 |
| m_iCatTankNumb | +0x18 | 5 | 1 | 0x521fa3 / 0x521fbb |
| m_iCatPlayer | +0x1c | 14 | 6 | 0x521fce / 0x521fe6 |
| m_iDogPlayer | +0x34 | 14 | 6 | 0x521ff9 / 0x522011 |

两Info字段与TankNumb是独立属性，不能因gamestring146“每方可以被击毁的坦克数量”就将HUD计数等同剩余生命。0x436dbd通知记录Cats/Dogs各六ID及CatsInfo/DogsInfo，日志原常量0x5c4a18；0x4375a0–0x4375fe以OdlBattlefieldBulletin类名分别注册新增/改变回调0x436d40/0x436dbd。0x436307在原模式3/4下还从本机角色属性0xa/0x15更新CatsInfo，这说明字段具有模式相关用途，角色属性定义仍需追踪。上述为对象内存偏移；网络包偏移、动态类ID与注册类型码的精确线格式未证明。

原队伍玩家栏在0x4d0620–0x4d0669查找本机ID，交换本队数组第0项与本机所在项，而非把本机插到前面后整体顺移。Web已恢复该交换行为，保留其余同队顺序；猫/狗本机都置于本队左栏首槽。权威玩家数组仍由新服务端房间顺序产生，原公告空槽/成员更新与超六人策略尚未恢复，不能称原公告排序已全量复刻。

计数getter进一步定位：0x422b64在属性0xa下返回角色+0x28，在0x15下返回+0x314。+0x28由已确认击毁者回调路径0x42912e–0x429136对本机击毁者递增；+0x314在0x424807的场景对象消息处理递增，但其对象类型/毁坏触发条件需继续确认。0x436307根据原模式3/4分别取0xa/0x15覆盖公告CatsInfo，0x4cbad8/0x4cbb1e显示CatsInfo+DogsInfo；原初始化0x4d2d32/0x4d2e07只显示CatsInfo。因此不能将混战原txtInfo简单绑定score或全场击杀总和，也不能把破坏字段等同当前原型得分。第二个加数的在线生产者、初始公告与结算规则仍未恢复，本轮没有猜测这些计数。

战场音乐的模式表→MusicString→原MP3调用链已恢复，详见audio-runtime.md；音频接入不代表模式目标/结算已完成。

## 可玩主线后续状态（2026-10-01）

本文件前述无目标/简单终局描述记录的是原型旧状态。最新服务端已具备五模式重建目标、Ready准备、统一结算与全员再战，详情见`playable-match.md`。新版占领按圈内独占累计、擒王指定王、混战按独立playerId、破坏按可射击目标；这些应用规则仍未取得原版证据，本文件的原公告字段与未明语义继续保持。新次数/占领值只在重建目标面板显示，不注入原计数控件。
