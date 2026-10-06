# E-R05-N React原通知业务验收

`tests/browser-source-notice.mjs`使用独立3201服务、5233Vite缓存及9303Chromium。普通等待房间“邀请”实际发送RoomInvite，服务器INVITE_EMPTY拒绝原文进入React提示，随后鼠标OK、Enter或Escape关闭并恢复同一等待房间邀请按钮焦点；再请求与离房重进继续正常。

本片具体检查：控制器迁移是否丢失拒绝原文或pending completion；JSX是否改变原六控件、十八九宫格与PNG、Normal/Hover/Pushed状态；nested modal是否阻止父Ready与W/Space/Digit5；关闭、重复请求及等待房间session卸载是否留下旧提示；1080p/4K源几何与只读长中文滚动是否保持。

长中文内容由明示页面夹具通过现有controller.show提供，只检验read-only文字、overflow和原生wheel，不伪称服务端曾返回该长拒绝。实际业务拒绝始终来自真实RoomInvite，不注入网络或战斗状态。

各次独立时间输出，失败保持原状态。`--continuation`复用首段已完成控件/高清/鼠态，限定离房重进及长文字后段，不运行自然长局、账户或五模式回归。

综合交付索引：`react-notice-2026-10-03-accepted.json`。首段`17-31-18-853Z`九个完成检查覆盖真实拒绝闭环、源图/几何/高清、鼠态/Enter/Escape、父页面隔离及AddCPU；其整体FAIL保留。最终续段`17-33-42-572Z`整体PASS，实际离房session卸载、重进新提示、重复关闭与长中文wheel滚动至356/356通过。两段为独立数据库，不宣称持续账号身份。

3201、5233、9303均释放，专属服务、Chromium、Vite及临时目录已清理。原六控件及普通拒绝文案来源沿用既有原notify_dialog合同，页面夹具不扩大为原服务端完整恢复结论。
