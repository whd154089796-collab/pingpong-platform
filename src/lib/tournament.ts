import { CompetitionFormat } from '@prisma/client'

export type SeedPlayer = {
  id: string
  nickname: string
  eloRating: number
  points: number
}

type BracketMatch = {
  id: string
  homeLabel: string
  awayLabel: string
}

type BracketRound = {
  name: string
  matches: BracketMatch[]
}

type GroupingPayload = {
  generatedAt: string
  format: CompetitionFormat
  config: {
    groupCount: number
    qualifiersPerGroup?: number
  }
  groups: Array<{
    name: string
    players: SeedPlayer[]
    averagePoints: number
  }>
  knockout?: {
    stage: string
    bracketSize: number
    rounds: BracketRound[]
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

function isPowerOfTwo(value: number) {
  return value > 0 && (value & (value - 1)) === 0
}

function buildBracketRounds(qualifiedLabels: string[]): BracketRound[] {
  const size = qualifiedLabels.length
  const rounds: BracketRound[] = []

  let currentRoundMatches = Array.from({ length: size / 2 }, (_, i) => {
    const seedA = i + 1
    const seedB = size - i
    return {
      id: `R1-M${i + 1}`,
      homeLabel: qualifiedLabels[seedA - 1],
      awayLabel: qualifiedLabels[seedB - 1],
    }
  })

  rounds.push({
    name: size === 2 ? '决赛' : size === 4 ? '半决赛' : size === 8 ? '1/4 决赛' : '淘汰赛首轮',
    matches: currentRoundMatches,
  })

  let roundIndex = 2
  while (currentRoundMatches.length > 1) {
    const nextMatches = Array.from({ length: currentRoundMatches.length / 2 }, (_, i) => ({
      id: `R${roundIndex}-M${i + 1}`,
      homeLabel: `胜者 ${currentRoundMatches[i * 2].id}`,
      awayLabel: `胜者 ${currentRoundMatches[i * 2 + 1].id}`,
    }))

    rounds.push({
      name: nextMatches.length === 1 ? '决赛' : nextMatches.length === 2 ? '半决赛' : `${nextMatches.length * 2} 强赛`,
      matches: nextMatches,
    })

    currentRoundMatches = nextMatches
    roundIndex += 1
  }

  return rounds
}

export function generateGroupingPayload(
  format: CompetitionFormat,
  participants: SeedPlayer[],
  config: { groupCount: number; qualifiersPerGroup?: number },
): GroupingPayload {
  const sorted = [...participants].sort((a, b) => b.points - a.points || b.eloRating - a.eloRating)
  const total = sorted.length

  if (config.groupCount < 1 || config.groupCount > total) {
    throw new Error('组数不合法。')
  }

  const groupPlayers = snakeDistribute(sorted, config.groupCount)

  const groups = groupPlayers.map((players, index) => ({
    name: `第 ${index + 1} 组`,
    players,
    averagePoints: averagePoints(players),
  }))

  const payload: GroupingPayload = {
    generatedAt: new Date().toISOString(),
    format,
    config,
    groups,
  }

  if (format === 'group_then_knockout') {
    const qualifiersPerGroup = config.qualifiersPerGroup ?? 1
    const totalQualified = qualifiersPerGroup * config.groupCount

    if (!isPowerOfTwo(totalQualified)) {
      throw new Error('组数×每组晋级人数必须为 2 的次幂。')
    }

    const hasEnoughPerGroup = groups.every((group) => group.players.length >= qualifiersPerGroup)
    if (!hasEnoughPerGroup) {
      throw new Error('存在小组人数小于设定晋级人数，请调小组数或晋级人数。')
    }

    const qualifiedLabels = groups.flatMap((group) =>
      Array.from({ length: qualifiersPerGroup }, (_, idx) => `${group.name}第 ${idx + 1} 名`),
    )

    payload.knockout = {
      stage:
        totalQualified <= 2
          ? '决赛'
          : totalQualified <= 4
            ? '半决赛'
            : totalQualified <= 8
              ? '1/4 决赛'
              : '淘汰赛首轮',
      bracketSize: totalQualified,
      rounds: buildBracketRounds(qualifiedLabels),
    }
  }

  return payload
}
