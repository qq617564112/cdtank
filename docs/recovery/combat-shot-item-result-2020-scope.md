# M4-09 / M4-10 玫瑰弹远端场景结果 consumer 准备

原 2020→4018 首 029/SE23、BattleFire GA08/sound49 与 remote-only 场景合同复用。
既有来源 `combat-shot-player-result-2020-source.json` 已确认 root2623，drawable 节点为 2624、2717、2813、2881；四节点自然生命周期均约 3 秒，树无 WW 声音。

| 层次 | 当前状态 |
| --- | --- |
| 来源 | 029/SE23 与 remote scene 合同复用，旧 player-result 受害者不重跑 |
| 模块 | 2020 两 exact guard、scene consumer CTS 与必要 Web type 已通过 |
| 普通触发 | `projectile-scene-result-2020-world.cts` 已通过 ENV79 首致死、TSBuffer wire 与 normal Leave；server stable 与 UI positive-quantity release 后再开 GPU |
| 浏览器实际 | runner 已准备，Chrome 尚未启动 |

准备 runner：`tests/browser-combat-shot-item-result-2020.mjs`，端口 3538/5568/9768，普通 BUY10/Home 槽1/Digit2、map7/mode1 四账户 Ready、Arrow/Space 触发 ENV79。
数量门禁读取每行独立的 `[data-home-item-row-quantity]`，要求精确 `10`，并在 assert 前保存 row 与 checkpoint 证据；不使用整行 `×10` 文本猜测。

观察 root2623 的四节点实际 draw/expired、SE23 与 GA08/sound49 的 ended/output、local 静默、三张完整 640 callback 画布，以及 host battle Leave 与 guest summary Leave 到 LOBBY/worldnull/资源0。draw 不代替可辨 029 文字、玫瑰纹理或独立节点像素结论。

新 CTS：`tests/combat-shot-item-result-2020-consumer.cts`，覆盖 endpoint `_root\\online\\029`、SE23 顺序、GA08 sceneObjectDestroyed、local 与未支持弹药静默。

## 限制

不修改 Func2/HP0、伤害、飞行、objective、原始 UV 或 World 生命周期；不重跑旧 source/runtime/player-result 受害者。WW 不适用于该四节点树；音频内容与独立像素须以实际 callback 证据为准。

正式 ordinary first 仅在 Map21/UI positive-quantity clean 与 ammo2020 server build/copy stable 后启动；当前保持 0 Chrome。

## 唯一普通场景首验

`browser-combat-shot-item-result-2020-2026-10-05T10-35-35-318Z.json` 通过并完成清理，汇总副本为 `combat-shot-item-result-2020-actual.json`。
普通 BUY10/Home 槽1/Space 触发 ENV79；两页各收到一次 2020 scene result，库存行独立数量字段为 `10`，配置到槽4后弹药由10降至5。
远端 root2623 的节点 2624、2717、2813、2881 均实际绘制并自然结束；SE23 outputPeak 1.0597190856933594，GA08/sound49 postGainPeak 0.535597562789917，均自然结束；本机无效果或声音。
三张完整 640 callback 画布作为原始证据保存，不据此宣称可辨 029 文字、玫瑰纹理或独立节点像素。
Host `data-leave-room` 与 guest `data-summary-leave` 均到达 LOBBY/worldnull，instances/meshes/voices 均为0，process cleanup PASS、3538/5568/9768 全部释放。

主线 root review 已回链 `combat-shot-item-result-2020-root-review.json`，终态为 `ACCEPTED_NORMAL2020_REMOTE_FOUR_DRAW_AUDIO_DUAL_LEAVE_PIXEL_GAP`；四节点 draw、SE23/GA08、本机静默与双 Leave 已收，玫瑰/光晕独立像素未可靠辨识，不据此扩展 scene 像素范围。统一 Web54138 工程出口由主线回链。
