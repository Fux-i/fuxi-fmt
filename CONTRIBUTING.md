# 贡献指南

给改这个仓库的人的说明。面向 agent 的操作约束在 [AGENTS.md](AGENTS.md)；行为契约在 [功能规范](FUXI-FMT-SPEC.md)。

## 环境

Node.js >= 22.18（推荐 24 LTS）。没有构建步骤：Node 原生剥离 TypeScript 类型。

## 常用命令

```sh
npm ci               # 按 lockfile 装精确依赖，和 CI 一样
npm test             # 跑整个测试套件
npm run test:watch   # 监视模式
npm run typecheck    # 对每个包跑 tsc -p
npm run ci           # typecheck + 测试，CI 跑的就是这个
npm run build        # 打包 VS Code 扩展
npm run vsix         # 构建并打出 output/fuxi-fmt-<version>.vsix
npm run l10n         # 从消息目录重新生成 packages/vscode/l10n
npm run manifest     # 从选项词汇表重新生成 packages/vscode/package.json
```

## 仓库结构

```
packages/
  core/              adapter-free formatting engine (no VS Code imports, ever)
  cli/               fuxi-fmt --check --diff --write
  vscode/            extension: providers, minimal edits, esbuild bundle
FUXI-FMT-SPEC.md     normative behavioural contract
MAINSTREAM_MD_FORMATTERS_REPORT.md
                     prior-art survey, with primary sources
```

命令行与扩展都是 `@fuxi-fmt/core` 之上的薄适配器，而核心从不 import 它们中的任何一个。

## 设计原则

- **规范是权威。** 代码里的规则 ID 与 `FUXI-FMT-SPEC.md` 里的规则 ID 一一对应。代码与规范不一致，是其中一方有 bug，不是口味问题。
- **保护是默认。** 任何不被识别为散文的东西都逐字节复制。保护是退出，不是加入。
- **核心不知道 VS Code 的存在。** 适配器负责翻译，不负责决定。
- **先写测试。** 每条规则都先写成失败的测试，再去实现。

## 提交之前

每个提交都必须跑完整的检查 —— typecheck 加整个测试套件，而不是你刚碰过的那个包 —— 并把输出重定向而不是接管道；管道里的检查报告的是下游命令的退出状态。

```sh
npm run ci > /tmp/ci.log 2>&1 || { tail -20 /tmp/ci.log; exit 1; }
```

然后是按「文档随代码一起走」：一个提交如果让某份文档说出了它刚刚弄错的话，那它就不算完成，即使测试全绿。同一次提交里要更新的东西：

- 规范里受影响的规则文字，以及第 5 节的状态注记；
- 如果新增、改名或删除选项，`packages/vscode/package.json`（它由选项词汇表生成，跑 `npm run manifest`，不要手改）**以及** `package.nls.json` 与 `package.nls.zh-cn.json` 里对应的那几条字符串；
- 用户看得见的改动要更新 `CHANGELOG.md`。

测试已经强制了其中大部分，这也是可信的理由：`docs.test.ts` 会在规范里被标为未实现的选项其实已实现、在某份非规范的文档里出现「未实现清单」、文档写了一个并不存在的选项、核心的某个选项既不是设置也没被声明为有意不暴露、某个语言包缺少清单引用的字符串、或者特性提交未发布而变更日志只字不提时失败。`settings.test.ts` 会在清单与核心的选项面不一致时失败。

测试查不了的是那些不构成可检验断言的散文。对这部分，规则是这条 —— 它花掉了这个仓库最多的返工：**找出你的改动使其不成立的那句话，并在同一次提交里改掉它。**

## 测试驱动

每条规则、每个行为改动都走红 - 绿 - 重构：

1. 先写一个失败的测试，测试名里带规范规则 ID，例如 `"TYPO-01 在 CJK 与拉丁文之间插入一个空格"`。
2. 跑它，确认它是因为预期的原因失败。
3. 写能通过的最小实现。
4. 测试绿了再重构。

测试放在代码旁边（`src/foo.test.ts`）或 `test/` 下。fixture 放在 `test/fixtures/`，按字节精确对待（见 `.gitattributes`）。fixture 语料库必须覆盖每一种受保护区域和每一种难缠的组合 —— 表格、脚注、公式、MDX 片段、混合标点、CRLF、紧邻每一种 ASCII 标点的 CJK、深嵌套列表。

## 剩余工作

规范是权威；这里只写最短的准确摘要。**选项的实现状态（含未实现与部分实现）只在规范第 5 节末尾的「实现状态」一段，本文件不重复它。**<!-- fuxi-fmt:work-in-progress -->

