export enum LegKind {
  RHUMB = 'RHUMB',
  GREAT_CIRCLE = 'GREAT_CIRCLE',
}

export interface Route {
  id: string
  name: string
  waypointIds: string[]
  legKind: LegKind
}

export function nextLegKind(legKind: LegKind) {
  if (legKind === LegKind.RHUMB) {
    return LegKind.GREAT_CIRCLE
  }
  return LegKind.RHUMB
}
