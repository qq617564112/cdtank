# 正式大厅整体画面与导航

M5-02-R-PAGE记录正式大厅的整页框架与业务接线；M5-02/UI-46完整原界面精度保持未完成。原基准为800×600，当前Web按统一比例居中呈现，高清缩放属于Web接线范围。

## 正式页面与操作证据

browser-lobby-source-page-accepted.json汇总800×600、1920×1080、3840×2160完整页面、目录选择/排序/分页、模式地图和中文建房取消、普通加入WAITING与源Close离房、我的家/商城及玩家功能导航。中文聊天、候选Enter和大厅/房间键盘隔离引用lobby-chat-browser.md。具体范围与原运行状态见lobby-source-page-browser.md；联合有效范围不代表单次全流程或原像素精度全部通过。

主背景引用ui/regions/55/1.png原datingditu；房间目录、右名单/玩家好友页签与底聊天按源位置绘制。PlayerTab/FriendTab及54×54选中图采用绝对定位，选中图自身形成内部图块的定位父容器，全局位置分别为(636,97)、(711,97)。browser-lobby-whole-page-accepted.json引用09-52-33-487Z的三分辨率整页和普通页签/Home/Shop返回焦点证据；昵称编辑检查仅证明当时Web账户入口，不能作为原顶栏依据。

正式LobbySourcePage没有重建identity插槽及顶区样式。browser-lobby-source-identity-2026-10-04T15-20-44-765Z.json的已完成范围覆盖800×600无data-lobby-identity/#player-name覆盖、背景/目录/右名单/聊天区域在场及引用图片解码、Home/Shop普通关闭返回原入口焦点。对应-lobby-800.png已实际查看；整run状态保留在原记录中。

正式roomlist主区以embedded形式常驻；独立卡片dialog、工具栏与昵称编辑保留在validation.html。诊断昵称由既有LobbyIdentityView调用权威账户接口。browser-lobby-source-identity-2026-10-04T15-26-36-216Z.json为PASS：普通鼠标点击、中文输入“大厅诊断玩家”、确认提交收到DisplayName成功回复，刷新后查询同一权威昵称；对应-validation-identity.png已实际查看。3354/5404/9604隔离服务、浏览器、Vite及临时目录已清理。该定向补验只覆盖迁移后的诊断昵称能力，未重跑未改大厅三分辨率与业务链路。

定向命令：

```sh
node --import tsx tests/browser-lobby-source-identity.mjs --validation-only
```

## 限制

原同状态客户端framebuffer、ImageManager对beijingditu0的DDS/TGA选择、字体光栅及高清GPU精度未闭合。当前400×300背景放大到800×600及高清页面，不能证明原高清背景等价。

roomlist.xml的all下picTopBanner局部矩形(46,-80)–(558,48)，叠加all顶部84后为全局(46,4)，512×128；Image、四边框图和事件均为空。default.xml只有根Sheet与主背景。顶栏图像/内容及身份区运行时生产者尚缺，不能补造Logo或昵称编辑位置。

顶栏缺失入口定位：CDTank.exe的RoomListPanel/picTopBanner字符串位于0x5d57a0，0x5077b6取控件并在0x5077de保存到大厅对象+0x264。0x5077f0读取全局0x635830，取其+0xc4列表，经0x507241复制至大厅+0x268；列表非空时0x50782a取当前图像并调用CEGUI StaticImage::setImage（导入0x5c013c）。缺少全局列表图像的实际填充生产者、运行时内容及同状态framebuffer，尚不能恢复顶栏。来源为现有PE字符串、引用和指令读取，未做原执行验收。主线已暂停该项，不继续调查或补验。

房卡名称与三种人数控件未指定Font/TextColours，FrameEnabled=False；room-card-text-source.json绑定原StaticText构造0x100b1580的四角FFFFFFFF及System默认SIMSUN。SourceStaticText保持源白色，浅色卡片背景上的对比有限；编号使用显式MediumHT，白色乘数保留原黄色数字图片。原房号文本生产、完整字体及显示锚点仍未完成。

以上来源缺口保持M5-02/UI-46未勾；同一已停缺口不重复定向调查，不以整页结构与业务可用代替完整1:1精度。
