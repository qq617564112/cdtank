# 设置页画质与卡通渲染偏好

M5-12 / UI-50。`settings.xml` 的三个源控件 `rdoLow`、`rdoHigh`、`chkSilhouette` 已接入设置草稿、确认、取消、恢复默认和错误反馈。其余 `rdo16ColorDepth`、`rdo32ColorDepth`、`chkWaitVSync`、`chkSoftwareCursor`、`zhandoubiaoqing` 保持未接入。

## 原字段

`CDTank/Config/SystemSetting.ini` 的 `[Display]` 记录 `HighPrecision = 1`、`Silhouette = 1`。`settings.xml` 中 `rdoLow` 与 `rdoHigh` 是 `GroupID=2` 的 RadioButton，`rdoHigh` 对应 HighPrecision；`chkSilhouette` 是独立 Checkbox。三个控件均保留原 AbsoluteRect、Normal/Hover/Pushed/CheckMark 图和父矩形。

`HighPrecision` 的原完整 D3D producer 未恢复，本批高、低画质采用明确的 Web 后备缓冲比例策略。`chkSilhouette` 复用已登记的 `cartoon-outline` Web 入口；原 Windows 回调、原 HighPrecision 含义和原 D3D framebuffer 均未由本页恢复。

## Web 合同

`apps/web/src/interface/settings/display-preferences.ts` 的持久类型只有两个布尔值：

```ts
export interface DisplayPreferences {
  highPrecision: boolean;
  silhouette: boolean;
}
```

默认值为 `{highPrecision: true, silhouette: true}`，存储键为 `cdtank.display-settings.v1`。读取缺失值、未知值、坏 JSON 或非法布尔时恢复默认，并区分无保存与损坏/不可读；写入只在两个合法布尔值均可保存时返回成功。浏览器偏好属于本机 localStorage，不是账户或服务器字段；不新增迁移、schema、协议或 feature flag。

`initializeSettings` 在 React 首帧前恢复并应用显示偏好，并把读取结果放入 `display` 供 `SettingsSourceView` 显示初始消息。设置页草稿以当前 active 对象为初值，不重新读取损坏存储覆盖 active。确认时键位和快捷聊天保持既有分范围保存流程；显示偏好只有完整写入成功后才应用到 active 并通知运行时，保存失败时显示草稿保留、对话框不关闭且 active 显示属性不变。恢复默认只还原三组草稿，不即时应用；取消、关闭和 Escape 不写显示偏好，也不改变运行时。

高、低画质单选互斥，卡通渲染独立。高画质保留当前 Engine 的 `adaptDeviceRatio=true` 真实 DPR 后备缓冲比例；低画质的 3D 后备缓冲宽高为高档一半，CSS 视口与 current DPR 不变。比例使用真实 `window.devicePixelRatio || 1`，DPR 小于 1 时仍保持高一档 `1/DPR`、低一档 `2/DPR`。切换时当前 engine 即时调整并 resize，后续窗口 resize 和 DPR 变化仍按选档比例。实现不写固定 `hardwareScaling1` 覆盖 DPR，也不以低分辨率结果声明高清性能通过。

Type8 屏幕 `EffectOverlayDrawState` 随实际 engine 后备缓冲更新 `width`、`height`，保留 UV retention、颜色、`f32` 和 native vertices，不沿用构造时旧尺寸，也不另开材质或纹理。

卡通渲染只调整已注册合格 Mesh 的 `renderOutline`，保持黑色 RGB、Ink 0.65、原 InstancedMesh source、动画和 morph、alpha 混合与 planar alpha-test 排除规则，地形不描边。已加载模型、已注册 source 的实际克隆、设置后的异步新增模型、动作切换和新 scene 对象读取当前 active 值；不创建新 Mesh/Material、不复制 geometry、不逐帧扫描全部 mesh。`sourceMesh` 只注册一次，已注册 source 通过 `onClonedObservable` 将合格克隆 Mesh 接入同一偏好注册，clone observer 自身也随 Mesh/Scene dispose 解绑并释放引用，scene-runtime dispose 解绑 preference listener。

## 源界面

`SettingsSourceView` 的 DOM 仍保持当前 800×599 父链、ImageScale 和原 CSS 尺寸。三个控件使用原按钮矩形和原图；RadioButton 通过原 `selected`/`aria-pressed` 语义显示互斥选择，`chkSilhouette` 使用局部 `SourceStaticImage` 叠加真实 CheckMarkImage，checked 层保持 `pointer-events: none`，不改共享 `SourceButton` 逻辑。HUD、字体资产、源 pose、其它按钮键区、20 键、快捷聊天、音量、浏览器全屏、焦点捕获和现有存储键均保持。

本批未运行 tests、browser、build、typecheck、native、高清或保存重启实测，也不把新偏好扩写到既有 0007/战车1 outline 证据或全图证据。M5-14、UI-50、M3-03、M4-07 与 M7 父项保持未完成。
