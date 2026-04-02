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
          <el-option
            v-for="status in statusFilterOptions"
            :key="status"
            :label="status"
            :value="status"
          />
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
      <div class="actions-right">
        <el-switch
          v-model="showCompleted"
          inline-prompt
          active-text="显示已完成"
          inactive-text="隐藏已完成"
        />
        <el-select v-model="pageSize" style="width: 110px">
          <el-option :value="10" label="每页10条" />
          <el-option :value="20" label="每页20条" />
        </el-select>
        <el-button type="success" @click="openClaimDialog" :disabled="selectedRows.length === 0">
          导入报销单 ({{ selectedRows.length }})
        </el-button>
        <el-button type="primary" @click="handleExport" :disabled="selectedRows.length === 0">
          批量导出 ({{ selectedRows.length }})
        </el-button>
      </div>
    </div>
    
    <div v-loading="loading" class="grouped-list">
      <template v-if="statusGroups.length">
        <div
          v-for="group in statusGroups"
          :key="group.status"
          class="status-group-card"
          :class="`status-group-${getStatusColor(group.status)}`"
        >
          <div class="status-group-header">
            <div class="status-group-title">
              <el-tag :type="getStatusTagType(group.status)" size="large">
                {{ group.status }}
              </el-tag>
              <el-text class="status-group-count">共 {{ group.total }} 条</el-text>
            </div>
          </div>

          <el-skeleton v-if="group.loading" :rows="3" animated />
          <el-table
            v-else
            :data="group.pageData"
            style="width: 100%"
            :row-key="(row) => row.id"
          >
            <el-table-column width="60" label="选择">
              <template #default="scope">
                <el-checkbox
                  :model-value="isRowSelected(scope.row.id)"
                  @change="(checked) => toggleRowSelection(scope.row.id, checked)"
                />
              </template>
            </el-table-column>
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
            <el-table-column prop="date" label="日期" width="120" sortable />
            <el-table-column prop="name" label="报销名称" width="150" />
            <el-table-column prop="receipt_no" label="报销单号" width="150" sortable />
            <el-table-column prop="status" label="状态" width="160">
              <template #default="scope">
                <el-select
                  v-model="scope.row.status"
                  size="small"
                  @change="(val) => handleStatusChange(scope.row, val)"
                >
                  <el-option
                    v-for="status in statusSelectOptions"
                    :key="status"
                    :label="status"
                    :value="status"
                  />
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
                  <el-badge :value="getProofCount(getProofByType(scope.row, 'physical_photo'))" :hidden="!getProofCount(getProofByType(scope.row, 'physical_photo'))" type="primary">
                    <el-button
                      size="small"
                      type="primary"
                      plain
                      @click="viewProofs(getProofByType(scope.row, 'physical_photo'), '实物照片')"
                      :disabled="!getProofCount(getProofByType(scope.row, 'physical_photo'))"
                    >
                      实物
                    </el-button>
                  </el-badge>
                  <el-badge :value="getProofCount(getProofByType(scope.row, 'electronic_invoice'))" :hidden="!getProofCount(getProofByType(scope.row, 'electronic_invoice'))" type="success">
                    <el-button
                      size="small"
                      type="success"
                      plain
                      @click="viewProofs(getProofByType(scope.row, 'electronic_invoice'), '电子发票')"
                      :disabled="!getProofCount(getProofByType(scope.row, 'electronic_invoice'))"
                    >
                      发票
                    </el-button>
                  </el-badge>
                  <el-badge :value="getProofCount(getProofByType(scope.row, 'payment_screenshot'))" :hidden="!getProofCount(getProofByType(scope.row, 'payment_screenshot'))" type="warning">
                    <el-button
                      size="small"
                      type="warning"
                      plain
                      @click="viewProofs(getProofByType(scope.row, 'payment_screenshot'), '支付截图')"
                      :disabled="!getProofCount(getProofByType(scope.row, 'payment_screenshot'))"
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

          <div class="status-pagination" v-if="group.total > pageSize">
            <el-pagination
              layout="total, prev, pager, next, jumper"
              :total="group.total"
              :page-size="pageSize"
              :current-page="group.currentPage"
              @current-change="(page) => handleGroupPageChange(group.status, page)"
            />
          </div>
        </div>
      </template>
      <el-empty v-else description="暂无符合条件的报销记录" />
    </div>
    
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
        <el-form-item label="报销单号">
          <el-input v-model="copyForm.receipt_no" placeholder="选填" />
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
        <el-form-item label="报销单号">
          <el-input v-model="editForm.receipt_no" placeholder="选填" />
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

    <el-dialog v-model="claimDialogVisible" title="导入报销单" width="500px">
      <el-form :model="claimForm" label-width="100px" ref="claimFormRef">
        <el-form-item label="报销单号" required>
          <el-input v-model="claimForm.claim_no" placeholder="请输入报销单号" />
        </el-form-item>
        <el-form-item label="审核日期" required>
          <el-date-picker
            v-model="claimForm.approval_date"
            type="date"
            placeholder="选择审核日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="选中数量">
          <el-text>{{ selectedRows.length }} 条</el-text>
        </el-form-item>
        <el-form-item label="预计总金额">
          <el-text type="danger">¥ {{ selectedTotalAmount.toFixed(2) }}</el-text>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="claimDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitClaim" :loading="claimLoading">导入</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus';
