# PingPong Platform 运维手册

> 适用范围：本项目的日常部署、运行、监控、故障处理与升级。

## 1. 系统概览
- 类型：Next.js 应用（App Router），配套 Prisma + PostgreSQL（Neon）。
- 主要能力：用户、比赛、报名、结果、ELO、积分、奖励、徽章、审计日志、排行榜缓存等。

## 2. 运行环境与依赖
- Node.js：与 Next.js 16 兼容的 LTS 版本（建议 20+）。
- 包管理器：npm（或 pnpm / yarn，推荐与现有一致）。
- 数据库：PostgreSQL（推荐 Neon，需 SSL）。
- 进程管理（自建服务器）：PM2。
- 构建与部署：
  - Netlify（已提供 netlify.toml），或
  - 自建服务器（Linux/Windows 均可，以下以 Linux/PM2 为主）。

## 3. 关键目录与文件
- 应用代码：src/
- 数据库模型：prisma/schema.prisma
- 数据库迁移：prisma/migrations/
- 环境变量示例：README.md
- Netlify 构建配置：netlify.toml

## 4. 环境变量配置
请在部署环境中配置以下变量（不要在文档或日志里暴露真实值）：

- 数据库
  - DATABASE_URL
  - DIRECT_URL
- 应用地址
  - APP_URL
  - NEXT_PUBLIC_APP_URL
- 邮件服务（如使用）
  - AZURE_COMMUNICATION_CONNECTION_STRING
  - RESEND_API_KEY
  - RESEND_FROM_EMAIL
- 认证/安全
  - AUTH_SECRET
- Cloudinary
  - NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  - CLOUDINARY_API_KEY
  - NEXT_PUBLIC_CLOUDINARY_API_KEY
  - CLOUDINARY_API_SECRET

建议：生产环境中使用专用的机密管理（如 Netlify 环境变量、服务器 .env、或外部 Secrets 管理）。

## 5. 本地开发
1. 安装依赖
   - npm install
2. 生成 Prisma Client
   - npm run prisma:generate
3. 本地迁移（开发用）
   - npm run prisma:migrate
4. 启动开发服务器
   - npm run dev

## 6. 构建与部署

### 6.1 Netlify 部署
- 构建命令（已在 netlify.toml 中配置）：
  - npm run prisma:generate && npm run build
- 必须在 Netlify 控制台配置所有环境变量。
- 首次上线或变更数据库结构时，先在本地或 CI 上执行迁移（推荐使用自动化迁移流程）。

### 6.2 自建服务器（PM2）
以下流程已在 README 中验证：

1. 拉取代码
   - git pull origin master
2. 更新 .env（如新增/修改环境变量）
3. 安装依赖并执行迁移
   - npm install
   - npx prisma migrate deploy
4. 构建
   - npm run build
5. 重启服务并更新环境
   - pm2 restart kedapp --update-env

常用 PM2 命令：
- 启动：pm2 start npm --name "kedapp" -- run start
- 停止：pm2 stop kedapp
- 重启：pm2 restart kedapp --update-env
- 查看日志：pm2 logs kedapp

## 7. 数据库迁移策略
- 开发环境：使用 `prisma migrate dev`。
- 生产环境：使用 `prisma migrate deploy`（只应用已存在迁移文件）。
- 迁移变更时务必：
  - 在测试环境先验证
  - 备份数据库
  - 记录变更版本

## 8. 备份与恢复
建议策略（按实际平台调整）：
- Neon：开启 PITR 或定期快照。
- 自建 Postgres：
  - 日常：pg_dump 逻辑备份
  - 应急：WAL + 全量备份

恢复流程要点：
1. 确认目标恢复时间点
2. 在隔离环境恢复并验证
3. 再进行生产切换

## 9. 监控与日志
- 应用日志：PM2 logs / 平台日志（Netlify / Vercel）
- 数据库监控：连接数、慢查询、磁盘增长
- 关键指标建议：
  - 5xx 率
  - API 延迟
  - 数据库连接池使用率

## 10. 安全与合规
- 禁止在仓库提交 .env 或密钥
- 生产环境开启 HTTPS
- 定期轮换密钥与数据库密码
- 确保最小权限访问（数据库角色只开放必要权限）

## 11. 故障排查

### 11.1 应用无法启动
- 检查 Node 版本
- 检查环境变量是否齐全
- 确认 Prisma Client 已生成

### 11.2 数据库连接失败
- 检查 DATABASE_URL
- 确认 SSL 参数
- 检查防火墙或网络策略

### 11.3 页面报 500
- 查看 PM2 日志
- 检查数据库迁移是否缺失
- 排查近期发布变更

## 12. 变更与发布流程建议
- 开发分支测试通过后合并主分支
- 生产发布前标记版本（Git tag）
- 每次发布记录：版本号、迁移、回滚点

## 13. 回滚方案
- 代码回滚：切换到上一个稳定 commit 并重新构建
- 数据库回滚：
  - 如需回滚迁移，优先在隔离环境验证
  - 使用备份/快照恢复

## 14. 运维检查清单
- 环境变量校验
- 数据库连接与权限校验
- 迁移记录与执行情况
- 备份是否可用
- 监控告警是否生效

---

如需补充：CI/CD、灰度发布、蓝绿部署等流程，请告知目标平台与期望策略。