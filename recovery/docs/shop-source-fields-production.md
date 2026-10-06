# Shop原始展示字段正式接口

原Item表loader列22 GGet/+f4和列23 Durable/+f8以uint32形式发布为可选 `getMethod`、`durable`，经combat catalog、Shop QUERY和生成协议传到网页。当前正式目录104商品逐项与原表比较一致。旧明确夹具缺少这两个字段时，展示consumer保留空值。

`tests/shop-source-fields.cts`验证表、原loader样本、QUERY对象及TSBuffer往返。`tests/shop-source-fields-network.cts`使用已发布编译服务，普通创建账户后查询库存、Shop与库存，六组商品字段一致，库存不变。两项均exit0；测试服务端口3571已清理。服务端构建67546与release copy均exit0。索引：`recovery/output/shop-source-fields-qualified.json`。

原展示数量由439950的ID范围和非零Durable确定。原价格文本由4d96ba的GGet分支确定。此接口提供原始输入，未改变现有购买事务。

## 未完成范围

原商品购买资格、服务端库存创建及批量购买数量政策仍缺权威来源。GGet0原页面过滤与当前支持的可购目录存在差异，继续归M5-10；展示字段通过不关闭完整商城父项。
