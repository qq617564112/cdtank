# 数量出售首联机准备

接口依赖：正式Stack/ItemSale QUERY与SELL（instanceId、quantity、requestId），完整inventory/profile/money、成功receipt result2、replayed。实际协议命名由业务主线提供；不提前伪造serviceProto。

检查点：part-sale-network-2026-10-05T20-17-18-596Z真实SQLite和原双身份。卖方money69230、3003实例3/owned1/battle0/slot1实例3；对端money86500、空Inventory。身份只本地private读取。

普通BUY3003数量2沿新requestId取得同实例堆叠3（购买政策复用，不声明原取得默认）。正常CreateJoin后WAITING，用完整QUERY核拥有3、正确单价unsigned ItemMoney半价与原slot1；普通Ready只卖方。

SELL1：原子拥有3→2，本局量重投影min(2,BattleUseMax10)=2，slot1实例3保持，回执quantity1/result2，完整money加单价。资料除余额保持；Ready取消。replay不再次减/付款，conflict、excessquantity、foreign absentinstance拒绝保资产。

SELL剩余2：整个实例删除，slot1清0，回执quantity2/result2，资料selectedtank/pet与其它字段保持。正常Ready双方，PLAYING销售拒绝；仅等待共同完整players/关键无射击状态，双正常Leave。原生2receipts、完整库存与profile对照，真实停服同库重启双方完整QUERY恢复。

不放置陷阱或重验控制/伤害/效果，不新增资金/拥有夹具，不测全部SKU组合。另一inventory类别1镜像、qty0/overflow与rollback由业务主线必要事务规则夹具覆盖；现客户端qty0不拒，正数量和数学安全金额上限需明示Web政策。执行窗口和正式接口未稳定前不开服、不运行类型。
