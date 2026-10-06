# 房间卡片玩法图标来源

M5-02-CM：五玩法图标的原目录生产者与命名模式选择回调已执行确认。

| Web 模式 | 原模式 | 原命名模式 | Imageset | Image |
| --- | --- | --- | --- | --- |
| 1 | 0 | 团队（rdoTeamMode） | gy0 | data\ui\gy\0.tga |
| 2 | 1 | 占领（rdoConquerMode） | gy0 | data\ui\gy\1.tga |
| 3 | 2 | 擒王（rdoVIPMode） | gy0 | data\ui\gy\2.tga |
| 4 | 3 | 混战（rdoMeleeMode） | gy0 | data\ui\gy\3.tga |
| 5 | 4 | 破坏（rdoDestroyMode） | gy0 | data\ui\gy\4.tga |

Web 编号对应现有 `mode-runtime.md` 的玩法身份；原图块自身中文标签亦分别为上述五玩法。映射不来自文件名递增猜测。

## 原目录图片生产者

`0x5070b9` 读取目录条目 `+4` 的房间记录；非空在 `0x5070c0` 读取记录 `+0x38`，空指针分支产生 0。`0x5070c7–0x5070de` 用 `0x5cc770` 的 `data\ui\gy\%d.tga` 格式化该原整数，无减一或索引表。`0x5070fc` 使用 `0x5cc76c` 的 `gy0` 字符串，随后调用 CEGUI ImagesetManager/getImageset/getImage。`0x507150–0x507162` 对控制器 `+(slot+2)*0x34` 的控件调用 StaticImage::setImage。

`0x507ff6` 用 `0x5d5484` 的 `RoomIcon0/picGameMode` 查找控件，`0x50801e` 保存到控制器 `+0x68`。此偏移正是上述 slot0 的 `(0+2)*0x34`。slot9 的控件存于 `+0x23c`，由 `0x5081fd` 的 `RoomIcon9/picGameMode` 查找与 `0x508225` 的保存确认。

## 原模式身份

SelectMode 初始化解析控件名并保存：`0x4a47d8` 团队 `+0x88`，`0x4a484c` 占领 `+0x94`，`0x4a4812` 擒王 `+0x90`，`0x4a479e` 混战 `+0x8c`，`0x4a4886` 破坏 `+0x98`。

相应原选中回调 `0x4a60e8`、`0x4a6134`、`0x4a6183`、`0x4a61d2`、`0x4a6221` 判断事件控件与原选中标志 `+0x38c`，向选择控制器 `+0x24` 写入 0、1、2、3、4，然后调用 `0x4a5c12` 更新选择。因此五命名玩法原编号与图块中文一致。

## 可复现执行证据

命令：

```sh
recovery/.venv/bin/python recovery/evidence/rooms/room-mode-icon-source.py
```

输出 `recovery/output/room-mode-icon-source.json`：50 条原目录图片生产者执行（原模式0–4 × 十个卡片槽），验证原格式化输入、imageset、image 字符串、实际 setImage 目标控件与栈平衡；另执行五个原命名模式选中回调，验证真实 `+0x24` 写入和更新调用。结果 PASS。

执行使用原 EXE 指令；提供对象布局，printf、CEGUI 字符串／资源查询／setImage 和选择更新出口以明确 hook 捕获，不代表完整 CEGUI 或在线收包执行。证据包含生产者、控件初始化和选择回调的逐行原反汇编。

## 未完成范围

房间网络记录 `+0x38` 的上游构造／接收入口，以及完整目录／分页收发回调未恢复。此图标交付不能关闭 M5-02 父项；正式 Web 运行时以实际服务端模式身份选择已证明的图块，原网络线格式仍保持未知。
