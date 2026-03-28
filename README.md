# AI Report Builder

将 AI 动态文本（例如由上游日报、摘要或列表类工具生成）转换为可发布的单页 HTML 报告。

## 工作流

1. 上游 Skill 或脚本（可选）：产出日报、摘要等纯文本。
2. 写入本仓库的 `data.txt`（每日可覆盖更新）。
3. 按本仓库规则生成 `index.html`。
4. 推送到 GitHub 后由 GitHub Pages 对外提供访问链接。

## 本地使用

- 核心文件：
  - `SKILL.md`：Skill 行为定义
  - `components.md`：列表组件模板
  - `design-system.md`：设计系统
  - `data.txt`：动态输入数据
  - `index.html`：最终输出页面

## 每天自动跑一次（最简单可落地）

你已经跑通了 Pages 发布链路。要做到“每天自动更新内容”，只需要让上游每天更新 `data.txt`，然后执行一次生成脚本并推送：

```bash
cd /Users/flower/Desktop/AI-Report-Builder
node scripts/build-report.mjs
git add index.html data.txt
git commit -m "Daily report"
git push
```

其中 `scripts/build-report.mjs` 会把最新 `data.txt` 解析为新的 `index.html`（纯本地计算，不额外消耗模型额度）。

## 发布到 GitHub Pages（最简）

1. 在 GitHub 网页新建仓库（例如 `ai-report-builder`）。
2. 本地执行：

```bash
git init
git add .
git commit -m "Initial publish for AI Report Builder"
git branch -M main
git remote add origin <你的仓库地址>
git push -u origin main
```

3. 打开仓库设置：`Settings -> Pages`
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/ (root)`
4. 保存后等待 1-2 分钟，访问：
   - `https://<你的用户名>.github.io/<仓库名>/`

## 数据来源说明

任意能产出文本的上游（自建脚本、其他 Skill 等）均可：只要把结果写入 `data.txt`，即可走同一套生成与发布流程。

本项目不依赖你的电脑在线。任何用户在自己的机器安装后，只要能生成并写入 `data.txt`，就可以独立使用。
