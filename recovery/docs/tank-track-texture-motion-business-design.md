# 战车履带 A/B 运动合同（M3-03 / M6-01）

## 采用结论

履带 A/B 的资源加载、共享相位、动作切换后的材质重应用和实例释放已经有生产 consumer；仍未恢复的是原 actor 目标空间门禁的等价来源。当前 `TankView.trackMovementTarget(x,z)` 使用重建 snapshot 坐标与 renderer 插值目标之间的水平距离大于 `f32(0.001)`，这是 Web 重建规则，不是原 `0x4660a5` 目标曲线门禁，也不是权威移动命令消费者，所以不能把它记录为原履带运动已恢复。

现行采用合同：使用现有权威 `movement.command` / `ClientTankPose.command` 作为已接受移动状态的来源；只对产生平移的命令推进共享 A/B 相位，停止和原地转向冻结相位。该规则是重建客户端对原 actor 目标门禁的业务等价采用，不把网页位移差、动作名、按键或 `moving` 布尔值当作原来源。不新增协议字段、不改普通移动数学、碰撞、炮口、HP、账户或纹理选择事务。

## 来源事实

详尽原指令执行见 [role-track-texture-sol.md](./role-track-texture-sol.md)、[role-track-spatial-sol.md](./role-track-spatial-sol.md) 和 [role-actor-global-clock-sol.md](./role-actor-global-clock-sol.md)。

| 原入口 / 字段 | 已确认合同 |
| --- | --- |
| `0x46c239 / 0x46c23f` | 四组件 actor 构造时相位索引和累计值均为 0，初始选择 A。 |
| `0x46cdb7–0x46cea2` | XY 记录加载 A、B，初始 A 同时设置给 X、Y；X/Y 没有独立相位。 |
| `0x46ce5f` | B 请求由同一 XY 请求倒数第 5 个字符改为 `B`，不是另一个材质或另一套动画。 |
| `0x4660a5` | 停止标志非零、目标缺失或目标距离达到 `f32(0.001)` 时门禁为 true；true 分支冻结履带累计与相位。 |
| `0x46e0e3` | 门禁为 false 时累加 actor delta；累计严格大于 `f32(0.1)` 时清零并切换一次索引。大 delta 只切一次，余量丢弃。 |
| `0x46cec7 / 0x46d329 / 0x46d352` | 完整 render 对 X、Y 读取同一索引，分别提交相同 A/B 纹理。 |
| `0x4670de / 0x467175` | 前进和后退入口都能建立目标运动；A/B 更新不检查方向符号。 |
| `0x46495d` | 停止入口保留累计值和相位，不自动回到 A。 |
| Type4 | 三组件 actor 使用独立字段，但共享一份 X/Y 相位，阈值和切换规则一致。 |

因此：

- X、Y 分别选择 A/B 没有来源；只能是同一相位、同一索引。
- moving UV、UV 偏移、滚动速度或另一套履带动画没有来源；来源只是所选 XY 纹理指针在 A/B 之间切换。
- A/B 切换不检查动作编号，不由待机/移动动作 01/02 驱动；动作切换只负责重应用当前相位。
- 停止不会自动切回 A，也不会清累计值；再次进入移动状态时从当前累计值和索引继续。
- 原门禁的完整生产来源仍未闭合。page snapshot 位置差与 actor 目标 setter 的对应关系未证明，因此网页位置差不能宣称为原门禁恢复。

## 当前消费者与来源边界

| 边界 | 当前实际类型 / 文件 | 当前消费者 |
| --- | --- | --- |
| 拥有三槽 | `OwnedTankTextures {U, M, XY}`，来自拥有记录 `+0x28/+0x2c/+0x30` | [role-owned-textures.ts](../../apps/shared/combat/role-owned-textures.ts) 和 arena snapshot。 |
| 面向对象命令 | `PlayerSnapshot.movement.command` | [snapshot.ts](../../apps/server/src/rooms/snapshot.ts) 投影到普通玩家快照；`movement.original`、`canMove`、`canTurn` 保留为来源边界。 |
| 本人预测命令 | `ClientTankPose.command` | [local-tank-motion.ts](../../apps/web/src/match/local-tank-motion.ts) 只在接受候选姿态后写入命令，碰撞/停止写 0。 |
| 当前相位 | `RoleTrackTextureState {elapsed, index}` | [role-track-texture.ts](../../apps/web/src/assets/tanks/role-track-texture.ts) 保留原严格阈值和单切换规则。 |
| 当前资源 | `Map<string, Texture>`，键为 `XY` / `XY-B` | [tank-textures.ts](../../apps/web/src/assets/tanks/tank-textures.ts) 按 selected XY 记录精确加载 A/B。 |
| 当前材质切换 | X/Y 组件的 `originalMV3` `ShaderMaterial.sourceTexture` | [tank-view.ts](../../apps/web/src/assets/tanks/tank-view.ts) 在动作激活和相位变化时重应用。 |
| 当前触发 | `trackMovementTarget(x,z)` 的 snapshot 水平距离 | [battle-players.ts](../../apps/web/src/render/battle-players.ts) 每帧调用；该路径明确不采用为本合同来源。 |

