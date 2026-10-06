# 账户统计与九奖章客户端显示

本片把 `RoleProfile` 的权威 `statistics`/`awards` 与 `ResultPlayer.awards` 接到三个既有显示消费者，不改协议、账户事务、战斗生产者、Network/Battle/rawfonts、称号选择逻辑或奖章授予。规则与字段来源见账户统计与九奖章正式业务设计。

## Home 战绩统计

`myhome_playerpage_battlesummary.xml` 的 14 个 `StaticText` 控件一次绑定权威账户统计：

- 胜负平、击毁/被击毁、连胜/连败：`wins/losses/draws/kills/deaths/winStreak/loseStreak`。
- 命中/发射/总伤害/最高连击：`hits/shots/damage/killCombo`。
- 命中率为 `hits/shots` 的四舍五入百分比；`shots=0` 显示 `0%`；`hits` 或 `shots` 任一未知保持空白。
- 命中/发射/伤害/连击为可选字段，只有真实 producer ledger 存在才显示；缺失保持空白，不补零。

原布局只给出 `txtTotalDays`/`txtTotalTime` 两个 23 与 50 像素宽窗口，未提供格式化器源码。本片采用单一 UI 格式：`txtTotalDays` 为 `battleSeconds` 的整日数（`floor(seconds/86400)`），`txtTotalTime` 为当日剩余整小时数（`floor(seconds%86400/3600)`）。该格式为采用规则，不声称恢复原未取得 formatter。

`ResRoleProfile.statistics` 缺失时回退既有 History 五字段投影（win/lose/draw/destroy/beDestroy 由本次完整 `History` 分页汇总），其余 9 个统计控件保持空白；History 的分页、刷新、同 DOM 保持与错误反馈不变。

## Home 九奖章计数

`myhome_playerpage_awardsummary.xml` 的九个 `StaticText` 计数按控件名映射 `awards`：`txtPerfect/txtMVP/txtSavage/txtConsole/txtBrave/txtKind/txtCrafty/txtShy/txtGreedy`。已有权威计数为 0 时显示 0；`awards` 缺失时九个计数保持空白且标记 unbound，不填默认值。十张纹理图与几何位置原样保留。

## 结算每局奖章格

`game_summary.xml` 每队每玩家五个 `picCatAward{i}_{0..4}`/`picDogAward{i}_{0..4}` 空图窗口按该玩家 `ResultPlayer.awards` 点亮。九个奖章按原类型稳定顺序 `perfect,mvp,savage,console,brave,kind,crafty,shy,greedy` 选取前 5 个类型填入第 0..4 格，图标取原 `fenshujiesuan` 九图区域，附带九原奖项中文名称的 `title`/`aria-label`。`awards` 缺失或为空时不点亮任何格，保持空白，不猜造图标。

分页时每行只读该页该玩家自身的 result，不显示同机其它玩家的奖章。全部权威 `awards` 仍留在结果/History 记录中，本片不删减其它字段。award 弹窗、Rematch、Leave、800×600 缩放与既有焦点 owner 不变。

## 待验证

真实三分辨率整页、Home 与结算双网页、以及持久重启后的显示均未执行，本片按既有范围不新增 unit test/浏览器/构建/类型/lint/生成器运行；上述结论来自源码接线与已发布布局/图标数据，非实测。
