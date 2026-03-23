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
    version: '1.4.0',
    date: '2026-03-23', // matching the environment date
    notes: [
      '新增：全新的报销单管理界面，以报销单为视图集中管理相关条例。',
      '新增：在报销列表中支持复选多条记录并一键导入生成新的报销单，系统自动计算总金额。',
      '新增：支持报销单内一键修改所有包含条例的报销状态（如待提交、待审核、已完成等）。',
      '新增：支持报销单内添加和删除单独的报销条例。',
      '优化：完善差旅报销模块（自动流转状态、去除多余字段、优化IPC数据传输）。'
    ]
  },
  {
    version: '1.3.3',
    date: '2025-06-15',
    notes: [
      '新增：基础差旅报销模块。',
      '优化：UI 界面交互调整，提高用户体验。',
      '修复：一些已知的Bug。'
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
