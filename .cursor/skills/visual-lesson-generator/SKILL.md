---
name: visual-lesson-generator
description: >-
  用 VML(.learn) DSL 生成可视化机制交互课。当用户要创建动画学习页、
  往 learning-hub 加课程、或把技术考点转成可视化课时使用。
---

# Visual Lesson Generator — VML DSL

AI **只写 `.learn` 文件**（Python 风格缩进 DSL），不写 JavaScript。
浏览器用 `shared/vml.js` 解析 + `shared/lesson-player.js` 播放。

## 为什么用 DSL 不用 JSON

- token 少 60%+（无引号括号重复）
- 人类可编辑（像 Python）
- 缩进即结构，AI 不易写错

## 文件结构

```
library/{id}/
  manifest.yaml   ← init 生成，可改 tags/prerequisites/steps
  lesson.learn    ← AI 主要编写
  lesson.quiz     ← AI 编写（可选）
library/index.json ← 由 `node bin/learning-hub.js sync` 生成，勿手写
library/{id}/index.html ← sync 从 templates/lesson/ 生成，勿手写、勿提交
shared/vml.js     ← 解析+渲染器（你维护一份）
```

## 工作流

1. 运行脚手架：`node bin/learning-hub.js init {id} --title "标题"`
2. 用户给考点 → 拆 3-5 step，每步 2-3 帧
3. 写 `library/{id}/lesson.learn` 和 `lesson.quiz`
4. 更新 `manifest.yaml` 的 tags、steps、quiz 字段
5. 校验：`node bin/learning-hub.js validate library/{id}`（**lint 零 error**）
6. 同步目录：`node bin/learning-hub.js sync`
7. 预览：`node bin/learning-hub.js serve` → 验证自动播放 + L0/L1/L2 + 插题

完整 SOP 见 `workflows/new-lesson.md`。

## 当前策略（重要）

| 范围 | 模式 | 说明 |
|------|------|------|
| `library/*` | **Strict v2** | 54 门课已整文件重写（`mode strict`） |
| `prototypes/vml-v2/*` | **对照/试验** | 标杆课与 element-catalog |
| `migrate-vml` / 批量重写 | **禁止** | validate 通过 ≠ 视觉合格 |

## Strict v2（仅原型试验）

引擎是 `shared/vml-strict.js`，与原型页引用**同一份文件**。原型能看，是因为：

1. 只测了 **3–4 门手写课**（redis-cache-breakdown / redis-hot-key / hashmap-collision / element-catalog）
2. 每帧 **刻意控制元素数量**（通常 1–2 个主图元）
3. 对比页右侧当时加载的是 **legacy library**，不是 strict

批量「重写」54 门课 ≠ 原型测试：Agent 把 legacy 信息密度原样塞进 strict，同 zone 多 `item` 叠在一起、`link` 指向 item 名等，**引擎没坏，内容写法不合格**。

## 如何让 AI 整文件重写（禁止 patch）

Agent 默认倾向 `StrReplace` 小改。要**删除重写**，需同时满足：

### 1. 用户指令写清楚（推荐原文）

```
完全重写 library/<id>/lesson.learn，不要 patch：
- 用 Write 整文件覆盖，禁止 StrReplace
- 旧文件只读考点，不复制任何 DSL 行
- mode strict，参考 prototypes/vml-v2/redis-cache-breakdown.learn 的写法密度
- 一次只改这一门课，写完 validate
```

### 2. 启用 Cursor 规则

已添加 `.cursor/rules/lesson-full-rewrite.mdc`，编辑 `lesson.learn` 时会自动注入「禁止 patch」约束。

### 3. 流程约束

| 步骤 | 动作 |
|------|------|
| 参考 | 读 legacy / manifest 提取 **step 名 + 考点** |
| 标杆 | 对照 `prototypes/vml-v2/*.learn` 的帧密度 |
| 写入 | `Write` 全新全文到 `prototypes/vml-v2/` 或 `library/<id>/` |
| 验收 | `validate` → `serve` → 原型对比页肉眼检查 |
| 入库 | 仅验收通过后复制到 library |

### 4. 避免踩坑

- 不说「迁移」「转换」「批量」——会触发机械替换
- 不说「改一下」——会触发 patch；改说 **「从零重写」**
- 一次一课，不要「全部课程重写」

```python
mode strict
lesson 课程标题
tags 标签1, 标签2

step 步骤短名
  layout three-tier      # 配方（必填）
  frames 3
  cap L0 | L1 | L2
  zones 线程:30 | Redis:310 | MySQL:600   # 名:坐标，对齐 legacy cols
  @all
    item hotkey in Redis label=hotkey stroke=red
  @0
    link 线程→Redis GET
    stress QPS grow max=100
  @1 L2
    note 底层说明 layer=L2
```

