# 房间密语运行闭环

M6-08-WR通过正式服务与普通网页路径：认证账户在当前房间、当前局号内以确认昵称发送密语，目标按当前在线账户解析；大厅、同房及异房目标均可接收，第三账户隔离。原对象输入、原频道按钮和菜单保留，路由及协议明确为重建。

服务端3205真实网络覆盖WAITING、PLAYING、FINISHED、3秒自然TIME_LIMIT和再战局号变化、同名歧义、断线、跨连接以及公共/队伍各一次回归。相关协议生成和类型检查通过，见`room-whisper-server.md`及`recovery/output/room-whisper-network.json`。

网页3206/5366/9566的三个正式页面通过普通昵称确认、原建房与卡片加入、准备和CPU真实动作、8秒自然终局、再战密语、跨大厅投影、拒绝保稿与IME门禁。800/1920/4K控件逐轴匹配已提交resize后的源矩形；等待页按现有waitingScale检查实际stage和居中dialog。分段原始证据与合并结论见`room-whisper-browser.md`及`recovery/output/browser-room-whisper-accepted.json`。

## 清理与边界

普通Leave及重入已逐项断言频道、目标、草稿和日志清空；实际断线提示也已验证。正式断线处理先调用`leave(false)`，该入口包含`chat.clear`，随后显示断开提示。断线字段清理结论结合本轮普通Leave检查、既有generation规则及E-R01未改场景清理证据；本轮没有单独记录最终断线DOM的每个字段。

本轮普通发送使用Enter，不重复各阶段F5路径。分段合并覆盖完整业务，不将原FAIL运行改为单次全项PASS。hardwareScaling8只限制3D raster成本，不证明高清性能或原高清等价。

服务端3205和网页3206/5366/9566均已退出，相关WebSocket、浏览器context、临时账户库及profile目录已清理；最终专属端口无监听。未修改原profile、账户库存或余额。
