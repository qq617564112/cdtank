# M6-08-Q 快捷文本聊天闭环

玩家通过快捷聊天设置编辑八条文本，保存后在已加入的房间用F5至F12发送。房间等待、战斗和结算仍调用同一个RoomChat确认请求，由服务器从连接身份确定玩家与房间，仅向同房广播。原文通过textContent显示；不建立客户端假消息或新的数值频道。

## 来源与重建边界

原CDTank/Config/SystemSetting.ini的[QuickChat]包含QuickChatF5至QuickChatF12，现存值全为空。已导出的原settings.xml还包含WindowsLook/Editbox类型的edtF5至edtF12八个编辑框，均无内联Event，不能据此推定运行时回调。原房间和战斗输入的72上限有客户端静态来源（chat-channel-source.md）；完整原快捷回调、频道数值、发送时机及字符计数语义尚未恢复。本片空默认及八字段存在有原文件依据；Web普通按下触发、repeat/控件/模态过滤、UTF-16计数与浏览器本地保存属于明确重建规则，不宣称原settings.xml或全部M6-08已恢复。

## 正式边界

interface/settings/quick-chat-preferences负责唯一配置校验与保存合同，quick-chat-settings负责正常编辑草稿及结果提示。interface/battle/BattleChat使用已有普通确认发送和离场generation，保留正常输入草稿。match/Battle只转发配置，main在注册房间前同步恢复。服务器rooms/chat、协议、账户、CPU、道具资格/效果没有变更；shared不增加单端偏好。

空条目不发请求；有效条目不能超过72 UTF-16码元或包含控制字符。成功/失败不会清除普通输入草稿；服务失败提示原因，预设仍保存。离房或断线清聊天与旧pending，但不丢预设。设置取消不改变当前值，恢复默认只改草稿，保存失败保持已生效配置。已入房且不处于控件/模态编辑或组合键时，F5至F12拦截浏览器默认行为，包括空预设和重复事件，避免游戏内F5意外刷新；只有非重复按下且文本非空才发送。离房保留浏览器默认行为。

## 验收入口

npm run test:rooms:quick-chat 为规则/DOM夹具专项；不替代真实页面。
npm run test:rooms:quick-chat:browser 为专用双网页、真实普通键盘与RoomChat确认、1080p/4K、同profile重开及断线重入证据。
最终状态只在tasklist.md原位登记。既有服务器拒绝/异房隔离由room-chat-network.json证明；本片不伪造正常玩家无法产生的无效RPC。