import { Delete, Upload, Close, DocumentCopy } from '@element-plus/icons-vue';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);

const tableData = ref([]);
const loading = ref(false);
const selectedRowIds = ref([]);
const showCompleted = ref(false);
const pageSize = ref(10);
const groupPages = ref({});
const groupedStatusData = ref({});
const statusLoadingMap = ref({});
const uploadDialogVisible = ref(false);
const editDialogVisible = ref(false);
const copyDialogVisible = ref(false);
const claimDialogVisible = ref(false);
const claimLoading = ref(false);
const claimFormRef = ref(null);
const claimForm = ref({
  claim_no: '',
  approval_date: dayjs().format('YYYY-MM-DD')
});

const selectedRows = computed(() => {
  const selectedIdSet = new Set(selectedRowIds.value);
  return tableData.value.filter(row => selectedIdSet.has(row.id));
});

const selectedTotalAmount = computed(() => selectedRows.value.reduce((sum, row) => sum + (row.amount || 0), 0));

const openClaimDialog = () => {
  if (selectedRows.value.length === 0) return;
  // check if any already has a claim_id (if we want to prevent re-import, but let's just let it overwrite or not check for now, 
  // or we can just proceed)
  claimForm.value = {
    claim_no: '',
    approval_date: dayjs().format('YYYY-MM-DD')
  };
  claimDialogVisible.value = true;
};

const submitClaim = async () => {
  if (!claimForm.value.claim_no) {
    ElMessage.warning('请输入报销单号');
    return;
  }
  if (!claimForm.value.approval_date) {
    ElMessage.warning('请选择审核日期');
    return;
  }
  
  claimLoading.value = true;
  try {
    const itemIds = selectedRows.value.map(row => row.id);
    const result = await window.api.addClaim({
      data: {
        claim_no: claimForm.value.claim_no,
        approval_date: claimForm.value.approval_date
      },
      item_ids: itemIds
    });
    
    if (result.success) {
      ElMessage.success('导入报销单成功');
      claimDialogVisible.value = false;
      fetchData(); // Refresh list to reflect changes (though claim_id is not shown in this table, it's good practice)
    } else {
      ElMessage.error('导入失败: ' + result.error);
    }
  } catch (error) {
    ElMessage.error('导入失败: ' + error.message);
  } finally {
    claimLoading.value = false;
  }
};

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
const defaultStatusOrder = ['待提交', '审批中', '待审核', '待报销', '待打款', '待闭环', '已批准', '已拒绝', '材料不齐', '已完成'];

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

const statusFilterOptions = computed(() => {
  const fromData = tableData.value.map(item => item.status).filter(Boolean);
  const merged = Array.from(new Set([...defaultStatusOrder, ...statusOrder.value, ...fromData]));
  return merged;
});

const statusSelectOptions = computed(() => {
  const fromData = tableData.value.map(item => item.status).filter(Boolean);
  return Array.from(new Set([...defaultStatusOrder, ...statusOrder.value, ...fromData]));
});

