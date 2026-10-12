# 大厅源资源失败反馈

M5-02 / UI46。当前 LobbySourcePage 的 error 只在 ui 已加载的分支内绘制；原根资源 /ui.json 失败时反馈不可达。此次消费者范围为正式整页资源 loading/error 的 Web 可读反馈与正常重新加载入口，成功页面原几何与资源保持现合同。

原 default/roomlist/playerlist/chat 源根必须经 ui.json 取得。失败时不能补造原背景或控件，错误页明确为 Web 反馈；原错误 producer、原 framebuffer/font 与完整大厅1:1保持开放。恢复动作使用普通页面重新加载，沿现账户localStorage与Battle启动，不新增网络接口或轮询。

首次验收：普通空账户 /ui.json HTTP503 真实拒绝，800×600/1920×1080/3840×2160完整失败页可读；恢复源文件后正常鼠标重试重新载入原大厅，确认已有列表与Home/Shop入口可达。0BUY/Ready/对局，正常大厅及账户交易旧证据复用。

## 实现与实际

仅 `lobby-source-page.tsx/css` 的 !ui 分支增加资源 loading/error 文字与重新加载按钮。反馈是 Web 深色底白字，独立物理可读尺寸，源资源不可得时不补造原背景。失败提交仅在 body 聚焦时把焦点交给重载按钮；成功原800×600 stage、图片和名单/聊天/房间消费者保持现合同。

`browser-lobby-resource-feedback-2026-10-04T23-12-02-179Z.json` 的三res实际错误页文字、viewport完整与重载focus有效，三完整图已亲看，原整体FAIL保存。`browser-lobby-resource-feedback-2026-10-04T23-13-50-381Z.json --recovery-only` 为PASS，无新截图；真实HTTP503恢复后普通鼠标重载，等待实际Account确认返回，同accountId，原background/players/chat与Home/Shop入口enabled全部通过。只记录accountId，未记录token；0交易/建房/Join/Ready。23-12-51原FAIL同样保存，不作为完整通过。

汇总为 `lobby-resource-feedback-accepted.json`，工程focused Webtypes exit0；统一发行待主线聚合，不独立全build。UI46/M5-02完整父项未完成，该片仅关闭真实加载失败无可读恢复入口的消费者缺环。
