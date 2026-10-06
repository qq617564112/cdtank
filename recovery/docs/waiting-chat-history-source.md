# 等待房间聊天历史纵栏

UI-01 / M5-12。原 `chat.xml` 的 `ChatTextBox` 是 574×114 WindowsLook/RichEditbox，消费 14 个纵栏图片引用，最小 thumb 53；WLRichEditbox 纵栏宽度为列表宽度的 0.05，位于右侧，DOM 文档高度与16px行步长作为Web provider。

05-47-56-933Z 是新 boundary/scale 修正后的唯一 scroll-tail raw：合法 WAITING 房间，19条真实中文公共消息，800/1920/3840 三图和三组 metrics 已记录；metrics.scale 与真实 listScale 分别1、1.8、3.6一致，bar实际边界在视口内，thumb最小物理尺寸成立。箭头0→16、wheel16→38、Home→0、End→190，thumb按下时真实capture，新增消息自动到底206，正常Leave严格回Create。代码中resize两RAF、scale依赖重启、blur监听和清理已覆盖。

原尾raw05-45-55-988Z断在长日志计数18，保留为失败证据。05-47 raw 在单次 outside moved 快照中保持 capture=true/state=Pushed，release 快照为 capture=false/state=Normal；未采样连续外移全轨迹，不作完整 native 声明。

三张新截图、server log、raw和类型检查见 `waiting-chat-history-scroll-accepted.json`。最终 resize/blur/data-scroll-scale hunk及等待文案 mtime 05:53:05 UTC；waiting-chat-history-final-web-types.log exit0。生产已接入，统一构建待主线下一必要batch。此前 WAITING 菜单、中文输入、频道、表情、密语拒绝和普通页面证据复用，不重复。

## 未完成范围

原 rich-edit producer、完整20控件与整页1:1仍未完成；单次外移 moved 快照保持 capture 与 Pushed，释放为 Normal；未采样连续外移全轨迹，不作完整 native 声明。
