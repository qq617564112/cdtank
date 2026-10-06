# 速度与回旋饮料真实购入作用

M2-03/I06/I07首次正式取得到运动消费者支路由tests/tank-purchased-movement-drinks-network.cts补齐。consumables-purchase-network既有六商品购买与大包治疗证据、speed/turn-drink旧fixture规则和绘声范围复用。本片沿真实BUY3/pet2检查点，新Shop请求各购买物件6/7一件、正常Kitbag槽4/5、mode4/map7双账户Ready与普通useItem5/6，不写活跃位置、生命、技能或拥有资料。

原skill6 ItemMove+6、skill7 ItemTurn+6与各FuncType1 T10通过实际数组4临时技能进入共用recomputeQualifiedRoleMovement。实际拥有+34=0和+58/+5c/+60来源明确，所选pet2来自原表；未将宠物拥有记录冒作boundGear。原表/技能累计、limits14/15、精通扣减及f32尺度合同复用，无独立饮料速度或转速常量。

| 实际状态 | 速度 | 车体及炮塔转速rad/s |
| --- | ---: | ---: |
| 基线 | 130 | 0.680678368 |
| 速度饮料 | 190 | 0.680678368 |
| 两饮料生效 | 190 | 1.099557400 |
| 自然到期 | 130 | 0.680678368 |

普通前后段各0.25模拟秒，基线距离32.50485/32.50484，速度生效47.49559/47.50789，signedForwardProjection分别正/负。原地车体转向0.25秒角增0.2749，独立炮塔0.2748且车体0；自然恢复后车体与炮塔各0.1702。恢复前进距离32.4948。各段独立server/wall秒保存在封装及原raw，不把源模拟秒当墙钟。

两个技能在各自10秒重建期限的首个合格服务tick移除，均晚deadline34ms，恢复原数值。首个生效快照至移除快照各199步/9.95模拟秒，首次观察发生在作用写入之后；此观察区间不等于技能定义时长。本片不声称原服务器期限producer已恢复。HP700全程保持、两购买库存各1→0，普通Inventory回执保存。251次共同完整players观察和四指定itemUsed/skillStopped事件双同，两正常round1 Leave成功，3325无监听、临时库/进程清。

原raw tank-purchased-movement-drinks-network-2026-10-05T04-35-46-051Z.json与同前缀-server.log，独立封装tank-purchased-movement-drinks-player-evidence.json包含原来源、九段测量、期限及库存回执。无需新native/types/build。本片不包含效果第二槽、图声、重启、全部配装或原AI；A/D车体与Arrow独立炮塔映射仍为已登记重建控制，完整父项不关闭。
