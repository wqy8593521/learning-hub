# VML v2 布局约束设计

> 状态：草案，待评审  
> 日期：2026-07-01  
> 目标：减少 AI 坐标错误，引擎强制排版，保留复杂课的自由度

---

## 1. 背景与问题

### 1.1 现状数据（54 门课）

| 写法类型 | 大致用量 | 引擎约束 |
|----------|----------|----------|
| 低阶图元（box/text/label/note…） | ~900 行 | 无，全靠 x/y |
| 高阶组件（cols/flow/compare…） | ~550 行 | 部分（内部尺寸固定，入口仍要坐标） |
| 使用 `cols` 的课 | 45/54 | 列宽/高硬编码，x 仍手写 |
| 使用 `flow` 的课 | 35/54 | `flow 620 55` 等坐标仍手写 |
| 使用 `compare` 的课 | 42/54 | 传入 y 被忽略，易与周边重叠 |

`validate` 只查结构（step 数、quiz 引用），**不查显示**。

### 1.2 核心矛盾

- **内容层**（讲什么机制）与 **布局层**（画在哪）混在同一 DSL
- 规范写「少手写坐标」，但语法**默认允许**且无任何惩罚
- AI 最短路径是复制示范课 magic number（`320 68`、`660 150`）

### 1.3 设计目标

1. 新课默认 **strict 模式**：作者只写语义，引擎排版
2. 复杂/非标准课可显式 `mode free`
3. **向后兼容**：未迁移的 54 门课零改动仍可播放
4. `validate` 增加 **visual lint**（越界、重叠、空帧、孤儿 arrow）
5. Skill / cheatsheet 与引擎同步升级

### 1.4 非目标（本阶段不做）

- 不改播放器 UI、帧/L0/L1/L2 交互模型
- 不重写 quiz / narrate 格式
- 不追求像素级设计系统（Figma 级主题）
- 不一次性迁移全部 54 门课（分波次）

---

## 2. 方案对比

### 方案 A：全新语法 VML2，旧课批量机械转换

- 优：干净
- 劣：54 课一次性风险高，转换器难覆盖所有边角

### 方案 B：在现有语法上加 `layout` 配方，坐标标 deprecated

- 优：迁移平滑，旧语法继续 parse
- 劣：两套写法并存期较长

### 方案 C：仅加强 lint + Skill 约束，不改引擎

- 优：改动最小
- 劣：不解决根因，AI 仍会写坐标

**推荐：方案 B（增量演进）**  
引擎内部分为 **Legacy 管线** 与 **Strict 管线**，共用 SVG 渲染层。

---

## 3. 总体架构

```
lesson.learn
    │
    ▼
┌─────────────┐
│  Parser     │  识别 mode / layout / 帧标记（不变）
└──────┬──────┘
       │
   mode?├── legacy (默认) ──► LegacyCompiler ──► RenderCmd[]
       │
       └── strict ──► LayoutEngine(recipe) ──► RenderCmd[]
                              │
                              ▼
                       ┌─────────────┐
                       │ Visual Lint │
                       └──────┬──────┘
                              ▼
                       SVG (viewBox 0 0 760 340)
```

### 3.1 文件拆分（`shared/vml.js` 瘦身）

| 新文件 | 职责 |
|--------|------|
| `shared/vml-parse.js` | 词法/语法 → AST（lesson/step/frame/cmd） |
| `shared/vml-legacy.js` | 现有 compileLine → RenderCmd |
| `shared/vml-layout.js` | Strict 语义命令 → 槽位 → 坐标 |
| `shared/vml-recipes.js` | 配方定义（zones 位置、槽位表） |
| `shared/vml-render.js` | RenderCmd → SVG 字符串 |
| `shared/vml-lint.js` | 边界/重叠/空帧检测 |
| `shared/vml.js` | 薄入口，导出 `parse/render/lessonToScenes/lint` |

CLI `load-vml.mjs` 改为加载入口 bundle 或串联多文件。

---

## 4. 语法设计（VML Strict）

### 4.1 课程头

