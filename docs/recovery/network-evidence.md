# 网络、配置与 QQ 登录的静态证据

研究日期：2026-10-01。研究对象仅为下面列出的四个原始文件。所有结论来自本地文件字节、PE 导入/导出表和 x86 反汇编；没有运行这些 Windows 程序，没有解析远程 DNS 或连接历史服务。

**已恢复的部分是配置格式和两种传输帧的边界规则。尚未恢复业务消息协议、登录响应、账号数据库或服务端。** 历史 IP/域名只作为证据保存，不能推断今天仍由原公司控制。

## 1. 样本身份与地址约定

| 原始文件绝对路径 | 大小 | SHA-256 |
| --- | ---: | --- |
| `/workspace/cdtank/CDTank/ObjNet.dll` | 339968 | `186a440ea2d8836a3416516688364d26cdc042a6a67603061d090ad083e95966` |
| `/workspace/cdtank/CDTank/LSocket.dll` | 61440 | `a30fa54f30274b9bdcd5d76a56db78db197d648f43c4b7a5abe5bc5c12e39459` |
| `/workspace/cdtank/CDTank/QQLogin.exe` | 1056768 | `1f540aaae6d8eb8206e0c5b09d10eac79c970129b3311b03c7375d6f4cb66dc1` |
| `/workspace/cdtank/CDTank/Config/client.dat` | 222 | `fd8ac04850ebbb2ccaa8a5941157c44252410125b7c77d7a4d96ff59eca01e72` |

本文 `file`/“偏移”均指文件开头起算的字节偏移。VA 是 PE 首选装载基址下的虚拟地址，不是运行中的实际地址。三个 PE 均为 i386、PE32，定位代码时可使用以下映射：

| 文件 | PE 头偏移 | 首选 ImageBase | `.text` VA / 文件偏移 | COFF 时间戳（UTC，非可靠制作日期） |
| --- | --- | --- | --- | --- |
| ObjNet.dll | `0xe8` | `0x10000000` | `0x1001f000` / `0x1000` | 2005-06-15 03:51:46 |
| LSocket.dll | `0xe0` | `0x10000000` | `0x10001000` / `0x1000` | 2005-06-14 08:52:33 |
| QQLogin.exe | `0xe0` | `0x00400000` | `0x00401000` / `0x1000` | 2006-07-13 03:30:17 |

对于本文引用的 `.text` 代码，ObjNet 的 `file = VA - 0x1001e000`；LSocket 的 `file = VA - 0x10000000`；QQLogin 的 `file = VA - 0x00400000`。其他节应使用 PE 节表换算，不能把这些公式泛用于任意 RVA。

## 2. client.dat 可以逐字节解码

确定事实：`/workspace/cdtank/CDTank/Config/client.dat` 的全部 222 字节恰好匹配以下格式，无剩余字节：

```text
u32 little-endian: 条目数 = 8
重复 8 次:
    u32 little-endian: key 的字节数
    key 字节
    u32 little-endian: value 的字节数
    value 字节
```

key/value 的原始字节各自减 1（模 256）后得到可读 ASCII。此规则只作用于字符串，长度字段保持原样。这是轻度混淆，不是密码学加密。下面的偏移定位的是字符串第一个字节；其长度字段在字符串偏移前 4 字节。

| 序号 | key 原始字符串 / 解码值 | key 偏移、长度 | value 原始字符串 / 解码值 | value 偏移、长度 |
| --- | --- | --- | --- | --- |
| 1 | `00MpcczBees` → `//LobbyAddr` | `0x08`, 11 | `238/1/1/2` → `127.0.0.1` | `0x17`, 9 |
| 2 | `00SppnBees` → `//RoomAddr` | `0x24`, 10 | `238/1/1/2` → `127.0.0.1` | `0x32`, 9 |
| 3 | `MpcczBees` → `LobbyAddr` | `0x3f`, 9 | `329/91/311/8:` → `218.80.200.79` | `0x4c`, 13 |
| 4 | `MpcczQpsu` → `LobbyPort` | `0x5d`, 9 | `5:21` → `4910` | `0x6a`, 4 |
| 5 | `MphjoTfswfsBees` → `LoginServerAddr` | `0x72`, 15 | `329/41/237/:3` → `218.30.126.92` | `0x85`, 13 |
| 6 | `MphjoTfswfsQpsu` → `LoginServerPort` | `0x96`, 15 | `8112` → `7001` | `0xa9`, 4 |
| 7 | `SppnBees` → `RoomAddr` | `0xb1`, 8 | `329/91/311/8:` → `218.80.200.79` | `0xbd`, 13 |
| 8 | `SppnQpsu` → `RoomPort` | `0xce`, 8 | `5111` → `4000` | `0xda`, 4 |

