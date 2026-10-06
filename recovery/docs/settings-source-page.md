# 正式系统设置页

UI-50对应settings.xml原800×599根all，基准800×600。新增SettingsSourceView持有一次打开的键位与F5–F12草稿、捕获、资源加载、错误与音量状态，SettingsSourcePage消费全部带Image的原StaticImage窗口；原按钮三图和滑块Thumb/Track图片直接引用XML。图片与控件矩形沿完整父链，现Web以min(width/800,height/600)居中；原高清规则未证明。

原edtF5–F12保留现72字符验证和中文输入，确认成功才更新Battle快捷聊天。四方向/开火/使用道具/循环武器道具的主备用键用现getKeyBindings、支持按键与冲突检查、validateKeyBindings和浏览器保存，主/备用键冲突时保留原键位；捕获按键停止传播，输入法组合事件不作为键位，单独 Ctrl 物理键可捕获而 Ctrl+字母仍拒绝。音量沿现即时设置与保存，取消不回滚音量；键位与快捷聊天是独立保存范围，错误明确保留当前未成功范围，未建立新事务。确认/默认/取消为现业务组合，原回调producer未证明。状态提示放原顶部蓝条空区，明确Web呈现。

原UseItem/PrevNextWeapon/PrevNextItem现对应 `useItem`/`prevWeapon`/`nextWeapon`/`prevItem`/`nextItem` 五个正式 `InputAction`，各自0/1原主备用矩形成为正式捕获按钮，不映射到离散slot1–8。五新动作主键可选、可单独清除；旧15动作主键继续必填。设置页只接绑定与捕获，运行期请求与循环边界见 battle-cycle-controls-runtime.md 与 settings-cycle-controls-client.md，源字段事实见 battle-cycle-controls-source.md。窗口/全屏已接浏览器 Fullscreen API 即时切换；rdoLow/rdoHigh 与 chkSilhouette 已接当前显示草稿、保存和运行偏好。VSync/光标/色深等其余五个源选项仍以禁用资格展示，不伪造生效；缺DisabledImage使用NormalImage+.55为Web禁用呈现。原方向/开火StaticText以透明原矩形按钮承载现捕获，字形与原事件未证明。

归属仅新增settings-source-view.tsx、settings-source-page.tsx、settings-source.css与专属browser/source/doc，旧Key/QuickChat/Volume组件不修改。现高级KeySettings的业务必须继续保留玩家入口，不能当作纯诊断移走。

## 主线接线合同

主线拥有apps/web/src/app.tsx。导入SettingsSourceView，传open、close、battle、initial:InitialSettings与onKeysSaved:(bindings:KeyBindings)=>void。正式Home框下“系统设置”业务入口打开source-settings，关闭明确回该仍打开Home的入口；validation保留旧三个设置组件。独立高级键位入口继续旧KeySettingsView。此代码不要求新增网络或共享Battle方法。

主线已补共享SourceButton suffix settings.xml；页面按钮复用共享原pointer/keyboard状态与XML三图，缺DisabledImage的禁用图采用明确Web NormalImage+.55呈现。

## 实际整页与普通操作

settings-source-page-accepted.json以组合字段范围交主线审查。browser-settings-source-page-2026-10-04T17-57-11-896Z.json原整体FAIL保留，采用其cancel/conflict/audio/sizes/saved/defaults有效字段；最终键盘隔离、焦点及高级入口由18-00-04-116Z --navigation-only PASS独立证明。

首验三张-settings-800/-settings-1920/-settings-3840.png完整页面全部已实际查看，原800×599根与图框、音乐音效、四方向/开火主备用键、八聊天编辑、禁用图形与底三按钮可见，整体留边与可读文字在800×600/1920×1080/3840×2160成立。该三图保留首次历史范围，不重新宣为新增 display/source 像素PASS。现源键区为四方向/开火/使用道具/循环武器道具共10区、每区主备用2键，20个原矩形捕获按钮；首验时仅四方向/开火10个字段已实测，其余为本次新增未实测。实际48张源StaticImage区域、8编辑框、2音量与10禁用选项由原父链消费。原字段字形、NativeSlider旅程与原高清规则未证，不能据此宣完整1:1。

普通前进主键Q与中文草稿取消后重开仍W/空白；与已占用S冲突保留捕获，Esc仅取消捕获；八条F5–F12普通中文输入与前进Q草稿确认保存后关闭，真实浏览器持久值与重开一致。音乐鼠标/方向键即时变更，控件值与AudioPreferences保存一致；这只验证当前设置消费者，不新声明音频输出实听。默认把键位与八聊天恢复草稿，取消后仍保存Q/原八聊天。

定向18-00-04-116Z仅检查Escape、主备用捕获/冲突/取消及导航，不重复上述三res/保存/音量/默认。前进Q草稿与Fire备用Q冲突拒绝，捕获Esc保持dialog，Fire备用E成功草稿后普通Esc关闭，两类草稿均取消；窗口keydown observer漏键0。重开初值W/无备用，源Close回同系统设置入口。历史验收中，原高级KeySettings玩家入口实际打开15动作，最终关闭我的家回正式大厅Home焦点。当前入口已扩展为20动作，新增五动作未实测。Escape在页面keydown内先stopPropagation/preventDefault再关闭，不依赖native cancel后的卸载事件。上述历史证据仅覆盖原15动作。

settings-source-types.log记录最终Webtype PASS。两次3376/5426/9626与临时目录清理均true；主线统一必要最终batch发行，本片不重复全build。

## 未完成

图形配置中未接的VSync/光标/色深等源选项、原确认/默认/取消回调、字段字形、滑块精确旅程和原高清锚点、全107控件及1:1仍未完成。UseItem/循环武器道具已接五新动作绑定与设置捕获，运行时接口见 battle-cycle-controls-runtime.md、settings-cycle-controls-client.md，但未实测；历史UI-50组合证据只覆盖原15动作，不扩给新5。窗口/全屏、低/高画质与卡通渲染源控件已接正式设置草稿和运行消费，但本批未实测真实画质、描边、保存刷新与重启。事件与持久规则沿现重建业务明确记录，未知项不假接；UI-50父项不勾。

主线已审实际1920整图、偏好消费者与定向键盘导航raw，组合限定范围接受；正式App入口/焦点与共享SourceButton接线完成，生产Webtypes与最终Vite构建1m31通过。原107控件和未支持业务父项保持未完成。