拥有 XY 的请求路径是 `/tank-textures.json`，按 `recordId === ids.XY`、`part === 'XY'`、`tankId === 当前坦克定义` 选择同一目录行的 `textures.A.asset` 与 `textures.B.asset`。A 加载后写入 `XY`，B 写入 `XY-B`；未选 XY 时，已转换模型带原纹理引用则由 `loadEmbeddedTrackTextures` 按原嵌入文件名的精确 basename 查同一张 XY 目录行。两种情况均不按近似文件名、旧材质名或其他战车资源寻找替代。

当前纹理由 `TankView` 实例持有，不登记到动作 `AssetContainer.textures`。动作容器释放不会释放它；实例释放会等待已启动的动作加载结束，再释放自己的全部选定纹理。不同玩家、不同拥有实例或不同选择各自创建 `TankView` 资源，切换可能只替换当前实例的 X/Y material 指针。

## 固定 Web 触发规则

### 命令到履带门禁

原运动命令表见 [role-movement-commands.md](./role-movement-commands.md)。固定映射如下：

| command | 原运动语义 | 履带相位门禁 |
| ---: | --- | --- |
| 0 | 停止 | false |
| 1 / 2 | 前进 / 后退直线运动，需要移动权限 | true |
| 3 / 4 | 原地转向，只改变朝向、不产生位移 | false |
| 5 / 6 | 前进弧线，需要移动和转向权限 | true |
| 7 / 8 | 后退弧线，需要移动和转向权限 | true |

服务端快照的 `movement.command` 和本人提交的 `ClientTankPose.command` 已经在来源端表示实际接受后的命令；命令被碰撞、权限或停止拒绝时来源写 0。消费者不得再次用 snapshot 位移差、动作 01/02、`moving` 或键盘状态覆盖该命令。`movement.canMove` / `movement.canTurn` 用来解释命令权限边界，不作为第二套逐帧纹理门禁，避免同一已接受命令因快照时刻差异闪烁。

`movement.original` 继续区分原参数路径和重建参数路径。两种路径都保留真实的已接受 command；履带 Web 采用规则使用 command，不能把该效果宣称为原目标曲线门禁已经恢复。

### 每帧状态机

每个 `TankView` 实例只维护自己的 pending 标志，使用现有命令字段，不新增 `movingUV`、`trackMoving` 或 wire 状态：

1. `BattlePlayers.render` 为每个玩家取得同一帧的权威命令：本人手动姿态使用 `localPose.command`，其他玩家使用 `player.movement?.command ?? 0`。
2. 在场景动画 tick 之前，将命令写入该 `TankView` 的履带待更新状态。固定等价条件为 `alive && !disposed && command in {1,2,5,6,7,8}`。
3. `TankView.advanceAnimations` 每个渲染帧只消费一次待更新状态。仅 pending 为 true 时调用现有 `advanceRoleTrackTexture(state, deltaSeconds)`；pending 为 false 时不累计、不切换。
4. `deltaSeconds` 保持现有重建 actor 时钟入口：`Math.fround(effectModelEngineDelta(engine.getDeltaTime() / 1000))`。不给履带单独增加 wall-clock、网络消息时间差或轨迹时间。
5. 相位索引变化时只调用现有 `applyTrackTexture()`；索引不变或 pending 为 false 时不触发特殊切换。
6. command 变为 0 或 3/4、玩家死亡、房间非 PLAYING 时 pending 写 false。累计值和索引保留；不会在停止时回 A，也不会清 `elapsed`。
7. 再次出现 1/2/5-8 时，从保留的相位和累计值继续。严格 `> f32(0.1)` 条件、`elapsed=0`、`index=(index+1)%2` 和长 delta 单次切换规则保持不变。

这条规则不改变 `TankView.motion(moving)` 对 01/02 动作的选择，不改变 `BattlePlayers.moving` 的既有用途，不改变碰撞、炮口、HP、账户或购买/确认链路。履带 A/B 是独立纹理状态，动作切换不得重新初始化它。

### 选择与生命周期

