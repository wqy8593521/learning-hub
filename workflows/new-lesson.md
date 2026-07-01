# 新课工作流（Agent 无关）

适用于 Cursor、Codex、OpenCode 等任意 Agent。

## 1. 创建脚手架

```bash
node bin/learning-hub.js init <kebab-case-id> --title "人类可读标题"
```

生成：

```
library/<id>/
  manifest.yaml
  lesson.learn      # 骨架，需替换
  lesson.quiz       # 示例题，需替换
  lesson.narrate    # 旁白稿骨架（可选）
```

`index.html` 不放在 git 里；`sync` 时从 `templates/lesson/` 生成。

`id` 规则：小写字母、数字、连字符，与目录名一致。

## 2. 编写 lesson.learn

Agent 根据考点拆 3–5 个 `step`，每步 2–3 `frames`，三层 `cap`（L0/L1/L2）。

语法见 `shared/vml-cheatsheet.md` 与 `library/redis-cache-breakdown/lesson.learn`。

**不要**写 JavaScript 或修改 `shared/vml.js`。

## 3. 编写 lesson.quiz（推荐）

与 `.learn` 同目录。每 step 结束后插 1 题，末尾 `end` 综合测。

语法见 `library/redis-cache-breakdown/lesson.quiz`。

若不需要 quiz，在 `manifest.yaml` 设 `quiz: false` 并删除 `lesson.quiz`。

## 4. 编写 lesson.narrate（可选）

与 `.learn` 同目录。旁白开启时优先朗读口语稿；无音频时回退浏览器 TTS。

语法见 `library/arraylist-linkedlist/lesson.narrate` 与 Skill 中「旁白文件」一节。

预生成 MP3（需本机 **Python 3**，首次自动创建 `.venv` 并安装 `edge-tts`）：

```bash
node bin/learning-hub.js narrate library/<id>
# → audio/s0-f0-d0.mp3 … + audio/narrate.json（含 cues 时间轴）
```

生成后请将 `audio/` 一并提交，Pages 部署才会带预录音频。CI 默认**不**跑 `narrate`（耗时长、需网络）。

不需要旁白可删除 `lesson.narrate`。

## 5. 更新 manifest

确认 `manifest.yaml` 中：

- `tags`、`prerequisites` 准确
- `steps` 与 `.learn` 中 step 数量一致
- `quiz: true/false` 与是否含 `lesson.quiz` 一致

## 6. 校验

```bash
node bin/learning-hub.js validate library/<id>
```

常见失败原因：

- `after_step N` 超出 step 总数
- trigger 引用的 concept 在 pool 中不存在
- `manifest.steps` 与 parse 结果不一致

## 7. 同步目录

```bash
node bin/learning-hub.js sync
```

重写 `library/index.json`，并从模板生成各课 `index.html`（本地预览 / Pages 部署用）。

## 8. 本地预览

```bash
node bin/learning-hub.js serve
```

打开 `http://localhost:3456`，进入新课程页，检查：

- [ ] 自动播放流畅
- [ ] L0/L1/L2 切换字幕正确
- [ ] 旁白开时播 MP3（有 `audio/`）或浏览器朗读（无音频）
- [ ] 插题时机与解析正确
- [ ] 错题本能记录（答错后刷新首页可见）

## 9. 提交

```bash
git add library/<id>/ library/index.json
# 若生成了旁白：
# git add library/<id>/audio/
git commit -m "add lesson: <title>"
git push
```

GitHub Actions 会自动 validate → sync → 部署 Pages。

## 修改已有课程

只改 `lesson.learn` / `lesson.quiz` / `lesson.narrate` / `manifest.yaml`，然后 `validate` → `sync`。改旁白稿后重跑 `narrate` 并提交 `audio/`。
