# 捕兽夹3003首次真实购买与移动许可

对应FUNC-03、FUNC-12、M2-03。索引 `tank-purchased-trap-restraint-player-accepted.json`，普通网络入口 `tests/tank-purchased-trap-restraint-network.cts`，既有原始记录 `tank-purchased-trap-restraint-network-2026-10-05T01-37-14-377Z.json` 保持FAIL。该记录完成全部对局断言与两次正常Leave，末尾持久断言误检查hotkeys[1]；API槽1实际对应array0。`tests/tank-purchased-trap-restraint-analysis.py` 对同一raw和原生SQLite备份只读核验，分析结果PASS有限业务，不生成第二场对局或改写raw状态。

## 正式路径与测量

两空新Account，零拥有/库存，仅开局资金profile100000；各经TankShop BUY3、PetShop BUY2与SelectRole。本人Shop BUY3003×2、Kitbag槽1，普通PlayerInput useItem2实际放置；本人普通前进撤离，另一玩家普通车体转向与前进进入。服务端发布真实ground ID/owner/model3003/位置/期限，敌接触后地面对象消失、4001与直行许可计数0投影出现。普通开火仍发布2001事件，目标HP全程700。脚本使用正式玩家输入语义，不计为新增网页键盘验收。

| 普通输入段 | 模拟时间 | 实际结果 |
| --- | --- | --- |
| 前进、倒退、前进加车体转向 | 各0.25秒/5 tick差 | 位移0；组合车体角度0 |
| 原地车体转向 | 0.25秒 | 0.1702弧度，位移0 |
| 独立炮塔加普通开火 | 0.25秒 | 炮塔0.1702弧度，位移0，2001正式fire |
| 到期后倒退 | 0.25秒 | 32.496538世界距离，129.986153/模拟秒 |

实际购入tank3/pet2字段、+34=0、真实装备字段与2001当前技能源经同一readRoleSkillSources/recomputeQualifiedRoleMovement得到speed130、turn0.6806783676弧度/秒。没有将所选宠物当boundGear，未填车型最终常量。快照角度保留现协议精度，0.25秒转角与原公式差约0.00003041弧度；恢复速度差约−0.013847/模拟秒。

权威expiresAt1791164244520、应用时标1791164239520，差5000ms。实际active tick50–149全部投影相同期限/计数0且serverTime小于期限；最后active时间1791164244502。首个期限后tick150/time1791164244553无作用状态，结束事件value1；模拟tick差100即5秒，server超出期限33ms。完整snapshotTimes/eventTimes分别保存模拟tick、serverTime和接收墙钟；33ms是本次首合格tick的实际延迟，不称严格墙钟5秒或原时间单位已证。

157共同PLAYING tick的全players与groundTraps双同，Leave前7项完整事件双同。购买量2、正常消费后1，两次正常Leave及服务/临时目录清理完成。服务正常停止后原生VACUUM备份只读确认item3003 instance3 ownedQuantity1、state0、battleQuantity0、SQL槽1→3；battle0是离房后的保存状态，下一次开局数量初始化不属本片。数据库与身份文件均0600，身份令牌不放入公开证据。FX可复制此合法购买checkpoint并复用账户，无需重新赠拥有记录或重验购买。

## 来源与未完成范围

原直接来源：item3003 class4/技能3003/D3=3003；3003 Func12.T30/X30/Y4001/Z3003，4001 Func3.T5；原flag9计数与命令1/2、3/4、5–8门禁；统一运动公式/f32时序。完整地址及原32观察者条件见trap-function-entry-source.md，局部规则13条件见trap-restraint-contract.md，均直接复用。

重建：正价购买及拥有初值、Func12参数解释为30server秒/半径30/作用4001/模型3003，Func3.T解释为5server秒；当前点放置、敌人过滤、单次触发消失、每夹扣一个许可及存活到期currentCount+1。原服务端对象producer、时基、授权、恢复与叠加语义未恢复；原Windows客户端行为测量本片无新增。

仅证明当前真实tank3/pet2、一次敌接触/正常期限恢复。地面30秒自然失效、死亡/终局/再战清理、存活ground的ownerLeave、重叠或队友实际范围未验；本片没有图像、声音、全部配装或全部Func3/12验收。生命/攻防不改，M2-03/FUNC-03/FUNC-12/M4-10父项保持未完成。生产接线归root；数值线只修改专属runner、分析、来源与文档。
