<script setup lang="tsx">
import { computed, ref } from 'vue';
import type { AppVariable } from 'src/main/userApp/types';
import { ElInput, ElButton, ElDialog, ElForm, ElFormItem } from 'element-plus';
import type { MainUserApp } from './types';
import { QuestionFilled } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

// 添加逻辑

const props = defineProps<{
    userAppDetail: MainUserApp,
    globalVariableData: any[]
}>();

const emit = defineEmits<{
    (e: 'updateGlobalVariable', globalVariable: AppVariable[]): void
}>();

const globalVariableNameFilter = ref('');
const searchIcon = <i class="iconfont icon-sousuo"></i>;

const appGlobalVariables = computed(() => {
    let globalVariables: AppVariable[] = [];
    globalVariables = props.userAppDetail.globalVariables ?? [];
    globalVariables = globalVariables.filter(item => globalVariableNameFilter.value.length === 0
        || item.name.includes(globalVariableNameFilter.value)).map(item => {
            return {
                name: item.name,
                value: item.value,
                type: item.type,
                exposed: item.exposed,
                display: item.display
            };
        });
    return globalVariables;
})

let editIndex = -1;

function handleClick(row: AppVariable) {
    globalVariableForm.value = {
        name: row.name,
        value: row.type === 'boolean' ? String(row.value) : row.value,
        display: row.display ?? '',
        exposed: row.exposed ?? false,
        type: row.type
    };
    const gvarIndex = props.userAppDetail.globalVariables.findIndex(item => item.name === globalVariableForm.value.name);
    editIndex = gvarIndex;
    globalVariableDialogVisible.value = true;
}

function handleDelete(row: AppVariable) {
    const gvars = props.userAppDetail.globalVariables ?? [];
    const index = gvars.findIndex(item => item.name === row.name);
    if (index > -1) {
        gvars.splice(index, 1);
        emit('updateGlobalVariable', gvars);
    }
}

function validateAndConvertValue(value: string, type: string) {
    try {
        switch (type) {
            case 'number':
                const num = Number(value);
                if (isNaN(num)) throw new Error('无效的数字');
                return num;
            case 'boolean':
                if (value.toLowerCase() === 'true') return true;
                if (value.toLowerCase() === 'false') return false;
                throw new Error('无效的布尔值');
            case 'array':
            case 'object':
                return JSON.parse(value);
            default:
                return value;
        }
    } catch (error: any) {
        ElMessage.error(`值格式错误: ${error.message}`);
        return null;
    }
}

function handleAddVariable() {
    const value = validateAndConvertValue(globalVariableForm.value.value, globalVariableForm.value.type);
    if (value === null) return;

    const gvars: AppVariable[] = [];
    gvars.push(...props.userAppDetail.globalVariables);
    if (editIndex > -1) {
        gvars[editIndex].name = globalVariableForm.value.name;
        gvars[editIndex].value = globalVariableForm.value.value;
        gvars[editIndex].display = globalVariableForm.value.display;
        gvars[editIndex].exposed = globalVariableForm.value.exposed;
        gvars[editIndex].type = globalVariableForm.value.type;
        
        emit('updateGlobalVariable', gvars);
        globalVariableDialogVisible.value = false;
        editIndex = -1;
        globalVariableForm.value = {
            name: '',
            value: '',
            display: '',
            exposed: false,
            type: 'string'
        }
        return;
    }
    gvars.push({
        name: globalVariableForm.value.name,
        value: value,
        type: globalVariableForm.value.type,
        display: globalVariableForm.value.display,
        exposed: globalVariableForm.value.exposed
    });
    globalVariableDialogVisible.value = false;
    emit('updateGlobalVariable', gvars);

    globalVariableForm.value = {
        name: '',
        value: '',
        display: '',
        exposed: false,
        type: 'string'
    }
}

const globalVariableDialogVisible = ref(false);

const globalVariableForm = ref({
    name: '',
    value: '',
    display: '',
    exposed: false,
    type: 'string'
});

const globalVariableRules = {
    name: [
        { required: true, message: '请输入全局变量名', trigger: 'blur' },
        { min: 1, max: 100, message: '全局变量名长度在 1 到 100 个字符', trigger: 'blur' }
    ],
    value: [
        { required: false, message: '请输入全局变量值', trigger: 'blur' },
        { min: 1, max: 1000, message: '全局变量值长度在 1 到 1000 个字符', trigger: 'blur' }
    ],
    display: [
        { required: false, message: '请输入全局变量注释', trigger: 'blur' },
        { min: 1, max: 100, message: '全局变量注释长度在 1 到 100 个字符', trigger: 'blur' }
    ]
};

function handleVariableChange(row: AppVariable) {
    // 这边要知道是哪个变量被修改了
    const gvars = props.userAppDetail.globalVariables;
    const index = gvars.findIndex(item => item.name === row.name);
    gvars[index].exposed = row.exposed;
    emit('updateGlobalVariable', gvars);
}

