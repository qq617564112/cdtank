# 原战斗消息面板alpha正式网页验收

M5-04-BATTLEINFO-ALPHA正式网页PASS17，9张整页PNG。`browser-battle-info-alpha-accepted.json`列出native、主结果与截图；主结果为 `browser-battle-info-alpha-2026-10-04T00-09-35-580Z.json`。独立3285服务、5315 Vite、9515 Chromium与临时目录全部清理，三端口均已无监听。

运行 `node --import tsx tests/browser-battle-info-alpha.mjs`。两个独立正常账户网页普通创建/加入mode1/map7，普通Ready进入PLAYING。没有CPU或持续自然战斗日志，两个普通玩家发送RoomChat消息，经实际协议解码确认请求与双方RoomEvent，正式filtered日志消费使双方panel恢复alpha1。没有注入消息、生命、位置、玩法或时间；match运行配置为300秒。

800×600、1920×1080和3840×2160分别等待实际HUD舞台resize提交。逐项核原picBattleInfoPanel矩形309,0,263,93、`ui/regions/77/2.png`背景、文本子区6,5,251,83与实际elementFromPoint命中edtBattleInfo。背景panel的pointer-events仍为none，只有原文本区auto。PLAYING补充Web对局面板移至右侧top25%，原HUD坐标保留，文本区能够正常命中。

每个分辨率都执行普通消息后alpha1、实际update clock累积至原8秒消费者淡化至float32(0.2)、普通鼠标进入恢复1、普通移出恢复0.2。逐态记录computed opacity与实际源消息，正常、淡化、hover各保存整页PNG。最后两页普通Leave使world清空、HUD隐藏且文本消费清空。

已实际查看800消息态、1080淡化态及4K hover态：顶部原pane与消息绘制可见，反馈来自正式透明度store与普通鼠标，不通过合成dispatchEvent触发。

## 保留证据

三个原FAIL文件保留原状态和cleanup。遮挡的精确证据为 `browser-battle-info-alpha-2026-10-04T00-08-33-358Z-blocked-hit.json`：800原文本rect315,5,251,83，上方PLAYING battle-match rect80,16,640,141、z3；该记录用于正式Web对局面板位置修复，未改变原HUD矩形。验收只采用最终PASS17。

## 限制

本片证明现有Web源图、实际消息与alpha反馈可见、鼠标可命中，不证明原Windows/GPU像素等价或完整HUD。原owner+0x10的消费者单位已核，delta producer/完整原frame dispatcher未执行；正式时间由HUD update实际now差提供。完整原文本组装、容量和原阶段显隐仍缺，见 `battle-info-alpha-source.md`、`hud-phase-source.md`；原WAITING空pane不在本片改变。

集成工程验收：`battle-info-env20-web-build.log` 独立Web类型与生产构建PASS（2m），`battle-info-env20-boundaries.log` 312正式模块边界PASS；同一证据由本片与并行切片共用。root独立保存证据复核见 `battle-info-alpha-root-verifier.json`。
