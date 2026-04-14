# 队伍查询 GitHub Pages 版

这是一个可直接部署到 **GitHub Pages** 的静态网站项目。

## 项目结构

- `docs/`：GitHub Pages 发布目录
- `docs/index.html`：主页
- `docs/player-data.js`：玩家与队伍数据
- `docs/app.js`：查询逻辑
- `docs/styles.css`：页面样式

## 部署方法（Project Page）

1. 在 GitHub 新建一个仓库，例如：`team-lookup`
2. 把本项目全部文件上传到仓库根目录
3. 打开仓库设置：`Settings -> Pages`
4. 在 **Build and deployment** 中选择：
   - **Source**: Deploy from a branch
   - **Branch**: `main`
   - **Folder**: `/docs`
5. 保存后等待 GitHub 发布
6. 成功后访问：
   - `https://<你的GitHub用户名>.github.io/<仓库名>/`

## 如果想做成个人主页

如果你的仓库名是 `<username>.github.io`，也可以把 `docs` 里的文件直接放到仓库根目录，访问地址会变成：

`https://<username>.github.io/`

## 更新数据

以后如果你想替换表格数据，只需要重新生成 `player-data.js`，然后覆盖 `docs/player-data.js` 再提交即可。
