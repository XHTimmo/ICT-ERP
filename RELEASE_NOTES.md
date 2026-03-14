# v1.3.2 更新日志

## 差旅管理 (Travel Management)
- **状态统一**: 差旅报销状态与报销清单完全统一，使用中文状态名：
  - `待提交` (Pending Submission)
  - `待审核` (Pending Approval)
  - `待打款` (Pending Reimbursement)
  - `已完成` (Completed)
  - `材料不齐` (Incomplete Materials)
- **字段优化**: 移除“申请人”字段，简化录入流程。

## 数据看板 (Dashboard)
- **统计增强**: 看板统计现已包含差旅报销金额。
  - “总报销金额”与“总报销单数”包含差旅数据。
  - “未完成总金额”包含未闭环的差旅申请金额。
- **逻辑修复**: 修复了看板中差旅状态映射的问题，确保所有状态正确归类统计。
