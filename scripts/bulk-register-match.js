#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */

/**
 * 批量为指定比赛补足报名人数（默认标题：测试2，默认总人数：128）
 *
 * 用法：
 *   MATCH_TITLE="测试2" TARGET_COUNT=128 node scripts/bulk-register-match.js
 *   MATCH_ID="cmatch_xxx" TARGET_COUNT=128 node scripts/bulk-register-match.js
 *   DRY_RUN=1 MATCH_TITLE="测试2" TARGET_COUNT=128 node scripts/bulk-register-match.js
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const TARGET_COUNT = Number.parseInt(process.env.TARGET_COUNT || '128', 10)
const MATCH_TITLE = process.env.MATCH_TITLE || '测试2'
const MATCH_ID = process.env.MATCH_ID || ''
const DRY_RUN = process.env.DRY_RUN === '1'

function pad(num, size = 3) {
  return String(num).padStart(size, '0')
}

async function main() {
  if (!Number.isFinite(TARGET_COUNT) || TARGET_COUNT < 1) {
    throw new Error('TARGET_COUNT 必须是正整数')
  }

  const match = MATCH_ID
    ? await prisma.match.findUnique({
        where: { id: MATCH_ID },
        include: { registrations: true },
      })
    : await prisma.match.findFirst({
        where: { title: MATCH_TITLE },
        include: { registrations: true },
        orderBy: { createdAt: 'desc' },
      })

  if (!match) {
    throw new Error(MATCH_ID ? `未找到比赛 ID=${MATCH_ID}` : `未找到标题为「${MATCH_TITLE}」的比赛`)
  }

  const current = match.registrations.length
  if (current >= TARGET_COUNT) {
    console.log(`比赛「${match.title}」当前已报名 ${current} 人，已达到/超过目标 ${TARGET_COUNT} 人，无需处理。`)
    return
  }

  const need = TARGET_COUNT - current

  // 若比赛容量不足，自动扩容（仅测试用途）
  if (match.maxParticipants < TARGET_COUNT) {
    console.log(`比赛 maxParticipants=${match.maxParticipants} < 目标人数=${TARGET_COUNT}，将自动扩容。`)
    if (!DRY_RUN) {
      await prisma.match.update({
        where: { id: match.id },
        data: { maxParticipants: TARGET_COUNT },
      })
    }
  }

  // 生成候选测试用户（邮箱唯一，满足平台邮箱后缀限制）
  const candidates = []
  for (let i = 1; i <= TARGET_COUNT * 3; i += 1) {
    const label = pad(i, 4)
    candidates.push({
      email: `bulk_test_${label}@mail.ustc.edu.cn`,
      nickname: `测试用户${label}`,
      bio: '自动化压力测试账号',
      emailVerifiedAt: new Date(),
    })
  }

  console.log(`准备为比赛「${match.title}」补充报名：当前 ${current}，目标 ${TARGET_COUNT}，需新增 ${need} 人。`)

  if (DRY_RUN) {
    console.log('[DRY_RUN] 仅预览，不会写入数据库。')
    return
  }

  // 先批量创建用户（重复邮箱会被 skip）
  await prisma.user.createMany({
    data: candidates,
    skipDuplicates: true,
  })

  const users = await prisma.user.findMany({
    where: {
      email: {
        in: candidates.map((u) => u.email),
      },
    },
    select: { id: true, email: true },
  })

  const existingUserIds = new Set(match.registrations.map((r) => r.userId))
  const toRegister = []

  for (const user of users) {
    if (!existingUserIds.has(user.id)) {
      toRegister.push({
        matchId: match.id,
        userId: user.id,
      })
    }
    if (toRegister.length >= need) break
  }

  if (toRegister.length < need) {
    throw new Error(`可用于报名的新用户不足：需要 ${need}，实际可用 ${toRegister.length}`)
  }

  await prisma.registration.createMany({
    data: toRegister,
    skipDuplicates: true,
  })

  const finalCount = await prisma.registration.count({
    where: { matchId: match.id },
  })

  console.log(`完成：比赛「${match.title}」报名人数 ${current} -> ${finalCount}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
