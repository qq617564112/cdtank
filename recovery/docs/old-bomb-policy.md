# 古老炸弹3001 Web业务政策

M4-10/FUNC-13/FUNC-15/FUNC-02。来源见 old-bomb-numeric-source-contract.md；原Func13/15/2执行器与X30用途仍缺。以下为正式Web重建政策。

玩家从已保存账户普通Shop BUY3001（原MONEY20，TOKENS按现商城合同）及Kitbag配置开始，原快捷槽输入placeTrap。PLAYING/alive/status2、本人真实库存owned与battle quantity均正才允许；持久CAS成功扣一次有限数量并在本人当前地面点生成独立groundTraps对象。保存失败不扣、不生成；不补拥有或battle库存。

源3001→3009→3012：T5解释固定5000服务器毫秒；200×200解释XZ轴对齐方形，中心差abs(dx)、abs(dz)均≤100包含边界。到期移除对象、仅一次爆炸；不因接触提前触发。当前同房alive/status2敌对非本人角色才是目标；mode≤3同team始终排除，现无敌期限未过则拒绝生命作用。3001 X30用途未证，不参与新公式。目标判定不对地图物件或基地扩展。

末端3012直接HP减300，沿现整数生命及统一死亡/模式结算；不走弹药Critical、facet/饮料防御、抵消或HP吸收，不生成shotPlayerResult。既有10441首次HP0持续阶段正常生效，重复命中不重设阶段。命中记录一条hit/skill3012公布300；命中分沿现hitScore，最终kill与destroyScore沿统一死亡链。

对象归属固定放置者id/team；放置者自然死亡后对象仍到期。放置者Leave、FINISHED、newround清对象，无数量退款；现普通扫把按原skill12 Range400范围可扫未到期3001。到期先移除；若某目标结算导致FINISHED，停止后续目标且不恢复已清对象。

表现合同：GroundTrapSnapshot itemTableId/modelId联合新增3001，其他字段不变；正式地面模型使用原03001资源，yaw0/scale1为重建transform。成功放置trapPlaced skill3001，正式playSkillEffect首槽、roleId0、本人XZ float bits；到期一次trapTriggered skill3009，首槽、roleId0、对象XZ float bits；末端hit不额外效果/声音。通知映射为Websender，不能证明原Func13 sender。

root owns Shop白名单、shared snapshot/schema、battle/items/old-bomb.ts、ground-traps、sweep资格、life directHP入口及World死亡提交；Numeric owns roles/old-bomb-blast-rule.ts和纯规则/普通网络driver/source文档；UI owns普通网页购买/Kitbag/放置与双端状态/退出验收；FX owns原03001地面资源消费者及既有3001/3009世界效果通知兼容/实际绘制声音验收。共享文件ground-traps-presentation.ts由FX本slice接新增visual/type；Battle入口保持root所有权。

完成条件：普通BUY/Kitbag→一次合法放置与有限库存扣除→到期前无生命作用→≥5s唯一爆炸/范围内敌方-300/双端完整snapshot与事件→对象释放/正常双Leave→完整原生库存、Kitbag、receipt/同库stop-start恢复；网页正常操作及原模型/3001与3009效果真实消费者、数量及Close。拒绝、范围与self/friendly/immune、自然owner死亡/Leave/FINISHED/newround/sweep及10441组合由必要工程验收覆盖。本片不重旧三种接触陷阱矩阵，原producer/全部技能范围及高清父保持开放。

有限实际验收已由 old-bomb-root-review.json 与 old-bomb-browser-root-review.json确认：普通取得、配置、一次定时直接伤害、双端原资源绘制及静默、数量消费、正常退出、完整原生保存与同库服务重启。dedicated network仅取得/移动有限范围，实际闭环证据来自正式双网页。原执行器、X30与完整高清精度仍未完成。
