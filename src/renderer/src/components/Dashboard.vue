<template>
  <div class="dashboard-container">
    <div class="header">
      <h2>数据看板</h2>
      <div class="actions">
        <el-switch v-model="editMode" active-text="布局编辑" inactive-text="浏览模式" />
        <el-button type="primary" @click="fetchStats">刷新数据</el-button>
        <el-button v-if="editMode" @click="resetLayout">重置布局</el-button>
      </div>
    </div>

    <div class="widgets" :class="{ editing: editMode }" @keydown="onKey" tabindex="0">
      <div :style="widgetStyle('totalAmount')" :class="[widgetClass, activeId==='totalAmount' && editMode ? 'active' : '']" ref="el_totalAmount" data-id="totalAmount" @click="setActive('totalAmount')">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>总报销金额</span>
            </div>
          </template>
          <div class="card-value">¥ {{ stats.totalAmount.toFixed(2) }}</div>
        </el-card>
        <div v-if="editMode" class="badge">{{ cellSize('totalAmount') }}</div>
      </div>

      <div :style="widgetStyle('totalCount')" :class="[widgetClass, activeId==='totalCount' && editMode ? 'active' : '']" ref="el_totalCount" data-id="totalCount" @click="setActive('totalCount')">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>总报销单数</span>
            </div>
          </template>
          <div class="card-value">{{ stats.totalCount }} 单</div>
        </el-card>
        <div v-if="editMode" class="badge">{{ cellSize('totalCount') }}</div>
      </div>

      <div :style="widgetStyle('unfinishedTotal')" :class="[widgetClass, activeId==='unfinishedTotal' && editMode ? 'active' : '']" ref="el_unfinishedTotal" data-id="unfinishedTotal" @click="setActive('unfinishedTotal')">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>未完成总金额</span>
            </div>
          </template>
          <div class="card-value danger">¥ {{ (stats.unfinishedTotalAmount || 0).toFixed(2) }}</div>
        </el-card>
        <div v-if="editMode" class="badge">{{ cellSize('unfinishedTotal') }}</div>
      </div>

      <div :style="widgetStyle('categoryStats')" :class="[widgetClass, activeId==='categoryStats' && editMode ? 'active' : '']" ref="el_categoryStats" data-id="categoryStats" @click="setActive('categoryStats')">
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
        <div v-if="editMode" class="badge">{{ cellSize('categoryStats') }}</div>
      </div>
      
      <div :style="widgetStyle('statusStats')" :class="[widgetClass, activeId==='statusStats' && editMode ? 'active' : '']" ref="el_statusStats" data-id="statusStats" @click="setActive('statusStats')">
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
        <div v-if="editMode" class="badge">{{ cellSize('statusStats') }}</div>
      </div>

      <div :style="widgetStyle('unfinishedPie')" :class="[widgetClass, activeId==='unfinishedPie' && editMode ? 'active' : '']" ref="el_unfinishedPie" data-id="unfinishedPie" @click="setActive('unfinishedPie')">
        <el-card class="box-card" header="未完成按类别占比">
          <div ref="pieRef" class="pie-container"></div>
        </el-card>
        <div v-if="editMode" class="badge">{{ cellSize('unfinishedPie') }}</div>
      </div>

      <div :style="widgetStyle('recentItems')" :class="[widgetClass, activeId==='recentItems' && editMode ? 'active' : '']" ref="el_recentItems" data-id="recentItems" @click="setActive('recentItems')">
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
        <div v-if="editMode" class="badge">{{ cellSize('recentItems') }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch, onBeforeUnmount } from 'vue';
import { ElMessage } from 'element-plus';
import * as echarts from 'echarts';
import interact from 'interactjs';

const stats = ref({
  totalAmount: 0,
  totalCount: 0,
  categoryStats: [],
  statusStats: [],
  recentItems: [],
  unfinishedTotalAmount: 0,
  unfinishedByCategory: []
});

const pieRef = ref(null);
let pieChart = null;

const editMode = ref(false);
const widgetClass = 'widget';
const GRID = 20;
const defaultLayout = {
  totalAmount: { x: 0, y: 0, w: 380, h: 120 },
  totalCount: { x: 400, y: 0, w: 380, h: 120 },
  unfinishedTotal: { x: 800, y: 0, w: 380, h: 120 },
  categoryStats: { x: 0, y: 140, w: 580, h: 320 },
  statusStats: { x: 600, y: 140, w: 580, h: 320 },
  unfinishedPie: { x: 0, y: 480, w: 580, h: 340 },
  recentItems: { x: 600, y: 480, w: 580, h: 340 }
};
const layout = reactive(loadLayout());
const activeId = ref('');

