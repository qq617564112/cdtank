/** Rebuilt authority API; original slot1..7 corresponds to battle keys2..8. */
export interface ReqKitbag {operation: 'ASSIGN' | 'CANCEL'; slot: number; instanceId?: number;}
export interface ResKitbag {result: number; slot: number; instanceId: number; hotkeys: number[];}
