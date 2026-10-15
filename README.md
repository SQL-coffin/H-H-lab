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
analytics.js    网站分析（Google Analytics）：记录联络点击、3D 视角、看到哪里，说明见下面「网站分析」
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
| 5. 修改 | `index.html` / `style.css` / `experience/` / `analytics.js` | 改到测试通过 |
| 6. 运行自动化测试 | 本地 `npm test`；开 PR 后 GitHub Actions「Tests」自动跑 | 全部通过才合并 |
| 7. 提交 | Pull request（模板里写 `Closes #编号`） | 合并后 Issue 自动关闭 |
| 8. 部署 | GitHub Pages | 合并到 `main` 后自动上线 |
| 9. 检查真实网站 | GitHub Actions「Live site check」 | 部署完自动在真实网址跑测试；失败会开一个 `live-check` Issue，修好后自动关闭。最后把 Notion 的状态改成「已上线」 |

**测试没过就不能合并**（只需设定一次）：仓库 **Settings → Branches → Add branch ruleset**（或 Add rule），目标选 `main`，勾选 **Require status checks to pass**，加入 `browser-tests`，保存。

## 常见修改

| 想改什么 | 改哪里 |
| --- | --- |
| 文字 | `index.html` |
| WhatsApp 号码 | `index.html` 里所有 `wa.me/601116874631`（号码前面不要 `+`、不要空格） |
| Instagram | `index.html` 里所有 `instagram.com/h.h_dentalstudio` |
| 换照片 | 用同一个文件名覆盖 `images/` 里的图片 |
| 颜色 | `style.css` 最上面的 `--gold`、`--blue` |
| Google Analytics 编号 | `index.html` 最上面的 `<meta name="ga-id" content="">`：把 `G-` 开头的编号贴在引号中间；留空就是不追踪。做法见下面「网站分析」 |
| 新加联络按钮 | 照抄旧的按钮，把 `data-track="..."` 改成新的位置名（见「网站分析」） |

## 网站分析（Google Analytics）

网站用免费的 Google Analytics 4（GA4）记录：访客点了哪个联络按钮、在 3D 查看器看了哪个视角、滚到了哪里。程序在 `analytics.js`。

**还没填编号时完全关闭**：不会下载任何 Google 的程序，也不会送出任何资料，网站其他功能都一样。

### 开启（只需做一次）

1. 用 Google 账号登录 <https://analytics.google.com>，按「开始衡量」（已经有 GA 账号的话：左下角「管理」⚙ →「创建」→「媒体资源」）。
2. 媒体资源名称填 `H&H 网站`，时区选「马来西亚」，货币选「马来西亚林吉特」，下一步把商家资料填完。
3. 平台选「网站」，网址填 `sql-coffin.github.io`，数据流名称随意（例如 `H&H 网站`），按「创建数据流」。
4. 画面上会显示 **衡量 ID**（Measurement ID），`G-` 开头，例如 `G-AB12CD34EF`。按旁边的复制按钮。
5. 打开 `index.html`，在最上面找到 `<meta name="ga-id" content="">`，把编号贴在引号中间，变成 `<meta name="ga-id" content="G-AB12CD34EF">`。照「开发流程」提交、合并到 `main`，上线后就开始记录。
6. 检查：打开网站，点一下 WhatsApp 按钮，1 分钟内在 GA 的「报告」→「实时」会看到 `whatsapp_click`。

编号不是密码，放在网页里是正常的。贴错（不是 `G-` 加大写英文字母和数字）时 GA 不会启动，自动测试（「Tests」和「Live site check」）也会失败提醒。

### 记录哪些事件

| 事件 | 什么时候记录 | 参数 |
| --- | --- | --- |
| `whatsapp_click` | 点任何一个 WhatsApp 链接（用鼠标中键在新标签页打开也算） | `link_location`：按钮的位置，见下表 |
| `instagram_click` | 点 Instagram 链接 | `link_location` |
| `email_click` | 点电邮地址 | `link_location` |
| `map_click` | 点地址（打开 Google 地图） | `link_location` |
| `viewer_pose` | 在「Take a closer look」按视角按钮，每按一次记一次（页面打开时默认的视角不算） | `pose`：`seated` 装在模型上、`layers` 三层分开、`intaglio` 牙桥内面（Fitting surface）、`closeup` 特写 |
| `section_view` | 某个位置出现在画面上（看到一半就算；比画面高的，占满半个画面就算）；每次打开网页，每个位置只记一次 | `section`：`hero` 主视觉、`case3d_end` 看完 3D 爆炸图（滚到它的最后）、`viewer` 3D 查看器「Take a closer look」、`contact` 页尾联络资料 |

`link_location` 的值（写在每个链接的 `data-track` 里）：

| 值 | 位置 |
| --- | --- |
| `header` | 最上面固定栏的 WhatsApp 按钮 |
| `hero` | 主视觉下面的「Talk to Our Lab Team」（WhatsApp）和「View Case Gallery」（Instagram） |
| `first_case` | 「Ready to try one case first?」的「Start Your First Case」按钮 |
| `first_case_phone` | 同一块里的电话号码 |
| `before_after` | 「Before and After」下面的「View Our Case Gallery」（Instagram） |
| `feedback` | 「Feedback From Clinics」下面的「Discuss Your Case」 |
| `footer` | 页尾联络资料（WhatsApp、Email、Instagram、地址） |
| `float` | 右下角浮动的 WhatsApp 圆形按钮 |

GA 另外会自动记录浏览次数（`page_view`）、访客来自哪里等基本资料，不用设定。

