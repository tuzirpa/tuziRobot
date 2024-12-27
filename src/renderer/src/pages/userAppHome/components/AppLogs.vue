<script setup lang="ts">
import type { Block, LogLevel, LogMessage } from 'src/main/userApp/types';
import { onMounted, onUnmounted, ref } from 'vue'

//设置属性默认值

const props = withDefaults(defineProps<{
    appId: string,
    rows?: number
}>(), {
    rows: 3
});

const runLogs = ref<any[]>([]);

type LogMessageApp = LogMessage & {
    appId: string,
    timeString: string
}
const levelMap = {
    debug: '调试',
    info: '信息',
    warn: '警告',
    error: '错误',
    fatalError: '致命'
};
function log2Content(logMessage: LogMessageApp) {
    const levelStr = levelMap[logMessage.level];
    const flowAliasName = logMessage.data?.flowAliasName ?? '';
    const blockLine = logMessage.data?.blockLine ?? '';
    const message = logMessage.message;
    const content =
        // @ts-ignore
        `[${levelStr}] [${flowAliasName}:(行: ${blockLine})] [${logMessage.timeString}]:` +
        message;
    return content;
}
const acceptLogs = (_event, log: LogMessageApp | LogMessageApp[]) => {
    console.log(log, 'run-logs -- 日志窗口');

    if (Array.isArray(log)) {
        log.forEach((item) => {
            item.timeString = new Date(item.time).toLocaleString();
        });
        //倒序
        log.reverse();
        runLogs.value.unshift(...log);
    } else {
        if (log.appId !== props.appId) return;
        log.timeString = new Date(log.time).toLocaleString();
        runLogs.value.unshift(log);
    }
    content.value = runLogs.value.map(log2Content).join('\n');
}

// 监听数据变化
onMounted(() => {
    window.electron.ipcRenderer.on('run-logs-' + props.appId, acceptLogs);
})
onUnmounted(() => {
    window.electron.ipcRenderer.removeAllListeners('run-logs-' + props.appId);
})


// 添加逻辑
const content = ref('')

</script>

<template>
    <div class="app-logs">
        <ElInput type="textarea" v-model="content" :rows="rows"></ElInput>
    </div>
</template>

<style lang="less" scoped>
// 添加样式
.app-logs {
    widows: 100%;
    height: 100%;
}
</style>
