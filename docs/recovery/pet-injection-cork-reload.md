# 解禁保持普通末发装填

M2-02/FUNC10/FUNC05/I03-B首次必要交互，`tests/pet-injection-cork-reload-network.cts` 与 `pet-injection-cork-reload-player-evidence.json` 引用raw `pet-injection-cork-reload-network-2026-10-05T03-58-06-985Z.json`。复用真实BUY3/pet2及余1软木塞原生库副本，目标正常BUY注射剂2/slot4；全程普通输入，不写活跃位置、HP、flag或事件。

原435499先查flag11再比较f32deadline，正式actors沿isRoleFireReady消费。原ammo模块从实际tank3/owned字段与2001/4020得容量7/普通1.5/末发4.5秒，不硬填车型时长。正常连射耗尽七发，tick206开始末发装填；再普通进入3005/手动use5，tick231清state/count恢复1，HP700保持、库存2→1、重复无异常不扣。此时原startedAt1791172698501和duration4.5保持，remaining3.247000694、弹匣0/7。

解禁后heldfire的65个期限前snapshot仍0/7且原startedAt不变，至tick296首个服务deadline合格tick补满并普通开火6/7，期限晚12ms。完整末发期90tick/4.5模拟秒、服务4.512秒，接收墙钟在证据lastReloadTiming独立记录；解禁后等待段3.25模拟秒/3.259服务秒/3.242观测墙钟秒。旧trap期限后只有一次end，332共同完整players双同、指定trigger/end/itemUsed双同，双round1 Leave成功，3320清理。

仅此已购组合的手动异常解除与原装填双门禁交互；注射/地面producer仍明示重建，不新增原完整技能调度、全部配装、AI、声画、账户重启或原伤害claim。
