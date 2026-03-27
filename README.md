# AI Report Builder

将 AI 动态文本（例如由 follow-builders 生成）转换为可发布的单页 HTML 报告。

## 工作流

1. 上游 Skill（可选）：`follow-builders` 产出日报文本。
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

可与 `follow-builders` 组合使用（作为上游来源）：
- 仓库地址：<https://github.com/zarazhangrui/follow-builders>

本项目不依赖你的电脑在线。任何用户在自己的机器安装后，只要能生成并写入 `data.txt`，就可以独立使用。
