# 项目目录说明（文件级）

本文件基于当前仓库实际文件生成，按“目录 -> 文件 -> 作用”进行说明。

## 1. 顶层文件与目录

| 路径 | 作用 |
| --- | --- |
| .env | 本地开发环境变量（敏感信息，不应提交）。 |
| .env.example | 环境变量示例模板。 |
| .gitignore | Git 忽略规则。 |
| .key | 项目本地密钥文件（应避免入库敏感值）。 |
| assets/ | 自定义资源目录（字体等）。 |
| database_design.md | 数据库设计文档（概念层说明）。 |
| DIRECTORY.md | 当前目录说明文档。 |
| env.txt | 当前环境变量快照/记录文件。 |
| er_diagram.mmd | Mermaid 版 ER 图源文件。 |
| er_diagram.svg | ER 图导出文件。 |
| eslint.config.mjs | ESLint 规则配置。 |
| middleware.ts | Next.js 中间件入口（请求拦截、路由保护等）。 |
| netlify.toml | Netlify 构建与插件配置。 |
| next-env.d.ts | Next.js 自动生成的 TS 类型声明。 |
| next.config.ts | Next.js 框架级配置。 |
| OPERATIONS.md | 运维手册。 |
| package-lock.json | npm 锁定文件。 |
| package.json | 项目依赖、脚本、元信息。 |
| postcss.config.mjs | PostCSS 配置（配合 Tailwind）。 |
| prisma/ | 数据模型与迁移目录。 |
| prisma.config.ts | Prisma 配置文件。 |
| public/ | 静态公开资源目录。 |
| README.md | 项目总体说明。 |
| src/ | 业务源码目录。 |
| tsconfig.json | TypeScript 编译配置。 |

## 2. 数据库结构（重点）

数据库采用 Prisma + PostgreSQL（Neon）。核心定义在 prisma/schema.prisma，迁移历史在 prisma/migrations。

### 2.1 数据库目录结构

| 路径 | 作用 |
| --- | --- |
| prisma/schema.prisma | 所有模型、枚举、关系、索引与约束定义。 |
| prisma/migrations/migration_lock.toml | Prisma 迁移锁文件。 |
| prisma/migrations/20260304034616_init/migration.sql | 初始化数据库结构。 |
| prisma/migrations/20260305090000_admin_trusted_device/migration.sql | 管理员受信设备相关结构变更。 |
| prisma/migrations/20260305101500_add_site_setting/migration.sql | 站点设置表相关变更。 |
| prisma/migrations/20260305113000_audit_log_context/migration.sql | 审计日志上下文字段相关变更。 |
| prisma/migrations/20260305123000_add_match_is_quick_match/migration.sql | 比赛快速匹配标识字段变更。 |
| prisma/migrations/20260306063353_add_certificate_identity/migration.sql | 证书与身份校验相关结构变更。 |
| prisma/migrations/20260307093000_add_doubles_tables/migration.sql | 双打队伍/邀请相关表结构变更。 |

### 2.2 Schema 业务域划分

| 业务域 | 主要模型 | 作用 |
| --- | --- | --- |
| 用户与权限 | User, UserIdentity, AdminTrustedDevice | 用户基础档案、身份哈希、管理端受信设备。 |
| 赛事主流程 | Match, Registration, MatchResult | 赛事创建、报名、战绩上报与确认。 |
| 双打扩展 | MatchDoublesTeam, MatchDoublesTeamMember, MatchDoublesInvite | 双打组队、队员槽位、邀请状态流。 |
| 评分体系 | EloHistory | ELO 前后值与增量追踪。 |
| 积分商城 | PointsTransaction, Reward, RewardRedemption | 积分流水、奖励定义、兑换记录。 |
| 勋章与评价 | Badge, UserBadge, Review | 徽章授予与赛后互评。 |
| 审计与缓存 | AuditLog, LeaderboardCache, RankingSnapshot | 操作审计、排行榜缓存、快照数据。 |
| 全局站点控制 | SiteSetting | 站点开关等系统级状态。 |

## 3. src 目录（重点，文件级）

### 3.1 src/app（路由与页面）

| 路径 | 作用 |
| --- | --- |
| src/app/favicon.ico | 站点图标。 |
| src/app/globals.css | 全局样式入口。 |
| src/app/layout.tsx | 根布局（全站共享结构）。 |
| src/app/page.tsx | 首页页面。 |
| src/app/admin/actions.ts | 管理后台 Server Actions。 |
| src/app/admin/AdminDashboardClient.tsx | 管理后台客户端交互主组件。 |
| src/app/admin/page.tsx | 管理后台页面入口。 |
| src/app/api/csrf-token/route.ts | CSRF token 获取接口。 |
| src/app/api/matchs/[id]/certificate/route.ts | 赛事证书导出/生成接口。 |
| src/app/api/site-status/route.ts | 站点状态查询接口（开站/关站）。 |
| src/app/auth/actions.ts | 认证相关 Server Actions。 |
| src/app/auth/page.tsx | 登录/认证入口页。 |
| src/app/auth/reset-password/page.tsx | 重置密码页面。 |
| src/app/auth/verify/page.tsx | 认证校验页面（如邮箱验证）。 |
| src/app/closed/page.tsx | 站点关闭时展示页面。 |
| src/app/matchs/actions.ts | 比赛相关 Server Actions。 |
| src/app/matchs/page.tsx | 比赛列表页。 |
| src/app/matchs/create/page.tsx | 创建比赛页面。 |
| src/app/matchs/[id]/page.tsx | 比赛详情页。 |
| src/app/matchs/[id]/edit/page.tsx | 比赛编辑页。 |
| src/app/matchs/[id]/grouping/page.tsx | 分组/对阵编排页。 |
| src/app/profile/actions.ts | 个人中心相关 Server Actions。 |
| src/app/profile/page.tsx | 当前用户资料页。 |
| src/app/profile/edit/page.tsx | 编辑资料页。 |
| src/app/profile/[id]/page.tsx | 他人资料页。 |
| src/app/quick-match/actions.ts | 快速匹配相关 Server Actions。 |
| src/app/quick-match/page.tsx | 快速匹配页面。 |
| src/app/rankings/page.tsx | 排行榜页面。 |
| src/app/team-invites/actions.ts | 组队邀请相关 Server Actions。 |
| src/app/team-invites/page.tsx | 组队邀请页面。 |

