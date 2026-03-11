<template>
  <div class="list-container">
    <div class="actions-bar">
      <div class="filters">
        <el-input 
          v-model="filters.name" 
          placeholder="搜索报销名称" 
          style="width: 200px" 
          clearable
        />
        <el-select 
          v-model="filters.category" 
          placeholder="报销类别" 
          clearable 
          style="width: 150px"
        >
          <el-option 
            v-for="cat in uniqueCategories" 
            :key="cat" 
            :label="cat" 
            :value="cat" 
          />
        </el-select>
        <el-select 
          v-model="filters.status" 
          placeholder="报销状态" 
          clearable 
          style="width: 150px"
        >
          <el-option label="材料不齐" value="材料不齐" />
          <el-option label="待提交" value="待提交" />
          <el-option label="待审核" value="待审核" />
          <el-option label="待打款" value="待打款" />
          <el-option label="已完成" value="已完成" />
        </el-select>
        <el-date-picker
          v-model="filters.dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 300px"
          value-format="YYYY-MM-DD"
        />
      </div>
      <el-button type="primary" @click="handleExport" :disabled="selectedRows.length === 0">
        批量导出 ({{ selectedRows.length }})
      </el-button>
    </div>
    
    <el-table 
      :data="filteredTableData" 
      style="width: 100%" 
      v-loading="loading"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="55" />
      <el-table-column type="expand">
        <template #default="props">
          <div class="expand-content">
            <h4>操作日志</h4>
            <el-timeline>
              <el-timeline-item
                v-for="(activity, index) in props.row.logs"
                :key="index"
                :timestamp="formatTime(activity.created_at)"
              >
                {{ activity.action }}: {{ activity.details }}
              </el-timeline-item>
            </el-timeline>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="date" label="日期" width="120" />
      <el-table-column prop="name" label="报销名称" width="150" />
      <el-table-column prop="status" label="状态" width="140">
        <template #default="scope">
          <el-select 
            v-model="scope.row.status" 
            size="small"
            @change="(val) => handleStatusChange(scope.row, val)"
          >
            <el-option label="材料不齐" value="材料不齐" />
            <el-option label="待提交" value="待提交" />
            <el-option label="待审核" value="待审核" />
            <el-option label="待打款" value="待打款" />
            <el-option label="已完成" value="已完成" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column prop="category" label="类别" width="100" />
      <el-table-column prop="amount" label="金额" width="120">
        <template #default="scope">
          ¥ {{ scope.row.amount.toFixed(2) }}
        </template>
      </el-table-column>
      <el-table-column prop="description" label="备注" />
      <el-table-column label="凭证" width="300">
        <template #default="scope">
          <div class="proof-buttons">
            <el-badge :value="getProofCount(scope.row.proofs.physical_photo)" :hidden="!getProofCount(scope.row.proofs.physical_photo)" type="primary">
              <el-button 
                size="small" 
                type="primary" 
                plain
                @click="viewProofs(scope.row.proofs.physical_photo, '实物照片')"
                :disabled="!getProofCount(scope.row.proofs.physical_photo)"
              >
                实物
              </el-button>
            </el-badge>
            <el-badge :value="getProofCount(scope.row.proofs.electronic_invoice)" :hidden="!getProofCount(scope.row.proofs.electronic_invoice)" type="success">
              <el-button 
                size="small" 
                type="success" 
                plain
                @click="viewProofs(scope.row.proofs.electronic_invoice, '电子发票')"
                :disabled="!getProofCount(scope.row.proofs.electronic_invoice)"
              >
                发票
              </el-button>
            </el-badge>
            <el-badge :value="getProofCount(scope.row.proofs.payment_screenshot)" :hidden="!getProofCount(scope.row.proofs.payment_screenshot)" type="warning">
              <el-button 
                size="small" 
                type="warning" 
                plain
                @click="viewProofs(scope.row.proofs.payment_screenshot, '支付截图')"
                :disabled="!getProofCount(scope.row.proofs.payment_screenshot)"
              >
                支付
              </el-button>
            </el-badge>
          </div>
        </template>
      </el-table-column>
    <el-table-column label="操作" width="280">
        <template #default="scope">
          <el-button-group>
            <el-button
              size="small"
              type="primary"
              icon="Edit"
              @click="handleEdit(scope.row)"
            >修改</el-button>
            <el-button
              size="small"
              type="primary"
              :icon="DocumentCopy"
              @click="handleCopy(scope.row)"
            >复制</el-button>
            <el-button
              size="small"
              type="primary"
              icon="Upload"
              @click="handleUpload(scope.row)"
            >补交</el-button>
            <el-button 
              size="small" 
              type="danger" 
              icon="Delete"
              @click="handleDelete(scope.row)"
            >删除</el-button>
          </el-button-group>
        </template>
      </el-table-column>
    </el-table>
    
    <el-dialog v-model="viewDialogVisible" :title="viewDialogTitle" width="600px">
      <div v-if="viewFiles.length === 0" class="no-files">暂无凭证</div>
      <el-table v-else :data="viewFiles" style="width: 100%">
        <el-table-column label="文件名" prop="name">
          <template #default="scope">
            <span :title="scope.row.path">{{ scope.row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="scope">
            <el-button size="small" @click="openFile(scope.row.path)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="uploadDialogVisible" title="补交报销凭证" width="500px">
      <el-form :model="uploadForm" label-width="120px">
        <el-form-item label="实物照片">
          <div 
            class="upload-area" 
            :class="{ 'is-dragover': dragOver.physical_photo }"
            @dragover.prevent="dragOver.physical_photo = true"
            @dragleave.prevent="dragOver.physical_photo = false"
            @drop.prevent="handleDrop('physical_photo', $event)"
            @click="selectFile('physical_photo')"
          >
            <el-icon class="upload-icon"><Upload /></el-icon>
            <div class="upload-text">点击或拖拽上传 (支持多选)</div>
            <div v-if="uploadForm.proofs.physical_photo && uploadForm.proofs.physical_photo.length" class="file-list">
              <div v-for="(file, index) in uploadForm.proofs.physical_photo" :key="index" class="file-item">
                <span class="file-name" :title="file">{{ getFileName(file) }}</span>
                <el-icon class="remove-icon" @click.stop="removeFile('physical_photo', index)"><Close /></el-icon>
              </div>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="电子发票">
          <div 
            class="upload-area" 
            :class="{ 'is-dragover': dragOver.electronic_invoice }"
            @dragover.prevent="dragOver.electronic_invoice = true"
            @dragleave.prevent="dragOver.electronic_invoice = false"
            @drop.prevent="handleDrop('electronic_invoice', $event)"
            @click="selectFile('electronic_invoice')"
          >
            <el-icon class="upload-icon"><Upload /></el-icon>
            <div class="upload-text">点击或拖拽上传 (支持多选)</div>
            <div v-if="uploadForm.proofs.electronic_invoice && uploadForm.proofs.electronic_invoice.length" class="file-list">
              <div v-for="(file, index) in uploadForm.proofs.electronic_invoice" :key="index" class="file-item">
                <span class="file-name" :title="file">{{ getFileName(file) }}</span>
                <el-icon class="remove-icon" @click.stop="removeFile('electronic_invoice', index)"><Close /></el-icon>
              </div>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="支付截图">
          <div 
            class="upload-area" 
            :class="{ 'is-dragover': dragOver.payment_screenshot }"
            @dragover.prevent="dragOver.payment_screenshot = true"
            @dragleave.prevent="dragOver.payment_screenshot = false"
            @drop.prevent="handleDrop('payment_screenshot', $event)"
            @click="selectFile('payment_screenshot')"
          >
            <el-icon class="upload-icon"><Upload /></el-icon>
            <div class="upload-text">点击或拖拽上传 (支持多选)</div>
            <div v-if="uploadForm.proofs.payment_screenshot && uploadForm.proofs.payment_screenshot.length" class="file-list">
              <div v-for="(file, index) in uploadForm.proofs.payment_screenshot" :key="index" class="file-item">
                <span class="file-name" :title="file">{{ getFileName(file) }}</span>
                <el-icon class="remove-icon" @click.stop="removeFile('payment_screenshot', index)"><Close /></el-icon>
              </div>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="uploadDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitUpload">确定</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog v-model="copyDialogVisible" title="复制报销单" width="500px">
      <el-alert
        title="复制将创建一个新的报销单，不包含原有的凭证文件，请稍后补交。"
        type="info"
        show-icon
        style="margin-bottom: 20px"
      />
      <el-form :model="copyForm" label-width="100px">
        <el-form-item label="报销名称" required>
          <el-input v-model="copyForm.name" />
        </el-form-item>
        <el-form-item label="日期" required>
          <el-date-picker
            v-model="copyForm.date"
            type="date"
            placeholder="选择日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="金额" required>
          <el-input-number
            v-model="copyForm.amount"
            :precision="2"
            :step="0.1"
            :min="0"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="类别" required>
          <el-select v-model="copyForm.category" style="width: 100%">
            <el-option
              v-for="cat in uniqueCategories"
              :key="cat"
              :label="cat"
              :value="cat"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="copyForm.description"
            type="textarea"
            :rows="3"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="copyDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitCopy">确定复制</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog v-model="editDialogVisible" title="修改报销信息" width="500px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="报销名称" required>
          <el-input v-model="editForm.name" />
        </el-form-item>
        <el-form-item label="日期" required>
          <el-date-picker
            v-model="editForm.date"
            type="date"
            placeholder="选择日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="金额" required>
          <el-input-number
            v-model="editForm.amount"
            :precision="2"
            :step="0.1"
            :min="0"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="类别" required>
          <el-select v-model="editForm.category" style="width: 100%">
            <el-option
              v-for="cat in uniqueCategories"
              :key="cat"
              :label="cat"
              :value="cat"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="editForm.description"
            type="textarea"
            :rows="3"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="editDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitEdit">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus';
import { Delete, Upload, Close, DocumentCopy } from '@element-plus/icons-vue';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);

const tableData = ref([]);
const loading = ref(false);
const selectedRows = ref([]);
const uploadDialogVisible = ref(false);
const editDialogVisible = ref(false);
const copyDialogVisible = ref(false);
const uploadForm = ref({
  id: null,
  proofs: {
    physical_photo: [],
    electronic_invoice: [],
    payment_screenshot: []
  }
});
const editForm = ref({
  id: null,
  name: '',
  date: '',
  amount: 0,
  category: '',
  description: ''
});
const copyForm = ref({
  name: '',
  date: '',
  amount: 0,
  category: '',
  description: '',
  proofs: {
    physical_photo: [],
    electronic_invoice: [],
    payment_screenshot: []
  },
  status: '材料不齐'
});

const viewDialogVisible = ref(false);
const viewDialogTitle = ref('');
const viewFiles = ref([]);

const dragOver = reactive({
  physical_photo: false,
  electronic_invoice: false,
  payment_screenshot: false
});

const filters = ref({
  name: '',
  category: '',
  status: '',
  dateRange: null
});

const statusOrder = ref([]);
const categoryOrder = ref([]);

const loadSortOrders = async () => {
  try {
    statusOrder.value = await window.api.getStatusOrder();
    const cats = await window.api.getCategories();
    categoryOrder.value = cats.map(c => c.name);
  } catch (e) {
    console.error('Failed to load sort orders:', e);
  }
};

const uniqueCategories = computed(() => {
  const categories = new Set(tableData.value.map(item => item.category).filter(Boolean));
  return Array.from(categories);
});

const filteredTableData = computed(() => {
  const filtered = tableData.value.filter(item => {
    // Name filter
    if (filters.value.name && (!item.name || !item.name.includes(filters.value.name))) return false;
    
    // Category filter
    if (filters.value.category && item.category !== filters.value.category) return false;
    
    // Status filter
    if (filters.value.status && item.status !== filters.value.status) return false;
    
    // Date Range filter
    if (filters.value.dateRange && filters.value.dateRange.length === 2) {
      const itemDate = dayjs(item.date);
      const startDate = dayjs(filters.value.dateRange[0]).startOf('day');
      const endDate = dayjs(filters.value.dateRange[1]).endOf('day');
      if (!itemDate.isBetween(startDate, endDate, null, '[]')) return false;
    }
    
    return true;
  });

  return filtered.sort((a, b) => {
    // 1. Status Priority
    let statusIndexA = statusOrder.value.indexOf(a.status);
    let statusIndexB = statusOrder.value.indexOf(b.status);
    if (statusIndexA === -1) statusIndexA = 999;
    if (statusIndexB === -1) statusIndexB = 999;
    
    if (statusIndexA !== statusIndexB) {
      return statusIndexA - statusIndexB;
    }
    
    // 2. Category Priority
    let catIndexA = categoryOrder.value.indexOf(a.category);
    let catIndexB = categoryOrder.value.indexOf(b.category);
    if (catIndexA === -1) catIndexA = 999;
    if (catIndexB === -1) catIndexB = 999;
    
    if (catIndexA !== catIndexB) {
      return catIndexA - catIndexB;
    }
    
    // 3. Time Priority (Date) - Descending (Newest first)
    const dateA = dayjs(a.date);
    const dateB = dayjs(b.date);
    if (!dateA.isSame(dateB)) {
        return dateB.valueOf() - dateA.valueOf();
    }
    
    // Fallback to created_at
    return (b.created_at || 0) - (a.created_at || 0);
  });
});

const handleSelectionChange = (val) => {
  selectedRows.value = val;
};

const formatTime = (timestamp) => {
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss');
};

const fetchData = async () => {
  loading.value = true;
  try {
    await loadSortOrders();
    const data = await window.api.getReimbursements();
    tableData.value = data;
  } catch (error) {
    ElMessage.error('获取数据失败: ' + error.message);
  } finally {
    loading.value = false;
  }
};

const handleStatusChange = async (row, newStatus) => {
  try {
    await updateStatus(row, newStatus);
  } catch (error) {
    fetchData(); // Revert UI on error
  }
};

const handleEdit = (row) => {
  editForm.value = {
    id: row.id,
    name: row.name,
    date: row.date,
    amount: row.amount,
    category: row.category,
    description: row.description
  };
  editDialogVisible.value = true;
};

const handleCopy = (row) => {
  copyForm.value = {
    name: row.name + ' (副本)',
    date: dayjs().format('YYYY-MM-DD'),
    amount: row.amount,
    category: row.category,
    description: row.description,
    proofs: {
      physical_photo: [],
      electronic_invoice: [],
      payment_screenshot: []
    },
    status: '材料不齐'
  };
  copyDialogVisible.value = true;
};

const submitCopy = async () => {
  try {
    const data = {
      ...copyForm.value,
      status: '材料不齐'
    };
    
    const result = await window.api.addReimbursement(JSON.parse(JSON.stringify(data)));
    if (result.success) {
      ElMessage.success('报销单复制成功，请记得补交凭证');
      copyDialogVisible.value = false;
      fetchData();
    } else {
      ElMessage.error('复制失败: ' + (result.error || '未知错误'));
    }
  } catch (error) {
    ElMessage.error('复制失败: ' + error.message);
  }
};

const submitEdit = async () => {
  try {
    const { id, ...updates } = editForm.value;
    const action = '修改信息';
    const details = '修改了报销基本信息';
    
    await window.api.updateReimbursement({
      id,
      updates,
      action,
      details
    });
    
    ElMessage.success('信息修改成功');
    editDialogVisible.value = false;
    fetchData();
  } catch (error) {
    ElMessage.error('修改失败: ' + error.message);
  }
};

const updateStatus = async (row, newStatus, reason = '') => {
  try {
    const action = `更新状态`;
    const details = `状态变更为 ${newStatus}${reason ? ' (' + reason + ')' : ''}`;
    
    await window.api.updateReimbursementStatus({
      id: row.id,
      status: newStatus,
      action,
      details
    });
    
    ElMessage.success('状态更新成功');
    fetchData();
  } catch (error) {
    ElMessage.error('更新失败: ' + error.message);
    throw error;
  }
};

const handleDelete = (row) => {
  ElMessageBox.confirm(
    '确定要删除这条报销记录吗？此操作不可恢复。',
    '警告',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  )
    .then(async () => {
      try {
        const result = await window.api.deleteReimbursement(row.id);
        if (result.success) {
          ElMessage.success('删除成功');
          fetchData();
        } else {
          ElMessage.error('删除失败: ' + result.error);
        }
      } catch (error) {
        ElMessage.error('系统错误');
      }
    })
    .catch(() => {});
};

const getFileName = (path) => {
  if (!path) return '';
  return path.split(/[/\\]/).pop();
};

const getProofCount = (proofs) => {
  if (!proofs) return 0;
  if (Array.isArray(proofs)) return proofs.length;
  return 1;
};

const viewProofs = (proofs, title) => {
  viewDialogTitle.value = title;
  if (!proofs) {
    viewFiles.value = [];
  } else if (Array.isArray(proofs)) {
    viewFiles.value = proofs.map(p => ({ name: getFileName(p), path: p }));
  } else {
    viewFiles.value = [{ name: getFileName(proofs), path: proofs }];
  }
  viewDialogVisible.value = true;
};

const handleUpload = (row) => {
  uploadForm.value = {
    id: row.id,
    proofs: {
      physical_photo: Array.isArray(row.proofs?.physical_photo) ? [...row.proofs.physical_photo] : (row.proofs?.physical_photo ? [row.proofs.physical_photo] : []),
      electronic_invoice: Array.isArray(row.proofs?.electronic_invoice) ? [...row.proofs.electronic_invoice] : (row.proofs?.electronic_invoice ? [row.proofs.electronic_invoice] : []),
      payment_screenshot: Array.isArray(row.proofs?.payment_screenshot) ? [...row.proofs.payment_screenshot] : (row.proofs?.payment_screenshot ? [row.proofs.payment_screenshot] : [])
    }
  };
  uploadDialogVisible.value = true;
};

const selectFile = async (type) => {
  try {
    const filters = [{ name: 'Allowed Files', extensions: ['jpg', 'png', 'jpeg', 'pdf'] }];
    const paths = await window.api.selectFile(filters);
    if (paths && paths.length > 0) {
      uploadForm.value.proofs[type] = [...uploadForm.value.proofs[type], ...paths];
    }
  } catch (error) {
    ElMessage.error('选择文件失败: ' + error.message);
  }
};

const handleDrop = (type, event) => {
  dragOver[type] = false;
  const files = event.dataTransfer.files;
  if (files.length > 0) {
    let newPaths = [];
    const allowed = ['jpg', 'png', 'jpeg', 'pdf'];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.path) {
        const ext = file.path.split('.').pop().toLowerCase();
        if (allowed.includes(ext)) {
          newPaths.push(file.path);
        } else {
          ElMessage.warning(`文件 ${file.name} 类型不支持，请上传 ${allowed.join(', ')}`);
        }
      }
    }
    if (newPaths.length > 0) {
      uploadForm.value.proofs[type] = [...uploadForm.value.proofs[type], ...newPaths];
    }
  }
};

