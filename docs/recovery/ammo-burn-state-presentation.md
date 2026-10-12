# 2007燃烧状态与原持续表现

服务端已有2007命中后九秒燃烧状态。PlayerSnapshot.ammoBurn 只投影实际存活角色的该状态：itemId2007、skillId4005、startedAt 和 expiresAt。expiresAt 是现有重建九秒政策的时间戳；不作为原014效果节点寿命或原服务器授权的证明。

Battle 在快照与渲染资源完成后将角色列表、roomId/round 和 PLAYING 状态传给 AmmoBurnPresentation。原4005保留槽0使用014、tag0、oneShotfalse 和空间SE03 selector−1。同角色、同资源实例和同 startedAt 不重新启动。客户端不按本地计时删除燃烧状态；快照缺失、角色死亡、FINISHED、换房换局或退出均停止效果和声音。

燃烧自然完成全部周期时，domain先清状态并返回实际skillId；World仅在room仍PLAYING且目标alive/status2时复用skillStopped发送4005第二槽Effect7/SE30，index1／duration0。其他清理不补播，详remaining-effect-slot-integration.md。现有伤害、燃烧跳点、重复命中不叠加、不刷新和注射解除规则保持已有重建政策。原014无限寿命节点由正式状态缺失停止，未添加替代图片、伤害或生命周期期限。

ammo-burn-snapshot.cts 验实际 playerSnapshot 与协议编码、状态副本隔离、拒绝刷新、最后燃烧跳点后移除、显式清除、死亡和攻击者离场。ammo-burn-presentation.cts 与 ammo-burn-presentation-runtime.cts 分别验证接口与真实效果树的保留、去重和停止。普通双端画面、声音、自然到期和离房必须另由玩家证据证明。

普通玩家验证：ammo-burn-state-player-accepted.json 接受合法map7/mode4双普通账户的2007命中，两端原014三粒子节点与火焰烟完整画布、SE03实际非零输出、第三次燃烧伤害死亡后的停止及普通Leave资源归零。权威生命200→157→87→17→0，死亡发生在startedAt后的第三跳九秒边界；未独立覆盖存活到期。预房tank1/pet1与2007库存夹具明确，不作为正式取得证据。原服务器授权、完整4005槽及该表现的注射解除/终局普通验收仍开放。

工程验证：ammo-burn-home-name-final-web-build.log 统一Web类型检查与构建通过，涵盖正式燃烧接线及Home昵称入口；服务端构建和快照协议编解码沿本批独立通过证据。
