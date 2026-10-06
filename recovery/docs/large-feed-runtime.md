# 大包宠物饲料逐内容业务

任务M4-10-I02。正式运行已支持物件2，本切片验证该内容在真正业务中的接线，复用battle/healing、账户事务、普通输入和原EffectRuntime，不增加生产赠送或新权威规则。

原表为物件2“大包的宠物饲料”，每局上限5，技能2的HP列400，TriggerType1/Target1/FuncType2，首效果Effect11/GA15/Tag0/Method3。客户端按普通Digit5发槽号，服务器从已归属库存解析实例及技能。自用、满血拒绝、成功条件、先保存后作用和逐份消费是明确重建服务端规则，不能证明原缺失3c9e处理及3c92消费因果，也不能关闭FUNC-02或M4-10父项。

## 规则与真实联机证据

`npx tsx tests/healing-item-world.cts --large-feed`：明确导入开局前的拥有宠物基础字段+2c=1000及原战车字段，经现有原属性重算/限制，快照生命上限999。该样本是显式初始拥有来源夹具，不是历史服务器自然账户或live HP注入。CPU普通输入自然射击至生命569，普通道具输入实际恢复400至969；第二局自然伤害后恢复43至上限，验证部分缺血限幅。满血、CAS和存储失败拒绝不写生命或数量，旧序列不重复消费，两局自然终局和冻结、余量再战、退出重入与AccountStore重开保存通过。独立账户已归属8份的正常开局按物件2原上限初始化本局5份，拥有8份不改变。证据large-feed-world.json/log。

`npx tsx tests/healing-item-network.cts --large-feed`：正式隔离TSRPC服务3137、两个真实连接，经正常账户/创建/加入/CPU/准备/输入，自然受伤后收到相同skill2自用通知，拥有/本局3→2、同tick玩家一致，重复seq无额外消费；实际服务器重启保存物件2/数量/槽位/其他字段并保持账户隔离。证据large-feed-network.json/log。此规则与网络验收不替代网页绘制、音频或完整比赛要求。

现存cpu-healing-item.json也已包含物件2 CPU的三次普通AI输入施放，每次自然缺血恢复215、逐实例数量3→0、第二局零库存不补回与自然结算。生产CPU策略及该证据未变，直接复用，不为本内容重复运行全套CPU验收。

## 实际效果分派

`npm run test:combat:healing:effect`：保留skill1基线，skill2分别调用实际BattleSkillEffects/通知/EffectRuntime。原Effect11非保留树五绘制节点2664/2665/2667/2830/2834、活tag_efcenter矩阵身份与实际顶点跟随、GA15 selector1及到期/停止/角色detach/runtime.stop网格材质归零通过。NullEngine与纹理/声音边界明确为夹具；共享原树精度来源复用healing-effect-fidelity，不重复取证。证据healing-effect-large-feed.json。

## 网页验收

正常两个网页1920×1080实际画布scale1库存页配置→两局自然CPU伤害→Digit5→实际Effect11/GA15→余量再战→重启重入/最后一份消费/再次重启已经通过。两个自然OBJECTIVE结算57086/72322ms，相同tick匹配33/37次；库存3→2→1，重启保留1/槽4实例77，正常新房再使用1→0后再次重启页面显示×0，双端事件/退出instances和voices归零。实际技能2三次作用43/86/43，均按当时缺血限幅。SwiftShader中位帧约393ms，高清功能验收通过但性能未达标，M7保持未完成。命令npm run test:combat:large-feed:browser -- <Chrome CDP WebSocket>，证据browser-large-feed-hd.json/log和browser-large-feed-battle-1-hd.png/2-hd.png。预键浏览器快照可能迟于权威tick，不用它伪造精确恢复量，精确400与限幅由即时World前后状态证明；网页须验证skill2实际分派、双端真实事件及库存和资源表现。

## 回归范围

本切片只扩展现有验收夹具与明确内容参数，不修改生产服务器、协议或Web行为。首件World、首件效果基线与类型检查验证共享测试扩展没有破坏现有验收；不重跑无相关改动的发行构建、五模式或账户全套。所有未知原权威/像素精度边界仍在原tasklist父项保留。
