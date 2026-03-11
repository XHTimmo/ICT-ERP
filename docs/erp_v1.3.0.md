# ERP 系统 (ERP System) 技术文档

**版本**: v1.3.0  
**最后更新**: 2026-03-11

## 1. 项目简介

本 ERP 系统是一个基于 Electron + Vue 3 的桌面应用程序，聚焦「报销管理」。
v1.3.0 版本在 v1.2.0 的基础上，新增了**报销单复制**功能，旨在提高重复性报销填报的效率。

核心能力：
- **报销单复制**：一键复制已有报销单信息（排除凭证），快速创建新单据。
- **自动化集成**：GitHub Actions 多平台构建与发布，支持标签触发自动发版。
- **自动更新**：集成 electron-updater，启动时自动检测 GitHub Releases 新版本。
- **灵活配置**：报销类别支持自定义管理（新增/删除/排序）。
- **体验优化**：列表支持按名称/状态/类别/金额/日期排序，软件标题直观显示当前版本。
- **全生命周期管理**：报销条目创建、状态流转、凭证补交、批量导出、统计看板。

## 2. 技术栈 (Tech Stack)

- **桌面框架**: Electron (主进程/渲染进程架构)
- **前端框架**: Vue 3 (Composition API) + Vite
- **UI 组件库**: Element Plus
- **可视化**: ECharts
- **数据存储**: Better-SQLite3 (本地数据库) + JSON (配置)
- **自动更新**: electron-updater
- **CI/CD**: GitHub Actions (构建 Windows/macOS 安装包)

## 3. 业务逻辑与新特性 (Business Logic & Features)

### 3.1 报销单复制 (v1.3.0 新增)
- **功能描述**: 用户可以在报销列表中点击“复制”按钮，快速基于已有报销单创建新单据。
- **复制规则**:
  - 复制字段：报销名称（自动添加 `(副本)` 后缀）、金额、类别、备注。
  - **不复制**字段：日期（默认为当前日期）、凭证文件（需重新上传）、状态（重置为“材料不齐”）。
- **交互流程**:
  - 点击列表行操作区的“复制”按钮。
  - 弹出确认对话框，展示预填充的新表单信息。
  - 用户确认无误后，生成新报销单并刷新列表。

### 3.2 自动更新与版本管理 (v1.2.0)
- **CI/CD 流程**: 推送 `v*` 标签触发 GitHub Actions，自动构建并发布到 GitHub Releases。
- **客户端更新**: 启动时自动检查更新，支持弹窗提示下载与重启安装。

### 3.3 报销类别管理 (v1.2.0)
- **数据模型**: `categories` 表支持类别的增删改查。
- **交互**: 下拉框直接输入新增，设置页集中管理。

### 3.4 核心业务流程 (继承自 v1.1.0)
- **报销单管理**: 创建、状态变更、凭证补交、删除。
- **批量导出**: 按 ID 列表生成 ZIP，包含规范命名的附件和清单 CSV。
- **数据看板**: 统计总览、未完成占比、分类汇总、可拖拽布局。

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
  - 自动发布: `git tag v1.3.0 && git push origin v1.3.0`
- **配置**: `package.json` 中配置了 `electron-builder`，支持 `nsis` (Windows) 和 `dmg` (macOS)。

## 6. 更新日志 (Changelog)

### v1.3.0
- **Feat**: 新增报销单复制功能，支持快速克隆已有单据信息（不含凭证）。
- **Docs**: 更新技术文档至 v1.3.0。

### v1.2.0
- **Feat**: 集成 GitHub Actions 自动构建发布流程。
- **Feat**: 新增软件内自动检查更新功能。
- **Feat**: 软件标题栏显示当前版本号。
- **Feat**: 报销列表支持按名称、状态、类别排序。
- **Feat**: 支持自定义报销类别。

### v1.1.0
- **Feat**: 新增“报销名称”和“唯一序号”。
- **Feat**: 凭证上传改为可选，支持后续补交。
- **Feat**: 批量导出优化。
- **Feat**: 看板未完成金额统计与可视化。

## 7. 后续规划 (Roadmap)

- 导出模板自定义配置。
- 附件自动归档/清理策略。
- 多用户/多设备数据同步方案。
- 更多可视化图表维度。
