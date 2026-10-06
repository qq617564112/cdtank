# 原场景破坏：字段与客户端状态

破坏模式已使用原场景Breach记录作为目标与模型来源。0021的obj05422/obj05466/obj05467/obj05468采用对应完整POL→c9.CVD破坏表现及GA13声音，见`scene-breach-0021.md`、`scene-breach-0021-05422.md`、`scene-breach-0021-05466.md`与`scene-breach-0021-05468.md`。m005的0021“木桶镇广场”明确提到木桶击破赛；三张破坏地图0020/0021/0022分别含117/73/46条Breach记录，但DefaultButt分别为123/77/34。静态记录数不等于该表字段，禁止直接据此猜测目标总数、刷新或结束条件。

## 尾部字段

`recovery/scene_breach.py`读取全部1,144条SYcScnObjBreach尾部，`export_scenes.py`为每条添加breachFields。原26字节全部字节往返一致；其中994条field5c为1、150条为0，其余字符串为空、field20=0、field88=1。

原0x461f60先调用公共placement reader 0x44ea18，再读Breach标记0x778346a2。按读取顺序，子数据位于对象+0xd8所指内存：

| 字段 | 子数据偏移 | 原读取路径 | 当前源值 |
| --- | --- | --- | --- |
| field04 | +0x04 | 0x461fae→0x57476c，长度前缀GBK字符串 | 空 |
| field20 | +0x20 | 0x461fc3，1字节 | 0 |
| field24 | +0x24 | 0x461fd2→0x57476c，字符串 | 空 |
| field5c | +0x5c | 0x461fe6，4字节 | f32 0或1 |
| field60 | +0x60 | 0x461ff5→0x57476c，字符串 | 空 |
| field88 | +0x88 | 0x4620c9，1字节 | 1 |

随后0x45e50b消费4字节扩展标记0x778344ad。这一标记也被其他派生类写出，不能单凭标记将对象认定为General。旧版本0x778346a1/0x77832379分支存在，当前解析器严格支持提供样本的a2布局，未声称旧版本已全量支持。字段语义未全部确认，保留原偏移名；**没有把field5c或任何尾部值解释成血量**。

`tests/scene-breach-native.py`映射原PE并实际执行0x45e50b→0x461f60逐条读取，验证原分支、字符串目的偏移、标量大小、扩展消费与栈返回。公共placement header、流I/O和MSVC字符串存储是回调替身；该测试不证明原资源创建器、渲染或原服务端逻辑。输出scene-breach-native.json包含原EXE哈希及全部源记录偏移。

## 具体类型与破坏状态

Breach vtable为0x5c7450：类名槽+0xc→0x45f845使用SYcScnObjBreach；破坏槽+0x14→0x45e7b0。General vtable0x5c73d0同槽为0x45795d（返回false）；Crush vtable0x5c76e0同槽为0x45efb3，另一行为。必须读取实际派生类，不能把通用基类的false入口套到Breach；也不能把Breach淡出套给所有Crush。

Breach 0x45e7b0在对象+0xe8非零时返回false；首次设置+0xe8=1、+0xec=1，将+0xe0模型设置为当前+0xe4，并通过原gbVisNode::SetBlendRecursive(mode1,alpha1)与0x462846执行更新。它不依据传入参数扣减HP。

0x45e6c4先进行普通模型更新；仅当前模型非空且等于+0xe0且+0xe8为真时，alpha按`f32(alpha - f32(dt) * 0.5)`减少，并设置递归混合与RenderPriority(-1)。原x87比较/奇偶分支在alpha严格小于0才调用虚槽+0x68→0x461dd9，设置隐藏+0x74并清理。恰好2秒/alpha=0仍未隐藏；下一正dt才隐藏。实际模型选取、导航清理、隐藏父调度与渲染混合像素仍需继续验证。

`apps/web/src/assets/scenes/scene-breach-state.ts`保存这一客户端视觉状态内核，ScenePreview已按服务端原实例快照接入。Web reset目前仅为新局本地清理辅助，不声明原完整reset资源调用已恢复。

`tests/scene-breach-state-native.py`实际执行0x45e7b0/0x45e6c4/0x461dd9，覆盖重复拒绝、精确零边界、超时及60Hz序列；渲染调用、公共更新与0x462846/0x462934导航回调为显式替身。5组共156个状态由TS逐值对照通过，证据scene-breach-state-native.json；并非实际浏览器像素或联机破坏证明。

## 下一步

1. 追踪0x4247aa通知中的对象类型+0x34、查询位置+0x14与实际场景实例映射；类型2绕过破坏/计数，其他类型经过0x44e081后递增角色+0x314，仍不能直接等同一次成功破坏。
2. 恢复原模型/破损模型加载与Breach/Crush不同碰撞生命周期，证明当前标量/布尔字段的业务含义。
3. 恢复服务器HP、DefaultButt/刷新/掉落与胜负规则，继续验收自然全清及原规则完整局。无法从客户端证明的服务端规则继续记录为重建假设。
4. 通用0x44e081中的模型→GA声音分派已恢复本片obj05467→GA13；完整源执行与正式声音消费者见`scene-breach-0021.md`。

复现：`npm run assets:scenes`；`npm run test:scene:objects`。原CDTank目录未修改。


## 后续联机接入状态

scene-objects.ts从原配置读实例，world.ts在破坏模式使用全部源Breach（117/73/46）代替三个球体；Snapshot带原实例ID、原模型和destroyedAt。ScenePreview已接入scene-breach-state淡出和隐藏、迟加入时间补偿、round变化恢复。除0021的obj05422/obj05466/obj05467/obj05468已恢复原完整/破损模型切换，其他模型仍使用现有源模型淡出；全部模型混合像素、原动态NAV内核、服务器血量/刷新/掉落/原结束条件仍未恢复。OBB/HP200/全清终局明确为重建策略；不能以接入当作精确原模式完成。

原碰撞更新链进一步定位：45e7b0→462846，在虚槽28允许时按槽64或子数据8c收集覆盖格，4581b8转调槽58，再将子数据首字节清零。隐藏461dd9→槽4c→462934，在enabled64分支清理模型/包围并再次调用462846。此链表明导航覆盖与模型状态有关，尚未完整执行，不能据此武断删除与物件ID不对应的.box。原静态NAV和虚拟盒体保持不变；0021使用每房独立动态OBB/NAV覆盖作为明确重建provider，源回调时序与边界见`scene-breach-0021.md`。


四浏览器原实例自然射击/隐藏/重新加入/全票再战恢复通过（browser-destroy-object.json）；原180秒时限的四人自然完整局、同一结算胜者/冻结结果、全票再战与退出通过（browser-timed-mode5.json，实际等待180.233秒）。两项证据分别覆盖原模型生命周期与完整时间终局，不替代自然全物件清空或原版规则恢复。

本轮M3-08-BREACH21：原4610f1加载POL→+dc、同目录c9→+e0，45e7b0切当前+e4；完整44e081实际调用GA13，没有独立烟尘调用，不补造。ScenePreview正式消费者、Battle objectiveDestroyed事件已接；来源及实际双端验收见scene-breach-0021.md与browser-scene-breach21.json（最终PASS，范围限同一木桶63）。priority=-1源值允许传入，但现模型renderer未消费原排序队列，不能据此声称原GPU遮挡等价。服务房间隔离、普通AI真实穿越与再战73阻挡恢复见breach21-world.json；CPU两局自然全清见breach21-rounds。
