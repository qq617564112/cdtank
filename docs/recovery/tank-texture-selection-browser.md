# 拥有战车迷彩正常页面验收

`tests/browser-tank-texture-selection.mjs` 从正常“我的家”拥有战车列表进入迷彩页，使用 `shop_tankpage_texture.xml` 的炮塔、车身、履带前后选择按钮及 `shop_tankpage.xml` 的保存按钮。两个独立浏览器账户使用临时SQLite数据库，明确导入原拥有记录夹具和角色资料；普通账户连接不会自动获得战车。

战车定义2、拥有实例72初始三槽为U20011/M20012/XY20013。正常鼠标选择U21011/M21012/XY20023，服务器确认后两处预览及保存三槽一致。原表三项分别收取50、50、10代币，余额200→90，金钱2000保持；显示余额及本次费用采用角色资料和原目录价格。未改变选择时保存禁用，点击不会再次扣费。第二账户同样拥有实例72、初始代币0，费用不足返回错误，三槽、余额和预览保持原选择，两账户的数据互不影响。

脚本检查实际预览已渲染战车定义2、存在网格和渲染帧，并观察所选炮塔、车身及履带A/B PNG请求成功。1080p和4K下原保存控件身份和对话框可见范围通过检查，保存后刷新页面、重启服务器再刷新均恢复同一三槽及余额；第二账户恢复自己的原选择。关闭迷彩页及角色页后预览状态为empty，页面和浏览器上下文、Vite和服务器由脚本释放。

## 复现与证据

在仓库根目录启动专用Chrome：

```bash
/home/node/.cache/puppeteer/chrome/linux-150.0.7871.24/chrome-linux64/chrome \
  --headless --no-sandbox --disable-dev-shm-usage \
  --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader \
  --remote-debugging-port=9254 --user-data-dir=/tmp/cdtank-texture-selection-chrome-9254 about:blank
```

从 `http://127.0.0.1:9254/json/version` 获取 `webSocketDebuggerUrl`，再运行：

```bash
node --import tsx tests/browser-tank-texture-selection.mjs '<CDP-WebSocket-URL>'
```

脚本自行启动服务器3019、Vite5200，使用临时数据库，完成后停止这两项服务。验收结束后停止专用Chrome9254。现有3001/5173服务不受影响。

结果记录在 `recovery/output/browser-tank-texture-selection.json`；终端日志为 `recovery/output/tank-texture-selection-browser.log`；截图为 `recovery/output/tank-texture-selection-1920.png` 和 `tank-texture-selection-3840.png`。这些运行证据按仓库规则忽略。

## 验证边界

原711条目录只有rarity0/2，没有rarity1；本次真实目录流程验证代币收费及金钱余额保持。拥有记录和资料由测试明确导入，不证明原购买或赠送来源。此验收覆盖重建账户确认、正常页面操作、已选组件纹理加载和持久化，不扩展为完整原皮肤资格规则、原网络成功回包或高清完整对局性能的证明。
