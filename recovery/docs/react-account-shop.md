# React 道具商店

对应任务：E-R03。

`apps/web/src/interface/account/shop.tsx` 的 `AccountShopView({open, close, source})` 负责受控开启；`ShopSession` 持有当次对话框、权威商品与余额、候选商品、数量、支付方式和提示。界面采用 JSX，保留原商店布局、全部 `data-shop-*` 选择器及 `data-purchased-instance`，商品名称、说明、价格来自 Shop 响应，图标从原 `daoju0` 图片集解析，优先使用 DDS 导出的资源。

外层组件在关闭时保持挂载，持有尚未确认的 `ReqShop` 与正在进行的购买 Promise。购买按钮同步检查该 Promise，因此同一购买响应前不能重复发送。相同商品、数量、货币的失败重试继续使用原 requestId；修改购买语义会产生新 requestId；明确成功才清除旧请求。重新打开时候选草稿从未确认请求恢复，并先 QUERY 权威商品和余额。关闭期间返回的购买结果不更新已关闭页面，也不直接写入新页面；新页面重新 QUERY。结算发生在新页面 QUERY 期间时，会排队再查询一次，以显示结算后的余额。

普通刷新保留候选商品、数量与货币；忙碌时禁止修改购买控件，但允许返回和 Escape 关闭。页面按键停止传播到对局输入，受控数量输入保持中文输入事件语义；购买或刷新完成后在焦点未转移的情况下恢复发起按钮。卸载关闭 native dialog、撤销资源加载、失活当次网络响应并恢复仍存在的先前焦点。

## 验收

`npx tsc --noEmit -p apps/web/tsconfig.json` 通过，确认 JSX/协议/入口类型一致。真实商品购买、余额、同 requestId 重试、关闭期间购买、中文输入、高清布局、库存和重启恢复由 E-R03 浏览器验收统一登记。
