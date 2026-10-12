# 账户来源与战斗准备配置

E-02将World的库存/角色来源/profile写入、部件表解析、换车及快捷槽确认归battle/preparation.ts。World继续查找权威玩家并核验WAITING门槛、提供原只读来源和属性投影。模块直接修改既有PlayerState，不创建缓存账户或第二份战斗状态。

库存按原方式复制记录并写七槽数组，只有WAITING重绑战斗部件；此入口本身仍允许外层既有库存刷新，不擅自扩大冻结门槛。拥有角色来源变化时标记combat dirty、取消该玩家准备，再执行原完整属性重算；来源不变时不取消准备。装备profile变化同样取消准备，并按库存拥有实例及实际目录解析部件表，只有表改变才写数组2/取消准备/重算，之后保留原装备入口再次重算的顺序。

换车仍由World验证准备阶段；战车定义变化时清拥有equipment来源，写新定义、重算、恢复既有回退生命，再取消准备。快捷槽成功确认仍只调用已恢复的assignment/cancellation规则，不补造施放、消费或准备阶段策略。原装备的归属门禁与缺失来源行为保持，不把缺数据填零作为完整来源。

## 验收

账户来源210组合、32原profile向量/装备冻结、204拥有物件分类与74原被动技能选择通过；包括相同来源/配置重绑保留准备、宠物/装饰/徽章/部件变化取消准备、战斗中拒绝来源改动、再战保留及离房重入来源。完整原属性126组与21战车开局生命/普通弹药装填通过。自然战斗治疗/账户拒绝/消耗保存、CPU9次自主施放和自然两局、五模式命中终局/冻结再战也通过。

构建/类型和201正式可达模块运行边界通过。日志engineering-battle-preparation-{build,sources,attributes,match,healing,types,boundaries}.log。编译真实账户迷彩联机重启与CPU五模式各两局也通过，单列engineering-battle-preparation-compiled.log；正常装备页面1080p/4K/资源预览/鼠标键盘操作/拒绝/隔离/刷新重启/关闭清理通过，单列engineering-battle-preparation-browser.log。

## 后续边界

普通输入接受已归battle/accept-input并验收，详见engineering-input-acceptance.md；World剩余部分只读业务投影和目标伤害写入；index仍含聊天/断线及广播tick。下一片整理房间传输与运行循环，保持断线结算/广播隔离与两局。E-02仍未完成；属性对照不等于全部原装备业务或原服务端玩法已还原。
