# FUNC08 伪装执行入口

原两条来源为 item10→skill10 南瓜变变变与 item11→skill11 木桶变变变，均 Trigger1、Target1、Range0、FuncType8、T10，X分别1与2；首效果均3/GA16。两物件 ItemMoney=0，表值不提供正式取得授权。原43aee9–43af57将函数五字段装入skill+158/+164/+170/+17c/+188，槽步长4；这里是表加载器。

已确认原角色独立byte role+308由431d92的index12读取、431dbf写入；427d95–427e31诊断文字为OnFire。已有效完整开火证据4288fe先清flag12再判断本机开火资格，432528 selector11先写record+3c并通知属性6、再清role+308。两者只证明该byte清理，尚未建立Func8或伪装模型身份。

本次静态索引找到十个+308位移候选，其中角色附近五处为byte初始化、读取、写入、弹槽清理和出生清理；另外五处为其他地址区间的DWORD操作，未建立角色身份。没有已证的role+308→伪装模型绘制读者。原factory451aa4经selector1d取得车型定义、创建角色actor的合同直接复用role-actor-global-clock-sol-native.json，不能用它替代Func8模型切换入口。

| 未恢复字段 | 已确认读写地址 | 已确认链与下一入口 |
| --- | --- | --- |
| Func8 X1/X2→伪装身份及actor模型 | 43aee9表加载；实际Func8执行读取与模型写入尚未定位 | item10/11→skill10/11→函数五字段。下一为Func8目标执行器或接收观察者，追至role+310 actor并区分X1/X2 |
| Func8 T10→期限与恢复 | 43aee9表加载；期限字段写入/恢复回调尚未定位 | 先取得同一Func8 actor producer，再追其时间基准和expiry callback |
| 开炮或选择弹槽→伪装恢复 | 4288fe→431dbf(12,0)；432528 selector11→4325a6清role+308；431d92读取 | 已证清byte，下一须建立此byte或另一实际伪装状态到actor替换的消费者；不能由说明文字推导绑定 |
| 正式取得10/11 | 原item.dat ItemMoney=0；无已证正式购买/掉落producer | 查取得授权入口后才可接CAS与普通玩家消费；不新增免费发放规则 |

来源封装pumpkin-function-entry-source.json保留两技能/两物件完整记录、函数列号、十个指令地址和三段原反汇编。脚本recovery/evidence/skills/pumpkin-function-entry-source.py只做一次静态定位，无新native执行或正式对局。FUNC08尚未实现，父项保持开放；表中10秒不构成已恢复的计时执行规则。
