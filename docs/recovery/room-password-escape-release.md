# 房间密码窗口 Escape 松键隔离

UI65 / M5-02。RoomPasswordDialog 记录原许可的 Escape keydown，在 keyup 先消费并清记录，再沿 pending/composition 条件执行 close；native cancel、原 Join、输入和焦点清理保持。

实际 browser-room-password-escape-release-2026-10-05T03-08-49-659Z.json PASS：两正常账户、普通原密码房 Create 和另一账户打开密码窗口，native down 保持 open/INPUT/withinDialog=true/中文草稿，up 关闭并严格回同一源房卡，window down/up keys=[]。宿主源Close正常Leave成功，返回 strictCreate。协议有效写只有 CreateRoom/Leave，无 Join/Ready/BUY/send。

resolutions=[] / screenshots=[]，旧中文组合/拒绝/正确Join/原三res证据直接复用。server/Vite/Chrome/temp已清，3459/5489/9689 ss无 listener；同前缀-server.log保实际记录。room-password-escape-release-web-types.log 必要Webstrict exit0，trap3004-room-password-production-web-build.log统一Webtypes/build exit0、Vite1m32，root明确release/dist同步，未独立build。

root已亲核raw/code并mainReview有限接受，M5-02/UI65原位登记。只接受原生Escape松键生命周期，不关闭原callback/fullpage/OSIME父项。
