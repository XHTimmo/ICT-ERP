# ERP 报销管理系统 (ERP System)

基于 Electron + Vue 3 + Element Plus + Better-SQLite3 的报销管理系统。

## 功能特性

- **新增报销**: 支持填写日期、金额、类别、备注，并上传实物照片、电子发票、支付截图（三证齐全）。
- **报销列表**: 查看所有报销记录，支持按日期排序。
- **凭证查看**: 点击列表中的按钮可直接预览/打开凭证文件。
- **本地存储**: 数据和文件存储在本地，支持自定义存储路径，保障数据安全。

## 安装与运行

### 1. 安装依赖

```bash
npm install
```

> 注意: 由于使用了 `better-sqlite3`，安装过程可能会触发原生模块编译。如果不成功，请尝试 `npm run postinstall`。

### 2. 开发模式

同时启动 Vite 开发服务器和 Electron 主进程：

```bash
npm run electron:dev
```

### 3. 构建打包

构建 Windows 安装包 (需在 Windows 环境下或使用 Wine):

```bash
npm run build
```

## 项目结构

- `src/main`: Electron 主进程代码 (IPC, 数据库, 文件操作)
- `src/preload`: 预加载脚本 (安全暴露 API)
- `src/renderer`: Vue 3 前端代码
- `dist`: 构建产物

## 数据存储

默认情况下，首次运行时需在“系统设置”中指定一个文件夹作为数据存储目录。
系统会在该目录下创建：
- `db/erp.db`: SQLite 数据库文件
- `attachments/`: 存放上传的凭证文件
