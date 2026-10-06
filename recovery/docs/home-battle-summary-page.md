# 我的家玩家页战斗统计

M5-07/UI-36右侧原rdoBattleSummary当前没有数据消费者，UI-38 myhome_playerpage_battlesummary.xml提供375×134主要背景与14个数值窗口。界面基准800×600，复用正式myhome.xml与myhome_playerpage.xml根、库存与现导航。

本片拥有新home-battle-summary-source-page.tsx/css、home-inventory.tsx仅右侧统计接线和专属browser/source/doc。主入口、Battle、协议、账户保存及原焦点cleanup不修改。Battle.history沿当前账号已保存MatchHistoryRecord查询，每次50条读取至返回total覆盖完整记录，查询失败不填零值、不阻库存。Win/Lose/Draw取已保存result.outcome，Destroy/BeDestroy取已保存kills/deaths总数，为当前Web历史投影；原统计累计语义与RoleProfile原offset未证明，不冒原消费者。命中/射击/伤害/连胜连败/在线时长/最高连击未知留空。保留旧完整AccountHistory窗口能力。

原子页父附着未证明；当前Web将原子页完整父链挂在玩家页右区域x219/y36，保留子页SheetWindow自身y198与375×134几何。该偏移复用当前原右区域起点，明确Web附着，不查未知坐标producer。原标题/获奖统计无现真数据保持禁用或不启用。本片不新增奖励/称号行为。

验收以当前正式Home整页800×600、1920×1080和3840×2160确认右侧源区域、可读数字、库存/导航层级；普通打开空历史保持零场的确认值，实际已有历史显示与真实History全部记录一致，刷新与正常关闭回大厅焦点。不重购入/装配/战斗全链；若只用于生成真实历史的最小必要普通短TIME_LIMIT需登记明确范围，不以夹具伪造比赛。完整玩家资料、原统计语义、14字段、1:1与UI36/UI38父项保持未完成。

统计图片为原浅底，当前源StaticText默认白字对比不足。此模块仅对五个确认数值加brightness(.15)作为Web可读性覆盖，保留原父链和字形消费者；该深字不作为原最终颜色恢复证明。

## 实际整页与当前已保存统计

18-30-32-312Z首普通空账户History确认0场，5数值为0，800/1920/3840实际Home完整图均已查看；根、左右区域、库存槽、统计背景与原BattleSummary选中图可见，刷新/关闭/重开和当前大厅Home焦点通过。该组图数值白字对比不足，不作为最终数值可读性证据。

18-34-07-137Z复用account-history-world自然两局的原持久库账号，先复制数据库到临时目录，正常真实History QUERY返回2条，当前生产每页50；Win1/Lose1/Draw0、击毁18/死亡14均与全部返回记录一致，正常刷新与关闭重开/大厅Home焦点通过。保留的原数据库两条History与settled记录不改变，未执行旧追加21条分页脚本。

18-35-42-441Z只定向最终1920整图和只读分页，已亲看深色“已保存对局统计 · 2场”与5深色数值可辨。浏览器只读仪器将现Battle.history每次请求页大小缩至合法1，真实History返回offset0/limit1/count1与offset1/limit1/count1，完整两记录的5数值一致。仪器不制造记录或数值，不修改生产每页50；不作为生产50条容量实测。此定向没有再次刷新/关闭重开/三res/购买/战斗。

18-32-20-759Z原FAIL保留，不作为非零证据。正常fixture账户必须在Page.enable后的newdocument script复用，并直接断言实际浏览器token匹配；凭证不写入专属raw网络或输出。专属3378/5428/9628无监听、临时目录清理完成。

组合限定范围见home-battle-summary-page-accepted.json。整个Home的右资料、称号/奖项、全部统计语义、高清字形间距及原父附着尚未完成；不能把当前5确认字段或局部PASS称玩家整页完整1:1恢复。
