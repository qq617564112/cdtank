# 拥有战车迷彩生产接入（M3-03 / M5-07 / M6-01）

明确导入并持久保存的拥有战车，现在按记录+28/+2c/+30使用选定U/M/XY纹理。原消息字段、拥有记录查找与详情页选择合同由owned-tank-textures-sol.md验证；tank-texture-catalog.md提供711条原记录、680个精确DDS请求映射及112个显式缺失。没有来源的账户不获赠战车或迷彩。

## 账户与对局

readOwnedTankTextures返回三个unsigned32字段，保留零和高位；缺少任一字段时返回undefined。MyHome战车页与装备页将明确拥有记录传给HomeTankPreview，同定义的不同实例/迷彩具有独立加载身份。World使用已冻结的BattleRoleSources产生可选tankTextures快照；WAITING换装取消准备，开局和再战继续使用同一持久来源。TSRPC协议增加可选字段，旧字段编号保持。

这条服务器快照是重建服务端传递入口。原客户端资料selector44为帽子装饰，不参与迷彩三槽；原属性32产生者尚未证明，生产没有调用原拒绝的setArray(3)，没有将重建广播称作原消息赋值。

## 实例与动作

TankView加载时按实际有动作的组件请求选定目录资源，XY同时预载A/B。零选择保留原材质；非零选择必须属于该战车定义，并有对应组件/精确资源，否则显示加载失败。初始X/Y共同使用XY A，符合原已确认设置入口。运动切换需原目标空间更新门禁，不能按网页位移推断。没有U动作的TankType4不请求U，目录保留空U项也不加载。图片直接由选定DDS输出PNG，Texture使用invertY=false、LINEAR及U/V WRAP。

组件加载之后applyMv3Materials接收明确Texture，将原17字段与透明规则保留，并允许覆盖旧dipan/pao/lvdai非空缺名。覆盖只作用于该实例组件；切换待机/移动/开火/死亡/复活动作沿用同一实例纹理。选定Texture不进入动作AssetContainer.textures，动作释放不删除它。TankView.dispose等待缓存及尚在加载的动作清理，再释放自己所有选定Texture。失败加载清理已加载资源；旧异步玩家加载若与当前快照迷彩不一致则释放，后续快照重试。

## 验证

- npm run test:combat:owned-textures：112原消息/记录/三槽对照和缺字段门禁。
- npx tsx tests/account-battle-role-sources.cts：210持久来源组合与World准备、冻结、再战、重入；快照保持显式三槽。
- tests/browser-owned-tank-textures.mjs：两种明确迷彩、五种实际动作；正确组件Texture URL、原shader编译与sampler、独立资源身份，释放首实例后第二实例继续渲染，最终scene资源计数恢复，非零缺记录及跨战车来源失败无泄漏。证据browser-owned-tank-textures.json、owned-tank-textures-actions-browser.log。
- tests/browser-tank-texture-material-sol.mjs：实际framebuffer的选定颜色、实例隔离、重应用、透明100/101及借用纹理释放，见tank-texture-material-sol.md。
- tests/browser-home-roles.mjs：正常拥有选择、1080p/4K原picModel、刷新/重启保存及拒绝恢复；21辆战车明确fixture选择各自原表资源，逐正常列表选择显示并退出清理通过（browser-home-roles.json、owned-tank-textures-home-browser.log）。
- npm run test:cpu:owned-textures:browser -- <CDP>：双正常网页分别导入两种已拥有迷彩，正式服务器快照与两端实际组件URL一致，三CPU/本人账户托管普通输入两局自然目标终局，71.5/106.8秒、62/93次同tick状态一致；Effect11/GA15、唯一饲料1→0、结算冻结/双真人投票再战、退出/重启/零库存新房及默认手动通过（browser-account-autopilot-owned-textures.json、owned-tank-textures-autopilot-browser.log）。画布426×240，为功能验收；完整迷彩高清性能另待M7。
- tests/browser-home-equipment.mjs：装备页按已保存战车显示选定迷彩，鼠标装卸/替换、键盘卸下、拒绝恢复、1080p/4K、刷新/重启和关闭清理通过（owned-tank-textures-equipment-browser.log）。
- 五模式托管普通输入各两轮与真实账户网络回归通过（owned-textures-five-modes.log、owned-textures-account-network.log）。
- 构建owned-tank-textures-build.log通过；最后类型检查owned-textures-final-types.log通过。

## 剩余验收

原购买/赠送/迷彩改装授权和费用、specialtank到拥有记录转换、角色属性32来源、履带运动A/B切换，以及全部源皮肤组合的原D3D像素仍待恢复。此接入可使用明确导入账户来源，不使M3-03/M5-07/M6-01整项完成。
