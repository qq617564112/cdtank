# 建房原按钮状态正式页面验收

正式验收PASS6，800×600、1080p、4K共42张成功页面截图。三分辨率实际图片/状态样本分别29、29、27组；专属server、Chrome、Vite与临时目录均清理，3270/5300/9500无监听。

`node --import tsx tests/browser-room-create-visual.mjs --button-only` 在正式大厅同一个RoomCreateDialog，对800×600、1080p、4K实际按钮图片层核对原状态与图像消费，证据为 `recovery/output/browser-room-create-button.json` 与同前缀截图。

页面oracle沿 `room-create-button-native.json` 的完整原状态结果，比较实际图片子层数量、Normal/Hover/Pushed/Disabled/CheckMark属性与源asset、computed background-image、opacity、几何和命中；不以父节点的asset标记代替实际画图。selected RadioButton的状态背景与CheckMark同时核对，disabledselected保留两个独立图片层；缺DisabledImage的确认/关闭按钮pending阶段无custom图。

真实鼠按箭头、拖出、返回和释放沿原hover XOR pressed状态，回内释放执行一次增加，外释放不增加。HTML Space在keyup执行、Enter在keydown执行；按住Space后Tab失焦和captured鼠按后Tab失焦取消held，不额外执行。友伤真实切换、pending禁用且拒绝重复创建、服务实际密码拒绝后保持草稿与密码焦点、按住鼠键时Escape关闭并重新打开状态清除均检查。

最终普通玩家沿Tab聚焦确认、Enter创建，真实CreateRoom进入权威WAITING，保留开局7人和友伤草稿，再正常离房清理。键盘行为为Web适配，来源与原OS/font/GPU/display边界见 `room-create-button-source.md`。