```python
mode strict          # 缺省 = legacy（迁移期）
lesson Redis 热点 Key
tags Redis, 热点
```

### 4.2 Step 头

```python
step 热点形成
  layout three-tier   # 本 step 的布局配方（strict 必填）
  frames 3
  cap 少数key访问极高 | 单线程瓶颈 | 打满单节点CPU/带宽
```

`layout` 只影响本 step；允许不同 step 用不同配方。

### 4.3 语义命令（Strict 可用）

**区域与连线**（替代 `cols` + 手写 x）

```python
zones 请求 | Redis              # 声明区名，引擎按配方摆位
link 请求→Redis GET               # 替代 arrow（自动注册 zone）
link Redis→MySQL 查询 @1+         # 可挂帧条件（见 4.5）
```

**区内容器**（替代 `box` + 坐标）

```python
item hotkey in Redis label=hotkey sub=TTL=3s stroke=red pulse
item Caffeine in 本地 label=Caffeine stroke=green
```

**标注**（替代 `text`/`label`/`note`/`badge`/`callout`）

```python
caption 单key QPS 爆表 fill=red          # 配方决定默认槽位
caption miss→查DB fill=warn layer=L1
note 惰性删除·释放内存 layer=L2
badge ×10000 slot=right fill=red pulse
callout hotkey 热点key                   # 指向已声明 item
```

`slot` 枚举：`top` `bottom` `left` `right` `center` `overlay`  
未写 `slot` 时由配方 + 命令类型给默认值。

**并发与负载**（替代带 zone 的 threads/meter）

```python
threads 8 in 请求 grow
meter QPS slot=bottom grow max=100 pulse
queue 等待队列 slots=6 filled=4 in Redis
stress DB连接 slot=bottom grow max=100   # meter 别名，语义更清晰
```

**结构与专用组件**（保留组件名，去掉入口坐标）

```python
flow 热点在缓存|TTL到期|GET空|准备查DB    # 配方决定 flow 在右侧
compare 普通key|分散 vs 热点key|集中|单点   # 配方决定 compare 区域
state 竞争,SETNX,查库,回填,完成 slot=bottom
timeline 客户端|SYN 服务端|SYN-ACK 客户端|ACK
stack main,service,dao slot=left
table 级别,脏读,幻读/读未提交,✓,✓
tree list 8 | tree rb | tree btree levels=3
buckets 16 hi=3
chain "Aa" "BB" "CC"
```

**代码与公式**（strict 仍允许，但限制 slot）

```python
codeblock if(null)|db.query()|cache.set() layer=L1
math "key + random(0,N)" slot=center
```

`codeblock` 在 L1+ 仍走侧栏逻辑，画布内不重复渲染（与现行为一致）。

### 4.4 帧与剖面（不变）

```
@0  @1  @2  @1+  @all  @1 L1  @2 L2
```

Strict 下 **`layer=L1` 等价于 `@… L1` 块**，允许写在单行命令尾以减少嵌套（二选一，不同混用同义重复）。

### 4.5 Mode Free（逃逸口）

```python
mode free
```

- 允许全部现有 legacy 命令（含裸坐标）
- `validate` 报 **warning**（非 error），visual lint 仍运行
- 用于：自定义 path、非标准拓扑、实验课

---

## 5. 布局配方（Recipes）

首批 6 个，覆盖 ≥80% 现有课。

### 5.1 `three-tier`

**适用**：缓存、并发、分布式读写（45 课中 ~30 step）

```
┌────────┬────────────┬────────┐
│ 左区   │   中区     │  右区  │  ← zones 映射
│ ~120px │  ~140px    │ ~120px │
├────────┴────────────┴────────┤
│ bottom: meter / note         │
│ right-rail: flow（可选）      │
└──────────────────────────────┘
```

| 语义 | 默认槽位 |
|------|----------|
| `zones A \| B` | 左、中 |
| `zones A \| B \| C` | 左、中、右（经典三列） |
| `flow` | 右栏 620 区（或 bottom-right） |
| `item x in 中区` | 区中心 |
| `meter` / `stress` | bottom 全宽 |
| `caption` 无 slot | 中区下方 |
| `threads in 左区` | 区内纵向堆叠，自动限高 |

