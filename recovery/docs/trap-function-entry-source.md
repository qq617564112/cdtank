# FUNC-03 捕兽夹执行入口

原属性33观察者内的 `42f624–42f68d` 已实际执行32组。标记9在record+125，缓存值在role+369；完整分支在两者不同、record+122标记6为0、HP getter selector15为正、且新值为0或旧值恰等于新值加1时，向 `4886aa` 提交roleId/skill4001/duration0。这证明捕兽夹表现由许可计数下降驱动，不能将flag9非零作为异常开关。

标记读取 `431d92` 从record+11c+index判断非零；`432f91` 的command1/2以flag9为直行许可，3/4以flag10为转向许可，其他组合要求两者；flag8或status非2拒绝。已通过运动许可原向量复用，不重复执行。`431dbf` 的普通标记写入：false清零，true增加byte计数，并通知属性33；index12独立写role+308，不混入记录数组。

| 对象/字段 | 已确认读写地址与调用链 | 当前缺失及下一入口 |
| --- | --- | --- |
| skill4001 FuncType1/FuncT1 | 原表3/5；43aefa–43af57加载器写skill+158/+164，三槽按4字节排列；X/Y/Z分别+170/+17c/+188 | 缺指向该skill记录的Func3执行分派；同偏移的其他对象访问不是证据 |
| record+125许可计数 | 431dbf写；432f91读；42f624对比role+369后调用4886aa/4001 | 缺正常陷阱触发导致计数下降及5秒恢复的producer；下一为属性33发送者或角色virtual+28间接调用 |
| role生命周期 | 432ecf清16flags后经432f1b/26/31增加9/10/11；死亡等相邻状态入口清零 | 不将生命重置当Func3施放；没有trap所有者或对象资料 |
| scene激活消息3ca4 | 库存注册43d1d0，读取message+c名称/+28参数/+2c/+30/+34 XYZ，经scene virtual+48查现有对象，再virtual+4c/+6c激活，播放online038 | 已证激活现有scene，不证明创建玩家陷阱；缺地面对象创建/归属与触发消息producer |

原二进制直接调用扫描索引18个431dbf调用点；相同Func字段偏移候选及原反汇编保存 `trap-function-entry-source.json`。直接调用和常量偏移扫描只定位这些可见调用，不证明间接调用或服务端不存在。原执行边界为HP/id getter与4886aa记录接口，完整flag9分支指令实际执行；未调用正式对局，不算真实陷阱取得、放置或生效验收。

原client行为测量：本片无新增Windows实测。单位：FuncT1=5仅表值，尚未取得该Func3的时钟消费，不能直接宣称原计时已恢复；flags为byte计数，非bool。服务端重建：本片未新增trap权限、消耗、位置或恢复政策，生产文件未改。

专属入口 `recovery/evidence/skills/trap-function-entry-source.py`；运行检测observer真实分支是否与上述计数方向/门禁一致，若失败须修正标记消费者解释。32组PASS不关闭FUNC-03或M4-10父项。
