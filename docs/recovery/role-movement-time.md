# 原运动时间限幅接线

原433190接受f32 delta，非正直接返回而不调用运动包装；正delta先最大1，435088再最大f32(.2)。正式battle/roles/movement-time实现这两入口合成的运动elapsed合同，actors只把它用于车体yaw与位置推进，非正跳过位置更新。独立瞄准、角色计时、CPU思考、射击与弹丸调度仍各用自身现有合同，没有用运动上限替代全局delta。

`npm run test:combat:movement-time`核对84原角色实参路径和255原wrapper尝试的时间上限，再用真实World普通玩家输入验证200、400、1500ms得到相同运动与车体转向，以及零/负时间不反向。原几何、速度和地图中心扫掠仍保留为明确待恢复行为。没有用时间限幅证明完整原运动完成。

相关回归：角色许可拒绝/恢复与独立aim/fire、五模式CPU普通输入连续两局、真实联机移动/开火/再战、账户原子迷彩事务与重启持久化全部通过。npx tsc --noEmit、219正式可达模块边界及独立服务端构建通过。证据为movement-time-runtime.log、movement-time-permission.log、movement-time-cpu-two-rounds.log、movement-time-network.log和movement-time-accounts.log；原时间入口证据见role-movement-dispatch.md及role-movement-wrapper.md。
