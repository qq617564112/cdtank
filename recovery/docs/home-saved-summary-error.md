# 我的家已保存统计查询失败反馈

M5-09/UI-36/UI-38。归属home-battle-summary-source-page.tsx/css，仅给真实查询失败状态添加data-summary-query-error、可聚焦滚动与完整title；现Web反馈条限高19，宽298，深底白字，overflow:auto。原反馈位置保持，错误文字不会跨到下方统计标签。此为Web反馈呈现，原错误producer未确认。原布局图片/五个确认字段、History分页刷新、请求owner和关闭事务保持原合同。

专属tests/browser-home-saved-summary-error.mjs为正常新空账户，真实关闭本轮独立server后打开Home，History自然连接拒绝。browser-home-saved-summary-error-2026-10-04T20-18-10-515Z.json首验PASS；1920整页已查看。反馈物理536.39×34.19，完整处于viewport且bottom在五确认字段前；实际原因保留，未知统计值为空。原生鼠标滚动至末尾，scrollTop12.78/clientHeight19/scrollHeight32；反馈仍有焦点。native Escape漏键[]、关闭与严格大厅Home焦点有效。无购买/配置/房间/对局，未重复正常History分页与三res。

工程：home-saved-summary-error-web-types.log exit0。本片尚待下一主线统一发行，未独立fullbuild。证据索引home-saved-summary-error-accepted.json待主审。正常统计数据/分页及旧三res复用home-battle-summary-page-accepted.json，本片失败原根/导航复用home-player-resource-error-accepted.json。完整资料/16控件、原附着/错误producer/字体与整页1:1仍未完成。
