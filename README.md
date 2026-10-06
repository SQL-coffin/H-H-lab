# H&H Digital Dental Lab 网站

单页静态网站，放在 GitHub Pages 上，不需要服务器。
内容和版面来自原本的 Mailchimp 邮件（"Still Spending Too Much Time Adjusting Crown & Bridge Cases?"），
原本做在图片里的文字都改成了网页文字，方便 Google 搜索和手机阅读。

```
index.html      全部内容，每个区块上面有 <!-- Hero --> 之类的注释
style.css       版面和颜色（最上面 :root 是颜色：--gold 金色、--blue 按钮蓝）
images/         照片（WebP 格式）
images/icons/   金色图标
```

## 开启网站（只需做一次）

仓库 **Settings → Pages → Source** 选 `Deploy from a branch`，Branch 选 `main`、文件夹 `/ (root)`，保存。
1–2 分钟后网址是：`https://sql-coffin.github.io/H-H-lab/`

## 常见修改

| 想改什么 | 改哪里 |
| --- | --- |
| 文字 | `index.html` |
| WhatsApp 号码 | `index.html` 里所有 `wa.me/601116874631`（号码前面不要 `+`、不要空格） |
| Instagram | `index.html` 里所有 `instagram.com/h.h_dentalstudio` |
| 换照片 | 用同一个文件名覆盖 `images/` 里的图片 |
| 颜色 | `style.css` 最上面的 `--gold`、`--blue` |
