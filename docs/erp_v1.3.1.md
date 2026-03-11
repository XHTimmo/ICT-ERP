# ERP 系统 (ERP System) 技术文档

**版本**: v1.3.1  
**最后更新**: 2026-03-11

## 1. 项目简介

本 ERP 系统是一个基于 Electron + Vue 3 的桌面应用程序，聚焦「报销管理」。
v1.3.1 版本重点增强了**数据可视化**能力，并优化了**报销列表排序**逻辑，提升了数据洞察力和操作便捷性。

核心能力：
- **数据看板升级**：新增月度趋势、类别占比、状态占比等图表，移除编辑功能以固定最佳布局。
- **智能排序**：报销列表采用“状态 > 类别 > 时间”的组合排序，支持自定义状态/类别优先级。
- **报销单复制**：一键复制已有报销单信息（排除凭证），快速创建新单据。
- **自动化集成**：GitHub Actions 多平台构建与发布，支持标签触发自动发版。
- **自动更新**：集成 electron-updater，启动时自动检测 GitHub Releases 新版本。
- **全生命周期管理**：报销条目创建、状态流转、凭证补交、批量导出、统计看板。

## 2. 技术栈 (Tech Stack)

- **桌面框架**: Electron (主进程/渲染进程架构)
- **前端框架**: Vue 3 (Composition API) + Vite
- **UI 组件库**: Element Plus
- **可视化**: ECharts (新增多维度图表)
- **数据存储**: Better-SQLite3 (本地数据库) + Electron-Store (用户配置)
- **自动更新**: electron-updater
- **CI/CD**: GitHub Actions (构建 Windows/macOS 安装包)

## 3. 业务逻辑与新特性 (Business Logic & Features)

### 3.1 数据看板增强 (v1.3.1)
- **月度报销趋势**: 柱状图+折线图组合，展示近6个月的报销金额与单据量趋势。
- **多维度占比**: 新增“全类别金额占比”（饼图）和“全状态数量占比”（环形图）。
- **布局优化**: 移除看板编辑功能，固定为精心设计的默认布局，确保最佳展示效果。

### 3.2 智能排序策略 (v1.3.1)
- **多级排序**: 列表默认按 `状态 (第一优先级) > 类别 (第二优先级) > 时间 (第三优先级)` 排序。
- **自定义优先级**:
  - **状态排序**: 用户可在设置页拖拽调整各状态（如“待审核”、“待打款”）的显示顺序。
  - **类别排序**: 支持调整报销类别的显示顺序，直接影响列表排序。

### 3.3 报销单复制 (v1.3.0)
- **功能描述**: 用户可以在报销列表中点击“复制”按钮，快速基于已有报销单创建新单据。
- **复制规则**:
  - 复制字段：报销名称（自动添加 `(副本)` 后缀）、金额、类别、备注。
  - **不复制**字段：日期（默认为当前日期）、凭证文件（需重新上传）、状态（重置为“材料不齐”）。

### 3.4 核心业务流程
- **报销单管理**: 创建、状态变更、凭证补交、删除。
- **批量导出**: 按 ID 列表生成 ZIP，包含规范命名的附件和清单 CSV。

## 4. 数据库设计 (Database Schema)

### `reimbursements` (报销单)
- `id`: TEXT (UUID)
- `serial_no`: INTEGER (唯一序号)
- `date`: TEXT
- `amount`: REAL
- `category`: TEXT
- `name`: TEXT
- `description`: TEXT
- `proofs`: TEXT (JSON)
- `status`: TEXT
- `created_at`: INTEGER

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
  - 自动发布: `git tag v1.3.1 && git push origin v1.3.1`
- **配置**: `package.json` 中配置了 `electron-builder`，支持 `nsis` (Windows) 和 `dmg` (macOS)。

## 6. 更新日志 (Changelog)

### v1.3.1
- **Feat**: 看板新增月度趋势图、类别/状态占比图，提供更丰富的数据洞察。
- **Feat**: 优化报销列表排序逻辑（状态>类别>时间），支持自定义状态和类别优先级。
- **Refactor**: 移除看板编辑功能，固定最佳布局配置。
- **Fix**: 修复新建报销单时偶发的变量未定义报错。

### v1.3.0
- **Feat**: 新增报销单复制功能，支持快速克隆已有单据信息（不含凭证）。
- **Docs**: 更新技术文档至 v1.3.0。
