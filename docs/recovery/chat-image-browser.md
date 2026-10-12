# 收到 image 标签浏览器验收

`node --import tsx tests/browser-chat-image.mjs`：PASS。证据为 `recovery/output/browser-chat-image.json`、同名前缀服务端日志和四张 1080p/4K 历史/最新截图。

两名普通账号通过创建房间、加入、同队、添加 CPU 和 Ready 进入 PLAYING。公共和队伍消息从源按钮选择频道，以普通 Enter 提交，每条玩家输入不超过 72 字符。实际 RoomChat 请求及两端 RoomEvent 均保留完整 raw 标签、发送者 playerId 和频道；展示层仅显示源解析后的文字、静态图及表情。

`<image set=gy0 name=data\ui\gy\lt1.tga/>` 和 lt8 标签查找原 gy0 imageset，使用 DDS 优先目录的 `ui/regions/60/187.png` 和 `185.png`。浏览器实际解码两张 20×20 PNG：lt1 alpha 为 0–204，含 12 个完全透明像素；lt8 alpha 恒为 204。静态 image 逻辑宽高和完整绘制宽高均为 20，左上偏移为 0，行距仍为 16；动画 emote 保留原左偏移 1、绘制宽度减 1。两端混排几何相同，static image 保持白色且忽略 width/red/alpha 及父 colour，静态资源不参与 emote provider 时钟。消息中的重复 glyph001 使用同一原序列时钟并自然经过两个源帧。

DPR1 1920×1080 与 3840×2160 验收原几何、Home/End 历史/最新滚动和正常离房清理。4K UI 的 3D 画布为 480×270，hardware scaling 为 8；本验收不提供 FPS 结论。专属服务端 3210、Vite 5242、Chromium CDP 9312 均已退出，临时账号数据库和浏览器 profile 已删除，端口无残留监听。

## 限制

缺 imageset 或 image 的 Web 重建行为为 `unsupported-source` 字面回退；这不是原 native 行为。源已确认 lookup 失败构造 `UnknownObjectException`，其跨调用者后果尚未闭合。本片证明成功资源业务；完整 M5-12-E-X-I 仍未完成。
