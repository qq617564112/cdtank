# 还原文档索引

[任务清单](tasklist.md)是当前功能范围、完成状态和验收依据的统一入口。专题文档记录资源格式、原程序来源、实际实现与各自验证范围。

## 入门

- [开发指南](../../docs/development.md)：工程职责、范围、常用命令和配置。
- [从原客户端重建资源](reproducible-assets.md)：可选维护流程；运行资源、字体和内容表可通过 `npm run assets:install` 自动安装。
- [资产清单](asset-inventory.md)与[模型格式](model-formats.md)：原资源构成和 MV3/POL/CVD 解析依据。
- [运行与账户存档](../../deployment/operations.md)：独立发行包、反向代理和备份恢复。

## 游戏与账户

- [联机基础](server-foundation.md)：网络与服务端基础。
- [可玩对局](playable-match.md)：五模式对局及规则来源。
- [CPU 运行](cpu-runtime.md)与[CPU 验收](cpu-acceptance.md)：自主对局与目标达成范围。
- [登录与频道](login-channel-policy.md)：认证和频道入口。
- [账户库存](account-inventory.md)、[快捷槽配置](kitbag-configuration.md)与[道具输入](item-hotkeys.md)：库存、配置和输入链。
- [战车运行](tank-runtime.md)：原战车部件、模型和动作。

## 画面与声音

- [界面资源](ui-runtime.md)：布局、图块和字体来源。
- [音频](audio-runtime.md)：原音乐、声音 ID 与事件接线。
- [特效运行](effect-runtime.md)与[特效状态](effect-progress.md)：效果格式、运行和还原覆盖。
- [战斗相机](battle-camera.md)：原相机参数与网页接线。

## 工程边界

- [客户端职责](engineering-client-boundaries.md)：界面、对局、渲染、网络与诊断入口。
- [服务端职责](engineering-server-boundaries.md)：账户、房间、战斗与结算。
- [共享消费者](engineering-shared-consumers.md)：两端共用规则和取证边界。

原始取证脚本位于 `../evidence/`。运行资源与解码数据表通过 Release 资源包安装到 `../output/web-assets/` 和 `../output/verified/tables/`。下载、提取和验收产物由 Git 忽略，文档中的既有结果保持各自记录的范围。
