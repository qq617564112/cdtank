# 原装填准星与弹量条

原装填反馈使用 `GameMain/prgCrossbar`，进度从0增至1。`GameMain/prgBullet` 接受两个整数，宽度为第二参数乘15，进度为第一参数除第二参数；它不是装填时间条。

## 装填反馈

`0x4c79c1–0x4c79e9` 按字符串 `GameMain/prgCrossbar` 查找控件，保存至UI实例 `+0xc8`。源布局 `ui/layouts/game_main.xml` 的矩形为 `l373 t234 r423 b271`，背景为 `zhunxing.tga`，进度图为 `zhunxing_yellow.tga`，`ProgressFormat=Vertical`，`Alpha=0.6`。

`0x4d4276–0x4d42a3` 把UI成员入口 `0x4cb670` 安装到控制器的时长观察者：注册入口 `0x423315` 保存于控制器 `+0x7c`。已恢复的本机射击通知 `0x423092` 向该观察者传递实际选中的float装填时长。

完整 `0x4cb670` 执行：

- `total = remaining = f32(duration + 0.5)`，分别保存在UI实例 `+0x7c` 和 `+0x78`。
- 向 `prgCrossbar` 调用 `CEGUI::ProgressBar::setProgress(0)`。

每帧 `0x4ca9d7–0x4caa1f` 在remaining大于0时执行：

- `remaining = f32(max(0, remaining - frameDelta))`；`frameDelta` 是UI实例 `+0x10` 的float。
- `progress = f32((total - remaining) / total)`；减法与除法在x87寄存器中连续执行，中间不保存float32。
- 向 `prgCrossbar` 调用 `setProgress(progress)`。remaining已为0时不再调用。

完整 `0x4cb6ab` 清remaining，并调用 `setProgress(1)`。该成员通过 `0x4d42a8–0x4d42d5`、注册入口 `0x42336f` 安装到控制器 `+0x78`。射击通知立即调用的观察者位于控制器 `+0xcc`，与此完成观察者不同。

## 弹量条

`0x4c7a35–0x4c7a5d` 查找 `GameMain/prgBullet`，保存至UI实例 `+0xd0`。布局矩形为 `l0 t48 r180 b83`，背景 `zidan1.tga`，进度图 `zidan2.tga`。`0x4d41e0–0x4d420d` 通过 `0x423288` 把成员 `0x4cb52f` 安装到控制器 `+0x68`。

完整 `0x4cb52f` 保存两个整数参数至UI实例 `+0x70/+0x74`，实际调用 `0x43293d` 读取角色记录 `+0x90` 状态。状态2或3时调用 `setWidth(f32(second × 15))`、`setProgress(f32(first / f32(second)))`；其他状态宽度和进度均为0。已验证正最大值12、当前值0/1/6/12，不把此入口解释为时间生产者。

## 验证

`recovery/.venv/bin/python recovery/evidence/roles/reload-hud-native.py` 通过5组完整时长/完成入口、25组真实帧指令和16组完整弹量入口。CEGUI导入由夹具记录参数，UI反馈分派边界由夹具供给；时长与float帧步长作为输入。

`npx tsx tests/reload-progress-native.cts` 通过25组原准星进度对照与空闲重置。生产 `ReloadProgress` 连续帧投影对照原float32 remaining及0.5秒附加视觉时长。首次收到快照时使用服务器时间恢复已经流逝的时间，属于重建同步。

证据：`recovery/output/reload-hud-native.json`。

## 限制

未执行完整原UI帧循环、CEGUI图块裁剪绘制、完成观察者的事件生产入口或弹量观察者两个整数的生产入口。原准星的0.5秒附加视觉时长不改变服务器射击期限。
