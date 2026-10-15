# H&H Digital Dental Lab 网站

单页静态网站，放在 GitHub Pages 上，不需要服务器。
内容和版面来自原本的 Mailchimp 邮件（"Still Spending Too Much Time Adjusting Crown & Bridge Cases?"），
原本做在图片里的文字都改成了网页文字，方便 Google 搜索和手机阅读。

```
index.html      全部内容，每个区块上面有 <!-- Hero --> 之类的注释
style.css       版面和颜色（最上面 :root 是颜色：--gold 金色、--blue 按钮蓝）
sitemap.xml     给 Google 的网页清单（见下面「分享预览与 Google 搜索资料」）
images/         照片（WebP 格式），还有分享图和图标（JPG / PNG，见「分享预览与 Google 搜索资料」）
images/icons/   金色图标
experience/     沉浸式体验程序（滚动 → 状态 → 3D / 文字），说明见下面「沉浸式体验架构」
assets/models/  3D 模型（GLB）和不支持 3D 时的静态图
```

## 开启网站（只需做一次）

仓库 **Settings → Pages → Source** 选 `Deploy from a branch`，Branch 选 `main`、文件夹 `/ (root)`，保存。
1–2 分钟后网址是：`https://sql-coffin.github.io/H-H-lab/`

## 开发流程

每个改动都走同一条路：

| 步骤 | 在哪里 | 做什么 |
| --- | --- | --- |
| 1. 需求与验收标准 | Notion「H&H 网站 · 需求与验收标准」→「需求」表 | 新增一行：要什么、怎样才算做好（假如 / 当 / 那么） |
| 2. 建立任务 | GitHub Issues → New issue →「🐞 Bug」或「✨ 新需求 / 改版」 | 模板里有验收标准栏位；把 Issue 链接填回 Notion |
| 3. BDD：描述正确行为 | Issue 的验收标准 | 每个「那么」都要能检查，会变成一条测试 |
| 4. TDD：先写失败的测试 | `tests/*.test.mjs` | 测试名称写成那句「那么」；先跑一次，确认它在修改前会失败 |
| 5. 修改 | `index.html` / `style.css` / `experience/` | 改到测试通过 |
| 6. 运行自动化测试 | 本地 `npm test`；开 PR 后 GitHub Actions「Tests」自动跑 | 全部通过才合并 |
| 7. 提交 | Pull request（模板里写 `Closes #编号`） | 合并后 Issue 自动关闭 |
| 8. 部署 | GitHub Pages | 合并到 `main` 后自动上线 |
| 9. 检查真实网站 | GitHub Actions「Live site check」 | 部署完自动在真实网址跑测试；失败会开一个 `live-check` Issue，修好后自动关闭。最后把 Notion 的状态改成「已上线」 |

**测试没过就不能合并**（只需设定一次）：仓库 **Settings → Branches → Add branch ruleset**（或 Add rule），目标选 `main`，勾选 **Require status checks to pass**，加入 `browser-tests`，保存。

## 常见修改

| 想改什么 | 改哪里 |
| --- | --- |
| 文字 | `index.html`。改了首页大标题或网页说明（`<head>` 里的 `description`）时，也要一起改分享图 `images/og-image.jpg` 上的字、`<head>` 里的 `og:title`、`og:image:alt`（分享图的文字说明）和商家资料里的 `description`，测试不会发现这些地方没改 |
| WhatsApp 号码 | `index.html` 里所有 `wa.me/601116874631`（号码前面不要 `+`、不要空格）、页面上写出来的 `+60 11-1687 4631`，还有 `<head>` 商家资料里的 `telephone`（写法和页面上一样） |
| Instagram | `index.html` 里所有 `instagram.com/h.h_dentalstudio`（包括 `<head>` 商家资料里的 `sameAs`） |
| Email、地址 | 页面最下面的联络资料，和 `<head>` 商家资料里的 `email`、`address` 一起改 |
| 分享图、图标 | 见下面「分享预览与 Google 搜索资料」 |
| 换照片 | 用同一个文件名覆盖 `images/` 里的图片 |
| 颜色 | `style.css` 最上面的 `--gold`、`--blue` |