`zones` 可省略坐标（引擎自动均分），但 **三列架构课务必写 `:30 :310 :600`**，与 legacy `cols 线程:30 Redis:310 MySQL:600` 一致。

### 配方选型

| 考点 | layout |
|------|--------|
| 缓存/并发/三列架构 | `three-tier` |
| 因果链/单主线 | `flow-focus` |
| 横向 items + 公式 | `row-items` |
| buckets/chain/tree | `flow-focus`（结构 step） |

### Strict 语义命令

| 命令 | 示例 |
|------|------|
| `zones` | `zones 线程:30 \| Redis:310 \| MySQL:600` |
| `item` | `item hotkey in Redis label=hotkey sub=TTL=3s stroke=red` |
| `items` | `items keyA keyB keyC stroke=blue` |
| `link` | `link 请求→Redis GET` |
| `threads` | `threads 6 in 请求 grow` |
| `stress` / `meter` | `stress DB连接 grow max=100 pulse` |
| `caption` / `note` | `caption 说明 fill=warn` / `note 底层 layer=L2` |
| `badge` / `callout` | `badge ×1000 slot=right` / `callout hotkey 说明` |
| `flow` / `compare` | `flow 步骤1\|步骤2` / `compare A\|快 vs B\|慢` |
| `state` / `timeline` | `state 新建,运行,结束 slot=bottom` |
| `buckets` / `chain` / `tree` | `buckets 16 hi=0` / `chain "Aa" "BB"` / `tree list 8` |
| `queue` / `stack` / `table` | `queue 等待 slots=6 filled=4 in Redis` |
| `math` / `codeblock` | `math "O(n \\log n)" slot=bottom` |

**插画型**（仅占位，不可配置）：`tree rb`、`tree btree`

### Strict 硬约束

- 每帧主图元建议 ≤3，cap 每段 ≤20 字
- 三列架构课 `zones` 必须带坐标 `:30 :310 :600`
- 标杆参考：`library/redis-cache-breakdown/`、`library/hashmap-collision/`

### Legacy 坐标写法

历史存档或对照用。新内容勿用。

## Legacy 语法速查（旧课 / mode free）

```python
lesson 课程标题
tags 标签1, 标签2

step 步骤短名
  frames 2                          # 动画帧数
  cap L0字幕 | L1字幕 | L2字幕       # 三层剖面，| 分隔

  @0                                # 第 0 帧
    box x y w h label=文字 sub=副标题 stroke=red
    text 内容 x y fade fill=warn
    label 标题 x y

  @1                                # 第 1 帧
    box 320 68 120 48 label=hotkey expired blink

  @1+                               # 帧 ≥1 都显示
    threads 6 zone=线程 grow

  @all                              # 所有帧
    cols 线程:30 Redis:310 MySQL:600

  @1 L1                             # 帧1 + 仅 L1/L2 剖面显示
    text miss→DB 380 168

  @1 L2                             # 帧1 + 仅 L2 显示
    note x y w h 底层说明文字
```

### 帧标记

| 写法 | 含义 |
|------|------|
| `@0` `@1` `@2` | 精确帧 |
| `@1+` | 帧 ≥1 |
| `@all` | 所有帧 |
| `@1 L1` | 帧1 + depth≥1 才显示 |
| `@1 L2` | 帧1 + depth≥2 才显示 |

### 图元命令

| 命令 | 示例 |
|------|------|
| `box` | `box 320 68 120 48 label=hotkey sub=TTL stroke=red` |
| `text` | `text GET→nil 380 140 fade fill=red` |
| `label` | `label Redis内存 380 28` |
| `note` | `note 180 195 400 48 说明文字` |
| `code` | `code 30 250 700 60 "if(null){ db.query(); }" java` 等宽高亮 |
| `codeblock` | `codeblock 40 200 2 if(null)\|db.query()\|set()` 多行高亮 |
| `math` | `math 100 280 "O(n \\log n)"` 或 `math 80 200 300 50 "hash(k) \\bmod n" block` KaTeX |
| `circle` | `circle 90 80 9 fill=green` |
| `line` | `line 99 80 340 102 stroke=green draw` |
| `badge` | `badge ×1000 660 150 pulse` |
| `lock` | `lock 340 88` |
| `path` | `path M500 120 Q580 200 stroke=purple draw` |
| `cols` | `cols 线程:30 Redis:310 MySQL:600` |
| `threads` | `threads 6 zone=线程 grow` |
| `buckets` | `buckets 16 80 130 hi=0` |
| `chain` | `chain "Aa" "BB" "CC"` |
| `tree` | `tree list 380 100 8` / `tree rb 380 110` / `tree btree 380 80 levels=3` |
| `timeline` | `timeline 100 客户端\|SYN 服务端\|SYN-ACK 客户端\|ACK` |
| `compare` | `compare 80 55 300 左\|a\|b vs 右\|c\|d` |
| `flow` | `flow 620 55 步骤1\|步骤2\|步骤3` 竖向因果链 |
| `state` | `state 100 新建,运行,阻塞,结束` 状态机 |
| `stack` | `stack 100 70 main,service,dao` JVM栈 |
| `queue` | `queue 380 200 8 filled=4 label=任务队列` |
| `meter` | `meter 120 280 400 DB连接 grow max=100` |
| `table` | `table 60 90 级别,脏读,幻读/读未提交,✓,✓` |
| `arrow` | `arrow 线程 Redis GET` 需先 `cols` |
| `codeblock` | `codeblock 40 200 2 if(null)\|db.query()\|set()` |
| `callout` | `callout 380 68 520 55 标注文字` |

