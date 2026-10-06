# 客户端预览规则与取证边界

E-04依据实际引用将home-preview-orbit从shared/combat迁入web/src/interface/home。该规则只被HomeTankPreview调用，服务端没有消费者；它持有原页面每次更新的float32轨道增量及预览裁剪面，不属于联机协议或两端共同规则。实际算法与公开类型保持原样，预览直接导入同目录模块，不保留shared副本。

原程序角度与投影取证及CTS合同迁入recovery/evidence/home-preview。native脚本仍运行原二进制指令，输出路径保持recovery/output；CTS导入迁移后的生产规则。命令`npm run test:home:orbit`覆盖64角度更新、16投影程序集与mode2相机绑定。生产运行不导入这些取证脚本。

浏览器使用`node tests/browser-home-preview-orbit.mjs <CDP浏览器WebSocket> <页面地址>`，检查实际生产相机逐帧角度、near10/far5000和关闭停止；正常战车/宠物页面使用`node --import tsx tests/browser-home-roles.mjs <CDP浏览器WebSocket>`检查账户来源、1080p/4K布局和预览、刷新/重启保存、拒绝与释放。

依赖检查阻止旧shared预览模块或旧tests取证脚本残留，确认新生产/取证路径存在。此片只证明预览模块边界；其余shared仍按真实生产消费者逐项整理，E-04保持未完成。

迁移验收全部通过：原64/16向量、实际镜头逐帧和关闭停止、正常战车/宠物账户及1080p/4K页面、正式Web与独立服务端构建、176模块运行边界。服务端新发行目录没有home-preview-orbit.js。编译服务真实账户/迷彩网络重启保存及CPU五模式各两局通过。日志为engineering-preview-{evidence,orbit-browser,roles-browser,web-build,server-build,boundaries,compiled}.log。
