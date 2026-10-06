# 拥有角色出售网络范围

M6-06。专属tests/owned-role-sale-network.cts使用pet-learning-network-19-06-05合法保存库临时副本、两正常身份和编译scripts/start-server.mjs。没有新增资金或拥有记录夹具；源库已有Point夹具只作为既有保存历史，不声明赚取点数。

正常BUY Pet2与Tank52、正常选择后分别拒绝出售，再正常重选各自保留角色。Pet在WAITING按原PetMoney3500半价1750出售；Tank在PLAYING被拒，双正常round1 Leave后按原TankMoney4000半价2000出售。价格断言独立于BUY normalized价格。两次成功验证完整owned/profile余额回包，重复request不再次支付，冲突request、缺失和外方实例均拒绝且资产不变。

同一房间保存两端完整players、phase/round/tick及events，以共同key比较；没有射击或主动伤害输入。结束后原生SQLite核两条出售回执、完整拥有记录和资料bytes，实际停服并同库重启核双方完整QUERY恢复。finally保真实checkpoint与0600身份文件，再清临时库和服务器。

[原客户端合同](owned-role-sale-contract.md)复用，不重价格loader/native、Trade或旧购买矩阵。原服务器授权/原子出售/持久仍为明示Web重建；本驱动不验证余额上限夹具、所有车型/宠物或绘声。

首actual9055退出1，raw19-46-39-274Z与真实checkpoint保留。已完成真实购买、双selected拒绝、Pet出售1750与replay/conflict/missing/foreign拒绝、PLAYING非selected Tank禁售。6个共同PLAYING tick1..6完整players相等；WAITING同tick0有入房前后两种状态，phase/tick不能唯一识别广播。正常Leave、Tank出售、原生完整终点和重启尚未执行，首片不作完整网络验收。有限观察见[首片分析](../output/owned-role-sale-network-first-analysis.json)。

必要定向尾段78611实际退出0，raw19-48-41-515Z复用首实际checkpoint，不重复取得与Pet出售。基线余额88230和完整拥有记录与首回包相等。正常Select/new CreateJoin/Ready得到6共同唯一PLAYING观察，完整双players相等；双round1 Leave后Tank实例5出售2000，完整余额90230，重放不再次支付。原生SQLite总计2条销售回执，完整owned/profile与最终QUERY一致；实际停止编译server并同库重启，两账户QUERY完整恢复。finally保存155648字节真实checkpoint及0600身份文件，清理成功并亲3609为空。

[组合有限索引](../output/owned-role-sale-network-analysis.json)分别列明首片和尾段实际范围。targettypes27235退出0；尾段只做必要语法转换，无共享工程检查重复。新房间证明正常入场与退出，不称恢复首房间。

[独立主审](../output/owned-role-sale-network-root-review.json)已接受PASS_FINITE_OWNED_PET_TANK_SALE_SELECTED_REJECT_DUAL_STATE_LEAVE_RESTART_SCOPE：两片各6共同PLAYING完整players、两种成功价与拒绝不写状态、双Leave、2销售回执及双账户完整重启查询均已独立核验。此范围不关闭原服务器授权/完整商城与全角色父项。
