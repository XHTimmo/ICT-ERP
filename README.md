# ERP 报销管理系统 (ERP System)

基于 Electron + Vue 3 + Element Plus + Better-SQLite3 的报销管理系统。

## 功能特性

- **报销录入**: 支持填写日期、金额、类别、备注，并上传实物照片、电子发票、支付截图（三证齐全）。
- **报销列表**: 查看所有报销记录，支持按报销名称、状态、类别、日期排序。
- **凭证管理**: 点击列表中的按钮可直接预览/打开凭证文件。
- **类别管理**: 支持自定义报销类别，可新增、删除并拖拽排序。
- **自动更新**: 支持检查 GitHub Releases 新版本并自动下载安装 (Windows/macOS)。
- **数据安全**: 基于 SQLite 的本地数据存储，支持自定义数据保存路径，保障数据私密性。

## 安装使用

请前往 [GitHub Releases](https://github.com/XHTimmo/ICT-ERP/releases) 页面下载对应系统的安装包：

- **Windows**: 下载 `.exe` 安装程序
- **macOS**: 下载 `.dmg` 或 `.zip` 文件

下载后直接运行安装即可。

## 开发与构建

如果您是开发者，可以通过以下步骤进行开发或手动构建：

### 1. 安装依赖

```bash
bun install
```

> 注意: 由于使用了 `better-sqlite3`，安装过程可能会触发原生模块编译。如果不成功，请尝试 `bun run postinstall`。

### 2. 开发模式

同时启动 Vite 开发服务器和 Electron 主进程：

```bash
bun run electron:dev
```

### 3. 构建打包

构建 Windows 安装包 (需在 Windows 环境下或使用 Wine):

```bash
bun run build
```

## 项目结构

- `src/main`: Electron 主进程代码 (IPC, 数据库, 文件操作, 自动更新)
- `src/preload`: 预加载脚本 (安全暴露 API)
- `src/renderer`: Vue 3 前端代码
- `dist`: 构建产物

## 数据存储

默认情况下，首次运行时需在“系统设置”中指定一个文件夹作为数据存储目录。
系统会在该目录下创建：
- `db/erp.db`: SQLite 数据库文件
- `attachments/`: 存放上传的凭证文件
