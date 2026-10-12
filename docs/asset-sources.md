# 素材来源

游戏名称、模型、美术、音乐、音效、界面和原字库来自《阿猫阿狗大作战 Online》Windows 客户端，由上海软星制作、大宇资讯发行。转换工具保留模型几何、UV、动画和来源记录，高清素材以原作内容为依据。运行资源与源码分别管理。

## 运行资源与字体

| 目录或文件 | 内容与来源 |
| --- | --- |
| `art/original/` | 原客户端导出的原尺寸图片与模型 |
| `art/hd/` | 高清源图、模型贴图、界面素材与资源快照 |
| `art/compressed/` | 按逐图配方生成的 WebP 等运行成品 |
| `apps/web/public/` | 模型、贴图、音频、界面、字库与发布清单 |
| `apps/server/resources/tables/` | 原客户端解码数据表，保存为 JSON 和 CSV |
| `apps/server/resources/assets/` | 场景、战场及碰撞数据 |
| `apps/web/public/ui/fonts/SIMSUN.ttf`、`SIMSUN-password.ttf` | 原客户端界面字体与密码字体 |
| `deployment/assets/ui/fonts/xiangjiao-brush.ttf` | 维护者提供的 `XiangJiaoKuanMaoShuaLingGanTi-2.ttf`，用于动态界面文字 |
| `deployment/assets/ui/fonts/Silkscreen-Regular.ttf` | Silkscreen 字体，用于运行时显示；许可随字体提供 |

素材生产与发布见[运行美术资源](original-assets.md)和[资产压缩与精灵图](asset-compression.md)。GitHub 已发布资源包和当前主线的兼容范围见[发布说明](github-publication.md)。

## README 图片

README 顶部的[高清标志](assets/logo-hd.webp)复用登录页发布资产 `apps/web/public/assets/ui/images/login/logo-white-outline.webp`，文档副本随源码保存。源图为 `art/hd/ui/login/logo-white-outline.png`，压缩配方输出为 `art/compressed/ui/login/logo-white-outline.webp`；源尺寸 3840 × 2160，发布尺寸 2361 × 1328，使用 `near80` WebP 编码。源图 4,072,433 字节，成品 1,206,118 字节，体积减少约 70.4%。

以下四张项目截图由维护者提供，拍摄日期为 2026-10-06，保留原始文件名与画面：

| 文件 | 内容 |
| --- | --- |
| [QQ图片20261006212305.png](assets/QQ图片20261006212305.png) | 战车商城、模型预览与属性面板 |
| [QQ图片20261006212309.png](assets/QQ图片20261006212309.png) | 猫狗商城、模型预览与技能信息 |
| [QQ图片20261006212312.png](assets/QQ图片20261006212312.png) | 团队模式开场、战斗界面与小地图 |
| [QQ图片20261006212315.png](assets/QQ图片20261006212315.png) | 战斗结算、奖章与再战确认 |

原作参考图片于 2026-10-06 获取，以原文件保存：

| 文件 | 内容 | 来源页面 | 原图片地址 |
| --- | --- | --- | --- |
| [original-cover.jpg](assets/original-cover.jpg) | 原作游戏标志 | [巴哈姆特作品资料页](https://acg.gamer.com.tw/acgDetail.php?s=10235) | [图片](https://p2.bahamut.com.tw/B/ACG/c/35/0000010235.JPG) |
| [original-battle.jpg](assets/original-battle.jpg) | 原作坦克战斗截图 | [巴哈姆特作品资料页](https://acg.gamer.com.tw/acgDetail.php?s=10235) | [图片](https://p2.bahamut.com.tw/B/2KU/59/0000032959.JPG) |

## 原作资料

[巴哈姆特作品资料页](https://acg.gamer.com.tw/acgDetail.php?s=10235)提供原作名称、制作发行信息和参考画面。原作背景与其它资料见[原作介绍](game-background.md)。网站展示素材不构成开放许可。

## 权利说明

原作素材及其转换、高清化或衍生版本保留相应权利人的权利。第三方字体和组件保留各自许可。本项目的[源码许可](../LICENSE)不授予原作素材或第三方字体的使用权；版权和来源声明见 [NOTICE](../NOTICE)。
