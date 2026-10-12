# 战车保养报价与六按钮消费者

M6-03/UI-54正式消费者位于mend-shop-source-page.tsx。QUERY读取全拥有战车报价、OwnedRoles、RoleProfile和余额；按instanceId选择报价。六按钮对应Coin/Money各1/7/30天，currency分别为0/1，显示直接消费quote.displayCost。MAINTAIN携带实例、天数、币种和独立requestId，忙碌期间禁用交互，成功只用正式返回owned/profile更新名单、分钟与余额。Part维修仍禁用。

工程见recovery/output/tank-maintenance-engineering.json，生产mtime为1791224327612635125。浏览器组合证据见recovery/output/tank-maintenance-browser-accepted.json，主线review为recovery/output/tank-maintenance-root-review.json，结论PASS_FINITE_TANK_MAINTENANCE_SIX_CHOICES_CONFIRMED_DURATION_WALLET_RESTART_SCOPE。

真实Tank3的六报价在800/1920/3840完整图可读：Coin为5/25/50，Money为25000/125000/250000。六次正式维修后星币1000→200，金钱500000→100000，剩余分钟0→109440，显示76天。报价文字位于对应按钮范围内，消费者使用返回记录刷新。

同一已提交事务数据库经严格Close、compiled服务真实重启和正常重开，余额与期限保持一致，再次严格Close成功。持久化尾段未发送MAINTAIN，未修改资金或记录，未新增截图；Chrome、服务、Vite和临时目录均清理，3599/5629/9829为空。

有限范围为六个正式维修按钮、报价显示、返回余额与期限、数据库重启持久化和Close。Part维修及整个Mend父项保持未完成。

最终QUERY工程为server83027 build/copy退出0、Web72048 type/build退出0（1m51）、copy38283退出0。新账户编译QUERY检查24927退出0，空名单返回不构造余额或RoleProfile；MAINTAIN仍要求真实profile。主线另收13233网络期限tick与重启有限证据。