解释边界：名字说明旧客户端区分 Login、Lobby、Room 配置角色，但该文件本身不能证明它们是否由三个独立进程提供。`//` 很像注释标记，**是否忽略这些条目仍须由读取客户端配置的代码确认**。仅把前两个回环地址改写并不能保证后六个配置转向本机。

独立复核（仅标准库；从任意目录执行）：

```python
from pathlib import Path
import struct

b = Path('/workspace/cdtank/CDTank/Config/client.dat').read_bytes()
count = struct.unpack_from('<I', b)[0]
p = 4
for _ in range(count):
    fields = []
    for _ in range(2):
        n = struct.unpack_from('<I', b, p)[0]
        p += 4
        raw = b[p:p+n]
        assert len(raw) == n
        fields.append(bytes((v - 1) & 255 for v in raw).decode('ascii'))
        p += n
    print(*fields, sep=' = ')
assert p == len(b)
```

## 3. ObjNet 与 LSocket 的 PE 接口

### 3.1 导入库

源：各文件 PE Import Directory。ObjNet 的导入目录在 file `0x4e000`（RVA `0x6e000`）；LSocket 在 file/RVA `0xafdc`；QQLogin 在 file/RVA `0x32428`。

| 文件 | 导入库（函数数量） |
| --- | --- |
| ObjNet.dll | `KERNEL32.dll` (88)、`USER32.dll` (1)、`LSocket.dll` (8)、`WS2_32.dll` (10) |
| LSocket.dll | `KERNEL32.dll` (62)、`WS2_32.dll` (18) |
| QQLogin.exe | `KERNEL32.dll` (117)、`USER32.dll` (125)、`GDI32.dll` (38)、`comdlg32.dll` (1)、`WINSPOOL.DRV` (3)、`ADVAPI32.dll` (4)、`SHELL32.dll` (1)、`COMCTL32.dll` (3)、`ole32.dll` (5)、`OLEAUT32.dll` (3)、`WSOCK32.dll` (21) |

QQLogin 没有 PE Export Directory。其导入表没有 ObjNet 或 LSocket，因此不能假定 QQ 登录器与游戏进程共用传输实现；动态装载的可能性不能仅由导入表排除。

ObjNet 导入的 LSocket 命名函数及名字字符串 file 偏移：

| 完整名称 | file 偏移 | IAT VA |
| --- | --- | --- |
| `?UninitSock@@YGXXZ` | `0x4e60a` | `0x1006e4e0` |
| `?InitSock@@YGXXZ` | `0x4e620` | `0x1006e4e4` |
| `?TCPConnect@@YGIPAUsockaddr_in@@@Z` | `0x4e634` | `0x1006e4e8` |
| `?NonBlock_TCPConnect@@YGIPAUsockaddr_in@@@Z` | `0x4e65a` | `0x1006e4ec` |
| `?GetSockErrString@@YGPBDXZ` | `0x4e688` | `0x1006e4f0` |
| `?SetSocketNonBlock@@YG_NI_N@Z` | `0x4e6a6` | `0x1006e4f4` |
| `?CreateServerSocket@@YGIPAUsockaddr_in@@@Z` | `0x4e6c6` | `0x1006e4f8` |
| `?GetNewSocket@@YGIIPAUsockaddr_in@@@Z` | `0x4e6f4` | `0x1006e4fc` |

