# H&H Digital Dental Lab 网站

单页静态网站，放在 GitHub Pages 上，不需要服务器。
内容和版面来自原本的 Mailchimp 邮件（"Still Spending Too Much Time Adjusting Crown & Bridge Cases?"），
原本做在图片里的文字都改成了网页文字，方便 Google 搜索和手机阅读。

```
index.html      全部内容，每个区块上面有 <!-- Hero --> 之类的注释
style.css       版面和颜色（最上面 :root 是颜色：--gold 金色、--blue 按钮蓝）
images/         照片（WebP 格式）
images/icons/   金色图标
3d/             3D 爆炸图（case3d.js 程序、models/ 三个模型、vendor/ three.js）
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

## 3D 爆炸图

`index.html` 里的 `<!-- 3D case -->` 区块，互动方式和参考影片一样，是**滚动触发**：往下滚时镜头从斜侧面转到正面，牙桥先升起，牙龈跟着升起，最后背景从右边换成浅色，每一层旁边出现标签。电脑上画面还会跟着鼠标稍微倾斜。

- 模型在 `3d/models/`：`model.glb`（工作模型，已去掉底座和病人名字）、`tissue.glb`（牙龈）、`bridge.glb`（牙桥），由 3Shape 导出的 STL 压缩而成
- 分开的距离、每层升起的时间点在 `3d/case3d.js` 最上面（`LIFT`、`LIFT_WINDOW`），颜色在 `materials`
- 文字在 `index.html`：`cap-intro` 是开头的文字，`cap-final` 是最后浅色背景上的文字，`layer-label` 是每层的标签（`label-long` 电脑版、`label-short` 手机版）
- 手机不支持 3D 时会显示 `3d/models/poster.webp` 静态图
