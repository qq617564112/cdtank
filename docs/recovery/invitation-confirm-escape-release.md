# 邀请确认 Escape 松键隔离

UI06 / M5-03。SourceConfirmView 记录非组合、非 pending 的 Escape keydown，阻止浏览器默认关闭；keyup 在 dialog 内阻止传播后消费该请求，调用原 requestCancel。native cancel、cleanup 原焦点、pending 与邀请队列、Join 事务、字体和源几何保持原 owner。

browser-invitation-confirm-escape-release-2026-10-05T02-19-26-881Z.json PASS。两普通账户，一次正常 Create/Invite 仅提供本窗必要上下文；原生 Escape down 后窗口仍开、焦点在 dialog、window down/up=[]；up 后忽略邀请、窗口关闭并严格回原 Create。房主正常 Leave。本次房间事务请求为 CreateRoom、RoomInvite、Leave（普通账户初始化与大厅只读查询沿现上下文），0 Join/Ready/购买/发送，resolutions=[] / screenshots=[]，旧源三图和密码业务证据复用。独立 server/Vite/Chrome/temp 清理，端口无 listener；同名前缀 -server.log 保实际服务记录。

invitation-confirm-escape-release-web-types.log exit0；主审已有限接受并登记 M5-03；terrain-intimate-confirm-production-web-build.log 全 Web types/build exit0、Vite 1m52，包含最终 hunk 并已更新 dist/release。本次仅证明普通键盘生命周期与返回焦点，没有新增 OS IME、原回调或整页 1:1 结论，父项保持未完成。Intimate 长名单的更早加载缺口仍独立保留，不据这次两账户正常加载关闭该缺口。
