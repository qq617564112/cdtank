# 收到表情的颜色显示

普通聊天收到显式 `<emote name=001 red=0 green=255 blue=0 alpha=255/>` 时，原解析器为该项产生 RGBA `[0,1,0,1]`。正式 `ChatEmotes` 将该颜色应用到原序列图片，仍使用同一个按名字共享的动画 provider。普通 glyph 展开为完整白色 RGBA；显式 emote 缺颜色属性时，各通道默认零，图片透明但保留原布局与动画参与。

`interface/battle/chat-emote-colour.ts` 为非白项创建局部 SVG filter，以 sRGB 的 `feComponentTransfer` 逐 RGB 通道乘原项颜色；alpha 使用图片 opacity。filter 不更改源 PNG、序列定义或共享时钟，因此同序列的红、绿、白消息各自显示颜色。动画更新仅更换 img 的源帧，保留该项滤镜。白色项不用滤镜；静态 image 标签保持原独立全白合同。

滤镜随所属消息项创建和删除，不保存在独立的全局资源池。重新排版替换旧项；历史裁剪和离场移除旧 DOM，现有动画 owner 清理断开调度。每个滤镜 ID 在当前页面唯一，多个消息节点不交叉引用颜色。

原消费者完整执行到 `SequenceImage → ImageFrame → Imageset::draw`，同一 RGBA 传到四角。来源及明确的纹理/Renderer provider 边界见 `chat-emote-colour-source.md`。Web sRGB 乘色是浏览器 renderer 对原四角颜色的映射；当前证据不证明 Windows GPU 混合、裁剪和采样逐像素一致。

可复现命令：

- `npm run test:chat:emote-colour:source`：八条原消费者/绘制向量。
- `npm run test:chat:emote-colour`：正式 parser 的 RGBA 对照原 item、四角及序列/帧绘制参数。
- `npm run test:chat:emote-colour:browser`：普通双账户消息、双端颜色、实际屏幕像素、动画、高清界面及清理；诊断采样的显示环境和业务证据范围见 `chat-colour-browser.md`。

本片不修改服务端消息身份、路由、账户、CPU 或库存规则。未知序列 lookup、缺图异常显示与原字体测量继续由未完成父项管理。
