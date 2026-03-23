<template>
  <el-card class="form-card">
    <template #header>
      <div class="card-header">
        <span>新增报销单</span>
      </div>
    </template>
    
    <el-form :model="form" label-width="120px" :rules="rules" ref="formRef">
      <el-form-item label="报销日期" prop="date">
        <el-date-picker v-model="form.date" type="date" placeholder="选择日期" value-format="YYYY-MM-DD" />
      </el-form-item>
      
      <el-form-item label="报销金额" prop="amount">
        <el-input-number v-model="form.amount" :precision="2" :step="0.1" :min="0" />
      </el-form-item>
      
      <el-form-item label="报销名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入报销名称" />
      </el-form-item>

      <el-form-item label="报销单号" prop="receipt_no">
        <el-input v-model="form.receipt_no" placeholder="请输入报销单号（选填）" />
      </el-form-item>

      <el-form-item label="报销类别" prop="category">
        <el-select 
          v-model="form.category" 
          placeholder="请选择或输入类别" 
          allow-create 
          filterable 
          default-first-option
          @change="handleCategoryChange"
        >
          <el-option 
            v-for="opt in categoryOptions" 
            :key="opt.id" 
            :label="opt.name" 
            :value="opt.name" 
          >
            <div class="category-option">
              <span>{{ opt.name }}</span>
              <el-icon class="delete-icon" @click.stop="deleteCategory(opt)"><Close /></el-icon>
            </div>
          </el-option>
        </el-select>
      </el-form-item>
      
      <el-form-item label="备注说明" prop="description">
        <el-input v-model="form.description" type="textarea" />
      </el-form-item>
      
      <el-divider content-position="left">凭证上传 (可选，可在列表页补全)</el-divider>
      
      <el-row :gutter="20">
        <el-col :span="8">
          <el-form-item label="实物照片" prop="physical_photo" label-width="80px">
            <div 
              class="upload-area" 
              :class="{ 'is-dragover': dragOver.physical_photo }"
              @dragover.prevent="dragOver.physical_photo = true"
              @dragleave.prevent="dragOver.physical_photo = false"
              @drop.prevent="handleDrop('physical_photo', $event)"
              @click="selectFile('physical_photo', ['jpg', 'png', 'jpeg'])"
            >
              <el-icon class="upload-icon"><Upload /></el-icon>
              <div class="upload-text">点击或拖拽上传 (支持多选)</div>
              <div v-if="form.proofs.physical_photo && form.proofs.physical_photo.length" class="file-list">
                <div v-for="(file, index) in form.proofs.physical_photo" :key="index" class="file-item">
                  <span class="file-name" :title="file">{{ getFileName(file) }}</span>
                  <el-icon class="remove-icon" @click.stop="removeFile('physical_photo', index)"><Close /></el-icon>
                </div>
              </div>
            </div>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="电子发票" prop="electronic_invoice" label-width="80px">
            <div 
              class="upload-area" 
              :class="{ 'is-dragover': dragOver.electronic_invoice }"
              @dragover.prevent="dragOver.electronic_invoice = true"
              @dragleave.prevent="dragOver.electronic_invoice = false"
              @drop.prevent="handleDrop('electronic_invoice', $event)"
              @click="selectFile('electronic_invoice', ['pdf', 'jpg', 'png'])"
            >
              <el-icon class="upload-icon"><Upload /></el-icon>
              <div class="upload-text">点击或拖拽上传 (支持多选)</div>
              <div v-if="form.proofs.electronic_invoice && form.proofs.electronic_invoice.length" class="file-list">
                <div v-for="(file, index) in form.proofs.electronic_invoice" :key="index" class="file-item">
                  <span class="file-name" :title="file">{{ getFileName(file) }}</span>
                  <el-icon class="remove-icon" @click.stop="removeFile('electronic_invoice', index)"><Close /></el-icon>
                </div>
              </div>
            </div>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="支付截图" prop="payment_screenshot" label-width="80px">
            <div 
              class="upload-area" 
              :class="{ 'is-dragover': dragOver.payment_screenshot }"
              @dragover.prevent="dragOver.payment_screenshot = true"
              @dragleave.prevent="dragOver.payment_screenshot = false"
              @drop.prevent="handleDrop('payment_screenshot', $event)"
              @click="selectFile('payment_screenshot', ['jpg', 'png', 'jpeg'])"
            >
              <el-icon class="upload-icon"><Upload /></el-icon>
              <div class="upload-text">点击或拖拽上传 (支持多选)</div>
              <div v-if="form.proofs.payment_screenshot && form.proofs.payment_screenshot.length" class="file-list">
                <div v-for="(file, index) in form.proofs.payment_screenshot" :key="index" class="file-item">
                  <span class="file-name" :title="file">{{ getFileName(file) }}</span>
                  <el-icon class="remove-icon" @click.stop="removeFile('payment_screenshot', index)"><Close /></el-icon>
                </div>
              </div>
            </div>
          </el-form-item>
        </el-col>
      </el-row>
      
      <el-form-item>
        <el-button type="primary" @click="submitForm" :loading="loading">创建报销单</el-button>
        <el-button @click="resetForm">重置</el-button>
      </el-form-item>
    </el-form>
  </el-card>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Upload, Close } from '@element-plus/icons-vue';