## 分享预览与 Google 搜索资料

`index.html` 的 `<head>` 里有三组给其他程序读的资料（访客在页面上看不到）：

- **分享预览**（`og:` 和 `twitter:` 开头的标签）：把网址贴到 WhatsApp、Facebook、LinkedIn、X 时，显示分享图、标题、说明和网站名称。
- **正式网址**（`canonical` 和 `og:url`）：告诉 Google 和社交平台，这一页的正式网址是 `https://sql-coffin.github.io/H-H-lab/`。
- **商家资料**（`<script type="application/ld+json">`）：给 Google 看的名称、网址、Logo、电话、Email、地址和 Instagram。内容要和页面最下面的联络资料一样，测试会比对。

这些地方的网址都要写完整（`https://...`），因为做分享预览的程序不会自己补上前面的部分。

### 换分享图或图标

用同一个文件名覆盖，尺寸要一样：

| 文件 | 尺寸 | 用在哪里 |
| --- | --- | --- |
| `images/og-image.jpg` | 1200×630，JPG，小于 300 KB（太大的图 WhatsApp 可能不显示） | 分享预览。Logo 和所有的字都放在中间 600 像素宽的范围里（左右各留 300 像素），因为有些 App 只显示中间的正方形 |
| `images/favicon-32.png` | 32×32，PNG | 浏览器分页上的图标 |
| `images/icon-192.png` | 192×192，PNG | Android 手机「加到主画面」的图标（Google 搜索结果旁边的图标见下面） |
| `images/apple-touch-icon.png` | 180×180，PNG，黑色底、不透明 | iPhone「加入主画面」的图标 |
| `images/icon-512.png` | 512×512，PNG | 商家资料里的 Logo |

图标都是正方形，用 Logo 中间的金色 H|H 重画；32×32 那个是一格一格画的，缩小了也清楚。分享图里的字和 Logo 用的是网站一样的字体和金色。

**Google 搜索结果旁边的小图标**：Google 每个网域只用一个图标，而且只从网域最上层的首页读取。现在的网址 `https://sql-coffin.github.io/H-H-lab/` 是 `sql-coffin.github.io` 下面的一个文件夹，所以搜索结果旁边不会显示 H&H 的图标（和下面的 robots.txt 是同一个原因）。以后改用自己的网域，`icon-192.png` 就会用上，不用重做（Google 要求的尺寸是 48 的倍数，192 符合）。

社交平台会把分享预览存一段时间，换了图或文字以后不会马上更新：Facebook 可以在 Sharing Debugger（`developers.facebook.com/tools/debug`）贴上网址按「Scrape Again」，LinkedIn 用 Post Inspector（`linkedin.com/post-inspector`）。

### 让 Google 找到网站

`sitemap.xml` 是给搜索引擎的网页清单（目前只有这一页）。网站上线后做一次：

1. 打开 Google Search Console（`search.google.com/search-console`），新增资源，选「网址前缀」，填 `https://sql-coffin.github.io/H-H-lab/`，按它的说明验证（例如把它给的 `<meta>` 标签加到 `index.html` 的 `<head>`）。
2. 左边选「站点地图（Sitemaps）」，填 `sitemap.xml`，提交。

**为什么没有 robots.txt**：搜索引擎只读网域最上层的 `https://sql-coffin.github.io/robots.txt`，放在 `/H-H-lab/` 文件夹里的会被忽略，所以这里不做。没有 robots.txt 时整个网站都可以被搜索，这正是我们要的；Google 靠上面提交的 `sitemap.xml` 找到网页。以后改用自己的网域（网站在网域最上层）时，才用得上 robots.txt。

### 换网址（例如改用自己的网域）

`index.html` 的 `<head>`（`canonical`、`og:url`、`og:image`、商家资料）和 `sitemap.xml` 里的 `https://sql-coffin.github.io/H-H-lab/` 都要改成新网址，再在仓库加 `SITE_URL` 变量（见下面「检查真实网站」）。没改齐的话，「Live site check」会失败提醒。

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

