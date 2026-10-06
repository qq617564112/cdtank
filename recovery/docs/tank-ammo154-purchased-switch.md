# 新车型tank154的已购特殊弹药消费者

M2-02补充tank154来源下的特殊弹药实际消费者。专属runner从空拥有/库存的资金profile创建账户，真实TankShop BUY154并SelectRole；同一账户再Shop BUY2007一件、Kitbag槽1，普通mode4/map7双连接。普通2001首弹匣先发一枚后切换2007，实际tank154源公式为普通capacity9/normal2.3/last6.9，特殊capacity7/normal2.9/last8.7。

真实快照确认tank154/pet缺省、普通9/9→8/9后切特殊7/7，特殊发射后库存弹量0、magazine0/7并进入last8.7装填；耗尽拒绝后回普通8/9，held输入不冒射，fresh input再消费普通。263次共同PLAYING完整players、fire/ammoConsumed/itemRejected核心事件双端一致。runner对双方round1 Leave调用均断言成功，但本raw未保存Leave响应数组，故此摘要不把它当独立Leave回执；服务与临时库清理完成。

原始记录`recovery/output/tank-ammo154-purchased-switch-network-2026-10-05T05-30-11-611Z.json`和同前缀日志，摘要由`...player-evidence.json`保存。范围只扩展tank154/2007真实购入源组合，不重复tank3特殊切换、tank154普通弹/末发、交易、FX、持久重启或原完整producer；宠物绑定、初值和原最终伤害继续开放。
