# React 商城与账户对局记录验收

E-R03 使用真实 App 页面、CDP 普通鼠标和键盘、原网络服务以及临时 SQLite 账户库。商城布局是既有重建布局；六种商品的名称、说明、价格和图标来自原资料。

## 商城业务

`react-account-2026-10-03-token-script-fail.json` 保存本段完整业务数据：六商品原图 decode 与尺寸、普通选择和数量输入、金币购买三份大包宠物饲料、余额不足拒绝与账户隔离、软星币购买、1080p/4K 可见布局。

暂停真实服务期间连续点击 BUY 只有一个请求，未确认余额不乐观更新。随后通过 TSRPC `preRecvDataFlow` 丢弃实际收到的网络字节；SQLite 确认已提交后真实断开 transport，关闭并重开商城，用相同 requestId 重试，仅扣款一次。此操作没有替换服务返回内容或购买规则。

新购实例经过 React 我的家库存配置到第五快捷槽，普通 Digit5 在自然 CPU 伤害后消费一份。购买本机的原 Effect11 五绘制节点与 GA15 播放断言、两端 itemUsed 事件一致断言均在自然对局完成前通过。对局自然完成，结算两端一致；退出清理后真实服务重启，库存剩余两份、第五槽绑定与余额 40 金币/20 软星币恢复。此前 E-R01 的连续两局及远端实际绘声证据复用 `react-match-browser.md`。

## 对局记录

`react-account-history-2026-10-03-token-script-fail.json` 中初始 authenticated query 读取同一库的真实自然对局；普通重开、刷新、失败提示、服务重启和页面刷新保留相同记录。随后显式 `AccountStore.recordMatchHistory` 增加二十一条分页夹具，正常服务器查询显示 20+2 行；这些分页夹具不代表自然比赛。

独立 `react-account-history-2026-10-03-isolation-final.json` 使用另一临时库，覆盖空态、显式 21 条保存记录的 20+1 分页、刷新失败保留确认行、SIGSTOP 查询关闭重开隔离、新账户空态、真实服务重启恢复及 1080p/4K 可见性。新账户零余额 BUY 活跃期间暂停服务、关闭重开再恢复：只发送一次 BUY，旧拒绝不写入新会话，新查询确认零余额和空库存。

## 证据范围

自然业务段与后续独立历史段使用不同数据库，不能解释为同一数据库跨段续接。自然业务段文件的总状态保持 FAIL：历史验收的启动 token 脚本覆盖新账户切换，导致末段账号隔离断言失败。本机实绘声的先前快照被末段 catch 覆盖，保留的自然对局日志与已通过断言证明执行顺序，完整远端绘声引用 E-R01，未宣称该 FAIL 文件拥有完整实绘快照。后续历史专项保存独立最终结果。

运行命令：`node --import tsx tests/browser-react-account.mjs`。仅历史相关检查：`node --import tsx tests/browser-account-history.mjs`；可用 `CDTANK_HISTORY_DB`、`CDTANK_HISTORY_TOKEN` 和 `CDTANK_HISTORY_EXPECTED_COUNT` 指向已有保存库。`CDTANK_ACCOUNT_OUTPUT` 与 `CDTANK_HISTORY_OUTPUT` 指定独立证据前缀。

原test:accounts:shop:browser与:consumables:browser入口同步改为CDP原生商品/数量/货币/房间选择，等待React提交后配置库存，Babylon观察导入定位scene-runtime.ts；保留原两局和双端表现断言。两脚本语法通过，本片未重复它们的长两局运行，其已通过相关业务由本片真实网页和E-R01证据覆盖，不将语法检查宣称完整旧fixture复跑通过。

最终非空失败保留补验：react-account-history-2026-10-03-confirmed-rows.json为PASS，真实服务器关闭后刷新保留20条已确认记录及第1/2页，重启再刷新同值；该独立历史库的账号隔离、关闭重开、分页与重启检查也通过，专属进程清理。