### 5.2 `flow-focus`

**适用**：单条因果链为主（~20 课）

- `flow` 占画布中央竖条
- `caption` / `note` 在 flow 两侧自动 alternation
- 无 zones 时单栏

### 5.3 `compare`

**适用**：方案对比（42 课）

- `compare` 自动水平居中（修复现有 y 被忽略问题）
- 行数 >4 时引擎缩小字号或 truncate + lint warning

### 5.4 `structure`

**适用**：HashMap、B+树、索引、GC 分代（~15 课）

- `buckets` / `chain` / `tree` 占 center 区
- 自动计算宽度，超出时缩放或 lint error
- `caption` 在 top

### 5.5 `timeline`

**适用**：TCP 握手、事务提交、协议时序（~10 课）

- `timeline` 水平居中，步数多时自动压缩 step 间距（现有逻辑增强）

### 5.6 `stack-panel`

**适用**：JVM 栈、调用链、内存区域（~12 课）

- `stack` / 多个 `item` 左栏
- 右栏放 `caption` / `compare` / `flow`

### 配方扩展规则

- 新配方 = `vml-recipes.js` 内一份 slot 表 + 默认尺寸
- 不改 parser；只增 `layout xxx` 枚举值

---

## 6. Visual Lint（validate 扩展）

在 `cli/validate.mjs` 或 `cli/lint-visual.mjs` 中，parse 后跑：

| 规则 ID | 级别 | 条件 |
|---------|------|------|
| `bounds` | error | 任意图元 bbox 超出 760×340（含 8px margin） |
| `overlap` | warning | 同帧两图元 IoU > 阈值（排除连线） |
| `empty-frame` | warning | 某帧 depth=0 无任何可见 cmd |
| `orphan-link` | error | strict: `link A→B` 但 zone/item 未声明 |
| `orphan-arrow` | error | legacy: `arrow` 无同帧 `cols` |
| `strict-coords` | error | strict 模式出现裸坐标命令 |
| `cap-length` | error | cap 段 >20 字（现有规则文档化） |
| `frame-cap` | warning | frames=N 但最大 @ 标记 >N-1 |

CLI：

```bash
node bin/learning-hub.js validate library/<id>        # 结构 + lint
node bin/learning-hub.js validate library/<id> --strict  # 强制 strict 规则
```

---

## 7. Skill / 文档变更

### 7.1 `.cursor/skills/visual-lesson-generator/SKILL.md`

- 新课 **必须** `mode strict`
- 增加 **配方选型表**（考点 → layout）
- Strict 命令表取代大部分坐标示例
- Legacy 坐标表移到「附录 / 仅 mode free」
- 工作流增加：`validate` 零 error 才算完成

### 7.2 `shared/vml-cheatsheet.md`

- 前半：Strict 配方 + 语义命令
- 后半：Legacy 参考（标注 deprecated）

### 7.3 `AGENTS.md`

- 硬约束增加：`mode strict` 课禁止 box/text 坐标写法
- 迁移中旧课标注 `mode legacy`（可选，便于统计）

### 7.4 `workflows/new-lesson.md`

- `init` 模板 `lesson.learn` 改为 strict 骨架
- 预览 checklist 增加「逐帧 lint 无 error」

---

## 8. 现有课程迁移策略

### 8.1 分档（54 课）

| 档位 | 特征 | 数量 | 迁移方式 |
|------|------|------|----------|
| **A** | 主用 cols+arrow+threads | ~18 | → `layout three-tier`，半自动脚本 + 人工过帧 |
| **B** | 主用 flow/compare | ~15 | → `flow-focus` / `compare` |
| **C** | 主用 tree/buckets/chain | ~8 | → `layout structure` |
| **D** | 主用 timeline/state | ~6 | → `timeline` / 扩展 state 配方 |
| **E** | 大量裸坐标、特殊布局 | ~7 | 暂留 `mode free`，仅 lint 修明显问题 |

