# 原迷彩资源目录（M3-03）

`tank-textures.json` 保留 `tanktexture` 原表全部711条记录；792个纹理请求中680个有已安装的精确DDS来源，112个请求保持显式缺失。已解析纹理直接由选定原DDS解码成PNG，使用独立输出目录，保留RGBA像素、尺寸和透明度。

| 内容 | 数量 |
| --- | ---: |
| 原表记录 | 711 |
| U记录 | 307 |
| M记录 | 323 |
| XY记录 | 81 |
| 非零稀有度候选 | 480 |
| 已解析A纹理 | 599 |
| 已解析XY B纹理 | 81 |
| 缺失A纹理 | 112 |

## 来源与字段

导出入口为 `recovery/export_tank_textures.py`，读取已解码原表 `recovery/output/verified/tables/tanktexture.json` 与已安装资源目录 `recovery/output/catalog/inventory.json`。每条记录输出 `recordId`、`tankId`、`part`、原 `filename`、原名称、稀有度、`moneyPrice`、`tokenPrice` 和 `selectable`；不删掉稀有度0记录。`moneyPrice`、`tokenPrice` 分别为原 `购买金钱价`、`购买代币价` 的整数值，全部711条记录逐条保留，包括零价、稀有度0及纹理缺失记录；价格不表示账户已拥有或购买已授权。

`tankId = recordId // 10000`，末位1/2/3分别对应U/M/XY。`selectable` 表示原拥有战车详情列表的非零 `+0x48` 过滤条件，不表示账户已拥有或可购买。原合同由 `role-tank-texture-producer-sol-native.py` 执行 `0x4b6748–0x4b67c0` 验证，21个定义共480条候选。原文件名始终独立保存，不从显示名称构造资源路径。

`textures.A` 保存原角色相对请求 `role/<三位定义ID>/<原文件名>`，原加载器 `0x1002b160` 把扩展名改为 `.dds` 后得到 `source`。该键必须精确命中目录中选定的同角色文件，随后从其实际DDS字节生成 `tank-textures/role/<角色目录>/<原DDS名>.png`；`asset` 是相对于网页资源根目录的路径。PNG不通过全局文件名、旧材质名或TGA同名别名寻找来源。

XY记录同时导出 `textures.B`，按原入口 `0x46ce5f` 把已构造请求倒数第5个字符改为B，再经过同一个DDS加载映射。U/M的B值为 `null`。`initialXYVariant: "A"` 对应已验证入口给X/Y同时设置A；B的存在不表示初始应把Y设置为B。

没有精确选定来源时，保留原请求与DDS键，`asset: null`，状态为 `missing-source` 或 `unresolved-source`。当前112项全部为151–158定义的U记录，其目录没有原请求DDS；这些TankType4角色没有U组件。其余记录照常保留，页面可根据真实组件与列表过滤条件消费目录。

## 验证

```sh
recovery/.venv/bin/python recovery/export_tank_textures.py
recovery/.venv/bin/python tests/tank-texture-catalog.py
```

PASS：711条原表记录及原价对、680个精确DDS/PNG映射、112个显式缺失来源。测试逐条核对表ID、定义过滤、组件、原文件名、两种原购买价格、非零稀有度条件、A/B请求变换与库存选定路径，并检查每个PNG存在、尺寸和解码RGBA像素与实际DDS一致。这些检查可发现记录丢失、价格丢失或变更、跨战车混入、组件错绑、A/B误绑、PNG指向另一来源或像素替换；任一失败应修正导出后再应用目录。

## 剩余验收

目录提供记录与原资源映射，已用于明确拥有三槽的实例预览/动作及重建多人快照，运行验收见owned-tank-textures-runtime.md。原账户授权、角色属性32赋值和运动时左右履带A/B切换仍待恢复。目录不提供自动选择或账户授权。
