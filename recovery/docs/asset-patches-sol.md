# M3-01 下载补丁解码与现存归档来源

32份download运输文件均可按CPKUpdate原算法解码，且解码后与`CDTank/Data/data.cpk`的32个对应活索引条目逐字节相同。现存归档已经包含这批运输文件的内容，32条路径不需要再用候选覆盖基础内容。客户端全局引擎的最终读取来源仍由已取证的CPK存在性选择决定：本安装存在data.cpk，使用归档；download不是该VFS的直接查找目录。

## 原算法与入口

CPKUpdate.exe的`42bc00`入包包装器经`42263b`转入`42e000`，单文件分支`42e238`经`4229f6`转入`42d4b0`。该函数`42d748`通过`422965 → 433780`执行ReadFile，读取运输文件原字节；`42d764`通过`422843 → 438c50`解码，再在`42d84e`进入已有存储过滤分派。运输解码发生在压缩/入包之前，并不是对DDS/XML格式各做特例。

`438c50`取`floor(byteLength/4)`个小端u32，使用全局`47304c`指向的`46b768`前16字节作为四个key字。值为ASCII `P3UwxZjf94LsW4cf`。`422ab4 → 43b330`实现XXTEA解密，DELTA为`9e3779b9`，轮数为`floor(6+52/wordCount)`；不足两个字不改写，尾部1–3字节不改写。`recovery/patch_sol.py`实现这段算法，直接读取原程序key，输出到独立证据目录。

## 验证

- `recovery/.venv/bin/python recovery/patch_sol.py`：解码32份；12份布局XML与4份imageset成功解析，4份DDS魔数与宽高成立。输出`recovery/output/patch-sol-decoded.json`及`patch-sol-decoded/Data/`。
- `recovery/.venv/bin/python tests/patch-sol-native.py > recovery/output/patch-sol-native.log`：完整33164字节createroom.xml及14个短文件/不同字数/尾部样本，均与原`438c50 → 43b330`指令执行结果逐字节相同。仿真仅供给debug栈检查和CRT floor外部边界；原key、x87轮数表达式、整数转换及完整解密主体执行原指令。
- 同一测试直接解析原data.cpk活索引并按原存储标记解压，32份下载解码结果全部与对应归档条目逐字节相同。`patch-sol-native.json`记录各CPK索引、存储标记、长度及原指令范围。内容比较不使用摘要。

这完成了32候选的解码及与现存基础归档内容的来源核对；对应布局的“待解码补丁”缺口已关闭。没有改变归档、catalog或网页资产导出。

## 剩余验收

M3-01仍需逐项恢复独立24张表、174个WAV、说明文本和BIK的真实加载入口；全局引擎VFS选择不代替这些入口。任意更新补丁的失败/替换事务和完整更新器生命周期未在这组测试中执行；本批32份与现存活条目相同，不依赖推测替换优先级。各资源的网页加载/像素/业务验收仍属M3/M5的对应任务。
