# UMsgSkBomb 原执行接收入口

原listener注册 `488a2b–488a5d` 将 `486a09` 绑定为UMsgSkBomb，listener虚表5c9f68的type getter4891cd返回0x416f。消息虚表5ca280对应reader488175、writer4891fc，factory489123调用constructor48916f创建0x24字节对象。该来源独立于普通PlaySkillEffect，不混同原技能13的既有world通知。

完整 `486a09–486b47` 已执行五种消息组合：空点数组、首效果槽单点、第二效果槽三点、效果0和技能缺失。原函数读取message+c技能ID、+10从0起效果槽、+14点vector；每点为两个float32 X/Z，占8字节。`413c65→411068` 查技能，读取skill+70+4×槽选择效果ID，格式化 `_root\online\%03d`。技能缺失、Effect=0或空数组无效果调用。

`417b49` 由vector begin/end差除8取得点数。每个坐标经原 `57bb64` 转signed integer，向零截断，例如12.75/−9.5→12/−9、−3.9/7.99→−3/7。随后world virtual+1c采样三维位置；效果使用采样X/Z，但Y明确写0。`45afc2` 接收到flag1。此处点坐标单位就是scene采样接口的整数坐标，未知发送者如何将玩家世界位置转换为点数组，不能补比例或炮口偏移。

| 类别 | 合同 |
| --- | --- |
| 原配置/反汇编直接确认 | listener/type/vtable与字段偏移；完整callback的点vector、效果选择、坐标转换与世界提交 |
| 原执行验证 | `skill-bomb-entry-native.json`五完整callback组合；原417b49/57bb64实际执行。供给技能表查找、格式化、scene采样、世界效果与字符串释放边界 |
| 原客户端行为测量 | 未新增原Windows行为测量，不称原framebuffer或实时误差 |
| 重建服务端规则 | 本片未新增权威发射/陷阱/轰炸政策或生产代码 |

该callback不读skill FuncType、没有目标HP写入、trap分配或库存消费。因此它是已定位的世界效果执行入口，不能当作Func3权威执行器，不能仅凭名称推为Func16原完整轰炸业务。下一精确来源为0x416f发送者/点数组填充及其实际技能触发资格；现0x416f工厂/codec为接收合同，不证明原服务端producer。

专属脚本 `recovery/evidence/skills/skill-bomb-entry-native.py` 及同名output/json/log；本检查检测原receiver是否使用浮点直接坐标、不同效果槽或采样Y。若出现这些分歧，应修正坐标和消息消费者合同；五组合PASS当前证明向零截断、采样XZ与Y0。未执行联机、效果渲染或旧native重跑，不关闭原功能父项。
