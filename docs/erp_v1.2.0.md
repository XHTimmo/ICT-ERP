# ERP 系统 (ERP System) 技术文档

**版本**: v1.2.0  
**最后更新**: 2026-03-06

## 1. 项目简介

本 ERP 系统是一个基于 Electron + Vue 3 的桌面应用程序，聚焦「报销管理」。
v1.2.0 版本在 v1.1.0 的基础上，重点增强了**版本管理与发布流程**、**用户体验细节**以及**数据管理的灵活性**。
新增了 GitHub Actions 自动化构建发布（支持 macOS/Windows）、软件内自动更新检查、标题栏版本显示、列表多维度排序，以及灵活的报销类别管理功能（增删改）。

核心能力：
- **自动化集成**：GitHub Actions 多平台构建与发布，支持标签触发自动发版。
- **自动更新**：集成 electron-updater，启动时自动检测 GitHub Releases 新版本。
- **灵活配置**：报销类别支持自定义管理（新增/删除/排序），不再局限于硬编码列表。
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

### 3.1 自动更新与版本管理 (v1.2.0 新增)
- **CI/CD 流程**:
  - 推送 `v*` 标签触发 GitHub Actions。
  - 矩阵构建：同时生成 macOS (`.dmg`, `.zip`) 和 Windows (`.exe` NSIS) 安装包。
  - 自动发布到 GitHub Releases。
- **客户端更新**:
  - 应用启动时 (`App.vue` `onMounted`) 自动调用 `checkForUpdates`。
  - 发现新版本 -> 弹窗提示 -> 自动下载 -> 询问重启安装。
  - 软件标题栏动态显示当前版本号 (`v1.2.0`)。

### 3.2 报销类别管理 (v1.2.0 新增)
- **数据模型**: 新增 `categories` 表 (`id`, `name`, `sort_order`, `created_at`)。
- **交互流程**:
  - **新增**: 在报销表单下拉框直接输入新类别，或在“系统设置”页添加。
  - **删除**: 在下拉框选项中点击删除图标，或在“系统设置”页管理。
  - **排序**: 数据库层支持 `sort_order`（预留给未来拖拽排序功能）。
- **持久化**: 类别数据存入 SQLite，重启不丢失。

### 3.3 列表排序优化 (v1.2.0 新增)
- 报销列表 (`ReimbursementList.vue`) 支持对以下列进行升序/降序排序：
  - 日期 (`date`)
  - 报销名称 (`name`)
  - 状态 (`status`)
  - 类别 (`category`)
  - 金额 (`amount`)

### 3.4 核心业务流程 (继承自 v1.1.0)
- **报销单管理**: 创建（生成唯一序号）、状态变更、凭证补交（拖拽上传）、删除。
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

### `categories` (报销类别 - v1.2.0 新增)
- `id`: INTEGER
- `name`: TEXT (Unique)
- `sort_order`: INTEGER
- `created_at`: INTEGER

## 5. 项目结构 (Project Structure)

```
/
├── .github/workflows/   # CI/CD 配置 (release.yml)
├── src/
│   ├── main/           # 主进程
│   │   ├── index.js    # 入口，窗口创建
│   │   ├── ipc.js      # IPC 通信处理
│   │   ├── database.js # SQLite 数据库操作
│   │   └── updater.js  # 自动更新逻辑
│   ├── preload/        # 预加载脚本 (安全桥接)
│   │   └── index.js
│   └── renderer/       # 渲染进程 (Vue 3)
│       ├── src/
│       │   ├── components/
│       │   │   ├── ReimbursementForm.vue # 报销表单 (含类别新增)
│       │   │   ├── ReimbursementList.vue # 列表 (含排序)
│       │   │   ├── Dashboard.vue         # 看板
│       │   │   └── Settings.vue          # 设置 (含类别管理)
│       │   └── App.vue                   # 根组件 (含版本显示/更新监听)
├── package.json        # 依赖与构建配置
└── docs/               # 文档
```

## 6. 构建与发布 (Build & Release)

- **开发**: `npm run dev`
- **构建**:
  - 本地构建: `npm run build`
  - 自动发布: `git tag v1.2.0 && git push origin v1.2.0`
- **配置**: `package.json` 中配置了 `electron-builder`，支持 `nsis` (Windows) 和 `dmg` (macOS)。

## 7. 更新日志 (Changelog)

### v1.2.0
- **Feat**: 集成 GitHub Actions 自动构建发布流程 (macOS/Windows)。
- **Feat**: 新增软件内自动检查更新功能。
- **Feat**: 软件标题栏显示当前版本号。
- **Feat**: 报销列表支持按名称、状态、类别排序。
- **Feat**: 支持自定义报销类别（新增/删除/持久化存储）。
- **Fix**: 修复 CI 流程中 npm version 相同版本号报错问题。

### v1.1.0
- **Feat**: 新增“报销名称”和“唯一序号”。
- **Feat**: 凭证上传改为可选，支持后续补交。
- **Feat**: 批量导出优化（文件夹命名规则）。
- **Feat**: 看板未完成金额统计与可视化。

## 8. 后续规划 (Roadmap)

- 导出模板自定义配置。
- 附件自动归档/清理策略。
- 多用户/多设备数据同步方案。
- 更多可视化图表维度。
