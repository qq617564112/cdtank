# 正式房间密码组合输入与取消

M5-02/UI-65。RoomPasswordDialog 消费 userinput_dialog.xml 原307×120根、三背景、txtMessage、edtInput与OK/Cancel；该弹窗用于现Join密码请求，为Web业务附着，原绑定事件未证。根布局和资源来源沿现房间密码与昵称源页面，不重新调查显示producer或重跑三分辨率。

归属仅 room-password-dialog.tsx 的根键盘与取消处理、独立browser/doc。所有Escape先preventDefault并stopPropagation；仅非pending且非composition、nativeisComposing时关闭。native cancel同样在composition保持窗口，中文草稿仍由原输入限制hook和React state持有。现Join/账户/房间权限/room-controls返回焦点/Babylon不变。

专属 tests/browser-room-password-composition.mjs 采用两独立普通网页账户，正常原建房设置中文密码，客端原房卡/加入入口打开源密码根，真实错密码拒绝保稿/输入焦点；合成composition状态与可信CDP原生Escape验证保持窗口、草稿及window漏键空，单独cancel事件验证相同门禁。结束composition后原生Escape关闭回原房卡严格焦点，再正常中文密码Join与源Close离房。0BUY/SelectRole/Ready/对局。该composition检查不证明系统输入法候选窗口。

当前原密码glyph/selection/caret、原父附着/最终字体与完整1:1仍未完成；本范围仅取消门禁与键盘隔离，不扩大为原页面精确恢复。

## 有效证据

19-42-25-621Z 原raw整体FAIL保留，accepted仅引用rejection/compositionEscape/nativeCancelCompositionGuard/escape/correctChineseJoin已走完字段。真实Join先ROOM_JOIN_REJECTED后成功；错误中文草稿不丢，原catch排RAF恢复input焦点，组合状态下CDP原生Escape保持且window键空，结束后Escape关闭回房卡严格焦点。末Leave未验，专属server/浏览器finally已清理，不由rawFAIL推整次PASS。focused Webtypes exit0。

唯一1920拒绝根图亲看：源根及按钮可用，但框下默认黑字错误原因压住大厅按钮，不可读，当前单列未完成。原基准/三res及旧房间事务不重跑。

## 错误反馈与最终清理

专属room-password-dialog.css及data-room-password-status提供深底白字普通流Web错误区和aria-live；空状态hidden，不改变源背景或Join。19-45-02-101Z --readability-only raw PASS，仅真实错密码拒绝定向1920一图亲看可辨，文本白色/背景20,43,77，614×40物理区域完整在dialog和viewport内。源Cancel关闭后严格回原卡，host等待页源Close正常离房回大厅建房入口。没有重组合键位、正确Join、三res、BUY或Ready/对局。最终focused Webtypes exit0；accepted组合引用前段有效字段与本段，不把前整体FAIL改PASS。错误反馈为Web呈现，原原生事件/高清精度与UI65父项保持未完成。3385/5435/9635和临时目录清理，代码stable交主线统一发行。
