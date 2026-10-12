<!-- CODEGRAPH_START -->
## CodeGraph

In repositories indexed by CodeGraph (a `.codegraph/` directory exists at the repo root), reach for it BEFORE grep/find or reading files when you need to understand or locate code:

- **MCP tool** (when available): `codegraph_explore` answers most code questions in one call — the relevant symbols' verbatim source plus the call paths between them, including dynamic-dispatch hops grep can't follow. Name a file or symbol in the query to read its current line-numbered source. If it's listed but deferred, load it by name via tool search.
- **Shell** (always works): `codegraph explore "<symbol names or question>"` prints the same output.

If there is no `.codegraph/` directory, skip CodeGraph entirely — indexing is the user's decision.
<!-- CODEGRAPH_END -->

## 当前实现协作

- 仅root创建、调度subagent；subagent不得创建或继续分发给其它subagent。
- 不联系其它session。仅在当前任务树内向root汇报实现结果。
- 并行实现使用root分配的独立Git分支和worktree。每个实现者只修改分配文件，提交后向root提供SHA；root在集成分支合并，禁止撤销他人修改。
- 实现subagent使用gpt-5.2；整批完成后仅由一个gpt-5.6 subagent集中代码走查，禁止频繁走查。
- 不编写unit test，不运行测试、浏览器验收、构建或类型检查。现有证据按既有范围复用，代码走查不能代替tasklist正文要求的实测或原始来源。

## 贴图新增与更新

- 统一顺序：`art/hd` 源图 → 压缩配方 → `art/compressed` 成品 → `apps/web/public` 发布资源。新增或更新图片必须完成这条流程，仅修改 public 不算完成。
- 先将创作导出的原始图片按运行资源相对路径写入 `art/hd/`；更新时替换对应 HD 源图。保留 `art/original/`，不要将 compressed 或 public 中的压缩成品回写 HD 后反复有损编码。
- 压缩前更新 `scripts/asset_compression/recipe.json` 的对应条目，记录源路径、输出路径、源尺寸、最终尺寸、用途分类、尺寸依据及编码方案。先根据模型 UV 或 UI 显示用途确定最终尺寸，再一次缩放到该尺寸并编码；保持宽高比，不放大小图，像素画沿用已确认的原像素网格规则。
- 优先增量处理独立图片：`npm run assets:compressed -- --image <配方中的源路径或输出路径>`，多张图重复指定 `--image`。JSON 引用或模型内嵌图片需要更新时使用完整生成入口。压缩输出写入 `art/compressed/`，HD 源图保持原样。
- UI 图片压缩后执行 `npm run assets:sprites`，从 compressed 更新 public 的图集、独立图片和 `sprite-images.json`，页面使用原资源路径经清单解析。战斗模型或特效素材执行 `npm run assets:battle-artwork`，更新怀旧、HD 两套战斗资源及清单；UI 保持当前素材。
- 其它独立贴图用 `npm run assets:publish -- --image <compressed中的相对路径>` 发布，并同步代码、JSON 或 GLB 引用。public 顶层统一为 `assets/`、`data/`、`manifests/`，目录与逻辑资源标识见[public 资源目录](docs/public-assets.md)。运行栅格贴图使用 WebP，SVG、ICO 按配方保留。
- 交付时记录源图和发布路径、最终尺寸、编码方式及体积变化。依赖、参数和发布细节见[高清资产压缩与精灵图](docs/asset-compression.md)。

## GitHub 发布规则（1.0.1 及以后）

