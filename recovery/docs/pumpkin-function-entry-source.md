# FUNC08 伪装执行入口

原两条来源为 item10→skill10 南瓜变变变与 item11→skill11 木桶变变变，均 Trigger1、Target1、Range0、FuncType8、T10，X分别1与2；首效果均3/GA16。两物件 ItemMoney=0，表值不提供正式取得授权。原43aee9–43af57将函数五字段装入skill+158/+164/+170/+17c/+188，槽步长4；这里是表加载器。

已确认原角色独立byte role+308由431d92的index12读取、431dbf写入；427d95–427e31诊断文字为OnFire。已有效完整开火证据4288fe先清flag12再判断本机开火资格，432528 selector11先写record+3c并通知属性6、再清role+308。两者只证明该byte清理，尚未建立Func8或伪装模型身份。

本次静态索引找到十个+308位移候选，其中角色附近五处为byte初始化、读取、写入、弹槽清理和出生清理；另外五处为其他地址区间的DWORD操作，未建立角色身份。没有已证的role+308→伪装模型绘制读者。原factory451aa4经selector1d取得车型定义、创建角色actor的合同直接复用role-actor-global-clock-sol-native.json，不能用它替代Func8模型切换入口。

| 未恢复字段 | 已确认读写地址 | 已确认链与下一入口 |
| --- | --- | --- |
| Func8 X1/X2→伪装身份及actor模型 | 43aee9表加载；实际Func8执行读取与模型写入尚未定位 | item10/11→skill10/11→函数五字段。原4173接收消费者已证明X1→obj05428、X2→obj05422及actor隐藏；原Func8 server producer仍未定位 |
| Func8 T10→期限与恢复 | 43aee9表加载；期限字段写入/恢复回调尚未定位 | 当前生产采用T10=10秒及权威expiresAt；不称原时限writer已恢复 |
| 开炮或选择弹槽→伪装恢复 | 4288fe→431dbf(12,0)；432528 selector11→4325a6清role+308；431d92读取 | 已证清byte，尚未建立该byte或另一原状态到4174的消费者；当前生产仅在真实开火通过弹药门禁后采用恢复规则 |
| 正式取得10/11 | 原item.dat ItemMoney=0；无已证正式购买/掉落producer | 当前从已有归属库存或房主有限CPU配置使用，零价不开放免费购买；原取得producer仍未知 |

## 当前生产接线

item10/11沿普通input进入`acceptBattleInput`和`role-disguise.ts`，服务端核对原始Func8表值、自用资格、互斥、16槽及有限库存。成功CAS消费后加入本次临时skill10/11并建立权威`roleDisguise={skillId,style,startedAt,expiresAt,x,y,z}`；style1固定创建原obj05428南瓜，style2固定创建原obj05422木桶，替身固定在施放XYZ并双方可见。首槽Effect3/GA16、到期/死亡/复活/结束/新局/离房清理、合法开火后恢复及CPU有限配置策略均已接入。采用规则与直接来源事实分别见`role-disguise-runtime.md`、`role-disguise-client-presentation.md`及`client-communication-business-rules.md`。

`Battle`已显式转发`roleStyleChanged`/`roleStyleRestored`；真实发射边界在`fireProjectile`后立即按当时仍有效的`roleDisguise`恢复，批末不再扫描旧`fire`撤销后续合法施放，普通输入产生伪装状态变更时先广播权威快照再发送事件。`serviceProto.ts`的version93、property41和event20/21为手工附加字段，未执行协议生成器。

来源封装pumpkin-function-entry-source.json保留两技能/两物件完整记录、函数列号、十个指令地址和三段原反汇编。脚本recovery/evidence/skills/pumpkin-function-entry-source.py只做一次静态定位，无新native执行或正式对局。本批一次集中gpt-5.6代码走查已执行并修复真实发射边界恢复与普通输入快照先于事件两项；普通双端施放/拒绝/恢复、自然到期、高清及持久仍待实测，FUNC-08父项保持未勾。
