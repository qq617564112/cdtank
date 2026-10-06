import {registerTradeApi} from './social/trade';
import {RoomReconnections} from './rooms/reconnection';
import {registerFriendChatApi} from './social/friend-chat';
import {registerBlacklistApi} from './social/blacklist';
import {registerFriendsApi} from './social/friends';
import {registerRoomWhisperApi} from './social/room-whisper';
import {registerLobbyWhisperApi} from './social/lobby-whisper';
import {registerDisplayNameApi} from './accounts/display-name-api';
import {registerLobbyPresenceApi} from './social/lobby-presence';
import {registerLobbyChatApi} from './social/lobby-chat';
import {roomTransport, registerRoomMessages} from './rooms/transport';
import {startWorldTicks} from './runtime/tick';
import {WsServer} from 'tsrpc';
import {serviceProto, type ServiceType} from '../../shared/protocols/serviceProto';
import {World} from './world';
import {AccountStore} from './account-store';
import {registerAccountApis} from './accounts/api';
import {registerRoomApis} from './rooms/api';
import {registerRoomLeaveApi} from './rooms/leave';
import {registerRoomInvitations} from './rooms/invitations';
import {registerBattleInputs} from './battle/input';
import {accountBattleBinding, consumeAccountBattleItem} from './accounts/battle-binding';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {serverRuntimeConfig} from './runtime/config';
import {accountMatchHistory} from './settlement/history';

const runtime = serverRuntimeConfig();
const accountPath = runtime.accountPath;
mkdirSync(dirname(accountPath), {recursive: true});
const accounts = new AccountStore(accountPath);
const accountByConnection = new Map<string, string>();
const history = accountMatchHistory(accounts, accountByConnection,
  error => console.error('Match history save pending; retrying', error));
const PORT = runtime.port;
const TICK_RATE = runtime.tickRate;
const world = new World(Date.now, {
  minPlayers: runtime.minPlayers,
  timeLimitSeconds: runtime.timeLimitSeconds,
  resolveAccount: connectionId => accountByConnection.get(connectionId),
  onMatchCommitted: match => history.committed(match),
  consumeItem: (playerId, instanceId, expectedOwned, itemTableId) => consumeAccountBattleItem(
    accounts, accountByConnection, sessionByConnection, playerId, instanceId, expectedOwned, itemTableId),
});
const server = new WsServer(serviceProto, {
  port: PORT,
  logConnect: true,
  logMsg: false,
  logLevel: 'info',
  logReqBody: false,
  logResBody: false,
  heartbeatWaitTime: 15000,
});
const sessionByConnection = new Map<string, {roomId: string; playerId: string}>();
const transport = roomTransport(server, world, sessionByConnection);
const {broadcastRoomState, broadcastEvent} = transport;
const {ownedTank, roomTankId, bindAccountState} = accountBattleBinding(
  accounts, world, accountByConnection);

const reconnections = new RoomReconnections(world, accountByConnection, sessionByConnection, session => {
  for (const event of world.leave(session.playerId)) broadcastEvent(event);
  broadcastRoomState(session.roomId);
});
registerAccountApis(server, accounts, world, accountByConnection, sessionByConnection, broadcastRoomState,
  ownedTank, (accountId, connectionId) => reconnections.restore(accountId, connectionId));

const trades = registerTradeApi(server, accounts, accountByConnection, sessionByConnection);

registerDisplayNameApi(server, accounts, accountByConnection, sessionByConnection);
registerRoomApis(server, world, sessionByConnection, roomTankId, bindAccountState, broadcastRoomState,
  connectionId => {
    const accountId = accountByConnection.get(connectionId);
    if (!accountId) throw new Error('请先登录账户');
    trades.assertLobbyAvailable(accountId);
    return accounts.displayName(accountId);
  });
registerRoomLeaveApi(server, world, sessionByConnection, transport);
registerRoomInvitations(server, world, accountByConnection, sessionByConnection);

registerBattleInputs(server, world, sessionByConnection, broadcastEvent, roomId => {
  const snapshot = world.snapshot(roomId);
  if (snapshot) transport.broadcastSnapshot(snapshot);
});

registerRoomMessages(server, world, accountByConnection, sessionByConnection, transport, reconnections);
registerLobbyChatApi(server, accounts, accountByConnection, sessionByConnection);
registerLobbyWhisperApi(server, accounts, accountByConnection, sessionByConnection);
registerRoomWhisperApi(server, accounts, world, accountByConnection, sessionByConnection);
registerFriendsApi(server, accounts, accountByConnection, sessionByConnection);
registerBlacklistApi(server, accounts, accountByConnection, sessionByConnection);
registerFriendChatApi(server, accounts, world, accountByConnection, sessionByConnection);
registerLobbyPresenceApi(server, accountByConnection, sessionByConnection, accountId => accounts.displayName(accountId));
startWorldTicks(world, TICK_RATE, transport, () => world.publishReceipts(history.flush()));

server.start().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
