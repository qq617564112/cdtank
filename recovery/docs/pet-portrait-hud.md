# 选中宠物与正式 HUD 头像

对应 `M5-04-PET`，来源为 [pet-portrait-source.md](pet-portrait-source.md) 的角色 PetTable 绑定与本机/远端图片名称。

正式 `BattleHud` 根据 `PlayerSnapshot.petId` 查询导出 `portraits.petId`，并以宠物定义 ID 管理每个玩家的 `PortraitState`。`HudPlayer` 保留实际 `tankId`，另携带 `petId`；头像 DOM 同时提供 `data-tank-id` 和 `data-pet-id`，前者不参与头像选择。同一战车选择不同宠物显示各自图片，同一宠物切换战车保持原表情状态；切换宠物清除旧宠物的临时表情，离开房间或玩家离开清理该记录。

本机 slot0 使用对应宠物的大头像与表情，其他槽使用对应 `normal1` 小图。死亡沿原统一本机/远端图片及原表情优先级。缺少宠物字段、未知宠物 ID 或缺少原图片保持空白，不从战车 ID 或其他宠物回填。每个宠物只采用导出目录确认的自身资源；pet5 同样遵循该来源，不补造或替代。

`tests/react-hud-store.cts` 增加同战车不同宠物、本机/远端各自图片、切换宠物重置、切换战车保留表情、缺来源/未知 ID 保空、pet5 采用其自身目录资源、离开后重入状态清理断言。`tests/browser-hud.mjs` 专项按 PetTable 目录枚举，并保留原表达式与几何检查；该脚本仅适配和语法检查，真实购买/选用/双端实战由主线验收提供。

正式Leave调用clear时发布空slots并清localHealth，同时清头像动画缓存；React删除旧玩家role=img和背景资源引用。HUD规则验证离房后没有旧玩家/图引用，重入重新建立正常表情。实际离房与重入结果由pet-portraits-browser.md记录。
