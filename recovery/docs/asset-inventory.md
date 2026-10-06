# 原版资源与界面清单

运行 `npm run assets:catalog`，在 `recovery/output/catalog/` 导出：

- `inventory.json`：4665个大小写不敏感逻辑路径，每个路径保留archive、loose、download来源。
- `layouts.json`：65个CEGUI布局、2000个Window；保留名称、类型、父控件、Property和Event。
- `imagesets.json`：78个图集、4347个命名图块及源图、坐标和尺寸。
- `actor-actions.json`：84份战车INI及动作名/模型对应关系。
- `summary.json`：来源计数与扩展名统计。

这些数量是资产和布局证据，界面业务逻辑仍需要从客户端还原。图片数量包括不同图集的条目，未去重。

## 来源与覆盖状态

逻辑路径规范化为小写以匹配Windows文件名语义。archive的Data目录4458个文件；另一个包内文件为 `config/ClientRender.ini`，共4459个。loose目录207文件（174个WAV、24张表及其他文件）。download目录32个补丁候选，全部已有对应基础路径。现存archive与loose路径没有重叠，4665个逻辑路径各有一个已解码来源；catalog以only-decoded-source记录安装内容来源，并不推断全局loose优先；download版本按原key/XXTEA记录decoded、decodeBasis和installedComparison，32项identical使patchPending为0，patchCandidates仍为32。npm run assets:catalog确认4665路径/65布局/2000控件/78图集不变，见patch-catalog-integration.log。32份download运输文件已按原XXTEA解码，结果与原data.cpk活索引对应条目全部逐字节相同；当前归档已包含这些内容，不需要改变来源选择。

download中的12个XML和4个imageset不能直接作为XML解析。例：`ui/layouts/room_main.xml` 在包内与download均为140108字节，包内以 `<?xml` 起始，而download以 `42 93 22 56` 起始。原CPKUpdate的438c50→43b330完整XXTEA算法已恢复，32份全部解码，12布局与4imageset可解析、4DDS格式/尺寸有效；同一测试直接读取原CPK活索引确认全部相同。原调用42d4b0在读取后、压缩入包前解码，下载目录是运输来源，不能当直接加载目录。详见asset-patches-sol.md及patch-sol-native.json。

## 界面复刻分组

| 分组 | 原布局来源 |
| --- | --- |
| 登录与频道 | login、lobby_select |
| 房间与地图/模式选择 | roomlist、room_main、createroom、selectgamemode |
| 战斗 | game_main、game_main_info_conquer/destroy/melee/team/vip |
| 结算 | game_summary、award、dialog、title |
| 我的家 | myhome、panzerpage、modify、petpage、skill、playerpage及各summary |
| 商城与维修 | shop、tankpage、texture、part、petpage、itempage、mendpage、itemdesc |
| 交易 | trade、partdesc、petdesc、tankdesc |
| 社交 | chat、channellist、emotelist、intimatelist、playerlist、playerinfo、QQ_number |
| 设置与辅助 | settings、keyboard、history、tut_settings、confirm/notify/userinput_dialog、IME布局 |

布局后缀中的五种模式名是界面证据；还不能将其直接等同于m001–m005规则编号。下一步恢复背景、图块引用与控件缩放，随后接入对应房间和账户业务。

## 原 VFS 模式与补丁入包路径

`npm run test:assets:open`执行gbengine.dll的OpenFile原函数0x10035810，共36个模式/前缀/存在性/访问标记样本。模式0沿fopen读取loose路径，配置前缀时拼接前缀；模式1只沿CPK::Open读取包内路径；模式2申请内存文件。原读/写/文本标记分别选择rb/wb/rt。模式0或1失败直接返回，不在该函数内切换来源。外部文件打开和标准库边界供给，主体分支执行原指令；证据asset-open-file-native.json及asset-open-file-native.log。

这证明单个VFS实例的行为，尚未证明CDTank在不同VFS实例间的选择与优先级。全局引擎选择条件已进一步取得原执行证据，见下节；独立表格、声音和电影读取入口已有原执行来源与失败证据，见asset-loose-entry-sol.md。

`npm run evidence:patches`导出patch-source-evidence.json：原CPKUpdate在426034先检查下载文件，42605d通过4230fe跳至42bc00的入包包装器。包装器经4333a0取得文件信息，再转42e000入包；该工具的435630过滤分派包含原LZO路径。下载目录是补丁运输输入，不据此作为客户端可直接加载的最高优先级目录。候选清单保留大小与原前缀；实际解码及原指令对照见patch-sol-decoded.json/patch-sol-native.json。全部与现存归档内容相同，选定资产及原基础归档保持现状。

## 客户端全局引擎 VFS 选择

CDTank.exe的41d73e调用导入PathFileExistsA，输入是安装路径拼接字符串5c2848的`\data\data.cpk`，结果写入全局配置+200。4170fa–417118读取该字段：非零给gbVFileSystem::Init传`data\data.cpk`，零传null。原Init对存在的非目录路径设置mode1；null走mode0。asset-source-selection-native.json实际执行三个选择样本0/1/2，观察Init参数；与前述原OpenFile分支共同证明CPK存在时全局引擎只读CPK、不存在时读取loose文件，没有loose覆盖CPK的隐含回退。

现存207个loose文件与4458个Data归档文件无同名路径重叠。catalog不替没有冲突的来源发明覆盖优先级；保留每条唯一已解码来源。独立的24张表、174个WAV和1个BIK均另有加载来源合同；8个TXT为随包说明文件，未见运行引用，不能仅因存在便要求运行入口。32份download解码与活归档内容核对已通过：recovery/.venv/bin/python recovery/patch_sol.py、recovery/.venv/bin/python tests/patch-sol-native.py，15原解码样本及32逐字节比较。独立24表DAT/TXT与174WAV disk/rb加载/失败已恢复，168表/348声音样本通过；BIK完整查源/失败6样本另证明其两个自有CPK槽优先和loose Bink回退，不能套全局VFS。详见asset-loose-entry-sol.md。真实电影/数组/两个CPK完整构造及现存/缺失logo样本证明正常初始化两槽未加载，不调用CPK.Load/Open，实际loose Logo.bik来源已关闭；asset-movie-slot-sol.json/log。96原失败/重复入包样本证明更新器先删旧索引并写盘、之后检查下载，失败无回滚并触发原debug断言；asset-patch-transaction-sol.md/json/log。完整成功入包、归档再打开和断言终止策略仍使M3-01保持未完成。
