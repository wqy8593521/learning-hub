# Learning Hub

**可 fork 的、Agent 驱动的可视化后端学习库。**

Git clone 下来，接上 Cursor / Codex / OpenCode 任意 Agent，用 Skill 生成 `.learn` 动画课和 `.quiz` 题目，本地预览后 push 到 GitHub Pages 即可分享。

```
Agent 写 lesson.learn / lesson.quiz / lesson.narrate（可选）
        ↓
  learning-hub validate
        ↓
  learning-hub narrate（可选，预生成旁白 MP3）
        ↓
  learning-hub sync → library/index.json
        ↓
  GitHub Pages / 本地 serve
```

## 5 分钟快速开始

```bash
git clone <your-repo-url> learning-hub
cd learning-hub

# 校验现有课程
node bin/learning-hub.js validate

# 本地预览
node bin/learning-hub.js serve
# → http://localhost:3456
# 首页 #lesson/{id} 无需 sync；独立链接 library/{id}/index.html 需先 sync
```

## 生成新课

```bash
# 1. 脚手架
node bin/learning-hub.js init mysql-btree-index --title "MySQL B+树索引"

# 2. 让 Agent 编辑 library/mysql-btree-index/lesson.learn
#    （Cursor: 使用 visual-lesson-generator skill）

# 3. 校验 + 同步目录
node bin/learning-hub.js validate library/mysql-btree-index
node bin/learning-hub.js sync

# 4. 预览
node bin/learning-hub.js serve
```

详细 Agent 工作流见 [workflows/new-lesson.md](workflows/new-lesson.md)。

## CLI 命令

| 命令 | 说明 |
|------|------|
| `validate [path]` | 校验课程包（manifest + .learn + .quiz + .narrate） |
| `sync` | 从 manifest 生成 `library/index.json` 与各课 `index.html` |
| `init <id> --title "..."` | 从模板创建新课程目录 |
| `narrate [path]` | 用 Edge TTS 预生成旁白 MP3（需 Python 3 + `lesson.narrate`） |
| `serve [-p 3456]` | 启动本地静态服务器 |

也可通过 npm scripts：

```bash
npm run validate
npm run sync
npm run serve
npm run narrate -- library/<id>   # 生成旁白音频
```

## 课程包结构

```
library/{id}/
  manifest.yaml    # 元数据（标题、标签、是否含 quiz）
  lesson.learn     # VML 动画 DSL（Agent 主要编写此文件）
  lesson.quiz      # 题库 DSL（可选）
  lesson.narrate   # 口语旁白稿（可选）
  audio/           # narrate 命令生成的 MP3 + narrate.json（可选）
```

`index.html` 由 `sync` 从 `templates/lesson/` 生成，用于独立课程链接；不提交 git，CI 部署前自动 `sync`。

播放器旁白：顶栏「旁白」或快捷键 `N`。有 `audio/` 时播预生成 MP3 + 分句高亮；否则回退浏览器 Web Speech。

## 发布到 GitHub Pages

1. Fork 本仓库（或 push 到你自己的 remote）
2. **必须先手动启用 Pages**（否则 CI 会报 `Get Pages site failed` / `Not Found`）：
   - 打开仓库 **Settings → Pages**
   - **Build and deployment → Source** 选择 **GitHub Actions**（不是 Deploy from a branch）
   - 保存后等几秒，再重新跑 workflow 或 push 到 `main`
3. Push 到 `main` 分支，`.github/workflows/pages.yml` 会自动 validate → sync → deploy

## Fork 个人学习库

1. Fork 本仓库为 `yourname/java-visual-lib`
2. 删除或保留 `library/` 下的示例课
3. 用 Agent + `init` 持续往 `library/` 加课
4. 每加一课：`validate` → `sync` → `git commit` → push
5. 把 Pages 链接写进 README / 简历

## Agent 接入

| Agent | 入口 |
|-------|------|
| Cursor | `.cursor/skills/visual-lesson-generator/SKILL.md` |
| 通用 | [AGENTS.md](AGENTS.md) + [workflows/new-lesson.md](workflows/new-lesson.md) |

## 技术栈

- **VML** (`.learn`) — Python 风格缩进 DSL，渲染为 SVG 动画
- **Quiz DSL** (`.quiz`) — 插题 + 错题本（localStorage）
- **Narrate** (`.narrate` + `audio/`) — 口语旁白稿 + Edge TTS 预生成音频
- **零构建** — 纯静态 HTML/JS，无需 webpack

## 许可

MIT（可按需修改）
