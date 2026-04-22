# CET4 Sprint

这是一个纯前端单词学习应用。你现在可以把它部署到公网，手机和电脑都通过同一个网址访问，不需要连接同一个 Wi-Fi。

## 本地启动

```powershell
cd E:\AIforcodex\softwarecodex\cet4-study-app
node server.js
```

打开 `http://localhost:5173`。

## 公网发布（推荐 Vercel）

### 方式 A：最少步骤（CLI）

```powershell
cd E:\AIforcodex\softwarecodex\cet4-study-app
npm i -g vercel
vercel login
vercel --prod
```

发布完成后会得到一个 `https://xxxx.vercel.app` 链接，这个链接手机和电脑都能直接访问。

### 方式 B：GitHub + Vercel（持续发布）

1. 把项目推到 GitHub 仓库。
2. 登录 Vercel，导入该仓库。
3. Framework 选 `Other`，不需要改构建命令。
4. 点击 Deploy。

以后每次 `git push` 都会自动发布新版本。

## 备选发布：Netlify

1. 登录 Netlify。
2. New site from Git，选择你的仓库。
3. Build command 留空，Publish directory 填 `.`。
4. 点击 Deploy。

## 是否需要服务器

- 当前这个项目是静态站点，不需要自己买云服务器。
- 用 Vercel/Netlify/GitHub Pages 就能直接公网访问。
- 只有当你要账号登录、云同步、支付、多人数据时，才需要后端和数据库。
