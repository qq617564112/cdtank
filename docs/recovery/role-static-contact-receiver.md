# 原静态接触分类与接收器

原运动控制器 `4272d7` 的静态集合是场景 `+1e8`，包含 Plant/Crush；Breach 使用独立 `+1d8`，不能借本调用链取得运动接触破坏资格。

`role-static-contact-provider-source.json/.log` 保留具名分类指令与三个新 Plant 接收器条件。`45b858..45b92e` 从场景 `+198` 的对象引用集合分类：`SYcScnObjBreach` 送 `+1d8`，`SYcScnObjPlant` 和 `SYcScnObjCrush` 依次追加到同一 `+1e8`。`45b170` 遍历八字节对象引用对，`45911a` 调用对象 virtual+c 取得类名，以 `4037cf` 比较，匹配后通过 `45a98d` 追加原引用。分类谓词没有按资产名或价格判断。

`4272d7` 取 `+1e8` 引用对首项，`44dbc4` 返回对象 `+80` OBB；与已预测角色盒相交时调用 `44e081(100)`。动态角色拒绝仍优先，静态通知不拒绝移动。已有原 controller/OBB 证据直接复用，不重复运行。

## 接收器合同

`44e081` 先拒绝对象隐藏位 `+74`，再调用 virtual+14。Plant vtable `5c7760` 与 Crush `5c76e0` 的该槽均为 `45efb3`，不检查通知参数。原 `461dd9` 写隐藏位1，再调用场景槽+4c，参数0；非空 `+fc` 才向效果槽+34传递 `+78` 八字节句柄对。

新 Plant 三条件实际执行完整 `44e081→45efb3→461dd9`：首次 type100 隐藏，重复通知及预先隐藏均不再调用端点。样本 `+fc=0`，没有效果或声音调用。新 Crush 三条件沿相同接收器首次隐藏并启动已供给效果端点一次，重复/隐藏静默。`role-static-contact-receiver-native.json/.log` 同时保留 Breach 三个 type100 接收器条件；该 callee 首次切破损模型、导航更新及 GA13，并不证明 Breach 属于 controller 的静态集合。

## 正式消费者所需接口

现 `battle/dynamic-movement.ts` 调用原 controller 时传入空静态数组及空通知函数，尚无该链正式消费者。最小接线需要：按原类别提供本房 Plant/Crush 对象引用身份、源 OBB 和当前隐藏状态；在普通已许可运动的预测 OBB 相交后，接收 `objectId,type100`，使同一对象隐藏并释放对应导航/碰撞贡献，通知两端现呈现消费者。处理后继续本次许可运动，不扣血、不借射击积分，不加入 Breach。

原分类数组须保持 Plant 后 Crush 的追加顺序。已有发布记录仅作为身份候选：map2有29个 Plant/obj05413、没有 Crush；map7有 Crush75–77且 enabled 为0/1/1。这些记录不能替代原场景 loader 的运行集合资格，也不能把 enabled 与 `+74` 隐藏位等同。

## 限制

分类函数为原指令合同，未执行完整场景 loader；原八字节引用与正式字符串 placementId 的绑定、enabled 对实例进入运行集合的影响及场景槽+4c的完整导航退出仍需资格。Plant 可选效果资源未取得。本片没有生产、协议、网络或画面变更，M2-03完整运动父保持未完成。

具名上游静态入口为 `45b3ea`：从流读取引用数量及每项 kind，kind0经 `45b33f` 创建/读取新物件，kind1经 `458785`复制既有引用；本段未按 enabled 删除引用。`45b33f` 经类工厂 `44ecbb→44e695`、`457c89`读取物件，随后返还引用。enabled若影响内部初始化或后续加载，须在这条具名链内确认，不能仅由分类谓词无 enabled 分支断言全部参与碰撞。本片没有执行该上游 loader。

主线接管本房 Plant/Crush 身份适配与正式隐藏接口；原字符串 placementId 在该适配中可明确标为现Web来源适配，而非原uint32对象ID producer。本片不继续扩大 loader 执行或启动独立网络。

证据：`recovery/output/role-static-contact-provider-source.json`、`role-static-contact-receiver-native.json`；既有 `role-movement-controller-native.json`、`scene-crush07-state-native.json`、`scene-breach21-05466-native.json` 复用。
