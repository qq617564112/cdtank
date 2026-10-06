import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {WsClient} = require('tsrpc');
const {serviceProto} = require('../../apps/shared/protocols/serviceProto.ts');

/** Ordinary authenticated players without a renderer; never writes battle state. */
export async function connectBreachAuxiliary(serverUrl, roomId, count = 2) {
  const members = [];
  async function api(member, name, request) {
    const response = await member.client.callApi(name, request);
    assert(response.isSucc, `${name}: ${JSON.stringify(response.err)}`);
    return response.res;
  }
  async function disconnect() {
    await Promise.all(members.map(member => member.client.disconnect()));
  }
  try {
    for (let index = 0; index < count; index++) {
      const member = {client: new WsClient(serviceProto, {server: serverUrl, logger: undefined,
        heartbeat: {interval: 5000, timeout: 10000}}),
        playerId: '', accountId: '', snapshot: undefined, events: []};
      members.push(member);
      member.client.listenMsg('RoomSnapshot', snapshot => {
        if (snapshot.roomId === roomId) member.snapshot = snapshot;
      });
      member.client.listenMsg('RoomEvent', event => {
        if (event.roomId === roomId) member.events.push(event);
      });
      const connection = await member.client.connect();
      assert(connection.isSucc, JSON.stringify(connection.err));
      const account = await api(member, 'Account', {});
      member.accountId = account.accountId;
      const joined = await api(member, 'Join', {roomId, clientId: `ordinary-aux-${index + 1}`,
        name: `旁观${index + 1}`, tankId: 1});
      member.playerId = joined.playerId;
    }
  } catch (error) {
    await disconnect();
    throw error;
  }
  return {
    members,
    ready: (round = 1) => Promise.all(members.map(member => api(member, 'Ready', {round}))),
    rematch: round => Promise.all(members.map(member => api(member, 'Rematch', {round}))),
    leave: round => Promise.all(members.map(member => api(member, 'Leave', {roomId, round}))),
    disconnect,
  };
}
