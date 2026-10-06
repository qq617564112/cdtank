# 原道具快捷槽配置与确认

服务端accounts/kitbag-configuration.ts恢复配置43dcc3、取消43cbe3，battle/items/kitbag-confirmation.ts恢复成功/错误确认43bf59/43bfd2。slot1–7对应战斗数字键2–8；数字键1是独立默认弹药，不在七槽数组中。请求不修改快捷槽，也不扣库存数量。角色数组0的真实来源是OdlPlayer m_arrayItemHotkey（record+94，七个int）。

## 配置请求43dcc3

- 实例ID需非零，slot为unsigned1–7。slot0通过manager+b8回调code3；其他越界只返回false。
- 按原43d728顺序查库存vector10、20、30、40、60、70，首个实例匹配生效。vector50/80不参与。
- 原43bce7允许ItemTableID unsigned1–4000或20001–21000，其他记录通过manager+b8回调code0并返回false。
- 分类使用库存4396e0。slot1–3拒绝类别1，slot4–7拒绝类别2，回调code1；这里没有再限制其他通过43bce7的类别。
- 原构造43c624/type3c91后，仅由调用者写packet+10实例ID和+14槽号，发送413ec4；发送返回值被忽略，最终true。没有检查拥有数量、本局数量或record state，零数量记录仍能发配置请求。

实例0的43d781分支属于诊断日志格式入口，native测试在此边界供给；不将其当库存业务或槽位修改。

## 取消请求43cbe3

取得缓存角色array0后，slot0通过manager+bc回调code0；七槽UI范围中该条目为0则返回false。非零条目构造43c73c/type3c9a，仅写packet+c槽号并发413ec4，返回true；条目保持直到确认。原函数没有上限检查，生产入口的使用范围限定原七槽UI，不把未验证的越界内存读取作为功能。

## 配置确认43bf59

packet+c结果4为成功：缓存角色存在时，传packet+18七条数组给role virtual+38，实际432826复制全部七项，通知28之后置dirty。随后manager+b8回调结果4。缺角色的成功通知不改数据、不回调UI。其他结果直接回调manager+b8对应code，与角色是否存在无关。

返回实例ID和槽号不参与此确认的数组选择；完整返回数组才是权威结果。配置回包不扣数量，不将单条请求在本地抢先写进数组。

## 取消确认43bfd2

packet+10结果1为成功：缓存角色及array0存在时，直接把array[slot-1]置0，再通过manager+bc回调1。此路径没有调用432826，不通知28、不改dirty，也不扣数量。成功但缺角色/数组时不回调UI；其他结果直接回调对应code。

## 原包体

recovery/evidence/inventory/kitbag-configuration-wire.ts的包体类型独立于路由type：

| type | writer / reader | 字段顺序 | 位数 |
| --- | --- | --- | --- |
| 3c91 | 43c657 / 43c6c1 | result8、instanceID32、slot8、七条hotkey各32 | 272 |
| 3c9a | 499757 / 43c76f | slot8、result8 | 16 |

writer仅传对应低位，reader先清各32位destination再读取。七槽值在wire为unsigned32，原role array setter按int32保存。请求构造器并未初始化所有响应字段；独立取证完整codec要求显式提供字段，不补造原请求默认值或服务器回包策略。

## 验证与接入边界

`npm run test:combat:configuration`执行1433配置请求（204源物件×7槽、六库存搜索vector及缺记录/零ID/槽0/越界）、16取消请求、48实际确认，以及64实际writer/reader/getter/原位流样本。配置搜索、ID许可/分类、SEH、原包构造/析构、角色数组getter与setter实际执行；供给缓存角色、发送、UI/记录观察器及日志边界。确认比较数组、dirty、通知顺序；请求比较数量不变。

生产规则与独立取证codec逐值对照，并组合“请求不改槽→完整确认包→本局数量初始化→数字键2正常分派陷阱→取消确认后空槽”，拥有数量和本局数量保持。输出kitbag-configuration-native.json。库存总回归已纳入本入口。

真实账户库存及原界面快捷槽配置已经接通：PtlKitbag→accounts/api检查认证与WAITING阶段→AccountStore执行原请求门槛并保存七槽→World.confirmKitbag→battle/preparation调用对应确认写入角色。实际消费与施放另由战斗权威处理；原回调和wire不能单独证明完整原服务器确认策略。

## E-04 工程所有权与迁移验收

PtlKitbag的Req/Res是双端协议，本次未改变。KitbagAssignment/Result/CancellationResult仅供服务端账户执行、对局确认与原程序对照使用，归accounts/kitbag-configuration，不另建shared内部结果类型。角色确认写入归battle/items/kitbag-confirmation。四个函数体保持原样，真实AccountStore、World、preparation消费者已接通。

原native、CTS及wire归recovery/evidence/inventory，native ROOT按新目录解析，原oracle输出仍为recovery/output/kitbag-configuration-native.json。原shared两文件及tests两个入口删除，没有副本或转发；npm run test:combat:configuration执行迁移后的native+CTS。正式运行只使用生产规则，不执行原二进制或wire。

迁移后的1433配置请求、16取消、48确认、64实际原包体，以及账户库存/七槽重启/隔离、World首局再战数量与普通弹药陷阱道具分派通过（engineering-kitbag-evidence.log）。全仓类型和220运行模块依赖门禁通过（engineering-kitbag-types.log、engineering-kitbag-boundaries.log）。

集成验收包括独立两端构建、发行JS/map排除wire与实际消费者引用、编译服务账户配置取消/联机保存与五模式CPU各两局、真实双网页AI自然两局/原治疗Effect11与GA15/迷彩/退出释放/重启库存快捷槽。检查分别发现构建依赖、阶段/账户与确认写入断链、跨局数量和资源生命周期改变；本次全部通过：engineering-kitbag-{server-build,web-build,artifacts,compiled,two-rounds,browser}.log和独立快照engineering-kitbag-browser.json。双网页自然终局18962/103075ms、退出双方instances/voices归零、重启后库存快捷槽/控制恢复通过；全部检查退出0，临时服务/Vite/Chromium已关闭。完整原技能/道具效果及高清全内容性能仍由tasklist对应M项恢复。