`experience/main.js` 是入口，把上面几层接起来。为了省流量、省电，3D 只在需要时才做事：

- **快滚到才载入**：一个 3D 区块离画面还有大约两个画面高时，才开始下载它的模型、建好场景（距离在 `experience/main.js` 的 `NEAR`）。所以打开网站时只下载开场需要的 `bridge.glb`，`model.glb` 和 `tissue.glb` 等访客往下滚才下载
- **画面静止就停**：只有场景在画面上时才会绘制，离开就暂停；在画面上时，只要没在滚动、没动鼠标，而且动画（滚动后的滑行、鼠标倾斜、姿态过渡、拖动后的转动）都到位了，也会停止重画，画面保持最后的样子。访客一滚动、动鼠标、按姿态按钮、拖动模型、改窗口大小或转手机方向，就马上继续画

### 一个场景在 HTML 里长这样

```html
<section class="case3d" data-scene="exploded-case">     <!-- 滚动轨道（高度决定滚多久） -->
  <div class="case3d-stage" data-3d-stage>              <!-- 固定在画面上的舞台（要 position: sticky 或 relative），鼠标倾斜看这里 -->
    <div class="case3d-canvas" data-3d-canvas></div>    <!-- 3D 画布放在这里，会自动铺满舞台 -->
    <p class="case3d-loading" data-3d-loading>Loading…</p>  <!-- 载入完会自动隐藏 -->
    <div data-from="0" data-to="0.3">…</div>            <!-- 进度在 0–0.3 之间时加上 .is-on -->
    <p data-anchor="bridge">…</p>                       <!-- 跟着场景报告的位置移动（图层标签） -->
  </div>
</section>
```

- section 上会自动标示 `data-state="loading" | "ready" | "fallback"`，CSS 用它来切换显示（场景名字写错、缺少画布位置、浏览器不支持 3D 或程序没下载成功，都会变成 `fallback`，并在 Console 显示原因；访客还没滚到附近的区块会一直是 `loading`）
- 场景载入后，section 上会有 CSS 变量 `--p`（0–1 的进度），以及场景额外提供的变量（例如 `--wipe`）
- 不支持 3D 的浏览器会显示 `assets/models/poster.webp` 静态图和开头的文字
- 系统设置「减少动态效果」时，3D 会直接跟着滚动走（不滑行）、不跟鼠标倾斜
- 同一时间只画一个 3D 场景：两个 3D 区块之间要隔至少一个画面高度的其他内容
- 舞台加上 `data-3d-drag`：访客可以用鼠标或手指拖动转动模型（手机上下滑仍然是滚动页面），拖动量在 `state.scenes[id].drag`
- 区块里的 `<button data-pose="名字">`：点了就切换场景的姿态（`state.scenes[id].pose`），对应的 `[data-pose-caption="名字"]` 文字会显示

### 加一个新场景

1. 在 `experience/scenes/` 新增一个档，照 `exploded-case.js` 的格式：导出 `{ id, async setup({ engine, el, state }) }`，`setup` 回传：
   - `scene`、`camera`（Three.js 物件），可选 `exposure`（亮度，默认 1）
   - `resize(width, height)`：画布大小改变时调用
   - `update(progress, state, size)`：每一帧调用，移动 3D 物件和镜头，回传 `{ vars, classes, anchors, showAnchors, busy }`（都可以省略）：`vars` 变成 section 上的 CSS 变量，`classes` 是要开关的 class，`anchors` 是 `{ 名字: { x, y } }` 屏幕坐标，给 `data-anchor` 标签用；`busy: true` 表示场景自己还在动（例如查看器还在转到新姿态），引擎会继续画下一帧，都到位后不再回传 `busy: true`，画面才会停下
   - 模型用 `engine.load('assets/models/xxx.glb')` 载入（每个场景拿到自己的一份物件，可以共用同一个档；但几何和原本的材质是共用的，所以要换上自己的材质，不要直接修改载入的材质）；反光环境用 `engine.environment`
   - 场景自己做的平滑（像查看器的姿态过渡）用 `experience/state.js` 的 `ease()`：快到终点时会直接到位，动画才会真的结束
   - `setup` 要等访客滚到区块附近才会被调用（见上面「快滚到才载入」）
   - 新的互动（例如新的按钮）改变了画面时，要调用 `engine.wake()`，否则停着的画面不会更新
