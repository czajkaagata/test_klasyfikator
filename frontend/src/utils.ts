const TYPE_COLOR: Record<string, string> = {
  IfcBeam: '#3b6ea5',
  IfcSlab: '#4b8f6b',
  IfcStair: '#b5651d',
  IfcWall: '#6b5b95',
}

export function typeColor(type: string): string {
  return TYPE_COLOR[type] ?? '#8a8a8a'
}

export function shortGuid(guid: string): string {
  return guid.length > 10 ? `${guid.slice(0, 6)}…${guid.slice(-4)}` : guid
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`
}
