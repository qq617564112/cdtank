# 软木塞3005的开火许可入口

FUNC-05/FUNC-12/M2-02。原item3005→skill3005 Func12(T30/X30/Y4003/Z3005)→skill4003 Func5(T5)来源直接读取，完整字段及recordId为 `trap-fire-restraint-source.json`。原代码执行证据复用permission-trap-observer-source，不重120条件或其他native。

flag11是record+127的uint8许可计数，role+36b为观察者缓存。42f68d–42f6ed在HP getter15>0、old≠new且new0或old=new+1时经4886aa提交skill4003/duration0，没有flag6门禁。原435499先检查flag11，继而比较float32开火deadline。正式actors.ts已通过同一个isRoleFireReady在接受fire/弹药消费前读取实际flag11；该消费者是已确认入口，不用临时新开火策略替代。

原431dbf写入非零为byte加1、零为清byte并通知33；它不是已恢复的Func5减量producer。原Func12/5地面触发、计数减少及期限恢复的写地址尚未取得，具体下一入口是3005地面触发→4003 dispatcher与属性33数组11发送者。表T30/T5、X30不自行声明为秒或半径。原客户端行为测量本轮无新增。

纯模块 `apps/server/src/battle/items/trap-fire-restraint.ts` 提供read/apply/expire/reset/clearTrapFireRestraint与显式readFirePermissionCount/writeFirePermissionCount provider。采用明示重建：地面30秒、XZ半径30、束缚5服务秒；存活status2且计数>0时移除一份uint8许可，不叠加/不刷新。自然期限或提前clear按当前count加自己的贡献1并&255，失活/reset丢弃贡献。模块不写HP、槽位、移动或转向许可。

`trap-fire-restraint-rules.json` 的12个新增局部条件通过：原flag11/f32 deadline消费者禁止及到期恢复、重复调用、当前贡献恢复/uint8回绕、缺源拒绝及失活reset。`trap-sweep-cork-rules.json`仅新增3005选择资格、400边界/期限/Y忽略/引用保持通过。以上不证明正式CAS、对局或声画。

原03005.POL/03005A.dds对应已转换 `web-assets/Data/scnobj/03005/03005.glb`：一个cylinder02/0网格，132个POSITION/NORMAL/UV/COLOR顶点，内嵌PNG，03005A.tga材质；静态资格不替代实际draw。原skill4003首效果118/GA20，第二16/SE15。生产协议/ground/Shop/World/注射由主线集成；普通购买接触与禁射恢复证据见 `trap-fire-restraint-player-evidence.json`。完整原函数/全部陷阱父项保持未完成。

## 正式普通玩家首验

`tests/tank-purchased-trap-fire-network.cts` / `tank-purchased-trap-fire-network-2026-10-05T03-41-09-883Z.json` 通过限定scope。复用原生真实BUY3/pet2角色checkpoint，正式BUY3005×2/槽1/普通放置与敌方接触；未导入活跃状态或赠拥有库存。实际所选来源统一公式给speed130、turn0.6806783676rad/s，+34购入初始化仍是重建。

禁射期间普通fire无事件、弹匣7/7不扣，前进/倒退各0.25模拟秒走32.50404，实测130.01618；车体和方向键独立炮塔各0.25模拟秒转0.1702rad。forward服务0.251秒/墙钟0.243秒，reverse0.251/0.251，body与aim均0.252/0.252。HP不变。

状态在tick50–149有效，tick150自然移除；模拟5秒，准确期限为服务时间+5000ms，首次到期tick晚44ms，触发至结束墙钟5.044秒。freshfire恢复后扣至6/7。157共同完整players与ground同步、7个Leave前事件双同、双round1 Leave成功。服务停止后原生库存3005余1及slot1绑定正确，SQLite完整backup/私有身份0600供主线独立同库restart；本片不冒重启、注射/AI、118GA20或全部原Func5恢复。