### 在 GA 里设定（只需做一次，最好和填编号同一天）

- **把 WhatsApp 点击设为「关键事件」**（Key event，以前叫「转化」）：GA 左下角「管理」⚙ →「数据显示」→「关键事件」→「新建关键事件」→ 输入 `whatsapp_click` → 保存。之后报告里会单独统计有多少人点了 WhatsApp。（也可以等这个事件出现过一次后，在「管理」→「数据显示」→「事件」里把 `whatsapp_click` 那一行设为关键事件。）
- **让参数出现在报告里**：「管理」→「数据显示」→「自定义定义」→「创建自定义维度」，范围选「事件」，事件参数分别填 `link_location`、`pose`、`section`（建三个，名称可以写「按钮位置」「3D 视角」「看到的位置」）。不建的话，这些参数只在「实时」报告里看得到；建好之后才开始累积。

### 加新按钮或新区块时

- 新的 WhatsApp / Instagram / Email / Google 地图链接会自动记录；记得加上 `data-track="位置名"`（英文小写，用 `_` 连接），报告里才分得出是哪一个，没写的会记成 `other`（自动测试也会提醒）。
- 想知道访客有没有看到某个区块：在那个区块的标签加上 `data-track-view="名字"`，就会多一种 `section_view`。

隐私：Google Analytics 会在访客的浏览器存 cookie（`_ga`）来分辨回访的人；不会记录访客的名字、电话或 WhatsApp 信息内容。

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
  <div class="case3d-stage" data-3d-stage>              <!-- 固定在画面上的舞台（要 position: sticky 或 relative），鼠标倾斜看这里 -->
    <div class="case3d-canvas" data-3d-canvas></div>    <!-- 3D 画布放在这里，会自动铺满舞台 -->
    <p class="case3d-loading" data-3d-loading>Loading…</p>  <!-- 载入完会自动隐藏 -->
    <div data-from="0" data-to="0.3">…</div>            <!-- 进度在 0–0.3 之间时加上 .is-on -->
    <p data-anchor="bridge">…</p>                       <!-- 跟着场景报告的位置移动（图层标签） -->
  </div>
</section>
```

- section 上会自动标示 `data-state="loading" | "ready" | "fallback"`，CSS 用它来切换显示（场景名字写错、缺少画布位置、浏览器不支持 3D 或程序没下载成功，都会变成 `fallback`，并在 Console 显示原因）
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
   - `update(progress, state, size)`：每一帧调用，移动 3D 物件和镜头，回传 `{ vars, classes, anchors, showAnchors }`（都可以省略）：`vars` 变成 section 上的 CSS 变量，`classes` 是要开关的 class，`anchors` 是 `{ 名字: { x, y } }` 屏幕坐标，给 `data-anchor` 标签用
   - 模型用 `engine.load('assets/models/xxx.glb')` 载入（每个场景拿到自己的一份物件，可以共用同一个档；但几何和原本的材质是共用的，所以要换上自己的材质，不要直接修改载入的材质）；反光环境用 `engine.environment`
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
| `tests/analytics.test.mjs` | 网站分析：`ga-id` 是空的或正确的 `G-` 编号；没填编号（或填错）时不下载任何 Google 程序、网站和链接照常；填了编号时用这个编号载入 GA，事件都会送出；每个 WhatsApp / Instagram / Email / 地图链接点了记一次、带上位置、链接照常打开（鼠标中键在新标签页打开也算，右键不算）；视角按钮记录姿态（默认的不算）；电脑和手机往下滚、再滚回来，四个位置各只记一次 |
| `tests/a11y.test.mjs` | 无障碍：整页（电脑和手机）载入完后用 axe（很多无障碍检查工具用的核心）检查，没有任何问题；WhatsApp 浮动按钮外观和位置不变（56×56，离右边和下面各 20px，滚动时固定不动、没被挡住） |

`tests/fixtures/geometry.html` 是只给测试用的页面。

测试不会真的连到 Google Analytics：Google Analytics 的网址都由测试自己回一个空的回应，所以就算填了编号，测试（包括下面的真实网站检查）也不会在报告里多出访问；点联络链接时，WhatsApp、Instagram、Google 地图也只会打开一个测试用的空白页。

axe 报告问题时，测试会列出规则名称、说明和出问题的元素。例如之前的 `region`：每个内容都要在页面的区域（header、main、footer 等）里面，所以右下角的浮动 WhatsApp 按钮放在 `<footer>` 的最后；它在画面上的位置由 `style.css` 的 `.wa-float` 决定，不受影响。

### 检查真实网站

`.github/workflows/live.yml`（Actions 里的「Live site check」）在这三种时候，用真实网址 `https://sql-coffin.github.io/H-H-lab/` 跑 `site`、`experience`、`viewer`、`intro`、`analytics`、`a11y` 六组测试：

- 每次 GitHub Pages 部署完成后（用刚部署的那个版本的测试）
- 每天马来西亚时间早上 9 点左右
- 手动：Actions →「Live site check」→「Run workflow」

失败时等 2 分钟重试一次（刚部署时网站可能还在更新）；仍失败就开一个带 `live-check` 标签的 Issue，写上失败的测试和运行记录链接（已经有未关闭的就在里面留言）。之后检查通过时会自动留言并关闭它。

在自己电脑上检查真实网站：`SITE_URL=https://sql-coffin.github.io/H-H-lab/ npm run test:live`。网站换了网址（例如自己的网域）时，在仓库 **Settings → Secrets and variables → Actions → Variables** 加一个 `SITE_URL`。