### 8.2 迁移波次

| 波次 | 范围 | 目的 |
|------|------|------|
| **P0** | 引擎 + lint + 3 门试点 | 验证语法与配方 |
| **P1** | A 档 18 课 | 覆盖最高频模式 |
| **P2** | B+C 档 23 课 | 扩配方覆盖 |
| **P3** | D+E 档 13 课 | 收尾或标记 free |
| **P4** | `init` 默认 strict；legacy 需显式声明 | 防止新课回退 |

### 8.3 试点课（P0）

1. `redis-cache-breakdown` — three-tier 标杆（现有示范课）
2. `redis-hot-key` — three-tier + compare + math
3. `hashmap-collision` — structure（buckets/chain）

试点成功标准：strict 版 lint 零 error，肉眼对比 legacy 无信息丢失。

### 8.4 半自动迁移工具（可选脚本）

```bash
node bin/learning-hub.js migrate-vml library/redis-hot-key --dry-run
```

- 识别 `cols` 行 → `zones`
- 识别 `arrow X Y` → `link X→Y`
- `box` in 中区启发式（按 x 范围 280–460）→ `item in Redis`
- **不能自动转的**输出 TODO 清单，人工处理

不追求 100% 自动；脚本只做机械替换，人审帧语义。

---

## 9. 实施阶段（高层）

```
Phase 1  引擎拆分 + legacy 行为不变 + lint bounds/overlap
Phase 2  strict parser + three-tier 配方 + 试点 1 课
Phase 3  其余 5 配方 + migrate 工具 + 试点 3 课
Phase 4  Skill/模板/init 切换 strict 默认
Phase 5  P1 批量迁移（A 档）
Phase 6  P2/P3 迁移 + legacy 标记 deprecated
```

预估：Phase 1–4 为引擎与基础设施；Phase 5–6 可与内容生产并行。

---

## 10. 风险与对策

| 风险 | 对策 |
|------|------|
| 配方不够用 | `mode free` + 快速加配方 |
| 迁移改坏教学语义 | 逐课 validate + 预览，git 按课提交 |
| vml.js 拆分破坏播放器 | 保持 `VML.parse/render/lessonToScenes` 对外 API 不变 |
| overlap lint 误报 | 默认 warning；连线不参与 overlap |
| 侧栏 codeblock 布局突变 | strict 行为与 legacy 一致，不改 viewport 逻辑 |

---

## 11. 待决问题（评审时确认）

1. **默认切换时机**：P4 是否强制新课 `mode strict`？（建议：是）
2. **legacy 何时删除**：建议至少保留 6 个月，E 档课可永久 free
3. **`link` 语法**：`A→B` 还是 `A B label`？（建议：`→` 更直观，parser 需支持 Unicode）
4. **是否引入单元测试**：建议 `tests/vml-lint.test.mjs` + 3 个 golden SVG snapshot
5. **迁移是否阻塞新课生产**：建议不阻塞；legacy 与 strict 可并存

---

## 12. 附录：Strict 改写示例

### redis-hot-key / step 热点形成（节选）

**Legacy（现）**

```python
step 热点形成
  frames 3
  cap 少数key访问极高 | 单线程瓶颈 | 打满单节点CPU/带宽
  @all
    box 380 70 160 60 label=hotkey stroke=red pulse
    threads 8 zone=请求 grow
  @0
    arrow 请求 hotkey GET
    meter 120 160 400 QPS grow max=100 pulse
```

**Strict（目标）**

```python
mode strict
step 热点形成
  layout three-tier
  frames 3
  cap 少数key访问极高 | 单线程瓶颈 | 打满单节点CPU/带宽
  zones 请求 | Redis
  @all
    item hotkey in Redis label=hotkey stroke=red pulse
    threads 8 in 请求 grow
  @0
    link 请求→Redis GET
    stress QPS grow max=100 pulse
```

Token 数相近，但 **无可抄 magic number**。
