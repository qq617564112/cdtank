# public 资源目录

`apps/web/public/` 发布网页实际读取的资源，顶层按文件职责分为 `assets/`、`data/`、`manifests/`。素材源图与压缩成品分别保存在 `art/hd/`、`art/compressed/`，沿用配方中的逻辑资源路径。

```text
apps/web/public/
├── assets/
│   ├── ui/
│   │   ├── atlases/             UI 精灵图
│   │   ├── images/              独立 UI 图片
│   │   └── fonts/               网页字体
│   ├── models/{hd,original}/    模型，按 tanks、pets、props、maps、effects 等用途分组
│   ├── textures/{hd,original}/  对应画质的外部贴图
│   ├── textures/shared/         共用辅助贴图
│   ├── minimaps/
│   │   ├── backgrounds/         小地图底图
│   │   └── markers/             小地图标记
│   └── audio/{music,sfx}/       音乐、音效
├── data/
│   ├── maps/<地图ID>/           移动、水面、植物、地形、环境声音等地图配置
│   ├── maps/shared/             场景放置、共用材质和动画配置
│   ├── maps/battlefields.json   战场配置
│   ├── tanks/                  战车、履带配置
│   ├── effects/                特效配置
│   └── combat/                 技能道具目录
└── manifests/
    ├── sprite-images.json      UI 图集区域、独立图片与别名
    ├── battle-artwork.json     怀旧、HD 模型与贴图映射
    ├── image-assets.json       Vite 提供的下载目录与缓存版本
    ├── ui.json                 界面布局、图片集
    └── …                       音频、字形、表情清单
```

`image-assets.json` 在开发环境由 Vite 动态提供，生产构建时写入 `manifests/`；开发 public 中无需保留实体副本。

## 资源标识与发布地址

界面继续用 `/ui/...`、`/Data/ui/...`、`/bundled-ui/...` 查询 `sprite-images.json`。清单返回 `assets/ui/atlases/` 的区域或 `assets/ui/images/` 的独立图片地址。已合图图片及旧别名不需要另存一份单图。

内容定义中的 `Data/...`、`tank-textures/...` 等模型和贴图标识由 `battle-artwork.json` 解析。战斗场景选择怀旧或 HD，“我的家”和商城的现有 3D 展示使用 HD。UI 与小地图沿用当前素材。字体、音频和数据目录使用实际发布地址。

模型移动后，GLB 的外部图片 URI 按模型所在目录重新计算。战斗清单同时登记 HD 发布地址，地图配置引用 HD 地址时仍可在战斗中切换到怀旧素材。相同的基础文件与 HD 副本只保留一份。

## 发布入口

新增图片先保存 HD 源图、更新配方，再生成 compressed，完整规则见[高清资产压缩与精灵图](asset-compression.md)。

```bash
# UI：直接读取已有 compressed，生成图集与独立图片
npm run assets:sprites

# 战斗：从 original、compressed 发布双画质模型与贴图
npm run assets:battle-artwork

# 其它独立图片：从 compressed 发布指定文件
npm run assets:publish -- --image <compressed中的相对路径>

# 整理已有 public 文件、JSON 和模型引用
npm run assets:publish
```

`assets:sprites` 和 `assets:battle-artwork` 在完成生成后自动整理目录，并清理各自清单中的过期输出。`assets:publish` 复用文件，不重新缩放或编码；`--image` 可重复指定，接受 `--source`、`--output`，默认读取 `art/compressed/`、发布到 `apps/web/public/`。Web 发布入口支持 `CDTANK_WEB_ASSETS`。

制作提示词、字体试排、转换来源清单和预览制作文件保存在 `output/public-authoring/`，模型及图片的原始来源仍保留在 `art/` 和 `recovery/`。原客户端批量导出产生的中间路径由重建流程末尾的 `assets:publish` 归档；随后按当前压缩流程生成 UI 与双画质战斗资源。

1.0.1 及以后 GitHub 资产包包含完整的整理后 public，服务端表和碰撞资源保存在程序包的 `content/`；服务端文件命名保持原有结构。安装器将资产包的 `public/` 内容合并到程序包的 `web/`，保留构建生成的 `manifests/image-assets.json` 和 JS 等文件。打包与安装见[发布说明](github-publication.md)。
