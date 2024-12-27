<script setup lang="tsx">
import { computed, ref } from 'vue';
import type { AppVariable } from 'src/main/userApp/types';
import { ElInput, ElButton, ElDialog, ElForm, ElFormItem } from 'element-plus';
import type { MainUserApp } from './types';


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
                type: 'string',
                display: item.display
            };
        });
    return globalVariables;
})

let editIndex = -1;

function handleClick(row: AppVariable) {

    globalVariableForm.value = {
        name: row.name,
        value: row.value,
        display: row.display ?? ''
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

function addGlobalVariable() {
    const gvars: AppVariable[] = [];
    gvars.push(...props.userAppDetail.globalVariables);
    if (editIndex > -1) {
        gvars[editIndex].name = globalVariableForm.value.name;
        gvars[editIndex].value = globalVariableForm.value.value;
        gvars[editIndex].display = globalVariableForm.value.display;
        console.log(gvars);

        emit('updateGlobalVariable', gvars);
        globalVariableDialogVisible.value = false;
        editIndex = -1;
        globalVariableForm.value = {
            name: '',
            value: '',
            display: ''
        }
        return;
    }
    gvars.push({
        name: globalVariableForm.value.name,
        value: globalVariableForm.value.value,
        type: 'string',
        display: globalVariableForm.value.display
    });
    globalVariableDialogVisible.value = false;
    emit('updateGlobalVariable', gvars);

    globalVariableForm.value = {
        name: '',
        value: '',
        display: ''
    }
}

const globalVariableDialogVisible = ref(false);

const globalVariableForm = ref({
    name: '',
    value: '',
    display: ''
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
                <!-- <el-table-column prop="type" label="类型" width="80" /> -->
                <el-table-column prop="value" label="默认值" show-overflow-tooltip />
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
                    <ElFormItem label="默认值" prop="value">
                        <ElInput v-model="globalVariableForm.value" placeholder="请输入全局变量值"></ElInput>
                    </ElFormItem>
                    <ElFormItem label="注释" prop="display">
                        <ElInput v-model="globalVariableForm.display" placeholder="请输入全局变量注释"></ElInput>
                    </ElFormItem>
                </ElForm>
            </div>
            <template #footer>
                <ElButton type="primary" @click="addGlobalVariable">确定</ElButton>
                <ElButton @click="globalVariableDialogVisible = false">取消</ElButton>
            </template>
        </ElDialog>
    </div>
</template>

<style lang="less" scoped>
// 添加样式
</style>
