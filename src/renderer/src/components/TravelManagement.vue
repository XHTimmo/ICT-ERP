<template>
  <div class="list-container">
    <div class="actions-bar">
      <div class="filters">
        <el-input 
          v-model="filters.keyword" 
          placeholder="搜索差旅" 
          style="width: 200px" 
          clearable
        />
        <el-select 
          v-model="filters.status" 
          placeholder="状态" 
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
      <el-button type="primary" @click="handleCreate">
        新建差旅
      </el-button>
    </div>
    
    <el-table 
      :data="tableData" 
      style="width: 100%" 
      v-loading="loading"
    >
      <el-table-column type="expand">
        <template #default="props">
          <div class="itinerary-list">
            <h4>行程明细</h4>
            <el-table :data="props.row.itineraries" border size="small">
              <el-table-column label="日期" width="180">
                <template #default="scope">
                  {{ formatDate(scope.row.date) }}
                </template>
              </el-table-column>
              <el-table-column prop="from" label="出发地" />
              <el-table-column prop="to" label="目的地" />
              <el-table-column prop="transport" label="交通方式" width="100" />
              <el-table-column label="凭证" width="100">
                <template #default="scope">
                  <el-tag v-if="hasProofs(scope.row)" type="success" size="small">已上传</el-tag>
                  <span v-else class="text-gray-400 text-xs">无</span>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="80">
                <template #default="scope">
                   <el-button link type="primary" size="small" @click="handleEditItinerary(props.row, scope.row, scope.$index)">编辑</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="inline-add-itinerary" style="margin-top: 10px;">
              <el-button size="small" type="primary" plain @click="handleInlineAddItinerary(props.row)">
                <el-icon><Plus /></el-icon> 添加行程
              </el-button>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="date" label="申请日期" width="120" />
      <el-table-column prop="destination" label="目的地" width="150">
         <template #default="scope">
           {{ getMainDestination(scope.row) }}
         </template>
      </el-table-column>
      <el-table-column prop="reason" label="出差事由" />
      <el-table-column label="总金额" width="120">
        <template #default="scope">
          ¥ {{ (scope.row.total_amount || 0).toFixed(2) }}
        </template>
      </el-table-column>
      <el-table-column label="出差时间" width="200">
        <template #default="scope">
           {{ getTravelDates(scope.row) }}
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="100">
        <template #default="scope">
          <el-tag :type="getStatusType(scope.row.status)">
            {{ getStatusLabel(scope.row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220">
        <template #default="scope">
          <el-button size="small" @click="handleEdit(scope.row)">编辑</el-button>
          <el-button size="small" type="success" @click="handleExportProofs(scope.row)">导出凭证</el-button>
          <el-button size="small" type="danger" @click="handleDelete(scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- Travel Edit/Create Dialog -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑差旅' : '新建差旅'"
      width="800px"
      :close-on-click-modal="false"
    >
      <el-form :model="currentTravel" label-width="100px" ref="travelFormRef" :rules="rules">
        <el-form-item label="出差事由" prop="reason">
          <el-input 
            v-model="currentTravel.reason" 
            type="textarea" 
            rows="2" 
            placeholder="请输入出差事由" 
          />
        </el-form-item>

        <el-form-item label="预计总金额" prop="total_amount">
          <el-input-number 
            v-model="currentTravel.total_amount" 
            :min="0" 
            :precision="2" 
            :step="100" 
            style="width: 200px"
          />
        </el-form-item>

        <div class="itinerary-section">
          <div class="section-header">
            <h3>行程明细</h3>
            <el-button type="primary" link @click="addItinerary">
              <el-icon><Plus /></el-icon> 添加行程
            </el-button>
          </div>
          
          <el-table :data="currentTravel.itineraries" border style="width: 100%" empty-text="暂无行程，请点击上方按钮添加">
            <el-table-column label="日期" width="220">
              <template #default="scope">
                <el-date-picker 
                  v-model="scope.row.date" 
                  type="daterange" 
                  start-placeholder="开始"
                  end-placeholder="结束"
                  value-format="YYYY-MM-DD"
                  style="width: 100%"
                  size="small"
                />
              </template>
            </el-table-column>
            <el-table-column label="出发地" width="140">
              <template #default="scope">
                <el-input v-model="scope.row.from" placeholder="出发城市" size="small" />
              </template>
            </el-table-column>
            <el-table-column label="目的地" width="140">
              <template #default="scope">
                <el-input v-model="scope.row.to" placeholder="目的城市" size="small" />
              </template>
            </el-table-column>
             <el-table-column label="交通方式" width="120">
              <template #default="scope">
                <el-select v-model="scope.row.transport" placeholder="请选择" size="small">
                  <el-option label="飞机" value="飞机" />
                  <el-option label="火车" value="火车" />
                  <el-option label="汽车" value="汽车" />
                  <el-option label="其他" value="其他" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80" align="center">
              <template #default="scope">
                <el-button type="danger" link size="small" @click="removeItinerary(scope.$index)">
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <el-form-item label="状态" prop="status" style="margin-top: 20px">
          <el-select v-model="currentTravel.status" placeholder="请选择状态">
             <el-option label="材料不齐" value="材料不齐" />
             <el-option label="待提交" value="待提交" />
             <el-option label="待审核" value="待审核" />
             <el-option label="待打款" value="待打款" />
             <el-option label="已完成" value="已完成" />
          </el-select>
        </el-form-item>

      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSave">确定</el-button>
        </span>
      </template>
    </el-dialog>
    <!-- Inline Itinerary Dialog -->
    <el-dialog
      v-model="itineraryDialogVisible"
      :title="isEditItinerary ? '编辑行程' : '添加行程'"
      width="600px"
    >
      <el-form :model="newItinerary" label-width="100px">
        <el-form-item label="日期">
          <el-date-picker 
            v-model="newItinerary.date" 
            type="daterange" 
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="出发地">
          <el-input v-model="newItinerary.from" placeholder="出发城市" />
        </el-form-item>
        <el-form-item label="目的地">
          <el-input v-model="newItinerary.to" placeholder="目的城市" />
        </el-form-item>
        <el-form-item label="交通方式">
          <el-select v-model="newItinerary.transport" placeholder="请选择" style="width: 100%">
            <el-option label="飞机" value="飞机" />
            <el-option label="火车" value="火车" />
            <el-option label="汽车" value="汽车" />
            <el-option label="其他" value="其他" />
          </el-select>
        </el-form-item>
        
        <el-divider content-position="left">报销凭证</el-divider>
        
        <el-form-item label="车票">
          <el-upload
            action="#"
            list-type="text"
            :auto-upload="false"
            :limit="1"
            :on-change="(file) => handleFileChange(file, 'ticket')"
            :file-list="newItinerary.ticket ? [newItinerary.ticket] : []"
          >
            <el-button type="primary" size="small">上传车票</el-button>
          </el-upload>
        </el-form-item>

        <el-form-item label="酒店发票">
          <el-upload
            action="#"
            list-type="text"
            :auto-upload="false"
            :limit="1"
            :on-change="(file) => handleFileChange(file, 'hotelInvoice')"
            :file-list="newItinerary.hotelInvoice ? [newItinerary.hotelInvoice] : []"
          >
            <el-button type="primary" size="small">上传发票</el-button>
          </el-upload>
        </el-form-item>

        <el-form-item label="酒店水单">
          <el-upload
            action="#"
            list-type="text"
            :auto-upload="false"
            :limit="1"
            :on-change="(file) => handleFileChange(file, 'hotelStatement')"
            :file-list="newItinerary.hotelStatement ? [newItinerary.hotelStatement] : []"
          >
            <el-button type="primary" size="small">上传水单</el-button>
          </el-upload>
        </el-form-item>

        <el-form-item label="出差申请">
          <el-upload
            action="#"
            list-type="text"
            :auto-upload="false"
            :limit="1"
            :on-change="(file) => handleFileChange(file, 'travelRequest')"
            :file-list="newItinerary.travelRequest ? [newItinerary.travelRequest] : []"
          >
            <el-button type="primary" size="small">上传申请单</el-button>
          </el-upload>
        </el-form-item>

      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="itineraryDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveItinerary">保存</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import dayjs from 'dayjs';

const loading = ref(false);
const dialogVisible = ref(false);
const itineraryDialogVisible = ref(false);
const isEdit = ref(false);
const isEditItinerary = ref(false);
const editingItineraryIndex = ref(-1);
const travelFormRef = ref(null);
const currentTravelRow = ref(null);

const filters = reactive({
  keyword: '',
  status: '',
  dateRange: []
});

const rules = {
  reason: [{ required: true, message: '请输入出差事由', trigger: 'blur' }],
  status: [{ required: true, message: '请选择状态', trigger: 'change' }]
};

const currentTravel = reactive({
  id: null,
  date: '',
  reason: '',
  status: '待提交',
  total_amount: 0,
  itineraries: []
});

const newItinerary = reactive({
  date: [],
  from: '',
  to: '',
  transport: '',
  ticket: null,
  hotelInvoice: null,
  hotelStatement: null,
  travelRequest: null
});

const formatDate = (dateVal) => {
  if (Array.isArray(dateVal)) {
    return dateVal.join(' 至 ');
  }
  return dateVal;
};

const tableData = ref([]);

const loadTravels = async () => {
  loading.value = true;
  try {
    const data = await window.api.getTravels();
    tableData.value = data;
  } catch (error) {
    ElMessage.error('获取差旅列表失败');
    console.error(error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadTravels();
});

const getStatusType = (status) => {
  const map = {
    '材料不齐': 'danger',
    '待提交': 'info',
    '待审核': 'warning',
    '待打款': 'primary',
    '已完成': 'success',
    // Backward compatibility
    pending_submission: 'info',
    pending_approval: 'warning',
    pending_reimbursement: 'primary',
    pending_closure: 'success'
  };
  return map[status] || '';
};

const getStatusLabel = (status) => {
  const map = {
    pending_submission: '待提交',
    pending_approval: '待审核',
    pending_reimbursement: '待打款', // Changed to 待打款
    pending_closure: '已完成' // Changed to 已完成
  };
  return map[status] || status;
};

const getMainDestination = (row) => {
  if (!row.itineraries || row.itineraries.length === 0) return '-';
  // Return unique destinations excluding 'from' of first leg if it's round trip, 
  // simplified: just join all unique 'to' locations
  const destinations = [...new Set(row.itineraries.map(i => i.to))];
  return destinations.join(', ');
};

const getTravelDates = (row) => {
  if (!row.itineraries || row.itineraries.length === 0) return '-';
  const dates = row.itineraries
    .flatMap(i => Array.isArray(i.date) ? i.date : [i.date])
    .filter(d => d)
    .sort();
  if (dates.length === 0) return '-';
  if (dates.length === 1) return dates[0];
  return `${dates[0]} 至 ${dates[dates.length - 1]}`;
};

const resetForm = () => {
  currentTravel.id = null;
  currentTravel.date = dayjs().format('YYYY-MM-DD');
  currentTravel.reason = '';
  currentTravel.status = '待提交';
  currentTravel.total_amount = 0;
  currentTravel.itineraries = [];
  if (travelFormRef.value) {
    travelFormRef.value.clearValidate();
  }
};

const handleCreate = () => {
  isEdit.value = false;
  resetForm();
  dialogVisible.value = true;
};

const handleEdit = (row) => {
  isEdit.value = true;
  currentTravel.id = row.id;
  currentTravel.date = row.date;
  currentTravel.reason = row.reason;
  currentTravel.status = row.status;
  currentTravel.total_amount = row.total_amount || 0;
  // Deep copy itineraries to avoid modifying table data directly before save
  currentTravel.itineraries = JSON.parse(JSON.stringify(row.itineraries || []));
  dialogVisible.value = true;
};

const handleDelete = (row) => {
  ElMessageBox.confirm(
    '确定要删除这条差旅申请吗？',
    '警告',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  ).then(async () => {
    try {
      await window.api.deleteTravel(row.id);
      ElMessage.success('删除成功');
      await loadTravels();
    } catch (error) {
      ElMessage.error('删除失败');
      console.error(error);
    }
  }).catch(() => {});
};

const addItinerary = () => {
  currentTravel.itineraries.push({
    date: [],
    from: '',
    to: '',
    transport: ''
  });
};

const removeItinerary = (index) => {
  currentTravel.itineraries.splice(index, 1);
};

const handleSave = async () => {
  if (!travelFormRef.value) return;
  
  await travelFormRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true;
      try {
        // Deep clone to ensure data is serializable and free of Vue proxies
        const travelData = JSON.parse(JSON.stringify(currentTravel));
        
        if (isEdit.value) {
          await window.api.updateTravel({
            ...travelData,
            itineraries: travelData.itineraries
          });
          ElMessage.success('更新成功');
        } else {
          await window.api.addTravel({
            ...travelData,
            date: travelData.date || dayjs().format('YYYY-MM-DD'),
            itineraries: travelData.itineraries
          });
          ElMessage.success('创建成功');
        }
        dialogVisible.value = false;
        await loadTravels();
      } catch (error) {
        ElMessage.error(`保存失败: ${error.message || '未知错误'}`);
        console.error(error);
      } finally {
        loading.value = false;
      }
    }
  });
};
const hasProofs = (itinerary) => {
  return itinerary.ticket || itinerary.hotelInvoice || itinerary.hotelStatement || itinerary.travelRequest;
};

const handleFileChange = (file, type) => {
  // Only store serializable data to avoid "object could not be cloned" error
  if (file) {
    newItinerary[type] = {
      name: file.name,
      path: file.raw?.path || file.path,
      uid: file.uid
    };
  } else {
    newItinerary[type] = null;
  }
};

const handleInlineAddItinerary = (row) => {
  isEditItinerary.value = false;
  editingItineraryIndex.value = -1;
  currentTravelRow.value = row;
  
  // Reset form
    Object.keys(newItinerary).forEach(key => {
      if (key === 'date') {
        newItinerary[key] = [];
      } else if (key === 'ticket' || key === 'hotelInvoice' || key === 'hotelStatement' || key === 'travelRequest') {
        newItinerary[key] = null;
      } else {
        newItinerary[key] = '';
      }
    });
  
  itineraryDialogVisible.value = true;
};

const handleEditItinerary = (row, itinerary, index) => {
  isEditItinerary.value = true;
  editingItineraryIndex.value = index;
  currentTravelRow.value = row;
  
  // Fill form
  Object.assign(newItinerary, itinerary);
  
  itineraryDialogVisible.value = true;
};

const saveItinerary = async () => {
  if (currentTravelRow.value) {
    if (!currentTravelRow.value.itineraries) {
      currentTravelRow.value.itineraries = [];
    }
    
    // Deep clone to ensure no reactive proxies
    const itineraryData = JSON.parse(JSON.stringify(newItinerary));
    
    if (isEditItinerary.value && editingItineraryIndex.value !== -1) {
      // Update existing
      currentTravelRow.value.itineraries[editingItineraryIndex.value] = itineraryData;
    } else {
      // Add new
      currentTravelRow.value.itineraries.push(itineraryData);
    }

    if (currentTravelRow.value.id) {
      try {
        await window.api.updateTravel({
          id: currentTravelRow.value.id,
          itineraries: JSON.parse(JSON.stringify(currentTravelRow.value.itineraries))
        });
        ElMessage.success('行程更新成功');
      } catch (error) {
        ElMessage.error('行程保存失败');
        console.error(error);
      }
    } else {
       ElMessage.success('行程添加成功');
    }
    
    itineraryDialogVisible.value = false;
  }
};

const handleExportProofs = async (row) => {
  if (!row.itineraries || row.itineraries.length === 0) {
    ElMessage.warning('该差旅申请没有行程明细');
    return;
  }
  
  // Check if there are any proofs
  const hasAnyProof = row.itineraries.some(itinerary => hasProofs(itinerary));
  if (!hasAnyProof) {
    ElMessage.warning('该差旅申请没有上传任何凭证');
    return;
  }

  const exportData = {
    date: row.date,
    itineraries: row.itineraries.map(itinerary => {
      // Extract paths from file objects
      const extractPath = (fileObj) => {
        if (!fileObj) return null;
        // Check for File object with raw path (Electron specific behavior)
        if (fileObj.raw && fileObj.raw.path) return { path: fileObj.raw.path };
        if (fileObj.path) return { path: fileObj.path };
        // If it's just a file object without path, we can't export it
        return null;
      };

      return {
        date: itinerary.date,
        from: itinerary.from,
        to: itinerary.to,
        ticket: extractPath(itinerary.ticket),
        hotelInvoice: extractPath(itinerary.hotelInvoice),
        hotelStatement: extractPath(itinerary.hotelStatement),
        travelRequest: extractPath(itinerary.travelRequest)
      };
    })
  };

  try {
    if (window.api && window.api.exportTravelProofs) {
      const result = await window.api.exportTravelProofs(exportData);
      if (result.success) {
        ElMessage.success(`凭证已导出至: ${result.filePath}`);
      } else {
        if (result.message === '已取消') {
           ElMessage.info('导出已取消');
        } else {
           ElMessage.error(`导出失败: ${result.error || '未知错误'}`);
        }
      }
    } else {
      ElMessage.warning('当前环境不支持导出功能');
    }
  } catch (error) {
    console.error(error);
    ElMessage.error('导出过程中发生错误');
  }
};
</script>

<style scoped>
.list-container {
  padding: 20px;
}

.actions-bar {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.filters {
  display: flex;
  gap: 15px;
}

.itinerary-section {
  margin-top: 20px;
  border: 1px solid #ebeef5;
  padding: 15px;
  border-radius: 4px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
  color: #303133;
}

.itinerary-list {
  padding: 10px 20px;
  background-color: #f8f9fa;
  border-radius: 4px;
}

.itinerary-list h4 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #606266;
}
</style>