Winsock 导入有部分仅按 ordinal 记录，原文件并未存储函数名字。ObjNet 的 WS2_32 ordinal 为 `22,16,111,19,18,12,15,5,151,3`，其中本文追踪的 ordinal 16/19 分别按 Windows Winsock ABI 解释为 `recv` / `send`；调用参数也符合这些函数。LSocket 的 WS2_32 ordinal 为 `115,112,7,57,9,11,4,6,52,1,23,21,2,13,3,10,116,111`。QQLogin 的 WSOCK32 ordinal 为 `10,9,8,14,116,115,112,15,2,3,52,16,19,101,12,23,17,20,4,111,1`。ordinal 的解释依赖目标 Windows 系统 DLL 的 ABI，不等于文件中存在这些函数名字符串。

### 3.2 ObjNet 导出与虚表

源：`/workspace/cdtank/CDTank/ObjNet.dll` 的 Export Directory（file `0x4a600`，RVA `0x68600`）。5 个命名导出全部是 x86 stdcall 装饰名称：

| ordinal | 导出名 | 名字 file 偏移 | 导出跳板 RVA / file | 跳板目标 VA / file |
| --- | --- | --- | --- | --- |
| 1 | `_CreateObjNet@0` | `0x4a665` | `0x1f00f` / `0x100f` | `0x10023e90` / `0x5e90` |
| 2 | `_DestroyObjNet@4` | `0x4a675` | `0x203f6` / `0x23f6` | `0x10024120` / `0x6120` |
| 3 | `_ObjNetBufferAddRef@4` | `0x4a686` | `0x20239` / `0x2239` | `0x100241e0` / `0x61e0` |
| 4 | `_ObjNetBufferRelease@4` | `0x4a69c` | `0x1f320` / `0x1320` | `0x100242d0` / `0x62d0` |
| 5 | `_ObjNetGetBuffer@12` | `0x4a6b3` | `0x1fa73` / `0x1a73` | `0x100243c0` / `0x63c0` |

导出接口能支持在游戏进程内追踪 buffer 分配、引用计数和发送/接收数据。在重新声明 ABI 前仍须复原返回值和参数语义；`@12` 仅说明调用方有 12 字节参数。

`CreateObjNet` 调用构造函数 `0x10023f50`（file `0x5f50`）。该构造函数在 `0x10023f9a`（file `0x5f9a`）把对象首个 DWORD 设为虚表 VA `0x100612a0`（file `0x432a0`）。以下槽位由虚表指针和跳板可复核：

| 从 0 计槽位 / 字节偏移 | 跳板目标 VA | 已观察到的行为 |
| --- | --- | --- |
| 3 / `0x0c` | `0x10024740` | 在 `0x10024784` 调用 LSocket `TCPConnect` |
| 4 / `0x10` | `0x10024840` | 在 `0x1002488c` 调用 LSocket `NonBlock_TCPConnect` |
| 9 / `0x24` | `0x10026600` | 用大小和数据构造 buffer，再加入连接发送队列 |
| 10 / `0x28` | `0x100268e0` | 包含 `nSize <= m_u32MaxPacketSize` 断言 |
| 11 / `0x2c` | `0x10026ac0` | 包含相同大小断言 |
| 26 / `0x68` | `0x10027ee0` | 在 `0x10027f28` 设置 `[object+0x5c]` 最大包长，上限 65535 |

这允许从主游戏 EXE 的虚调用偏移反向定位连接和发包路径。以上行为名称是静态观察描述，不是恢复的原始 C++ 方法名。

### 3.3 LSocket 的全部 14 个命名导出

源：`/workspace/cdtank/CDTank/LSocket.dll` Export Directory file/RVA `0xb5e0`。这些函数的 `.text` RVA 等于 file 偏移。

