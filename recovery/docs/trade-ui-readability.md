# 交易主页面与详情可读性

UI-60/61/62/63的当前生产消费者为 `apps/web/src/interface/account/trade-source-page.tsx`、`trade-source-page.css`、`trade-source-detail.tsx`。主页面继续按原 `trade.xml` 的615×403根布局和800×600基准缩放；部件、宠物、战车详情继续读取原 `trade_partdesc.xml`、`trade_petdesc.xml`、`trade_tankdesc.xml` 的控件与图片引用。

详情现在接收主页面同一 viewport scale，按原布局根 `all` 及后代累计边界建立stage，并通过 `SourceImageScale` 和同一 transform 缩放。原 StaticImage/StaticText/Editbox 的位置、尺寸、图片和字段映射保持不变；缺失字段继续为空。关闭详情是stage之后的独立Web操作区，不再覆盖原详情底框。

对方提供金额、创意点和技能点仍读取 `txtOtherMoney`、`txtOtherOriginality`、`txtOtherTech`。浅色原条带上的白字对比不足，因此当前渲染使用深色字与浅色描边，并在源码中明确为Web可读性修正，不声明原最终颜色。

未改动 SHOW、UNSHOW、CONFIRM、CANCEL、draft重置、交易协议或服务端结算。未编写unit test，未运行测试、浏览器、构建或类型检查。
