# 2011 耗尽切默认炮口短诊断

唯一8秒只读诊断中，两个正式网页均收到P1的一次默认2001权威fire，原03动作推进到attack1，EffectRuntime正常收到消息并创建root2429，双方实际提交五个图元。本次没有受击/生命周期中断默认发射，也没有消息收到而消费者失败的证据；它不能替代此前两个失败记录的缺失原因。

`tests/browser-ammo11-muzzle-diagnostic.mjs` 使用正常拥有角色/两颗2011 fixture、正式Home鼠标快捷槽配置、mode4/map7两个人类与一个CPU、Ready及真实Digit2/Space。两次2011正常发射、一次空量请求和随后一发默认弹完成后，仅观察8秒，不追加发射、不等待绘声PASS、不再战、不重启。TankView与EffectRuntime包装调用原方法并保持返回结果，仅记录performance时间、动作状态和时钟；未改时间、资源、生命或事件。

| 时间相对默认fire | 拥有者页面 | 另一页面 |
| --- | --- | --- |
| fire/activate03 | +0.1ms，确认004；clock初始1 | +0.1ms，确认004；clock初始1 |
| 原attack1消息 | +412.9ms，clock2219，identifier2722004866 | +386.7ms，clock1931，同identifier |
| 创建默认炮口 | +413.4/+413.8ms，root2429两实例 | +387.9/+388.4ms，root2429两实例 |
| 实际图元 | 各实例5节点提交 | 各实例5节点提交 |
| 原over消息 | +616.0ms，clock2781 | +661.9ms，clock2781 |
| 正常返回01 | +692.8ms activate01 | +734.1ms activate01 |
| 首次自然P1 hit | +2474.1ms | +2477.4ms |

各页P1实际发射仅2011×2和2001×1。默认03在attack1前没有hurt或life(false)；life(true)调用保持状态，不改变revision或动作时钟。实际帧delta与原cap后的推进delta记录在逐帧trace中，未修改帧率/时钟以补造炮口。

完整记录：`recovery/output/browser-ammo11-muzzle-diagnostic-2026-10-04T10-03-08-850Z.json`及`.log`，状态DIAGNOSTIC。逐页trace含TankView fire/hurt/life/activate/advanceAnimations原调用前后、异步完成，active/desired/transient/revision/alive/ammoAttackEffectName、组件clock、EffectRuntime.message/addInstance、权威fire/hit及实际绘声观察。

## 已知边界

原09-43和09-45消费网页FAIL记录保持不变。本次成功执行不证明那两次缺失由受击、消息消费者、over或连续fire导致；没有可据此修改生产时钟的具体因果证据。单次诊断按授权完成后停止，不重复采样或额外补默认炮口。

## 清理

关闭页面、index3222、Vite5382、Chromium9582，删除临时SQLite和浏览器目录；交付时三端口无监听进程。
