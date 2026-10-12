# 地雷3002接触生命 Web政策

M2-01/M4-10/FUNC-12。原3002与4023字段见mine3002-source-proposal.md及mine3002-source-preparation.json。普通Shop MONEY20购买3002，Home Weapon配置槽1–3，原Digit2–4输入placeTrap；正式库存CAS成功才扣数量并在本人当前位置生成对象。

采用既有Func12 Web解释：T30为30服务器秒寿命，X30为XZ圆接触半径30，闭边界。到期先移除；存续期只接受非本人、mode≤3非同队、alive/status2、HP>0且非免疫目标。首个合法接触者触发一次并移除对象，原4023 HP−300进入既有直接生命伤害与最终死亡入口，不套普通弹药critical、装甲、增伤、吸收或反击。目标10441阶段及最终死亡计分沿统一生命入口。

正式效果通知沿现Func12陷阱角色分支：放置3002的roleId为owner数字ID，接触4023的roleId为target数字ID，effectIndex0/duration0/xBits0/zBits0。既有attached效果消费者处理原010/008及具名SE02/SE31空间声音；角色sender映射为Web接线规则，原caller未恢复。

放置者死亡不移除对象，原归属保持；放置者Leave、房间FINISHED、新round及普通扫把现400范围移除。没有库存、非PLAYING或施放资格失败不扣数量、不生成对象。对象清理不返还库存，新round仅按现库存初始化battleQuantity。

root owns shop-catalog、items/contact-mine.ts原source provider及单接触调度、ground-traps、World统一直接生命调用、shared GroundTrap literal与sweep类型。Numeric owns roles/contact-mine-numbers.ts的readContactMineNumbers(durationSeconds,triggerRadius,hpDelta)，只返回durationMs、triggerRadius、damage，由provider传原T30/X30/HP−300；以及原数字合同和普通网络取得/接触/数量/保存验收。UI owns正常Shop/Home/原快捷键、实际接触伤害/双网页退出验收。FX owns3002原模型与具名正式3002/4023效果消费者。

完成条件：普通BUY/Kitbag→普通本人放置和敌方移动接触→唯一4023直接300、仅接触者生命变化/单次对象移除→双端同键完整快照与网页各自tick→实际原模型/效果消费者→数量保存、原双Leave/HomeClose、完整原生及同DB重启查询相等。工程覆盖无库存/同队/self/immune/到期、单次触发及致死入口。不得注入活跃位置、生命、事件或随机结果。

原Func12/Func2调度、Range80用途、原几何与完整精度尚未恢复；以上时间/圆接触/生命周期是明确Web规则。当前为下一交付登记，生产与真实验收尚未完成。

正式有限验收：contact-mine-root-review.json与contact-mine-browser-root-review.json。普通购买20及消费独立引用first有限审，尾段只配置剩余19并在新普通房接触消费。双端原模型、附着010/008及SE02/SE31实际绘制播放、正常退出、完整原生与同库重启均通过；原producer/Range80/pixel/HD及完整父范围保留。
