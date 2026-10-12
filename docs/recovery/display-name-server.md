# 账户确认昵称

`AccountDisplayName`在独立SQLite表`account_display_names(account_id,name)`保存重建账户昵称，`AccountStore.displayName`与`setDisplayName`提供窄接口。账户不存在时拒绝；没有保存昵称时返回原大厅别名`坦克手-${accountId.slice(0,6)}`。设置为幂等SET，SQLite成功写入后才返回；不规定昵称唯一性，不收费。

`registerDisplayNameApi(server,accounts,accountByConnection,sessionByConnection)`注册`DisplayName`。请求`{name?:string}`省略name时查询，响应`{name:string}`。设置前trim，保留1至16个Unicode码点；空白、过长及原请求中的`U+0000..001F`、`U+007F`控制字符拒绝。16个emoji可保存，不把UTF-16代理对算作两个字。

身份来自认证连接对应账户。查询在房间中也可使用；设置时该账户任一连接仍在房间就返回`NAME_IN_ROOM`，包括从另一大厅连接发起的修改。未认证返回`ACCOUNT_REQUIRED`，其余无效设置返回`NAME_REJECTED`。成功确认的昵称由房间和大厅业务使用，不接受请求里的临时姓名覆盖。

协议用现有`npm run protocol:generate`生成，相关严格类型检查通过。`npx tsx tests/display-name-network.cts`通过：正式服务入口、3201独立服务和临时数据库覆盖查询、中文确认、幂等设置、16个emoji码点边界、九次拒绝保持、同账户第二连接限制、正常房间/大厅身份以及真实服务重启恢复。专项逐字节对照原368字节资料及两字符串，逐记录对照库存，余额12345/678字节包含在完整资料对照中。结果和日志保存于`recovery/output/display-name-network.*`，专属服务和临时数据库已清理。

## 来源边界

原profile两字符串语义和原改名行为未恢复。本片是独立账户昵称规则，绝不写原profile、库存或余额，不声明原服务器改名协议、费用或唯一性。
