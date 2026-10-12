# 2004速射弹的正式间隔消费者

M2-02首次必要范围，代码 `tests/tank-ammo04-delay-network.cts`，证据 `recovery/output/tank-ammo04-delay-player-evidence.json`。旧 `ammo04-persistence-accepted.json` 的正常购买、单发命中及重启库存证据复用；本片补连续开火间隔，不重复伤害与绘声。

复用两普通账户真实BUYtank3/pet2的原生checkpoint，目标账户正式Shop BUY2004×4、Kitbag槽1；普通Create/Join mode4/map7和Ready→PlayerInput选2004→held fire两发→停止→手动回普通2001→装填完成后fresh fire一发→双正常round1 Leave。没有导入活跃位置、HP、伤害或事件。

实际拥有战车的+58/+5c/+60来源经OwnedRoles读取，公式使用同一 `recomputeRoleAmmo`、实际TankDelay及原技能选择/限幅/f32转换。当前selectedSkillIds为2004/4020，切回为2001/4020；普通间隔1.5秒，特殊1.100000023841858秒，容量均7。原2001的Delay17与2004的Delay13确认相差4个0.1秒单位；没有将所选pet当boundGear，不宣称原默认完整宠物配装。

首raw `tank-ammo04-delay-network-2026-10-05T03-02-34-917Z.json` PASS：特殊两发tick3→25，弹量4→3→2，间隔22tick=1.1模拟秒、1.106服务秒、1.103墙钟秒；权威startedAt未早于原公式deadline，期间无已过deadline的遗漏可用tick。相对公式服务误差约+6ms、墙钟约+3ms，仅此房实测。回普通fresh fire剩余6/7，reload.duration恢复1.5秒。

48共同PLAYINGtick完整players双同，指定fire/ammoConsumed事件双同，双Leave成功；服务与临时库清理，3306无监听。原服务端授权、库存选弹策略与控制映射沿既有明确重建规则，本片未修改生产规则。仅验该来源组合两发普通间隔与切回；末发、耗尽、图声、原伤害、持久重启及完整父项未由本片扩验。主线按原M2-02段审查登记，父保持未勾。

VIP特殊弹资格首次实测另记 `tank-ammo04-vip-delay-player-evidence.json` / raw03-16-23-392Z；运行同专属runner的 `--vip-only`，原mode4不重跑。合法mode3/map7四真人，前两账户合法BUY3/pet2 checkpoint，另两新Account空拥有只作为普通观察者；host由房间正常选为VIP，没有写入profile/flags/HP。真实BUY2004×4/slot1后仍capacity7，间隔1.100000023841858秒，tick3→25、库存4→3→2；1.1模拟秒/1.106服务秒/1.103墙钟秒，与非VIP限定结果相同。回普通fresh fire仍6/7、duration1.5，48共同tick完整players和指定开火/消费事件双同，四round1正常Leave与服务清理通过，3308无监听。

VIP生命200是现房间明确重建政策，原VIP multiplier缺源拒绝保留，不影响本已确认弹药资格。该VIP片只证明当前真实配装的有限特殊消费、容量及两发普通间隔与切回，不冒VIP末发/全部技能修正或空拥有观察者的购入运动。
