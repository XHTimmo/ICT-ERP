<template>
  <div class="list-container">
    <div class="actions-bar">
      <div class="filters">
        <el-input
          v-model="filters.keyword"
          placeholder="搜索差旅事由/目的地"
          style="width: 220px"
          clearable
        />
        <el-select
          v-model="filters.status"
          placeholder="差旅状态"
          clearable
          style="width: 150px"
        >
          <el-option
            v-for="status in statusOptions"
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
        <el-button type="primary" @click="handleCreate" :disabled="!permissions.canUpload">
          新建差旅
        </el-button>
        <el-dropdown trigger="click" @command="handleExport" :disabled="!permissions.canExport || exportSourceRows.length === 0">
          <el-button type="success" :disabled="!permissions.canExport || exportSourceRows.length === 0">
            批量导出 ({{ exportSourceRows.length }})
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="excel">导出 Excel</el-dropdown-item>
              <el-dropdown-item command="pdf">导出 PDF</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <el-table
      :data="filteredData"
      style="width: 100%"
      v-loading="loading"
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
          <div class="itinerary-list">
            <h4>行程明细</h4>
            <el-table :data="props.row.itineraries || []" border size="small">
              <el-table-column label="日期" width="180">
                <template #default="scope">
                  {{ formatDate(scope.row.date) }}
                </template>
              </el-table-column>
              <el-table-column prop="from" label="出发地" />
              <el-table-column prop="to" label="目的地" />
              <el-table-column prop="transport" label="交通方式" width="100" />
              <el-table-column label="单据数量" width="100">
                <template #default="scope">
                  {{ getDocuments(scope.row).length }}
                </template>
              </el-table-column>
              <el-table-column label="消费条例" width="220">
                <template #default="scope">
                  {{ getExpenses(scope.row).length }} 条 / ¥ {{ getExpenseTotal(scope.row).toFixed(2) }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="340">
                <template #default="scope">
                  <el-button link type="primary" size="small" @click="openDocumentManager(props.row, scope.$index)" :disabled="!permissions.canUpload">
                    单据管理
                  </el-button>
                  <el-button link type="primary" size="small" @click="openExpenseManager(props.row, scope.$index)" :disabled="!permissions.canUpload">
                    消费条例
                  </el-button>
                  <el-button link type="primary" size="small" @click="openDocumentPreviewList(props.row, scope.$index)" :disabled="!permissions.canView">
                    查看单据
                  </el-button>
                  <el-button link type="primary" size="small" @click="handleEditItinerary(props.row, scope.row, scope.$index)" :disabled="!permissions.canUpload">
                    编辑行程
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="inline-add-itinerary">
              <el-button size="small" type="primary" plain @click="handleInlineAddItinerary(props.row)" :disabled="!permissions.canUpload">
                <el-icon><Plus /></el-icon> 添加行程
              </el-button>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="date" label="申请日期" width="120" />
      <el-table-column label="目的地" width="180">
        <template #default="scope">
          {{ getMainDestination(scope.row) }}
        </template>
      </el-table-column>
      <el-table-column prop="reason" label="出差事由" min-width="180" />
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
      <el-table-column prop="status" label="状态" width="120">
        <template #default="scope">
          <el-tag :type="getStatusType(scope.row.status)">
            {{ scope.row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="210">
        <template #default="scope">
          <el-button size="small" @click="handleEdit(scope.row)" :disabled="!permissions.canUpload">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(scope.row)" :disabled="!permissions.canDelete">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑差旅' : '新建差旅'"
      width="900px"
      :close-on-click-modal="false"
    >
      <el-form :model="currentTravel" label-width="100px" ref="travelFormRef" :rules="rules">
        <el-form-item label="出差事由" prop="reason">
          <el-input v-model="currentTravel.reason" type="textarea" rows="2" placeholder="请输入出差事由" />
        </el-form-item>
        <el-form-item label="预计总金额" prop="total_amount">
          <el-input-number v-model="currentTravel.total_amount" :min="0" :precision="2" :step="100" style="width: 220px" />
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
            <el-table-column label="单据" width="140">
              <template #default="scope">
                <el-button link type="primary" size="small" @click="openDocumentManager(currentTravel, scope.$index)">
                  管理单据({{ getDocuments(scope.row).length }})
                </el-button>
              </template>
            </el-table-column>
            <el-table-column label="消费条例" width="170">
              <template #default="scope">
                <el-button link type="primary" size="small" @click="openExpenseManager(currentTravel, scope.$index)">
                  管理消费({{ getExpenses(scope.row).length }})
                </el-button>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="80" align="center">
              <template #default="scope">
                <el-button type="danger" link size="small" @click="removeItinerary(scope.$index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <el-form-item label="状态" prop="status" style="margin-top: 20px">
          <el-select v-model="currentTravel.status" placeholder="请选择状态">
            <el-option v-for="status in statusOptions" :key="status" :label="status" :value="status" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSave" :disabled="!permissions.canUpload">确定</el-button>
        </span>
      </template>
    </el-dialog>

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
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="itineraryDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveItinerary" :disabled="!permissions.canUpload">保存</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog v-model="docDialogVisible" title="单据管理" width="860px">
      <div class="upload-area" :class="{ 'is-dragover': docDragOver }" @dragover.prevent="docDragOver = true" @dragleave.prevent="docDragOver = false" @drop.prevent="handleDropDocuments">
        <el-icon class="upload-icon"><Upload /></el-icon>
        <div class="upload-text">点击或拖拽上传单据（单文件不超过10MB）</div>
        <div class="upload-type-row">
          <el-select v-model="currentDocumentType" style="width: 220px" size="small">
            <el-option
              v-for="item in documentTypeOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <span class="upload-type-hint">{{ currentDocumentTypeHint }}</span>
        </div>
        <el-button type="primary" size="small" @click.stop="selectDocumentFiles" :disabled="!permissions.canUpload">选择文件</el-button>
      </div>

      <div class="doc-grid" v-if="editingDocuments.length">
        <div v-for="doc in editingDocuments" :key="doc.id" class="doc-card">
          <div class="doc-thumb" @click="openPreview(doc)">
            <img v-if="isImageDoc(doc)" :src="toFileUrl(doc.path)" />
            <div v-else class="doc-pdf">PDF</div>
          </div>
          <div class="doc-name" :title="doc.name">{{ doc.name }}</div>
          <div class="doc-meta">单据类型：{{ doc.type || '交通工具发票' }}</div>
          <div class="doc-meta">上传时间：{{ formatTime(doc.uploadedAt) }}</div>
          <div class="doc-meta">文件大小：{{ formatSize(doc.size) }}</div>
          <div class="doc-actions">
            <el-button size="small" @click="openPreview(doc)" :disabled="!permissions.canView">查看</el-button>
            <el-button size="small" type="danger" @click="removeDocument(doc.id)" :disabled="!permissions.canDelete">删除</el-button>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无单据" />

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="docDialogVisible = false">关闭</el-button>
          <el-button type="primary" @click="saveDocuments" :disabled="!permissions.canUpload">保存</el-button>
        </span>
      </template>
    </el-dialog>

    <el-dialog v-model="previewDialogVisible" title="单据查看" width="92%" class="preview-dialog">
      <div class="preview-toolbar">
        <el-button @click="zoomOut" :icon="ZoomOut" />
        <el-button @click="zoomIn" :icon="ZoomIn" />
        <el-button @click="rotatePreview" :icon="RefreshRight" />
        <el-button @click="toggleFullscreen" :icon="FullScreen" />
        <el-button @click="resetTransform">重置</el-button>
        <el-button type="primary" @click="openCurrentFile">打开文件</el-button>
      </div>
      <div class="preview-meta" v-if="currentPreviewDoc">
        <span>文件名：{{ currentPreviewDoc.name }}</span>
        <span>上传时间：{{ formatTime(currentPreviewDoc.uploadedAt) }}</span>
        <span>文件大小：{{ formatSize(currentPreviewDoc.size) }}</span>
      </div>
      <div class="preview-content" :class="{ fullscreen: previewFullscreen }">
        <img
          v-if="currentPreviewDoc && isImageDoc(currentPreviewDoc)"
          :src="toFileUrl(currentPreviewDoc.path)"
          :style="previewStyle"
          class="preview-image"
        />
        <iframe
          v-else-if="currentPreviewDoc"
          :src="toFileUrl(currentPreviewDoc.path)"
          :style="previewStyle"
          class="preview-frame"
        />
      </div>
    </el-dialog>

    <el-dialog v-model="expenseDialogVisible" title="消费条例管理" width="860px">
      <div class="expense-toolbar">
        <el-button type="primary" size="small" @click="addExpenseItem" :disabled="!permissions.canUpload">
          <el-icon><Plus /></el-icon> 添加消费条例
        </el-button>
      </div>
      <el-table :data="editingExpenses" border style="width: 100%" empty-text="暂无消费条例">
        <el-table-column label="费用类型" width="180">
          <template #default="scope">
            <el-select v-model="scope.row.type" placeholder="请选择类型" size="small">
              <el-option v-for="option in expenseTypeOptions" :key="option" :label="option" :value="option" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="170">
          <template #default="scope">
            <el-input-number v-model="scope.row.amount" :min="0" :precision="2" :step="10" size="small" style="width: 150px" />
          </template>
        </el-table-column>
        <el-table-column label="备注">
          <template #default="scope">
            <el-input v-model="scope.row.note" placeholder="可填写说明（可选）" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" align="center">
          <template #default="scope">
            <el-button type="danger" link size="small" @click="removeExpenseItem(scope.$index)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="expense-summary">合计：¥ {{ expenseTotalInDialog.toFixed(2) }}</div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="expenseDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveExpenses" :disabled="!permissions.canUpload">保存</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus';
import { Plus, Upload, ZoomIn, ZoomOut, RefreshRight, FullScreen } from '@element-plus/icons-vue';
import dayjs from 'dayjs';

const loading = ref(false);
const dialogVisible = ref(false);
const itineraryDialogVisible = ref(false);
const docDialogVisible = ref(false);
const previewDialogVisible = ref(false);
const expenseDialogVisible = ref(false);
const previewFullscreen = ref(false);
const isEdit = ref(false);
const isEditItinerary = ref(false);
const editingItineraryIndex = ref(-1);
const travelFormRef = ref(null);
const currentTravelRow = ref(null);
const selectedRowIds = ref([]);
const docDragOver = ref(false);

const role = ref(localStorage.getItem('erp_user_role') || 'admin');
const permissionControlEnabled = ref(false);
const rolePermissions = {
  admin: { canUpload: true, canView: true, canDelete: true, canExport: true },
  editor: { canUpload: true, canView: true, canDelete: false, canExport: true },
  viewer: { canUpload: false, canView: true, canDelete: false, canExport: false }
};
const permissions = computed(() => {
  if (!permissionControlEnabled.value) {
    return rolePermissions.admin;
  }
  return rolePermissions[role.value] || rolePermissions.admin;
});

const statusOptions = ['材料不齐', '待提交', '待审核', '待打款', '已完成'];
const allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf'];
const maxFileSize = 10 * 1024 * 1024;
const documentTypeOptions = [
  { value: '出差申请', label: '出差申请（仅 PDF）' },
  { value: '酒店发票', label: '酒店发票' },
  { value: '酒店水单', label: '酒店水单' },
  { value: '交通工具发票', label: '交通工具发票' }
];
const defaultDocumentType = '交通工具发票';
const currentDocumentType = ref(defaultDocumentType);
const normalizeDocumentType = (type) => {
  if (!type || type === '单据' || type === '车票') return '交通工具发票';
  if (['ticket', 'transportTicket', 'transportInvoice'].includes(type)) return '交通工具发票';
  if (type === 'hotelInvoice') return '酒店发票';
  if (type === 'hotelStatement') return '酒店水单';
  if (type === 'travelRequest') return '出差申请';
  return documentTypeOptions.some(item => item.value === type) ? type : defaultDocumentType;
};
const getAllowedExtensionsByType = (type) => {
  if (normalizeDocumentType(type) === '出差申请') return ['pdf'];
  return allowedExtensions;
};
const currentDocumentTypeHint = computed(() => {
  const extList = getAllowedExtensionsByType(currentDocumentType.value).map(ext => ext.toUpperCase()).join(' / ');
  return `当前可上传：${extList}`;
});
const expenseTypeOptions = ['车票费用', '酒店费用', '会议费用', '餐饮费用', '其他费用'];
const expenseTotalInDialog = computed(() =>
  editingExpenses.value.reduce((sum, item) => sum + Number(item.amount || 0), 0)
);

const filters = reactive({
  keyword: '',
  status: '',
  dateRange: null
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
  documents: []
});

const tableData = ref([]);
const editingDocuments = ref([]);
const editingDocumentContext = ref(null);
const currentPreviewDoc = ref(null);
const previewScale = ref(1);
const previewRotate = ref(0);
const editingExpenses = ref([]);
const editingExpenseContext = ref(null);

const previewStyle = computed(() => ({
  transform: `scale(${previewScale.value}) rotate(${previewRotate.value}deg)`
}));

const filteredData = computed(() => {
  return tableData.value.filter((row) => {
    const keyword = (filters.keyword || '').trim();
    if (keyword) {
      const target = `${row.reason || ''} ${getMainDestination(row)}`.toLowerCase();
      if (!target.includes(keyword.toLowerCase())) return false;
    }
    if (filters.status && row.status !== filters.status) return false;
    if (filters.dateRange && filters.dateRange.length === 2) {
      const startDate = dayjs(filters.dateRange[0]).startOf('day');
      const endDate = dayjs(filters.dateRange[1]).endOf('day');
      const rowDate = dayjs(row.date);
      if (!rowDate.isValid() || rowDate.isBefore(startDate) || rowDate.isAfter(endDate)) return false;
    }
    return true;
  });
});

const selectedRows = computed(() => {
  const idSet = new Set(selectedRowIds.value);
  return filteredData.value.filter(row => idSet.has(row.id));
});

const exportSourceRows = computed(() => selectedRows.value.length ? selectedRows.value : filteredData.value);

const showMessage = (type, message) => {
  ElMessage({ type, message, duration: 5000, showClose: true });
};

const normalizeDocuments = (itinerary) => {
  const docs = Array.isArray(itinerary?.documents) ? itinerary.documents : [];
  const normalized = docs
    .filter(item => item && item.path)
    .map(item => ({
      id: item.id || `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      name: item.name || item.path.split(/[/\\]/).pop(),
      path: item.path,
      size: Number(item.size || 0),
      uploadedAt: Number(item.uploadedAt || Date.now()),
      type: normalizeDocumentType(item.type)
    }));
  if (normalized.length) return normalized;
  const legacyMap = [
    { key: 'ticket', label: '交通工具发票' },
    { key: 'hotelInvoice', label: '酒店发票' },
    { key: 'hotelStatement', label: '酒店水单' },
    { key: 'travelRequest', label: '出差申请' }
  ];
  return legacyMap
    .map(({ key, label }) => {
      const file = itinerary?.[key];
      const filePath = file?.path || file?.raw?.path || file;
      if (!filePath || typeof filePath !== 'string') return null;
      return {
        id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
        name: file?.name || filePath.split(/[/\\]/).pop(),
        path: filePath,
        size: Number(file?.size || 0),
        uploadedAt: Number(file?.uploadedAt || Date.now()),
        type: normalizeDocumentType(label)
      };
    })
    .filter(Boolean);
};

const normalizeExpenses = (itinerary) => {
  const expenses = Array.isArray(itinerary?.expenses) ? itinerary.expenses : [];
  return expenses
    .map(item => ({
      id: item?.id || `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      type: item?.type || '其他费用',
      amount: Number(item?.amount || 0),
      note: item?.note || ''
    }))
    .filter(item => item.type);
};

const attachNormalizedDocuments = (travel) => ({
  ...travel,
  itineraries: (travel.itineraries || []).map(it => ({
    ...it,
    documents: normalizeDocuments(it),
    expenses: normalizeExpenses(it)
  }))
});

const loadTravels = async () => {
  loading.value = true;
  try {
    const data = await window.api.getTravels();
    tableData.value = data.map(attachNormalizedDocuments);
    const idSet = new Set(tableData.value.map(row => row.id));
    selectedRowIds.value = selectedRowIds.value.filter(id => idSet.has(id));
  } catch (error) {
    showMessage('error', '获取差旅列表失败');
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  try {
    const enabled = await window.api.getTravelPermissionControl();
    permissionControlEnabled.value = Boolean(enabled);
    if (permissionControlEnabled.value) {
      const storedRole = await window.api.getCurrentRole();
      const finalRole = storedRole || role.value;
      role.value = finalRole;
      localStorage.setItem('erp_user_role', finalRole);
      await window.api.setCurrentRole(finalRole);
    } else {
      role.value = 'admin';
      await window.api.setCurrentRole('admin');
    }
  } catch (error) {
    await window.api.setCurrentRole(role.value);
  }
  await loadTravels();
});

const getStatusType = (status) => {
  const map = {
    材料不齐: 'danger',
    待提交: 'info',
    待审核: 'warning',
    待打款: 'primary',
    已完成: 'success'
  };
  return map[status] || 'info';
};

const formatDate = (dateVal) => {
  if (Array.isArray(dateVal)) return dateVal.join(' 至 ');
  return dateVal || '-';
};

const formatTime = (timestamp) => dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss');

const formatSize = (size) => {
  const value = Number(size || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
};

const getMainDestination = (row) => {
  const itineraries = row.itineraries || [];
  if (!itineraries.length) return '-';
  return [...new Set(itineraries.map(i => i.to).filter(Boolean))].join(', ') || '-';
};

const getTravelDates = (row) => {
  const dates = (row.itineraries || [])
    .flatMap(i => Array.isArray(i.date) ? i.date : [i.date])
    .filter(Boolean)
    .sort();
  if (!dates.length) return '-';
  return dates.length === 1 ? dates[0] : `${dates[0]} 至 ${dates[dates.length - 1]}`;
};

const getDocuments = (itinerary) => normalizeDocuments(itinerary);
const getExpenses = (itinerary) => normalizeExpenses(itinerary);
const getExpenseTotal = (itinerary) =>
  getExpenses(itinerary).reduce((sum, item) => sum + Number(item.amount || 0), 0);

const isImageDoc = (doc) => ['jpg', 'jpeg', 'png', 'webp'].includes((doc.path.split('.').pop() || '').toLowerCase());

const toFileUrl = (filePath) => `file://${encodeURI(filePath)}`;

const isRowSelected = (id) => selectedRowIds.value.includes(id);

const toggleRowSelection = (id, checked) => {
  const idSet = new Set(selectedRowIds.value);
  if (checked) idSet.add(id);
  else idSet.delete(id);
  selectedRowIds.value = Array.from(idSet);
};

const resetForm = () => {
  currentTravel.id = null;
  currentTravel.date = dayjs().format('YYYY-MM-DD');
  currentTravel.reason = '';
  currentTravel.status = '待提交';
  currentTravel.total_amount = 0;
  currentTravel.itineraries = [];
  if (travelFormRef.value) travelFormRef.value.clearValidate();
};

const handleCreate = () => {
  if (!permissions.value.canUpload) {
    showMessage('warning', '当前角色无新建权限');
    return;
  }
  isEdit.value = false;
  resetForm();
  dialogVisible.value = true;
};

const handleEdit = (row) => {
  if (!permissions.value.canUpload) {
    showMessage('warning', '当前角色无编辑权限');
    return;
  }
  isEdit.value = true;
  currentTravel.id = row.id;
  currentTravel.date = row.date;
  currentTravel.reason = row.reason;
  currentTravel.status = row.status;
  currentTravel.total_amount = row.total_amount || 0;
  currentTravel.itineraries = JSON.parse(JSON.stringify((row.itineraries || []).map(it => ({
    ...it,
    documents: normalizeDocuments(it),
    expenses: normalizeExpenses(it)
  }))));
  dialogVisible.value = true;
};

const handleDelete = (row) => {
  if (!permissions.value.canDelete) {
    showMessage('warning', '当前角色无删除权限');
    return;
  }
  ElMessageBox.confirm('确定要删除这条差旅申请吗？', '警告', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  })
    .then(async () => {
      await window.api.deleteTravel(row.id);
      showMessage('success', '删除成功');
      await loadTravels();
    })
    .catch(() => {});
};

const addItinerary = () => {
  currentTravel.itineraries.push({
    date: [],
    from: '',
    to: '',
    transport: '',
    documents: [],
    expenses: []
  });
};

const removeItinerary = (index) => {
  currentTravel.itineraries.splice(index, 1);
};

const handleSave = async () => {
  if (!travelFormRef.value) return;
  await travelFormRef.value.validate(async (valid) => {
    if (!valid) return;
    loading.value = true;
    try {
      const travelData = JSON.parse(JSON.stringify(currentTravel));
      travelData.itineraries = travelData.itineraries.map(it => ({
        ...it,
        documents: normalizeDocuments(it),
        expenses: normalizeExpenses(it)
      }));
      if (isEdit.value) {
        await window.api.updateTravel(travelData);
        showMessage('success', '更新成功');
      } else {
        await window.api.addTravel({ ...travelData, date: travelData.date || dayjs().format('YYYY-MM-DD') });
        showMessage('success', '创建成功');
      }
      dialogVisible.value = false;
      await loadTravels();
    } catch (error) {
      showMessage('error', `保存失败: ${error.message || '未知错误'}`);
    } finally {
      loading.value = false;
    }
  });
};

const handleInlineAddItinerary = (row) => {
  if (!permissions.value.canUpload) {
    showMessage('warning', '当前角色无编辑权限');
    return;
  }
  isEditItinerary.value = false;
  editingItineraryIndex.value = -1;
  currentTravelRow.value = row;
  Object.assign(newItinerary, { date: [], from: '', to: '', transport: '', documents: [], expenses: [] });
  itineraryDialogVisible.value = true;
};

const handleEditItinerary = (row, itinerary, index) => {
  if (!permissions.value.canUpload) {
    showMessage('warning', '当前角色无编辑权限');
    return;
  }
  isEditItinerary.value = true;
  editingItineraryIndex.value = index;
  currentTravelRow.value = row;
  Object.assign(newItinerary, {
    date: Array.isArray(itinerary.date) ? itinerary.date : [],
    from: itinerary.from || '',
    to: itinerary.to || '',
    transport: itinerary.transport || '',
    documents: normalizeDocuments(itinerary),
    expenses: normalizeExpenses(itinerary)
  });
  itineraryDialogVisible.value = true;
};

const persistRowItineraries = async (row) => {
  if (!row?.id) return;
  await window.api.updateTravel({
    id: row.id,
    itineraries: JSON.parse(JSON.stringify((row.itineraries || []).map(it => ({
      ...it,
      documents: normalizeDocuments(it),
      expenses: normalizeExpenses(it)
    }))))
  });
};

const saveItinerary = async () => {
  if (!currentTravelRow.value) return;
  if (!currentTravelRow.value.itineraries) currentTravelRow.value.itineraries = [];
  const itineraryData = JSON.parse(JSON.stringify({
    ...newItinerary,
    documents: normalizeDocuments(newItinerary),
    expenses: normalizeExpenses(newItinerary)
  }));
  if (isEditItinerary.value && editingItineraryIndex.value !== -1) {
    currentTravelRow.value.itineraries[editingItineraryIndex.value] = itineraryData;
  } else {
    currentTravelRow.value.itineraries.push(itineraryData);
  }
  try {
    await persistRowItineraries(currentTravelRow.value);
    showMessage('success', '行程保存成功');
    itineraryDialogVisible.value = false;
    await loadTravels();
  } catch (error) {
    showMessage('error', '行程保存失败');
  }
};

const openDocumentManager = (travelRow, itineraryIndex) => {
  if (!travelRow?.itineraries?.[itineraryIndex]) return;
  editingDocumentContext.value = { travelRow, itineraryIndex };
  editingDocuments.value = JSON.parse(JSON.stringify(getDocuments(travelRow.itineraries[itineraryIndex])));
  currentDocumentType.value = defaultDocumentType;
  docDialogVisible.value = true;
};

const openDocumentPreviewList = (travelRow, itineraryIndex) => {
  openDocumentManager(travelRow, itineraryIndex);
};

const openExpenseManager = (travelRow, itineraryIndex) => {
  if (!travelRow?.itineraries?.[itineraryIndex]) return;
  editingExpenseContext.value = { travelRow, itineraryIndex };
  editingExpenses.value = JSON.parse(JSON.stringify(getExpenses(travelRow.itineraries[itineraryIndex])));
  if (!editingExpenses.value.length) {
    editingExpenses.value = [{ id: `${Date.now()}_${Math.random().toString(16).slice(2)}`, type: '车票费用', amount: 0, note: '' }];
  }
  expenseDialogVisible.value = true;
};

const addExpenseItem = () => {
  editingExpenses.value.push({
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type: '其他费用',
    amount: 0,
    note: ''
  });
};

const removeExpenseItem = (index) => {
  editingExpenses.value.splice(index, 1);
};

const saveExpenses = async () => {
  const context = editingExpenseContext.value;
  if (!context) return;
  const itinerary = context.travelRow?.itineraries?.[context.itineraryIndex];
  if (!itinerary) return;
  itinerary.expenses = JSON.parse(JSON.stringify(normalizeExpenses({ expenses: editingExpenses.value })));
  try {
    if (context.travelRow?.id) {
      await persistRowItineraries(context.travelRow);
      await loadTravels();
    }
    showMessage('success', '消费条例保存成功');
    expenseDialogVisible.value = false;
  } catch (error) {
    showMessage('error', '消费条例保存失败');
  }
};

const validatePathByRule = async (filePath, docType) => {
  const ext = (filePath.split('.').pop() || '').toLowerCase();
  const allowedByType = getAllowedExtensionsByType(docType);
  if (!allowedByType.includes(ext)) {
    if (normalizeDocumentType(docType) === '出差申请') {
      return { valid: false, message: '出差申请仅支持 PDF 文件' };
    }
    return { valid: false, message: `不支持文件类型: ${ext || '未知'}` };
  }
  const meta = await window.api.getFileMeta(filePath);
  if (!meta) return { valid: false, message: `无法读取文件: ${filePath}` };
  if (meta.size > maxFileSize) {
    return { valid: false, message: `${meta.name} 超过 10MB` };
  }
  return { valid: true, meta };
};

const addDocumentsByPaths = async (paths) => {
  if (!paths?.length) return;
  const docType = normalizeDocumentType(currentDocumentType.value);
  const success = [];
  const warnings = [];
  for (const filePath of paths) {
    const result = await validatePathByRule(filePath, docType);
    if (!result.valid) {
      warnings.push(result.message);
      continue;
    }
    const { meta } = result;
    success.push({
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      name: meta.name,
      path: filePath,
      size: meta.size,
      uploadedAt: Date.now(),
      type: docType
    });
  }
  if (success.length) {
    editingDocuments.value = [...editingDocuments.value, ...success];
    showMessage('success', `已添加 ${success.length} 个单据`);
  }
  warnings.slice(0, 3).forEach(msg => showMessage('warning', msg));
};

const selectDocumentFiles = async () => {
  if (!permissions.value.canUpload) {
    showMessage('warning', '当前角色无上传权限');
    return;
  }
  const extList = getAllowedExtensionsByType(currentDocumentType.value);
  const paths = await window.api.selectFile([{ name: 'Allowed Files', extensions: extList }]);
  if (paths && paths.length) await addDocumentsByPaths(paths);
};

const handleDropDocuments = async (event) => {
  docDragOver.value = false;
  if (!permissions.value.canUpload) return;
  const files = Array.from(event.dataTransfer?.files || []);
  const paths = files.map(file => file.path).filter(Boolean);
  await addDocumentsByPaths(paths);
};

const removeDocument = (docId) => {
  if (!permissions.value.canDelete) {
    showMessage('warning', '当前角色无删除权限');
    return;
  }
  editingDocuments.value = editingDocuments.value.filter(doc => doc.id !== docId);
};

const saveDocuments = async () => {
  const context = editingDocumentContext.value;
  if (!context) return;
  const itinerary = context.travelRow?.itineraries?.[context.itineraryIndex];
  if (!itinerary) return;
  itinerary.documents = JSON.parse(JSON.stringify(editingDocuments.value));
  try {
    await persistRowItineraries(context.travelRow);
    showMessage('success', '单据保存成功');
    docDialogVisible.value = false;
    await loadTravels();
  } catch (error) {
    showMessage('error', '单据保存失败');
  }
};

const openPreview = (doc) => {
  if (!permissions.value.canView) {
    showMessage('warning', '当前角色无查看权限');
    return;
  }
  currentPreviewDoc.value = doc;
  previewScale.value = 1;
  previewRotate.value = 0;
  previewFullscreen.value = false;
  previewDialogVisible.value = true;
};

const zoomIn = () => {
  previewScale.value = Math.min(previewScale.value + 0.2, 3);
};

const zoomOut = () => {
  previewScale.value = Math.max(previewScale.value - 0.2, 0.4);
};

const rotatePreview = () => {
  previewRotate.value = (previewRotate.value + 90) % 360;
};

const resetTransform = () => {
  previewScale.value = 1;
  previewRotate.value = 0;
};

const toggleFullscreen = () => {
  previewFullscreen.value = !previewFullscreen.value;
};

const openCurrentFile = async () => {
  if (!currentPreviewDoc.value?.path) return;
  await window.api.openFile(currentPreviewDoc.value.path);
};

const buildExportRow = (row) => {
  const docsCount = (row.itineraries || []).reduce((sum, it) => sum + getDocuments(it).length, 0);
  const expenseItems = (row.itineraries || []).flatMap(it => getExpenses(it));
  const expenseCount = expenseItems.length;
  const expenseTotal = expenseItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return {
    id: row.id,
    date: row.date,
    name: row.reason,
    amount: Number(row.total_amount || 0).toFixed(2),
    category: '差旅',
    status: row.status,
    description: row.reason || '',
    destination: getMainDestination(row),
    travelDates: getTravelDates(row),
    documentCount: docsCount,
    expenseCount,
    expenseTotal: expenseTotal.toFixed(2)
  };
};

const handleExport = async (format) => {
  if (!permissions.value.canExport) {
    showMessage('warning', '当前角色无导出权限');
    return;
  }
  const rows = exportSourceRows.value.map(buildExportRow);
  if (!rows.length) {
    showMessage('warning', '暂无可导出的记录');
    return;
  }
  const loadingInstance = ElLoading.service({
    lock: true,
    text: '正在导出，请稍候...',
    background: 'rgba(0, 0, 0, 0.7)'
  });
  try {
    const result = await window.api.exportTravelReport({ rows, format });
    if (result.success) {
      showMessage('success', `导出成功，文件已保存至: ${result.filePath}`);
      await window.api.openFile(result.filePath);
    } else if (!result.cancelled) {
      showMessage('error', `导出失败: ${result.error || '未知错误'}`);
    }
  } catch (error) {
    showMessage('error', `导出出错: ${error.message}`);
  } finally {
    loadingInstance.close();
  }
};
</script>

<style scoped>
.list-container {
  padding: 20px;
}
.actions-bar {
  position: sticky;
  top: 0;
  z-index: 20;
  margin-bottom: 20px;
  padding: 12px;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #ebeef5;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
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
.inline-add-itinerary {
  margin-top: 10px;
}
.upload-area {
  width: 100%;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  text-align: center;
  padding: 16px 12px;
  background-color: #fafafa;
  transition: 0.2s ease;
}
.upload-area.is-dragover {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}
.upload-icon {
  font-size: 24px;
  margin-bottom: 8px;
  color: #8c939d;
}
.upload-text {
  margin-bottom: 10px;
  color: #606266;
}
.upload-type-row {
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}
.upload-type-hint {
  font-size: 12px;
  color: #909399;
}
.doc-grid {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}
.doc-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 10px;
  background: #fff;
}
.doc-thumb {
  height: 110px;
  border-radius: 6px;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
  cursor: pointer;
  overflow: hidden;
}
.doc-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.doc-pdf {
  color: #f56c6c;
  font-weight: 600;
}
.doc-name {
  font-size: 12px;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.doc-meta {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}
.doc-actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
}
.expense-toolbar {
  margin-bottom: 10px;
}
.expense-summary {
  margin-top: 12px;
  text-align: right;
  color: #303133;
  font-weight: 600;
}
.preview-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.preview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-bottom: 10px;
  color: #606266;
}
.preview-content {
  min-height: 60vh;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #0f172a;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: 16px;
}
.preview-content.fullscreen {
  position: fixed;
  inset: 0;
  z-index: 4000;
  border-radius: 0;
}
.preview-image {
  max-width: 100%;
  max-height: 75vh;
  transition: transform 0.2s ease;
}
.preview-frame {
  width: min(1200px, 96%);
  height: 75vh;
  border: none;
  background: #fff;
  transition: transform 0.2s ease;
}
@media (max-width: 768px) {
  .list-container {
    padding: 12px;
  }
  .actions-bar {
    padding: 10px;
    gap: 8px;
  }
  .filters,
  .actions-right {
    width: 100%;
  }
  .filters :deep(.el-input),
  .filters :deep(.el-select),
  .filters :deep(.el-date-editor),
  .actions-right :deep(.el-button),
  .actions-right :deep(.el-dropdown) {
    width: 100% !important;
  }
  .itinerary-list {
    padding: 10px;
  }
}
</style>
