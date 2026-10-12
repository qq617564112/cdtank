# 0007 团队环境物件

正式合法团队模式1与擒王模式3的地图0007，原 obj05466、obj05467、obj05468 共10个场景实例进入独立 `SceneObjectSnapshot`。源身份、位置、旋转和完整模型包围来自原场景记录；三个原破损模型与GA13消费者复用0021同型号来源。

`battle/environment.ts` 负责地图资格、损伤与碰撞，既有 World 首局/再战构造、房间快照、弹丸最近OBB和近身炮口分派复用。普通开火由服务端判定，事件为 sceneObjectHit/sceneObjectDestroyed；ENV与玩法 objectives 分开，不增加击杀、目标数、环境分或终局条件。

Battle 既有快照消费者将 ENV 与模式目标交给 ScenePreview；sceneObjectDestroyed 只按权威实例播放原物件位置GA13。独立0007破损库进入标准场景导出，不依赖验证入口。首次切原c9、原轨道动画及渐隐、晚到快照补偿、再战完整模型恢复、声音去重和离场清理沿原消费者。

## 规则边界

200HP、现弹丸伤害和渐隐期间保留完整OBB、严格超过2000毫秒释放碰撞沿现有重建环境规则。原服务端HP、模式物件授权、原导航覆盖收集内核与计分/终局来源未恢复。0007其余型号未接入本轮破坏，不把三型号接入称作整地图恢复。

## 检查

environment07-objects.json/log验证合法mode1/3资格、10原实例/三个型号4/3/3、原坐标、单房损伤、无环境分、重复和阶段拒绝、严格碰撞边界及恢复。该检查是模块范围，不代替普通输入或实际网页。

旧0018资格与环境最近命中回归分别为 environment07-map18-regression.log、environment07-projectiles-regression.log；修改侧服务端类型为 environment07-server-types.log。正式网络与原资源实际表现记录在专属验收文档中。

本轮真实网络 environment07-network.json、双网页源表现 scene-breach07-actual.json 和物理通行 scene-breach07-passage-actual.json联合验收通过，实际范围为模式1。普通W完整受阻、19段渐隐heldW受阻、2018ms释放后进入原OBB并对侧退出，随后离场资源归零。自然CPU托管两局与再战为 environment07-autopilot-team-mode1.json。mode3/map7托管移动断言及关闭新ENV后的baseline同失败，保留M2-03未完成，不声称mode3两局通过。

本轮两端独立构建和354模块边界通过，复用 environment07-waiting-frame-build-{web,server}.log 与 -boundaries.log；Web构建2分20秒。测试证据名前缀可由 autopilot-match.cts第四参数指定，专项不覆盖历史完整基线。
