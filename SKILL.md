# AI Tracker to Interactive HTML - ListView Version

## 技能描述
将 AI 行业动态文本（纯文本或链接）转化为极简、学术风、左图右文列表式单页 HTML 简报。  
本 Skill 的输入可由另一个 Skill 或脚本动态生成（例如日报、摘要类上游），然后落盘为 `data.txt`。

## 触发短语
- "Generate AI report list"
- "把这份文档转成 AI 新闻列表"
- "用最新 data.txt 生成日报 HTML"

## 上下游依赖与动态输入
1. **上游来源**：任意能产出符合下文「输入契约」的纯文本的流程（其他 Skill、自建脚本等）。
2. **中间产物**：将上游结果写入 `data.txt`（可每天覆盖更新）。
3. **本 Skill 职责**：仅负责把最新 `data.txt` 解析并渲染为 `index.html`（如需对比版本可另存为其他文件名，自行约定）。
4. **不要求 GitHub**：Skill 可纯本地运行；只要运行环境能读取 `data.txt` 即可。

## 输入契约（data.txt）
1. 第一行建议包含日期标题（例如：`AI Builders 日报 · YYYY-MM-DD`）。
2. 每条动态至少包含：
   - 作者名
   - 中英文内容（或可被拆分为中英文）
   - 原始链接（X/Twitter 或 YouTube）
3. 建议使用空行分隔条目；若出现异常控制字符（如 `\u000b`），先归一化为空格或换行后再解析。
4. 当缺失作者头像或封面图时，允许回退占位图，但优先使用真实 URL。

## 核心设计理念
1. **先构建，后理解**：直接展示核心结论与可点击原文入口。
2. **列表优先**：动态内容必须使用左图右文单列列表，不用时间轴。
3. **真实性增强**：
   - 优先渲染真实作者头像 URL。
   - 优先渲染真实封面图 URL（从文本中提取）；无图再用占位图。
4. **简洁至上**：
   - 禁止时间轴布局。
   - 禁止“本期动态 · UPDATES”之类冗余区块。
5. **双语对照**：中文主标题 + 英文副描述，分层清晰。

## 数据处理流程
1. **读取最新输入**：加载 `data.txt` 并做文本归一化（空白、控制字符、重复换行）。
2. **实体提取**：提取作者、链接、中文摘要、英文摘要、可能的图片 URL。
3. **链接分类**：识别 X/Twitter、YouTube 等来源，写入卡片 meta 标签。
4. **HTML 组装**：使用 `design-system.md` 和 `components.md` 的样式/结构生成单页 HTML。
5. **结果输出**：默认输出到 `index.html`；若需保留多版对比，可改用其他输出路径或文件名（自行约定）。

---

## OpenClaw：串联上游摘要并推送 HTML 链接

若已安装某上游日报/摘要类 Skill，再安装本仓库 [ai-report-builder](https://github.com/flowers-s/ai-report-builder) 后，**两者不会自动合并**。需要由 Agent 在**同一次执行**（或你手动说一句话）里**串起来**：先拿到上游正文，再写入 `data.txt`、生成 `index.html`、推送到 GitHub，最后把 **Pages 公网链接**发给你。

### 你要的最终效果
用户在 OpenClaw 里收到的不只是纯文本摘要，而是**同一份内容对应的网页**，例如：  
`https://<你的用户名>.github.io/ai-report-builder/`（以你仓库实际 Pages 地址为准）。

### 推荐目录约定（与上游 Skill 并列）
把本 Skill 克隆到固定路径，便于 Shell 串联，例如：
```text
~/skills/<你的上游项目>    # 可选，若另有日报/摘要类 Skill
~/skills/ai-report-builder # 本 Skill（路径可自定，但需全程一致）
```

### Agent 必须执行的命令序列（生成 + 发布）
在写入 `~/skills/ai-report-builder/data.txt`（用当日上游摘要正文**整段覆盖**）之后：
```bash
cd ~/skills/ai-report-builder && node scripts/build-report.mjs
cd ~/skills/ai-report-builder && git add data.txt index.html && git commit -m "Daily digest $(date +%F)" && git push
```
然后向用户发送一行：**今日 HTML：** + 你的 GitHub Pages URL。

### OpenClaw 定时任务（cron）怎么写
不要用两条互不相干的 cron 各跑一个 Skill。应使用 **一条** `openclaw cron add`，在 `--message` 里写清整段工作流，例如：  
「先按上游 Skill 的说明生成当日摘要（如为双语则保持原样）；再把**完整摘要文本**写入 `~/skills/ai-report-builder/data.txt`；再执行上面的 `node scripts/build-report.mjs` 与 `git push`；最后把 Pages 链接发给用户。」

（OpenClaw 侧 cron 语法见 OpenClaw 官方文档，或见你所用上游 Skill 自带的定时任务说明。）

### 前置条件（否则只能本地 HTML，没有公网链接）
- `ai-report-builder` 已关联远程仓库且 **GitHub Pages** 已从 `main` 的 `/ (root)` 发布。
- 运行 OpenClaw 的机器上 **`git push` 可非交互成功**（已配置 SSH 或 credential helper，勿在聊天里贴 token）。

### 若暂时不能 `git push`
仍可生成 `index.html`；可把文件路径告诉用户本地打开，或改用其他托管方式。公网可分享链接依赖部署，不依赖某一特定上游工具。