| ordinal | 名称 | RVA/file |
| --- | --- | --- |
| 1 | `?CreateServerSocket@@YGIPAUsockaddr_in@@@Z` | `0x1050` |
| 2 | `?GetHostID@@YGKXZ` | `0x11b0` |
| 3 | `?GetHostIDByName@@YGKPBD@Z` | `0x1160` |
| 4 | `?GetNewSocket@@YGIIPAUsockaddr_in@@@Z` | `0x10c0` |
| 5 | `?GetSockAddress@@YGXIAAUsockaddr@@@Z` | `0x1290` |
| 6 | `?GetSockErrString@@YGPBDI@Z` | `0x2350` |
| 7 | `?GetSockErrString@@YGPBDXZ` | `0x2310` |
| 8 | `?InitSock@@YGXXZ` | `0x2570` |
| 9 | `?IsIPXAvailable@@YG_NXZ` | `0x1130` |
| 10 | `?IsTCP_IPAvailable@@YG_NXZ` | `0x1110` |
| 11 | `?NonBlock_TCPConnect@@YGIPAUsockaddr_in@@@Z` | `0x2480` |
| 12 | `?SetSocketNonBlock@@YG_NI_N@Z` | `0x1010` |
| 13 | `?TCPConnect@@YGIPAUsockaddr_in@@@Z` | `0x23c0` |
| 14 | `?UninitSock@@YGXXZ` | `0x1000` |

确定的 TCP 路径：`TCPConnect` 在 VA `0x100023c4–0x100023ca`（file `0x23c4–0x23ca`）构造 `socket(AF_INET=2, SOCK_STREAM=1, protocol=0)`，在 `0x1000242a–0x1000242e` 以 16 字节 sockaddr 调用 connect。非阻塞版本在 `0x100024eb–0x100024f9` 设 FIONBIO=`0x8004667e`、值 1 后 connect。它们接受上层传来的地址，没有固定游戏端口。

容易误读的地址：file `0x99b8` 字符串 `128.127.50.1` **不是已确认的游戏服务器地址**。它由 `GetHostID` 的后备分支引用：file `0x120b–0x1211` 创建 `SOCK_DGRAM=2`，file `0x121e` 取端口 7，file `0x1249` connect，file `0x125f` getsockname，随后关闭 socket。该代码是在主机名无法给出本机地址时求本机 socket 地址；UDP connect 不等于已经发送业务数据。

## 4. ObjNet 游戏传输层帧规则

**静态证据强：`u16LE(payload 字节数) + payload`。** 这一结论有 buffer 构造、socket 发送、socket 接收三处相互支持，仍不能推出 payload 的 opcode、字段、业务状态或加密规则。

来源全部为 `/workspace/cdtank/CDTank/ObjNet.dll`：

1. 构造函数 VA `0x10023030` / file `0x5030`：`0x10023053–0x10023060` 检查 `0 < nSize < 65535`；`0x10023087–0x1002308e` 分配 `nSize+2`；`0x1002309c–0x100230a0` 用 x86 WORD 指令把 nSize 原样写入 buffer 开头（因此小端）；`0x100230ae–0x100230b2` 把 payload 复制到 buffer+2。
2. socket 发送函数 VA `0x10021e20` / file `0x3e20`：`0x10021f05` 在待发送大小上加 2；`0x10021f23` 通过 WS2_32 ordinal 19 的 IAT（VA `0x1006e56c`）发送 buffer。它保存已发送索引以继续部分发送。
3. socket 接收函数 VA `0x100220a0` / file `0x40a0`：`0x100220e8–0x10022105` 先读满 2 字节；`0x10022187` 直接从该 header 取 `movzx ... WORD`，没有 ntohs；`0x100221c9–0x100221d3` 按 header 指定大小取 buffer；`0x10022210–0x10022219` 算剩余 payload；`0x10022281` recv 剩余字节；`0x100222e1–0x10022317` 满包后调回调；之后重置并继续读下一个包。
4. `_ObjNetGetBuffer@12` 目标 VA `0x100243c0` / file `0x63c0` 调用 VA `0x10022f70` / file `0x4f70`：`0x10022fe1` 取 buffer 开头的 u16 长度，`0x10022fec` 返回 buffer+2 的 payload 指针。
5. VA `0x10027095` / file `0x9095` 写默认最大包大小 `0x1000`（4096），VA `0x10027efe–0x10027f28` / file `0x9efe–0x9f28` 允许修改 `[object+0x5c]` 并断言 <=65535。默认上限可能被游戏覆盖，不能将 4096 当作完整协议规格。

