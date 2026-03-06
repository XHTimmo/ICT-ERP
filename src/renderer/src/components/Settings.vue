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

      <el-form-item label="报销类别管理">
        <div class="category-manager">
          <div class="category-input">
            <el-input 
              v-model="newCategoryName" 
              placeholder="输入新类别名称" 
              style="width: 200px"
              @keyup.enter="handleAddCategory"
            >
              <template #append>
                <el-button @click="handleAddCategory">添加</el-button>
              </template>
            </el-input>
          </div>
          
          <el-table 
            :data="categories" 
            style="width: 100%; margin-top: 10px" 
            border 
            size="small"
            empty-text="暂无类别"
          >
            <el-table-column prop="name" label="类别名称" />
            <el-table-column label="操作" width="100" align="center">
              <template #default="scope">
                <el-button 
                  type="danger" 
                  link 
                  size="small" 
                  @click="handleDeleteCategory(scope.row)"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';

const storagePath = ref('');
const appVersion = ref('');
const categories = ref([]);
const newCategoryName = ref('');

const loadCategories = async () => {
  try {
    const list = await window.api.getCategories();
    categories.value = list;
  } catch (error) {
    console.error('Failed to load categories:', error);
  }
};

const handleAddCategory = async () => {
  const name = newCategoryName.value.trim();
  if (!name) {
    ElMessage.warning('请输入类别名称');
    return;
  }
  
  try {
    await window.api.addCategory(name);
    ElMessage.success('添加成功');
    newCategoryName.value = '';
    await loadCategories();
  } catch (error) {
    ElMessage.error(error.message || '添加失败');
  }
};

const handleDeleteCategory = async (row) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除类别 "${row.name}" 吗？`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    
    await window.api.deleteCategory(row.id);
    ElMessage.success('删除成功');
    await loadCategories();
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
};

const loadSettings = async () => {
  try {
    const path = await window.api.getStoragePath();
    if (path) storagePath.value = path;
    
    const version = await window.api.getAppVersion();
    if (version) appVersion.value = version;

    await loadCategories();
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
