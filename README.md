# 队伍查询（可手动新增并推送到 GitHub）

这个版本在原查询页基础上新增了：

- 选中玩家后，手动补录一套新队伍
- 默认先保存到浏览器本地，刷新后仍保留
- 可一键导出最新 `player-data.js`
- 若使用本项目自带的本地服务启动网页，可直接写回 `docs/player-data.js`
- 若当前目录本身就是 Git 仓库，且远程已配置好认证，可直接把更新后的 `docs/player-data.js` 与 `docs/player-data.json` 提交并推送到 GitHub

## 使用前提

如果你想在网页里点“保存并推送 GitHub”，需要满足：

1. 这个项目目录本身是一个 Git 仓库副本
2. 已配置好 GitHub 远程，例如 `origin`
3. 当前机器已经配置好推送认证（SSH key 或 token）

## 启动方式

### 最简单的启动方式

```bash
bash run_team_lookup.sh
```

启动后访问：

```text
http://127.0.0.1:8000
```

### 指定端口 / 分支 / 远程

```bash
TEAM_LOOKUP_PORT=8000 TEAM_GIT_REMOTE=origin TEAM_GIT_BRANCH=main bash run_team_lookup.sh
```

### 保存后自动推送 GitHub

```bash
TEAM_AUTO_PUSH=1 TEAM_GIT_REMOTE=origin TEAM_GIT_BRANCH=main bash run_team_lookup.sh
```

这样网页点击“保存到文件”时也会自动提交并推送。

## 页面里的三个保存相关动作

- `保存到文件`：只更新本地 `docs/player-data.js` 与 `docs/player-data.json`
- `保存并推送 GitHub`：更新本地文件后，自动执行 `git add`、`git commit`、`git push`
- `导出当前 player-data.js`：适合纯 GitHub Pages 静态模式，手动覆盖仓库文件后再提交

## 说明

GitHub Pages 是静态托管，纯前端网页不能直接写服务器文件；要想“网页里点保存就永久改文件并同步到 GitHub”，必须配合本地服务或后端接口。
