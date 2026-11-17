export type MatchMode = '1v1' | 'group' | 'private'
export type GameModel = 'instruction' | 'freeplay'
export type MediaPreference = 'video' | 'audio' | 'text'

export type Phase =
  | 'lobby'
  | 'searching'
  | 'connecting'
  | 'mission'
  | 'active'
  | 'reconnecting'
  | 'partner-left'
  | 'ended'

export type TileState =
  | 'idle'
  | 'waiting'
  | 'searching'
  | 'connecting'
  | 'live'
  | 'audio'
  | 'text'
  | 'reconnecting'
  | 'left'
  | 'ended'

export type MissionType =
  | 'Role-play'
  | 'Diskusi'
  | 'Debat'
  | 'Bercerita'
  | 'Pemecahan masalah'
  | 'Tanya jawab'

export interface Mission {
  type: MissionType
  title: string
  topic: string
  objective: string
  instructions: string[]
  talkingPoints: string[]
}

export interface Participant {
  uid: string
  name: string
  level: number
  isDemo?: boolean
}

export interface ChatMessage {
  id: string
  author: 'me' | 'partner'
  authorName: string
  body: string
  at: number
}

export const SESSION_LIMIT_SECONDS = 300

export const MATCH_MODE_LABEL: Record<MatchMode, string> = {
  '1v1': 'Random 1v1',
  group: 'Random Group',
  private: 'Private Room',
}

export const GAME_MODEL_LABEL: Record<GameModel, string> = {
  instruction: 'Instruction Mode',
  freeplay: 'Free Play Mode',
}

export const MEDIA_LABEL: Record<MediaPreference, string> = {
  video: 'Video + Audio',
  audio: 'Audio Saja',
  text: 'Teks',
}
