# 地图18的obj05424场景物件

`apps/server/src/battle/environment.ts`为模式4、地图18创建34个原`SYcScnObjBreach`实例：18个`obj05424`木箱和16个`obj05442`油桶。身份使用`ENV:`加原placement ID，位置保留原matrix的平移量，碰撞使用该实例的完整matrix和bounds。200点生命是重建政策。

`damageSceneObject`只接受PLAYING阶段、有限正伤害及仍有生命的目标。每次命中按实际扣除的生命发出`sceneObjectHit`；生命归零时记录服务端时间并且只发出一次`sceneObjectDestroyed`。溢出伤害不会产生负生命，重复命中已毁物件不再产生事件。场景物件独立于玩法目标，不增加玩家击杀、目标数或分数。

`syncSceneObjectCollision`使用独立WeakMap管理每个房间Battlefield的动态OBB和NAV覆盖。毁坏后保留完整源包围体，服务端时间严格超过`destroyedAt + 2000`才释放碰撞与导航占用；这与既有breach的淡出重建政策一致。`resetSceneObjectCollision`仅清理本模块的覆盖；新一局重新创建满生命物件并同步，不遗留上一局碰撞或毁坏时间。

## 验收

`npx tsx tests/environment-objects.cts`通过。专项测试直接使用地图18的34个原实例及真实房间Battlefield，覆盖原身份/位置、所有实例的OBB/NAV占用、连续伤害和溢出、重复毁坏拒绝、非法伤害和阶段拒绝、严格2000ms淡出边界、源NAV恢复、房间隔离、清空集合以及新局重置。测试同时确认独立房间与共享缓存场地不被污染，玩家分数和目标统计不变。

## 验收范围

HP、服务端淡出调度和动态OBB/NAV覆盖属于明确的重建规则。原NAV内核尚未完整恢复，专项不证明原碰撞规则、联机广播或网页显示。普通玩家弹道接线和生命周期由下述World专项覆盖。

## 普通输入与弹道闭环

`npx tsx tests/environment-projectiles.cts`通过真实地图18源OBB的最近命中专项：环境OBB与自身动态碰撞同距离时只扣量一次，前方玩家、原墙面或玩法目标先命中时不命中后方木箱，木箱在前时不命中后方玩家或目标，原地形发出单次障碍事件。毁坏后的2000ms边界仍阻挡弹丸，超过边界才放行。其显式弹道竞争fixture证据记录在`recovery/output/environment-projectiles.json`。

`npx tsx tests/environment-world.cts`通过普通输入单木箱闭环。模式4地图18两名真人、30秒截止和模拟时钟，首位玩家从原spawn以普通`updateInput`移动、转炮塔瞄准placement87并持续射击，实际扣量合计200、破坏事件一次、玩家分数/击杀/玩法目标数保持0。源坐标仅供路线与瞄准规划，实际房间场地只读观察；没有注入位置、生命、事件或胜负。毁坏后2000ms仍占用真实OBB/NAV，2050ms释放；自然TIME_LIMIT结算后再战恢复18个满生命物件和原占用，两名真人离房清除场地覆盖。证据含起点、实际射击位置、命中事件、结束快照和生命周期结果，记录在`recovery/output/environment-world.json`。

`npx tsx tests/environment-world-collision.cts`通过普通输入实际通行专项。首位玩家从原spawn正常转向、前进，抵达placement87前的`(576.03, -470.72)`后连续20个前进tick位置不再变化。普通射击毁箱后继续前进，在完整2000ms淡出内仍停在原位置；淡出结束后继续前进，玩家实际进入原源OBB，随后到达其另一侧。120秒自然TIME_LIMIT后再战，再次普通转向、前进，恢复阻挡的位置仍为`(576.03, -470.72)`。全过程只用`updateInput`及正常步进推进模拟时钟；证据`recovery/output/environment-world-collision.json`记录每个tick的输入阶段、时间、位置、朝向和物件生命，并以原OBB检测实际进入。

## 原油桶正式业务扩展

`createSceneObjects`保留木箱资格并纳入原05442，复用独立ENV身份、HP/伤害、一次事件、碰撞淡出与再战生命周期，不放入玩法目标或给予环境积分。油桶200HP和现弹丸伤害为重建；没有原范围伤害依据，未按外观新增范围伤害。

`environment-world.cts 43`与`environment-world-collision.cts 43`通过普通输入源桶射击与完整受阻/淡出/穿越/自然再战/离房。新增邻近油桶后，旧木箱穿越测试不再要求目标之外100单位全无障碍，改为严格进入并从已毁源OBB对侧退出；仍完整保留源碰撞、淡出受阻和再战恢复断言，新增邻桶保持实体。原失败日志保留，木箱/桶相关复验通过。`autopilot-match.cts 4 18`实际地图18 CPU与玩家托管连续两局通过，无位置/生命/胜负注入。独立网页source43实绘/声音/lifecycle范围见scene-breach-0018-05442.md与专属证据，未用World替代网页验收。
