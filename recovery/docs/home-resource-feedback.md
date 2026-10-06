# 我的家资源失败反馈

M5-07 / M5-08 / M5-09。Inventory、Roles、Equipment资源加载失败使用独立resourceError状态；成功账户查询继续保留失败反馈。资源不可用时显示“我的家暂时无法显示”“请返回大厅后重新打开。”与现有返回按钮。正常关闭并重新打开恢复资源与原页，账户身份不变。

三页精确接入home-resource-feedback.tsx/css与各自未加载资源分支。成功页面几何、附件字体、预览、账户查询及事务保持原合同，无新增重试接口。

组合证据见home-resource-feedback-accepted.json。真实HTTP503后的成功查询、返回与重开恢复已覆盖三页；800/1920/3840三完整反馈图已亲审。Equipment单独尾段04-38-12-901Z PASS，成功Inventory/Equipment QUERY/OwnedRoles响应后错误仍显示，返回严格Home入口，重开sourceRoot/noFeedback/sameToken成立。全范围0购买、装备写、角色选择或房间事务。原始失败记录保存在accepted.rawFailures。

Equipment使用既有marker账户的原生SQLite只读备份副本，严格核token身份。原checkpoint含资金fixture；本次未注入资金、库存或角色资料，原库未修改。前提见home-resource-equipment-checkpoint-precondition.json。全部浏览器、服务与临时目录清理，3481/5511/9711无监听。

工程采用terrain22-ammo2013-home-resource-production-web-build.log：types/build exit0、Vite1m46，最终五文件已同步发行。根主审范围见accepted.mainReview。

未完成范围：原native资源错误producer与完整页面1:1父项。