const emit = defineEmits(['success']);

const formRef = ref(null);
const loading = ref(false);
const categoryOptions = ref([]);

const loadCategories = async () => {
  try {
    const categories = await window.api.getCategories();
    categoryOptions.value = categories;
  } catch (error) {
    console.error('Failed to load categories:', error);
  }
};

const handleCategoryChange = async (val) => {
  // Check if new category
  if (val && !categoryOptions.value.find(c => c.name === val)) {
    try {
      const newCategory = await window.api.addCategory(val);
      categoryOptions.value.push(newCategory);
      // Re-sort
      categoryOptions.value.sort((a, b) => a.sort_order - b.sort_order);
      ElMessage.success(`已添加新类别: ${val}`);
    } catch (error) {
      ElMessage.error(error.message || '添加类别失败');
      form.category = ''; // Clear invalid input
    }
  }
};

const deleteCategory = async (category) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除类别 "${category.name}" 吗？`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );
    
    await window.api.deleteCategory(category.id);
    ElMessage.success('类别已删除');
    if (form.category === category.name) {
      form.category = '';
    }
    await loadCategories();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete category:', error);
      ElMessage.error('删除类别失败');
    }
  }
};

const dragOver = reactive({
  physical_photo: false,
  electronic_invoice: false,
  payment_screenshot: false
});

const form = reactive({
  id: '',
  date: new Date().toISOString().split('T')[0],
  amount: 0,
  name: '',
  receipt_no: '',
  category: '',
  description: '',
  proofs: {
    physical_photo: [],
    electronic_invoice: [],
    payment_screenshot: []
  }
});

const rules = {
  date: [{ required: true, message: '请选择日期', trigger: 'change' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  category: [{ required: true, message: '请选择或输入类别', trigger: 'change' }],
  name: [{ required: true, message: '请输入报销名称', trigger: 'blur' }],
  // Custom validation for proofs
};

onMounted(() => {
  loadCategories();
});

const selectFile = async (type, extensions) => {
  try {
    const filters = [{ name: 'Allowed Files', extensions }];
    const paths = await window.api.selectFile(filters);
    if (paths && paths.length > 0) {
      // Append files instead of replacing
      form.proofs[type] = [...form.proofs[type], ...paths];
    }
  } catch (error) {
    ElMessage.error('选择文件失败');
  }
};

const handleDrop = (type, event) => {
  dragOver[type] = false;
  const files = event.dataTransfer.files;
  if (files.length > 0) {
    let newPaths = [];
    const allowed = (type === 'physical_photo' || type === 'payment_screenshot') 
      ? ['jpg', 'png', 'jpeg'] 
      : ['pdf', 'jpg', 'png'];

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
      form.proofs[type] = [...form.proofs[type], ...newPaths];
    }
  }
};

const removeFile = (type, index) => {
  form.proofs[type].splice(index, 1);
};

const getFileName = (path) => {
  if (!path) return '';
  return path.split(/[/\\]/).pop();
};

const submitForm = async () => {
  if (!formRef.value) return;
  
  // Removed mandatory file check
  
  await formRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true;
      try {
        // Determine status
        const hasAllProofs = form.proofs.physical_photo.length > 0 && 
                             form.proofs.electronic_invoice.length > 0 && 
                             form.proofs.payment_screenshot.length > 0;
        const data = {
          ...form,
          status: hasAllProofs ? '待提交' : '材料不齐'
        };
        
        const result = await window.api.addReimbursement(JSON.parse(JSON.stringify(data)));
        if (result.success) {
          ElMessage.success('报销单提交成功');
          resetForm();
          emit('success');
        } else {
          ElMessage.error('提交失败: ' + result.error);
        }
      } catch (error) {
        ElMessage.error('系统错误: ' + error.message);
      } finally {
        loading.value = false;
      }
    }
  });
};

const resetForm = () => {
  if (formRef.value) {
    formRef.value.resetFields();
  }
  form.date = new Date().toISOString().split('T')[0];
  form.proofs = {
    physical_photo: [],
    electronic_invoice: [],
    payment_screenshot: []
  };
};


</script>

<style scoped>
.form-card {
  margin-bottom: 20px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.upload-area {
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  padding: 20px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.3s;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
.upload-area:hover, .upload-area.is-dragover {
  border-color: #409eff;
}
.upload-icon {
  font-size: 28px;
  color: #8c939d;
  margin-bottom: 10px;
}
.upload-text {
  color: #606266;
  font-size: 12px;
}
.file-list {
  margin-top: 10px;
  width: 100%;
  text-align: left;
}
.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 5px;
  background-color: #f5f7fa;
  border-radius: 2px;
  margin-bottom: 2px;
}
.file-name {
  font-size: 12px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 80%;
}
.remove-icon {
  cursor: pointer;
  color: #909399;
  font-size: 12px;
}
.remove-icon:hover {
  color: #f56c6c;
}
.category-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}
.delete-icon {
  color: #909399;
  font-size: 14px;
  cursor: pointer;
  padding: 2px;
}
.delete-icon:hover {
  color: #f56c6c;
  background-color: #fef0f0;
  border-radius: 50%;
}
</style>
