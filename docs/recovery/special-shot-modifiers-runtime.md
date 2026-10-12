# 粒子炮弹/火箭炮弹射击修饰运行时

本文记录 `skill2022/2023` 的服务端接线范围。业务规则与原事实见
`special-ammo-2022-2023-business-design.md`。

## 权威重算链

| 层 | 入口 | 行为 |
| --- | --- | --- |
| 来源 | `apps/server/src/battle/attributes.ts` | 对已有 `RoleSkillSources` 调用 `resolveSelectedShotModifiers`，不读取全部目录技能或物品候选。 |
| 选择 | `apps/server/src/battle/roles/shot-modifiers.ts` | 复用 `selectRoleSkills` 的顺序、16槽重复、被动筛选和真实 item 展开；输出 `penetratesObstacles` 与 `rangePercent`。 |
| 状态 | `apps/server/src/battle/player-state.ts` | 角色内部最小 `shotModifiers`。每次 `recomputeBattleAttributes` 先清除，再由当前已选来源重建。 |
| 查询 | `apps/server/src/battle/shot-query.ts` | 可选 `closestPlayer/range/ignoreObstruction`。未传选项时保持原 sphere、遮挡和1000默认。 |
| 目标 | `apps/server/src/battle/roles/shot-target.ts` | free/scene 端点可接受有效总射程；未传范围时保持1000。 |
| 开火 | `apps/server/src/battle/projectiles.ts` | 把权威修饰作为 query options 传入；ordinary 保留原参数含义，FuncType22 走当前 direct 单目标分支，FuncType23 同步查询与实际可达距离。 |

`currentAmmoTableId` 仍只表示确认后的真实弹药。修饰不搬 item ID，不创建 item2022/2023，也不改变
World 的 ammo/consume/reload 时序。普通2001的 pending 0.4秒和 `beforeShot` 顺序保持原样。
实际融合版把 `itemId===2001` 的真实 ordinary 布尔与修饰 options 分别传入 query：ordinary 只保留
普通 XZ strip，贯穿由 options 决定，未修饰弹种不带 truthy options。

## FuncType22

`penetratesObstacles` 为真时，query 忽略静态/scene/crush surface，使用普通源 XZ strip 的
half-width25与最近非自己存活角色。目标选中后由既有 `hitPlayer` 处理伤害、分面、暴击、友军和
免伤链；一次射击最多一个目标。没有目标时沿用 free/scene 结果。该忽略只存在于 query，不修改
movement/collision 地图。

FuncType22 与普通2001共用当前 direct 单目标边界；未新增延迟、多段、`pendingShot` 或房间在途数组。
两者在 World 共用同一普通 ammo 命中入口：只有本房 `PLAYING`、目标有效且前后 hp 真正下降且仍存活
时才启动2007燃烧/2008减速。direct 回调保留分面/Critical/友军/免伤/死亡链，连续弹丸回调复用同一
后效资格，不新增2022/2023 item 或事件，也不改3012/grounddirect。

## FuncType23

`rangePercent` 默认100，FuncType23 X200采用为200。普通 query/free 射程1000按比例转换成2000；
增程连续 bullet 记 `remainingDistance = range - 30`，即从中心总射程扣掉炮口前移距离，每步取
`min(stepDistance, remainingDistance)`，末步截到真实中心端点并先 sweep 检测再移除，使 query/free
端点与弹丸终点同一位置。没有 FuncType23 时 ttl 保持2.2秒，现有非2001弹种路径不改；未修饰弹种
不带 `remainingDistance`，行为与原 ttl 一致。重复同技能不叠加，多项只采用第一项 X。

源 `Delay/LoadTime/MaxBullet` 仍由 `recomputeAmmo` 读取，source reload 不另建时钟。修饰不产生
新 `shotPlayerResult.itemId`、效果或声音。

## 生命周期与未恢复范围

`shotModifiers` 是内部可重算状态，不进入 snapshot 或协议；删除技能、换装或下一次权威重算会清除
旧值，未选时不保留零填 owned 数据。当前 item2022/2023 通过普通商城和有限弹药配置进入已选来源，采用规则见
radar-ammo-sources-runtime.md；原服务端授予规则仍未取得。原 FuncType22/23 服务端执行器和原始 X 单位也未恢复。

本批一次集中 gpt-5.6 走查覆盖 Func22/23 与空袭，三处真实 finding（query options 参数位、direct
命中后效、Func23 端点一致性）已按上述最终实现修复。实际双端施放/绘声/生命周期/重连、2022/2023
采用取得链与原始 X 单位父项仍未验收。

本批未运行 unit test、浏览器、构建、类型检查、lint、exporter、native 或生成器实测。

普通已消费射击在接受时保存穿障和射程修饰，400ms待发时改选弹药不改变该发效果。有限弹药最后一发完成后回默认弹，重算清理耗尽技能及旧修饰。
