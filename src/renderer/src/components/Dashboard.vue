<template>
  <div class="dashboard-container">
    <div class="header">
      <h2>数据看板</h2>
      <div class="actions">
        <el-button type="primary" @click="fetchStats">刷新数据</el-button>
      </div>
    </div>

    <div class="widgets" tabindex="0">
      <div :style="widgetStyle('totalAmount')" :class="widgetClass" ref="el_totalAmount">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>总报销金额</span>
            </div>
          </template>
          <div class="card-value">¥ {{ stats.totalAmount.toFixed(2) }}</div>
        </el-card>
      </div>

      <div :style="widgetStyle('totalCount')" :class="widgetClass" ref="el_totalCount">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>总报销单数</span>
            </div>
          </template>
          <div class="card-value">{{ stats.totalCount }} 单</div>
        </el-card>
      </div>

      <div :style="widgetStyle('unfinishedTotal')" :class="widgetClass" ref="el_unfinishedTotal">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>未完成总金额</span>
            </div>
          </template>
          <div class="card-value danger">¥ {{ (stats.unfinishedTotalAmount || 0).toFixed(2) }}</div>
        </el-card>
      </div>

      <div :style="widgetStyle('travelTotal')" :class="widgetClass" ref="el_travelTotal">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>差旅报销总额</span>
            </div>
          </template>
          <div class="card-value primary">¥ {{ (stats.travelStats?.totalAmount || 0).toFixed(2) }}</div>
          <div class="card-sub-value">共 {{ stats.travelStats?.totalCount || 0 }} 单</div>
        </el-card>
      </div>

      <div :style="widgetStyle('monthlyChart')" :class="widgetClass" ref="el_monthlyChart">
        <el-card class="box-card" header="月度报销趋势">
          <div ref="monthlyChartRef" class="pie-container"></div>
        </el-card>
      </div>

      <div :style="widgetStyle('categoryStats')" :class="widgetClass" ref="el_categoryStats">
        <el-card class="box-card" header="按类别统计">
          <el-table :data="stats.categoryStats" style="width: 100%" stripe>
            <el-table-column prop="category" label="类别" />
            <el-table-column prop="count" label="数量" width="80" />
            <el-table-column prop="totalAmount" label="金额">
              <template #default="scope">
                ¥ {{ scope.row.totalAmount.toFixed(2) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>
      
      <div :style="widgetStyle('statusStats')" :class="widgetClass" ref="el_statusStats">
        <el-card class="box-card" header="按状态统计">
          <el-table :data="stats.statusStats" style="width: 100%" stripe>
            <el-table-column prop="status" label="状态" />
            <el-table-column prop="count" label="数量" width="80" />
            <el-table-column prop="totalAmount" label="金额">
              <template #default="scope">
                ¥ {{ scope.row.totalAmount.toFixed(2) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>

      <div :style="widgetStyle('categoryPie')" :class="widgetClass" ref="el_categoryPie">
        <el-card class="box-card" header="全类别金额占比">
          <div ref="categoryPieRef" class="pie-container"></div>
        </el-card>
      </div>

      <div :style="widgetStyle('statusPie')" :class="widgetClass" ref="el_statusPie">
        <el-card class="box-card" header="全状态数量占比">
          <div ref="statusPieRef" class="pie-container"></div>
        </el-card>
      </div>

      <div :style="widgetStyle('unfinishedPie')" :class="widgetClass" ref="el_unfinishedPie">
        <el-card class="box-card" header="未完成按类别占比">
          <div ref="pieRef" class="pie-container"></div>
        </el-card>
      </div>

      <div :style="widgetStyle('recentItems')" :class="widgetClass" ref="el_recentItems">
        <el-card class="box-card recent-card" header="最近新增">
          <el-table :data="stats.recentItems" style="width: 100%" stripe>
            <el-table-column prop="date" label="日期" width="120" />
            <el-table-column prop="name" label="名称" />
            <el-table-column prop="amount" label="金额" width="120">
              <template #default="scope">
                ¥ {{ scope.row.amount.toFixed(2) }}
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="120">
              <template #default="scope">
                <el-tag :type="getStatusType(scope.row.status)">{{ scope.row.status }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onBeforeUnmount } from 'vue';
import { ElMessage } from 'element-plus';
import * as echarts from 'echarts';

const stats = ref({
  totalAmount: 0,
  totalCount: 0,
  categoryStats: [],
  statusStats: [],
  recentItems: [],
  unfinishedTotalAmount: 0,
  unfinishedByCategory: [],
  monthlyStats: [],
  travelStats: { totalAmount: 0, totalCount: 0 }
});

const pieRef = ref(null);
const monthlyChartRef = ref(null);
const categoryPieRef = ref(null);
const statusPieRef = ref(null);

let pieChart = null;
let monthlyChart = null;
let categoryPieChart = null;
let statusPieChart = null;

const widgetClass = 'widget';
const defaultLayout = {
  totalAmount: { x: 0, y: 0, w: 280, h: 120 },
  totalCount: { x: 300, y: 0, w: 280, h: 120 },
  unfinishedTotal: { x: 600, y: 0, w: 280, h: 120 },
  travelTotal: { x: 900, y: 0, w: 280, h: 120 },
  
  monthlyChart: { x: 0, y: 140, w: 1180, h: 300 },
  
  categoryStats: { x: 0, y: 460, w: 580, h: 320 },
  statusStats: { x: 600, y: 460, w: 580, h: 320 },
  
  categoryPie: { x: 0, y: 800, w: 380, h: 300 },
  statusPie: { x: 400, y: 800, w: 380, h: 300 },
  unfinishedPie: { x: 800, y: 800, w: 380, h: 300 },
  
  recentItems: { x: 0, y: 1120, w: 1180, h: 300 }
};

function widgetStyle(id) {
  const it = defaultLayout[id];
  if (!it) return {};
  return {
    left: it.x + 'px',
    top: it.y + 'px',
    width: it.w + 'px',
    height: it.h + 'px'
  };
}

const fetchStats = async () => {
  try {
    const data = await window.api.getDashboardStats();
    stats.value = data;
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);
    ElMessage.error('获取统计数据失败');
  }
};

const getStatusType = (status) => {
  const map = {
    '待提交': 'info',
    '待审核': 'warning',
    '待打款': 'primary',
    '已完成': 'success',
    '材料不齐': 'danger'
  };
  return map[status] || 'info';
};

const renderCharts = () => {
  // 1. Unfinished Pie
  if (pieRef.value) {
    if (!pieChart) pieChart = echarts.init(pieRef.value);
    const seriesData = (stats.value.unfinishedByCategory || []).map(it => ({
      name: it.category || '未分类',
      value: it.totalAmount || 0
    }));
    pieChart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
      legend: { top: 'bottom', type: 'scroll' },
      series: [{
        type: 'pie',
        radius: ['30%', '60%'],
        center: ['50%', '45%'],
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
        data: seriesData,
        label: { show: false }
      }]
    });
  }

  // 2. Monthly Trend (Line/Bar)
  if (monthlyChartRef.value) {
    if (!monthlyChart) monthlyChart = echarts.init(monthlyChartRef.value);
    const months = (stats.value.monthlyStats || []).map(m => m.month);
    const amounts = (stats.value.monthlyStats || []).map(m => m.totalAmount);
    const counts = (stats.value.monthlyStats || []).map(m => m.count);
    
    monthlyChart.setOption({
      tooltip: { trigger: 'axis' },
      legend: { data: ['总金额', '单据数'], bottom: 0 },
      grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
      xAxis: { type: 'category', data: months },
      yAxis: [
        { type: 'value', name: '金额', axisLabel: { formatter: '¥{value}' } },
        { type: 'value', name: '数量', position: 'right' }
      ],
      series: [
        { name: '总金额', type: 'bar', data: amounts, barMaxWidth: 40, itemStyle: { color: '#409EFF' } },
        { name: '单据数', type: 'line', yAxisIndex: 1, data: counts, itemStyle: { color: '#67C23A' } }
      ]
    });
  }

  // 3. Category Pie (Total)
  if (categoryPieRef.value) {
    if (!categoryPieChart) categoryPieChart = echarts.init(categoryPieRef.value);
    const catData = (stats.value.categoryStats || []).map(it => ({
      name: it.category,
      value: it.totalAmount
    }));
    categoryPieChart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: ¥{c} ({d}%)' },
      legend: { top: 'bottom', type: 'scroll' },
      series: [{
        type: 'pie',
        radius: '60%',
        center: ['50%', '45%'],
        data: catData,
        label: { show: false }
      }]
    });
  }

  // 4. Status Pie
  if (statusPieRef.value) {
    if (!statusPieChart) statusPieChart = echarts.init(statusPieRef.value);
    const statusData = (stats.value.statusStats || []).map(it => ({
      name: it.status,
      value: it.count
    }));
    statusPieChart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c}单 ({d}%)' },
      legend: { top: 'bottom', type: 'scroll' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '45%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
        data: statusData
      }]
    });
  }
};

