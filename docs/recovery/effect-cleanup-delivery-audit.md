# 特效清理交付核对

M4-07 当前已接入玩家业务的生命周期检查通过。技能通知的停止、自然结束、角色移除和对局退出分别进入既有生产清理入口；两名角色同时使用回旋饮料时，停止或移除第一名角色保留第二名角色的原实例、挂点和七个几何对象，第二实例自然结束后几何、材质及声音句柄归零。本次未发现需要修改生产代码的清理缺口。

## 生产边界

`SkillEffectRuntime` 将通知停止接到 `EffectRuntime.stopEffect/stopSkillSound`。`EffectRuntime.remove` 先释放效果树状态和树内声音，再释放该实例的 sprite、particle、overlay 和 model 绘制对象；`detach` 仅移除匹配 owner 的实例。`clear` 清除相机抖动、技能声音、全部实例及树声音。材质缓存归 `EffectModelRenderer` 实例，源模型与纹理由运行器共享。

首件治疗的单次声音可在角色移除后自然结束，对局停止则立即清除；死亡、复活和无保留记录的停止通知均不会重新播放治疗效果。该行为由生产生命周期测试覆盖，原死亡/单次声音策略仍保留其既有来源范围。

## 验收

| 命令 | 检出的问题 | 结果 |
|---|---|---|
| `npx tsx tests/skill-effect-notifications.cts` | 通知停止、替换或过期的回调及保留状态偏离原执行 | PASS：9 个原通知序列、44 个回调/状态样本 |
| `npx tsx tests/skill-effect-runtime.cts` | actor/tag 创建、嵌套停止顺序或句柄清理接线错误 | PASS：18 个原 actor 场景及生产树、mesh、句柄清理 |
| `npx tsx tests/healing-effect-life.cts` | 死亡复活重播、角色移除几何残留或退出声音残留 | PASS：生产快照、通知、几何和声音生命周期 |
| `npx tsx tests/turn-drink-effect.cts` | 角色间误清理、自然过期/stop/detach/clear 残留 | PASS：实际七几何提交、双角色对象隔离及零残留 |
| `npx tsx tests/effect-attach-material-sol.cts` | 活实例材质缓存改变或新实例沿用旧缓存 | PASS：46 个原 Attach 序列、138 个缓存选择及132 次生产提交 |
| `npx tsx tests/effect-material-combo-sol.cts` | 实际模型材质状态错误或已释放 mesh 残留 | PASS：483 个原选择、462 次生产 mesh 状态；缺纹理模型按现有合同拒绝 |

六个命令退出0，日志为 `recovery/output/effect-cleanup-delivery-{notifications,runtime,healing-life,turn-overlap,model-attach,model-material}.log`。本片没有生产修改，沿用现有网页像素、真实音频和业务联机证据。

## 未完成范围

已保存的 `effect-attach-cleanup-sol-native.json` 证明23对原模型实例的92次源 section 提交、递归缓存/vector清理、重复清理、同实例重新Attach与模型引用计数/节点析构顺序。生产 renderer 的普通生命周期使用实例销毁/新建；显式缓存清理后同实例重新Attach、原共享模型引用计数和原 child list 析构顺序尚未接入，不能由本片普通生命周期通过宣称完成。NullEngine 材质/几何检查不证明原 D3D 像素或真实设备声音；缺失 ww051 内容和饮料第二槽触发仍归各自未完成项。本片不关闭 M4-07 完整项。
