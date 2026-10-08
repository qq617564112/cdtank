# 原战斗提示音

四项原战斗 UI 声音使用 `audio.json.soundIds` 中的原始 WAV，调用编号不经过技能声音偏移。

| 原行为 | 原指令 | 声音 |
| --- | --- | --- |
| 本机死亡倒计时正数显示 | `0x4cc99e` 显示 `txtCountdown` 后调用 `0x4d6524(1)` | `0x4d6524` 直接加 `41`，得到 `42/GA01.wav` |
| 本机 Fight 出现 | `0x4cca4e` 显示 `picFight` 后调用 `0x4d6524(2)` | 得到 `43/GA02.wav` |
| 本机射击后装填开始 | `0x4cb670` 收到实际射击时长并重置 `prgCrossbar` 后调用 `0x4d6524(31)` | 得到 `72/GA31.wav` |
| 本机快捷槽记录本局数量为0 | `0x4cb2f5` 查得 `record+0x20` 为0后调用 `0x4d650b(28)`，随后拒绝请求 | `28/UI28.wav` |

`0x4d650b` 与 `0x4d6524` 的入口关系见 `battle-summary-audio-source.md`；本机死亡观察者、Fight 状态和装填入口的控件与生命周期分别见 `death-countdown-observers.md`、`battle-respawn-spectator.md`、`reload-hud-source-sol.md`。`UI28` 是声音调用；`GA31` 只对应本机射击后的装填开始，不能用作切弹声音。

## 网页接线

`BattleUiSound` 在地图资源就绪时一次预解码 `28/42/43/72`，音量按 `Battle.soundVolume` 的当前运行值读取，未设置时使用 `audio.json.defaultSoundVolume`；0 保留为静音。目录或 WAV 载入失败只保留现有战斗状态错误反馈，不取消整局资源加载。

`GA01` 由 `BattleHud.deathCountdown` 的正数变化触发，`0` 不触发。`GA02` 只在 `introStage` 从非 `fight` 进入 `fight` 时触发。两者都以 `roomId + round` 为游标；重复快照、每秒倒计时重复渲染和 50ms 输入刷新不会重播，latejoin 或重连的首个状态只建立游标，不补播已经过去的倒计时或 Fight。

`GA31` 只消费服务器确认实际射击后发送的 `RoomEvent.type === 'fire'`，且仅在本机 `playerId`、当前房间 active、地图已载入且 `loadedRound` 等于当前回合、快照阶段为 `PLAYING`、连接正常且不在重连中时播放。它不从快照的 `reload.startedAt` 推断射击，也不回放历史事件；latejoin 或重连不会补播此前已经发生的射击。

所有会发送 `PlayerInput.useItem>0` 的路径统一经过 `BattleInput.send` 的数量入口：`send` 读取现 context 后调用 `acceptSlot`，数字键、`useItem`、武器循环和 HUD 点击都不在各自 keydown 里先行判定。默认 `useItem` 绑定为 `ControlLeft`，`ControlLeft`/`ControlRight` 自身 keydown 可通过 Ctrl 修饰门禁；其他键带 Ctrl 的组合仍忽略。`Battle.acceptSlot` 读取已确认 Inventory 的绑定和记录：记录存在且本局数量为0时播放 `UI28` 并拒绝该请求；未知记录按非0放行，空绑定不播放声音。接受后再保留原有的 item 游标与弃置候选选择；道具前后切换只移动本地游标、不发送、不扣量。客户端不扣减本局数量，也不把声音当作服务器成功。

换局和离房重置游标并停止全部提示音声部。断线或重连期间不创建新的提示音声部；浏览器拒绝的一次性声音直接丢弃，后续真实交互只恢复音频上下文，不补播。

## 限制

未执行测试、浏览器、构建、类型检查或 lint；未进行原程序或网页听感对照。静态来源已确定四个调用点、编号映射和原始 WAV，浏览器声部调度与原 OpenAL 声音池的逐帧听感不在此范围。
