import { Position } from './position'

export interface Waypoint {
  id: string
  name: string
  position: Position
  description: string
  createdAt: string
}
