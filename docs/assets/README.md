# 素材来源

本目录保存 README 使用的项目截图，以及原作介绍使用的游戏标志与原版战斗参考画面。

## 项目截图

以下四张图片由项目维护者提供，拍摄日期为 2026-10-06，保留原始文件名与画面，用于展示复刻项目的界面和对局。

| 本地文件 | 内容 |
| --- | --- |
| [QQ图片20261006212305.png](QQ图片20261006212305.png) | 战车商城、模型预览与属性面板 |
| [QQ图片20261006212309.png](QQ图片20261006212309.png) | 猫狗商城、模型预览与技能信息 |
| [QQ图片20261006212312.png](QQ图片20261006212312.png) | 团队模式开场、战斗界面与小地图 |
| [QQ图片20261006212315.png](QQ图片20261006212315.png) | 战斗结算、奖章与再战确认 |

## 原作参考图片

| 本地文件 | 内容 | 来源页面 | 原图片地址 |
| --- | --- | --- | --- |
| [original-cover.jpg](original-cover.jpg) | 原作游戏标志 | [巴哈姆特作品资料页](https://acg.gamer.com.tw/acgDetail.php?s=10235) | [图片](https://p2.bahamut.com.tw/B/ACG/c/35/0000010235.JPG) |
| [original-battle.jpg](original-battle.jpg) | 原作坦克战斗截图 | [巴哈姆特作品资料页](https://acg.gamer.com.tw/acgDetail.php?s=10235) | [图片](https://p2.bahamut.com.tw/B/2KU/59/0000032959.JPG) |

图片于 2026-10-06 获取，以原文件保存，作为项目文档中的原作参考。

## 运行资源与字体

已提取并转换的运行资源通过 [GitHub Releases](https://github.com/qq617564112/cdtank/releases/tag/v0.3.0) 发布。执行 `npm run assets:install` 自动下载解压，普通运行无需原客户端或另行下载字体。

| 安装后的目录或文件 | 内容与来源 |
| --- | --- |
| `recovery/output/web-assets/` | 从原 Windows 客户端提取并转换的模型、贴图、音乐、音效、界面、字库与资源目录 |
| `recovery/output/verified/tables/` | 从原客户端解码的数据表，保存为 JSON 和 CSV |
| `recovery/output/web-assets/ui/fonts/SIMSUN.ttf`、`SIMSUN-password.ttf` | 原客户端使用的界面字体及密码字体 |
| `recovery/output/web-assets/ui/fonts/xiangjiao-brush.ttf` | 项目维护者提供的 `XiangJiaoKuanMaoShuaLingGanTi-2.ttf`，用于动态文字 |

## 权利说明

原作由上海软星制作、大宇资讯发行。图片中的游戏名称、标志、美术和界面归相应权利人所有，来源网站的图片展示不构成开放许可。项目截图中的原作素材同样保留原有权利；本项目代码的许可不授予原作素材的使用权。

第三方字体、从原客户端提取的模型、贴图、音乐和音效同样保留各自权利。原客户端 `CDTank/` 和安装后的资源目录由 Git 忽略，转换后的运行资源和解码数据表通过 Release 资源包发布。