| 事项 | 状态 |
| ---- | ---- |
| 语料库 | `packages/core/test/fixtures/corpus/` 逐字节精确，区域比较经过验证，任何区域种类没被覆盖测试就会失败；但它仍不是一篇真实的中文技术文章。 |
| 撤回：引用块内部的空行 | 引用块内部的空行是一个 `>` 行，`>` 行是非空行，而 GRT-01 拒绝任何对非空行计数的改动 —— 唯一能实现它的机制正是语义守卫禁止的那一个。选项因此被撤回而不是实现；想要它就得不许守卫工作，而语义保持是这整个工具赖以存在的承诺。 |

改上面的东西之前，有两件事值得先做：

1. **拿一篇真实文章跑一遍。** 如果间距、标点或括号规则与你实际写作的方式不合，那么该做的不是继续加功能。
2. **把扩展装进真实的 VS Code。** 桩证明了代码路径能跑；只有编辑器能证明清单、激活事件与信任声明是对的。

## 提交与发布

提交用 [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)：`<type>(<scope>): <description>`，类型取 `feat`、`fix`、`test`、`docs`、`chore`、`refactor`、`perf`、`build`，范围取 `core`、`blk`、`typo`、`safe`、`fm`、`cfg`、`vscode`、`cli`、`repo`。

一次提交只做一件连贯的事 —— 一条规则或一次重构 —— 并在每个测试转绿的节点提交。不要留下与当前工作无关的脏工作区。

版本遵循语义化版本；标签沿用 Linux 内核的约定：发布是 `vMAJOR.MINOR.PATCH`，候选版本后缀 `-rcN`，标签必须用 `git tag -a` 打注解标签。**除非明确要求，不要 push。**

## 发布流程

推一个 `v` 开头的标签（`v*`）就触发 `.github/workflows/release.yml`：它先跑完整的 `npm run ci`，校验标签存在、其提交是 `origin/main` 的祖先、标签版本与四份清单一致，然后构建 vsix，再用该版本的 CHANGELOG 小节（没有小节时退回提交列表）造出 GitHub Release，并把 vsix 作为附件挂上去。`-rcN` 标签只创建预发布，版本校验比的是去掉 `-rcN` 后的基准版本。工作流跑在 GitHub environment `release` 下，将来若要发布，token 与 required reviewers 都放在那里。

**Marketplace 那一步是手动的。** 工作流只在仓库变量 `PUBLISH_TO_MARKETPLACE` 为 `true` 时才发布到 Visual Studio Marketplace，打开它需要一个 Azure DevOps personal access token（scope `Marketplace > Manage`，organization 选 `All accessible organizations`）存成 environment `release` 的 secret `VSCE_PAT`。没有 token 时的做法：从 GitHub Release 下载 `fuxi-fmt-<version>.vsix`，到 https://marketplace.visualstudio.com/manage 上传 —— 网页上传是官方并列的两种发布方式之一，本来就不需要 token。

**日常流程。** 把 `package.json` 与 `packages/{cli,core,vscode}/package.json` 四份清单里的版本号改掉 → 提交 → 打标签 → 分支和标签分两次 push（`git push && git push --tags`）：一次推完的话，标签那次运行可能取到还不含这个提交的 `main`，祖先检查会失败。

**彩排。** 手动触发工作流（`workflow_dispatch`）并设 `dry_run=true`，可以逐步看完整流程：新的标签只创建 **draft** Release，已经存在的 Release 一个字都不改，什么都不发布。要连 Release 创建也走一遍真实路径，就推一个候选标签（例如 `v1.1.0-rc1`）：它按真实流程创建预发布并附上 vsix，但绝不碰 Marketplace，看完用 `gh release delete <tag> --cleanup-tag` 收掉。候选标签会成为「最新标签」，而 `docs.test.ts` 要求最新标签在 CHANGELOG.md 里有对应小节，所以先写下 `## [1.1.0-rc1]` 那一节再打标签，否则工作流里的 `npm run ci` 会先失败。

**想要全自动发布时。** Azure DevOps 的 global PAT 在 **2026-12-01** 退役，`VSCE_PAT` 届时失效；而且新建 Azure DevOps 组织现在要求绑定 Azure 订阅。更稳的官方路线是 Entra ID + workload identity federation（新建 Entra 租户官方要求付费订阅，个人 Microsoft 账号单独建不了）：在 Entra 建一个 user-assigned managed identity（或 app registration），挂一条 federated credential，subject 写 `repo:Fux-i/fuxi-fmt:environment:release`；把它以 Contributor 加进 publisher；工作流补上 `permissions: id-token: write` 和一步 `azure/login@v3`（`allow-no-subscriptions: true`），发布命令换成 `vsce publish --azure-credential --packagePath ...`。`--oidc`（trusted publishing）那条后端还没上线，不能用。