const removeFile = (type, index) => {
  uploadForm.value.proofs[type].splice(index, 1);
};

const submitUpload = async () => {
  try {
    // Clone the form data to avoid Proxy cloning issues with IPC
    const formData = JSON.parse(JSON.stringify(uploadForm.value));
    const { id, proofs } = formData;
    const action = '补交材料';
    const details = '更新了报销凭证';
    
    const result = await window.api.updateReimbursementProofs({
      id,
      proofs,
      action,
      details
    });
    
    if (result.success) {
      ElMessage.success('材料补交成功');
      uploadDialogVisible.value = false;
      fetchData();
    } else {
      ElMessage.error('补交失败: ' + (result.error || '未知错误'));
    }
  } catch (error) {
    ElMessage.error('补交失败: ' + error.message);
  }
};

const handleExport = async () => {
  try {
    console.log('Export button clicked');
    console.log('Selected rows:', selectedRows.value);
    
    if (selectedRows.value.length === 0) {
      console.log('No rows selected');
      ElMessage.warning('请先选择要导出的报销条例');
      return;
    }
    
    // Clone IDs to avoid proxy issues
    const ids = JSON.parse(JSON.stringify(selectedRows.value.map(r => r.id)));
    console.log('IDs to export:', ids);
    
    const loadingInstance = ElLoading.service({
      lock: true,
      text: '正在导出，请稍候...',
      background: 'rgba(0, 0, 0, 0.7)',
    });
    
    try {
      console.log('Calling window.api.exportZip...');
      if (!window.api || !window.api.exportZip) {
        throw new Error('Export API not available (window.api.exportZip is undefined)');
      }
      
      const result = await window.api.exportZip(ids);
      console.log('Export result received:', result);
      loadingInstance.close();
      
      if (result.success) {
        ElMessage.success({
          message: '导出成功！文件已保存至: ' + result.filePath,
          duration: 0,
          showClose: true
        });
        // Try to open the file location
        try {
          await window.api.openFile(result.filePath);
        } catch (e) {
          console.error('Failed to open file:', e);
        }
      } else if (!result.cancelled) {
        ElMessage.error({
          message: '导出失败: ' + (result.error || '未知错误'),
          duration: 0,
          showClose: true
        });
      }
    } catch (error) {
      loadingInstance.close();
      console.error('Export error caught in component:', error);
      ElMessage.error({
        message: '导出出错: ' + error.message,
        duration: 0,
        showClose: true
      });
    }
  } catch (outerError) {
    console.error('Critical error in handleExport:', outerError);
    alert('导出功能发生严重错误: ' + outerError.message);
  }
};

