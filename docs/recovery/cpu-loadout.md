# 房主配置CPU临时库存

M1-11-L把网页CPU配置请求接到同房真实CPU的临时库存。`configureRoomCpuLoadout`仅允许当前房主真人配置同房CPU；World负责当前round及WAITING门禁。可配置最多七个独特slot2至8，slot2至4限定已交付2007/2011弹药，slot5至8限定道具1至8；数量须为1至原目录BattleUseMax的整数。完整配置全部验证后才绑定，失败保留库存、快捷槽及准备状态。成功清除真人准备并恢复CPU自动准备，[]可清空，undefined拒绝。

临时实例ID为CPU内部slot值，仅在该参与者库存范围唯一，与账户实例无关。配置拥有/本局数量相同，正常Ready仍走既有BattleUseMax初始化。配置不从房主账户领用、不写数据库、不改变角色或HP；正面道具/燃烧等战斗使用沿已交付普通输入授权模块。

`confirmBattleItemConsumption`只确认当前消费，不减量。真实CPU必须匹配实际库存实例/表ID、正expectedOwned且与现拥有量相等、本局量正，成功绕过账户持久回调；之后原道具模块才各减数量。真人包括本人托管继续调用既有persist CAS；缺player拒绝。此区分修复真实CPU没有认证账户却被全局账户CAS回调拒绝的问题，不为真人跳过持久存储。

`manageRoomCpu`新增CONFIGURE分支和末参数loadout，ADD/REMOVE仍保留原路径。World/API传递当前round和完整配置；两处正式物品消费入口共用确认模块，账户持久回调保留。ReqCpu追加CONFIGURE/loadout，PlayerSnapshot追加cpuLoadout并生成TSRPC协议。

React正式等待页仅向房主显示每个CPU的配置组件。BattleMatch持有请求忙碌与拒绝状态，组件持有草稿，权威余量来自独立等待快照projection；Battle发送认证Cpu请求，页面不改库存。等待projection仅保留名单、准备和配置等界面语义，不引入逐帧坐标。正式等待dialog沿viewport高度约束滚动，展开配置后后续槽和确认按钮均可由普通鼠标到达。

首次必要 `npx tsx tests/cpu-loadout.cts` 通过：房主/同房CPU门禁，重复/错误槽/类别/数量/undefined完整失败原子性，[]clear、准备状态、HP与房主库存保持，helper实际CPU确认不减量、数量失配/空量拒绝及真人persistfalse保留；真实公共World CONFIGURE→普通CPU自主2007 fire/有限消费且全局账户回调为false仍成功，临时库存从1到0、账户回调零次、PLAYING配置拒绝、Leave清房。短验未注入运行HP、位置、burn、伤害或事件。

证据 `recovery/output/cpu-loadout.json/.log`。实际双网页正常配置与其他道具自然使用由独立业务验收，当前短验不替代网页闭环或全部道具实战。
