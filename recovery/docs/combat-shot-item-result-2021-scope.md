# M4-09 / M4-10 鸡蛋弹远端场景结果 consumer 准备

原 2021→4019 首 030/SE24、BattleFire GA08/sound49 与 remote-only 场景合同复用。
既有来源 `combat-shot-player-result-2021-source.json` 已确认 root2570；短节点 2621（约 0.1–0.2 秒）与节点 2622、2829 已有 source/runtime 证据，树无 WW 声音。短节点 draw 只记录实际结果，不作为必要 Leave 门禁。

| 层次 | 当前状态 |
| --- | --- |
| 来源 | 030/SE24 与 scene 合同复用，旧 player-result 受害者不重跑 |
| 模块 | runner、CTS 与独立数量门禁已准备；正式 2021 guards 等 World qualification |
| 普通触发 | root 正在准备 firstlethal/World-wire/server qualification |
| 浏览器实际 | runner 已准备，Chrome 尚未启动 |

准备 runner：`tests/browser-combat-shot-item-result-2021.mjs`，端口 3539/5569/9769，普通 BUY10/Home 槽1/Digit2、map7/mode1 四账户 Ready、Arrow/Space 触发 ENV79。
数量门禁读取 `[data-home-item-row-quantity]` 并要求精确 `10`，在 assert 前保存 row/checkpoint 证据，不使用整行 `×10` 文本。

观察 root2570 的 2622/2829 有限实际 draw/expired，记录 2621 的短节点 draw（若可达）、SE24 与 GA08/sound49 ended/output、本机静默，以及 host battle Leave 与 guest summary Leave 到 LOBBY/worldnull/资源0。三张完整 640 callback 画布只作原始证据，不把 draw 当可辨 030 像素。

新 CTS：`tests/combat-shot-item-result-2021-consumer.cts`，覆盖 endpoint `_root\\online\\030`、SE24 顺序、GA08 sceneObjectDestroyed、local 与未支持弹药静默。

## 限制

不修改 0.1–0.2 秒短节点时基、Func2/HP0、伤害、飞行、objective、World 生命周期或原始 UV；不重跑旧 source/runtime/player-result 受害者。WW 不适用于该树，音频内容与独立像素须以实际 callback 证据为准。

正式 ordinary first 仅在 firstlethal/World-wire/server qualification、UI52 readonly 3553 clean 与 server copy stable 后启动；当前保持 0 Chrome。

## 唯一普通场景首验

`browser-combat-shot-item-result-2021-2026-10-05T10-47-53-585Z.json` 通过并完成清理，汇总副本为 `combat-shot-item-result-2021-actual.json`。
普通 BUY10/Home 槽1/Space 触发 ENV79；两页各收到一次 2021 scene result，库存行独立数量字段为 `10`，配置到槽4后弹药由10降至5。
远端 root2570 的节点 2621、2622、2829 均实际绘制并自然结束；SE24 outputPeak 0.7225745916366577，GA08/sound49 postGainPeak 0.535597562789917，均自然结束；本机无效果或声音。
三张完整 640 callback 画布作为原始证据保存，不据此宣称可辨 030 文字、鸡蛋纹理或独立节点像素。
Host `data-leave-room` 与 guest `data-summary-leave` 均到达 LOBBY/worldnull，instances/meshes/voices 均为0，process cleanup PASS、3539/5569/9769 全部释放。
