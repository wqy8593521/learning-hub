# AGENTS.md — Learning Hub

本仓库是 **Agent 可操作的视觉学习库**。任意 Agent（Cursor、Codex、OpenCode 等）按以下约定生产内容。

## 你的职责

Agent **只写内容文件**，不写 JavaScript 渲染代码：

| 文件 | 谁写 | 说明 |
|------|------|------|
| `lesson.learn` | Agent | VML 动画 DSL，核心产出 |
| `lesson.quiz` | Agent | 题库 DSL（若 manifest.quiz=true） |
| `lesson.narrate` | Agent | 口语旁白稿（可选，见下） |
| `audio/*.mp3` | CLI 生成 | `narrate` 命令预生成，需提交到仓库 |
| `manifest.yaml` | init 生成，Agent 可改 tags/prerequisites | 课程元数据 |
| `index.html` | `sync` 从模板生成 | 勿手写、勿提交 git |

## 标准工作流

见 [workflows/new-lesson.md](workflows/new-lesson.md)。

简版：

1. `node bin/learning-hub.js init <id> --title "标题"`
2. 编写 `lesson.learn`（参考 `shared/vml-cheatsheet.md`）
3. 可选：编写 `lesson.quiz`
4. 可选：编写 `lesson.narrate`，再 `node bin/learning-hub.js narrate library/<id>` 生成 MP3
5. `node bin/learning-hub.js validate library/<id>`
6. `node bin/learning-hub.js sync`
7. 用户 commit / push（含 `audio/` 若已生成旁白）

## Cursor

Skill 路径：`.cursor/skills/visual-lesson-generator/SKILL.md`

触发示例：「用 visual-lesson-generator 生成 Redis 持久化机制课」

## 硬约束

- 每课 ≤ 5 step，每 step ≤ 4 frames
- `cap` 每条 ≤ 20 字
- 优先高阶组件（`flow` `cols` `chain` `buckets` 等），少手写坐标
- 校验失败必须修复后再 sync

## 重写 vs Patch（重要）

改 `lesson.learn` / `lesson.quiz` / `lesson.narrate` 时：

| 做法 | 说明 |
|------|------|
| ✅ **整文件重写** | `Write` 覆盖全文；先读旧课只提取考点，不复制旧 DSL 行 |
| ❌ **Patch** | `StrReplace`、保留旧结构改几行、migrate-vml、批量替换 |

用户说「重写」「完全重写」时，Agent **必须**整文件写，禁止局部 diff。详见 `.cursor/rules/lesson-full-rewrite.mdc`。

## 关键参考

- VML 语法：`.cursor/skills/visual-lesson-generator/SKILL.md`
- 组件选型：`shared/vml-cheatsheet.md`
- 示例课：`library/redis-cache-breakdown/`（动画）、`library/arraylist-linkedlist/`（含旁白 + 预生成音频）
- 校验：`node bin/learning-hub.js validate`
