<template>
  <div class="claim-container">
    <div class="actions-bar">
      <h2>报销单管理</h2>
      <el-button type="primary" icon="Refresh" @click="fetchData">刷新</el-button>
    </div>

    <el-table 
      :data="tableData" 
      style="width: 100%" 
      v-loading="loading"
    >
      <el-table-column type="expand">
        <template #default="props">
          <div class="expand-content">
            <div class="expand-header">
              <h4>包含的报销条例 (共 {{ props.row.items.length }} 项)</h4>
              <el-dropdown @command="(command) => handleBatchStatusChange(props.row, command)" style="margin-left: 20px;">
                <el-button type="primary" size="small">
                  一键修改状态<el-icon class="el-icon--right"><arrow-down /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="材料不齐">材料不齐</el-dropdown-item>
                    <el-dropdown-item command="待提交">待提交</el-dropdown-item>
                    <el-dropdown-item command="待审核">待审核</el-dropdown-item>
                    <el-dropdown-item command="待打款">待打款</el-dropdown-item>
                    <el-dropdown-item command="已完成">已完成</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-button 
                size="small" 
                type="primary" 
                icon="Plus" 
                style="margin-left: auto;"
                @click="openAddItemDialog(props.row)"
              >添加条例</el-button>
            </div>
            
            <el-table :data="props.row.items" style="width: 100%" border>
              <el-table-column prop="date" label="日期" width="120" />
              <el-table-column prop="name" label="报销名称" width="150" />
              <el-table-column prop="category" label="类别" width="100" />
              <el-table-column prop="amount" label="金额" width="120">
                <template #default="scope">
                  ¥ {{ scope.row.amount.toFixed(2) }}
                </template>
              </el-table-column>
              <el-table-column prop="status" label="状态" width="100">
                <template #default="scope">
                  <el-tag :type="getStatusType(scope.row.status)" size="small">
                    {{ scope.row.status }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="description" label="备注" />
              <el-table-column label="操作" width="100">
                <template #default="scope">
                  <el-button 
                    size="small" 
                    type="danger" 
                    icon="Delete"
                    @click="handleRemoveItem(props.row.id, scope.row)"
                  >移出</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="claim_no" label="报销单号" width="200" sortable />
      <el-table-column prop="approval_date" label="审核日期" width="150" sortable />
      <el-table-column prop="total_amount" label="总金额" width="150" sortable>
        <template #default="scope">
          <span class="total-amount">¥ {{ scope.row.total_amount.toFixed(2) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="包含条目数" width="120">
        <template #default="scope">
          {{ scope.row.items.length }} 条
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="180">
        <template #default="scope">
          {{ formatTime(scope.row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <template #default="scope">
          <el-button 
            size="small" 
            type="danger" 
            icon="Delete"
            @click="handleDelete(scope.row)"
          >删除报销单</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="addItemDialogVisible" title="添加报销条例" width="800px">
      <el-table 
        :data="unassignedItems" 
        style="width: 100%" 
        max-height="400px"
        @selection-change="handleUnassignedSelectionChange"
        v-loading="unassignedLoading"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="date" label="日期" width="120" sortable />
        <el-table-column prop="name" label="报销名称" width="150" />
        <el-table-column prop="category" label="类别" width="100" />
        <el-table-column prop="amount" label="金额" width="120">
          <template #default="scope">
            ¥ {{ scope.row.amount.toFixed(2) }}
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)" size="small">
              {{ scope.row.status }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="addItemDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitAddItems" :disabled="selectedUnassigned.length === 0">
            添加选中项 ({{ selectedUnassigned.length }})
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ArrowDown } from '@element-plus/icons-vue';
import dayjs from 'dayjs';

const tableData = ref([]);
const loading = ref(false);
const batchStatus = ref('');

const addItemDialogVisible = ref(false);
const unassignedLoading = ref(false);
const unassignedItems = ref([]);
const selectedUnassigned = ref([]);
const currentAddingClaim = ref(null);

const formatTime = (timestamp) => {
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss');
};

const getStatusType = (status) => {
  switch (status) {
    case '材料不齐': return 'danger';
    case '待提交': return 'info';
    case '待审核': return 'warning';
    case '待打款': return 'primary';
    case '已完成': return 'success';
    default: return '';
  }
};

const fetchData = async () => {
  loading.value = true;
  try {
    const data = await window.api.getClaims();
    tableData.value = data;
  } catch (error) {
    ElMessage.error('获取报销单数据失败: ' + error.message);
  } finally {
    loading.value = false;
  }
};

const openAddItemDialog = async (claim) => {
  currentAddingClaim.value = claim;
  unassignedLoading.value = true;
  addItemDialogVisible.value = true;
  try {
    const allReimbursements = await window.api.getReimbursements();
    // Filter out reimbursements that are already in a claim
    // Wait, getReimbursements doesn't explicitly expose claim_id in the view, but we can assume it returns claim_id.
    // Let's filter by !item.claim_id
    unassignedItems.value = allReimbursements.filter(item => !item.claim_id);
  } catch (error) {
    ElMessage.error('获取未分配报销条例失败: ' + error.message);
  } finally {
    unassignedLoading.value = false;
  }
};

const handleUnassignedSelectionChange = (val) => {
  selectedUnassigned.value = val;
};

const submitAddItems = async () => {
  if (!currentAddingClaim.value || selectedUnassigned.value.length === 0) return;
  
  try {
    const itemIds = selectedUnassigned.value.map(item => item.id);
    const result = await window.api.addClaim({
      data: {
        id: currentAddingClaim.value.id,
        claim_no: currentAddingClaim.value.claim_no,
        approval_date: currentAddingClaim.value.approval_date
      },
      item_ids: itemIds
    });
    
    if (result.success) {
      ElMessage.success('添加条例成功');
      addItemDialogVisible.value = false;
      fetchData();
    } else {
      ElMessage.error('添加失败: ' + result.error);
    }
  } catch (error) {
    ElMessage.error('操作异常');
  }
};

const handleBatchStatusChange = async (row, newStatus) => {
  if (!newStatus) return;
  try {
    await ElMessageBox.confirm(`确定要将单内所有 ${row.items.length} 个条例状态一键修改为「${newStatus}」吗？`, '提示', {
      type: 'warning',
      confirmButtonText: '确定',
      cancelButtonText: '取消'
    });
    
    const result = await window.api.updateClaimItemsStatus({ claim_id: row.id, status: newStatus });
    if (result.success) {
      ElMessage.success('批量修改状态成功');
      batchStatus.value = ''; // reset
      fetchData();
    } else {
      ElMessage.error('修改失败: ' + result.error);
    }
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('操作异常');
    }
    batchStatus.value = '';
  }
};

const handleRemoveItem = async (claimId, item) => {
  try {
    await ElMessageBox.confirm(`确定将条例「${item.name}」移出该报销单吗？`, '提示', {
      type: 'warning'
    });
    
    const result = await window.api.removeClaimItem({ claim_id: claimId, item_id: item.id });
    if (result.success) {
      ElMessage.success('移出成功');
      fetchData();
    } else {
      ElMessage.error('移出失败: ' + result.error);
    }
  } catch (e) {
    // cancelled
  }
};

const handleDelete = async (row) => {
  try {
    await ElMessageBox.confirm('确定删除该报销单吗？这不会删除里面的报销条例，只会解除关联。', '警告', {
      type: 'warning',
      confirmButtonText: '确定删除',
      cancelButtonText: '取消'
    });
    
    const result = await window.api.deleteClaim(row.id);
    if (result.success) {
      ElMessage.success('删除报销单成功');
      fetchData();
    } else {
      ElMessage.error('删除失败: ' + result.error);
    }
  } catch (e) {
    // cancelled
  }
};

onMounted(() => {
  fetchData();
});
</script>

<style scoped>
.claim-container {
  padding: 20px;
}
.actions-bar {
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.actions-bar h2 {
  margin: 0;
  font-size: 20px;
  color: #303133;
}
.expand-content {
  padding: 20px 40px;
  background-color: #fafafa;
  border-radius: 4px;
}
.expand-header {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}
.expand-header h4 {
  margin: 0;
  color: #606266;
}
.total-amount {
  font-weight: bold;
  color: #f56c6c;
}
</style>
