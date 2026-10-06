# Skill13世界效果

M4-09-SKILL13-WORLD通过，无需生产修改。原skill13首槽为Effect10、SE02、Tag0、Method3。roleId=0的原通知分支将EffectN格式化为online根名，以原float32位模式解出worldX/worldZ并使用[x,0,z]，随后返回；不调用角色attached或外层声音。Effect10树无Type4，因此世界路径保持静默，未用目录SE02补声。

原非保留树根2462包含2462、2463、2464、2465、2466、2467、2468、2558、2559、2560；六个strip、一个particle、一个sprite共八个绘制节点均引用已发布资源。原role0通知调用顺序来自skill-effect-message-native.json，world视锥外跳过创建来自skill-effect-actor-native.json。

Chromium经正式BattleSkillEffects/createSkillEffectNotifications，以两个float32世界坐标创建独立无挂点树，八类实际几何及两实例16draw可见像素通过。角色移除不清理无owner世界实例；显式停止第一实例保留第二实例及原mesh，后者继续实际绘制并自然到期释放。视锥外世界点不创建。sameScene stop/start重进恢复八绘制与可见像素，退出清空实例/声音，终端Scene销毁关闭所属上下文。全程实际voice为0。

运行`npx tsx tests/effects-skill13-world.cts`及`node tests/effects-skill13-world-browser.mjs <CDP WebSocket URL>`，浏览器使用5209的现有skill-effect渲染入口。证据为effects-skill13-world.json及effects-skill13-world-browser.json；原通知9序列/44调用状态回归保持通过。

## 验证范围

普通world通知由专项供给，验证现有consumer、世界实例及真实绘制，不证明skill13轰炸业务Func16、服务端资格或实际世界通知触发已恢复。坐标位解码和原handler合同核对，不代表全内容原framebuffer逐像素对照。
