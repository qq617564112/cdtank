# M3-08-CASTLE02交付

玩家可见范围：田野路mode1/map2普通2001命中304原Castle，按权威单次事务切原n1/n2/c2/c3，原挂点040/041/039与GA48/se03/se07，死亡停止持续声、Leave清理。正式Battle接口由主线接入；不计算伤害。

## 文件归属

FX代码：apps/web/src/assets/scenes/scene-castle-{state,presentation,visual}.ts；scene-preview.ts限定Castle load/damage/advance/reset/clear；render/effects/runtime/effect-runtime.ts限定Castle具名树和scene sound selector。源与验收：recovery/evidence/castle/castle-damage-native.py、tests/scene-castle-{state,presentation}.cts、tests/browser-castle02.mjs。地图线原库和主线业务代码分别保留其归属。

## 证据

原45d16f/45bdcb/10009af0执行、14HP边界/8连续事务、消费者命令/实时矩阵/声音owner释放与十动作模型源PASS直接复用。类型检查已通过。实际证据索引为recovery/output/castle02-composed-evidence.json：15-55-33普通死亡段raw INCOMPLETE完整保留，15-59-51单射手PASS只补两端c2。两端实际low与dead画布链接列于索引；不改旧结果为PASS。

## tasklist原位建议

M3-08-CASTLE02原段追加：c2首次必要补验15-59-51-442Z已PASS，普通单射手至HP624松Space，双端c2实draw78/81与原画布、Leave全0；与15-55-33死亡段组成304普通实际视觉证据。c2于旧#32 HP624出现，#33 HP581原n2覆盖，未记录事务tick不能断言同tick。双端原声playing与死后stop已有记录；射手se03增益后实波形非零，观察端gain0，16-07-15-234Z最小再战PASS：两端10普通事务至1570，GA48/se03实际输出非零；45秒自然TIME_LIMIT→四账户Rematch，round2两原HP2000/stage2/mask0/n1、旧effects/voices0，Leave全0。16-10-39-898Z se07首次低血输出PASS：32相同普通事务至624即松Space，双端postgain peak0.82227/0.74528与非零masterGain，Leave全0；不重复毁坏/再战/截图。伤害浮字、305型号普通触发及恢复业务未验，父项保持未勾。

## 未完成范围

死亡se07未单独测波形（首次低血已双端非零），round2 n1未另存实际画布；原伤害浮字实际绘制、305普通触发与恢复道具。原服务器伤害/资格/死后碰撞规则属于主线重建。仅320×180软件画布，不提供高清或原Windows像素证明。
