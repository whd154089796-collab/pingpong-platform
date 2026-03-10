This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Database (Prisma + Neon)

This project now includes a Prisma schema for the ping-pong platform domain (users, matches, registrations, results, ELO history, points ledger, rewards/redemptions, badges, reviews, audit logs, and ranking cache tables).

1. Create a Neon project and copy its Postgres connection strings.
2. Add environment variables:

```bash
DATABASE_URL="postgresql://<user>:<password>@<neon-host>/<db>?sslmode=require"
DIRECT_URL="postgresql://<user>:<password>@<neon-host>/<db>?sslmode=require"
APP_URL="https://kedappclub.xyz"
NEXT_PUBLIC_APP_URL="https://kedappclub.xyz"
```

3. Generate Prisma client and run migration:

```bash
npm run prisma:generate
npm run prisma:migrate
```

Prisma schema location: `prisma/schema.prisma`.
Prisma client singleton: `src/lib/prisma.ts`.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

cd /www/wwwroot/pingpongclub

# 1. 拉取 GitHub 上的最新代码

git pull origin master

# 2. 如果你修改了 .env（比如新加了 AZURE_COMMUNICATION_CONNECTION_STRING），请手动更新服务器的 .env

# nano .env (确认里面有新的 KEY 后 Ctrl+O 保存，Ctrl+X 退出)

# 3. 重新安装依赖（如果你新装了 Azure 邮件 SDK 包）

npm install
npx prisma migrate deploy

# 4. 重新编译（这一步最耗时，也是生效的关键）

npm run build

# 5. 重启 PM2 进程并更新环境变量

pm2 restart kedapp --update-env

pm2 start npm --name "kedapp" -- run start

pm2 stop kedapp

pm2 start kedapp

建议不要用neon插件，会在你VScode环境里注入环境变量，导致你怎么修改.env文件都没有用。笔者曾经修改几个小时才发现是插件问题

用set DATABASE_URL检查目前环境，可以对比系统CMD和VScode的（我就是这样找出来VScode插件问题的）