onMounted(() => {
  fetchStats();
  // resize handling
  const resize = () => {
    pieChart && pieChart.resize();
    monthlyChart && monthlyChart.resize();
    categoryPieChart && categoryPieChart.resize();
    statusPieChart && statusPieChart.resize();
  };
  window.addEventListener('resize', resize);
  onBeforeUnmount(() => {
    window.removeEventListener('resize', resize);
    pieChart && pieChart.dispose();
    monthlyChart && monthlyChart.dispose();
    categoryPieChart && categoryPieChart.dispose();
    statusPieChart && statusPieChart.dispose();
    pieChart = null;
    monthlyChart = null;
    categoryPieChart = null;
    statusPieChart = null;
  });
});

watch(() => stats.value, () => {
  renderCharts();
}, { deep: true });
</script>

<style scoped>
.dashboard-container {
  padding: 20px;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.summary-cards {
  margin-bottom: 20px;
}
.card-header {
  font-weight: bold;
}
.card-value {
  font-size: 24px;
  font-weight: bold;
  color: #409EFF;
  text-align: center;
  padding: 10px 0;
}
.card-value.danger {
  color: #F56C6C;
}
.card-value.primary {
  color: #409EFF;
}
.card-sub-value {
  font-size: 14px;
  color: #909399;
  text-align: center;
}
.stats-row {
  margin-bottom: 20px;
}
.recent-card {
  margin-top: 20px;
}
.widget .el-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.widget :deep(.el-card__body) {
  flex: 1;
  overflow: hidden;
  padding: 10px;
}
.pie-container {
  width: 100%;
  height: 100%;
}
.widgets {
  position: relative;
  min-height: 900px;
}
.widget {
  position: absolute;
  box-sizing: border-box;
}
</style>
