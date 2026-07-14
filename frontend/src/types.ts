export type IfcTypeName = 'IfcBeam' | 'IfcSlab' | 'IfcStair' | 'IfcWall'

export const TARGET_TYPES: IfcTypeName[] = ['IfcBeam', 'IfcSlab', 'IfcStair', 'IfcWall']

export const TYPE_LABEL: Record<string, string> = {
  IfcBeam: 'Belka',
  IfcSlab: 'Strop',
  IfcStair: 'Schody',
  IfcWall: 'Ściana',
  IfcBuildingElementProxy: 'Proxy (nieokreślony)',
  IfcStairFlight: 'Bieg schodowy',
  IfcWallStandardCase: 'Ściana',
}

export const TYPE_ABBR: Record<string, string> = {
  IfcBeam: 'BM',
  IfcSlab: 'SL',
  IfcStair: 'ST',
  IfcWall: 'WA',
  IfcBuildingElementProxy: '??',
  IfcStairFlight: 'ST',
  IfcWallStandardCase: 'WA',
}

export interface ElementResult {
  expressId: number
  guid: string
  name: string
  currentType: string
  suggestedType: IfcTypeName
  mismatch: boolean
  confidence: number
  probabilities: Record<string, number>
}

export interface ClassifyResponse {
  fileName: string
  candidateCount: number
  failedCount: number
  mismatchCount: number
  elements: ElementResult[]
}

export type ReviewStatus = 'pending' | 'accepted' | 'rejected'

export interface ReviewState {
  status: ReviewStatus
  manualType?: IfcTypeName
  savedManual?: boolean
}

export type ViewMode = '3d' | 'list' | 'dashboard'
