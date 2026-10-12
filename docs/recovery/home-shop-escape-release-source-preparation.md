# Home 与商城根 Escape 松键隔离

M5-07 / M5-09 / M5-10。四个正式 dialog 根分别为 HomeInventory、HomeRoles、HomeEquipment 和 AccountShop；原 Escape keydown 直接 requestClose，使 React 卸载或关闭当前模态并由 App/cleanup 恢复大厅原按钮，窗口的 keyup handler 已不能拦截松键。

四份原 owned 文件仅新增 escapePending ref：down preventDefault 并记录，keyup 在当前 dialog 内 stopPropagation、清记录后调用原 requestClose。native cancel、pending 与原焦点/清理/事务保持，source 图片和字体不变。Settings 返回按钮位于仍存在的 Home dialog 内，其 keyup 已由 Home 根消费，未扩入本片。

browser-home-shop-escape-release.mjs 仅备四 root keyboard-only 首范围。使用既有合法 home-tank-active-marker checkpoint，经 node:sqlite readOnly backup 到独立临时库，原保留库不写；旧账户有真实拥有来源，原资金 fixture 前提沿原记录明示，不注入库存或资金。浏览器 Page.enable 后绑定原私有 token，并使用不输出 token 的严格比较。正常 Home→物品、宠物、战车→Equip 和 Lobby→Shop；各 down 保窗口与内部焦点，up 关闭、strict 原大厅按钮、window down/up=[]。resolutions=[] / screenshots=[]，不购买、不选择出击、不装备、不建房、无新交易。

四 production hunk 于 2026-10-05 02:25:25 UTC 原子稳定，已提交主线核统一构建边界。runner 语法通过，四根有限组合实际已通过；最终证据、主线工程与未完成边界见 home-shop-escape-release.md，旧全页图与业务证明复用，完整父项不关闭。
