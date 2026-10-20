# Electron 桌面客户端

Windows x64 客户端解压后运行 `CDTank.exe`，随包包含 Electron、Node.js、服务端、网页及完整运行资源，不需要另外安装 Node.js。首次启动使用本地模式；设置中的“连接设置”可保存本地／远程选择并测试游戏连接。本地模式将首页左侧“加载资源包”木牌替换为“充值”；远程模式隐藏这块木牌并上移系统设定，浏览器保留原有资源包入口。

桌面页面随窗口尺寸自适应，手机与平板沿用横屏安全区域布局。窗口与 EXE 图标复用网页标签页图标对应的 `client-icon-512.png` 成品。

## 本地开服

本地模式启动随包服务端，端口为 `3001`。进入首页设置的“连接设置”，复制显示的局域网地址，例如 `http://192.168.10.100:3001`。其他桌面客户端选择远程模式，填写这个地址，测试成功后点击“确定”，返回登录页连接同一主机。

Windows 防火墙首次询问时，允许随包 `node.exe` 在专用网络通信；手动配置时允许主机 TCP `3001` 入站。客户端本机入口 `127.0.0.1:3002` 只监听回环地址。端口已占用时设置会显示错误，不接管现有服务的存档。

退出主机客户端或切换远程模式会停止本地服务器和全部房间进程。存档保存在 Electron 用户数据目录的 `state/accounts.sqlite`，连接选择保存在同目录的 `connection.json`，服务日志为 `local-server.log`。重新解压或更新程序不覆盖用户数据。

首页“充值”填写已在本地注册的用户名、增加的星币和金钱，点击“充值”后累加到该账号余额并显示新余额。数量为非负整数，至少一项大于零；金钱余额上限为 `999999999`，星币余额上限为 `4294967295`，超出上限时整次操作不写入。操作由 Electron 通过专用进程通道交给本地服务器，在同一个数据库事务内完成；服务器不提供网络充值接口。已登录的账号重新登录后读取新余额。

## 远程连接

服务器地址可填写 `IP:端口`、`http://IP:端口` 或 HTTPS URL，未填写协议时采用 HTTP。远程模式仅将 `/game` WebSocket 与游戏 HTTP API 转发给所选服务器。界面、模型、贴图、音频、字体、清单、着色器编译器及本地训练资源均使用客户端随包内容，不下载远程网页或远程素材。服务器和客户端应使用相同版本。

Electron 始终从固定回环 HTTP 地址加载界面，因此满足 WebGPU 的安全上下文要求；Node.js 代理处理远程 HTTP／HTTPS 与 WS／WSS，局域网 IP 无需域名和证书。窗口启用上下文隔离和沙箱，不开放渲染进程 Node.js 权限。

“测试连接”使用独立连接发送 TSRPC 的二进制心跳，显示往返时间或失败原因，不创建账户、不影响当前登录。测试本地模式时会准备本地服务；若当前保存的是远程模式，测试结束后停止临时服务。点击“确定”才保存模式；更换连接后回到登录页。本地与不同服务器分别保存登录令牌、记住的账号及其开关。

浏览器访问默认远程模式，地址使用当前网页的源地址，本地开服选项禁用。浏览器修改远程地址后保留当前页面的资源来源，只改变联机连接与游戏 API；HTTP API 允许携带 Bearer 令牌的跨源请求。HTTPS 页面连接 HTTP 主机时显示提示；局域网免证书连接使用桌面客户端。浏览器直接通过局域网 IP 加载网页仍需受信任 HTTPS。

## Windows 打包

在 Windows x64 使用 Node.js **24.16 或更高版本**，先按现有资源流程准备 `apps/web/public/` 和 `apps/server/resources/`，再运行：

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/desktop ci --no-audit --no-fund
npm run desktop:build
```

打包入口直接编译网页、转译服务端和桌面入口、安装服务端运行依赖、复制完整资源与当前 Node.js 可执行文件，再生成 Windows x64 ZIP。`desktop:prepare` 只准备运行目录；完成准备后可用 `npm run desktop:start` 从源码启动客户端。打包不生成或压缩素材，不运行测试或类型检查，不创建 Git 标签或 GitHub Release。

产物为 `dist/desktop-packages/cdtank-desktop-<版本>-win-x64.zip`，同目录的 `win-unpacked/CDTank.exe` 可以直接运行。ZIP 须完整解压后使用。程序携带项目 LICENSE、NOTICE、Node.js 与 Electron 许可，字体许可随完整网页资源保留。桌面版本与根项目版本保持一致。

构建机为 `192.168.10.179`，工作目录 `D:\cdtank-desktop\build-20261019`，Node.js、npm 与 Electron 缓存位于 `D:\cdtank-desktop\tools`。

从 Linux 向 Windows 传输源码和资源时使用保留 UTF-8 文件名的 PAX 格式，避免中文贴图文件名在解包时变为乱码：

```bash
tar --format=pax -cf - apps/web/public apps/server/resources |
  ssh 192.168.10.179 "tar -xf - -C D:/cdtank-desktop/build-20261019"
```

## 验证范围

完成 Windows 打包并确认附件路径和大小。未运行单元测试、网络测试、类型检查或 Electron／浏览器界面验收；连接、开局和 WebGPU 画面的设备运行效果需要在客户端中确认。
