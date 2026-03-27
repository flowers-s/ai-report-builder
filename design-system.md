# 设计系统 (Design System) - Modernist Style

必须严格在 `<style>` 标签中使用以下 CSS 变量。我们要打造极其硬朗的现代主义风格。

## 1. 颜色令牌 (Color Tokens)
:root {
  --bg-primary: #F4F4F4;       /* 杂志感浅灰底色 */
  --bg-card: transparent;      /* 列表不再有白色卡片背景，直接透出底色 */
  --text-primary: #111111;     /* 极致纯黑 */
  --text-secondary: #555555;   /* 深灰色 */
  --border-color: #111111;     /* 纯黑实线，非常关键 */
}

## 2. 排版规范 (Typography)
- **字体族**: 必须全部使用强有力的无衬线字体（抛弃衬线体）。
  - font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
- **中英双语排版**: 
  - 中文主标题: font-size: calc(18px + 0.8vw); font-weight: 700; color: var(--text-primary); line-height: 1.3;
  - 英文副描述: font-size: calc(13px + 0.3vw); font-weight: 400; color: var(--text-secondary); line-height: 1.4; text-transform: uppercase;

## 3. 全局布局 (Layout)
- 页面最大宽度 900px (max-width: 900px; margin: 0 auto; padding: 60px 20px;)。
- 线条运用：元素之间使用 1px solid #111111 作为分割。
- 列表项图文对齐规范：左侧封面图与右侧文字区必须顶部对齐（`display: flex; align-items: flex-start;`）。
- 封面图适配规范：默认使用 `object-fit: contain` + `object-position: center`，保证图片不裁切；留白背景需与页面底色一致，避免出现突兀灰块。