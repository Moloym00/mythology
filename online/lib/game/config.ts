// V1.2 的人数配置与计分入口。调整前先同步纸面规则及回归用例。
export const RULES = {
  version: '1.2',
  minPlayers: 3,
  maxPlayers: 6,
  startingHand: 4,
  mind: { min: 2, max: 5 },
  points: { awake: 5, rested: 3, usedLegacy: 2, vigil: 2 },
  setups: {
    3: { gods: 9, storms: [3, 3, 3], vigil: 2 },
    4: { gods: 12, storms: [3, 4, 4], vigil: 2 },
    5: { gods: 12, storms: [3, 3, 4], vigil: 3 },
    6: { gods: 12, storms: [3, 3, 4], vigil: 3 },
  },
} as const;