// 定义支持的数据类型
const dataTypes = [
    { label: '字符串', value: 'string' },
    { label: '数字', value: 'number' },
    { label: '布尔值', value: 'boolean' },
    { label: '数组', value: 'array' },
    { label: '对象', value: 'object' }
];

// 格式化显示值
function formatDisplayValue(value: any, type: string) {
    switch (type) {
        case 'array':
        case 'object':
            return JSON.stringify(value, null, 2);
        default:
            return String(value);
    }
}

</script>

<template>
    <div class="viewbox">
        <div class="flex flex-row justify-between items-center gap-1 p-2">
            <div>全局变量</div>
            <div class="global-variable-list flex-1 flex flex-row gap-1 overflow-auto">
                <ElInput class="h-6 flex-1 overflow-hidden" :prefix-icon="searchIcon" v-model="globalVariableNameFilter"
                    placeholder="搜索指令" clearable />
                <ElButton link @click="globalVariableDialogVisible = true">新增</ElButton>
            </div>
        </div>
        <div class="global-variable-list flex-1 flex flex-col gap-1 overflow-auto">
            <el-table :data="appGlobalVariables" :border="true" style="width: 100%">
                <el-table-column prop="name" label="变量名" show-overflow-tooltip width="80" />
                <el-table-column prop="value" label="默认值" show-overflow-tooltip >
                    
                </el-table-column>
                <el-table-column prop="type" label="类型" width="100">
                    <template #default="scope">
                        {{ dataTypes.find(t => t.value === scope.row.type)?.label || '字符串' }}
                    </template>
                </el-table-column>
                <el-table-column prop="exposed" label="暴露配置" width="100">
                    <template #header>
                        <el-tooltip
                            content="开启后可在应用列表页面直接配置该变量"
                            placement="top"
                            effect="dark"
                        >
                            <span>暴露配置 <el-icon><QuestionFilled /></el-icon></span>
                        </el-tooltip>
                    </template>
                    <template #default="scope">
                        <el-switch v-model="scope.row.exposed" @change="handleVariableChange(scope.row)" />
                    </template>
                </el-table-column>
                <el-table-column fixed="right" label="操作" min-width="100">
                    <template #default="scope">
                        <el-button link type="primary" size="small" @click="handleClick(scope.row)">
                            编辑
                        </el-button>
                        <el-popconfirm title="确定删除吗？" @confirm="handleDelete(scope.row)">
                            <template #reference>
                                <el-button link size="small" type="danger">删除</el-button>
                            </template>
                        </el-popconfirm>
                    </template>
                </el-table-column>
            </el-table>
        </div>
        <ElDialog v-model="globalVariableDialogVisible" :title="'全局变量'">
            <div class="dialog-body flex flex-col gap-1">
                <ElForm ref="registerFormRef" :model="globalVariableForm" :rules="globalVariableRules" label-width="80px">
                    <ElFormItem label="变量名" prop="name">
                        <ElInput v-model="globalVariableForm.name" placeholder="请输入全局变量名称"></ElInput>
                    </ElFormItem>
                    <ElFormItem label="类型">
                        <el-select v-model="globalVariableForm.type">
                            <el-option
                                v-for="type in dataTypes"
                                :key="type.value"
                                :label="type.label"
                                :value="type.value"
                            />
                        </el-select>
                    </ElFormItem>
                    <ElFormItem label="值">
                        <template v-if="globalVariableForm.type === 'boolean'">
                            <el-radio-group v-model="globalVariableForm.value">
                                <el-radio label="true">True</el-radio>
                                <el-radio label="false">False</el-radio>
                            </el-radio-group>
                        </template>
                        <template v-else-if="globalVariableForm.type === 'array' || globalVariableForm.type === 'object'">
                            <el-input
                                type="textarea"
                                v-model="globalVariableForm.value"
                                :rows="4"
                                placeholder="请输入有效的 JSON"
                            />
                        </template>
                        <template v-else>
                            <el-input
                                v-model="globalVariableForm.value"
                                :placeholder="`请输入${globalVariableForm.type === 'number' ? '数字' : '值'}`"
                            />
                        </template>
                    </ElFormItem>
                    <ElFormItem label="注释" prop="display">
                        <ElInput v-model="globalVariableForm.display" placeholder="请输入全局变量注释"></ElInput>
                    </ElFormItem>
                    <ElFormItem label="暴露配置">
                        <div class="flex items-center gap-2">
                            <el-switch v-model="globalVariableForm.exposed" />
                            <el-tooltip
                                content="开启后可在应用列表页面直接配置该变量"
                                placement="top"
                                effect="dark"
                            >
                                <el-icon class="text-gray-400"><QuestionFilled /></el-icon>
                            </el-tooltip>
                        </div>
                    </ElFormItem>
                </ElForm>
            </div>
            <template #footer>
                <ElButton type="primary" @click="handleAddVariable">确定</ElButton>
                <ElButton @click="globalVariableDialogVisible = false">取消</ElButton>
            </template>
        </ElDialog>
    </div>
</template>

<style lang="less" scoped>
// 添加样式
</style>
