import type {DatabaseSync} from 'node:sqlite';
import type {GmSupportReply, ResGmSupport} from '../../../shared/protocols/PtlGmSupport';

export interface GmSupportQuestion {
  id: number;
  accountId: string;
  roomId: string;
  playerId: string;
  text: string;
  createdAt: number;
}

const PAGE_SIZE = 50;
const TEXT_LIMIT = 72;

/** Durable final GM replies kept beside the existing question-submission table. */
export class GmSupportStore {
  constructor(private readonly database: DatabaseSync) {
    database.exec(`CREATE TABLE IF NOT EXISTS gm_replies (
      id INTEGER PRIMARY KEY,
      request_id INTEGER NOT NULL UNIQUE,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL)`);
  }

  replies(accountId: string, afterId = 0): ResGmSupport {
    if (!Number.isSafeInteger(afterId) || afterId < 0) throw new Error('回复游标无效');
    const rows = this.database.prepare(`SELECT r.id, r.request_id, q.text AS question,
      q.created_at AS requested_at, r.text AS text, r.created_at AS replied_at
      FROM gm_replies r JOIN gm_requests q ON q.id = r.request_id
      WHERE q.account_id = ? AND r.id > ? ORDER BY r.id ASC LIMIT ?`)
      .all(accountId, afterId, PAGE_SIZE + 1);
    const page = rows.slice(0, PAGE_SIZE);
    const replies: GmSupportReply[] = page.map(row => ({
      id: Number(row.id),
      requestId: Number(row.request_id),
      question: String(row.question),
      requestedAt: Number(row.requested_at),
      text: String(row.text),
      repliedAt: Number(row.replied_at),
    }));
    return {
      accountId,
      replies,
      nextAfterId: replies.length ? replies[replies.length - 1].id : afterId,
      hasMore: rows.length > PAGE_SIZE,
    };
  }

  unreplied(afterId = 0): GmSupportQuestion[] {
    if (!Number.isSafeInteger(afterId) || afterId < 0) throw new Error('问题游标无效');
    return this.database.prepare(`SELECT q.id, q.account_id, q.room_id, q.player_id,
      q.text, q.created_at FROM gm_requests q LEFT JOIN gm_replies r ON r.request_id = q.id
      WHERE r.id IS NULL AND q.id > ? ORDER BY q.id ASC LIMIT ?`)
      .all(afterId, PAGE_SIZE).map(row => ({
        id: Number(row.id),
        accountId: String(row.account_id),
        roomId: String(row.room_id),
        playerId: String(row.player_id),
        text: String(row.text),
        createdAt: Number(row.created_at),
      }));
  }

  reply(requestId: number, text: string): GmSupportReply {
    const trimmed = validateReplyText(text);
    if (!Number.isSafeInteger(requestId) || requestId <= 0) throw new Error('问题ID无效');
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const question = this.database.prepare('SELECT text, created_at FROM gm_requests WHERE id = ?')
        .get(requestId);
      if (!question) throw new Error('问题不存在');
      const existing = this.database.prepare(
        'SELECT id, text, created_at FROM gm_replies WHERE request_id = ?').get(requestId);
      if (existing) {
        if (String(existing.text) !== trimmed) throw new Error('该问题已有不同回复');
        this.database.exec('COMMIT');
        return {
          id: Number(existing.id),
          requestId,
          question: String(question.text),
          requestedAt: Number(question.created_at),
          text: String(existing.text),
          repliedAt: Number(existing.created_at),
        };
      }
      const createdAt = Date.now();
      const inserted = this.database.prepare(
        'INSERT INTO gm_replies (request_id, text, created_at) VALUES (?, ?, ?)')
        .run(requestId, trimmed, createdAt);
      this.database.exec('COMMIT');
      return {
        id: Number(inserted.lastInsertRowid),
        requestId,
        question: String(question.text),
        requestedAt: Number(question.created_at),
        text: trimmed,
        repliedAt: createdAt,
      };
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
}

function validateReplyText(text: string): string {
  if (typeof text !== 'string' || text.length < 1 || text.length > TEXT_LIMIT
      || /[\u0000-\u001f\u007f]/.test(text) || !text.trim()) {
    throw new Error('回复应为1至72字符的有效文本');
  }
  return text.trim();
}