function loadLayout() {
  try {
    const saved = localStorage.getItem('dashboardLayout');
    if (saved) return JSON.parse(saved);
  } catch {}
  return { ...defaultLayout };
}
function saveLayout() {
  localStorage.setItem('dashboardLayout', JSON.stringify(layout));
}
function resetLayout() {
  Object.assign(layout, { ...defaultLayout });
  saveLayout();
  nextTickResize();
}
function setActive(id) {
  activeId.value = id;
}
function widgetStyle(id) {
  const it = layout[id] || defaultLayout[id];
  if (!it) return {};
  return {
    left: it.x + 'px',
    top: it.y + 'px',
    width: it.w + 'px',
    height: it.h + 'px'
  };
}
function cellSize(id) {
  const it = layout[id] || defaultLayout[id];
  if (!it) return '';
  return Math.round(it.w / GRID) + '×' + Math.round(it.h / GRID);
}

function initInteract() {
  const selector = '.widgets.editing .widget';
  interact(selector)
    .draggable({
      inertia: false,
      modifiers: [
        interact.modifiers.snap({
          targets: [interact.snappers.grid({ x: GRID, y: GRID })],
          range: GRID / 2,
        })
      ],
      listeners: {
        move (event) {
          const target = event.target;
          const id = target.getAttribute('data-id');
          if (!id) return;
          const l = layout[id];
          l.x = Math.max(0, l.x + event.dx);
          l.y = Math.max(0, l.y + event.dy);
          // snap to grid
          l.x = Math.round(l.x / GRID) * GRID;
          l.y = Math.round(l.y / GRID) * GRID;
          target.style.left = l.x + 'px';
          target.style.top = l.y + 'px';
        },
        end () { saveLayout(); }
      }
    })
    .resizable({
      edges: { left: true, right: true, bottom: true, top: false },
      modifiers: [
        interact.modifiers.snapSize({
          targets: [interact.snappers.grid({ x: GRID, y: GRID })]
        })
      ]
    })
    .on('resizemove', (event) => {
      const target = event.target;
      const id = target.getAttribute('data-id');
      if (!id) return;
      const l = layout[id];
      l.w = Math.max(GRID * 8, Math.round(event.rect.width / GRID) * GRID);
      l.h = Math.max(GRID * 6, Math.round(event.rect.height / GRID) * GRID);
      target.style.width = l.w + 'px';
      target.style.height = l.h + 'px';
      saveLayout();
      nextTickResize();
    });
}

function destroyInteract() {
  interact('.widgets.editing .widget').unset();
}

function nextTickResize() {
  setTimeout(() => {
    if (pieChart) pieChart.resize();
  }, 0);
}
function onKey(e) {
  if (!editMode.value || !activeId.value) return;
  const id = activeId.value;
  const l = layout[id];
  if (!l) return;
  if (e.key === 'ArrowLeft') l.x = Math.max(0, l.x - GRID);
  else if (e.key === 'ArrowRight') l.x = l.x + GRID;
  else if (e.key === 'ArrowUp') l.y = Math.max(0, l.y - GRID);
  else if (e.key === 'ArrowDown') l.y = l.y + GRID;
  else return;
  e.preventDefault();
  saveLayout();
  nextTickResize();
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

const renderPie = () => {
  if (!pieRef.value) return;
  if (!pieChart) {
    pieChart = echarts.init(pieRef.value);
  }
  const seriesData = (stats.value.unfinishedByCategory || []).map(it => ({
    name: it.category || '未分类',
    value: it.totalAmount || 0
  }));
  const option = {
    tooltip: { trigger: 'item' },
    legend: { top: 'bottom' },
    series: [
      {
        type: 'pie',
        radius: ['30%', '70%'],
        center: ['50%', '50%'],
        roseType: false,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        data: seriesData
      }
    ]
  };
  pieChart.setOption(option);
};

onMounted(() => {
  fetchStats();
  // resize handling
  const resize = () => pieChart && pieChart.resize();
  window.addEventListener('resize', resize);
  onBeforeUnmount(() => {
    window.removeEventListener('resize', resize);
    pieChart && pieChart.dispose();
    pieChart = null;
  });
  watch(editMode, (val) => {
    if (val) {
      initInteract();
    } else {
      destroyInteract();
      saveLayout();
    }
  }, { immediate: false });
});

watch(() => stats.value.unfinishedByCategory, () => {
  renderPie();
});
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
.stats-row {
  margin-bottom: 20px;
}
.recent-card {
  margin-top: 20px;
}
.pie-container {
  width: 100%;
  height: 320px;
}
.widgets {
  position: relative;
  min-height: 900px;
  /* grid background in editing mode */
}
.widget {
  position: absolute;
  box-sizing: border-box;
}
.widgets.editing .widget {
  outline: 1px dashed #bbb;
  cursor: move;
}
.widgets.editing {
  background-image:
    linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px);
  background-size: 20px 20px;
}
.widget.active {
  outline: 2px solid #409EFF;
}
.badge {
  position: absolute;
  right: 6px;
  top: 6px;
  background: rgba(0,0,0,0.5);
  color: #fff;
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 3px;
  pointer-events: none;
}
</style>
