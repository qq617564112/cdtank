# 房内密语名单纵栏

UI05 / UI18 / M5-12。WAITING采用chat_intimatelist.xml三个源控件及108×111名单，PLAYING采用game_main_intimatelist.xml三个源控件及108×127名单。两份Listbox各消费十四个非空原纵栏图片引用；SelectionImage仅WAITING声明。

SourceChatIntimate的名单shell/ref接独立RoomIntimateScrollbar，消费现state.players的真实房内名单，选择沿现chooseTarget。正常viewport的父transform缩放通过resize两RAF刷新纵栏度量，并在卸载时取消RAF与监听。store、名单过滤、菜单状态、发送和字体保持现有合同。

05-15-51-058Z原raw PASS：合法map20/mode5原min4/max12，两个正常renderer资源就绪后，通过正式Account/Join追加十账户，按正式5000/10000心跳维持十二成员。WAITING和PLAYING各800/1920/3840完整页六图已查看，名字与原纵栏可辨。六组metricScale与listScale一致，分别1/1.8/3.6，thumb物理下限53成立。正常箭头滚动0→18、wheel→40、Home→0，thumb外拖保持capture，释放后Normal且无capture，End到105/89实际extent。选择真实末成员保中文draft及WAITING caret6、PLAYING caret5和input焦点。双正式Leave严格回Create并清空roster，十API成员正常Leave；无聊天发送或BUY，全部进程/临时目录和3492/5522/9722已清。

代码、来源、六图和原raw见room-intimate-scroll-source-accepted.json；两份早期raw FAIL保留。必要类型检查room-intimate-scroll-web-types.log与room-intimate-scroll-resize-web-types.log均exit0，统一terrain17-04-ammo18-19-room-intimate-production-web-build.log实际types/build exit0、1m42，release已同步；主审待登记。

## 未完成范围

名单18行高、8.5栏宽、53物理像素thumb与DOMextent为Web provider，原native名单factory与过滤仍未知。大厅Intimate的旧入口缺口保持独立；本片不关闭完整原页面、原挂载或1:1父项。
