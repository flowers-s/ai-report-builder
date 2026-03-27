# AI Tracker to Interactive HTML - ListView Version

## 技能描述
将 AI 行业动态文本（纯文本或链接）转化为极简、学术风、左图右文列表式单页 HTML 简报。  
本 Skill 的输入可由另一个 Skill 动态生成（例如 follow-builders），然后落盘为 `data.txt`。

## 触发短语
- "Generate AI report list"
- "把这份文档转成 AI 新闻列表"
- "用最新 data.txt 生成日报 HTML"

## 上下游依赖与动态输入
1. **上游来源**：可依赖 follow-builders 输出的日报文本（示例仓库：<https://github.com/zarazhangrui/follow-builders>）。
2. **中间产物**：将上游结果写入 `data.txt`（可每天覆盖更新）。
3. **本 Skill 职责**：仅负责把最新 `data.txt` 解析并渲染为 `index.html`（或 `index2.html`）。
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
5. **结果输出**：默认输出到 `index.html`，可按需输出到 `index2.html` 进行版本对比。