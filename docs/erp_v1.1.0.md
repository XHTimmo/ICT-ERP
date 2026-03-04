# ERP 系统 (ERP System) 技术文档

**版本**: v1.1.0  
**最后更新**: 2026-03-03

## 1. 项目简介

本 ERP 系统是一个基于 Electron + Vue 3 的桌面应用程序，聚焦「报销管理」的初代演进版本。本版本在 v1.0.0 基础上进行大量增强：新增“报销名称”和“唯一序号（serial_no）”、创建时凭证可选（支持后续补交）、状态与操作日志体系、批量导出优化（命名规则与清单字段）、“数据看板”统计与可视化、列表筛选、类别历史下拉，以及看板卡片的可视化拖拽/缩放与网格吸附布局。

核心能力：
- 报销条目全生命周期管理（创建/状态变更/补交/删除/导出）
- 本地化数据与附件存储（用户可配置根路径）
- 看板统计（总览/未完成合计与占比/分类与状态汇总/最近新增）
- 高效检索与筛选（名称/类别/状态/日期范围）
- 看板卡片布局可自定义（拖拽、缩放、网格吸附、持久化）

## 2. 技术栈 (Tech Stack)

- 桌面框架: Electron
- 前端框架: Vue 3 (Composition API)
- UI 组件库: Element Plus
- 可视化: ECharts（饼图等）
- 拖拽/缩放: Interact.js（支持网格吸附）
- 本地数据库: Better-SQLite3 (SQLite)
- 文件处理: fs-extra、archiver（ZIP 导出）
- 配置管理: electron-store（本地配置持久化）
- 工具: dayjs（时间）、uuid（ID）

