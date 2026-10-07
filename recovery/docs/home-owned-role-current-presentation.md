# 我的家拥有角色当前使用标识

范围：UI32/M5-07、UI34/M5-08。Home 拥有战车/宠物名单中，已确认的当前使用角色实例行显示原状态 3 标识。依据为主仓来源 `home-owned-role-current-source.md`、`source-contract.md` 与 UI 快照终态代码。

## 确认链

- `HomeRoles` 从确认 `RoleProfile.bytes` 读取当前实例号：战车偏移 `0xa8`、宠物偏移 `0xa4`，小端 `u32`。这是确认的当前使用 owned 实例，不是选中候选，也不是商城/交易/维修字段。
- 该值作为 `current` 传入 `HomeOwnedRoleSourceList`；名单按 `current === entry.instanceId` 只给命中的行传 `current=true`，两 row 的 `current` 参数是可选布尔。
- 命中行的 `HomeOwnedTankRowContent`/`HomeOwnedPetRowContent` 渲染共享 consumer `HomeRoleRowStatusBadge(status="current")`，其余行不渲染。选择候选（`selected`）不改变该标识；只有 `selectRole` 成功并以确认 `profile` 覆盖后，`currentId` 才移动。
- `HomeRoleRowStatusBadge(status="current")` 用 `set:xiaoheitizi0 image:data\ui\xiaoheitizi\n.tga` 经共享 `sourceUiImage` 直读原图集，命中 `ui/regions/11/10.png`（原 `SmallHT` 的 `N` glyph，自然尺寸 `14×14`）；`status="installed"` 的 `E` 走同一共享 consumer 与图像路径。

## 表现与字体

- 徽标为原 region 位图：`position:absolute; left:5px; top:8px; width:14px; height:14px; background-position:left top; background-size:14px 14px`，位于行局部坐标，随父级源页面 scale 缩放。这对应原调用点的行局部 `(x+5, y+8)`。
- 这是采用表达：以原 `14×14` region 直接放入该 point，随父 scale。不声称恢复原 `CEGUI::Font::drawText` 的内部像素放置、字体 `AutoScaled` 轴或 HD 逐像素。
- 原 `SmallHT` 状态 glyph 是图片字符，不是普通文字；`HomeRoleRowStatusBadge(status="current")` 直接消费该位图。普通名称/类型/天数仍走 `SourceFeedbackText` 的 `Xiangjiao` 描边字。

## 复用范围

- Home 拥有名单使用自己的 HomeRoles 确认链传 `current`；商城战车行 `tank-shop-texture.tsx`、维修战车行 `mend-shop-source-page.tsx` 复用同一 `HomeOwnedTankRowContent`/`HomeOwnedPetRowContent` 但仍不传 `current`。交易本方 tank/pet 候选改用自己只读的 `RoleProfile` 查询传 `current`，并叠加 draft B/N 优先合同，详 `trade-owned-row-status-presentation.md`；本 Home 文档不把旧 Home 图扩成 Trade 验收，其它页面不由此获得 N，其它状态仍不覆盖。

## 已具与边界

- 已具：原静态 source 确认原状态 3→`N`、字体 `SmallHT`、point `(5,8)`、region `ui/regions/11/10.png` 自然 `14×14`，以及确认 `RoleProfile` 的当前实例字段与名单 instance 等价判定的接线。
- 边界：本范围只登记已确认 current 这一个标记。原状态 1/2/4 的 producer/含义、其它页面状态、原 `Font::drawText` 内部字形放置/屏幕比例/色调，以及普通 UI 实测/HD/实例确认/拒绝/重开与完整 93/64 控件仍未完成，父项不勾。
- 旧 `15-04` 六 PNG 与 `15-22` 三 PNG 只覆盖新拥有名单行本身，不含本状态标识实测，不以其扩展本范围。
