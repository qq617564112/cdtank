# 建房密码正式页面验收（UI-07-R-PASSWORD）

正常星号字符投影正式验收 PASS6，三分辨率21张页面截图；专属server、Chrome、Vite与临时目录均清理。原选区文字与背景现由SELECTION切片恢复并单独验收 PASS6，见 `room-create-password-selection-browser.md`；原CaratImage与闪烁状态消费者由 `room-create-caret-browser.md` 独立恢复；原scroll offset逐值等价、字体OS与GPU/display精度仍未完成。

正式大厅的同一个原生 password input 使用独立源星号字体。`node --import tsx tests/browser-room-create-visual.mjs --password-only` 在800×600、1080p、4K检查中文值遮蔽、源字形与宽度、选区、光标横向滚动、鼠标命中、pending禁用、真实拒绝后的密码焦点、Escape关闭。

字体证据同时检查正式输入实际 platform font 是自定义 Password 面，以及派生 U+2022 与源 U+002A 在同一浏览器画布中的完整像素和 measureText 宽度相同；原字体派生脚本另外检查glyph outline与hmtx。正式输入截图直接观察星号，不以font加载成功代替呈现验收。

CDP composition 写入中文预编辑后由 insertText 提交中文，保留原生 password 输入与值；这不证明操作系统候选窗口。64字符长密码的选择、End/Home光标、scrollLeft及中心鼠标命中沿原生输入。真实CreateRoom拒绝使用专属代理暂存原回复，pending截图后释放，核对保留密码及焦点恢复。

证据为 `recovery/output/browser-room-create-password.json`；三分辨率截图为 `browser-room-create-password-{800x600,1080p,4k}-{password-asterisks,password-selected,password-end-scroll,password-home-hit,password-pending,password-rejected,closed}.png`。

原选择前缀规则由正式星号视觉层消费，源与实际选择验收见 `room-create-password-selection-source.md` 与 `room-create-password-selection-browser.md`。原CaratImage与闪烁状态消费者见 `room-create-caret-source.md`；原scroll offset逐值等价、字体OS与GPU精度范围仍在整体PASSWORD父项。