| 事件 | 固定行为 |
| --- | --- |
| 初始创建 | 新建 `TankView` 从 `{elapsed:0,index:0}` 开始，首帧使用 XY A。 |
| 同一选择换动作 | 01/02/03/05-09 激活都调用 `applyTrackTexture()` 重应用当前索引，不重置相位。 |
| 停止 / 原地转向 | 门禁 false，保留 phase 和 elapsed。 |
| 死亡 | `alive=false` 时不推进；同一实例复活后从保留状态继续。这只是当前 Web 生命周期采用，不把死亡是否调用原停止入口宣称为已证明。 |
| 换战车 / 换 XY 拥有记录 | `sameSelection` 判定身份变化，旧实例释放，新实例重新加载对应 A/B 并从 A 开始。 |
| 异步晚到 | 若加载完成后当前 snapshot 已换选择或已离开，已加载 view 与纹理释放，不把旧实例状态带入新选择。 |
| 离开房间 / 换局清场 | 已有 `TankView.dispose` 清 pending、移除 tick、等待动作加载边界并释放选定纹理；不得让动作 container 或旧材质释放借用纹理。 |

### 纹理、材质与采样

- A/B 只替换当前 X/Y 的纹理资源，不替换 U/M material，也不改变材质属性。
- 每次动作载入仍经 `applyMv3Materials` 建立该实例的原 17 参数 `ShaderMaterial`；`applyTrackTexture()` 只对 part 为 X/Y 且 `metadata.originalMV3` 存在的材质调用 `setTexture('sourceTexture', texture)`。
- 纹理 URL 为 catalog `asset` 的根路径形式 `/${asset}`；加载使用无 mipmap、`invertY=false`、`TEXTURE_LINEAR_LINEAR`。材质入口继续设置 LINEAR min/mag 与 WRAP U/V。
- 不缩放、不重排像素、不建立固定尺寸；目录中的 256×256、128×128、512×512、512×256 等原始 PNG 尺寸保持。采样限制仍属于原 D3D 上传、完整 mesh UV 和像素验收边界。
- 不设置 UV offset、UV scale、动画速度或另一层 sampler；A/B 切换不携带材质时间。

## 最小 owned 建议

1. `core` owner 修改 [role-track-texture.ts](../../apps/web/src/assets/tanks/role-track-texture.ts)：增加一个只把现有 command 映射为 `{1,2,5,6,7,8}` 的纯函数；不改变现有 `advanceRoleTrackTexture` 的阈值、归零和单切换语义。
2. `core` owner 修改 [tank-view.ts](../../apps/web/src/assets/tanks/tank-view.ts)：将 `trackMovementTarget(x,z)` 的位移触发替换为明确的 `trackMovementCommand(command)` pending 写入；保留 `applyTrackTexture()`、实例 texture map、动作重应用和 dispose 合同。方法不接收新的协议对象，不读取 `root.position`。
3. `core` owner 在 [battle-players.ts](../../apps/web/src/render/battle-players.ts) 中只替换履带命令来源：本人手动姿态使用 `localPose.command`，远端和非手动路径使用 `player.movement?.command ?? 0`；调用发生在同一帧 `view.motion` 和场景 render 之前。保留 action 01/02、collision、炮口和现有 snapshot 插值路径。该文件当前属于其他 UI 集成 lane 时，由后续 core consumer owner 串行领取，不在并行批次直接编辑。
4. shared/server owner 不新增字段：现有 `PlayerSnapshot.movement.command`、`ClientTankPose.command`、`RoleMovementMathInput['command']` 和 `OwnedTankTextures.XY` 已足够。
5. UI owner 不需要新入口。战车与迷彩页面已经使用同一三槽拥有记录和目录；本批不新建 UI、不改选择/购买/确认流程。

## 真实剩余限制

- 原 actor 目标曲线最后点的网络/命令生产链及 `0x466efb` setter 对应关系仍未闭合，因此 `command` 门禁是明确标注的 Web 业务采用，不是原 `0x4660a5` 等价证明。
- 原 QPC、时间倍率、暂停/失焦外层调度与实际 actor delta 尚未完全等价；当前只能复用页面既有 `effectModelEngineDelta` 和 float32 时钟入口。
- 死亡是否调用原停止入口、不同动作和不同 TankType 的浏览器实载、全部皮肤组合的原 D3D 像素仍待恢复。
- 本文件不新增 A/B 动画、UV 运动、左右履带独立相位或按速度连续切换规则；这些没有原来源。
- 不保证目录文件在任一部署中已存在。运行选择必须使用精确 `recordId`、`part`、`tankId` 和 `asset` 来源；非零选中的拥有 XY 记录在当前组件缺失或跨战车时必须显式失败，不能 catch 后换图、换尺寸或伪造空数组。未选择 XY 的实例沿既有 consumer 保留原材质，不新增 fallback。