- 根 `package.json`、`package-lock.json` 的两处项目版本和 `apps/web/package.json` 同步，Git 标签使用 `v<版本>`。从已提交且干净的源码工作区构建；不自动提交工作区，不移动已有标签，不覆盖已公开版本。
- 同一个 Release 提供 `cdtank-<版本>.tar.gz` 程序包和 `cdtank-assets-<版本>.tar.gz` 资产包。资产包包含完整的 `apps/web/public/`，包内顶层为 `public/`，保留 `assets/`、`data/`、`manifests/` 及字体许可。服务端内容表、场景和预烘焙碰撞数据在程序包的 `content/`。
- 程序包保留编译服务端、运行依赖锁文件、前端构建产物及生成的 `manifests/image-assets.json`；按 public 的具体文件路径排除素材，禁止删除整个构建后的 `web/assets/`。程序包携带 `install.mjs`、`start.mjs`、`release.json`、存档工具、LICENSE 和 NOTICE。
- `release.json` 记录版本、标签、仓库、源码提交和资产附件名。安装入口为 `node install.mjs`：下载固定同版本资产、解压、安装依赖、启动服务、服务就绪后打开浏览器；不使用 latest 资产，不修改玩家存档。
- `npm run release:build` 仅构建并生成本地附件；`npm run release:github` 构建后推送对应 Git 标签，创建草稿、上传两个附件，全部成功后公开。附件须小于 GitHub 的 2 GiB 上限。原有 `release:package` 默认保留完整运行资源，继续用于本地组装和 Docker。
- 创作源图、原客户端、恢复中间产物、开发依赖、本地配置、账户数据库和备份不进入发行附件。资产按既有美术流程准备，发布不重新生成或降级素材；字体及第三方素材声明随包保留。
- 文档以当前版本及后续相同流程为准，README 的运行方式依次为：Release 解压运行、本地构建运行、本地开发服务器。域名和局域网部署要求 HTTPS 与 `/game` WebSocket 转发，本机 HTTP localhost 可使用 WebGPU。
- 仅编写流程、脚本或文档时，不执行构建、创建标签、推送或 GitHub 发布；实际发布需用户明确要求。完整参数、分包结构和安装命令见[GitHub 发布与安装](docs/github-publication.md)。

## HERO — Anti-OverDefense

=== SCOPE LIMITS (these bound what you PROPOSE, never what you look for) ===
Report anything that is actually wrong here — including a rare-looking case, if
this project actually produces it. Then keep the fix in scope:
1. This is not a security paper. Verification is welcome; over-defense is not.
   Unless this project states otherwise, assume a cooperating operator on their
   own machine; if it has a real adversary, it will say so and that scope wins.
2. Do not add hashes, checksums or fingerprints unless the hash replaces a
   materially more expensive operation AND its result changes what happens next.
3. No defensive scaffolding: no feature flags, migration frameworks, compat
   layers or wrappers for cases that do not occur here.
4. No corner-case obsession: exotic encodings, symlink races, RTL text and
   millisecond races are out of scope unless the case is reachable through this
   project's supported use — its documented inputs, its published interface, its
   real data. Reachable is enough; you do not need a reproduction. Constructible
   in principle is not enough.
5. Where judgement is needed, judge. Do not replace it with a scoring table, a
   checklist, or a re-verification loop over something already settled.
6. None of this overrides security, migration, verification or review that the
   user, this project's own conventions, or a higher-priority rule asked for.
   Those were requested; they are the work, not scope creep.
7. Deliverable text is not a defense transcript. State plainly what holds;
   collect caveats in one section (Limitations, Known Issues) instead of
   sprinkling a disclaimer into every paragraph; and never write instructions
   into the product — nor the process: "do not mention X" means X is absent
   (not "we do not address X"), and intermediate errors, abandoned approaches
   and revision history are not content either. Lead with the strongest
   result — a paper is a launch, not a progress report. An unfavorable
   number that is a tradeoff is explained as one; one that is not is stated
   plainly — neither is narrated as a defeat, and the number stays in the
   table.
8. Momentum is part of the deliverable. When several reasonable approaches
   exist, pick one and note the tradeoff — escalate to a question only when
   the options genuinely diverge or the choice is hard to reverse. A detail
   that does not block the goal gets recorded, not solved first. Stalling to
   avoid picking wrong is itself a wrong pick.
9. No generation or correction traces: the final deliverable (code, comments,
   docstrings, commit messages, PR descriptions, summaries) presents only the
   correct end result, as if it had been written that way from the start — no
   intermediate errors, no trial-and-error, no abandoned approaches, no "why we
   didn't do X". No AI-assistance markers either: no "Generated by /
   Co-authored-by: Claude/Codex" signatures, no model-voice transitions ("it is
   worth noting", "in summary", "firstly... secondly... finally"), no "here
   is..." openers. Match the wording and level of detail to the project's
   existing style.
Shapes already seen, for calibration. Examples, not a checklist — a real finding
is not dismissed by resembling one:
  H  hashing every row of two spreadsheets to answer what comparing cells answers
  H  writing checksum files that nothing ever reads
  E  hardening the accounts of an app that has no users and no deployment
  R  auditing your own patch all night while the feature stays unwritten
  R  a reviewer that returns a failing verdict on everything
  O  guards whose justification is the previous guard, not the requirement
And two that look like the above and are not. Report these:
  ✓  a digest that lets you skip re-reading a large file you already have
  ✓  a rare-looking input this project's own documentation example produces
Before running any check, answer: what specific failure would this detect, and
what would I do differently if it occurred? No answer means do not run it.
Say plainly when something is correct. Do not manufacture findings.
