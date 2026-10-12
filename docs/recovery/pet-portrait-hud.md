# 选中宠物与正式 HUD 头像

对应 `M5-04-PET`，来源为 [pet-portrait-source.md](pet-portrait-source.md) 的角色 PetTable 绑定与本机/远端图片名称。

正式 `BattleHud` 根据 `PlayerSnapshot.petId` 查询导出 `portraits.petId`，并以宠物定义 ID 管理每个玩家的 `PortraitState`。`HudPlayer` 保留实际 `tankId`，另携带 `petId`；头像 DOM 同时提供 `data-tank-id` 和 `data-pet-id`，前者不参与头像选择。同一战车选择不同宠物显示各自图片，同一宠物切换战车保持原表情状态；切换宠物清除旧宠物的临时表情，离开房间或玩家离开清理该记录。

本机 slot0 使用对应宠物的大头像与原攻击、受击、庆祝表情。其余槽使用宠物与头像框合成的高清透明图片，支持正常、攻击、受击、庆祝两帧及共用死亡图；蓝方齿轮在左、红方齿轮在右，红方表情与效果镜像，受击文字保持可读。素材位于 `apps/web/public/ui/battle/portraits/framed/`。共用阵亡图直接叠加原 `ui/regions/77/24.png` 与红蓝高清框，图标宽度为 43 个 HUD 像素，红方图标完整水平镜像。

原 `0x4d0f62–0x4d149c` 将同一 `normal1` 图片写入远端各表情槽，`0x4d14ba–0x4d1528` 单独加载 `die_2`。当前远端按 `PortraitState` 的状态显示完整表情，本机图片与表情优先级沿用既有绑定。缺少宠物字段或未知宠物 ID 的存活头像保持空白，不从战车 ID 或其他宠物回填；死亡图由所有宠物共用。

合成图以原 `portrait-friend.png`、`portrait-enemy.png` 的可见框特征配准到 HUD 的 58×53 框位置，使用整张图片的缩放与平移，头部、肢体及效果的溢出范围不参与定位。框与宠物的绘制连接保持完整，远端不再额外叠加另一张框。所有头像旁的生命条均不显示，底部本机主生命条保持显示。

`tests/react-hud-store.cts` 增加同战车不同宠物、本机/远端各自图片、切换宠物重置、切换战车保留表情、缺来源/未知 ID 保空、pet5 采用其自身目录资源、离开后重入状态清理断言。`tests/browser-hud.mjs` 专项按 PetTable 目录枚举，并保留原表达式与几何检查；该脚本仅适配和语法检查，真实购买/选用/双端实战由主线验收提供。

正式Leave调用clear时发布空slots并清localHealth，同时清头像动画缓存；React删除旧玩家role=img和背景资源引用。HUD规则验证离房后没有旧玩家/图引用，重入重新建立正常表情。实际离房与重入结果由pet-portraits-browser.md记录。
