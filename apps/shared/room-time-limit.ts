export const ROOM_TIME_LIMIT_MIN_SECONDS = 60;
export const ROOM_TIME_LIMIT_MAX_SECONDS = 3600;
export const ROOM_TIME_LIMIT_STEP_SECONDS = 60;

export function validateRoomTimeLimit(timeLimitSeconds: number | undefined): void {
  if (timeLimitSeconds === undefined) return;
  if (!Number.isInteger(timeLimitSeconds)
      || timeLimitSeconds < ROOM_TIME_LIMIT_MIN_SECONDS
      || timeLimitSeconds > ROOM_TIME_LIMIT_MAX_SECONDS) {
    throw new Error('对局时间须为 1～60 分钟之间的整秒数');
  }
}
