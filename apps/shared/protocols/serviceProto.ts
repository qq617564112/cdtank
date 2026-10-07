import { ServiceProto } from 'tsrpc-proto';
import { MsgChat } from './MsgChat';
import { MsgFamilyChat } from './MsgFamilyChat';
import { MsgFriendChat } from './MsgFriendChat';
import { MsgGmReply } from './MsgGmReply';
import { MsgLobbyChat } from './MsgLobbyChat';
import { MsgLobbyWhisper } from './MsgLobbyWhisper';
import { MsgPlayerAction } from './MsgPlayerAction';
import { MsgPlayerInput } from './MsgPlayerInput';
import { MsgRoomEvent } from './MsgRoomEvent';
import { MsgRoomInvitation } from './MsgRoomInvitation';
import { MsgRoomSnapshot } from './MsgRoomSnapshot';
import { MsgRoomState } from './MsgRoomState';
import { MsgRoomWhisper } from './MsgRoomWhisper';
import { MsgTradeState } from './MsgTradeState';
import { ReqAccount, ResAccount } from './PtlAccount';
import { ReqAutopilot, ResAutopilot } from './PtlAutopilot';
import { ReqBlacklist, ResBlacklist } from './PtlBlacklist';
import { ReqChangeTeam, ResChangeTeam } from './PtlChangeTeam';
import { ReqChannel, ResChannel } from './PtlChannel';
import { ReqCpu, ResCpu } from './PtlCpu';
import { ReqCreateRoom, ResCreateRoom } from './PtlCreateRoom';
import { ReqEditRoom, ResEditRoom } from './PtlEditRoom';
import { ReqKickRoomPlayer, ResKickRoomPlayer } from './PtlKickRoomPlayer';
import { ReqDisplayName, ResDisplayName } from './PtlDisplayName';
import { ReqEquipment, ResEquipment } from './PtlEquipment';
import { ReqFriendChat, ResFriendChat } from './PtlFriendChat';
import { ReqFamily, ResFamily } from './PtlFamily';
import { ReqFamilyChat, ResFamilyChat } from './PtlFamilyChat';
import { ReqGmSupport, ResGmSupport } from './PtlGmSupport';
import { ReqFriends, ResFriends } from './PtlFriends';
import { ReqHistory, ResHistory } from './PtlHistory';
import { ReqInventory, ResInventory } from './PtlInventory';
import { ReqJoin, ResJoin } from './PtlJoin';
import { ReqKitbag, ResKitbag } from './PtlKitbag';
import { ReqLeave, ResLeave } from './PtlLeave';
import { ReqListMaps, ResListMaps } from './PtlListMaps';
import { ReqListRooms, ResListRooms } from './PtlListRooms';
import { ReqLobbyChat, ResLobbyChat } from './PtlLobbyChat';
import { ReqLobbyPlayers, ResLobbyPlayers } from './PtlLobbyPlayers';
import { ReqLobbyWhisper, ResLobbyWhisper } from './PtlLobbyWhisper';
import { ReqOwnedRoles, ResOwnedRoles } from './PtlOwnedRoles';
import { ReqOwnedRoleSale, ResOwnedRoleSale } from './PtlOwnedRoleSale';
import { ReqPartMaintenance, ResPartMaintenance } from './PtlPartMaintenance';
import { ReqPartSale, ResPartSale } from './PtlPartSale';
import { ReqPetShop, ResPetShop } from './PtlPetShop';
import { ReqPetSkillLearning, ResPetSkillLearning } from './PtlPetSkillLearning';
import { ReqPlayerProfile, ResPlayerProfile } from './PtlPlayerProfile';
import { ReqPlayerSearch, ResPlayerSearch } from './PtlPlayerSearch';
import { ReqQuickMatch, ResQuickMatch } from './PtlQuickMatch';
import { ReqReady, ResReady } from './PtlReady';
import { ReqRematch, ResRematch } from './PtlRematch';
import { ReqResumeRoom, ResResumeRoom } from './PtlResumeRoom';
import { ReqRoleProfile, ResRoleProfile } from './PtlRoleProfile';
import { ReqRoomChat, ResRoomChat } from './PtlRoomChat';
import { ReqRoomInvite, ResRoomInvite } from './PtlRoomInvite';
import { ReqRoomWhisper, ResRoomWhisper } from './PtlRoomWhisper';
import { ReqSelectRole, ResSelectRole } from './PtlSelectRole';
import { ReqShop, ResShop } from './PtlShop';
import { ReqStackItemSale, ResStackItemSale } from './PtlStackItemSale';
import { ReqTankMaintenance, ResTankMaintenance } from './PtlTankMaintenance';
import { ReqTankShop, ResTankShop } from './PtlTankShop';
import { ReqTankUpgrade, ResTankUpgrade } from './PtlTankUpgrade';
import { ReqTankTextures, ResTankTextures } from './PtlTankTextures';
import { ReqTrade, ResTrade } from './PtlTrade';
import { ReqValuableItemSale, ResValuableItemSale } from './PtlValuableItemSale';

export interface ServiceType {
    api: {
        "Account": {
            req: ReqAccount,
            res: ResAccount
        },
        "Autopilot": {
            req: ReqAutopilot,
            res: ResAutopilot
        },
        "Blacklist": {
            req: ReqBlacklist,
            res: ResBlacklist
        },
        "ChangeTeam": {
            req: ReqChangeTeam,
            res: ResChangeTeam
        },
        "Channel": {
            req: ReqChannel,
            res: ResChannel
        },
        "Cpu": {
            req: ReqCpu,
            res: ResCpu
        },
        "CreateRoom": {
            req: ReqCreateRoom,
            res: ResCreateRoom
        },
        "KickRoomPlayer": {
            req: ReqKickRoomPlayer,
            res: ResKickRoomPlayer
        },
        "EditRoom": {
            req: ReqEditRoom,
            res: ResEditRoom
        },
        "DisplayName": {
            req: ReqDisplayName,
            res: ResDisplayName
        },
        "Equipment": {
            req: ReqEquipment,
            res: ResEquipment
        },
        "FriendChat": {
            req: ReqFriendChat,
            res: ResFriendChat
        },
        "Family": {
            req: ReqFamily,
            res: ResFamily
        },
        "FamilyChat": {
            req: ReqFamilyChat,
            res: ResFamilyChat
        },
        "GmSupport": {
            req: ReqGmSupport,
            res: ResGmSupport
        },
        "Friends": {
            req: ReqFriends,
            res: ResFriends
        },
        "History": {
            req: ReqHistory,
            res: ResHistory
        },
        "Inventory": {
            req: ReqInventory,
            res: ResInventory
        },
        "Join": {
            req: ReqJoin,
            res: ResJoin
        },
        "Kitbag": {
            req: ReqKitbag,
            res: ResKitbag
        },
        "Leave": {
            req: ReqLeave,
            res: ResLeave
        },
        "ListMaps": {
            req: ReqListMaps,
            res: ResListMaps
        },
        "ListRooms": {
            req: ReqListRooms,
            res: ResListRooms
        },
        "LobbyChat": {
            req: ReqLobbyChat,
            res: ResLobbyChat
        },
        "LobbyPlayers": {
            req: ReqLobbyPlayers,
            res: ResLobbyPlayers
        },
        "LobbyWhisper": {
            req: ReqLobbyWhisper,
            res: ResLobbyWhisper
        },
        "OwnedRoles": {
            req: ReqOwnedRoles,
            res: ResOwnedRoles
        },
        "OwnedRoleSale": {
            req: ReqOwnedRoleSale,
            res: ResOwnedRoleSale
        },
        "PartMaintenance": {
            req: ReqPartMaintenance,
            res: ResPartMaintenance
        },
        "PartSale": {
            req: ReqPartSale,
            res: ResPartSale
        },
        "PetShop": {
            req: ReqPetShop,
            res: ResPetShop
        },
        "PetSkillLearning": {
            req: ReqPetSkillLearning,
            res: ResPetSkillLearning
        },
        "PlayerProfile": {
            req: ReqPlayerProfile,
            res: ResPlayerProfile
        },
        "PlayerSearch": {
            req: ReqPlayerSearch,
            res: ResPlayerSearch
        },
        "QuickMatch": {
            req: ReqQuickMatch,
            res: ResQuickMatch
        },
        "Ready": {
            req: ReqReady,
            res: ResReady
        },
        "Rematch": {
            req: ReqRematch,
            res: ResRematch
        },
        "ResumeRoom": {
            req: ReqResumeRoom,
            res: ResResumeRoom
        },
        "RoleProfile": {
            req: ReqRoleProfile,
            res: ResRoleProfile
        },
        "RoomChat": {
            req: ReqRoomChat,
            res: ResRoomChat
        },
        "RoomInvite": {
            req: ReqRoomInvite,
            res: ResRoomInvite
        },
        "RoomWhisper": {
            req: ReqRoomWhisper,
            res: ResRoomWhisper
        },
        "SelectRole": {
            req: ReqSelectRole,
            res: ResSelectRole
        },
        "Shop": {
            req: ReqShop,
            res: ResShop
        },
        "StackItemSale": {
            req: ReqStackItemSale,
            res: ResStackItemSale
        },
        "TankMaintenance": {
            req: ReqTankMaintenance,
            res: ResTankMaintenance
        },
        "TankShop": {
            req: ReqTankShop,
            res: ResTankShop
        },
        "TankUpgrade": {
            req: ReqTankUpgrade,
            res: ResTankUpgrade
        },
        "TankTextures": {
            req: ReqTankTextures,
            res: ResTankTextures
        },
        "Trade": {
            req: ReqTrade,
            res: ResTrade
        },
        "ValuableItemSale": {
            req: ReqValuableItemSale,
            res: ResValuableItemSale
        }
    },
    msg: {
        "Chat": MsgChat,
        "FamilyChat": MsgFamilyChat,
        "FriendChat": MsgFriendChat,
        "GmReply": MsgGmReply,
        "LobbyChat": MsgLobbyChat,
        "LobbyWhisper": MsgLobbyWhisper,
        "PlayerAction": MsgPlayerAction,
        "PlayerInput": MsgPlayerInput,
        "RoomEvent": MsgRoomEvent,
        "RoomInvitation": MsgRoomInvitation,
        "RoomSnapshot": MsgRoomSnapshot,
        "RoomState": MsgRoomState,
        "RoomWhisper": MsgRoomWhisper,
        "TradeState": MsgTradeState
    }
}

