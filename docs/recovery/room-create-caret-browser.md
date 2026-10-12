# 建房原光标正式页面验收

原CaratImage、光标位置与闪烁状态消费者正式验收 PASS6。`node --import tsx tests/browser-room-create-visual.mjs --caret-only` 通过正式大厅同一RoomCreateDialog，800×600、1080p、4K共45张页面截图；房名与密码保留原生输入值、选区、IME与横滚。

每个分辨率检查源资源实际解码为1×12且像素非空；两个input的原资源光标跨16px text area，native caret透明，图片层不接收命中。实际可见/隐藏阶段分别截图；普通输入、正向选区末端与反向选区起点、Home0、End横滚、失焦、pending禁用、真实CreateRoom拒绝后密码焦点与Escape关闭清理全部通过。中文composition由原生控件提交后，密码星号前缀位置继续同步。

完整源图片宽度保留在data-source-caret-width：800×600为1，1080p为round(1.8)/1.8，4K为round(3.6)/3.6，后两者均1.1111111111111112逻辑px。位置oracle用原生prefix字体测宽、scrollLeft与完整图片宽算Web目的位置，经浏览器CSSOM序列化后与实际left严格相等。54字密码End scrollLeft188、Home0；End图片位置800×600为135，1080p/4K为134.889。右端图片宽保留是Web滚动适配，来源及未完成边界见 `room-create-caret-source.md`。

clock使用原未舍入sum比较和float32 elapsed存储。原指令与生产函数核对0.5、0.51、1、1.01及0.5加1e-9边界；Web rAF提供delta，原时钟调用者与OS/GPU/display精度仍在父项。

证据为 `recovery/output/browser-room-create-caret.json` 及同前缀三分辨率页面截图。专属server、Chrome、Vite与临时目录均清理，3270/5300/9500无监听。
