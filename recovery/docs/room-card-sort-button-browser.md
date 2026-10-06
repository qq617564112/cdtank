# 房间排序源按钮实际验收

browser-room-card-sort-button-accepted.json收录5个完成检查范围、19张PNG及原图RGB结果。三分辨率来源03-15-52-131Z原raw的checks0–2与18实际图；原FAIL保持，后续未完成操作不采纳。03-19-59-145Z普通续段PASS2补齐可信键盘/分页与真实refresh pending禁用，不重复18图。原来源见room-card-sort-button-source.md。

3314专属服务普通API建立12房，与系统5房组成17真实房间。夹具人数遵守原map7最多6人，偶数房最多6、奇数房最多4。800×600/1920×1080/3840×2160分别显示两个原排序按钮的Normal、Hover、Pushed，六图态×三分辨率共18PNG；按钮源91×42/(391,271)矩形、可见视口、elementFromPoint命中、图片层pointer-events:none/alpha1、精确源图片引用均通过。原源PNG的同质3×3opaque内区映射截图目的坐标，18图所有样本RGB逐项相同。800实际PNG已目视检查。

普通点击空房间源按钮切EMPTY，按实际服务器room可加入状态/空位/人数/ID取得当前前十顺序，R6身份保持且可见；点击编号按钮切ID得到R1–R10并保留R6。两控件同一DOM按钮保留焦点，可信Tab找到排序，Enter切EMPTY、Space回ID。普通刷新恢复R6。实际下一页选R17（明确等待完整选中身份）后切EMPTY回第一页并选择合法可见R5；再切ID仍第一页R5，保留既有排序回首页规则。中文昵称草稿与MediumHT可读baseline编号不变，SIMSUN页码/斜杠保持，world为null。Join/WAITING/Leave复用PAGING有效范围。

root限定room-controls.tsx将RoomCards busy接为busy||refreshing。专属服务短SIGSTOP期间普通刷新产生真实pending，源排序state Disabled/disabled=true、图片层为0，普通可信点击不切换mode；busy截图按钮中心RGB(38,59,73)等当前面板，验证无UA灰底或Normal回退。finally SIGCONT恢复服务器，真实响应后按钮可用、目录/选择正确。该补段专属进程与临时目录全部清理。

## 边界

原visibility/排序callback未恢复，切换目标与比较器仍明确既有Web重建，原完整大厅锚点/GPU截图留父项。像素结果限定同质opaque内区及busy当前Web透明合成，未声明原GPU边缘等价。原raw失败、失败截图及未完成范围保持独立。三分辨率图来自busy接线前未刷新状态，源码图/按钮消费者未改；busy新真实续段来自新Vite实际接线之后。
