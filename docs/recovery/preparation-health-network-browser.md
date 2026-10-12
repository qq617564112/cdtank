# 装备准备阶段生命同步验收

真实网络与两个正式网页验收通过。网络覆盖拥有装备账户入房、WAITING 装卸与取消准备、正常开局、战斗受伤后的背包查询、自然结算、同房再战和退出。拥有坦克从入房起为204/204，权威生命、属性 record 和 role+0x54/+0x58 在实际服务器观察点一致。

## 真实网络

`tests/preparation-health-network.cts` 使用实际 index 服务器3216、临时 SQLite、三个正常鉴权客户端。复用 `browser-home-equipment.mjs` 已有 fixture：`role-owned-pair-native.json rows[0]`，拥有宠物71、坦克实例72/表2、容量3及物品实例81–86。账户通过正常 Equipment 请求装备实例83/表14001槽1，再正常 CreateRoom(mode4/map7) 和 Join；不重复保存/重启基线。

| 验收项 | 实测 |
| --- | --- |
| 拥有玩家 WAITING | tank2，hp204/maxHp204；请求 tank1 时账户已选拥有 tank2 正常生效 |
| 装卸/准备资格 | Ready 后普通 Equipment UNEQUIP 清除准备；重新装备仍保持204/204 |
| 无完整 source 来客 | tank1 fallback，hp300/maxHp300 |
| 正常首局 | Autopilot/Ready，PLAYING 首份快照拥有玩家204/204 |
| 受伤背包查询 | 自然受伤到149/204后正常 Inventory QUERY；查询后仍149/204 |
| 参战装备冻结 | PLAYING 和 FINISHED 的 UNEQUIP 均 EQUIPMENT_REJECTED |
| FINISHED 新来客 | 已装备拥有 tank2 的新账户正常 Join，204/204，随后正常 Leave |
| 同房再战 | 两票普通 Rematch，round2 开局恢复204/204 |
| 两轮终局 | 合法20秒服务器 deadline，自然 TIME_LIMIT；两轮97 fire、83 hit、11 destroy、10 respawn |
| 内部同步 | 24个实际服务器 API 状态观察点，hp=属性record.hp=role+0x54；最大生命=role+0x58，0≤hp≤maxHp |

只读 observer 包装 World.snapshot，调用原方法后读取实际 room players 并记录权威/role 值，不写入状态、不改变返回内容。网络快照和所有事件保存在 `recovery/output/preparation-health-network.json`，原始服务器观察日志为同名前缀 `.log`。

## 正式双网页

`tests/browser-preparation-health.mjs` 使用实际 index3217、正式 Vite5377和独立 Chromium9577。复用同一拥有角色 fixture，两张隔离1920×1080页面通过正常名称保存、大厅“我的家”、可见战车部件按钮、物品83与槽1、正常关闭装备页、建房mode4/map7、房间卡加入、CPU添加、Autopilot、Ready、Rematch及Leave操作。装备确认由真实 Equipment API返回，不点击隐藏控件。

| 验收项 | 实测 |
| --- | --- |
| 装备入房 | 玩家已选拥有tank2、物品83槽1；WAITING204/204 |
| 正常首局 | PLAYING204/204；四辆坦克实际渲染 |
| 自然首轮结束 | 合法20秒 TIME_LIMIT，拥有玩家自然受伤后75/204 |
| 正常再战 | 同房round2正常开局204/204；第二轮自然TIME_LIMIT |
| 快照生命范围 | 两页全部快照均0≤hp≤maxHp |
| 双页战斗事件 | 231个fire/hit/destroy/respawn/finish完全一致：114fire、92hit、13destroy、10respawn、2finish |
| 正常退出 | 双页第二轮结算后正常Leave返回大厅 |

完整业务状态和解码网络保存在 `recovery/output/browser-preparation-health.json`，服务器日志为`.log`；同名前缀的`-equipped.png`、`-waiting.png`、`-playing.png`、`-finished.png`、`-round2.png`记录实际页面。只读实例观察用于等资源完成后点击Ready；降低Babylon raster resolution，保留源界面矩形、相机和输入。正式UI阵容为两个人类tank2/tank1及两个默认CPU1，与网络CPU1/105阵容分别记录。

## 已知边界

WAITING 装卸与取消 Ready 通过正常网络 API 验证。正式 WAITING 页面没有可见的装备入口，因此不把隐藏 DOM 点击作为网页卸装证据。Inventory QUERY 是现有只读请求，不会重新绑定账户库存；战斗中的直接 bindBattleInventory 刷新不治疗由独立规则验收覆盖，不在网络查询结果中扩大声明。

WAITING 满生命策略属于重建准备规则，未证明原客户端/服务器在装备更换时的历史治疗策略。本片仅 mode4/map7、拥有 tank2 配置与正常缺 source fallback；不重复装备保存重启，也不推定全部模式或全部装备覆盖。自然 CPU 终局使用已有合法20秒 deadline，不注入伤害、位置、生命值、事件或胜负。

## 清理

正常断开网络客户端、关闭实际服务器、Vite及Chromium、删除临时SQLite和浏览器目录。交付时3216、3217、5377、9577均无监听进程。
