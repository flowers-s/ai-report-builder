# 交互组件库 - 现代主义列表版 (Modernist Components)

严格使用以下 HTML/CSS 结构，复刻 BASIC® 风格。

## 1. 巨型标题组件 (Brutalist Header)
用于页面最上方。

**HTML 模板参考**:
<header style="display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 24px;">
  <div style="font-family: 'Helvetica Neue', Helvetica, sans-serif; font-size: calc(32px + 2vw); font-weight: 800; line-height: 0.9; color: var(--text-primary); letter-spacing: -1px;">
    FEATURED<br>NEWS
  </div>
  <div style="border: 1px solid var(--border-color); border-radius: 20px; padding: 6px 16px; font-family: 'Helvetica Neue', Helvetica, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-primary);">
    DATE HERE
  </div>
</header>

## 2. 现代主义列表项 (Modernist List Item)
每个列表项顶部必须带有纯黑实线；并且图片与右侧文字内容必须顶部对齐（统一规则：`align-items: flex-start`）。

**HTML 模板参考**:
<div class="list-item" style="display: flex; align-items: flex-start; gap: 4%; padding: 32px 0; border-top: 1px solid var(--border-color); cursor: pointer; position: relative;" onclick="window.open('真實跳转链接', '_blank')">
  
  <div class="item-cover" style="width: 38%; flex-shrink: 0; background: var(--bg-primary); aspect-ratio: 4/3; overflow: hidden;">
    <img src="真实图片URL_OR_占位图" alt="cover" style="width: 100%; height: 100%; object-fit: contain; object-position: center; display: block;">
  </div>
  
  <div class="item-content" style="flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between; position: relative; padding-right: 40px;">
    
    <div class="jump-arrow" style="position: absolute; top: 0; right: 0; font-size: 24px; color: var(--text-primary); line-height: 1; font-family: Arial, sans-serif;">
      &rarr;
    </div>

    <div class="top-content">
      <div style="font-family: 'Helvetica Neue', Helvetica, sans-serif; font-size: calc(18px + 0.8vw); font-weight: 700; color: var(--text-primary); line-height: 1.3; margin-bottom: 12px;">
        中文标题内容填在这里
      </div>
      <div style="font-family: 'Helvetica Neue', Helvetica, sans-serif; font-size: calc(12px + 0.2vw); font-weight: 500; color: var(--text-secondary); line-height: 1.4; text-transform: uppercase;">
        English description content goes here
      </div>
    </div>
    
    <div class="meta-row" style="display: flex; align-items: center; gap: 10px; font-family: 'Helvetica Neue', Helvetica, sans-serif; font-size: 11px; font-weight: 800; color: var(--text-primary); letter-spacing: 0.5px; margin-top: 24px;">
      <img src="真实作者头像URL" alt="avatar" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;">
      <span>作者名称</span>
      <span>·</span>
      <span>标签 (如 Twitter / X)</span>
    </div>

  </div>
</div>

## 3. 列表容器闭合线 (List Container Bottom Border)
为了实现“底部也有分割线”的效果，列表的最外层容器必须有一个底边框。

**HTML 模板参考**:
<div class="list-container" style="border-bottom: 1px solid var(--border-color);">
  </div>