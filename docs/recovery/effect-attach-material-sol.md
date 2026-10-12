# 完整模型Attach材质缓存

原完整`Attach(0)`经真实虚表进入完整`AttachSelf`，覆盖8个现存模型的23个节点/section、两种首次透明度顺序及每序列三次提交，共46条序列、138次section提交。首次提交选择并缓存材质；后续透明度改变保留该脚本，同时获取当帧矩阵快照。全序列原矩阵栈深度与进入矩阵保持一致。

## 原执行

`tests/effect-attach-material-sol-native.py`执行原节点构造`0x1000fe70`、完整递归blend setter`0x1001d980`、完整Attach入口`0x100107d0`以及完整AttachSelf `0x10011d70–0x10012315`。每个原构造结束时section缓存vector为空。

两种顺序为alpha=1→0.375→1和0.375→1→0.375。首次提交由原section kind、FVF和node blend选择flags，通过effect registry接口取得effect指针，分配0xf4-byte缓存并复制队列头部。后续`0x10011fdd–0x10011fef`调用真实`0x1001d790`复制缓存的0x24-byte头部，不再进入选择或effect lookup，也不再分配缓存。`SetBlendRecursive`写入alpha/blend，但不清section缓存。

原`0x1001a110`每次提交仍重新读取node priority及当前model/view/projection矩阵；真实Push/Multiply/Pop执行，fixture逐次改变进入矩阵的平移并验证提交快照。完整原AABB frustum test执行；相机接口供给六个不裁除对象的plane。所有当前源section只有kind0/1，无lights、fog、自定义effect或动画纹理。

## 实现与验证

生产`EffectModelRenderer`的每个PartDraw使用`EffectAttachMaterialCache`保存首次选择，直接采用原draw的blend输入。材质脚本不因后续alpha变化而重建；当前矩阵和非c1 ambient/alpha仍按每帧更新。新建对象具有空缓存，各实例不共享材质选择。源kind1首次始终透明；源kind0在第一次opaque后fade仍使用opaque脚本，在第一次transparent后alpha恢复1仍使用transparent脚本。两种方向各有7个源section样本能检出按每帧alpha重新选择的差异。生产NullEngine测试使用7个可载入模型，在同一renderer中连续提交两种顺序，共132次section提交；每个序列结束释放全部mesh，反向首次状态使用新实例验证空缓存。youlincat原缺失纹理保持资源错误。

```text
recovery/.venv/bin/python tests/effect-attach-material-sol-native.py
PASS: 46 complete original source node attach sequences / 138 source section submissions; first-attach material cache and fresh matrix snapshots
npx tsx tests/effect-attach-material-sol.cts
PASS: 46 full original attach sequences / 138 cached source selections; 7 opaque and 7 transparent transitions retained
PASS: 132 production source section submissions retain first material and update alpha; disposal/new instances reset cache
npx tsx tests/effect-material-combo-sol.cts
PASS: 483 original material selections / 462 production source mesh states; 1 original missing-texture resource rejected
```

证据`recovery/output/effect-attach-material-sol-native.json`保存全部序列、每次lookup/分配次数、原队列flags/effect/矩阵和原指令。

## 局限

模型节点、section存储、source kind/FVF/material由fixture供给，未执行完整model loader或真实heap释放。缓存vector预留容量，原扩容路径未执行。effect registry lookup供给确定effect指针；profiling入口/退出无操作。相机plane接口及section零centroid为显式输入；本组未验证真实相机可见性。序列是明确输入合同，不是原游戏逐帧实录，不构成D3D framebuffer、混合效果整树或真实技能通知完成。
