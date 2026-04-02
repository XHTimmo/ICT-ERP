<template>
  <div class="release-container">
    <h2>更新日志</h2>
    <el-timeline>
      <el-timeline-item 
        v-for="(release, index) in releases" 
        :key="index" 
        :timestamp="release.date" 
        :type="index === 0 ? 'primary' : 'info'"
        :hollow="index !== 0"
        placement="top"
      >
        <el-card>
          <h3>版本 {{ release.version }}</h3>
          <ul class="release-notes">
            <li v-for="(note, nIndex) in release.notes" :key="nIndex">
              {{ note }}
            </li>
          </ul>
        </el-card>
      </el-timeline-item>
    </el-timeline>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const releases = ref([
  {
    version: '1.3.4',
    date: '2026-03-26',
    notes: [
      '修复：新增报销时缺少报销单号字段导致的提交报错，增加参数默认值防御。',
      '优化：修复批量导出链路，恢复 ZIP 导出能力并补齐清单字段。',
      '优化：导出清单 CSV 增加 UTF-8 BOM，提升 Excel 打开兼容性。',
      '文档：同步更新技术文档与发布说明。'
    ]
  },
  {
    version: '1.3.3',
    date: '2026-03-18',
    notes: [
      '新增：报销模块新增“报销单号”字段。',
      '新增：支持在列表页按报销单号排序。',
      '文档：更新技术文档至 v1.3.3。'
    ]
  },
  {
    version: '1.3.2',
    date: '2026-03-12',
    notes: [
      '重构：统一差旅报销状态与普通报销状态（中文状态名）。',
      '新增：看板统计纳入差旅报销数据，实现全量统计。',
      '修复：差旅状态映射异常问题。',
      '优化：移除差旅报销“申请人”字段。'
    ]
  },
  {
    version: '1.3.1',
    date: '2026-03-11',
    notes: [
      '新增：看板月度趋势图、类别占比图、状态占比图。',
      '优化：报销列表排序逻辑（状态 > 类别 > 时间）。',
      '修复：新建报销单偶发变量未定义报错。'
    ]
  },
  {
    version: '1.3.0',
    date: '2026-03-11',
    notes: [
      '新增：报销单复制功能，支持快速克隆单据（不含凭证）。',
      '文档：更新技术文档至 v1.3.0。'
    ]
  },
  {
    version: '1.2.0',
    date: '2026-03-06',
    notes: [
      '新增：GitHub Actions 自动化构建发布流程（macOS/Windows）。',
      '新增：软件内自动检查更新与下载安装。',
      '优化：报销类别支持自定义管理。'
    ]
  }
]);
</script>

<style scoped>
.release-container {
  padding: 20px 40px;
  max-width: 800px;
  margin: 0 auto;
}

h2 {
  margin-bottom: 30px;
  color: #303133;
}

h3 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #409EFF;
}

.release-notes {
  list-style-type: disc;
  padding-left: 20px;
  margin: 0;
}

.release-notes li {
  line-height: 1.8;
  color: #606266;
}
</style>
