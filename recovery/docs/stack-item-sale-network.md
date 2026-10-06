# 数量出售网络范围

M6-06 / M2-02。专属tests/stack-item-sale-network.cts复用已验PartSale双账户真实库；无新增资金或拥有记录注入，普通BUY3003数量2用于取得可部分出售的库存。

专属types38972退出0，首actual70529退出1。正式Shop每次BUY建立新实例，真实回包取得instance4/owned2/battle0；旧instance3/owned1与slot1=3保持。驱动原先假定同定义自动合并，错误断言4==3，尚未发SELL。首次raw及真实checkpoint保留，finally清理完成、亲3616为空。

[首片分析](/workspace/cdtank/recovery/output/stack-item-sale-network-first-analysis.json)保留取得阶段记录。必要尾段沿首次原生保存库，用正常Kitbag把slot1指向新instance4，完成部分与完全出售；旧instance3保持。双完整players、正常Leave、原生回执及同库重启已在下述范围通过。

请求/回执、原半价和部分/完全减量合同复用[来源](/workspace/cdtank/recovery/docs/stack-item-sale-contract.md)。正数量、数学金额限幅、所有持久快捷引用清除及WAITING权限为明示Web重建，原授权与支付producer仍未知。

必要定向尾段28727退出0，沿首actual真实库存正常ASSIGN slot1到新实例4，不再购买或补资金。部分出售1份：owned2→1、battle0→min(1,BattleUseMax10)=1、slot1=4保持、money69210→69215；完全出售剩余1份：精确实例4删除、slot1清0、money69220。成功两回执result2/quantity1/price5，旧实例3全部字段保持。

两次成功均取消WAITING准备；重复部分回执不再減量/付款且保重新准备。excess/foreign/conflict/missing/PLAYING拒绝均保完整账户投影。六唯一共同PLAYING key完整players相等，双正常round1 Leave；原生两销售回执及完整inventory/profile/hotkeys与最终查询一致，实际停服同库重启双方完整QUERY一致。finally188416字节真实备份与本地0600身份文件保存、清理true且亲3616为空。

[尾段原raw](/workspace/cdtank/recovery/output/stack-item-sale-network-2026-10-05T20-30-06-265Z.json)和[组合索引](/workspace/cdtank/recovery/output/stack-item-sale-network-analysis.json)记录准确两片范围。首FAIL保留，必要尾段只语法转换，不重复专属types或取得。该代表覆盖分类2数量出售；分类1、金额上限与rollback用主任务事务夹具区分，不冒本片普通输入覆盖。

[主审](/workspace/cdtank/recovery/output/stack-item-sale-network-root-review.json)：`PASS_FINITE_STACK_ITEM_PARTIAL_FULL_SUCCESS2_HOTKEY_BATTLE_QUANTITY_DUAL_STATE_LEAVE_RESTART_SCOPE`。独立核定完整profile/records/hotkeys、六共同PLAYING players、两原生销售回执及同库重启双方完整QUERY；端口3616清空。原服务端授权、完整数值规则与全车型父项保持未完成。

[组合主审](/workspace/cdtank/recovery/output/stack-item-sale-root-review.json)：`PASS_FINITE_STACK_ITEM_WEAPON_QUANTITY_CONFIRM_PARTIAL_FULL_DUAL_STATE_RESTART_CLOSE_SCOPE`，合并本网络slice与正式网页数量确认、部分/完全出售及Close范围。
