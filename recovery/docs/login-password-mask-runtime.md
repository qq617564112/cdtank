# 登录密码掩码字体运行时

登录页的密码输入保持原生 `type="password"` 与既有状态持有者，值、选区、光标、IME、长度限制与提交路径均不经过额外明文层。

`source-entry.css` 声明独立 `@font-face` family `CDTank-Login-Password`，直接加载已发布的 `/ui/fonts/SIMSUN-password.ttf`，并仅赋给 `.source-entry[data-entry-page='login'] .source-entry-input[type='password']`。账号输入、字号、行高、布局与键盘行为不受影响，也不要求先打开建房页；建房仍使用其自身的 FontFace 消费者。

family 按来源回退 `'CDTank-SIMSUN'` 与 `serif`；字体未就绪或加载失败时，登录密码输入以浏览器默认密码字形继续渲染。当前范围按源字体默认掩码 glyph 投影描述，不主张完整原字体 GPU、选区矩形、caret 纹理或 framebuffer 等价。

页面实测与 HD 实测尚未执行。
