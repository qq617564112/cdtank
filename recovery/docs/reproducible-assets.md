# 从原客户端重建资源

本页用于可选的资源重新提取与转换。Release 资源包已包含运行资源、字体和解码数据表。直接运行按 [README](../../README.md#本地运行) 安装依赖，执行 `npm run assets:install` 下载解压后启动即可。

重新提取使用 Python 3 和 Node.js 24.16 或更高版本。仓库根目录放置原 `CDTank/` 客户端，保留其 EXE、`Data/data.cpk`、`Data/music/music.cpk`、`Data/table`、loose 文件和 download 补丁目录。动态文字使用已安装的 `ui/fonts/xiangjiao-brush.ttf`；如需替换，可以通过 `--font` 提供 `XiangJiaoKuanMaoShuaLingGanTi-2.ttf` 或其他字体。

提取器只写新的 `recovery/output/verified`。资源包发布的 `verified/tables/` 仅含数据表，并非完整提取结果。重新提取时先将现有 `recovery/output/verified/` 移到仓库外保留，再准备依赖并执行：

```sh
python3 -m venv recovery/.venv
recovery/.venv/bin/python -m pip install -r recovery/requirements.txt
npm ci
npm run assets:rebuild
```

`assets:rebuild` 从脚本位置确定仓库目录，依序调用 `inspect_assets.py` 解包与解码表、`assets:catalog` 记录来源、`assets` 发布资源、复制附件字体到正式 `/ui/fonts/xiangjiao-brush.ttf`，最后运行 `assets:usage` 发布来源引用索引。任一子命令失败即停止并返回非零状态。脚本不修改原客户端或账户库。

`assets` 包括 MV3/POL/CVD 转换、整图物件/破坏模型/植物/环境动画与声音、导航和出生数据、战车、UI 与原字库/密码字体/表情序列、音乐音效、效果与动作/挂点/路径、技能道具目录及拥有战车纹理。战斗伤害、治疗和暴击数字仍使用原数字图片。

已有本地完整提取结果时明确复用：

```sh
npm run assets:rebuild -- --reuse-verified
```

重建默认沿用已安装字体，可通过 `--font /path/to/font.ttf` 替换；字体路径相对调用者当前目录解释。复用仅跳过解包与表解码，重建时原客户端仍须保留，后续导出器会读取原表和 EXE。现有 Web 资产会由对应导出器重写；不要以旧提取结果配合不同版本客户端。

两端构建和打包可以直接使用安装脚本下载的资源，无需先重建：

```sh
npm run protocol:generate
npm run build
npm run build:server
npm run release:package -- /srv/cdtank
```

发行包安装、启动、反向代理和账户备份恢复见 [运行与账户存档](../../deployment/operations.md)。`protocol:generate` 修改正式协议文件；只有协议源码变化时需要重新生成。

## 验收范围

本入口与0002地形原注册映射已在`ca86c6d...be2401c`范围完成一次集中静态走查，无P1/P2问题。尚未执行干净环境重建、协议生成或生产构建。已有单项资源与部署证据保持原范围；入口代码和来源索引不证明逐资产浏览器实载、原表现或完整多人高清交付，M8-01 父项保持未完成。
