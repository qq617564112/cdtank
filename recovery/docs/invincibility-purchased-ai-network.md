# 真购买无敌软星本人AI资格

普通真BUY8×1配置slot4，复用已购tank3/pet2原生checkpoint。pet2独立生命700先由正常炮击降到340；本人Autopilot开启后自主use8，生命保持340/max700，库存1→0。目标客户端没有发送PlayerInput。两个客户端290共同PLAYING完整players及itemUsed8一致，关闭托管API成功，双round1 Leave成功。

原AI资格为已存在的重建防御策略：存活、有效HP/maxHP、半血以下、300范围敌人、技能8未占用且有空槽及有限可用库存。源码与旧fixture AI/module证据直接复用，本片只补真实购买与已购生命来源到该消费者，不修改策略、免伤公式或优先级。

使用前tick288、自主生效tick290；全部原始serverTime与接收墙钟在raw frames保存，默认20Hz模拟秒为14.40/14.50。该两tick仅观测资格到作用，不声明first-eligible AI deadline。

证据为`tests/invincibility-purchased-ai-network.cts`、`recovery/output/invincibility-purchased-ai-network-2026-10-05T08-59-03-210Z.json`与同stem完整serverlog；封装`invincibility-purchased-ai-player-evidence.json`已由root有限接受，回链`recovery/output/invincibility-purchased-ai-root-review.json`，tasklist已原位登记。3347进程监听清空、双客户端及临时库正常清理。没有追加native、旧免伤期限、FX、两局、重启、Chrome或生产修改。

## 限制

关闭托管只有正常API回执，未再发人工移动，不声明已验人工移动接管。没有保存消费后原生库，不新增重启/持久终点证明。无敌期限、伤害门禁与AI策略仍沿已有明示重建范围，原完整数值父项保持开放。