### 高阶组件（少写坐标）

| 组件 | 用途 | 帧联动 |
|------|------|--------|
| `flow` | 竖向因果链 | 帧N显示前N步 |
| `timeline` | 横向时序 | 帧N高亮前N步 |
| `state` | 状态机 | 当前帧=当前状态 |
| `stack` | 调用栈/JVM栈 | 帧N多压N层 |
| `queue` | 线程池队列 | filled/grow |
| `meter` | 负载条/QPS | value/grow |
| `table` | 对比表 | 行高亮跟帧 |
| `arrow` | 区域间箭头 | 配 cols 用 |
| `codeblock` | 多行代码高亮 | highlight=行号 |
| `tree list/rb/btree` | 链表/红黑树/B+树 | 见前 |
| `compare` | 左右方案对比 | 静态 |

完整选型表见 `shared/vml-cheatsheet.md`

### 属性简写

`fade` `blink` `pulse` `draw` `expired` `center` `grow`

颜色：`red` `blue` `orange` `green` `purple` `warn` `muted`

`fill=red` `stroke=blue` `opacity=0.15` `size=9`


### 字号与播放器

- 用户 A−/A/A+ 会同步缩放 VML 内所有 `font-size`（`--viz-font-scale`）
- 图元可用 `size=12` 指定相对字号
- 课程页支持 **⛶ 全屏**（动画区自动撑满）

### 代码与公式

```python
  @1
    code 40 220 320 56 "if (cache == null) {\n  return db.query();\n}" java
    codeblock 40 200 2 if(null)\|db.query()\|cache.set()
    math 480 280 "O(n \\log n)"
    math 40 300 200 44 "h(k) \\bmod n"
```

- `code`：单行或多行（`\\n`），`java`/`lang=java` 关键字高亮
- `math`：LaTeX 公式，需网络加载 KaTeX；离线显示纯文本
- `math ... block` 或 `w=` `h=` 控制区域大小

## 硬约束

- `cap` 每条 ≤ 20 字
- 每课 ≤ 5 step，每 step ≤ 4 frames
- 优先用 `cols` `threads` `chain` `buckets` 等高阶组件，少手写坐标
- 不要写 JavaScript render 函数

## 错题本策略（已定）

- **即时**：答错立刻显示 explain，可跳过，不阻断
- **持久化**：错了写入 `localStorage` 错题本（按 concept 聚合，非 Anki）
- **复现**：下次 `end` 综合测优先抽错题 concept
- **答对**：错题 count -1，归零则移除

## 旁白文件 `lesson.narrate`（可选）

与 `.learn` 同目录，旁白开时优先朗读；`cap` 仍作短字幕。

```
step 步骤短名          # 须与 lesson.learn 的 step 一致
  @0: L0 口语旁白…
  @0 L1: L1 更细的讲解…
  @1+: 从帧 1 起适用
  @all L2: 本 step 所有帧的 L2 旁白
```

参考 `library/arraylist-linkedlist/lesson.narrate`。生成预录音频（需本机 **Python 3**，首次自动创建 `.venv` 并安装 `edge-tts`）：

```bash
node bin/learning-hub.js narrate library/<id>
# 默认 zh-CN-YunxiNeural + rate 0.95（讲解男声、略慢）
node bin/learning-hub.js narrate library/<id> --voice zh-CN-XiaoyiNeural --rate 0.9 --force
# → audio/s0-f0-d0.mp3 + audio/narrate.json（含 cues 时间轴）
```

播放器优先播预生成 MP3，无音频时回退浏览器 TTS。

## 题库文件 `lesson.quiz`

与 `.learn` 同目录，播放器自动加载。见 `library/redis-cache-breakdown/lesson.quiz`。