const openFile = async (path) => {
  if (!path) return;
  try {
    const success = await window.api.openFile(path);
    if (!success) {
      ElMessage.warning('文件不存在或无法打开');
    }
  } catch (error) {
    ElMessage.error('打开文件失败');
  }
};

onMounted(() => {
  fetchData();
});

defineExpose({ fetchData });
</script>

<style scoped>
.list-container {
  padding: 20px;
}
.actions-bar {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.filters {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.expand-content {
  padding: 20px;
}

.proof-buttons {
  display: flex;
  gap: 10px;
  padding-top: 10px; /* Ensure badge is not clipped */
  align-items: center;
}

.proof-buttons :deep(.el-badge__content) {
  z-index: 10;
}

.upload-area {
  width: 100%;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: var(--el-transition-duration);
  text-align: center;
  padding: 20px 10px;
  background-color: #fafafa;
}

.upload-area:hover,
.upload-area.is-dragover {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}

.upload-icon {
  font-size: 28px;
  color: #8c939d;
  margin-bottom: 8px;
}

.upload-text {
  color: #606266;
  font-size: 12px;
}

.file-list {
  margin-top: 10px;
  text-align: left;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  background-color: #f5f7fa;
  border-radius: 4px;
  margin-bottom: 4px;
  font-size: 12px;
}

.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.remove-icon {
  cursor: pointer;
  color: #f56c6c; /* 红色，更醒目 */
  font-size: 16px; /* 稍微大一点 */
  margin-left: 8px;
  background-color: #fff; /* 添加白色背景 */
  border-radius: 50%; /* 圆形 */
  padding: 2px; /* 内边距 */
  box-shadow: 0 1px 2px rgba(0,0,0,0.1); /* 轻微阴影 */
  display: inline-flex;
  justify-content: center;
  align-items: center;
  height: 20px;
  width: 20px;
}

.remove-icon:hover {
  color: #fff;
  background-color: #f56c6c;
}

.file-preview {
  font-size: 12px;
  color: #666;
  margin-top: 5px;
  word-break: break-all;
}
</style>