const filteredAndSortedData = computed(() => {
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

const getStatusIndex = (status) => {
  const index = statusOrder.value.indexOf(status);
  if (index !== -1) return index;
  const fallback = defaultStatusOrder.indexOf(status);
  return fallback !== -1 ? fallback : 999;
};

const sortStatuses = (statuses) => {
  return [...statuses].sort((a, b) => getStatusIndex(a) - getStatusIndex(b));
};

const rebuildGroupedStatusData = async () => {
  const grouped = filteredAndSortedData.value.reduce((acc, row) => {
    const status = row.status || '未分类';
    if (!acc[status]) acc[status] = [];
    acc[status].push(row);
    return acc;
  }, {});

  const allStatuses = sortStatuses(Array.from(new Set([...Object.keys(grouped)])));
  const nextGrouped = {};
  const nextLoading = {};

  allStatuses.forEach((status) => {
    nextLoading[status] = true;
    if (!groupPages.value[status]) {
      groupPages.value[status] = 1;
    }
  });

  statusLoadingMap.value = nextLoading;
  groupedStatusData.value = {};

  for (const status of allStatuses) {
    await new Promise(resolve => setTimeout(resolve, 0));
    nextGrouped[status] = grouped[status] || [];
    groupedStatusData.value = { ...groupedStatusData.value, [status]: nextGrouped[status] };
    statusLoadingMap.value = { ...statusLoadingMap.value, [status]: false };
  }
};

const isCompletedStatus = (status) => status === '已完成';

const getStatusColor = (status) => {
  if (status === '待提交') return 'blue';
  if (['审批中', '待审核', '待打款', '待报销', '待闭环'].includes(status)) return 'orange';
  if (status === '已批准') return 'green';
  if (['已拒绝', '材料不齐'].includes(status)) return 'red';
  if (status === '已完成') return 'gray';
  return 'blue';
};

const getStatusTagType = (status) => {
  const color = getStatusColor(status);
  if (color === 'orange') return 'warning';
  if (color === 'green') return 'success';
  if (color === 'red') return 'danger';
  if (color === 'gray') return 'info';
  return 'primary';
};

const statusGroups = computed(() => {
  const groups = sortStatuses(Object.keys(groupedStatusData.value))
    .filter(status => showCompleted.value || !isCompletedStatus(status))
    .filter(status => !filters.value.status || status === filters.value.status)
    .map((status) => {
      const rows = groupedStatusData.value[status] || [];
      const totalPages = Math.max(1, Math.ceil(rows.length / pageSize.value));
      const currentPage = Math.min(groupPages.value[status] || 1, totalPages);
      const start = (currentPage - 1) * pageSize.value;
      const end = start + pageSize.value;

      return {
        status,
        loading: statusLoadingMap.value[status],
        total: rows.length,
        currentPage,
        pageData: rows.slice(start, end)
      };
    });

  return groups;
});

const handleGroupPageChange = (status, page) => {
  groupPages.value = { ...groupPages.value, [status]: page };
};

const isRowSelected = (id) => selectedRowIds.value.includes(id);

const toggleRowSelection = (id, checked) => {
  const idSet = new Set(selectedRowIds.value);
  if (checked) {
    idSet.add(id);
  } else {
    idSet.delete(id);
  }
  selectedRowIds.value = Array.from(idSet);
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
    selectedRowIds.value = selectedRowIds.value.filter(id => data.some(item => item.id === id));
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
    receipt_no: row.receipt_no || '',
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
    receipt_no: '', // 复制时不保留报销单号
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

const getProofByType = (row, type) => {
  if (!row || !row.proofs || typeof row.proofs !== 'object') return [];
  const value = row.proofs[type];
  if (!value) return [];
  return value;
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

watch([filteredAndSortedData, pageSize], async () => {
  await rebuildGroupedStatusData();
}, { immediate: true });

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
.actions-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.grouped-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.status-group-card {
  border-radius: 8px;
  border: 1px solid #dcdfe6;
  padding: 12px;
  background: #fff;
}
.status-group-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.status-group-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.status-group-count {
  color: #606266;
  font-size: 13px;
}
.status-group-blue {
  border-left: 4px solid #1d4ed8;
}
.status-group-orange {
  border-left: 4px solid #b45309;
}
.status-group-green {
  border-left: 4px solid #15803d;
}
.status-group-red {
  border-left: 4px solid #b91c1c;
}
.status-group-gray {
  border-left: 4px solid #4b5563;
}
.status-pagination {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
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