export const serviceProto: ServiceProto<ServiceType> = {
    "version": 118,
    "services": [
        {
            "id": 55,
            "name": "KickRoomPlayer",
            "type": "api"
        },
        {
            "id": 54,
            "name": "EditRoom",
            "type": "api"
        },
        {
            "id": 0,
            "name": "Chat",
            "type": "msg"
        },
        {
            "id": 40,
            "name": "FriendChat",
            "type": "msg"
        },
        {
            "id": 30,
            "name": "LobbyChat",
            "type": "msg"
        },
        {
            "id": 34,
            "name": "LobbyWhisper",
            "type": "msg"
        },
        {
            "id": 1,
            "name": "PlayerAction",
            "type": "msg"
        },
        {
            "id": 2,
            "name": "PlayerInput",
            "type": "msg"
        },
        {
            "id": 3,
            "name": "RoomEvent",
            "type": "msg"
        },
        {
            "id": 28,
            "name": "RoomInvitation",
            "type": "msg"
        },
        {
            "id": 4,
            "name": "RoomSnapshot",
            "type": "msg"
        },
        {
            "id": 5,
            "name": "RoomState",
            "type": "msg"
        },
        {
            "id": 36,
            "name": "RoomWhisper",
            "type": "msg"
        },
        {
            "id": 47,
            "name": "TradeState",
            "type": "msg"
        },
        {
            "id": 15,
            "name": "Account",
            "type": "api"
        },
        {
            "id": 22,
            "name": "Autopilot",
            "type": "api"
        },
        {
            "id": 39,
            "name": "Blacklist",
            "type": "api"
        },
        {
            "id": 13,
            "name": "ChangeTeam",
            "type": "api"
        },
        {
            "id": 53,
            "name": "Channel",
            "type": "api"
        },
        {
            "id": 14,
            "name": "Cpu",
            "type": "api"
        },
        {
            "id": 11,
            "name": "CreateRoom",
            "type": "api"
        },
        {
            "id": 33,
            "name": "DisplayName",
            "type": "api"
        },
        {
            "id": 21,
            "name": "Equipment",
            "type": "api"
        },
        {
            "id": 41,
            "name": "FriendChat",
            "type": "api"
        },
        {
            "id": 38,
            "name": "Friends",
            "type": "api"
        },
        {
            "id": 25,
            "name": "History",
            "type": "api"
        },
        {
            "id": 16,
            "name": "Inventory",
            "type": "api"
        },
        {
            "id": 6,
            "name": "Join",
            "type": "api"
        },
        {
            "id": 17,
            "name": "Kitbag",
            "type": "api"
        },
        {
            "id": 27,
            "name": "Leave",
            "type": "api"
        },
        {
            "id": 12,
            "name": "ListMaps",
            "type": "api"
        },
        {
            "id": 7,
            "name": "ListRooms",
            "type": "api"
        },
        {
            "id": 31,
            "name": "LobbyChat",
            "type": "api"
        },
        {
            "id": 32,
            "name": "LobbyPlayers",
            "type": "api"
        },
        {
            "id": 35,
            "name": "LobbyWhisper",
            "type": "api"
        },
        {
            "id": 18,
            "name": "OwnedRoles",
            "type": "api"
        },
        {
            "id": 49,
            "name": "OwnedRoleSale",
            "type": "api"
        },
        {
            "id": 50,
            "name": "PartMaintenance",
            "type": "api"
        },
        {
            "id": 51,
            "name": "PartSale",
            "type": "api"
        },
        {
            "id": 43,
            "name": "PetShop",
            "type": "api"
        },
        {
            "id": 46,
            "name": "PetSkillLearning",
            "type": "api"
        },
        {
            "id": 8,
            "name": "QuickMatch",
            "type": "api"
        },
        {
            "id": 9,
            "name": "Ready",
            "type": "api"
        },
        {
            "id": 10,
            "name": "Rematch",
            "type": "api"
        },
        {
            "id": 45,
            "name": "ResumeRoom",
            "type": "api"
        },
        {
            "id": 19,
            "name": "RoleProfile",
            "type": "api"
        },
        {
            "id": 24,
            "name": "RoomChat",
            "type": "api"
        },
        {
            "id": 29,
            "name": "RoomInvite",
            "type": "api"
        },
        {
            "id": 37,
            "name": "RoomWhisper",
            "type": "api"
        },
        {
            "id": 20,
            "name": "SelectRole",
            "type": "api"
        },
        {
            "id": 26,
            "name": "Shop",
            "type": "api"
        },
        {
            "id": 52,
            "name": "StackItemSale",
            "type": "api"
        },
        {
            "id": 44,
            "name": "TankMaintenance",
            "type": "api"
        },
        {
            "id": 42,
            "name": "TankShop",
            "type": "api"
        },
        {
            "id": 56,
            "name": "TankUpgrade",
            "type": "api"
        },
        {
            "id": 57,
            "name": "PlayerProfile",
            "type": "api"
        },
        {
            "id": 23,
            "name": "TankTextures",
            "type": "api"
        },
        {
            "id": 48,
            "name": "Trade",
            "type": "api"
        },
        {
            "id": 58,
            "name": "ValuableItemSale",
            "type": "api"
        },
        {
            "id": 59,
            "name": "GmSupport",
            "type": "api"
        },
        {
            "id": 60,
            "name": "GmReply",
            "type": "msg"
        },
        {
            "id": 61,
            "name": "Family",
            "type": "api"
        },
        {
            "id": 62,
            "name": "FamilyChat",
            "type": "api"
        },
        {
            "id": 63,
            "name": "FamilyChat",
            "type": "msg"
        },
        {
            "id": 64,
            "name": "PlayerSearch",
            "type": "api"
        }
    ],
    "types": {
        "MsgChat/MsgChat": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "channel",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "text",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "MsgFriendChat/MsgFriendChat": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "id",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "accountId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "senderName",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 3,
                    "name": "text",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 4,
                    "name": "message",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 5,
                    "name": "roomId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                },
                {
                    "id": 6,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                }
            ]
        },
        "MsgFamilyChat/MsgFamilyChat": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "id",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "accountId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "senderName",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 3,
                    "name": "familyId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 4,
                    "name": "familyName",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 5,
                    "name": "text",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 6,
                    "name": "message",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 7,
                    "name": "roomId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                },
                {
                    "id": 8,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                }
            ]
        },
        "MsgGmReply/MsgGmReply": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "accountId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "reply",
                    "type": {
                        "type": "Reference",
                        "target": "PtlGmSupport/GmSupportReply"
                    }
                }
            ]
        },
        "MsgLobbyChat/MsgLobbyChat": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "id",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "accountId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "text",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 3,
                    "name": "message",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "MsgLobbyWhisper/MsgLobbyWhisper": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "id",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "accountId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "targetAccountId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 3,
                    "name": "senderName",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 4,
                    "name": "targetName",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 5,
                    "name": "text",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 6,
                    "name": "message",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "MsgPlayerAction/MsgPlayerAction": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "sequence",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "action",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "value",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "clientTime",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "roomId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 5,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "MsgPlayerInput/MsgPlayerInput": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "sequence",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "move",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "turn",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "aim",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "fire",
                    "type": {
                        "type": "Boolean"
                    }
                },
                {
                    "id": 5,
                    "name": "useItem",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 6,
                    "name": "clientTime",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 7,
                    "name": "pose",
                    "type": {
                        "type": "Reference",
                        "target": "MsgPlayerInput/ClientTankPose"
                    },
                    "optional": true
                }
            ]
        },
        "MsgPlayerInput/ClientTankPose": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "life",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "x",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "y",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "z",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "yaw",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 6,
                    "name": "bodyYaw",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 7,
                    "name": "aim",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 8,
                    "name": "command",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "MsgRoomEvent/MsgRoomEvent": {
            "type": "Interface",
            "properties": [
                {
                    "id": 8,
                    "name": "roomId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 0,
                    "name": "type",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "message",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "playerId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 3,
                    "name": "targetId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 4,
                    "name": "value",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "x",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 6,
                    "name": "y",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 7,
                    "name": "z",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 9,
                    "name": "skillId",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 13,
                    "name": "hurtSelector",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 14,
                    "name": "shotDisplay",
                    "type": {
                        "type": "Reference",
                        "target": "MsgRoomEvent/ShotDisplayMessage"
                    },
                    "optional": true
                },
                {
                    "id": 15,
                    "name": "shotPlayerResult",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "itemId",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 1,
                                "name": "critical",
                                "type": {
                                    "type": "Boolean"
                                },
                                "optional": true
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 16,
                    "name": "shotItemResult",
                    "type": {
                        "type": "Reference",
                        "target": "MsgRoomEvent/ShotDisplayMessage"
                    },
                    "optional": true
                },
                {
                    "id": 18,
                    "name": "sceneCrush",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "placementId",
                                "type": {
                                    "type": "String"
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 19,
                    "name": "scenePlant",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "placementId",
                                "type": {
                                    "type": "String"
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 17,
                    "name": "castleDamage",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "castleId",
                                "type": {
                                    "type": "String"
                                }
                            },
                            {
                                "id": 1,
                                "name": "currentHP",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 2,
                                "name": "maxHP",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 3,
                                "name": "delta",
                                "type": {
                                    "type": "Number"
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 12,
                    "name": "itemUseRequest",
                    "type": {
                        "type": "Reference",
                        "target": "MsgRoomEvent/ItemUseRequest"
                    },
                    "optional": true
                },
                {
                    "id": 10,
                    "name": "playSkillEffect",
                    "type": {
                        "type": "Reference",
                        "target": "MsgRoomEvent/PlaySkillEffectMessage"
                    },
                    "optional": true
                },
                {
                    "id": 11,
                    "name": "stopSkillEffect",
                    "type": {
                        "type": "Reference",
                        "target": "MsgRoomEvent/StopSkillEffectMessage"
                    },
                    "optional": true
                },
                {
                    "id": 20,
                    "name": "roleStyleChanged",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "roleId",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 1,
                                "name": "style",
                                "type": {
                                    "type": "Union",
                                    "members": [
                                        {
                                            "id": 0,
                                            "type": {
                                                "type": "Literal",
                                                "literal": 1
                                            }
                                        },
                                        {
                                            "id": 1,
                                            "type": {
                                                "type": "Literal",
                                                "literal": 2
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 21,
                    "name": "roleStyleRestored",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "roleId",
                                "type": {
                                    "type": "Number"
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 25,
                    "name": "groundItemDropped",
                    "type": {
                        "type": "Reference",
                        "target": "MsgRoomSnapshot/GroundItemSnapshot"
                    },
                    "optional": true
                },
                {
                    "id": 26,
                    "name": "groundItemPickedUp",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "id",
                                "type": {
                                    "type": "String"
                                }
                            },
                            {
                                "id": 1,
                                "name": "playerId",
                                "type": {
                                    "type": "String"
                                }
                            },
                            {
                                "id": 2,
                                "name": "itemTableId",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 3,
                                "name": "quantity",
                                "type": {
                                    "type": "Number"
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 27,
                    "name": "groundItemRemoved",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "id",
                                "type": {
                                    "type": "String"
                                }
                            }
                        ]
                    },
                    "optional": true
                }
            ]
        },
        "MsgRoomEvent/ShotDisplayMessage": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "itemId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "x",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "y",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "z",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "MsgRoomEvent/ItemUseRequest": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "kind",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "placeTrap"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "useItem"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "instanceId",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "MsgRoomEvent/PlaySkillEffectMessage": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "skillId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "effectIndex",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "duration",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "roleId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "xBits",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "zBits",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "MsgRoomEvent/StopSkillEffectMessage": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "skillId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "roleId",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "MsgRoomInvitation/MsgRoomInvitation": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "invitationId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "room",
                    "type": {
                        "type": "Reference",
                        "target": "PtlListRooms/RoomSummary"
                    }
                },
                {
                    "id": 2,
                    "name": "senderName",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 3,
                    "name": "expiresAt",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlListRooms/RoomSummary": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "id",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "mode",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "mapId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "playerCount",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 10,
                    "name": "teamPlayerCounts",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Number"
                        }
                    },
                    "optional": true
                },
                {
                    "id": 5,
                    "name": "maxPlayers",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 8,
                    "name": "minPlayers",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 9,
                    "name": "friendlyFire",
                    "type": {
                        "type": "Boolean"
                    },
                    "optional": true
                },
                {
                    "id": 6,
                    "name": "phase",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 7,
                    "name": "hasPassword",
                    "type": {
                        "type": "Boolean"
                    },
                    "optional": true
                }
            ]
        },
        "MsgRoomSnapshot/MsgRoomSnapshot": {
            "type": "Interface",
            "properties": [
                {
                    "id": 11,
                    "name": "roomInfo",
                    "type": {
                        "type": "Reference",
                        "target": "MsgRoomSnapshot/RoomInfoSnapshot"
                    },
                    "optional": true
                },
                {
                    "id": 8,
                    "name": "roomId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 9,
                    "name": "mode",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 0,
                    "name": "serverTime",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "tick",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "remaining",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "phase",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 4,
                    "name": "players",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "MsgRoomSnapshot/PlayerSnapshot"
                        }
                    }
                },
                {
                    "id": 5,
                    "name": "bullets",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "MsgRoomSnapshot/BulletSnapshot"
                        }
                    }
                },
                {
                    "id": 6,
                    "name": "teamScores",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Number"
                        }
                    }
                },
                {
                    "id": 7,
                    "name": "winnerTeam",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 10,
                    "name": "match",
                    "type": {
                        "type": "Reference",
                        "target": "MsgRoomSnapshot/MatchSnapshot"
                    },
                    "optional": true
                }
            ]
        },
        "MsgRoomSnapshot/RoomInfoSnapshot": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "mapId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "mapName",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 3,
                    "name": "mapDescription",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 4,
                    "name": "timeLimitSeconds",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "hasPassword",
                    "type": {
                        "type": "Boolean"
                    }
                }
            ]
        },
        "MsgRoomSnapshot/PlayerSnapshot": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "id",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "tankId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 32,
                    "name": "petId",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 39,
                    "name": "roleSkillSources",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "currentSkillIds",
                                "type": {
                                    "type": "Array",
                                    "elementType": {
                                        "type": "Number"
                                    }
                                }
                            },
                            {
                                "id": 1,
                                "name": "equipmentSkills",
                                "type": {
                                    "type": "Array",
                                    "elementType": {
                                        "type": "Interface",
                                        "properties": [
                                            {
                                                "id": 0,
                                                "name": "baseId",
                                                "type": {
                                                    "type": "Number"
                                                }
                                            },
                                            {
                                                "id": 1,
                                                "name": "rank",
                                                "type": {
                                                    "type": "Number"
                                                }
                                            }
                                        ]
                                    }
                                }
                            },
                            {
                                "id": 2,
                                "name": "selectedSkillIds",
                                "type": {
                                    "type": "Array",
                                    "elementType": {
                                        "type": "Number"
                                    }
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 21,
                    "name": "tankTextures",
                    "type": {
                        "type": "Reference",
                        "target": "../combat/role-owned-textures/OwnedTankTextures"
                    },
                    "optional": true
                },
                {
                    "id": 35,
                    "name": "queuedPartSkillIds",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Number"
                        }
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "team",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "x",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "y",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 6,
                    "name": "z",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 7,
                    "name": "yaw",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 22,
                    "name": "bodyYaw",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 8,
                    "name": "aim",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 9,
                    "name": "hp",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 10,
                    "name": "maxHp",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 11,
                    "name": "alive",
                    "type": {
                        "type": "Boolean"
                    }
                },
                {
                    "id": 12,
                    "name": "score",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 13,
                    "name": "kills",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 14,
                    "name": "deaths",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 15,
                    "name": "respawnAt",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 16,
                    "name": "isVIP",
                    "type": {
                        "type": "Boolean"
                    }
                },
                {
                    "id": 17,
                    "name": "objectivesDestroyed",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 18,
                    "name": "isCpu",
                    "type": {
                        "type": "Boolean"
                    },
                    "optional": true
                },
                {
                    "id": 31,
                    "name": "cpuLoadout",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "PtlCpu/CpuLoadoutItem"
                        }
                    },
                    "optional": true
                },
                {
                    "id": 20,
                    "name": "isAutopilot",
                    "type": {
                        "type": "Boolean"
                    },
                    "optional": true
                },
                {
                    "id": 19,
                    "name": "selectedAmmoSlot",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 29,
                    "name": "ammoItemId",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 33,
                    "name": "ammoMagazine",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "remaining",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 1,
                                "name": "capacity",
                                "type": {
                                    "type": "Number"
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 30,
                    "name": "ammoSlots",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Interface",
                            "properties": [
                                {
                                    "id": 0,
                                    "name": "slot",
                                    "type": {
                                        "type": "Number"
                                    }
                                },
                                {
                                    "id": 1,
                                    "name": "itemTableId",
                                    "type": {
                                        "type": "Number"
                                    }
                                },
                                {
                                    "id": 2,
                                    "name": "quantity",
                                    "type": {
                                        "type": "Number"
                                    }
                                }
                            ]
                        }
                    },
                    "optional": true
                },
                {
                    "id": 28,
                    "name": "defenseBoost",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "skillId",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 1,
                                "name": "expiresAt",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 2,
                                "name": "defensePercent",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 3,
                                "name": "defenseBonus",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 4,
                                "name": "baseDefense",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 5,
                                "name": "boostedDefense",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 6,
                                "name": "source",
                                "type": {
                                    "type": "Union",
                                    "members": [
                                        {
                                            "id": 0,
                                            "type": {
                                                "type": "Literal",
                                                "literal": "original-attributes"
                                            }
                                        },
                                        {
                                            "id": 1,
                                            "type": {
                                                "type": "Literal",
                                                "literal": "rebuilt-tank"
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 24,
                    "name": "attackBoost",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "skillId",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 1,
                                "name": "expiresAt",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 2,
                                "name": "attackPercent",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 3,
                                "name": "attackBonus",
                                "type": {
                                    "type": "Number"
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 27,
                    "name": "turnBoost",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "skillId",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 1,
                                "name": "expiresAt",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 2,
                                "name": "turnBonus",
                                "type": {
                                    "type": "Number"
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 26,
                    "name": "speedBoost",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "skillId",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 1,
                                "name": "expiresAt",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 2,
                                "name": "moveBonus",
                                "type": {
                                    "type": "Number"
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 25,
                    "name": "invincibility",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "skillId",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 1,
                                "name": "expiresAt",
                                "type": {
                                    "type": "Number"
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 36,
                    "name": "trapRestraint",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "skillId",
                                "type": {
                                    "type": "Literal",
                                    "literal": 4001
                                }
                            },
                            {
                                "id": 1,
                                "name": "expiresAt",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 2,
                                "name": "movePermissionCount",
                                "type": {
                                    "type": "Number"
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 37,
                    "name": "trapTurnRestraint",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "skillId",
                                "type": {
                                    "type": "Literal",
                                    "literal": 4002
                                }
                            },
                            {
                                "id": 1,
                                "name": "expiresAt",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 2,
                                "name": "turnPermissionCount",
                                "type": {
                                    "type": "Number"
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 38,
                    "name": "trapFireRestraint",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "skillId",
                                "type": {
                                    "type": "Literal",
                                    "literal": 4003
                                }
                            },
                            {
                                "id": 1,
                                "name": "expiresAt",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 2,
                                "name": "firePermissionCount",
                                "type": {
                                    "type": "Number"
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 34,
                    "name": "ammoBurn",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "itemId",
                                "type": {
                                    "type": "Literal",
                                    "literal": 2007
                                }
                            },
                            {
                                "id": 1,
                                "name": "skillId",
                                "type": {
                                    "type": "Literal",
                                    "literal": 4005
                                }
                            },
                            {
                                "id": 2,
                                "name": "startedAt",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 3,
                                "name": "expiresAt",
                                "type": {
                                    "type": "Number"
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 23,
                    "name": "reload",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "duration",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 1,
                                "name": "remaining",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 3,
                                "name": "startedAt",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 2,
                                "name": "source",
                                "type": {
                                    "type": "Union",
                                    "members": [
                                        {
                                            "id": 0,
                                            "type": {
                                                "type": "Literal",
                                                "literal": "original-normal"
                                            }
                                        },
                                        {
                                            "id": 1,
                                            "type": {
                                                "type": "Literal",
                                                "literal": "rebuilt"
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 40,
                    "name": "opticalCamouflage",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "skillId",
                                "type": {
                                    "type": "Literal",
                                    "literal": 9
                                }
                            },
                            {
                                "id": 1,
                                "name": "expiresAt",
                                "type": {
                                    "type": "Number"
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 41,
                    "name": "roleDisguise",
                    "type": {
                        "type": "Reference",
                        "target": "MsgRoomSnapshot/RoleDisguiseSnapshot"
                    },
                    "optional": true
                },
                {
                    "id": 42,
                    "name": "movement",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "speed",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 1,
                                "name": "turn",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 2,
                                "name": "tankType",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 3,
                                "name": "original",
                                "type": {
                                    "type": "Boolean"
                                }
                            },
                            {
                                "id": 4,
                                "name": "canMove",
                                "type": {
                                    "type": "Boolean"
                                }
                            },
                            {
                                "id": 5,
                                "name": "canTurn",
                                "type": {
                                    "type": "Boolean"
                                }
                            },
                            {
                                "id": 6,
                                "name": "command",
                                "type": {
                                    "type": "Number"
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 43,
                    "name": "title",
                    "type": {
                        "type": "Reference",
                        "target": "MsgRoomSnapshot/PlayerTitle"
                    },
                    "optional": true
                },
                {
                    "id": 44,
                    "name": "respawnProtection",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "skillId",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 1,
                                "name": "expiresAt",
                                "type": {
                                    "type": "Number"
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 45,
                    "name": "radarJammed",
                    "type": {
                        "type": "Boolean"
                    },
                    "optional": true
                },
                {
                    "id": 48,
                    "name": "decoration",
                    "type": {
                        "type": "Reference",
                        "target": "MsgRoomSnapshot/TankDecorationSnapshot"
                    },
                    "optional": true
                }
            ]
        },
        "MsgRoomSnapshot/TankDecorationSnapshot": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "itemTableId",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "../combat/role-owned-textures/OwnedTankTextures": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "U",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "M",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "XY",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlCpu/CpuLoadoutItem": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "slot",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "itemTableId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "quantity",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "MsgRoomSnapshot/BulletSnapshot": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "id",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "ownerId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "x",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "y",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "z",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "vx",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 6,
                    "name": "vy",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 7,
                    "name": "vz",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 8,
                    "name": "damage",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "MsgRoomSnapshot/MatchSnapshot": {
            "type": "Interface",
            "properties": [
                {
                    "id": 15,
                    "name": "loadedPlayerIds",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "String"
                        }
                    },
                    "optional": true
                },
                {
                    "id": 10,
                    "name": "friendlyFire",
                    "type": {
                        "type": "Boolean"
                    },
                    "optional": true
                },
                {
                    "id": 0,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "readyPlayerIds",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "String"
                        }
                    }
                },
                {
                    "id": 2,
                    "name": "rematchPlayerIds",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "String"
                        }
                    }
                },
                {
                    "id": 16,
                    "name": "battleStartsAt",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "minPlayers",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 9,
                    "name": "maxPlayers",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 4,
                    "name": "targetScore",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "teamLives",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Number"
                        }
                    }
                },
                {
                    "id": 6,
                    "name": "objectives",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "MsgRoomSnapshot/ObjectiveSnapshot"
                        }
                    }
                },
                {
                    "id": 11,
                    "name": "sceneObjects",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "MsgRoomSnapshot/SceneObjectSnapshot"
                        }
                    },
                    "optional": true
                },
                {
                    "id": 12,
                    "name": "sceneCrushes",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "MsgRoomSnapshot/SceneCrushSnapshot"
                        }
                    },
                    "optional": true
                },
                {
                    "id": 14,
                    "name": "scenePlants",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "MsgRoomSnapshot/ScenePlantSnapshot"
                        }
                    },
                    "optional": true
                },
                {
                    "id": 13,
                    "name": "groundTraps",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "MsgRoomSnapshot/GroundTrapSnapshot"
                        }
                    },
                    "optional": true
                },
                {
                    "id": 7,
                    "name": "result",
                    "type": {
                        "type": "Reference",
                        "target": "MsgRoomSnapshot/MatchResult"
                    },
                    "optional": true
                },
                {
                    "id": 8,
                    "name": "cpuManagerId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                },
                {
                    "id": 17,
                    "name": "groundItems",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "MsgRoomSnapshot/GroundItemSnapshot"
                        }
                    },
                    "optional": true
                }
            ]
        },
        "MsgRoomSnapshot/ObjectiveSnapshot": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "id",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "kind",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "CAPTURE"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "DESTROY"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 2,
                    "name": "x",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "y",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "z",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "radius",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 6,
                    "name": "hp",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 7,
                    "name": "maxHp",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 8,
                    "name": "ownerTeam",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 9,
                    "name": "contested",
                    "type": {
                        "type": "Boolean"
                    }
                },
                {
                    "id": 10,
                    "name": "sourcePlacementId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                },
                {
                    "id": 11,
                    "name": "sourceModel",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                },
                {
                    "id": 12,
                    "name": "destroyedAt",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                }
            ]
        },
        "MsgRoomSnapshot/SceneObjectSnapshot": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "id",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "sourcePlacementId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "sourceModel",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 3,
                    "name": "x",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "y",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "z",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 6,
                    "name": "hp",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 7,
                    "name": "maxHp",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 8,
                    "name": "destroyedAt",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                }
            ]
        },
        "MsgRoomSnapshot/SceneCrushSnapshot": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "id",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "sourcePlacementId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "sourceModel",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 3,
                    "name": "enabled",
                    "type": {
                        "type": "Boolean"
                    }
                },
                {
                    "id": 4,
                    "name": "hidden",
                    "type": {
                        "type": "Boolean"
                    }
                }
            ]
        },
        "MsgRoomSnapshot/ScenePlantSnapshot": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "id",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "sourcePlacementId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "sourceModel",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 3,
                    "name": "enabled",
                    "type": {
                        "type": "Boolean"
                    }
                },
                {
                    "id": 4,
                    "name": "hidden",
                    "type": {
                        "type": "Boolean"
                    }
                }
            ]
        },
        "MsgRoomSnapshot/GroundTrapSnapshot": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "id",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "ownerId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "team",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "itemTableId",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 3,
                                "type": {
                                    "type": "Literal",
                                    "literal": 3001
                                }
                            },
                            {
                                "id": 4,
                                "type": {
                                    "type": "Literal",
                                    "literal": 3002
                                }
                            },
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": 3003
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": 3004
                                }
                            },
                            {
                                "id": 2,
                                "type": {
                                    "type": "Literal",
                                    "literal": 3005
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 4,
                    "name": "modelId",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 3,
                                "type": {
                                    "type": "Literal",
                                    "literal": 3001
                                }
                            },
                            {
                                "id": 4,
                                "type": {
                                    "type": "Literal",
                                    "literal": 3002
                                }
                            },
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": 3003
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": 3004
                                }
                            },
                            {
                                "id": 2,
                                "type": {
                                    "type": "Literal",
                                    "literal": 3005
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 5,
                    "name": "x",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 6,
                    "name": "y",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 7,
                    "name": "z",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 8,
                    "name": "expiresAt",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "MsgRoomSnapshot/GroundItemSnapshot": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "id",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "itemTableId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "quantity",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "modelId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 4,
                    "name": "texture",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "A"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "B"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 5,
                    "name": "soundId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 6,
                    "name": "effectId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 7,
                    "name": "x",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 8,
                    "name": "y",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 9,
                    "name": "z",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 10,
                    "name": "source",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "BREACH"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "DISCARD"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 11,
                    "name": "ownerId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                },
                {
                    "id": 12,
                    "name": "createdAt",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "MsgRoomSnapshot/MatchResult": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "endedAt",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "reason",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "TIME_LIMIT"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "OBJECTIVE"
                                }
                            },
                            {
                                "id": 2,
                                "type": {
                                    "type": "Literal",
                                    "literal": "FORFEIT"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 3,
                    "name": "winnerTeam",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "winnerPlayerId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 5,
                    "name": "players",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "MsgRoomSnapshot/ResultPlayer"
                        }
                    }
                }
            ]
        },
        "MsgRoomSnapshot/ResultPlayer": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "id",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "team",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "rank",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "kills",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "deaths",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 6,
                    "name": "objectivesDestroyed",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 7,
                    "name": "combatScore",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 8,
                    "name": "outcomeBonus",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 9,
                    "name": "totalScore",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 10,
                    "name": "outcome",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "WIN"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "LOSE"
                                }
                            },
                            {
                                "id": 2,
                                "type": {
                                    "type": "Literal",
                                    "literal": "DRAW"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 11,
                    "name": "award",
                    "type": {
                        "type": "Reference",
                        "target": "MsgRoomSnapshot/ResultAward"
                    },
                    "optional": true
                },
                {
                    "id": 12,
                    "name": "roundStats",
                    "type": {
                        "type": "Reference",
                        "target": "MsgRoomSnapshot/RoundStats"
                    },
                    "optional": true
                },
                {
                    "id": 13,
                    "name": "awards",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "MsgRoomSnapshot/RoundAward"
                        }
                    },
                    "optional": true
                }
            ]
        },
        "MsgRoomState/MsgRoomState": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "roomId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "phase",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "players",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "MsgRoomState/RoomStatePlayer"
                        }
                    }
                },
                {
                    "id": 3,
                    "name": "message",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "MsgRoomState/RoomStatePlayer": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "id",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "MsgRoomWhisper/MsgRoomWhisper": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "id",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "roomId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "accountId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 4,
                    "name": "targetAccountId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 5,
                    "name": "senderName",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 6,
                    "name": "targetName",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 7,
                    "name": "text",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 8,
                    "name": "message",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "MsgTradeState/MsgTradeState": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "PtlTrade/ResTrade"
                    }
                }
            ]
        },
        "PtlTrade/ResTrade": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "session",
                    "type": {
                        "type": "Reference",
                        "target": "PtlTrade/TradeSession"
                    },
                    "optional": true
                },
                {
                    "id": 1,
                    "name": "account",
                    "type": {
                        "type": "Reference",
                        "target": "PtlTrade/TradeAccount"
                    }
                }
            ]
        },
        "PtlTrade/TradeSession": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "id",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "revision",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "phase",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "INVITED"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "OPEN"
                                }
                            },
                            {
                                "id": 2,
                                "type": {
                                    "type": "Literal",
                                    "literal": "COMPLETED"
                                }
                            },
                            {
                                "id": 3,
                                "type": {
                                    "type": "Literal",
                                    "literal": "CANCELLED"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 3,
                    "name": "inviterAccountId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 4,
                    "name": "parties",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "PtlTrade/TradeParty"
                        }
                    }
                },
                {
                    "id": 5,
                    "name": "reason",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                }
            ]
        },
        "PtlTrade/TradeParty": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "accountId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "offer",
                    "type": {
                        "type": "Reference",
                        "target": "PtlTrade/TradeOffer"
                    }
                },
                {
                    "id": 3,
                    "name": "records",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "PtlTrade/TradeRecordView"
                        }
                    }
                },
                {
                    "id": 4,
                    "name": "shown",
                    "type": {
                        "type": "Boolean"
                    }
                },
                {
                    "id": 5,
                    "name": "confirmed",
                    "type": {
                        "type": "Boolean"
                    }
                }
            ]
        },
        "PtlTrade/TradeOffer": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "money",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "originality",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "skillPoints",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "records",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "PtlTrade/TradeRecordRef"
                        }
                    }
                }
            ]
        },
        "PtlTrade/TradeRecordRef": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "kind",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "pet"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "tank"
                                }
                            },
                            {
                                "id": 2,
                                "type": {
                                    "type": "Literal",
                                    "literal": "item"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "instanceId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "quantity",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                }
            ]
        },
        "PtlTrade/TradeRecordView": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "PtlTrade/TradeRecordRef"
                    }
                }
            ],
            "properties": [
                {
                    "id": 0,
                    "name": "role",
                    "type": {
                        "type": "Reference",
                        "target": "PtlOwnedRoles/OwnedRoleRecordData"
                    },
                    "optional": true
                },
                {
                    "id": 1,
                    "name": "item",
                    "type": {
                        "type": "Reference",
                        "target": "PtlInventory/InventoryWireRecord"
                    },
                    "optional": true
                }
            ]
        },
        "PtlOwnedRoles/OwnedRoleRecordData": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "fields",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Tuple",
                            "elementTypes": [
                                {
                                    "type": "Number"
                                },
                                {
                                    "type": "Number"
                                }
                            ]
                        }
                    }
                }
            ]
        },
        "PtlInventory/InventoryWireRecord": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "../combat/inventory-query/InventoryItemRecord"
                    }
                }
            ],
            "properties": [
                {
                    "id": 0,
                    "name": "field8",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "float24Bits",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "float28Bits",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "float2cBits",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "../combat/inventory-query/InventoryItemRecord": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "../combat/item-hotkeys/BattleItemRecord"
                    }
                }
            ],
            "properties": [
                {
                    "id": 0,
                    "name": "state",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "../combat/item-hotkeys/BattleItemRecord": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "instanceId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "itemTableId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "ownedQuantity",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "battleQuantity",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlTrade/TradeAccount": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "accountId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "wallet",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "money",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 1,
                                "name": "originality",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 2,
                                "name": "skillPoints",
                                "type": {
                                    "type": "Number"
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "owned",
                    "type": {
                        "type": "Reference",
                        "target": "PtlOwnedRoles/ResOwnedRoles"
                    }
                },
                {
                    "id": 3,
                    "name": "inventory",
                    "type": {
                        "type": "Reference",
                        "target": "PtlInventory/ResInventory"
                    }
                },
                {
                    "id": 4,
                    "name": "profile",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "bytes",
                                "type": {
                                    "type": "Array",
                                    "elementType": {
                                        "type": "Number"
                                    }
                                }
                            },
                            {
                                "id": 1,
                                "name": "strings",
                                "type": {
                                    "type": "Tuple",
                                    "elementTypes": [
                                        {
                                            "type": "String"
                                        },
                                        {
                                            "type": "String"
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    "optional": true
                }
            ]
        },
        "PtlOwnedRoles/ResOwnedRoles": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "base",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "PtlOwnedRoles/OwnedRoleRecordData"
                        }
                    }
                },
                {
                    "id": 1,
                    "name": "equipment",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "PtlOwnedRoles/OwnedRoleRecordData"
                        }
                    }
                }
            ]
        },
        "PtlInventory/ResInventory": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "records",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "PtlInventory/InventoryWireRecord"
                        }
                    }
                },
                {
                    "id": 1,
                    "name": "hotkeys",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Number"
                        }
                    }
                }
            ]
        },
        "PtlAccount/ReqAccount": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "token",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                },
                {
                    "id": 1,
                    "name": "credentials",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "operation",
                                "type": {
                                    "type": "Union",
                                    "members": [
                                        {
                                            "id": 0,
                                            "type": {
                                                "type": "Literal",
                                                "literal": "LOGIN"
                                            }
                                        },
                                        {
                                            "id": 1,
                                            "type": {
                                                "type": "Literal",
                                                "literal": "REGISTER"
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                "id": 1,
                                "name": "account",
                                "type": {
                                    "type": "String"
                                }
                            },
                            {
                                "id": 2,
                                "name": "password",
                                "type": {
                                    "type": "String"
                                }
                            }
                        ]
                    },
                    "optional": true
                }
            ]
        },
        "PtlAccount/ResAccount": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "accountId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "token",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "accountName",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                }
            ]
        },
        "PtlAutopilot/ReqAutopilot": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "enabled",
                    "type": {
                        "type": "Boolean"
                    }
                }
            ]
        },
        "PtlAutopilot/ResAutopilot": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "enabled",
                    "type": {
                        "type": "Boolean"
                    }
                }
            ]
        },
        "PtlBlacklist/ReqBlacklist": {
            "type": "Union",
            "members": [
                {
                    "id": 0,
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "operation",
                                "type": {
                                    "type": "Literal",
                                    "literal": "QUERY"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "operation",
                                "type": {
                                    "type": "Union",
                                    "members": [
                                        {
                                            "id": 0,
                                            "type": {
                                                "type": "Literal",
                                                "literal": "ADD"
                                            }
                                        },
                                        {
                                            "id": 1,
                                            "type": {
                                                "type": "Literal",
                                                "literal": "REMOVE"
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                "id": 1,
                                "name": "targetAccountId",
                                "type": {
                                    "type": "String"
                                }
                            }
                        ]
                    }
                }
            ]
        },
        "PtlBlacklist/ResBlacklist": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "blocked",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "PtlBlacklist/BlockedRecord"
                        }
                    }
                }
            ]
        },
        "PtlBlacklist/BlockedRecord": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "accountId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "online",
                    "type": {
                        "type": "Boolean"
                    }
                },
                {
                    "id": 3,
                    "name": "inRoom",
                    "type": {
                        "type": "Boolean"
                    }
                },
                {
                    "id": 4,
                    "name": "title",
                    "type": {
                        "type": "Reference",
                        "target": "MsgRoomSnapshot/PlayerTitle"
                    },
                    "optional": true
                }
            ]
        },
        "PtlChangeTeam/ReqChangeTeam": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "team",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlChangeTeam/ResChangeTeam": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "team",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlChannel/ReqChannel": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "operation",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "QUERY"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "ENTER"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "channelId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                }
            ]
        },
        "PtlChannel/ResChannel": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "channels",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Interface",
                            "properties": [
                                {
                                    "id": 0,
                                    "name": "id",
                                    "type": {
                                        "type": "String"
                                    }
                                },
                                {
                                    "id": 1,
                                    "name": "name",
                                    "type": {
                                        "type": "String"
                                    }
                                },
                                {
                                    "id": 2,
                                    "name": "region",
                                    "type": {
                                        "type": "String"
                                    }
                                },
                                {
                                    "id": 3,
                                    "name": "levelLabel",
                                    "type": {
                                        "type": "String"
                                    }
                                },
                                {
                                    "id": 4,
                                    "name": "available",
                                    "type": {
                                        "type": "Boolean"
                                    }
                                }
                            ]
                        }
                    }
                },
                {
                    "id": 1,
                    "name": "enteredChannelId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                }
            ]
        },
        "PtlCpu/ReqCpu": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "operation",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "ADD"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "REMOVE"
                                }
                            },
                            {
                                "id": 2,
                                "type": {
                                    "type": "Literal",
                                    "literal": "CONFIGURE"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 2,
                    "name": "tankId",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "playerId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                },
                {
                    "id": 4,
                    "name": "loadout",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "PtlCpu/CpuLoadoutItem"
                        }
                    },
                    "optional": true
                },
                {
                    "id": 5,
                    "name": "team",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                }
            ]
        },
        "PtlCpu/ResCpu": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "playerId",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "PtlKickRoomPlayer/ReqKickRoomPlayer": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "playerId",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "PtlKickRoomPlayer/ResKickRoomPlayer": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "playerId",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "PtlEditRoom/ReqEditRoom": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "mode",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "mapId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "roomName",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 4,
                    "name": "minPlayers",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "maxPlayers",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 6,
                    "name": "friendlyFire",
                    "type": {
                        "type": "Boolean"
                    }
                },
                {
                    "id": 7,
                    "name": "password",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                }
            ]
        },
        "PtlEditRoom/ResEditRoom": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlCreateRoom/ReqCreateRoom": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "mode",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "mapId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "roomName",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 3,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 4,
                    "name": "tankId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "password",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                },
                {
                    "id": 6,
                    "name": "minPlayers",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 7,
                    "name": "maxPlayers",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 8,
                    "name": "friendlyFire",
                    "type": {
                        "type": "Boolean"
                    },
                    "optional": true
                }
            ]
        },
        "PtlCreateRoom/ResCreateRoom": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "PtlJoin/ResJoin"
                    }
                }
            ]
        },
        "PtlJoin/ResJoin": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "playerId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "room",
                    "type": {
                        "type": "Reference",
                        "target": "PtlJoin/JoinRoom"
                    }
                },
                {
                    "id": 2,
                    "name": "serverTime",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlJoin/JoinRoom": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "id",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "mode",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "mapId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "players",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "PtlJoin/JoinPlayer"
                        }
                    }
                },
                {
                    "id": 5,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 6,
                    "name": "phase",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                }
            ]
        },
        "PtlJoin/JoinPlayer": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "id",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "tankId",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlDisplayName/ReqDisplayName": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "name",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                }
            ]
        },
        "PtlDisplayName/ResDisplayName": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "PtlEquipment/ReqEquipment": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "operation",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "QUERY"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "EQUIP"
                                }
                            },
                            {
                                "id": 2,
                                "type": {
                                    "type": "Literal",
                                    "literal": "UNEQUIP"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 3,
                    "name": "target",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "PART"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "DECORATION"
                                }
                            },
                            {
                                "id": 2,
                                "type": {
                                    "type": "Literal",
                                    "literal": "MARK"
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 1,
                    "name": "slot",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "instanceId",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                }
            ]
        },
        "PtlEquipment/ResEquipment": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "slots",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Number"
                        }
                    }
                },
                {
                    "id": 1,
                    "name": "slotCount",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "decorationInstanceId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "markInstanceId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "profile",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "bytes",
                                "type": {
                                    "type": "Array",
                                    "elementType": {
                                        "type": "Number"
                                    }
                                }
                            },
                            {
                                "id": 1,
                                "name": "strings",
                                "type": {
                                    "type": "Tuple",
                                    "elementTypes": [
                                        {
                                            "type": "String"
                                        },
                                        {
                                            "type": "String"
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                }
            ]
        },
        "PtlFriendChat/ReqFriendChat": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "text",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "roomId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                }
            ]
        },
        "PtlFriendChat/ResFriendChat": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "message",
                    "type": {
                        "type": "Reference",
                        "target": "MsgFriendChat/MsgFriendChat"
                    }
                },
                {
                    "id": 1,
                    "name": "recipientCount",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlFamily/ReqFamily": {
            "type": "Interface"
        },
        "PtlFamily/ResFamily": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "accountId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "family",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "id",
                                "type": {
                                    "type": "String"
                                }
                            },
                            {
                                "id": 1,
                                "name": "name",
                                "type": {
                                    "type": "String"
                                }
                            }
                        ]
                    },
                    "optional": true
                }
            ]
        },
        "PtlFamilyChat/ReqFamilyChat": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "text",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "roomId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                }
            ]
        },
        "PtlFamilyChat/ResFamilyChat": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "message",
                    "type": {
                        "type": "Reference",
                        "target": "MsgFamilyChat/MsgFamilyChat"
                    }
                },
                {
                    "id": 1,
                    "name": "recipientCount",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlFriends/ReqFriends": {
            "type": "Union",
            "members": [
                {
                    "id": 0,
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "operation",
                                "type": {
                                    "type": "Literal",
                                    "literal": "QUERY"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "operation",
                                "type": {
                                    "type": "Union",
                                    "members": [
                                        {
                                            "id": 0,
                                            "type": {
                                                "type": "Literal",
                                                "literal": "ADD"
                                            }
                                        },
                                        {
                                            "id": 1,
                                            "type": {
                                                "type": "Literal",
                                                "literal": "REMOVE"
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                "id": 1,
                                "name": "targetAccountId",
                                "type": {
                                    "type": "String"
                                }
                            }
                        ]
                    }
                }
            ]
        },
        "PtlFriends/ResFriends": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "friends",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "PtlFriends/FriendRecord"
                        }
                    }
                }
            ]
        },
        "PtlFriends/FriendRecord": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "accountId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "online",
                    "type": {
                        "type": "Boolean"
                    }
                },
                {
                    "id": 3,
                    "name": "inRoom",
                    "type": {
                        "type": "Boolean"
                    }
                },
                {
                    "id": 4,
                    "name": "title",
                    "type": {
                        "type": "Reference",
                        "target": "MsgRoomSnapshot/PlayerTitle"
                    },
                    "optional": true
                }
            ]
        },
        "PtlHistory/ReqHistory": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "offset",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 1,
                    "name": "limit",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                }
            ]
        },
        "PtlGmSupport/GmSupportReply": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "id",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "requestId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "question",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 3,
                    "name": "requestedAt",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "text",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 5,
                    "name": "repliedAt",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlGmSupport/ReqGmSupport": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "afterId",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                }
            ]
        },
        "PtlGmSupport/ResGmSupport": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "accountId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "replies",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "PtlGmSupport/GmSupportReply"
                        }
                    }
                },
                {
                    "id": 2,
                    "name": "nextAfterId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "hasMore",
                    "type": {
                        "type": "Boolean"
                    }
                }
            ]
        },
        "PtlHistory/ResHistory": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "records",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "PtlHistory/MatchHistoryRecord"
                        }
                    }
                },
                {
                    "id": 1,
                    "name": "total",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "offset",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "limit",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlHistory/MatchHistoryRecord": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "matchId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "mode",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "mapId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "endedAt",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "reason",
                    "type": {
                        "type": "IndexedAccess",
                        "index": "reason",
                        "objectType": {
                            "type": "Reference",
                            "target": "MsgRoomSnapshot/MatchResult"
                        }
                    }
                },
                {
                    "id": 6,
                    "name": "result",
                    "type": {
                        "type": "Reference",
                        "target": "MsgRoomSnapshot/ResultPlayer"
                    }
                }
            ]
        },
        "PtlInventory/ReqInventory": {
            "type": "Interface"
        },
        "PtlJoin/ReqJoin": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "clientId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "tankId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "roomId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                },
                {
                    "id": 4,
                    "name": "password",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                }
            ]
        },
        "PtlKitbag/ReqKitbag": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "operation",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "ASSIGN"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "CANCEL"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "slot",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "instanceId",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                }
            ]
        },
        "PtlKitbag/ResKitbag": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "result",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "slot",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "instanceId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "hotkeys",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Number"
                        }
                    }
                }
            ]
        },
        "PtlLeave/ReqLeave": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "roomId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlLeave/ResLeave": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "roomId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlListMaps/ReqListMaps": {
            "type": "Interface"
        },
        "PtlListMaps/ResListMaps": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "maps",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "PtlListMaps/MapOption"
                        }
                    }
                }
            ]
        },
        "PtlListMaps/MapOption": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "mode",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "mapId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 3,
                    "name": "timeLimit",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "sourceMinPlayers",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "maxPlayers",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlListRooms/ReqListRooms": {
            "type": "Interface"
        },
        "PtlListRooms/ResListRooms": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "rooms",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "PtlListRooms/RoomSummary"
                        }
                    }
                }
            ]
        },
        "PtlLobbyChat/ReqLobbyChat": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "text",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "PtlLobbyChat/ResLobbyChat": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "message",
                    "type": {
                        "type": "Reference",
                        "target": "MsgLobbyChat/MsgLobbyChat"
                    }
                }
            ]
        },
        "PtlLobbyPlayers/ReqLobbyPlayers": {
            "type": "Interface"
        },
        "PtlLobbyPlayers/ResLobbyPlayers": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "players",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Interface",
                            "properties": [
                                {
                                    "id": 0,
                                    "name": "accountId",
                                    "type": {
                                        "type": "String"
                                    }
                                },
                                {
                                    "id": 1,
                                    "name": "name",
                                    "type": {
                                        "type": "String"
                                    }
                                },
                                {
                                    "id": 2,
                                    "name": "title",
                                    "type": {
                                        "type": "Reference",
                                        "target": "MsgRoomSnapshot/PlayerTitle"
                                    },
                                    "optional": true
                                }
                            ]
                        }
                    }
                }
            ]
        },
        "PtlLobbyWhisper/ReqLobbyWhisper": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "text",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "targetAccountId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "targetName",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                }
            ]
        },
        "PtlLobbyWhisper/ResLobbyWhisper": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "message",
                    "type": {
                        "type": "Reference",
                        "target": "MsgLobbyWhisper/MsgLobbyWhisper"
                    }
                }
            ]
        },
        "PtlOwnedRoles/ReqOwnedRoles": {
            "type": "Interface"
        },
        "PtlOwnedRoleSale/ReqOwnedRoleSale": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "operation",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "QUERY"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "SELL"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "kind",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "pet"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "tank"
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "instanceId",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "requestId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                }
            ]
        },
        "PtlOwnedRoleSale/ResOwnedRoleSale": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "quotes",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Interface",
                            "properties": [
                                {
                                    "id": 0,
                                    "name": "kind",
                                    "type": {
                                        "type": "Union",
                                        "members": [
                                            {
                                                "id": 0,
                                                "type": {
                                                    "type": "Literal",
                                                    "literal": "pet"
                                                }
                                            },
                                            {
                                                "id": 1,
                                                "type": {
                                                    "type": "Literal",
                                                    "literal": "tank"
                                                }
                                            }
                                        ]
                                    }
                                },
                                {
                                    "id": 1,
                                    "name": "instanceId",
                                    "type": {
                                        "type": "Number"
                                    }
                                },
                                {
                                    "id": 2,
                                    "name": "definitionId",
                                    "type": {
                                        "type": "Number"
                                    }
                                },
                                {
                                    "id": 3,
                                    "name": "price",
                                    "type": {
                                        "type": "Number"
                                    }
                                },
                                {
                                    "id": 4,
                                    "name": "selected",
                                    "type": {
                                        "type": "Boolean"
                                    }
                                },
                                {
                                    "id": 5,
                                    "name": "canSell",
                                    "type": {
                                        "type": "Boolean"
                                    }
                                }
                            ]
                        }
                    }
                },
                {
                    "id": 1,
                    "name": "owned",
                    "type": {
                        "type": "Reference",
                        "target": "PtlOwnedRoles/ResOwnedRoles"
                    }
                },
                {
                    "id": 2,
                    "name": "money",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "profile",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "bytes",
                                "type": {
                                    "type": "Array",
                                    "elementType": {
                                        "type": "Number"
                                    }
                                }
                            },
                            {
                                "id": 1,
                                "name": "strings",
                                "type": {
                                    "type": "Tuple",
                                    "elementTypes": [
                                        {
                                            "type": "String"
                                        },
                                        {
                                            "type": "String"
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 4,
                    "name": "sold",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "kind",
                                "type": {
                                    "type": "Union",
                                    "members": [
                                        {
                                            "id": 0,
                                            "type": {
                                                "type": "Literal",
                                                "literal": "pet"
                                            }
                                        },
                                        {
                                            "id": 1,
                                            "type": {
                                                "type": "Literal",
                                                "literal": "tank"
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                "id": 1,
                                "name": "instanceId",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 2,
                                "name": "price",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 3,
                                "name": "result",
                                "type": {
                                    "type": "Literal",
                                    "literal": 2
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 5,
                    "name": "replayed",
                    "type": {
                        "type": "Boolean"
                    },
                    "optional": true
                }
            ]
        },
        "PtlPartMaintenance/ReqPartMaintenance": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "operation",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "QUERY"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "MAINTAIN"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "instanceId",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "days",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": 1
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": 7
                                }
                            },
                            {
                                "id": 2,
                                "type": {
                                    "type": "Literal",
                                    "literal": 30
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "currency",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": 0
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": 1
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 4,
                    "name": "requestId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                }
            ]
        },
        "PtlPartMaintenance/ResPartMaintenance": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "parts",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Interface",
                            "properties": [
                                {
                                    "id": 0,
                                    "name": "instanceId",
                                    "type": {
                                        "type": "Number"
                                    }
                                },
                                {
                                    "id": 1,
                                    "name": "itemTableId",
                                    "type": {
                                        "type": "Number"
                                    }
                                },
                                {
                                    "id": 2,
                                    "name": "remainingMinutes",
                                    "type": {
                                        "type": "Number"
                                    }
                                },
                                {
                                    "id": 3,
                                    "name": "canMaintain",
                                    "type": {
                                        "type": "Boolean"
                                    }
                                },
                                {
                                    "id": 4,
                                    "name": "quotes",
                                    "type": {
                                        "type": "Array",
                                        "elementType": {
                                            "type": "Reference",
                                            "target": "PtlPartMaintenance/PartMaintenanceQuote"
                                        }
                                    }
                                }
                            ]
                        }
                    }
                },
                {
                    "id": 1,
                    "name": "money",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "tokens",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "inventory",
                    "type": {
                        "type": "Reference",
                        "target": "PtlInventory/ResInventory"
                    }
                },
                {
                    "id": 4,
                    "name": "profile",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "bytes",
                                "type": {
                                    "type": "Array",
                                    "elementType": {
                                        "type": "Number"
                                    }
                                }
                            },
                            {
                                "id": 1,
                                "name": "strings",
                                "type": {
                                    "type": "Tuple",
                                    "elementTypes": [
                                        {
                                            "type": "String"
                                        },
                                        {
                                            "type": "String"
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 5,
                    "name": "maintained",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "instanceId",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 1,
                                "name": "remainingMinutes",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 2,
                                "name": "cost",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 3,
                                "name": "currency",
                                "type": {
                                    "type": "Union",
                                    "members": [
                                        {
                                            "id": 0,
                                            "type": {
                                                "type": "Literal",
                                                "literal": 0
                                            }
                                        },
                                        {
                                            "id": 1,
                                            "type": {
                                                "type": "Literal",
                                                "literal": 1
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                "id": 4,
                                "name": "days",
                                "type": {
                                    "type": "Union",
                                    "members": [
                                        {
                                            "id": 0,
                                            "type": {
                                                "type": "Literal",
                                                "literal": 1
                                            }
                                        },
                                        {
                                            "id": 1,
                                            "type": {
                                                "type": "Literal",
                                                "literal": 7
                                            }
                                        },
                                        {
                                            "id": 2,
                                            "type": {
                                                "type": "Literal",
                                                "literal": 30
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 6,
                    "name": "replayed",
                    "type": {
                        "type": "Boolean"
                    },
                    "optional": true
                }
            ]
        },
        "PtlPartMaintenance/PartMaintenanceQuote": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "days",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": 1
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": 7
                                }
                            },
                            {
                                "id": 2,
                                "type": {
                                    "type": "Literal",
                                    "literal": 30
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "currency",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": 0
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": 1
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 2,
                    "name": "cost",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "displayCost",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "PtlPartSale/ReqPartSale": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "operation",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "QUERY"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "SELL"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "instanceId",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "requestId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                }
            ]
        },
        "PtlPartSale/ResPartSale": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "quotes",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Interface",
                            "properties": [
                                {
                                    "id": 0,
                                    "name": "instanceId",
                                    "type": {
                                        "type": "Number"
                                    }
                                },
                                {
                                    "id": 1,
                                    "name": "itemTableId",
                                    "type": {
                                        "type": "Number"
                                    }
                                },
                                {
                                    "id": 2,
                                    "name": "price",
                                    "type": {
                                        "type": "Number"
                                    }
                                },
                                {
                                    "id": 3,
                                    "name": "canSell",
                                    "type": {
                                        "type": "Boolean"
                                    }
                                }
                            ]
                        }
                    }
                },
                {
                    "id": 1,
                    "name": "inventory",
                    "type": {
                        "type": "Reference",
                        "target": "PtlInventory/ResInventory"
                    }
                },
                {
                    "id": 2,
                    "name": "money",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "profile",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "bytes",
                                "type": {
                                    "type": "Array",
                                    "elementType": {
                                        "type": "Number"
                                    }
                                }
                            },
                            {
                                "id": 1,
                                "name": "strings",
                                "type": {
                                    "type": "Tuple",
                                    "elementTypes": [
                                        {
                                            "type": "String"
                                        },
                                        {
                                            "type": "String"
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 4,
                    "name": "sold",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "instanceId",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 1,
                                "name": "itemTableId",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 2,
                                "name": "price",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 3,
                                "name": "result",
                                "type": {
                                    "type": "Literal",
                                    "literal": 1
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 5,
                    "name": "replayed",
                    "type": {
                        "type": "Boolean"
                    },
                    "optional": true
                }
            ]
        },
        "PtlPetShop/ReqPetShop": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "operation",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "QUERY"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "BUY"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "petId",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "currency",
                    "type": {
                        "type": "Reference",
                        "target": "PtlShop/ShopCurrency"
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "requestId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                }
            ]
        },
        "PtlShop/ShopCurrency": {
            "type": "Union",
            "members": [
                {
                    "id": 0,
                    "type": {
                        "type": "Literal",
                        "literal": "MONEY"
                    }
                },
                {
                    "id": 1,
                    "type": {
                        "type": "Literal",
                        "literal": "TOKENS"
                    }
                }
            ]
        },
        "PtlPetShop/ResPetShop": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "pets",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "PtlPetShop/PetShopProduct"
                        }
                    }
                },
                {
                    "id": 1,
                    "name": "money",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "tokens",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "purchased",
                    "type": {
                        "type": "Reference",
                        "target": "PtlOwnedRoles/OwnedRoleRecordData"
                    },
                    "optional": true
                },
                {
                    "id": 4,
                    "name": "replayed",
                    "type": {
                        "type": "Boolean"
                    },
                    "optional": true
                }
            ]
        },
        "PtlPetShop/PetShopProduct": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "petId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "info",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 3,
                    "name": "moneyPrice",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "tokenPrice",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "maxHp",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 6,
                    "name": "petType",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 7,
                    "name": "petSize",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                }
            ]
        },
        "PtlPetSkillLearning/ReqPetSkillLearning": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "operation",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "QUERY"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "LEARN"
                                }
                            },
                            {
                                "id": 2,
                                "type": {
                                    "type": "Literal",
                                    "literal": "CONFIRM"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "instanceId",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "slot",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "requestId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                }
            ]
        },
        "PtlPetSkillLearning/ResPetSkillLearning": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "points",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 1,
                    "name": "quotes",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "../contracts/pet-learning/PetLearningQuote"
                        }
                    }
                },
                {
                    "id": 2,
                    "name": "owned",
                    "type": {
                        "type": "Reference",
                        "target": "PtlOwnedRoles/ResOwnedRoles"
                    }
                },
                {
                    "id": 3,
                    "name": "profile",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "bytes",
                                "type": {
                                    "type": "Array",
                                    "elementType": {
                                        "type": "Number"
                                    }
                                }
                            },
                            {
                                "id": 1,
                                "name": "strings",
                                "type": {
                                    "type": "Tuple",
                                    "elementTypes": [
                                        {
                                            "type": "String"
                                        },
                                        {
                                            "type": "String"
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 4,
                    "name": "learned",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "instanceId",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 1,
                                "name": "slot",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 2,
                                "name": "skillId",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 3,
                                "name": "rank",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 4,
                                "name": "cost",
                                "type": {
                                    "type": "Number"
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 5,
                    "name": "replayed",
                    "type": {
                        "type": "Boolean"
                    },
                    "optional": true
                },
                {
                    "id": 6,
                    "name": "confirmation",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "APPLIED"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "ABSENT"
                                }
                            }
                        ]
                    },
                    "optional": true
                }
            ]
        },
        "../contracts/pet-learning/PetLearningQuote": {
            "type": "Intersection",
            "members": [
                {
                    "id": 0,
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "instanceId",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 1,
                                "name": "petId",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 2,
                                "name": "slot",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 3,
                                "name": "baseId",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 4,
                                "name": "rank",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 5,
                                "name": "rankCap",
                                "type": {
                                    "type": "Number"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Interface",
                                    "properties": [
                                        {
                                            "id": 0,
                                            "name": "kind",
                                            "type": {
                                                "type": "Literal",
                                                "literal": "rankLimit"
                                            }
                                        },
                                        {
                                            "id": 1,
                                            "name": "originalFeedback",
                                            "type": {
                                                "type": "Literal",
                                                "literal": 0
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Interface",
                                    "properties": [
                                        {
                                            "id": 0,
                                            "name": "kind",
                                            "type": {
                                                "type": "Literal",
                                                "literal": "insufficientPoints"
                                            }
                                        },
                                        {
                                            "id": 1,
                                            "name": "originalFeedback",
                                            "type": {
                                                "type": "Literal",
                                                "literal": 2
                                            }
                                        },
                                        {
                                            "id": 2,
                                            "name": "nextSkillId",
                                            "type": {
                                                "type": "Number"
                                            }
                                        },
                                        {
                                            "id": 3,
                                            "name": "cost",
                                            "type": {
                                                "type": "Number"
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                "id": 2,
                                "type": {
                                    "type": "Interface",
                                    "properties": [
                                        {
                                            "id": 0,
                                            "name": "kind",
                                            "type": {
                                                "type": "Literal",
                                                "literal": "eligible"
                                            }
                                        },
                                        {
                                            "id": 1,
                                            "name": "nextSkillId",
                                            "type": {
                                                "type": "Number"
                                            }
                                        },
                                        {
                                            "id": 2,
                                            "name": "cost",
                                            "type": {
                                                "type": "Number"
                                            }
                                        },
                                        {
                                            "id": 3,
                                            "name": "nextRank",
                                            "type": {
                                                "type": "Number"
                                            }
                                        },
                                        {
                                            "id": 4,
                                            "name": "remainingPoints",
                                            "type": {
                                                "type": "Number"
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                }
            ]
        },
        "PtlQuickMatch/ReqQuickMatch": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "clientId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "tankId",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlQuickMatch/ResQuickMatch": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "roomId",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "PtlReady/ReqReady": {
            "type": "Interface",
            "properties": [
                {
                    "id": 2,
                    "name": "resourcesLoaded",
                    "type": {
                        "type": "Boolean"
                    },
                    "optional": true
                },
                {
                    "id": 0,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "isReady",
                    "type": {
                        "type": "Boolean"
                    },
                    "optional": true
                }
            ]
        },
        "PtlReady/ResReady": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlRematch/ReqRematch": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlRematch/ResRematch": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlResumeRoom/ReqResumeRoom": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "roomId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "playerId",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "PtlResumeRoom/ResResumeRoom": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "snapshot",
                    "type": {
                        "type": "Reference",
                        "target": "MsgRoomSnapshot/MsgRoomSnapshot"
                    }
                },
                {
                    "id": 1,
                    "name": "inputSequence",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlRoleProfile/ReqRoleProfile": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "selectTitleId",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                }
            ]
        },
        "PtlRoleProfile/ResRoleProfile": {
            "type": "Interface",
            "properties": [
                {
                    "id": 1,
                    "name": "playerSummary",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "score",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 1,
                                "name": "originality",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 2,
                                "name": "tech",
                                "type": {
                                    "type": "Number"
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 0,
                    "name": "profile",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "bytes",
                                "type": {
                                    "type": "Array",
                                    "elementType": {
                                        "type": "Number"
                                    }
                                }
                            },
                            {
                                "id": 1,
                                "name": "strings",
                                "type": {
                                    "type": "Tuple",
                                    "elementTypes": [
                                        {
                                            "type": "String"
                                        },
                                        {
                                            "type": "String"
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "growth",
                    "type": {
                        "type": "Reference",
                        "target": "MsgRoomSnapshot/AccountGrowth"
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "titles",
                    "type": {
                        "type": "Reference",
                        "target": "PtlRoleProfile/AccountTitles"
                    },
                    "optional": true
                },
                {
                    "id": 4,
                    "name": "statistics",
                    "type": {
                        "type": "Reference",
                        "target": "PtlRoleProfile/AccountStatistics"
                    },
                    "optional": true
                },
                {
                    "id": 5,
                    "name": "awards",
                    "type": {
                        "type": "Reference",
                        "target": "PtlRoleProfile/AwardCounts"
                    },
                    "optional": true
                }
            ]
        },
        "PtlPlayerProfile/ReqPlayerProfile": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "targetAccountId",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "PtlPlayerProfile/ResPlayerProfile": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "accountId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "level",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "score",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 4,
                    "name": "originality",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 5,
                    "name": "tech",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 6,
                    "name": "title",
                    "type": {
                        "type": "Reference",
                        "target": "MsgRoomSnapshot/PlayerTitle"
                    },
                    "optional": true
                },
                {
                    "id": 7,
                    "name": "statistics",
                    "type": {
                        "type": "Reference",
                        "target": "PtlRoleProfile/AccountStatistics"
                    },
                    "optional": true
                },
                {
                    "id": 8,
                    "name": "awards",
                    "type": {
                        "type": "Reference",
                        "target": "PtlRoleProfile/AwardCounts"
                    },
                    "optional": true
                }
            ]
        },
        "PtlPlayerSearch/ReqPlayerSearch": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "PtlPlayerSearch/ResPlayerSearch": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "players",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "PtlFriends/FriendRecord"
                        }
                    }
                }
            ]
        },
        "PtlRoomChat/ReqRoomChat": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "channel",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "text",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "PtlRoomChat/ResRoomChat": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "roomId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "playerId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "message",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "PtlRoomInvite/ReqRoomInvite": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "roomId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlRoomInvite/ResRoomInvite": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "invitationId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "recipientCount",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "expiresAt",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlRoomWhisper/ReqRoomWhisper": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "text",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 1,
                    "name": "targetName",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "roomId",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 3,
                    "name": "round",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlRoomWhisper/ResRoomWhisper": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "message",
                    "type": {
                        "type": "Reference",
                        "target": "MsgRoomWhisper/MsgRoomWhisper"
                    }
                }
            ]
        },
        "PtlSelectRole/ReqSelectRole": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "kind",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "pet"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "tank"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "instanceId",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlSelectRole/ResSelectRole": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "code",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": 0
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": 1
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "profile",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "bytes",
                                "type": {
                                    "type": "Array",
                                    "elementType": {
                                        "type": "Number"
                                    }
                                }
                            },
                            {
                                "id": 1,
                                "name": "strings",
                                "type": {
                                    "type": "Tuple",
                                    "elementTypes": [
                                        {
                                            "type": "String"
                                        },
                                        {
                                            "type": "String"
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                }
            ]
        },
        "PtlShop/ReqShop": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "operation",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "QUERY"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "BUY"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "itemTableId",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "quantity",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "currency",
                    "type": {
                        "type": "Reference",
                        "target": "PtlShop/ShopCurrency"
                    },
                    "optional": true
                },
                {
                    "id": 4,
                    "name": "requestId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                }
            ]
        },
        "PtlShop/ResShop": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "items",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "PtlShop/ShopItem"
                        }
                    }
                },
                {
                    "id": 1,
                    "name": "money",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "tokens",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "purchased",
                    "type": {
                        "type": "Reference",
                        "target": "PtlInventory/InventoryWireRecord"
                    },
                    "optional": true
                },
                {
                    "id": 4,
                    "name": "replayed",
                    "type": {
                        "type": "Boolean"
                    },
                    "optional": true
                }
            ]
        },
        "PtlShop/ShopItem": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "itemTableId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "info",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 3,
                    "name": "iconId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "moneyPrice",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "tokenPrice",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 6,
                    "name": "getMethod",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 7,
                    "name": "durable",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                }
            ]
        },
        "PtlStackItemSale/ReqStackItemSale": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "operation",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "QUERY"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "SELL"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "instanceId",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "quantity",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "requestId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                }
            ]
        },
        "PtlStackItemSale/ResStackItemSale": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "quotes",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Interface",
                            "properties": [
                                {
                                    "id": 0,
                                    "name": "instanceId",
                                    "type": {
                                        "type": "Number"
                                    }
                                },
                                {
                                    "id": 1,
                                    "name": "itemTableId",
                                    "type": {
                                        "type": "Number"
                                    }
                                },
                                {
                                    "id": 2,
                                    "name": "ownedQuantity",
                                    "type": {
                                        "type": "Number"
                                    }
                                },
                                {
                                    "id": 3,
                                    "name": "unitPrice",
                                    "type": {
                                        "type": "Number"
                                    }
                                },
                                {
                                    "id": 4,
                                    "name": "canSell",
                                    "type": {
                                        "type": "Boolean"
                                    }
                                }
                            ]
                        }
                    }
                },
                {
                    "id": 1,
                    "name": "inventory",
                    "type": {
                        "type": "Reference",
                        "target": "PtlInventory/ResInventory"
                    }
                },
                {
                    "id": 2,
                    "name": "money",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "profile",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "bytes",
                                "type": {
                                    "type": "Array",
                                    "elementType": {
                                        "type": "Number"
                                    }
                                }
                            },
                            {
                                "id": 1,
                                "name": "strings",
                                "type": {
                                    "type": "Tuple",
                                    "elementTypes": [
                                        {
                                            "type": "String"
                                        },
                                        {
                                            "type": "String"
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 4,
                    "name": "sold",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "instanceId",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 1,
                                "name": "itemTableId",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 2,
                                "name": "quantity",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 3,
                                "name": "price",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 4,
                                "name": "result",
                                "type": {
                                    "type": "Literal",
                                    "literal": 2
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 5,
                    "name": "replayed",
                    "type": {
                        "type": "Boolean"
                    },
                    "optional": true
                }
            ]
        },
        "PtlTankMaintenance/ReqTankMaintenance": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "operation",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "QUERY"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "MAINTAIN"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "instanceId",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "days",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": 1
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": 7
                                }
                            },
                            {
                                "id": 2,
                                "type": {
                                    "type": "Literal",
                                    "literal": 30
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "currency",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": 0
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": 1
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 4,
                    "name": "requestId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                }
            ]
        },
        "PtlTankMaintenance/ResTankMaintenance": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "tanks",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Interface",
                            "properties": [
                                {
                                    "id": 0,
                                    "name": "instanceId",
                                    "type": {
                                        "type": "Number"
                                    }
                                },
                                {
                                    "id": 1,
                                    "name": "tankId",
                                    "type": {
                                        "type": "Number"
                                    }
                                },
                                {
                                    "id": 2,
                                    "name": "remainingMinutes",
                                    "type": {
                                        "type": "Number"
                                    }
                                },
                                {
                                    "id": 3,
                                    "name": "quotes",
                                    "type": {
                                        "type": "Array",
                                        "elementType": {
                                            "type": "Reference",
                                            "target": "PtlTankMaintenance/TankMaintenanceQuote"
                                        }
                                    }
                                }
                            ]
                        }
                    }
                },
                {
                    "id": 1,
                    "name": "money",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "tokens",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "owned",
                    "type": {
                        "type": "Reference",
                        "target": "PtlOwnedRoles/ResOwnedRoles"
                    }
                },
                {
                    "id": 4,
                    "name": "profile",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "bytes",
                                "type": {
                                    "type": "Array",
                                    "elementType": {
                                        "type": "Number"
                                    }
                                }
                            },
                            {
                                "id": 1,
                                "name": "strings",
                                "type": {
                                    "type": "Tuple",
                                    "elementTypes": [
                                        {
                                            "type": "String"
                                        },
                                        {
                                            "type": "String"
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 5,
                    "name": "maintained",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "instanceId",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 1,
                                "name": "remainingMinutes",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 2,
                                "name": "cost",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 3,
                                "name": "currency",
                                "type": {
                                    "type": "Union",
                                    "members": [
                                        {
                                            "id": 0,
                                            "type": {
                                                "type": "Literal",
                                                "literal": 0
                                            }
                                        },
                                        {
                                            "id": 1,
                                            "type": {
                                                "type": "Literal",
                                                "literal": 1
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                "id": 4,
                                "name": "days",
                                "type": {
                                    "type": "Union",
                                    "members": [
                                        {
                                            "id": 0,
                                            "type": {
                                                "type": "Literal",
                                                "literal": 1
                                            }
                                        },
                                        {
                                            "id": 1,
                                            "type": {
                                                "type": "Literal",
                                                "literal": 7
                                            }
                                        },
                                        {
                                            "id": 2,
                                            "type": {
                                                "type": "Literal",
                                                "literal": 30
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 6,
                    "name": "replayed",
                    "type": {
                        "type": "Boolean"
                    },
                    "optional": true
                }
            ]
        },
        "PtlTankMaintenance/TankMaintenanceQuote": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "days",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": 1
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": 7
                                }
                            },
                            {
                                "id": 2,
                                "type": {
                                    "type": "Literal",
                                    "literal": 30
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "currency",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": 0
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": 1
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 2,
                    "name": "cost",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "displayCost",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "PtlTankShop/ReqTankShop": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "operation",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "QUERY"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "BUY"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "tankId",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "currency",
                    "type": {
                        "type": "Reference",
                        "target": "PtlShop/ShopCurrency"
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "requestId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                }
            ]
        },
        "PtlTankShop/ResTankShop": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "tanks",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "PtlTankShop/TankShopProduct"
                        }
                    }
                },
                {
                    "id": 1,
                    "name": "money",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "tokens",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "purchased",
                    "type": {
                        "type": "Reference",
                        "target": "PtlOwnedRoles/OwnedRoleRecordData"
                    },
                    "optional": true
                },
                {
                    "id": 4,
                    "name": "replayed",
                    "type": {
                        "type": "Boolean"
                    },
                    "optional": true
                }
            ]
        },
        "PtlTankShop/TankShopProduct": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "tankId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 2,
                    "name": "info",
                    "type": {
                        "type": "String"
                    }
                },
                {
                    "id": 3,
                    "name": "moneyPrice",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "tokenPrice",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 6,
                    "name": "tankType",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 7,
                    "name": "defaultDurability",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 5,
                    "name": "textures",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "U",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 1,
                                "name": "M",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 2,
                                "name": "XY",
                                "type": {
                                    "type": "Number"
                                }
                            }
                        ]
                    }
                }
            ]
        },
        "PtlTankTextures/ReqTankTextures": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "instanceId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "textures",
                    "type": {
                        "type": "Reference",
                        "target": "../combat/role-owned-textures/OwnedTankTextures"
                    }
                }
            ]
        },
        "PtlTankTextures/ResTankTextures": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "confirmation",
                    "type": {
                        "type": "Reference",
                        "target": "../contracts/tank-textures/RoleTankTextureConfirmation"
                    }
                },
                {
                    "id": 1,
                    "name": "owned",
                    "type": {
                        "type": "Reference",
                        "target": "PtlOwnedRoles/ResOwnedRoles"
                    }
                },
                {
                    "id": 2,
                    "name": "profile",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "bytes",
                                "type": {
                                    "type": "Array",
                                    "elementType": {
                                        "type": "Number"
                                    }
                                }
                            },
                            {
                                "id": 1,
                                "name": "strings",
                                "type": {
                                    "type": "Tuple",
                                    "elementTypes": [
                                        {
                                            "type": "String"
                                        },
                                        {
                                            "type": "String"
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                }
            ]
        },
        "../contracts/tank-textures/RoleTankTextureConfirmation": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "instanceId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "textures",
                    "type": {
                        "type": "Reference",
                        "target": "../combat/role-owned-textures/OwnedTankTextures"
                    }
                },
                {
                    "id": 2,
                    "name": "tokens",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "money",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "result",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlTrade/ReqTrade": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "operation",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "QUERY"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "INVITE"
                                }
                            },
                            {
                                "id": 2,
                                "type": {
                                    "type": "Literal",
                                    "literal": "RESPOND"
                                }
                            },
                            {
                                "id": 3,
                                "type": {
                                    "type": "Literal",
                                    "literal": "OFFER"
                                }
                            },
                            {
                                "id": 4,
                                "type": {
                                    "type": "Literal",
                                    "literal": "SHOW"
                                }
                            },
                            {
                                "id": 5,
                                "type": {
                                    "type": "Literal",
                                    "literal": "UNSHOW"
                                }
                            },
                            {
                                "id": 6,
                                "type": {
                                    "type": "Literal",
                                    "literal": "CONFIRM"
                                }
                            },
                            {
                                "id": 7,
                                "type": {
                                    "type": "Literal",
                                    "literal": "CANCEL"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "targetAccountId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "sessionId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "accept",
                    "type": {
                        "type": "Boolean"
                    },
                    "optional": true
                },
                {
                    "id": 4,
                    "name": "offer",
                    "type": {
                        "type": "Reference",
                        "target": "PtlTrade/TradeOffer"
                    },
                    "optional": true
                },
                {
                    "id": 5,
                    "name": "expectedRevision",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                }
            ]
        },
        "MsgRoomSnapshot/PlayerTitle": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "id",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "name",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "PtlRoleProfile/OwnedTitle": {
            "type": "Interface",
            "extends": [
                {
                    "id": 0,
                    "type": {
                        "type": "Reference",
                        "target": "MsgRoomSnapshot/PlayerTitle"
                    }
                }
            ],
            "properties": [
                {
                    "id": 0,
                    "name": "description",
                    "type": {
                        "type": "String"
                    }
                }
            ]
        },
        "PtlRoleProfile/AccountTitles": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "owned",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "PtlRoleProfile/OwnedTitle"
                        }
                    }
                },
                {
                    "id": 1,
                    "name": "selectedTitleId",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "MsgRoomSnapshot/RoleDisguiseSnapshot": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "skillId",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": 10
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": 11
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "style",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": 1
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": 2
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 2,
                    "name": "startedAt",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "expiresAt",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "x",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "y",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 6,
                    "name": "z",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "MsgRoomSnapshot/AccountGrowth": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "rankPoints",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "level",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "originality",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "tech",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "MsgRoomSnapshot/ResultAward": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "money",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "coin",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "originality",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "tech",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "rankPoints",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "levelBefore",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 6,
                    "name": "levelAfter",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 7,
                    "name": "expPercent",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "MsgRoomSnapshot/AwardType": {
            "type": "Union",
            "members": [
                {
                    "id": 0,
                    "type": {
                        "type": "Literal",
                        "literal": "perfect"
                    }
                },
                {
                    "id": 1,
                    "type": {
                        "type": "Literal",
                        "literal": "mvp"
                    }
                },
                {
                    "id": 2,
                    "type": {
                        "type": "Literal",
                        "literal": "savage"
                    }
                },
                {
                    "id": 3,
                    "type": {
                        "type": "Literal",
                        "literal": "console"
                    }
                },
                {
                    "id": 4,
                    "type": {
                        "type": "Literal",
                        "literal": "brave"
                    }
                },
                {
                    "id": 5,
                    "type": {
                        "type": "Literal",
                        "literal": "kind"
                    }
                },
                {
                    "id": 6,
                    "type": {
                        "type": "Literal",
                        "literal": "crafty"
                    }
                },
                {
                    "id": 7,
                    "type": {
                        "type": "Literal",
                        "literal": "shy"
                    }
                },
                {
                    "id": 8,
                    "type": {
                        "type": "Literal",
                        "literal": "greedy"
                    }
                }
            ]
        },
        "MsgRoomSnapshot/RoundStats": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "shots",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "hits",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "damage",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "damageTaken",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "killCombo",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "friendlyFireDamage",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 6,
                    "name": "healing",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 7,
                    "name": "rearDamage",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "MsgRoomSnapshot/RoundAward": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "type",
                    "type": {
                        "type": "Reference",
                        "target": "MsgRoomSnapshot/AwardType"
                    }
                },
                {
                    "id": 1,
                    "name": "score",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlRoleProfile/AccountStatistics": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "wins",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "losses",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "draws",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "winStreak",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "loseStreak",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "battleSeconds",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 6,
                    "name": "kills",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 7,
                    "name": "deaths",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 8,
                    "name": "shots",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 9,
                    "name": "hits",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 10,
                    "name": "damage",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 11,
                    "name": "killCombo",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 12,
                    "name": "spentMoney",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 13,
                    "name": "spentTokens",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                }
            ]
        },
        "PtlRoleProfile/AwardCounts": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "perfect",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "mvp",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "savage",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "console",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "brave",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "kind",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 6,
                    "name": "crafty",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 7,
                    "name": "shy",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 8,
                    "name": "greedy",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlTankUpgrade/ReqTankUpgrade": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "operation",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "QUERY"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "UPGRADE"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "instanceId",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "action",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": 1
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": 2
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "requestId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                }
            ]
        },
        "PtlTankUpgrade/ResTankUpgrade": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "owned",
                    "type": {
                        "type": "Reference",
                        "target": "PtlOwnedRoles/ResOwnedRoles"
                    }
                },
                {
                    "id": 1,
                    "name": "profile",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "bytes",
                                "type": {
                                    "type": "Array",
                                    "elementType": {
                                        "type": "Number"
                                    }
                                }
                            },
                            {
                                "id": 1,
                                "name": "strings",
                                "type": {
                                    "type": "Tuple",
                                    "elementTypes": [
                                        {
                                            "type": "String"
                                        },
                                        {
                                            "type": "String"
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "quotes",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Reference",
                            "target": "PtlTankUpgrade/TankUpgradeQuote"
                        }
                    }
                },
                {
                    "id": 3,
                    "name": "confirmation",
                    "type": {
                        "type": "Reference",
                        "target": "PtlTankUpgrade/TankUpgradeConfirmation"
                    },
                    "optional": true
                },
                {
                    "id": 4,
                    "name": "historicalConfirmation",
                    "type": {
                        "type": "Reference",
                        "target": "PtlTankUpgrade/TankUpgradeConfirmation"
                    },
                    "optional": true
                },
                {
                    "id": 5,
                    "name": "replayed",
                    "type": {
                        "type": "Boolean"
                    },
                    "optional": true
                }
            ]
        },
        "PtlTankUpgrade/TankUpgradeQuote": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "instanceId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 1,
                    "name": "action",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": 1
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": 2
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 2,
                    "name": "currentLevel",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "nextLevel",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "nextAttributeMin",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "nextAttributeMax",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 6,
                    "name": "nextBonusMin",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 7,
                    "name": "nextBonusMax",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 8,
                    "name": "enabled",
                    "type": {
                        "type": "Boolean"
                    }
                },
                {
                    "id": 9,
                    "name": "moneyCost",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 10,
                    "name": "originalityCost",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 11,
                    "name": "success",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 12,
                    "name": "fail",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 13,
                    "name": "noEffect",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 14,
                    "name": "canUpgrade",
                    "type": {
                        "type": "Boolean"
                    }
                },
                {
                    "id": 15,
                    "name": "reason",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "UPGRADE_TARGET_UNAVAILABLE"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "UPGRADE_MONEY_REQUIRED"
                                }
                            },
                            {
                                "id": 2,
                                "type": {
                                    "type": "Literal",
                                    "literal": "UPGRADE_ORIGINALITY_REQUIRED"
                                }
                            },
                            {
                                "id": 3,
                                "type": {
                                    "type": "Literal",
                                    "literal": "UPGRADE_DISABLED"
                                }
                            }
                        ]
                    },
                    "optional": true
                }
            ]
        },
        "PtlTankUpgrade/TankUpgradeConfirmation": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "action",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": 1
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": 2
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "instanceId",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 2,
                    "name": "money",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 3,
                    "name": "originality",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 4,
                    "name": "attribute",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 5,
                    "name": "bonus",
                    "type": {
                        "type": "Number"
                    }
                },
                {
                    "id": 6,
                    "name": "result",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": 0
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": 1
                                }
                            },
                            {
                                "id": 2,
                                "type": {
                                    "type": "Literal",
                                    "literal": 2
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 7,
                    "name": "level",
                    "type": {
                        "type": "Number"
                    }
                }
            ]
        },
        "PtlValuableItemSale/ReqValuableItemSale": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "operation",
                    "type": {
                        "type": "Union",
                        "members": [
                            {
                                "id": 0,
                                "type": {
                                    "type": "Literal",
                                    "literal": "QUERY"
                                }
                            },
                            {
                                "id": 1,
                                "type": {
                                    "type": "Literal",
                                    "literal": "SELL"
                                }
                            }
                        ]
                    }
                },
                {
                    "id": 1,
                    "name": "instanceId",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 2,
                    "name": "quantity",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "requestId",
                    "type": {
                        "type": "String"
                    },
                    "optional": true
                }
            ]
        },
        "PtlValuableItemSale/ResValuableItemSale": {
            "type": "Interface",
            "properties": [
                {
                    "id": 0,
                    "name": "quotes",
                    "type": {
                        "type": "Array",
                        "elementType": {
                            "type": "Interface",
                            "properties": [
                                {
                                    "id": 0,
                                    "name": "instanceId",
                                    "type": {
                                        "type": "Number"
                                    }
                                },
                                {
                                    "id": 1,
                                    "name": "itemTableId",
                                    "type": {
                                        "type": "Number"
                                    }
                                },
                                {
                                    "id": 2,
                                    "name": "ownedQuantity",
                                    "type": {
                                        "type": "Number"
                                    }
                                },
                                {
                                    "id": 3,
                                    "name": "unitPrice",
                                    "type": {
                                        "type": "Number"
                                    }
                                },
                                {
                                    "id": 4,
                                    "name": "canSell",
                                    "type": {
                                        "type": "Boolean"
                                    }
                                }
                            ]
                        }
                    }
                },
                {
                    "id": 1,
                    "name": "inventory",
                    "type": {
                        "type": "Reference",
                        "target": "PtlInventory/ResInventory"
                    }
                },
                {
                    "id": 2,
                    "name": "money",
                    "type": {
                        "type": "Number"
                    },
                    "optional": true
                },
                {
                    "id": 3,
                    "name": "profile",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "bytes",
                                "type": {
                                    "type": "Array",
                                    "elementType": {
                                        "type": "Number"
                                    }
                                }
                            },
                            {
                                "id": 1,
                                "name": "strings",
                                "type": {
                                    "type": "Tuple",
                                    "elementTypes": [
                                        {
                                            "type": "String"
                                        },
                                        {
                                            "type": "String"
                                        }
                                    ]
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 4,
                    "name": "sold",
                    "type": {
                        "type": "Interface",
                        "properties": [
                            {
                                "id": 0,
                                "name": "instanceId",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 1,
                                "name": "itemTableId",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 2,
                                "name": "quantity",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 3,
                                "name": "price",
                                "type": {
                                    "type": "Number"
                                }
                            },
                            {
                                "id": 4,
                                "name": "result",
                                "type": {
                                    "type": "Literal",
                                    "literal": 2
                                }
                            }
                        ]
                    },
                    "optional": true
                },
                {
                    "id": 5,
                    "name": "replayed",
                    "type": {
                        "type": "Boolean"
                    },
                    "optional": true
                }
            ]
        }
    }
};
