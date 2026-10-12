# 建房组合输入与 Escape 松键

UI07 / M5-02 / M5-16。RoomCreateDialog 在组合输入期间保持窗口、草稿和输入焦点。组合结束后 Escape 按下保留窗口，松键消费事件再关闭，焦点返回原 Create 按钮。事件修改仅涉及 modal composition、keydown/keyup 和 native cancel；输入限制、草稿、确认提交、字体与资源保持既有合同。

`browser-room-create-composition-escape-release-2026-10-05T03-21-25-269Z.json` PASS：普通账户经地图选择打开建房，中文草稿在合成 composition 生命周期及原生 CDP Escape 后保持；组合期间合成 cancel 保持窗口。结束组合后 down 保持 open/withinDialog/draft，up 关闭并 strictCreate，window keys[]。network[]，没有 CreateRoom/Join/Ready/Leave/BUY/send，resolutions[]、screenshots[]。runner exit0，3460/5490/9690 无 listener，Chrome/Vite/server/temp 已清理。

工程：`room-create-composition-escape-release-web-types.log` exit0；统一 `trap3004-room-create-production-web-build.log` types/build exit0，Vite1m35，包含本片事件 hunk；root 已有限主审通过。

有限范围：composition/cancel 为合成事件，Escape 为原生 CDP 驱动；未验 OS IME 候选界面、新图、pending submit 或业务事务，不关闭整页父项。
