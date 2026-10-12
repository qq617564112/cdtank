# 原模型Attach缓存释放

原节点的完整Attach、缓存vector首次扩容、递归缓存清理和完整节点析构已执行。8个现存模型的23个节点各运行两个独立实例，共92次源section提交。两个实例共享模型资源，但缓存指针、首次材质flags和effect指针分别保存。清理后重新Attach从当前blend重新选择材质并分配新缓存；重复清理不再次释放。

## 原执行与释放顺序

`tests/effect-attach-cleanup-sol-native.py`执行原构造`0x1000fe70`、完整Attach入口`0x100107d0`与AttachSelf `0x10011d70–0x10012315`。缓存vector从构造所得的三个零指针开始；原`0x10011a30`扩容路径分配vector，不再预留fixture容量。每个section由原选择代码创建0xf4-byte缓存，保存本实例node、源section properties指针、首次flags及effect指针。

同一源node的两个实例先分别以alpha=1、0.375提交，再建立原child list关系。原`0x1001e4a0`依次释放父节点section缓存、父vector、子节点section缓存、子vector，并将各节点vector的begin/end/capacity置零。共享模型引用计数保持2；第二次递归清理没有分配、lookup或释放。解除child link后，分别以alpha=0.375、1重新Attach，所得缓存使用新的首次状态。

再次建立child link后，经原虚表调用scalar deleting destructor `0x10003670(1)`。完整geom析构`0x10011700`、base析构`0x1001e530`、child list析构`0x10034b20`均执行。实测顺序为：

1. 父geom调用原`0x10034e90`，模型引用计数2→1。
2. 父base递归清理父、子全部section缓存与vector。
3. child list调用子节点完整析构，模型引用计数1→0，进入模型虚析构接口。
4. 子scalar deleting destructor释放子节点存储，随后父scalar deleting destructor释放父节点存储。

每次native分配及释放均记录指针与大小，未知释放或重复释放直接使验证失败；每对实例最终没有未释放的受跟踪node/cache/vector。另有两个未Attach节点执行两次清理，再分别用deleting flag=0、1析构：前者保留调用方节点存储，后者释放节点存储，均没有缓存或资源释放。

## 验证与生产关系

```text
recovery/.venv/bin/python tests/effect-attach-cleanup-sol-native.py
PASS: 23 original two-instance lifecycle pairs / 92 source section submissions; vector growth, recursive/repeated cleanup, reattach, ordered node destruction and resource refcounts
```

证据`recovery/output/effect-attach-cleanup-sol-native.json`保存23组分配/释放时间序列、两轮实例缓存指针、模型引用计数、两个未Attach析构场景及原指令。验证能检出实例共享缓存、清理遗漏vector、重复释放、清理误释放模型、重Attach沿用旧材质，以及节点析构释放顺序错误。

现有生产`EffectModelRenderer`的首次材质缓存及每实例mesh disposal覆盖上一组材质缓存合同。本组补足原节点堆对象与递归清理证据；原共享模型资源引用计数、显式缓存清理后同实例重Attach、原child list析构顺序尚未接入生产renderer。

## 局限

node/model/section存储及原child list输入由fixture提供，未执行完整model loader。原allocation/delete接口由受跟踪的host arena供给，证明的是原代码对heap接口的完整分配/释放调用及其顺序，未运行Windows系统heap。原模型最后一次Release执行真实引用计数指令，模型虚析构接口为显式记录边界，未执行模型GPU/纹理析构。当前源节点的每个section均执行首次vector扩容，未构造源数据以外的多section节点。动画轨道、额外geometry buffer等原构造为空的字段保持为空。effect registry及相机plane接口沿用材质fixture输入；本组不构成D3D设备framebuffer、真实游戏逐帧实录或完整技能通知链完成。
