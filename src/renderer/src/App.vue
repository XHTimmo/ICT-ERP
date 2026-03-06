<template>
  <el-container class="layout-container">
    <el-header>
      <div class="header-content">
        <h1>ERP 报销管理系统 <small class="version" v-if="appVersion">v{{ appVersion }}</small></h1>
        <el-menu mode="horizontal" :default-active="activeTab" @select="handleSelect">
          <el-menu-item index="dashboard">看板</el-menu-item>
          <el-menu-item index="list">报销列表</el-menu-item>
          <el-menu-item index="create">新增报销</el-menu-item>
          <el-menu-item index="settings">系统设置</el-menu-item>
        </el-menu>
      </div>
    </el-header>
    <el-main>
      <Dashboard v-if="activeTab === 'dashboard'" />
      <ReimbursementList v-if="activeTab === 'list'" @refresh="fetchData" />
      <ReimbursementForm v-if="activeTab === 'create'" @success="activeTab = 'list'" />
      <Settings v-if="activeTab === 'settings'" />
    </el-main>
  </el-container>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { ElNotification, ElMessageBox, ElMessage } from 'element-plus';
import Dashboard from './components/Dashboard.vue';
import ReimbursementList from './components/ReimbursementList.vue';
import ReimbursementForm from './components/ReimbursementForm.vue';
import Settings from './components/Settings.vue';

const activeTab = ref('dashboard');
const appVersion = ref('');

const handleSelect = (key) => {
  activeTab.value = key;
};

const fetchData = () => {
  // Logic to refresh data if needed
};

// Auto Update Logic
const cleanup = ref(null);

onMounted(async () => {
  // Get app version
  if (window.api && window.api.getAppVersion) {
    const version = await window.api.getAppVersion();
    if (version) appVersion.value = version;
  }

  if (window.api && window.api.onUpdateStatus) {
     cleanup.value = window.api.onUpdateStatus((data) => {
       console.log('Update status:', data);
       
       switch (data.status) {
         case 'available':
           ElNotification({
             title: '发现新版本',
             message: `新版本 ${data.info.version} 已发布，正在自动下载...`,
             type: 'info',
             duration: 0
           });
           break;
           
         case 'downloading':
           // Optional: Show progress bar in a persistent notification or UI element
           // For now, we rely on the initial notification and the final one
           break;
           
         case 'downloaded':
           ElMessageBox.confirm(
             '新版本已下载完成，是否立即重启更新？',
             '更新就绪',
             {
               confirmButtonText: '立即重启',
               cancelButtonText: '稍后',
               type: 'success'
             }
           ).then(() => {
             window.api.quitAndInstall();
           }).catch(() => {
             ElMessage.info('将在下次启动时应用更新');
           });
           break;
           
         case 'error':
           console.error('Update error:', data.error);
           // Don't disturb user with errors unless critical or manually checked
           break;
       }
     });
     
     // Check for updates on startup
     window.api.checkForUpdates();
   }
 });

 onUnmounted(() => {
   if (cleanup.value) cleanup.value();
 });
 </script>

<style scoped>
.layout-container {
  height: 100vh;
}
.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #dcdfe6;
  padding: 0 20px;
}
.header-content h1 {
  display: flex;
  align-items: center;
  gap: 10px;
}
.version {
  font-size: 14px;
  color: #909399;
  font-weight: normal;
}
</style>
