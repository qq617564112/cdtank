# 无敌软星100整树普通玩家表现

正常购买item8、原辅助页快捷槽4配置、mode4/map7准备与Digit5已真实触发双端skill8首槽通知。原100四Type7节点均实际绘制，完整320×180画布双方白青条带与炮塔发光可辨。首槽Sound0返回handle0，没有创建效果声音；正常Leave后worldnull、实例、网格、独立及树声音均归零。

原根2992与2993–2996四节点复用invincibility-effect.json。实际首帧源时间0.0651/0.0582秒，2994在后续原时机进入绘制；两端frame1/2均有四节点实际同帧绘制记录。该记录不等于四个独立可辨像素贡献。原纹理huifu1、huifu5、light-2保持。

亲审六张完整画布：双方三帧都可辨车体白青条带，末帧炮塔青白发光。两端独立首槽各请求reference0/selector-1，真实handle0/voiceCreatedfalse；原树无Type4，在活动窗口未记录树声音请求。该静默范围属于原100效果，未静音其他页面或对局声音。

双方itemUsed均携带skill8、本人targetP1、effectIndex0/duration10/roleId1。原树零寿命持续活动，raw记录stopEffect实际调用、实例移除后quiescent及真实skillStopped/Stop8收到；stopOrigin均为null。因此只能证明实例已停止与Stop8已收到，不能将该移除直接归因于服务器Stop8，也未采通知timer与事件的精确先后。duration10属于重建权威期限，不能表述为原树自然expiry。

数据库复制自真实tank3/pet2购买账户checkpoint，保留已披露初始资金来源，未增加库存或角色。观察端仅正常A/D转向释放，不改位置、相机、HP或时基。正常SourceClose/Leave得到双worldnull和四资源计数0，Chromeexit0、临时目录移除且3516/5546/9746端口空；serverExitnull为信号关闭。

## 证据

- `tests/browser-invincibility-whole.mjs`：普通输入与只读绘制/静默/停止观察。
- `recovery/output/browser-invincibility-whole-2026-10-05T07-16-32-517Z.json`：正式施放、四节点、完整画布、Sound0、Stop8与双Leave。
- 同stem六份`-result-canvas-{1,2}-{0,1,2}.png`：完整320画布。
- `recovery/output/invincibility-whole-actual.json`：有限四层状态；主线已亲审六完整320画布，M4-10-I08有限主审已回链。
- `recovery/output/invincibility-whole-process-cleanup.json`：进程清理。

## 限制

四节点独立像素、HD、通知timer与serverStop的精确停止因果及完整原FuncType6权威父项保持未完成。免伤、数值、非叠加、死亡两局、再战和库存重启复用既有验收，不在本片重新证明。
