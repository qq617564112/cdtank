# M5-02-P 房间目录翻页

原roomlist.xml实际含picRoomIcon0至9、btnPageUp/btnPageDown和yeshu。当前分页以原十位置为每页容量，仍使用既有选择列表，不声称完整原房间卡片恢复。后续M5-02-C-PAGING已实际执行原0x5056b3..0x5056f0：上一页enabled=page>0，下一页enabled=count>(page+1)*10（12边界向量，count/setEnabled端点为provider）。此有限启用算术有原来源；页码字符串格式、选择、刷新保留、排序重置与完整原按钮回调仍为重建规则或未恢复。

room-directory拥有纯分页计算：先调用全目录原有排序，再取10项；页码clamp。页面切换保留本页合法选择或选本页首个可加入房间，没有可加入项则禁加入而不跳其他页。排序切换回第一页；刷新跟随仍合法的旧选房到新的排序页，房间失效则当前页fallback，目录缩减时clamp；空目录0/0且两按钮和加入禁用。未改变服务器目录或加入资格。

room-controls拥有实际原生上下页按钮、output页码和选择/Join入口；请求期间禁止翻页，密码拒绝保留页/选房/密码草稿，成功后正常进入对局。所有新代码归现有lobby模块，shared协议、服务端、战斗规则和账户保存未修改。

失败假设：只排序当前页造成房号全顺序错误→全量orderRooms后分页；刷新把选中房切到错误页→合法选房索引追踪；删除后出现空末页→clamp；不可加入页误加入/跨页选择→本页资格fallback；密码失败改变页或草稿→现有确认finally重绘当前页。分页/旧排序专项PASS（room-pagination-rules/sort-baseline.log）。room-pagination-source.json仅原十位置与三个按钮/页码身份，不代表原回调。browser-room-pagination.json11实际场景PASS：30房三页、普通ID/EMPTY全局排序/密码失败保留/满员页禁加入/正常退出后缩页与选房回退跟随/普通正确密码JoinWAITING身份一致，1080p4K原生上下页遍历与五截图。实际服务器始终有五系统房，空0/0明确只规则专项覆盖。全仓类型/260运行边界/独立Web发行1m30s PASS（room-pagination-types/boundaries/build-web.log）。3188/5223/9293与临时数据全部清理，网页agent停止。M5-02-P已勾选，仅正常分页业务完成，完整原卡片与收发回调仍未完成。

命令test:rooms:pagination、test:rooms:pagination:browser。范围是正常页面目录与真实Join，复用现有CPU两局/账户保存/资源表现基线，不运行无关战斗或重启。
