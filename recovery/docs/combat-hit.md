# 普通受击动作

普通命中通过角色look方向选择原05–08单动作。服务端只在成功伤害的hit事件上携带显式hurtSelector1–4，两个客户端使用同一选择；死亡09覆盖受击，复活回01。105的受击effect1消息没有原ELK记录，效果与声音保持静默。

## 原调用链

本地生产者0x4288fe通过0x48a226取得incoming角色EBX，0x428927要求其等于当前本地玩家+0x3c；0x436078取得目标ESI，0x428b1d调用0x435745(target,incoming)。它比较双方角色0x431fe7读取的+0x274/+0x27c，即look水平X/Z；车体forward在+0x280，不参与分类。远端0x424769将消息damage与quadrant传入0x422877；只有status2及actor存在才选择受击动作，actor+0x19c死亡标志再次阻止派发。

0x4059de要求单位向量，直接计算点积并调用原CRT acos；点积大于1时夹角返回0。角度小于原f32 π/4常量0.7853981852531433返回quadrant1；在此常量至3π/4常量2.356194496154785之间，叉积target.x×incoming.z−incoming.x×target.z大于0返回2，否则返回3；剩余返回0。生产者quadrant加1成为actor参数，0x464e72→0x46897a/0x46c396将1–4映射为05–08，flags4。普通生产者不选参数0/动作04。

0x46504f→0x464bed只读取角色field15并缓存actor+0x29c。105 M的05–08均duration2561、time160发送effect1/1416378268，U/X/Y无timed event。105 ELK只有03/attack1与09/effect1组；受击消息没有对应记录，不建立特效树或声音。

## Web接入

`World`在普通命中时使用双方`battleMovementPose(...).look`计算选择，并传给`damagePlayer`。`TankView.hurt`严格接受1–4，进入渲染世界前预载05–09，使用原整数时钟单次播放。运动只更新基础01/02，全部部件完成后恢复当前基础动作；开火和受击按最近事件切换。死亡同步清除临时动作状态并递增动作请求编号，取消迟到受击切换；已死或退出的角色不接受受击。

## 验证

`tests/combat-hit-native.py`完整执行原435745/431fe7/4059de及原CRT acos，56组水平向量覆盖符号、对齐和两条角度边界；40组原422877→464e72→三/四部件hurt派发核对status、死亡阻止、quadrant及flags。健康数字显示、actor动作应用、角色field服务和本地相机查询使用记录边界。结果为`recovery/output/combat-hit-native.json`。

`tests/combat-hit-source.py`逐项读取原105 MV3，对照16条05–08的duration、事件和现有GLB，核对ELK缺失受击组。

`tests/browser-combat-hit.mjs`使用临时账户库、两网页、原105账户资源、普通0007混战及CPU，经正常选择、Ready和键盘开火产生真实命中。双方收到4条相同的P1命中事件，其中非致死命中的selector2选择06；本地帧327、远端帧214保存自然受击画布。仅目标P1的06网格提交本地96次、远端100次（远端全部目标合计156次）；双方各3次记录四部件time2461（duration2561减100）、overMessage0，随后恢复基础动作。全部受击消息派发前后实例和声音数量保持相同，本地18次、远端22次；另记录死亡09、满血复活01、退出和新房间重入清理，两轮五类资源计数均0。结果为`recovery/output/browser-combat-hit.json`，受击帧为`browser-combat-hit-hurt-1.png`和`browser-combat-hit-hurt-2.png`。脚本关闭服务端、Vite与Chromium并移除临时账户库/缓存/profile；退出后专属端口3271、5301、9501均已关闭。

## 限制

开火/受击采用Web最近事件调度、全部部件结束后恢复；原角色完成回调与多动作混合仍待恢复。单位look由既有角色方向状态提供；非轴向精确反向的f32向量可能点积小于−1，原CRT acos错误路径没有执行完整恢复，Web不发布该次选择。D3D后的x87控制字仍待确认。selector2→105/06自然实战由本片验收；selector1/3/4→105/05/07/08已由[其他普通受击方向](combat-hit-other.md)完成双端实绘、自然时钟完成及基础动作恢复验收。浏览器使用SwiftShader及320×180实际画布，证明绘制与生命周期，不代表高清性能或21种战车受击全量实战。原三部件本地受击相机响应和普通命中其他效果生产者仍待恢复。