相关实现参考：
- 主进程与数据库：[ipc.js](file:///Users/timmo/tools/erp/src/main/ipc.js)、[database.js](file:///Users/timmo/tools/erp/src/main/database.js)
- 预加载与安全桥接：[index.js](file:///Users/timmo/tools/erp/src/preload/index.js)
- 渲染进程组件：看板 [Dashboard.vue](file:///Users/timmo/tools/erp/src/renderer/src/components/Dashboard.vue)、表单 [ReimbursementForm.vue](file:///Users/timmo/tools/erp/src/renderer/src/components/ReimbursementForm.vue)
- 构建与打包： [package.json](file:///Users/timmo/tools/erp/package.json)

## 3. 业务逻辑说明 (Business Logic)

### 3.1 数据模型
表：`reimbursements`
- `id` TEXT 主键（UUID）
- `serial_no` INTEGER 全局递增唯一序号（建立唯一索引；旧数据自动回填）
- `date` TEXT 报销日期
- `amount` REAL 报销金额
- `category` TEXT 报销类别（支持历史值下拉）
- `name` TEXT 报销名称（用于文件重命名与导出命名）
- `description` TEXT 备注
- `proofs` TEXT（JSON 字符串，含三个凭证路径）
- `status` TEXT 状态（如：材料不齐、待提交、待审核、待打款、已完成）
- `created_at` INTEGER 创建时间戳

表：`reimbursement_logs`
- `id` INTEGER 自增主键
- `reimbursement_id` TEXT（外键到 `reimbursements.id`）
- `action` TEXT（如“创建”“状态变更”“补交材料”）
- `details` TEXT 描述
- `created_at` INTEGER 操作时间戳

实现参考：表结构与迁移、序号分配与回填见 [database.js](file:///Users/timmo/tools/erp/src/main/database.js)。

### 3.2 新增报销流程
1. 前端填写：日期、金额、报销名称、报销类别、备注（凭证可选）。
2. 提交调用：通过预加载安全 API 调用 `add-reimbursement`。
3. 主进程处理：
   - 读取存储路径，创建附件目录。
   - 将上传文件复制到 `attachments/` 并重命名为：`报销名称_材料类型_金额.扩展名`（名称非法字符会清洗）。
   - 生成 `id`（UUID）与 `serial_no`（下一个全局序号），写入数据库；根据是否齐全设置初始状态：齐全→“待提交”，否则“材料不齐”。
   - 写入操作日志“创建”。

实现参考：文件命名、插入与日志见 [ipc.js](file:///Users/timmo/tools/erp/src/main/ipc.js)、[ReimbursementForm.vue](file:///Users/timmo/tools/erp/src/renderer/src/components/ReimbursementForm.vue)。

### 3.3 补交材料流程
1. 前端选择待补交的凭证文件（支持点击选择或拖拽上传）。
2. 主进程更新 `proofs` 字段，记录“补交材料”日志（并可在前端引导用户调整状态）。

### 3.4 状态变更流程
1. 列表支持直接修改状态（如“待审核”→“待打款”）。
2. 主进程更新 `status` 并记录日志（`reimbursement_logs`）。

### 3.5 删除报销流程
1. 前端发起删除请求。
2. 主进程删除该条目及其日志记录（保留附件的策略可按需扩展）。

### 3.6 批量导出流程
1. 前端传递所选条目的 ID 列表。
2. 主进程在存储目录直接生成 ZIP（若未设置存储目录则回落到 Downloads）。
3. 压缩结构：
   - 每个报销条目一个文件夹：`日期_报销名称_金额`
   - 文件命名保留原始文件名（外层加 `physical_/invoice_/payment_` 前缀）
   - 根目录生成 `manifest.csv`，字段：`ID, 序号, 日期, 报销名称, 金额, 类别, 状态, 备注, 实物照片, 电子发票, 支付截图`

实现参考：`export-zip` 逻辑与清单字段见 [ipc.js](file:///Users/timmo/tools/erp/src/main/ipc.js)。

### 3.7 存储路径配置
- 用户可选择并保存根目录（`electron-store` 持久化）。
- 数据库位于 `[根]/db/erp.db`，附件位于 `[根]/attachments/`。

## 4. 前端页面与交互

### 4.1 数据看板 (Dashboard)
- 概览卡片：总报销金额、总报销单数、未完成总金额（未完成=状态∈{材料不齐、待提交、待审核、待打款}）
- 统计表格：按类别/按状态汇总（数量与金额）
- 最近新增：最近 5 条记录（名称/状态/金额/日期）
- 未完成占比：ECharts 饼图展示“未完成按类别金额占比”
- 布局自定义：
  - “布局编辑”模式开启后，支持卡片拖拽与缩放
  - 网格吸附（默认 20px），方向键微调一格
  - 卡片右上角显示“列×行”尺寸，背景显示网格
  - 布局保存于 localStorage；支持“重置布局”

实现参考：看板渲染与布局交互见 [Dashboard.vue](file:///Users/timmo/tools/erp/src/renderer/src/components/Dashboard.vue)。

### 4.2 报销列表与筛选
- 筛选条件：报销名称（模糊）、类别、状态、日期范围
- 支持直接编辑状态、删除条目、补交材料
- 类别下拉：合并“历史类别”与默认项，支持搜索与自由输入

实现参考：列表与筛选逻辑见 ReimbursementList.vue（同目录）。

### 4.3 新增报销表单
- 字段校验：日期、金额、报销名称、报销类别必填
- 凭证：支持拖拽上传或点击选择，创建时可不上传，后续可在列表页补交
- 提交后自动根据凭证完整性设置初始状态

实现参考：[ReimbursementForm.vue](file:///Users/timmo/tools/erp/src/renderer/src/components/ReimbursementForm.vue)。

## 5. 跨进程通信与安全

- 采用 `contextBridge` 暴露有限 API（避免直接暴露 `ipcRenderer`）
- 渲染进程可调用：
  - 存储路径：`getStoragePath/setStoragePath/selectDirectory`
  - 文件：`selectFile/openFile`
  - 报销：`getReimbursements/addReimbursement/updateReimbursementStatus/updateReimbursementProofs/deleteReimbursement/exportZip`
  - 看板与类别：`getDashboardStats/getCategories`

实现参考：[preload/index.js](file:///Users/timmo/tools/erp/src/preload/index.js)、[ipc.js](file:///Users/timmo/tools/erp/src/main/ipc.js)。

## 6. 构建与发布

- 开发：
  - `npm run electron:dev`（Vite dev server 端口 5174，预加载 VITE_DEV_SERVER_URL）
  - 安装后执行 `postinstall` 重建原生依赖（如 better-sqlite3）
- 生产打包：
  - Windows：Electron Builder（目标 `nsis`，支持选择安装目录）
  - Mac（开发验证）：DMG（未签名）
- 输出：
  - 安装包：`dist/ERP System Setup 1.0.0.exe`
  - 免安装目录：`dist/win-unpacked`

配置参考：[package.json](file:///Users/timmo/tools/erp/package.json)。

## 7. 与 v1.0.0 的差异 (Changelog)

- 新增字段：`name`（报销名称）、`serial_no`（全局唯一序号，建立唯一索引与旧数据回填）
- 凭证从“创建时强制齐全”改为“可选上传，可后续补交”，初始状态按是否齐全自动设置
- 批量导出优化：按 `日期_报销名称_金额` 生成文件夹；清单 CSV 新增“序号”“报销名称”
- 看板增强：新增“未完成总金额”与“未完成按类别占比（饼图）”
- 列表增强：新增“报销名称”列；筛选支持名称/类别/状态/日期
- 类别下拉：支持历史类别自动填充
- 交互增强：新增报销与补交材料支持文件拖拽上传
- 看板布局：支持拖拽/缩放，网格吸附与键盘微调，布局持久化

## 8. 后续规划 (Roadmap)

- 导出模板可配置（CSV 字段/顺序/编码）
- 附件物理清理策略（随删除自动清理或归档）
- 看板布局同步（跨设备/用户配置同步）
- 更多图表（趋势/对比）与自定义维度

