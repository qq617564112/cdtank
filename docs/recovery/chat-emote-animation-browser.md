# 原收到表情序列动画浏览器验收

运行 `node --import tsx tests/browser-chat-emote-animation.mjs`。专属服务器3206、Vite5238、Chromium CDP9308，双普通账户同队，添加敌队CPU后普通准备进入PLAYING。

公共和队伍中文消息包含原Unicode表情符号，实际解码RoomChat请求、成功响应和双方事件，核对完整消息及发送者身份。收到日志消费原默认001–030序列，不使用输入字体base图；全部72帧PNG独立加载并核对源尺寸。

动画采样采用800×600视口、deviceScaleFactor 0.5，即400×300实际画布；高清布局独立恢复deviceScaleFactor 1，以1920×1080和3840×2160保存截图并检查原舞台几何。只读requestAnimationFrame采样记录img的elapsed、frame、src、尺寸和实际解码状态。按原float32累计时间、首个累计大于等于elapsed的帧规则核对当前图；按相邻帧真实时间核对float32推进及严格大于总时长时仅减一次。实际001自然轮换两个帧，同一日志内重复001跨行共享同一相位，不按实例数重复推进；新增消息沿用已有相位。双方各自持有本机时钟，不要求同相位。

普通逐项输入生成全三十符号并真实发送，核对所有unique序列。保存1080p和4K截图。离场后无聊天图片，旧节点属性不再更新；正常新房间开战后序列管理器保持原相位，遵循原当前帧或none状态。脚本结束关闭专属进程并删除临时目录。

## 验证边界

来源为 `chat-emote-render-source.md` 的SequenceImage更新、绘制和管理器共享合同。输入框和选择列表仍用静态图。本项不验证完整XML解析、混合字体布局逐像素复刻、原滚动与外层隐藏控件调度，不以序列动画验收替代完整CEGUI父项。软件渲染高分辨率可能产生大delta，原算法仅减一次周期，elapsed超过所有累计帧时返回none并隐藏图片；保留相位的重入也允许该原状态。此项不保证高清实时播放帧率。没有向生产时钟或provider注入值，仅监听DOM并采样真实RAF。

证据：`recovery/output/browser-chat-emote-animation.json`、`.log`及同名前缀PNG。

正常生命周期补验可运行 `node --import tsx tests/browser-chat-emote-animation.mjs --reentry-only`；该模式复用已保存的双页消息、全三十序列、高清布局和释放证据，并新增普通两房间管理器保留合同的实际采样。
