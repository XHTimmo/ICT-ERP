# ERP 系统 (ERP System) 技术文档

**版本**: v1.3.4  
**最后更新**: 2026-03-26

## 1. 项目简介

本 ERP 系统是一个基于 Electron + Vue 3 的桌面应用程序，聚焦「报销管理」。
v1.3.4 版本主要修复了新增报销时因为缺少报销单号字段导致的报错问题。

核心能力：
- **报销单号管理**：支持录入、修改报销单号，并支持在列表中按报销单号进行排序。
- **状态统一**：差旅报销与普通报销使用统一的状态体系（待提交、待审核、待打款、已完成、材料不齐）。
- **字段优化**：简化差旅报销流程，移除了冗余的“申请人”字段。
- **全生命周期管理**：报销条目创建、状态流转、凭证补交、批量导出、统计看板。
- **自动化集成**：GitHub Actions 多平台构建与发布，支持标签触发自动发版。
- **自动更新**：集成 electron-updater，启动时自动检测 GitHub Releases 新版本。

## 2. 技术栈 (Tech Stack)

- **桌面框架**: Electron (主进程/渲染进程架构)
- **前端框架**: Vue 3 (Composition API) + Vite
- **UI 组件库**: Element Plus
- **可视化**: ECharts (多维度图表)
- **数据存储**: Better-SQLite3 (本地数据库) + Electron-Store (用户配置)
- **自动更新**: electron-updater
- **CI/CD**: GitHub Actions (构建 Windows/macOS 安装包)

## 3. 业务逻辑与新特性 (Business Logic & Features)

### 3.1 差旅状态统一 (v1.3.2)
- **统一状态**: 差旅报销状态现已与普通报销完全一致：
  - `待提交` (Pending Submission)
  - `待审核` (Pending Approval)
  - `待打款` (Pending Reimbursement)
  - `已完成` (Completed)
  - `材料不齐` (Incomplete Materials)
- **字段简化**: 移除了差旅报销中的“申请人”字段，简化录入。

### 3.2 数据看板增强 (v1.3.2)
- **全量统计**: 看板统计现在包含所有类型的报销数据（普通报销 + 差旅报销）。
- **未完成统计**: “未完成总金额”现在正确包含未闭环的差旅申请金额。

### 3.3 核心业务流程
- **报销单管理**: 创建、状态变更、凭证补交、删除。
- **批量导出**: 按 ID 列表生成 ZIP，包含规范命名的附件和清单 CSV。

## 4. 数据库设计 (Database Schema)

### `reimbursements` (报销单)
- `id`: TEXT (UUID)
- `serial_no`: INTEGER (唯一序号)
- `receipt_no`: TEXT (报销单号)
- `date`: TEXT
- `amount`: REAL
- `category`: TEXT
- `name`: TEXT
- `description`: TEXT
- `proofs`: TEXT (JSON)
- `status`: TEXT
- `created_at`: INTEGER

### `travels` (差旅报销单)
- `id`: TEXT (UUID)
- `date`: TEXT
- `reason`: TEXT
- `status`: TEXT
- `total_amount`: REAL
- `itineraries`: TEXT (JSON)
- `created_at`: INTEGER
- *注*: `applicant` 字段已弃用。

### `reimbursement_logs` (操作日志)
- `id`: INTEGER
- `reimbursement_id`: TEXT
- `action`: TEXT
- `details`: TEXT
- `created_at`: INTEGER

### `categories` (报销类别)
- `id`: INTEGER
- `name`: TEXT (Unique)
- `sort_order`: INTEGER
- `created_at`: INTEGER

## 5. 构建与发布 (Build & Release)

- **开发**: `bun run dev`
- **构建**:
  - 本地构建: `bun run build`
  - 自动发布: `git tag v1.3.4 && git push origin v1.3.4`
- **配置**: `package.json` 中配置了 `electron-builder`，支持 `nsis` (Windows) 和 `dmg` (macOS)。

## 6. 更新日志 (Changelog)

### v1.3.4
- **Fix**: 修复新增报销时缺少 `receipt_no` 字段导致的提交报错问题，增加参数默认值防御。
- **Docs**: 更新技术文档至 v1.3.4，记录发布信息。

### v1.3.3
- **Feat**: 报销模块新增“报销单号”字段，并支持在列表页按该字段排序。
- **Docs**: 更新技术文档至 v1.3.3。

### v1.3.2
- **Refactor**: 统一差旅报销状态与普通报销状态（使用中文状态名）。
- **Feat**: 看板统计纳入差旅报销数据，实现全量资金监控。
- **Fix**: 修复看板中差旅状态映射问题。
- **Chore**: 移除差旅报销中的“申请人”字段。

### v1.3.1
- **Feat**: 看板新增月度趋势图、类别/状态占比图，提供更丰富的数据洞察。
- **Feat**: 优化报销列表排序逻辑（状态>类别>时间），支持自定义状态和类别优先级。
- **Refactor**: 移除看板编辑功能，固定最佳布局配置。
- **Fix**: 修复新建报销单时偶发的变量未定义报错。

### v1.3.0
- **Feat**: 新增报销单复制功能，支持快速克隆已有单据信息（不含凭证）。
- **Docs**: 更新技术文档至 v1.3.0。
