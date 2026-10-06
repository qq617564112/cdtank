import assert from 'node:assert/strict';
import {DEFAULT_QUICK_CHAT_PREFERENCES, QUICK_CHAT_KEYS, QUICK_CHAT_PREFERENCES_KEY,
  readQuickChatPreferences, validateQuickChatPreferences, writeQuickChatPreferences} from
  '../apps/web/src/interface/settings/quick-chat-preferences';

const defaults = {...DEFAULT_QUICK_CHAT_PREFERENCES};
assert.equal(QUICK_CHAT_KEYS.length, 8);
assert.ok(Object.values(defaults).every(text => text === ''));
let stored: string | null = null;
let writes = 0;
const storage = {
  getItem(key: string): string | null {assert.equal(key, QUICK_CHAT_PREFERENCES_KEY); return stored;},
  setItem(key: string, value: string): void {assert.equal(key, QUICK_CHAT_PREFERENCES_KEY); stored = value; writes++;},
};
assert.deepEqual(readQuickChatPreferences(storage), {preferences: defaults, storageAvailable: true});
const saved = {...defaults, F5: '一起出发', F12: '中'.repeat(72)};
assert.equal(writeQuickChatPreferences(storage, saved), true);
assert.deepEqual(readQuickChatPreferences(storage).preferences, saved);
assert.notEqual(validateQuickChatPreferences(saved), saved, 'validated preferences are copied');
for (const raw of ['{', 'null', '[]', 'true']) {
  stored = raw;
  assert.deepEqual(readQuickChatPreferences(storage).preferences, defaults);
}
const before = writes;
for (const bad of ['x'.repeat(73), 'a\nb', 'a\tb', '\u0000', '\u007f', 1, null]) {
  stored = JSON.stringify({...saved, F5: bad});
  assert.deepEqual(readQuickChatPreferences(storage).preferences, {...saved, F5: ''});
  assert.equal(validateQuickChatPreferences({...saved, F5: bad}), undefined);
  assert.equal(writeQuickChatPreferences(storage, {...saved, F5: bad} as typeof saved), false);
}
assert.equal(writes, before);
const unavailable = {
  getItem(): never {throw new Error('SecurityError');},
  setItem(): never {throw new Error('QuotaExceededError');},
};
assert.deepEqual(readQuickChatPreferences(unavailable), {preferences: defaults, storageAvailable: false});
assert.equal(writeQuickChatPreferences(unavailable, saved), false);