示意（只说明帧形状，`01 02 03` 是人为示例）：

```text
03 00 | 01 02 03
 3 LE | 3 bytes of payload
```

原始调试字符串提供额外追踪锚点：file `0x4303c` 为 `d:\project\objnet\objnet\connection.cpp`，`0x43188` 为 `...\lbuffer.cpp`，`0x435cc` 为 `...\sockman.cpp`，`0x431b4` 为 `nSize < 65535 && nSize > 0`，`0x43538` 为 `nSize <= m_u32MaxPacketSize`，`0x436bc` 为 `u32Size <= 65535`。file `0x482cc` 保留 `d:\Project\ObjNet\ObjNet\Debug\ObjNet.pdb` 字符串，file `0x43000` 的 Debug Directory 与 file `0x482b4` 的 CodeView 记录可复核。存在 PDB 路径不代表 PDB 文件仍在。

## 5. QQLogin 使用另一套登录传输与启动链

来源为 `/workspace/cdtank/CDTank/QQLogin.exe`。它内含 `QQ猫狗大作战`（GBK，file `0x343fc`）、`CQQLoginLogic`（file `0x34534`），以及以下字符串：

| file 偏移 | 字符串 |
| --- | --- |
| `0x34484` | `tcpconn4.tencent.com` |
| `0x3449c` | `tcpconn3.tencent.com` |
| `0x344b4` | `tcpconn2.tencent.com` |
| `0x344cc` | `tcpconn.tencent.com` |
| `0x34410` / `0x34418` / `0x34424` / `0x3442c` | `TIME` / `PWDHASH2` / `PWDHASH` / `QQUIN` |
| `0x34434` | `/START` |
| `0x345f8` / `0x34604` / `0x3460c` / `0x34618` | `%xlocaltime` / `%duin` / `%xmd5sig` / `%dlaunchnum` |
| `0x34624` | `%dlaunchnum:%duin:%xlocaltime:%xmd5sig` |
| `0x3466c` / `0x34678` | `%exepath` / `%exepathAutoPatch.exe` |

确定的连接路径：VA `0x405742–0x405781`（file `0x5742–0x5781`）把上述四个域名加入列表，随后打乱顺序；VA `0x40584f` / file `0x584f` 传 socket 类型 1（SOCK_STREAM）；VA `0x4058e4` / file `0x58e4` 明确传端口 `0x1f40`（8000），随后在 `0x4058ee` 调 VA `0x428821`。这个函数构造 AF_INET 地址，先尝试 inet_addr，必要时 gethostbyname，再 htons 端口并调用 socket 的连接方法。因此这是腾讯登录 TCP 8000 的代码路径，不是 client.dat 内的游戏登录端口 7001。

接收帧规则与 ObjNet 不同：VA `0x405ae9` / file `0x5ae9` 的接收处理函数在 `0x405afc–0x405b10` 先请求 2 字节；`0x405b16` 调用 thunk `0x419ada`（file `0x19ada`）→ WSOCK32 ordinal 15（ntohs）；`0x405b1b–0x405b1c` 减去 2；`0x405b23–0x405b29` 要求剩余 body 大小严格在 0 与 0x800 之间；`0x405b52` 读取 body 并传递到后续处理。

所以至少这一登录接收路径是 **`u16BE(total 字节数，包含 2 字节 header) + body`**。目前没有对整套 QQ 登录发送流程做对称验证，不应把此规则推广为所有 QQ 数据包定义。

确定的启动模板：VA `0x405e3e` / file `0x5e3e` 读取 `%exepathAutoPatch.exe`；VA `0x405f05` / file `0x5f05` 读取冒号分隔的四字段模板；VA `0x40604a`、`0x40607c`、`0x4060ae`、`0x4060e0` 分别替换四个占位符；VA `0x406108` / file `0x6108` 通过 SHELL32 的 `ShellExecuteA` 导入调用启动文件。它调用的是 AutoPatch，再由 AutoPatch 如何启动 CDTank 必须单独研究；这些模板不是已经验证的 `CDTank.exe` 启动命令。原启动凭据不可能只靠一行模板恢复为有效腾讯登录凭据。

