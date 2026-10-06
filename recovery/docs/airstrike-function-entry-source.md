# 道具13空袭的执行入口边界

FUNC-16/FUNC-15与M4-10。原道具13售价40金币/20软星币、每局最多1，首技能13。skill13的Trigger1/Target1/Range200、Func16(T0/X20/Y3013/Z0)直接来自原表；skill3013为Target4/Range200、Func15(T0/X0/Y3012/Z0)，skill3012为Func2。原表引用链已确认，X20的单位、数量语义及调度尚未确认。

来源索引 `recovery/output/airstrike-function-entry-source.json` 保留原recordId、列号、完整物品记录和三技能字段；专属脚本 `recovery/evidence/skills/airstrike-function-entry-source.py` 只读取原表和三个已定位指令区间，复用既有同偏移候选及接收器证据，不执行原native或全指令扫描。

| 字段或入口 | 已确认读写与调用链 | 未确认写入及下一入口 |
| --- | --- | --- |
| Func三槽 | 43aee9–43af57表加载器写skill+158/+164/+170/+17c/+188，槽步长4字节 | 缺持有skill13/3013实际身份的Func16/15执行分派；既有同偏移候选不能证明身份 |
| 被动筛选 | 432b29读Trigger+2c、FuncType三槽及T=ffff，筛选type1 | 该入口不执行Func16/15，不提供主动施放时序 |
| UMsgSkBomb | type416f→listener486a09；message+c技能、+10效果槽、+14八字节float32 XZ点数组→skill+70效果→向零截断→世界采样→45afc2；提交Y=0 | 缺416f发送者和点vector写入地址；下一查实际发送者构造+14点数组的资格、数量及位置来源 |
| 3013→3012生命作用 | 原表FuncY1引用3012/Func2 | 原HP写入地址未确认；下一为权威Func15对子技能的目标调用，不能从世界效果推出伤害 |

原客户端行为测量本轮无新增。原接收器的坐标合同复用 `skill-bomb-entry-native.json`，不证明发送端比例、半径单位或原实时调度。原服务端缺失部分未制定新规则：不将X20解释为20次、不从模型寿命推轰炸间隔、不把HP或显示攻击力直接套作最终伤害。现证据不足以开放正式购买消费空袭；FUNC16/15及完整父项保持未完成。本次单轮缺失入口已保存，同入口不继续重复扫描。
