# game_main.xml 控件映射

来源：`recovery/output/web-assets/ui.json` 中 `ui/layouts/game_main.xml`，共 165 个控件。下表保留原名字、父节点和类型，区分正式消费者、原资源事实和采用的业务规则。映射表不证明完整页面或原版视觉验收。

主树由 `apps/web/src/interface/battle/battle-hud-view.tsx` 消费；八槽栏由 `hud-item-source-view.tsx` 独占全部41控件，退出由 `battle-play-page.tsx` 的真实按钮负责，小地图两控件由 `hud-minimap-view.tsx` 负责。主树排除这些组件及其完整子树，避免孤立子控件重复绘制。所有文件路径均相对 `apps/web/src/interface/battle/`。

动态文字使用用户 XiangJiao 字体；伤害、治疗、暴击原图片继续由世界渲染器负责。称号属性/表名链见 `battle-hud-title-source.md`；称号获取/持有/选用与原阶段、原小地图投影、模式公告生产语义见各自来源文档；有玩家的称号槽缺值时默认显示ID1“嗷嗷待哺”，真实称号优先；其它缺失权威数值保持空白。

| # | 原控件 | 原父节点 | 原类型 | 当前状态/功能 | 正式消费者 | 来源与完成范围 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `SheetWindow` | `—` | `WindowsLook/StaticImage` | 原800×600父树，HudSnapshot.visible | `HudLayout` | 原布局＋Web阶段 |
| 2 | `all` | `SheetWindow` | `WindowsLook/StaticImage` | 原800×600父树，HudSnapshot.visible | `HudLayout` | 原布局＋Web阶段 |
| 3 | `picPlayer0` | `all` | `WindowsLook/StaticImage` | 权威玩家；本机优先、同队左/其余右、12槽溢出分配 | `HudLayout` | Web槽位政策；原排序未恢复 |
| 4 | `picPlayerPanel0` | `picPlayer0` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 5 | `txtPlayerName0` | `picPlayerPanel0` | `WindowsLook/StaticText` | 当前槽PlayerSnapshot.name | `HudLayout` | Web权威投影，用户字体 |
| 6 | `txtPlayerTitle0` | `picPlayerPanel0` | `WindowsLook/StaticText` | 原属性0x1e/m_iNowTitle查表；无真实称号时默认ID1“嗷嗷待哺” | `HudLayout` | PlayerSnapshot.title.name；缺值默认ID1 |
| 7 | `picPlayerIconBg0` | `picPlayer0` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 8 | `prgPlayerLife0` | `picPlayer0` | `WindowsLook/ProgressBar` | 权威hp/maxHp；原ProgressBar图、颜色、tile/clip | `HealthControl / SourceProgress` | 既有原绘制消费者 |
| 9 | `picPlayerIcon0` | `picPlayer0` | `WindowsLook/StaticImage` | 原PetTable头像与PortraitState；缺宠物不猜图 | `HudLayout` | 既有原头像消费者 |
| 10 | `picVIP0` | `picPlayer0` | `WindowsLook/StaticImage` | 模式3当前槽PlayerSnapshot.isVIP | `HudLayout` | 原图＋Web权威标志 |
| 11 | `picPlayer1` | `all` | `WindowsLook/StaticImage` | 权威玩家；本机优先、同队左/其余右、12槽溢出分配 | `HudLayout` | Web槽位政策；原排序未恢复 |
| 12 | `picPlayerPanel1` | `picPlayer1` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 13 | `txtPlayerName1` | `picPlayerPanel1` | `WindowsLook/StaticText` | 当前槽PlayerSnapshot.name | `HudLayout` | Web权威投影，用户字体 |
| 14 | `txtPlayerTitle1` | `picPlayerPanel1` | `WindowsLook/StaticText` | 原属性0x1e/m_iNowTitle查表；无真实称号时默认ID1“嗷嗷待哺” | `HudLayout` | PlayerSnapshot.title.name；缺值默认ID1 |
| 15 | `picPlayerIconBg1` | `picPlayer1` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 16 | `prgPlayerLife1` | `picPlayer1` | `WindowsLook/ProgressBar` | 权威hp/maxHp；原ProgressBar图、颜色、tile/clip | `HealthControl / SourceProgress` | 既有原绘制消费者 |
| 17 | `picPlayerIcon1` | `picPlayer1` | `WindowsLook/StaticImage` | 原PetTable头像与PortraitState；缺宠物不猜图 | `HudLayout` | 既有原头像消费者 |
| 18 | `picVIP1` | `picPlayer1` | `WindowsLook/StaticImage` | 模式3当前槽PlayerSnapshot.isVIP | `HudLayout` | 原图＋Web权威标志 |
| 19 | `picPlayer2` | `all` | `WindowsLook/StaticImage` | 权威玩家；本机优先、同队左/其余右、12槽溢出分配 | `HudLayout` | Web槽位政策；原排序未恢复 |
| 20 | `picPlayerPanel2` | `picPlayer2` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 21 | `txtPlayerName2` | `picPlayerPanel2` | `WindowsLook/StaticText` | 当前槽PlayerSnapshot.name | `HudLayout` | Web权威投影，用户字体 |
| 22 | `txtPlayerTitle2` | `picPlayerPanel2` | `WindowsLook/StaticText` | 原属性0x1e/m_iNowTitle查表；无真实称号时默认ID1“嗷嗷待哺” | `HudLayout` | PlayerSnapshot.title.name；缺值默认ID1 |
| 23 | `picPlayerIconBg2` | `picPlayer2` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 24 | `prgPlayerLife2` | `picPlayer2` | `WindowsLook/ProgressBar` | 权威hp/maxHp；原ProgressBar图、颜色、tile/clip | `HealthControl / SourceProgress` | 既有原绘制消费者 |
| 25 | `picPlayerIcon2` | `picPlayer2` | `WindowsLook/StaticImage` | 原PetTable头像与PortraitState；缺宠物不猜图 | `HudLayout` | 既有原头像消费者 |
| 26 | `picVIP2` | `picPlayer2` | `WindowsLook/StaticImage` | 模式3当前槽PlayerSnapshot.isVIP | `HudLayout` | 原图＋Web权威标志 |
| 27 | `picPlayer3` | `all` | `WindowsLook/StaticImage` | 权威玩家；本机优先、同队左/其余右、12槽溢出分配 | `HudLayout` | Web槽位政策；原排序未恢复 |
| 28 | `picPlayerPanel3` | `picPlayer3` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 29 | `txtPlayerName3` | `picPlayerPanel3` | `WindowsLook/StaticText` | 当前槽PlayerSnapshot.name | `HudLayout` | Web权威投影，用户字体 |
| 30 | `txtPlayerTitle3` | `picPlayerPanel3` | `WindowsLook/StaticText` | 原属性0x1e/m_iNowTitle查表；无真实称号时默认ID1“嗷嗷待哺” | `HudLayout` | PlayerSnapshot.title.name；缺值默认ID1 |
| 31 | `picPlayerIconBg3` | `picPlayer3` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 32 | `prgPlayerLife3` | `picPlayer3` | `WindowsLook/ProgressBar` | 权威hp/maxHp；原ProgressBar图、颜色、tile/clip | `HealthControl / SourceProgress` | 既有原绘制消费者 |
| 33 | `picPlayerIcon3` | `picPlayer3` | `WindowsLook/StaticImage` | 原PetTable头像与PortraitState；缺宠物不猜图 | `HudLayout` | 既有原头像消费者 |
| 34 | `picVIP3` | `picPlayer3` | `WindowsLook/StaticImage` | 模式3当前槽PlayerSnapshot.isVIP | `HudLayout` | 原图＋Web权威标志 |
| 35 | `picPlayer4` | `all` | `WindowsLook/StaticImage` | 权威玩家；本机优先、同队左/其余右、12槽溢出分配 | `HudLayout` | Web槽位政策；原排序未恢复 |
| 36 | `picPlayerPanel4` | `picPlayer4` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 37 | `txtPlayerName4` | `picPlayerPanel4` | `WindowsLook/StaticText` | 当前槽PlayerSnapshot.name | `HudLayout` | Web权威投影，用户字体 |
| 38 | `txtPlayerTitle4` | `picPlayerPanel4` | `WindowsLook/StaticText` | 原属性0x1e/m_iNowTitle查表；无真实称号时默认ID1“嗷嗷待哺” | `HudLayout` | PlayerSnapshot.title.name；缺值默认ID1 |
| 39 | `picPlayerIconBg4` | `picPlayer4` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 40 | `prgPlayerLife4` | `picPlayer4` | `WindowsLook/ProgressBar` | 权威hp/maxHp；原ProgressBar图、颜色、tile/clip | `HealthControl / SourceProgress` | 既有原绘制消费者 |
| 41 | `picPlayerIcon4` | `picPlayer4` | `WindowsLook/StaticImage` | 原PetTable头像与PortraitState；缺宠物不猜图 | `HudLayout` | 既有原头像消费者 |
| 42 | `picVIP4` | `picPlayer4` | `WindowsLook/StaticImage` | 模式3当前槽PlayerSnapshot.isVIP | `HudLayout` | 原图＋Web权威标志 |
| 43 | `picPlayer5` | `all` | `WindowsLook/StaticImage` | 权威玩家；本机优先、同队左/其余右、12槽溢出分配 | `HudLayout` | Web槽位政策；原排序未恢复 |
| 44 | `picPlayerPanel5` | `picPlayer5` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 45 | `txtPlayerName5` | `picPlayerPanel5` | `WindowsLook/StaticText` | 当前槽PlayerSnapshot.name | `HudLayout` | Web权威投影，用户字体 |
| 46 | `txtPlayerTitle5` | `picPlayerPanel5` | `WindowsLook/StaticText` | 原属性0x1e/m_iNowTitle查表；无真实称号时默认ID1“嗷嗷待哺” | `HudLayout` | PlayerSnapshot.title.name；缺值默认ID1 |
| 47 | `picPlayerIconBg5` | `picPlayer5` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 48 | `prgPlayerLife5` | `picPlayer5` | `WindowsLook/ProgressBar` | 权威hp/maxHp；原ProgressBar图、颜色、tile/clip | `HealthControl / SourceProgress` | 既有原绘制消费者 |
| 49 | `picPlayerIcon5` | `picPlayer5` | `WindowsLook/StaticImage` | 原PetTable头像与PortraitState；缺宠物不猜图 | `HudLayout` | 既有原头像消费者 |
| 50 | `picVIP5` | `picPlayer5` | `WindowsLook/StaticImage` | 模式3当前槽PlayerSnapshot.isVIP | `HudLayout` | 原图＋Web权威标志 |
| 51 | `picPlayer6` | `all` | `WindowsLook/StaticImage` | 权威玩家；本机优先、同队左/其余右、12槽溢出分配 | `HudLayout` | Web槽位政策；原排序未恢复 |
| 52 | `picPlayerPanel6` | `picPlayer6` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 53 | `txtPlayerName6` | `picPlayerPanel6` | `WindowsLook/StaticText` | 当前槽PlayerSnapshot.name | `HudLayout` | Web权威投影，用户字体 |
| 54 | `txtPlayerTitle6` | `picPlayerPanel6` | `WindowsLook/StaticText` | 原属性0x1e/m_iNowTitle查表；无真实称号时默认ID1“嗷嗷待哺” | `HudLayout` | PlayerSnapshot.title.name；缺值默认ID1 |
| 55 | `picPlayerIconBg6` | `picPlayer6` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 56 | `prgPlayerLife6` | `picPlayer6` | `WindowsLook/ProgressBar` | 权威hp/maxHp；原ProgressBar图、颜色、tile/clip | `HealthControl / SourceProgress` | 既有原绘制消费者 |
| 57 | `picPlayerIcon6` | `picPlayer6` | `WindowsLook/StaticImage` | 原PetTable头像与PortraitState；缺宠物不猜图 | `HudLayout` | 既有原头像消费者 |
| 58 | `picVIP6` | `picPlayer6` | `WindowsLook/StaticImage` | 模式3当前槽PlayerSnapshot.isVIP | `HudLayout` | 原图＋Web权威标志 |
| 59 | `picPlayer7` | `all` | `WindowsLook/StaticImage` | 权威玩家；本机优先、同队左/其余右、12槽溢出分配 | `HudLayout` | Web槽位政策；原排序未恢复 |
| 60 | `picPlayerPanel7` | `picPlayer7` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 61 | `txtPlayerName7` | `picPlayerPanel7` | `WindowsLook/StaticText` | 当前槽PlayerSnapshot.name | `HudLayout` | Web权威投影，用户字体 |
| 62 | `txtPlayerTitle7` | `picPlayerPanel7` | `WindowsLook/StaticText` | 原属性0x1e/m_iNowTitle查表；无真实称号时默认ID1“嗷嗷待哺” | `HudLayout` | PlayerSnapshot.title.name；缺值默认ID1 |
| 63 | `picPlayerIconBg7` | `picPlayer7` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 64 | `prgPlayerLife7` | `picPlayer7` | `WindowsLook/ProgressBar` | 权威hp/maxHp；原ProgressBar图、颜色、tile/clip | `HealthControl / SourceProgress` | 既有原绘制消费者 |
| 65 | `picPlayerIcon7` | `picPlayer7` | `WindowsLook/StaticImage` | 原PetTable头像与PortraitState；缺宠物不猜图 | `HudLayout` | 既有原头像消费者 |
| 66 | `picVIP7` | `picPlayer7` | `WindowsLook/StaticImage` | 模式3当前槽PlayerSnapshot.isVIP | `HudLayout` | 原图＋Web权威标志 |
| 67 | `picPlayer8` | `all` | `WindowsLook/StaticImage` | 权威玩家；本机优先、同队左/其余右、12槽溢出分配 | `HudLayout` | Web槽位政策；原排序未恢复 |
| 68 | `picPlayerPanel8` | `picPlayer8` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 69 | `txtPlayerName8` | `picPlayerPanel8` | `WindowsLook/StaticText` | 当前槽PlayerSnapshot.name | `HudLayout` | Web权威投影，用户字体 |
| 70 | `txtPlayerTitle8` | `picPlayerPanel8` | `WindowsLook/StaticText` | 原属性0x1e/m_iNowTitle查表；无真实称号时默认ID1“嗷嗷待哺” | `HudLayout` | PlayerSnapshot.title.name；缺值默认ID1 |
| 71 | `picPlayerIconBg8` | `picPlayer8` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 72 | `prgPlayerLife8` | `picPlayer8` | `WindowsLook/ProgressBar` | 权威hp/maxHp；原ProgressBar图、颜色、tile/clip | `HealthControl / SourceProgress` | 既有原绘制消费者 |
| 73 | `picPlayerIcon8` | `picPlayer8` | `WindowsLook/StaticImage` | 原PetTable头像与PortraitState；缺宠物不猜图 | `HudLayout` | 既有原头像消费者 |
| 74 | `picVIP8` | `picPlayer8` | `WindowsLook/StaticImage` | 模式3当前槽PlayerSnapshot.isVIP | `HudLayout` | 原图＋Web权威标志 |
| 75 | `picPlayer9` | `all` | `WindowsLook/StaticImage` | 权威玩家；本机优先、同队左/其余右、12槽溢出分配 | `HudLayout` | Web槽位政策；原排序未恢复 |
| 76 | `picPlayerPanel9` | `picPlayer9` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 77 | `txtPlayerName9` | `picPlayerPanel9` | `WindowsLook/StaticText` | 当前槽PlayerSnapshot.name | `HudLayout` | Web权威投影，用户字体 |
| 78 | `txtPlayerTitle9` | `picPlayerPanel9` | `WindowsLook/StaticText` | 原属性0x1e/m_iNowTitle查表；无真实称号时默认ID1“嗷嗷待哺” | `HudLayout` | PlayerSnapshot.title.name；缺值默认ID1 |
| 79 | `picPlayerIconBg9` | `picPlayer9` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 80 | `prgPlayerLife9` | `picPlayer9` | `WindowsLook/ProgressBar` | 权威hp/maxHp；原ProgressBar图、颜色、tile/clip | `HealthControl / SourceProgress` | 既有原绘制消费者 |
| 81 | `picPlayerIcon9` | `picPlayer9` | `WindowsLook/StaticImage` | 原PetTable头像与PortraitState；缺宠物不猜图 | `HudLayout` | 既有原头像消费者 |
| 82 | `picVIP9` | `picPlayer9` | `WindowsLook/StaticImage` | 模式3当前槽PlayerSnapshot.isVIP | `HudLayout` | 原图＋Web权威标志 |
| 83 | `picPlayer10` | `all` | `WindowsLook/StaticImage` | 权威玩家；本机优先、同队左/其余右、12槽溢出分配 | `HudLayout` | Web槽位政策；原排序未恢复 |
| 84 | `picPlayerPanel10` | `picPlayer10` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 85 | `txtPlayerName10` | `picPlayerPanel10` | `WindowsLook/StaticText` | 当前槽PlayerSnapshot.name | `HudLayout` | Web权威投影，用户字体 |
| 86 | `txtPlayerTitle10` | `picPlayerPanel10` | `WindowsLook/StaticText` | 原属性0x1e/m_iNowTitle查表；无真实称号时默认ID1“嗷嗷待哺” | `HudLayout` | PlayerSnapshot.title.name；缺值默认ID1 |
| 87 | `picPlayerIconBg10` | `picPlayer10` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 88 | `prgPlayerLife10` | `picPlayer10` | `WindowsLook/ProgressBar` | 权威hp/maxHp；原ProgressBar图、颜色、tile/clip | `HealthControl / SourceProgress` | 既有原绘制消费者 |
| 89 | `picPlayerIcon10` | `picPlayer10` | `WindowsLook/StaticImage` | 原PetTable头像与PortraitState；缺宠物不猜图 | `HudLayout` | 既有原头像消费者 |
| 90 | `picVIP10` | `picPlayer10` | `WindowsLook/StaticImage` | 模式3当前槽PlayerSnapshot.isVIP | `HudLayout` | 原图＋Web权威标志 |
| 91 | `picPlayer11` | `all` | `WindowsLook/StaticImage` | 权威玩家；本机优先、同队左/其余右、12槽溢出分配 | `HudLayout` | Web槽位政策；原排序未恢复 |
| 92 | `picPlayerPanel11` | `picPlayer11` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 93 | `txtPlayerName11` | `picPlayerPanel11` | `WindowsLook/StaticText` | 当前槽PlayerSnapshot.name | `HudLayout` | Web权威投影，用户字体 |
| 94 | `txtPlayerTitle11` | `picPlayerPanel11` | `WindowsLook/StaticText` | 原属性0x1e/m_iNowTitle查表；无真实称号时默认ID1“嗷嗷待哺” | `HudLayout` | PlayerSnapshot.title.name；缺值默认ID1 |
| 95 | `picPlayerIconBg11` | `picPlayer11` | `WindowsLook/StaticImage` | 原头像框；空玩家槽随父隐藏 | `HudLayout` | 原资源；槽位排序为Web政策 |
| 96 | `prgPlayerLife11` | `picPlayer11` | `WindowsLook/ProgressBar` | 权威hp/maxHp；原ProgressBar图、颜色、tile/clip | `HealthControl / SourceProgress` | 既有原绘制消费者 |
| 97 | `picPlayerIcon11` | `picPlayer11` | `WindowsLook/StaticImage` | 原PetTable头像与PortraitState；缺宠物不猜图 | `HudLayout` | 既有原头像消费者 |
| 98 | `picVIP11` | `picPlayer11` | `WindowsLook/StaticImage` | 模式3当前槽PlayerSnapshot.isVIP | `HudLayout` | 原图＋Web权威标志 |
| 99 | `daojulan` | `all` | `WindowsLook/StaticImage` | 原300×47底图；PLAYING/FINISHED门禁 | `HudItemSourceView` | 原资源＋Web阶段 |
| 100 | `picItem0` | `daojulan` | `WindowsLook/StaticImage` | 当前selectedAmmoSlot；确认空槽不选中 | `HudItemSourceView` | Web选中框 |
| 101 | `daoju1` | `picItem0` | `WindowsLook/StaticImage` | 2001默认图；ammoSlots/Inventory确认itemTableId与原Item图 | `HudItemSourceView` | 原资源＋Web权威投影 |
| 102 | `lblItem0` | `picItem0` | `WindowsLook/StaticText` | 原Text键号1–8 | `HudItemSourceView` | 原静态文字 |
| 103 | `txtItemCount0` | `picItem0` | `WindowsLook/StaticText` | 默认原∞；特殊ammoSlots或Inventory.battleQuantity | `HudItemSourceView` | 原∞＋Web确认数量 |
| 104 | `lengque1` | `picItem0` | `WindowsLook/ProgressBar` | lengque1–4当前有效槽装填；5–8已确认效果剩余秒 | `HudItemSourceView` | 原覆盖图＋Web期限；原setter未完整恢复 |
| 105 | `picItem1` | `daojulan` | `WindowsLook/StaticImage` | 当前selectedAmmoSlot；确认空槽不选中 | `HudItemSourceView` | Web选中框 |
| 106 | `daoju2` | `picItem1` | `WindowsLook/StaticImage` | 2001默认图；ammoSlots/Inventory确认itemTableId与原Item图 | `HudItemSourceView` | 原资源＋Web权威投影 |
| 107 | `lblItem1` | `picItem1` | `WindowsLook/StaticText` | 原Text键号1–8 | `HudItemSourceView` | 原静态文字 |
| 108 | `txtItemCount1` | `picItem1` | `WindowsLook/StaticText` | 默认原∞；特殊ammoSlots或Inventory.battleQuantity | `HudItemSourceView` | 原∞＋Web确认数量 |
| 109 | `lengque2` | `picItem1` | `WindowsLook/ProgressBar` | lengque1–4当前有效槽装填；5–8已确认效果剩余秒 | `HudItemSourceView` | 原覆盖图＋Web期限；原setter未完整恢复 |
| 110 | `picItem2` | `daojulan` | `WindowsLook/StaticImage` | 当前selectedAmmoSlot；确认空槽不选中 | `HudItemSourceView` | Web选中框 |
| 111 | `daoju3` | `picItem2` | `WindowsLook/StaticImage` | 2001默认图；ammoSlots/Inventory确认itemTableId与原Item图 | `HudItemSourceView` | 原资源＋Web权威投影 |
| 112 | `lblItem2` | `picItem2` | `WindowsLook/StaticText` | 原Text键号1–8 | `HudItemSourceView` | 原静态文字 |
| 113 | `txtItemCount2` | `picItem2` | `WindowsLook/StaticText` | 默认原∞；特殊ammoSlots或Inventory.battleQuantity | `HudItemSourceView` | 原∞＋Web确认数量 |
| 114 | `lengque3` | `picItem2` | `WindowsLook/ProgressBar` | lengque1–4当前有效槽装填；5–8已确认效果剩余秒 | `HudItemSourceView` | 原覆盖图＋Web期限；原setter未完整恢复 |
| 115 | `picItem3` | `daojulan` | `WindowsLook/StaticImage` | 当前selectedAmmoSlot；确认空槽不选中 | `HudItemSourceView` | Web选中框 |
| 116 | `daoju4` | `picItem3` | `WindowsLook/StaticImage` | 2001默认图；ammoSlots/Inventory确认itemTableId与原Item图 | `HudItemSourceView` | 原资源＋Web权威投影 |
| 117 | `lblItem3` | `picItem3` | `WindowsLook/StaticText` | 原Text键号1–8 | `HudItemSourceView` | 原静态文字 |
| 118 | `txtItemCount3` | `picItem3` | `WindowsLook/StaticText` | 默认原∞；特殊ammoSlots或Inventory.battleQuantity | `HudItemSourceView` | 原∞＋Web确认数量 |
| 119 | `lengque4` | `picItem3` | `WindowsLook/ProgressBar` | lengque1–4当前有效槽装填；5–8已确认效果剩余秒 | `HudItemSourceView` | 原覆盖图＋Web期限；原setter未完整恢复 |
| 120 | `picItem4` | `daojulan` | `WindowsLook/StaticImage` | 当前selectedAmmoSlot；确认空槽不选中 | `HudItemSourceView` | Web选中框 |
| 121 | `daoju5` | `picItem4` | `WindowsLook/StaticImage` | 2001默认图；ammoSlots/Inventory确认itemTableId与原Item图 | `HudItemSourceView` | 原资源＋Web权威投影 |
| 122 | `lblItem4` | `picItem4` | `WindowsLook/StaticText` | 原Text键号1–8 | `HudItemSourceView` | 原静态文字 |
| 123 | `txtItemCount4` | `picItem4` | `WindowsLook/StaticText` | 默认原∞；特殊ammoSlots或Inventory.battleQuantity | `HudItemSourceView` | 原∞＋Web确认数量 |
| 124 | `lengque5` | `picItem4` | `WindowsLook/ProgressBar` | lengque1–4当前有效槽装填；5–8已确认效果剩余秒 | `HudItemSourceView` | 原覆盖图＋Web期限；原setter未完整恢复 |
| 125 | `picItem5` | `daojulan` | `WindowsLook/StaticImage` | 当前selectedAmmoSlot；确认空槽不选中 | `HudItemSourceView` | Web选中框 |
| 126 | `daoju6` | `picItem5` | `WindowsLook/StaticImage` | 2001默认图；ammoSlots/Inventory确认itemTableId与原Item图 | `HudItemSourceView` | 原资源＋Web权威投影 |
| 127 | `lblItem5` | `picItem5` | `WindowsLook/StaticText` | 原Text键号1–8 | `HudItemSourceView` | 原静态文字 |
| 128 | `txtItemCount5` | `picItem5` | `WindowsLook/StaticText` | 默认原∞；特殊ammoSlots或Inventory.battleQuantity | `HudItemSourceView` | 原∞＋Web确认数量 |
| 129 | `lengque6` | `picItem5` | `WindowsLook/ProgressBar` | lengque1–4当前有效槽装填；5–8已确认效果剩余秒 | `HudItemSourceView` | 原覆盖图＋Web期限；原setter未完整恢复 |
| 130 | `picItem6` | `daojulan` | `WindowsLook/StaticImage` | 当前selectedAmmoSlot；确认空槽不选中 | `HudItemSourceView` | Web选中框 |
| 131 | `daoju7` | `picItem6` | `WindowsLook/StaticImage` | 2001默认图；ammoSlots/Inventory确认itemTableId与原Item图 | `HudItemSourceView` | 原资源＋Web权威投影 |
| 132 | `lblItem6` | `picItem6` | `WindowsLook/StaticText` | 原Text键号1–8 | `HudItemSourceView` | 原静态文字 |
| 133 | `txtItemCount6` | `picItem6` | `WindowsLook/StaticText` | 默认原∞；特殊ammoSlots或Inventory.battleQuantity | `HudItemSourceView` | 原∞＋Web确认数量 |
| 134 | `lengque7` | `picItem6` | `WindowsLook/ProgressBar` | lengque1–4当前有效槽装填；5–8已确认效果剩余秒 | `HudItemSourceView` | 原覆盖图＋Web期限；原setter未完整恢复 |
| 135 | `picItem7` | `daojulan` | `WindowsLook/StaticImage` | 当前selectedAmmoSlot；确认空槽不选中 | `HudItemSourceView` | Web选中框 |
| 136 | `daoju8` | `picItem7` | `WindowsLook/StaticImage` | 2001默认图；ammoSlots/Inventory确认itemTableId与原Item图 | `HudItemSourceView` | 原资源＋Web权威投影 |
| 137 | `lblItem7` | `picItem7` | `WindowsLook/StaticText` | 原Text键号1–8 | `HudItemSourceView` | 原静态文字 |
| 138 | `txtItemCount7` | `picItem7` | `WindowsLook/StaticText` | 默认原∞；特殊ammoSlots或Inventory.battleQuantity | `HudItemSourceView` | 原∞＋Web确认数量 |
| 139 | `lengque8` | `picItem7` | `WindowsLook/ProgressBar` | lengque1–4当前有效槽装填；5–8已确认效果剩余秒 | `HudItemSourceView` | 原覆盖图＋Web期限；原setter未完整恢复 |
| 140 | `btnExit` | `all` | `WindowsLook/Button` | 既有普通Leave与busy/canLeave | `BattlePlayPage` | 原SourceButton＋Web操作 |
| 141 | `picMiniMap` | `all` | `WindowsLook/StaticImage` | 当前mapId原场景俯视图、25图NAV/RPT固定范围、玩家与目标快照 | `HudMinimapView` | 原矩形/alpha；逐图映射见hud-minimap-coordinate-source.md |
| 142 | `picMiniMapBound` | `all` | `WindowsLook/StaticImage` | ditukuang1–8原FrameImage与192×192矩形 | `HudMinimapView` | 原八边框，独立alpha |
| 143 | `prgLife` | `all` | `WindowsLook/ProgressBar` | 权威hp/maxHp；原ProgressBar图、颜色、tile/clip | `HealthControl / SourceProgress` | 既有原绘制消费者 |
| 144 | `prgBullet` | `all` | `WindowsLook/ProgressBar` | ammoMagazine；width=f32(capacity×15)，fraction=f32(remaining/capacity) | `BulletControl / SourceProgress` | 原4cb52f消费者＋Web权威输入 |
| 145 | `prgCrossbar` | `all` | `WindowsLook/ProgressBar` | 活着且PLAYING的reload；既有duration+.5原进度消费者 | `ReloadControl / SourceProgress` | 既有原装填消费者 |
| 146 | `picBattleInfoPanel` | `all` | `WindowsLook/StaticImage` | 既有BattleInfoOpacity：消息重置、8秒后alpha.2、hover | `BattleInfoPanel` | 既有原alpha消费者 |
| 147 | `edtBattleInfo` | `picBattleInfoPanel` | `WindowsLook/RichEditbox` | 确认事件消息、最近五条 | `HudLayout` | Web消息容量与文本 |
| 148 | `picFight` | `SheetWindow` | `WindowsLook/StaticImage` | 本局先模式图2秒再Fight1秒；`battleStartsAt`前坦克不动，提示完才计时/移动；离房/终局隐藏 | `HudLayout` | 原资源＋Web开始合同；原producer未恢复 |
| 149 | `txtCountdown` | `SheetWindow` | `WindowsLook/StaticText` | 既有LocalDeathCountdown；无值隐藏 | `HudLayout` | 既有复活消费者，用户字体 |
| 150 | `picModeSplash` | `SheetWindow` | `WindowsLook/StaticImage` | 本局先模式图2秒再Fight1秒；`battleStartsAt`前坦克不动，提示完才计时/移动；离房/终局隐藏 | `HudLayout` | 原资源＋Web开始合同；原producer未恢复 |
| 151 | `picVIPMode` | `SheetWindow` | `WindowsLook/StaticImage` | 本局先模式图2秒再Fight1秒；离房/终局隐藏 | `HudLayout` | 原资源＋Web阶段政策；原producer未恢复 |
| 152 | `qinwang` | `picVIPMode` | `WindowsLook/StaticImage` | 本局先模式图2秒再Fight1秒；离房/终局隐藏 | `HudLayout` | 原资源＋Web阶段政策；原producer未恢复 |
| 153 | `moshi1` | `picVIPMode` | `WindowsLook/StaticImage` | 本局先模式图2秒再Fight1秒；离房/终局隐藏 | `HudLayout` | 原资源＋Web阶段政策；原producer未恢复 |
| 154 | `picDestroyMode` | `SheetWindow` | `WindowsLook/StaticImage` | 本局先模式图2秒再Fight1秒；离房/终局隐藏 | `HudLayout` | 原资源＋Web阶段政策；原producer未恢复 |
| 155 | `pohuai` | `picDestroyMode` | `WindowsLook/StaticImage` | 本局先模式图2秒再Fight1秒；离房/终局隐藏 | `HudLayout` | 原资源＋Web阶段政策；原producer未恢复 |
| 156 | `moshi` | `picDestroyMode` | `WindowsLook/StaticImage` | 本局先模式图2秒再Fight1秒；离房/终局隐藏 | `HudLayout` | 原资源＋Web阶段政策；原producer未恢复 |
| 157 | `picTeamMode` | `SheetWindow` | `WindowsLook/StaticImage` | 本局先模式图2秒再Fight1秒；离房/终局隐藏 | `HudLayout` | 原资源＋Web阶段政策；原producer未恢复 |
| 158 | `tuandui` | `picTeamMode` | `WindowsLook/StaticImage` | 本局先模式图2秒再Fight1秒；离房/终局隐藏 | `HudLayout` | 原资源＋Web阶段政策；原producer未恢复 |
| 159 | `moshi2` | `picTeamMode` | `WindowsLook/StaticImage` | 本局先模式图2秒再Fight1秒；离房/终局隐藏 | `HudLayout` | 原资源＋Web阶段政策；原producer未恢复 |
| 160 | `picConquerMode` | `SheetWindow` | `WindowsLook/StaticImage` | 本局先模式图2秒再Fight1秒；离房/终局隐藏 | `HudLayout` | 原资源＋Web阶段政策；原producer未恢复 |
| 161 | `zhanling` | `picConquerMode` | `WindowsLook/StaticImage` | 本局先模式图2秒再Fight1秒；离房/终局隐藏 | `HudLayout` | 原资源＋Web阶段政策；原producer未恢复 |
| 162 | `moshi4` | `picConquerMode` | `WindowsLook/StaticImage` | 本局先模式图2秒再Fight1秒；离房/终局隐藏 | `HudLayout` | 原资源＋Web阶段政策；原producer未恢复 |
| 163 | `picMeleeMode` | `SheetWindow` | `WindowsLook/StaticImage` | 本局先模式图2秒再Fight1秒；离房/终局隐藏 | `HudLayout` | 原资源＋Web阶段政策；原producer未恢复 |
| 164 | `hunzhan` | `picMeleeMode` | `WindowsLook/StaticImage` | 本局先模式图2秒再Fight1秒；离房/终局隐藏 | `HudLayout` | 原资源＋Web阶段政策；原producer未恢复 |
| 165 | `moshi5` | `picMeleeMode` | `WindowsLook/StaticImage` | 本局先模式图2秒再Fight1秒；离房/终局隐藏 | `HudLayout` | 原资源＋Web阶段政策；原producer未恢复 |

完整 800×600、1080p、4K 页面与输入焦点尚未实测。当前接线已存在十二槽姓名/称号、VIP、小地图、弹量与开始提示消费者，头像/生命/模式数字/聊天也已接入；真实来源限制按各来源文档保留。称号槽现读取账号已选用`PlayerSnapshot.title.name`，无选用时缺值默认ID1仅作展示；世界标签勋章仍缺完整权威接线。M5-04、M5-05、UI-09 保持未勾选。
