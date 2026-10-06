# M3-01 独立表格、声音与电影入口

本安装的24份DAT、174份WAV及logo.bik具有独立文件入口，不能用全局引擎VFS的CPK模式解释它们。原表格管理器查询同一路径的DAT及TXT，WAV的PCM文件接口明确选`disk`后端，电影入口支持两个自有CPK槽及Bink文件名回退。下载目录没有出现在这些查源分支中。

## 24张表

`SYCommonData::_LoadTable`的23个表绑定调用位于`41b947–41c307`；通用表加载还有`41a571`调用。同一`41a2ff`管理器先以CRT `fopen(...,"r")`检查`<stem>.dat `，失败转`<stem>.txt`，均失败写返回false。DAT字符串保留原程序的末尾空格；原Windows文件名行为忽略该末尾空格。二者是表格式候选，不是归档与loose的优先级。

DAT存在后，`418e4a`构造在`418eb1`调用`40483a`。这个二进制表打开器按`rb+ → rb → wb+`尝试同一文件名：可写原表、只读原表、尝试创建缺失文件；二进制头与`CF_Flag_001`比较。打开均失败返回false。通常外层DAT/TXT均不存在已经返回false，不到内层创建分支；不能把内层创建当正常缺表补造规则。

`tests/asset-loose-sol-tables.py`对24份实际DAT路径执行96个内层样本，覆盖可写、只读、缺失且创建失败、缺失且创建成功；另执行72个外层DAT命中/TXT回退/两者缺失分支。原分支、模式顺序、相同路径及失败结果均通过。CRT读写、比较与字符串边界供给；本测试不修改原文件，不执行整个表行构造。证据`asset-loose-sol-tables.json/log`含原调用范围与168个样本。

## 174份WAV

`485920–4859b2`将声音名称构造成`data\sound/<name>.wav`，进入声音服务。声音预检`572fff → 56f296`使用`PathFileExistsA`检查磁盘路径；不存在时返回false。PCM reader `575a03`向文件工厂`573053`明确传入字符串`5c27b0="disk"`及`2001`标记。`572d2f–572d47`注册disk工厂`572c11`，分配`575b43`对象，虚表`5e1f30`的virtual+4为`575beb`。

原`575beb`将2001标记转换成`rb`并调用CRT fopen；成功存文件句柄并返回true，失败存0并返回false。此后PCM reader经同一文件接口读取RIFF/WAVE头。这个disk接口不读取全局`g_pVFileSys`，文件不存在时没有转去data.cpk/download的分支。

`tests/asset-loose-sol-media.py`对174个现存声音路径执行348个存在/不存在样本，原`56f296`存在性函数与完整`575beb`磁盘打开函数全部通过，记录实际路径、rb及失败句柄。系统存在性/fopen和日志边界供给。工厂注册/PCM请求/虚表绑定的原指令同时导出；整个工厂树查找、音频解码及播放不在此加载来源测试范围。

## logo.bik

正常logo入口`447284`使用字符串`5c6144="data\movie\logo.bik"`，经`4484b9`进入完整`448407`。该函数先检查自己的两个CPK槽：已初始化时执行CPK.Open，命中则向BinkOpen传归档内存及880000标记；任一已成功打开电影后跳过其他槽。两个槽未命中或Bink打开失败，调用BinkOpen原文件名及80000标记；仍失败返回false并进入日志错误分支。此入口没有使用全局引擎VFS。

电影构造`4481fa`经原数组构造`57d1ff`建立两个CPK对象，每个执行完整gbengine.dll `100378e0`构造器。原CPK构造清零对象，其中loaded标记`+1c008c=0`；电影构造没有调用CPK.Load或提供任何归档文件名。正常logo调用`447297–4472a5`在取得此电影对象后立即沿`4484b9 → 448407`打开logo。因此两个自有槽在正常初始化时均未加载，实际来源明确为磁盘`CDTank/Data/movie/Logo.bik`，原Windows忽略Logo/logo大小写。

`tests/asset-movie-slot-sol.py`在aa非零预填对象上执行完整电影构造、原数组构造及两个完整CPK构造，观察两个标记均0；随后在该真实构造对象执行完整`448407`。安装中BIKi电影确实存在，BinkOpen观察到文件名`data\movie\logo.bik`及80000标记，成功返回true；对应文件不存在时同一loose入口返回false。测试在CPK.Load及CPK.Open放置禁止到达的观察器，两种样本均未调用这些归档入口。仅CRT分配/清零/格式化、系统信息、Miles初始化、日志及BinkOpen边界供给，原SEH与构造/查源主体执行。证据`asset-movie-slot-sol.json/log`记录实际安装文件、原指令及两种样本。这关闭了电影槽具体来源缺口：本正常logo链不加载任何归档到这两个槽。

另有`asset-loose-sol-media.json/log`的六个原函数样本覆盖未初始化槽、已初始化但缺电影、第一/第二槽命中、归档Bink失败后的loose失败，证明电影函数自身支持的其他分支；不把这些人工已初始化槽当本安装正常启动来源。

## 八份说明文本

loose TXT是ChangeLog的四份版本、FAQ、FutureWork、Readme、Readme_en，属于随包说明文档。对本目录EXE/DLL的ASCII及UTF-16LE文件名引用检索均未找到这八个文件的直接引用，结果逐文件保留在media证据。表格的TXT回退是由表名动态构建的另一条输入合同，不能因此把这些说明文档当表或运行资源。现有来源没有要求游戏读取它们，无需为八份说明文档增加运行入口或网页功能。

## 验收范围

24表与174WAV的独立查源、已存在文件及缺失文件分支已有原执行和调用绑定依据，原网页资产继续使用现存唯一已解码loose来源。BIK完整正常构造及查源/失败路径已执行，本安装logo选择loose来源。M3-01不能仅凭这些局部函数样本宣称完整更新器的失败/替换事务通过；32份补丁内容与现存data.cpk的等同性见asset-patches-sol.md。

复现：

```bash
recovery/.venv/bin/python tests/asset-loose-sol-tables.py > recovery/output/asset-loose-sol-tables.log
recovery/.venv/bin/python tests/asset-loose-sol-media.py > recovery/output/asset-loose-sol-media.log
recovery/.venv/bin/python tests/asset-movie-slot-sol.py > recovery/output/asset-movie-slot-sol.log
```
