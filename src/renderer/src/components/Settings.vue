<template>
  <el-card class="settings-card">
    <template #header>
      <div class="card-header">
        <span>系统设置</span>
      </div>
    </template>
    
    <el-form label-width="120px">
      <el-form-item label="当前版本">
        <div class="version-info">
          <span>v{{ appVersion }}</span>
          <el-button type="primary" link @click="checkForUpdates">检查更新</el-button>
        </div>
      </el-form-item>

      <el-form-item label="数据存储路径">
        <el-input v-model="storagePath" readonly>
          <template #append>
            <el-button @click="selectDirectory">选择文件夹</el-button>
          </template>
        </el-input>
        <div class="tip">
          所有报销数据和凭证文件将存储在此目录下的 <code>db</code> 和 <code>attachments</code> 文件夹中。
        </div>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';

const storagePath = ref('');
const appVersion = ref('');

const loadSettings = async () => {
  try {
    const path = await window.api.getStoragePath();
    if (path) storagePath.value = path;
    
    const version = await window.api.getAppVersion();
    if (version) appVersion.value = version;
  } catch (error) {
    ElMessage.error('加载设置失败');
  }
};

const checkForUpdates = () => {
  window.api.checkForUpdates();
  ElMessage.info('正在检查更新...');
};

const selectDirectory = async () => {
  try {
    const path = await window.api.selectDirectory();
    if (path) {
      storagePath.value = path;
      await window.api.setStoragePath(path);
      ElMessage.success('存储路径已更新');
    }
  } catch (error) {
    ElMessage.error('设置路径失败: ' + error.message);
  }
};

onMounted(() => {
  loadSettings();
});
</script>

<style scoped>
.version-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.settings-card {
  max-width: 800px;
  margin: 20px auto;
}
.tip {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
}
</style>
