# 正式设置中文组合 Escape 门禁

UI50 / M5-12。正式 settings.xml 八个快捷聊天输入沿现确认草稿/保存规则。SettingsSourceView 的 Escape 关闭分支先于 native isComposing 判断；原 onCancel 无组合状态门禁，中文组合期间可能关闭整页并丢弃草稿。

限定修正归属 settings-source-view.tsx：组件 ref 记录 compositionstart/end，Escape 先 preventDefault，仅非组合时取消 capture 或关闭；原 native cancel 在组合期间保持窗口。保存、键位、音量、资源、源几何、App 和其他模态不改。

专属 browser-settings-composition-escape.mjs 准备 keyboard-only：普通空账户经 Home 正式设置，真实 Input.insertText 中文草稿、同目标 CompositionEvent 生命周期与 native CDP Escape 验窗口/稿/focus；native cancel 事件保持；compositionend 后 native Escape 关闭恢复原设置入口，再重开确认未保存草稿不写，Home 返回严格焦点。resolutions=[]，无新截图/BUY/对局/发送/保存，旧设置图和业务证据复用。

生产门禁已落，settings-composition-escape-web-types.log exit0。实际 browser-settings-composition-escape-2026-10-05T01-51-35-587Z.json PASS：中文组合草稿/nativeEscape保窗口与输入焦点，windowkeydown=[]；组合期间显式cancelEvent不关闭，结束后nativeEscape关闭严格回原设置按钮，重开未保存草稿不保留，HomeClose严格回Home入口。resolutions=[]/screenshots=[]，普通空账户只读资料/库存查询，无购买、对局、发送或设置保存；独立server/vite/Chrome/temp清理。主审有限范围已接受；five-feedback-settings-final-production-web-build.log 全 Web 类型检查与正式构建 exit0，包含最终组合门禁，dist/release 已更新。该仪器仅证明组件组合生命周期和原生键合同，不证明完整 OS IME 候选窗口、语言系统或原客户端输入法呈现。
