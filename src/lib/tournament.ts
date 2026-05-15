import { CompetitionFormat } from '@prisma/client'

export type SeedPlayer = {
  id: string
  nickname: string
  eloRating: number
  points: number
}

export type GroupSeedMethod = 'min_diff' | 'snake'

type BracketMatch = {
  id: string
  homeLabel: string
  awayLabel: string
}

type BracketRound = {
  name: string
  matches: BracketMatch[]
}

type QualifierSlot = {
  groupIndex: number
  rank: number
}

type GroupingPayload = {
  generatedAt: string
  format: CompetitionFormat
  config: {
    groupCount: number
    qualifiersPerGroup?: number
    seedMethod?: GroupSeedMethod
  }
  tableAssignments?: {
    group?: Record<string, string[]>
    knockout?: Record<string, string[]>
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

function distributeByMinSpread(players: SeedPlayer[], groupCount: number) {
  const total = players.length
  const baseSize = Math.floor(total / groupCount)
  const remainder = total % groupCount
  const targetSizes = Array.from({ length: groupCount }, (_, index) =>
    index < remainder ? baseSize + 1 : baseSize,
  )

  const groups: SeedPlayer[][] = Array.from({ length: groupCount }, () => [])
  let startIndex = 0

  targetSizes.forEach((size, index) => {
    groups[index] = players.slice(startIndex, startIndex + size)
    startIndex += size
  })

  return groups
}

function averageElo(players: SeedPlayer[]) {
  if (players.length === 0) return 0
  return Math.round(players.reduce((sum, p) => sum + p.eloRating, 0) / players.length)
}

function isPowerOfTwo(value: number) {
  return value > 0 && (value & (value - 1)) === 0
}

function getRoundNameBySize(size: number) {
  return size === 2 ? '决赛' : size === 4 ? '半决赛' : size === 8 ? '1/4 决赛' : '淘汰赛首轮'
}

function buildBracketRounds(firstRoundMatches: BracketMatch[], bracketSize: number): BracketRound[] {
  const rounds: BracketRound[] = []

  let currentRoundMatches = firstRoundMatches

  rounds.push({
    name: getRoundNameBySize(bracketSize),
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

function buildSeedPlacementOrder(size: number): number[] {
  if (size <= 1) return [1]

  const previous = buildSeedPlacementOrder(size / 2)
  return previous.flatMap((seed) => [seed, size + 1 - seed])
}

function buildLabel(group: { name: string }, rank: number) {
  return `${group.name}第 ${rank} 名`
}

function buildMatch(
  id: string,
  home: QualifierSlot,
  away: QualifierSlot,
  groups: Array<{ name: string }>,
) {
  return {
    id,
    homeLabel: buildLabel(groups[home.groupIndex], home.rank),
    awayLabel: buildLabel(groups[away.groupIndex], away.rank),
  }
}

function buildFirstRoundMatches(
  groups: Array<{ name: string }>,
  qualifiersPerGroup: number,
): BracketMatch[] {
  const groupCount = groups.length
  const bracketSize = groupCount * qualifiersPerGroup
  const seedPlacementOrder = buildSeedPlacementOrder(bracketSize)
  const seedPosition = new Map(seedPlacementOrder.map((seed, index) => [seed, index]))

  // Keep strong group winners apart first, then spread the same group's lower-ranked
  // qualifiers across bracket regions so they do not collide too early.
  const regionCount = Math.min(qualifiersPerGroup, bracketSize)
  const regionSize = bracketSize / regionCount
  const rankRegionOffsets = buildSeedPlacementOrder(regionCount).map((seed) => seed - 1)
  const seedToQualifier = new Map<number, QualifierSlot>()

  const getSeedRegion = (seed: number) => {
    const position = seedPosition.get(seed) ?? 0
    return Math.floor(position / regionSize)
  }

  const baseRegions = Array.from({ length: groupCount }, (_, groupIndex) =>
    getSeedRegion(groupIndex + 1),
  )

  for (let rank = 1; rank <= qualifiersPerGroup; rank += 1) {
    if (rank === 1) {
      groups.forEach((_, groupIndex) => {
        seedToQualifier.set(groupIndex + 1, { groupIndex, rank })
      })
      continue
    }

    const firstSeedInRank = (rank - 1) * groupCount + 1
    const unusedSeeds = new Set(
      Array.from({ length: groupCount }, (_, index) => firstSeedInRank + index),
    )

    for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
      const desiredRegion =
        (baseRegions[groupIndex] + rankRegionOffsets[rank - 1]) % regionCount
      const candidates = [...unusedSeeds]
        .map((seed) => {
          const seedOffset = seed - firstSeedInRank
          const region = getSeedRegion(seed)
          const regionDistance = Math.min(
            Math.abs(region - desiredRegion),
            regionCount - Math.abs(region - desiredRegion),
          )

          return {
            seed,
            score: regionDistance * groupCount * 2 + Math.abs(seedOffset - groupIndex),
          }
        })
        .sort((a, b) => a.score - b.score || a.seed - b.seed)

      const selectedSeed = candidates[0]?.seed
      if (!selectedSeed) continue

      unusedSeeds.delete(selectedSeed)
      seedToQualifier.set(selectedSeed, { groupIndex, rank })
    }
  }

  const slots = seedPlacementOrder.map((seed) => seedToQualifier.get(seed))

  return Array.from({ length: bracketSize / 2 }, (_, index) => {
    const home = slots[index * 2]
    const away = slots[index * 2 + 1]

    if (!home || !away) {
      throw new Error('淘汰赛签位生成失败。')
    }

    return buildMatch(`R1-M${index + 1}`, home, away, groups)
  })
}

export function generateGroupingPayload(
  format: CompetitionFormat,
  participants: SeedPlayer[],
  config: { groupCount: number; qualifiersPerGroup?: number; seedMethod?: GroupSeedMethod },
): GroupingPayload {
  const sorted = [...participants].sort((a, b) => b.eloRating - a.eloRating || b.points - a.points)
  const total = sorted.length

  if (config.groupCount < 1 || config.groupCount > total) {
    throw new Error('组数不合法。')
  }

  const seedMethod = config.seedMethod ?? 'min_diff'
  const groupPlayers =
    seedMethod === 'snake'
      ? snakeDistribute(sorted, config.groupCount)
      : distributeByMinSpread(sorted, config.groupCount)

  const groups = groupPlayers.map((players, index) => ({
    name: `第 ${index + 1} 组`,
    players,
    averagePoints: averageElo(players),
  }))

  const payload: GroupingPayload = {
    generatedAt: new Date().toISOString(),
    format,
    config: {
      ...config,
      seedMethod,
    },
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

    const firstRoundMatches = buildFirstRoundMatches(groups, qualifiersPerGroup)

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
      rounds: buildBracketRounds(firstRoundMatches, totalQualified),
    }
  }

  return payload
}