2. 在 `experience/main.js` 的 `SCENES` 加上它
3. 在 `index.html` 加一个 `data-scene="新的 id"` 的 section（结构照上面），CSS 写在 `style.css`

## 开场：Logo 飞进牙冠

页面最上面的 `<!-- Logo intro -->` 区块：一开始是 Logo 和名字，往下滚时镜头穿过 Logo 的金色方框（字母下方的空位），Logo 从身边飞过、金色光点掠过，后面的牙桥亮起来，最后停在牙桥正面特写，接着就是首页的主视觉。

- 程序在 `experience/scenes/logo-intro.js`：Logo 是一张贴了 `images/logo.webp` 的平面，用「相加」混合，黑底会消失、只留下金色和白色线条；穿过的位置在 `AIM_PX`（Logo 图片上的像素坐标），牙桥离 Logo 多远在 `BRIDGE_DEPTH`
- 灯光和材质和其他两个 3D 区块共用（`experience/scenes/lib/implant-case.js` 的 `addStudioLights`、`createMaterials`）
- 不支持 3D 时就是原本的 Logo 区块（Logo + 名字），不会有一大段空白

## 3D 爆炸图（目前的场景）

`index.html` 里的 `<!-- 3D case -->` 区块，互动方式和参考影片一样，是**滚动触发**：往下滚时镜头从斜侧面转到正面，牙桥先升起，牙龈跟着升起，最后背景从右边换成浅色，每一层旁边出现标签。电脑上画面还会跟着鼠标稍微倾斜。

- 程序在 `experience/scenes/exploded-case.js`：分开的距离、每层升起的时间点在最上面（`LIFT`、`LIFT_WINDOW`），颜色在 `materials`
- 模型在 `assets/models/`：`model.glb`（工作模型，已去掉底座和病人名字）、`tissue.glb`（牙龈）、`bridge.glb`（牙桥），由 3Shape 导出的 STL 压缩而成
- 文字在 `index.html`：`cap-intro` 是开头的文字，`cap-final` 是最后浅色背景上的文字，`data-anchor` 是每层的标签（`label-long` 电脑版、`label-short` 手机版）

## 3D 查看器「Take a closer look」

`index.html` 里的 `<!-- 3D viewer -->` 区块，仿照 Apple 产品页的 Product Viewer：左边四个按钮切换姿态，模型会平滑过渡过去；也可以直接拖动转动。

- **Seated**：牙桥装在模型上
- **Layers**：三层分开
- **Fitting surface**：牙桥翻过来，看螺丝通道和种植体接口（模型和牙龈淡出）
- **Close-up**：牙桥和牙龈交界的特写

程序在 `experience/scenes/case-viewer.js`，每个姿态是最上面 `POSES` 里的一组数字（分开程度、翻转、淡出、对焦、角度），改数字就能调整画面。要加姿态：在 `POSES` 加一组，再在 `index.html` 加一个按钮和一段说明。两个场景共用的模型和材质在 `experience/scenes/lib/implant-case.js`。

## 自动测试

`tests/` 里是一套小型浏览器测试（Node 自带的测试工具 + Playwright 无头 Chrome，用软件 WebGL，不需要显卡）。每次开 PR 或推到 `main`，GitHub Actions（`.github/workflows/test.yml`）会自动跑一次；结果在 PR 页面的 Checks。

本地测试时网站放在 `/H-H-lab/` 子路径下（和 GitHub Pages 一样），所以只在网域根目录才有效的路径（例如 `/images/...`）在本地就会被发现。

在自己电脑上跑（需要 Node.js 18+）：

