# CET4 Sprint (Fullstack)

现在是前后端打通版本：
- 前端：`index.html + app.js`
- 后端：`server.js`（Express API）
- 持久化：`data/user-progress.json`

## 运行

```powershell
cd E:\AIforcodex\softwarecodex\cet4-study-app
npm install
npm run dev
```

打开 `http://localhost:5173`

## 已打通功能

- 词汇训练进度（当前题号、正确数、错误数）写入后端
- 错题本和难句本写入后端
- 刷新页面后自动从后端恢复学习进度
- 后端不可用时自动回退到浏览器本地存储

## API

- `GET /api/health`
- `GET /api/progress/:userId`
- `PUT /api/progress/:userId`
- `DELETE /api/progress/:userId`