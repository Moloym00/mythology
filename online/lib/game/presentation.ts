import type { GameView, PublicAction } from './engine';

// 只从已授权的视图取牌：寻忆池并不在玩家手牌中。
export function actionMemories(
  g: GameView,
  self: number,
  action: PublicAction,
) {
  const visible = [
    ...(g.pool ?? []),
    ...(g.players[self]?.hand ?? []),
    ...g.discard,
  ];
  return (action.cards ?? [])
    .map((id) => visible.find((c) => c.id === id))
    .filter((c) => c !== undefined);
}
export function choiceKey(g: GameView, self: number, action: PublicAction) {
  if (g.pool !== undefined && action.group === '寻忆') {
    const cards = actionMemories(g, self, action);
    if (cards.length === action.cards?.length)
      return `寻忆:${cards
        .map((c) => c.element)
        .sort()
        .join(',')}`;
  }
  return action.label;
}