### 3.2 src/components（组件层）

| 路径 | 作用 |
| --- | --- |
| src/components/auth/AuthForms.tsx | 登录/注册表单组件。 |
| src/components/auth/ProfileEditorForm.tsx | 资料编辑表单。 |
| src/components/auth/ProfileOverview.tsx | 资料概览卡片。 |
| src/components/auth/ResetPasswordForm.tsx | 重置密码表单。 |
| src/components/home/EloTrendChart.tsx | ELO 趋势图组件。 |
| src/components/layout/AdminModeToggle.tsx | 管理模式切换组件。 |
| src/components/layout/Footer.tsx | 页脚组件。 |
| src/components/layout/Header.tsx | 页头组件。 |
| src/components/layout/Sidebar.tsx | 侧边栏组件。 |
| src/components/match/AdminResultEntryForm.tsx | 管理员录入赛果表单。 |
| src/components/match/CreateMatchForm.tsx | 创建比赛表单。 |
| src/components/match/EditMatchForm.tsx | 编辑比赛表单。 |
| src/components/match/GroupingAdminPanel.tsx | 分组管理面板。 |
| src/components/match/KnockoutBracket.tsx | 淘汰赛对阵图。 |
| src/components/match/MatchCard.tsx | 比赛卡片。 |
| src/components/match/MatchSettingsForm.tsx | 比赛配置表单。 |
| src/components/match/RegisterMatchButton.tsx | 报名按钮组件。 |
| src/components/match/ReportResultForm.tsx | 上报赛果表单。 |
| src/components/match/UnregisterMatchButton.tsx | 取消报名按钮。 |
| src/components/match/detail/AdminResultsSection.tsx | 详情页管理赛果区块。 |
| src/components/match/detail/ExportCertificateSection.tsx | 证书导出区块。 |
| src/components/match/detail/GroupingResultSection.tsx | 分组结果区块。 |
| src/components/match/detail/GroupsOverviewSection.tsx | 小组总览区块。 |
| src/components/match/detail/MyProgressSection.tsx | 个人进度区块。 |
| src/components/match/detail/RegisteredPlayersSection.tsx | 报名名单区块。 |
| src/components/navigation/BackLinkButton.tsx | 返回链接按钮。 |
| src/components/quick-match/QuickMatchPanel.tsx | 快速匹配面板。 |
| src/components/security/CsrfFormInjector.tsx | 表单 CSRF 注入器。 |
| src/components/ui/calendar.tsx | 日历基础 UI。 |
| src/components/ui/popover.tsx | Popover 基础 UI。 |

### 3.3 src/lib（业务与基础设施）

| 路径 | 作用 |
| --- | --- |
| src/lib/audit-log.ts | 审计日志写入与结构封装。 |
| src/lib/auth.ts | 鉴权入口与认证辅助逻辑。 |
| src/lib/azure-email.ts | Azure 邮件发送封装。 |
| src/lib/certificate.ts | 参赛证书生成/编号/导出相关逻辑。 |
| src/lib/club-id.ts | 俱乐部标识或编号生成规则。 |
| src/lib/csrf-constants.ts | CSRF 相关常量。 |
| src/lib/csrf.ts | CSRF 校验与 token 处理。 |
| src/lib/doubles.ts | 双打组队与邀请核心逻辑。 |
| src/lib/elo.ts | ELO 计算与更新规则。 |
| src/lib/match-detail-page.ts | 比赛详情页数据聚合。 |
| src/lib/match-detail.ts | 比赛详情类型/转换辅助。 |
| src/lib/match-status.ts | 比赛状态判定与展示辅助。 |
| src/lib/password.ts | 密码哈希与校验逻辑。 |
| src/lib/prisma.ts | Prisma Client 单例与连接复用。 |
| src/lib/rate-limit.ts | 接口限流策略与校验。 |
| src/lib/session.ts | Session 读写与上下文处理。 |
| src/lib/tournament.ts | 赛程、分组、淘汰规则算法。 |
| src/lib/utils.ts | 通用工具函数。 |

### 3.4 src/types（类型层）

| 路径 | 作用 |
| --- | --- |
| src/types/match.ts | 比赛领域共享类型定义。 |

## 4. public 与 assets

| 路径 | 作用 |
| --- | --- |
| public/robots.txt | 爬虫访问策略。 |
| public/SVG/乒协徽章.svg | 协会徽章 SVG 资源。 |
| public/SVG/乒协文字.svg | 协会文字标识 SVG 资源。 |
| assets/fonts/NotoSansSC-Regular.ttf | 中文字体资源。 |

## 5. /config 目录说明（当前不存在）

当前仓库无 config 目录。若后续要增强配置治理，建议新增 config 并拆分：

| 建议路径 | 建议用途 |
| --- | --- |
| config/app.ts | 应用级配置（名称、URL、开关）。 |
| config/auth.ts | 鉴权策略与密码策略。 |
| config/security.ts | CSRF、限流、安全阈值。 |
| config/storage.ts | 文件存储/CDN 配置。 |
| config/mail.ts | 邮件服务配置。 |
| config/validate.ts | 环境变量集中校验（zod）。 |