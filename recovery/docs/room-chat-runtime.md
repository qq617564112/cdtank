# 房间与战斗文本聊天确认闭环（M6-08-R）

正常页面在同一个房间的等待、战斗及结算阶段发送文本，由当前连接对应的玩家和房间决定身份与接收范围。正式网页通过 RoomChat API 等待服务器业务确认，只有接受后才清空仍未被编辑的原输入；业务拒绝或活跃会话中的请求失败显示原因并保留输入；断线清空并关闭旧房聊天。消息显示仅消费正式 RoomEvent，不做本地乐观追加。旧 MsgChat 保留并沿用同一文本资格处理。

## 模块与边界

- shared/protocols/PtlRoomChat：请求只有频道和文本，返回服务器接受的 roomId/playerId/message；没有客户端自报身份或接收者。
- server/rooms/chat：现有文本资格与正式确认API；World只查找当前成员。rooms/transport注册API、按当前session逐次选择同房连接并广播。
- web/network/rooms：唯一正式请求；match/battle只协调活跃会话/断线与聊天室生命周期；interface/battle/battle-chat拥有输入/日志/IME/确认反馈。
- match/battle-input：普通战斗键在input/select/button/textarea及继承contenteditable内部不处理，focus清除已按下的键；聊天焦点期间50ms普通输入可继续发送全零动作，不能误解释文字为开火/转向/道具。

## 原依据与重建规则

最小来源核对见chat-channel-source.md：原ChatPanel/edtNormalUserInput与GameMainShrinkedChat/edtChat均调用CEGUI Editbox::setMaxTextLength(0x48)。当前输入/API限72个UTF-16代码单元；原CEGUI Unicode计数与补充平面字符的对应仍未执行验证，不能称全Unicode精确等价。

服务器已丢失；channel0、自报内容范围资格、trim、空白/控制字符拒绝、房间所有成员可见与接受确认是明确重建规则。100字符的旧重建限制按已证原控件72收拢。原公开/队伍/好友/私密/GM的数值频道、发送权限、原表情转换与消息格式均未恢复；M6-08完整父项保持未完成。这里的房间确认API也不声称恢复原Windows发送协议。

客户端日志最多50条，退出/断线清空，不写账户、不跨房继承；这些是现有网页重建生命周期。成功响应只证明服务器接受并已发起同房广播，不承诺每一收件人的设备已显示，不持久化聊天历史。网络超时允许用户看到错误；客户端不自动重发，以免重复消息。

## 真实重入修复

双网页实际退出后重入已结束房间出现服务器InternalError：rooms/admission允许FINISHED加入，新成员插入后accounts/battle-binding仍调用只允许WAITING的角色/装备来源绑定。正式battle/preparation现在允许WAITING，或FINISHED且原初始combat.status0的尚未出场新成员；World两个绑定入口共用该资格。已参加对局成员的状态不为0，继续拒绝结束后修改来源；原结算快照不变。该资格是重建服务端生命周期规则，不声称恢复原服务器。

room-finished-account.cts以正常准备、退出判负、重新加入和双人再战验证完整来源/装备/有限库存初始化及原参与者冻结，未直接写状态/生命/位置/结果。此修复没有改变PLAYING绑定门禁、来源重算公式或回合规则。

## 验收

本片验收只覆盖文本业务/身份和输入隔离。真实三连接专项检查接受与拒绝、72/73边界、同房一致、异房无消息、普通准备进入战斗后继续聊天及重入身份；两个正常1920×1080页面检查鼠标/Enter/中文文本、原样安全显示、IME确认、发送反馈、焦点期间普通动作不误触发、Escape恢复、退出清理。IME若使用合成composition事件，证据明确标注，只证明浏览器事件保护，不冒称操作系统输入法实测。

检查潜在失败及修复归属：业务拒绝仍清空输入→battle-chat确认流程；跨房泄漏/身份伪造→rooms/chat与transport；文字误触发战斗→battle-input焦点门禁；IME Enter提前发送→battle-chat组合输入门禁；回房旧日志/异步回调复活→generation/clear。改动不影响生命、库存、道具、CPU或回合规则，不重复自然两局/账户重启；协议与入口变化构建两侧，依赖与类型检查覆盖实际接线。

命令：npm run test:rooms:chat、npm run test:rooms:chat:browser；已有网络与RoomFeed回归、两端构建/类型/运行依赖边界。验收已全部PASS：room-chat-network.json/log（真实三账户5接受/5拒绝/9消息）；browser-room-chat.json/md（两正常1080p页面11项检查、六截图、exit0与专用服务清理）；room-finished-account.json/log（初始化、旧来源冻结与普通再战）；room-chat-{account-network,role-attributes,cpu-two-rounds,types,boundaries,build-server,build-web}.log（真实账户保存重启、126角色属性/21战车、五模式各两局、类型/240模块边界、两端独立构建）；旧消息接口和RoomFeed回归分别见room-chat-legacy-network.log、room-chat-room-feed.log。Web构建1m23s，保留既有大chunk提示，未扩大到打包优化。本片M6-08-R勾选，完整M6-08未勾选。