```
npm install
npx playwright install chromium
npm test
```

测试内容：

| 档案 | 检查什么 |
| --- | --- |
| `tests/site.test.mjs` | 整页（电脑和手机）从上滚到底：每个文件都下载成功、都在网站文件夹里、每张看得到的图片都正常显示、三个 3D 区块都载入、没有错误；页内链接和图标都有目标 |
| `tests/geometry.test.mjs` | 三个 GLB 都能载入；每层模型的包围盒每个轴 min ≤ max、不是空的、和顶点实际范围一致；中心点是有效数字且在模型里面 |
| `tests/viewer.test.mjs` | 四个视角按钮各自正确（按钮状态、说明文字、画面不同）、键盘可操作、拖动会转动、手机在 3D 上下滑仍然能滚动页面 |
| `tests/intro.test.mjs` | 开场 Logo 飞入：开头显示 Logo 和名字、飞行中画面会变、最后显示亮起的牙桥和结尾文字（电脑和手机）；没有 WebGL 或 Logo 图片载入失败时显示原本的 Logo 区块 |
| `tests/experience.test.mjs` | 爆炸图跟着滚动（开头文字、浅色背景、三个标签都在画面内）、快速来回切换两个 3D 区块时画布跑到正确的区块、改窗口大小和横竖屏后画布大小正确且模型在画面内、模型 / three.js / 程序下载失败或没有 WebGL 时显示静态图、下载慢时先显示 Loading |
| `tests/loading.test.mjs` | 快滚到才载入（电脑和手机）：打开网站时只下载开场的 `bridge.glb`；3D 区块离画面还有三个半画面高时不载入、一个半画面高时就载入，滚到时已经显示 3D；模型下载失败或没有 WebGL 时，滚到 3D 区块显示静态图 |
| `tests/idle.test.mjs` | 画面静止就停（电脑和手机）：三个 3D 区块动画到位后 2 秒内不画新的一帧、画面还在；停下后滚动、动鼠标、鼠标离开、按姿态按钮、拖动（电脑用鼠标、手机用手指）、改窗口大小 / 转手机方向都会马上继续画、画面跟着更新；按姿态按钮或拖动后要转到位才停；切换「减少动态效果」、换屏幕缩放比例、浏览器把 3D 画布收回又还回来（手机内存不够时会这样）也会马上重画，不会变空白 |
| `tests/seo.test.mjs` | 分享预览有标题、说明、网址、网站名称和完整网址的分享图（JPG、1200×630、能下载）；canonical 和 og:url 是网站网址；`sitemap.xml` 列出这个网址；商家资料和页面上的联络资料一致，Logo 和图片能下载；分页图标是正方形，iPhone 图标是 180×180。和做分享预览的程序一样，用关掉 JavaScript 的浏览器读网页 |

`tests/fixtures/geometry.html` 是只给测试用的页面。

### 检查真实网站

`.github/workflows/live.yml`（Actions 里的「Live site check」）在这三种时候，用真实网址 `https://sql-coffin.github.io/H-H-lab/` 跑 `site`、`experience`、`viewer`、`intro`、`seo` 五组测试：

- 每次 GitHub Pages 部署完成后（用刚部署的那个版本的测试）
- 每天马来西亚时间早上 9 点左右
- 手动：Actions →「Live site check」→「Run workflow」

失败时等 2 分钟重试一次（刚部署时网站可能还在更新）；仍失败就开一个带 `live-check` 标签的 Issue，写上失败的测试和运行记录链接（已经有未关闭的就在里面留言）。之后检查通过时会自动留言并关闭它。

在自己电脑上检查真实网站：`SITE_URL=https://sql-coffin.github.io/H-H-lab/ npm run test:live`。网站换了网址（例如自己的网域）时，在仓库 **Settings → Secrets and variables → Actions → Variables** 加一个 `SITE_URL`，并照上面「换网址」改好 `<head>` 和 `sitemap.xml`：`seo` 测试会检查 canonical 和 og:url 是不是等于 `SITE_URL`，没改就会失败。