旧网站字符串仅作产品/服务关系线索：file `0x3478c` 为 `http://cdtank.joypark.com.cn/event/ontop/score.aspx`，`0x34814` 为 `http://cdtank.joypark.com.cn/Guide/Key.htm`，`0x34840` 为 `http://cdtank.joypark.com.cn/History/Index.htm`，`0x34870` 为 `http://cdtank.joypark.com.cn`。没有访问它们。

## 6. 密码学线索与证据限度

QQLogin 包含可识别的内置实现，而非只包含“md5”字样：

- **MD5 算法特征，强证据。** VA `0x40ae90` / file `0xae90` 的初始化函数在 file `0xaea2,0xaea9,0xaeb0,0xaeb7` 使用四个 MD5 初始状态常量 `67452301, efcdab89, 98badcfe, 10325476`；VA `0x40b250` / file `0xb250` 的轮函数含 MD5 第一轮逻辑、7/12/17 位旋转，以及 file `0xb28d` 的常量 `d76aa478`。但未复原密钥派生或 `%xmd5sig` 的完整输入/拼接规则。
- **16 周期 TEA 形状的块算法，强证据。** VA `0x40a810` / file `0xa810` 从 2 个 u32 数据字和 4 个 u32 密钥字经 ntohl 装载；在 `0x40a865` 设循环次数 16；在 `0x40a877`（file 常量 `0xa878`）减 `61c88647`，等价于加 `9e3779b9`；每轮含左右移 4/5、与密钥和 sum 的加法/XOR，然后用 htonl 输出。逆向函数 VA `0x40a8e0` / file `0xa8e0` 在 `0x40a933` 用初始 sum `e3779b90`（16×delta 模2³²），在 `0x40a978` 反向更新 sum。VA `0x40a9e0` 附近出现随机 padding、8 字节块大小，值得进一步追踪。
- **未证实：**这些实现是否用于游戏 LoginServer 7001、是否用于所有 payload、具体 key 来源、业务号、账号验证、ticket 格式。TEA 存在于 QQLogin 不说明 ObjNet 层加密。
- 对 ObjNet 与 LSocket 的完整字节扫描，没有出现以上所列 MD5 初始常量、第一轮常量或 TEA delta 的原始小端编码。这个“未出现”只排除了指定字节序列，**不能证明 DLL 没有其他加密或由上层执行的加密**。

## 7. 对恢复工作的直接价值

1. 用新副本重写实际命名的三类 endpoint，就可以准备完全本地的游戏客户端联网实验；保留原文件及哈希。
2. ObjNet 的发送/接收边界足以制作 TCP 流离线拆帧、抓包保存或本地观察器。它们只能收集/显示 payload；回应任意“成功”包不能等价于正确登录。
3. 在主 EXE 中按虚表 `+0x10`（非阻塞连接）、`+0x24`（大小+数据发送）跟踪调用，比只搜 IP 更能接近真实登录消息。
4. 腾讯 QQ 登录与游戏登录是两层不同依赖。先确定游戏本身接受的启动数据和 LoginServer 首包，可以判断是否能为受控本地试玩实现新的认证入口。
5. 仍需复原 opcode/字段、响应驱动的客户端状态机、房间/大厅服务、战斗同步、物理/计分和持久化；本文没有把这些缺失项标记为已完成。

复核命令可直接只读执行：`sha256sum` 四个样本；`objdump -p` 检查 PE；例如 `objdump -d -Mintel --start-address=0x10023030 --stop-address=0x10023116 /workspace/cdtank/CDTank/ObjNet.dll` 检查帧构造。可选使用本地 `recovery/.venv/bin/python` 的 pefile/capstone；标准库即可复核配置、哈希、偏移和原始常量。
