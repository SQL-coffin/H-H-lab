# H&H Digital Dental Lab 网站

单页静态网站，放在 GitHub Pages 上，不需要服务器。
内容和版面来自原本的 Mailchimp 邮件（"Still Spending Too Much Time Adjusting Crown & Bridge Cases?"），
原本做在图片里的文字都改成了网页文字，方便 Google 搜索和手机阅读。

```
index.html      全部内容，每个区块上面有 <!-- Hero --> 之类的注释
style.css       版面和颜色（最上面 :root 是颜色：--gold 金色、--blue 按钮蓝）
images/         照片（WebP 格式）
images/icons/   金色图标
experience/     沉浸式体验程序（滚动 → 状态 → 3D / 文字），说明见下面「沉浸式体验架构」
assets/models/  3D 模型（GLB）和不支持 3D 时的静态图
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

## 沉浸式体验架构

网站是一个「以滚动为主控制、Three.js 为视觉引擎、HTML/CSS 为内容层」的体验，不需要 React / Next.js / Vite，也不需要编译：浏览器直接读 `experience/` 里的 JS 模块。

```
滚动 / 鼠标 / 触控
      │  experience/input.js        量出每个场景滚到哪里（0 → 1）、鼠标在哪里
      ▼
  experience/state.js               唯一的状态：整页进度、各场景进度、当前场景、鼠标
      │  （每一帧按时间平滑，慢手机也跟得上）
      ├──────────────► experience/engine/stage.js   一个 WebGL 画布：灯光环境、载入模型、每帧绘制
      │                       └─ experience/scenes/*.js   每个 3D 场景一个档：建模型、按进度移动镜头和图层
      └──────────────► experience/ui/bind.js        把进度写进 HTML：CSS 变量、class、标签位置
```

`experience/main.js` 是入口，把上面几层接起来。只有场景在画面上时才会绘制，离开就暂停。

### 一个场景在 HTML 里长这样

```html
<section class="case3d" data-scene="exploded-case">     <!-- 滚动轨道（高度决定滚多久） -->
  <div class="case3d-stage" data-3d-stage>              <!-- 固定在画面上的舞台，鼠标倾斜看这里 -->
    <div data-3d-canvas></div>                          <!-- 3D 画布放在这里 -->
    <p data-3d-loading>Loading…</p>                     <!-- 载入完会自动隐藏 -->
    <div data-from="0" data-to="0.3">…</div>            <!-- 进度在 0–0.3 之间时加上 .is-on -->
    <p data-anchor="bridge">…</p>                       <!-- 跟着场景报告的位置移动（图层标签） -->
  </div>
</section>
```

- section 上会自动标示 `data-state="loading" | "ready" | "fallback"`，CSS 用它来切换显示
- section 上会有 CSS 变量 `--p`（0–1 的进度），以及场景额外提供的变量（例如 `--wipe`）
- 不支持 3D 的浏览器会显示 `assets/models/poster.webp` 静态图和开头的文字

### 加一个新场景

1. 在 `experience/scenes/` 新增一个档（照 `exploded-case.js` 的格式：`id`、`setup()` 回传 `scene`、`camera`、`resize()`、`update()`）
2. 在 `experience/main.js` 的 `SCENES` 加上它
3. 在 `index.html` 加一个 `data-scene="新的 id"` 的 section，CSS 写在 `style.css`

## 3D 爆炸图（目前的场景）

`index.html` 里的 `<!-- 3D case -->` 区块，互动方式和参考影片一样，是**滚动触发**：往下滚时镜头从斜侧面转到正面，牙桥先升起，牙龈跟着升起，最后背景从右边换成浅色，每一层旁边出现标签。电脑上画面还会跟着鼠标稍微倾斜。

- 程序在 `experience/scenes/exploded-case.js`：分开的距离、每层升起的时间点在最上面（`LIFT`、`LIFT_WINDOW`），颜色在 `materials`
- 模型在 `assets/models/`：`model.glb`（工作模型，已去掉底座和病人名字）、`tissue.glb`（牙龈）、`bridge.glb`（牙桥），由 3Shape 导出的 STL 压缩而成
- 文字在 `index.html`：`cap-intro` 是开头的文字，`cap-final` 是最后浅色背景上的文字，`data-anchor` 是每层的标签（`label-long` 电脑版、`label-short` 手机版）
