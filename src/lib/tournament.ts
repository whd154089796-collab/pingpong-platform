import { CompetitionFormat } from '@prisma/client'

export type SeedPlayer = {
  id: string
  nickname: string
  eloRating: number
  points: number
}

type GroupingPayload = {
  generatedAt: string
  format: CompetitionFormat
  groups: Array<{
    name: string
    players: SeedPlayer[]
    averagePoints: number
  }>
  knockout?: {
    stage: string
    matches: Array<{
      slot: number
      homeSeed: number
      awaySeed: number
      homePlayer?: SeedPlayer
      awayPlayer?: SeedPlayer
    }>
  }
}

function snakeDistribute(players: SeedPlayer[], groupCount: number) {
  const groups: SeedPlayer[][] = Array.from({ length: groupCount }, () => [])
  players.forEach((player, index) => {
    const round = Math.floor(index / groupCount)
    const offset = index % groupCount
    const targetIndex = round % 2 === 0 ? offset : groupCount - 1 - offset
    groups[targetIndex].push(player)
  })
  return groups
}

function averagePoints(players: SeedPlayer[]) {
  if (players.length === 0) return 0
  return Math.round(players.reduce((sum, p) => sum + p.points, 0) / players.length)
}

function nearestPowerOf2(value: number) {
  let p = 1
  while (p * 2 <= value) p *= 2
  return p
}

export function generateGroupingPayload(format: CompetitionFormat, participants: SeedPlayer[]): GroupingPayload {
  const sorted = [...participants].sort((a, b) => b.points - a.points || b.eloRating - a.eloRating)
  const total = sorted.length

  const idealGroupSize = format === 'group_then_knockout' ? 4 : 6
  const groupCount = Math.max(1, Math.min(16, Math.ceil(total / idealGroupSize)))
  const groupPlayers = snakeDistribute(sorted, groupCount)

  const groups = groupPlayers.map((players, index) => ({
    name: `第 ${index + 1} 组`,
    players,
    averagePoints: averagePoints(players),
  }))

  const payload: GroupingPayload = {
    generatedAt: new Date().toISOString(),
    format,
    groups,
  }

  if (format === 'group_then_knockout') {
    const qualifiedPerGroup = 2
    const qualified = groups.flatMap((group) => group.players.slice(0, qualifiedPerGroup))
    const bracketSize = nearestPowerOf2(Math.min(64, qualified.length))
    const seeded = qualified.slice(0, bracketSize)

    const pairs = Array.from({ length: Math.floor(bracketSize / 2) }, (_, i) => {
      const homeSeed = i + 1
      const awaySeed = bracketSize - i
      return {
        slot: i + 1,
        homeSeed,
        awaySeed,
        homePlayer: seeded[homeSeed - 1],
        awayPlayer: seeded[awaySeed - 1],
      }
    })

    payload.knockout = {
      stage: bracketSize <= 2 ? '决赛' : bracketSize <= 4 ? '半决赛' : bracketSize <= 8 ? '1/4 决赛' : '淘汰赛首轮',
      matches: pairs,
    }
  }

  return payload
}