// Controller checks exercise acknowledgement and room ownership without a DOM shell.
import {BattleChat} from '../apps/web/src/interface/battle/battle-chat';
const flush = async (): Promise<void> => {await Promise.resolve(); await Promise.resolve(); await Promise.resolve();};
async function run(): Promise<void> {
  const requests: {text: string; channel: 0 | 1 | 2 | 3; targetName?: string; resolve(): void; reject(error: Error): void}[] = [];
  let releases = 0;
  const chat = new BattleChat((text, channel, targetName) => new Promise<void>((resolve, reject) => {
    requests.push({text, channel, targetName, resolve, reject});
  }), () => {releases++;});
  let notifications = 0;
  const unsubscribe = chat.subscribe(() => notifications++);
  assert.equal(chat.getSnapshot(), chat.getSnapshot(), 'snapshots remain stable until semantic changes');
  chat.setQuickChats(saved);
  saved.F5 = '外部修改';
  chat.sendQuickChat('F5');
  chat.sendDraft();
  assert.equal(requests.length, 0, 'hidden room cannot send');
  chat.show();
  chat.setDraft('一起出发');
  chat.sendQuickChat('F5');
  assert.equal(requests[0].text, '一起出发', 'setQuickChats copies presets');
  assert.equal(requests[0].channel, 0);
  assert.equal(chat.getSnapshot().pending, true);
  assert.equal(releases, 0, 'quick sends do not release held movement');
  chat.setChannel(1);
  assert.equal(chat.getSnapshot().channel, 0, 'pending request locks its channel');
  chat.sendQuickChat('F12'); chat.sendDraft();
  assert.equal(requests.length, 1, 'normal and quick sends share pending gate');
  requests[0].resolve(); await flush();
  assert.equal(chat.getSnapshot().draft, '一起出发', 'quick confirmation retains identical draft');
  assert.equal(chat.getSnapshot().pending, false);
  assert.equal(chat.getSnapshot().messages.length, 0, 'sends do not create unconfirmed messages');
  chat.sendQuickChat('F6');
  assert.equal(requests.length, 1, 'empty presets cannot send');
  chat.sendQuickChat('F5'); requests[1].reject(new Error('服务器拒绝')); await flush();
  assert.match(chat.getSnapshot().status, /服务器拒绝/);
  assert.equal(chat.getSnapshot().draft, '一起出发', 'refusal retains draft');
  chat.setChannel(1); chat.sendQuickChat('F5');
  assert.equal(requests[2].channel, 1, 'quick send follows team channel');
  chat.clear(); chat.show(); chat.setDraft('新房间草稿');
  assert.equal(chat.getSnapshot().channel, 0, 'new room resets channel');
  chat.sendQuickChat('F12'); requests[2].reject(new Error('旧请求拒绝')); await flush();
  assert.equal(chat.getSnapshot().status, '正在发送…');
  assert.equal(chat.getSnapshot().pending, true, 'old room completion cannot unlock current pending send');
  requests[3].resolve(); await flush();
  assert.equal(chat.getSnapshot().draft, '新房间草稿');
  chat.sendDraft(); requests[4].resolve(); await flush();
  assert.equal(chat.getSnapshot().draft, '', 'normal confirmation clears unchanged draft');
  chat.setDraft('原草稿'); chat.sendDraft(); chat.setDraft('发送期间修改');
  requests[5].resolve(); await flush();
  assert.equal(chat.getSnapshot().draft, '发送期间修改', 'confirmation retains newer draft');
  chat.sendDraft(); requests[6].reject(new Error('普通发送拒绝')); await flush();
  assert.equal(chat.getSnapshot().draft, '发送期间修改');
  assert.match(chat.getSnapshot().status, /普通发送拒绝/);
  const beforeInvalid = requests.length;
  for (const text of ['', '   ', 'x'.repeat(73), 'a\nb', '\u0000']) {
    chat.setDraft(text); chat.sendDraft();
    assert.match(chat.getSnapshot().status, /有效内容/);
  }
  assert.equal(requests.length, beforeInvalid, 'invalid ordinary messages are rejected before transport');
  for (let index = 0; index < 55; index++) chat.message(`权威消息${index}`);
  assert.equal(chat.getSnapshot().messages.length, 50);
  assert.equal(chat.getSnapshot().messages[0].text, '权威消息5');
  chat.setPhase('PLAYING'); assert.equal(chat.getSnapshot().sourceActive, true);
  const playing = chat.getSnapshot(), playingCount = notifications;
  chat.setPhase('PLAYING'); chat.setPhase('FINISHED');
  assert.equal(chat.getSnapshot(), playing, 'same presentation phase does not create render notifications');
  assert.equal(notifications, playingCount);
  chat.setPhase('WAITING'); assert.equal(chat.getSnapshot().sourceActive, false);
  chat.releaseInputKeys(); assert.equal(releases, 1);
  chat.clear();
  assert.equal(chat.getSnapshot().messages.length, 0);
  assert.equal(chat.getSnapshot().draft, '');
  assert.equal(chat.getSnapshot().visible, false);
  chat.show(); chat.setChannel(2); chat.setDraft('密语草稿');
  const privateStart = requests.length;
  chat.sendDraft(); assert.equal(requests.length, privateStart);
  assert.equal(chat.getSnapshot().status, '请填写密语对象');
  chat.setTargetName('中文对象'); chat.sendQuickChat('F5');
  assert.equal(requests[privateStart].targetName, '中文对象');
  assert.equal(requests[privateStart].channel, 2);
  chat.setTargetName('另一个对象');
  assert.equal(chat.getSnapshot().targetName, '中文对象', 'pending request retains its intended recipient');
  requests[privateStart].resolve(); await flush();
  assert.equal(chat.getSnapshot().draft, '密语草稿', 'private quick-send preserves normal draft');
  chat.sendDraft();
  chat.clear(); chat.show(); chat.setChannel(2); chat.setTargetName('新房间对象'); chat.setDraft('新私信'); chat.sendDraft();
  requests[privateStart + 1].reject(new Error('旧房间密语拒绝')); await flush();
  assert.equal(chat.getSnapshot().pending, true);
  assert.equal(chat.getSnapshot().targetName, '新房间对象');
  assert.equal(chat.getSnapshot().status, '正在发送…');
  requests[privateStart + 2].reject(new Error('当前目标离线')); await flush();
  assert.equal(chat.getSnapshot().draft, '新私信');
  assert.match(chat.getSnapshot().status, /当前目标离线/);
  chat.clear(); assert.equal(chat.getSnapshot().targetName, '');
  chat.show(); chat.setChannel(3); chat.setDraft('好友草稿');
  const friendStart = requests.length; chat.sendQuickChat('F5');
  assert.equal(requests[friendStart].channel, 3);
  chat.setChannel(0); assert.equal(chat.getSnapshot().channel, 3);
  requests[friendStart].reject(new Error('当前没有在线好友')); await flush();
  assert.equal(chat.getSnapshot().draft, '好友草稿');
  assert.match(chat.getSnapshot().status, /在线好友/);
  chat.sendDraft(); requests[friendStart + 1].resolve(); await flush();
  assert.equal(chat.getSnapshot().draft, '');
  chat.clear();
  const finalCount = notifications; unsubscribe(); chat.show(); assert.equal(notifications, finalCount);
  console.log('PASS: quick chat validation/persistence, shared confirmed sends, failure drafts, channel lock, semantic snapshots, 50 authoritative messages and room generation; keyboard/IME gates validated by real React browser fixture');
}
void run().catch(error => {console.error(error); process.exitCode = 1;});
