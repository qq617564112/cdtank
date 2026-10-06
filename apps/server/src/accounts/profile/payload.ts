/** Original player profile payload; string object storage is represented independently. */
export interface RoleProfilePayload {
  bytes: Uint8Array;
  strings: [string, string];
}

