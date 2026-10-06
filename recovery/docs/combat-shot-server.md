# 普通自由瞄准射击显示接线

`fireProjectile`沿现有`createRoleFreeAim`生成float32端点，World接受普通射击并提交装填期限后，fire事件附带`shotDisplay: {itemId: 2001, x, y, z}`。原fire坐标仍为射手位置。该显示在射击时产生，与后续弹丸命中事件独立；装填拒绝不产生新的显示。

依据为原4288fe无玩家/场景目标分支：角色look×1000加位置后，428a55即时调用423956。原item2001加载器写第二技能4020，skill4020加载器读取Effect7和SE30。TankShotDisplay依目录选择第二技能第一效果；EffectRuntime世界消费者使用原端点与视锥裁剪，声音消费者使用无位置的原2D分支。clip拒绝图像不抑制独立声音。

Battle在账户入房资源加载后创建消费者，只有fire附显示消息时调用。离房清消费者引用，现有EffectRuntime离房、断线、再战clear释放世界效果与声音。React页面不拥有此状态，也不参与效果帧更新。

`tests/combat-shot-world.cts`通过普通PlayerInput→实际World接受事件→生成TSRPC schema二进制往返→装填拒绝，证据为combat-shot-world.json/log。公开快照yaw只保留四位小数，因此从快照反投射1000单位端点使用0.11单位观测界限；正式消息坐标自身保留float32，二进制往返严格相等。消费者来源向量由combat-shot-display.cts单独验证。实际绘制和声音以专线浏览器验收为准。

## 未恢复范围

Web现有普通射击采用自由瞄准，是明确重建的目标选择范围。原玩家目标分支不调用423956；场景分支使用原射线距离且Y=25，选择优先级与Web尚未接齐。本片不证明所有开火均应在1000单位端点显示，也不证明真实命中效果。现有弹丸球体、速度360、寿命2.2及伤害公式仍是已有原型规则，M2-04保持未完成。
