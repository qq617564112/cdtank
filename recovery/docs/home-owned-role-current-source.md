# 我的家拥有角色当前状态原来源

范围：UI32/M5-07、UI34/M5-08。核定的来源是 Home 拥有战车/宠物的当前实例行状态，只覆盖原静态代码能够直接确认的构造、工厂设置和状态 3 绘制路径。没有运行时实证，也没有把其它 setter、商城、交易或修理路径纳入结论。

## 当前实例状态

战车行状态成员是 `+0x3c4`，宠物行状态成员是 `+0x32c`。

- 战车构造函数 `4bb3bc` 在 `4bb43c` 将 `[esi+0x3c4]` 清零。工厂在 `4ece05` 比较当前实例与 owned 记录，匹配时在 `4ece0f` 压入 `3`，`4ece11` 调用 setter `4bbcfd`；setter 将参数写入 `[ecx+0x3c4]`。
- 宠物构造函数 `4bc86b` 在 `4bc8d8` 将 `[esi+0x32c]` 清零。工厂在 `4de42d` 比较当前实例与 owned 记录，匹配时在 `4de437` 压入 `3`，`4de439` 调用 setter `4bd103`；setter 将参数写入 `[ecx+0x32c]`。
- 因此这两条当前工厂路径的构造初值是 `0`，当前匹配实例会得到状态 `3`。状态 `0` 进入 draw 的 switch 后不会命中任何绘制分支。

战车 draw `4bb6cf..4bbcfc` 从 `4bba1f` 读取 `[ebx+0x3c4]` 并逐项递减分派：状态 1 到 `4bbc15`，状态 2 到 `4bbb7a`，状态 3 到 `4bbadf`，状态 4 到 `4bba44`。状态 3 分支在 `4bbadf` 使用原字符串对象 `0x5cee74`。

宠物 draw `4bcb65..4bd100` 从 `4bce25` 读取 `[ebx+0x32c]` 并逐项递减分派：状态 1 到 `4bd01b`，状态 2 到 `4bcf80`，状态 3 到 `4bcee5`，状态 4 到 `4bce4a`。状态 3 分支在 `4bcee5` 使用同一原字符串对象 `0x5cee74`。

原字符串对象字节及对应值为：

| VA | 原字符串 |
|---|---|
| `0x5c192c` | `E` |
| `0x5cee70` | `S` |
| `0x5cee74` | `N` |
| `0x5c6410` | `B` |

因此，这两支 draw 的当前工厂状态 3 确切绘制字母为 `N`，不是旧 summary 中的其它字母映射。状态 1/2/4 的 draw 字符串只在上述分派中作为原常量记录；本范围没有恢复它们的 producer，也不把 selected、raw flags、期限或其它字段映射成这些状态。

## 字体、绘制点和资源

战车行构造函数在 `4bb657` 压入 `0x5cedf4`，该地址的 C 字符串是 `SmallHT`；经 `[0x5c03e4]`（原函数名表为 `CEGUI::FontManager::getSingleton`）后，在 `4bb67b` 调用 `[0x5c03b4]`（`CEGUI::FontManager::getFont`），并在 `4bb681` 将返回的字体指针存入 `[esi+0x3c8]`。

宠物行构造函数在 `4bcaee` 压入同一个 `0x5cedf4`，`4bcb0a`/`4bcb12` 调用同一组 FontManager 入口，并在 `4bcb18` 将字体指针存入 `[esi+0x330]`。

两支 draw 的状态分支都用各自字体成员调用 `[0x5c02d8]`；该入口的原函数名表为 `CEGUI::Font::drawText`。

状态分支的 `Const Rect` 来源是传入 draw 的行矩形 `[ebp+8]`。draw 开头将该矩形复制到 `[ebp-0x2c]`，随后：

- `0x5ccfe0` 的 float 原值为 `5.0`，加到行局部 x。
- `0x5e68b0` 的 float 原值为 `8.0`，加到行局部 y。
- 状态分支再把 `[ebp-0x2c]` 复制到 `[ebp-0x18]`，并用同一个 x/y 作为 `CEGUI::Rect` 的 left/top/right/bottom，经 `[0x5c03d8]` 构造零尺寸矩形，然后交给 `Font::drawText`。

所以原 draw point 是行局部坐标的 `(x+5, y+8)`。这里没有为状态字符串显式传入 `14x14` 目标矩形；`14x14` 是字体 glyph 资源尺寸，具体 glyph 基线、字符推进和内部位图放置由 `CEGUI::Font::drawText` 处理。

`SmallHT.font` 的原映射为：

| codepoint | 原文件 | 导出资源 | 尺寸 |
|---:|---|---|---:|
| 66 (`B`) | `data\ui\xiaoheitizi\b.tga` | `ui/regions/11/8.png` | 14x14 |
| 69 (`E`) | `data\ui\xiaoheitizi\e.tga` | `ui/regions/11/9.png` | 14x14 |
| 78 (`N`) | `data\ui\xiaoheitizi\n.tga` | `ui/regions/11/10.png` | 14x14 |
| 83 (`S`) | `data\ui\xiaoheitizi\s.tga` | `ui/regions/11/11.png` | 14x14 |

因此首验或 UI 代替实现必须把以下三件事分开：

1. 原调用点：`Font::drawText` 的零尺寸矩形位于行局部 `(x+5, y+8)`。
2. 原字体成员：战车 `+0x3c8`、宠物 `+0x330`，均选择 `SmallHT`。
3. 原 glyph 资源：状态 3 使用 `N`，对应 `ui/regions/11/10.png`，资源自然尺寸为 `14x14`。

## 边界

- 这是有限静态源结论，不称为 runtime 实证。
- `Font::drawText` 的精确内部缩放、字符推进或位图偏移属于外部 CEGUI 实现；当前二进制只恢复调用点、字体指针、原字符串和资源元数据。
- 当前只确认这两条工厂路径把匹配 owned 实例设为状态 3。没有证据把状态 1/2/4 的 producer、含义或生命周期恢复出来。
- 不把 selected、raw flags 或期限解释成状态 1/2/4，也不外推 Shop、Trade、Mend 或其它 setter。
