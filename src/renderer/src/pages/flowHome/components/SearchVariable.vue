<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue';
import type Flow from 'src/main/userApp/Flow';
import type UserApp from 'src/main/userApp/UserApp';
import type { DirectiveData } from './types';
import { computeComment } from '@renderer/utils/commentUtils';

interface SearchResult {
    index: number;
    line: number;
    directive: string;
    variables: string[];
    preview: string;
    flowName: string;
    flowAliasName: string;
}

interface SearchData {
    flows: Flow[];
    appInfo: UserApp;
    currentFlow: string;
}

const props = defineProps<{
    show: boolean;
    searchData: SearchData;
}>();

const emit = defineEmits<{
    (e: 'update:show', value: boolean): void;
    (e: 'scroll-to-line', index: number, flowName: string): void;
}>();

const dialogVisible = ref(false);

const searchInput = ref();

watch(() => props.show, (newVal) => {
    dialogVisible.value = newVal;
    if (!newVal) {
        // 关闭对话框时清空搜索结果
        searchResults.value = [];
        searchVariable.value = '';
        currentSearchIndex.value = -1;
    }
});

watch(dialogVisible, (newVal) => {
    emit('update:show', newVal);
});

const searchVariable = ref('');
const searchResults = ref<SearchResult[]>([]);
const currentSearchIndex = ref(-1);

const searchResultsContainer = ref<HTMLElement | null>(null);

// 添加搜索范围选择
const searchScope = ref<'current' | 'all'>('current');

// 添加排序函数
function sortSearchResults(results: SearchResult[]) {
    return results.sort((a, b) => {
        // 当前流程排在最前面
        if (a.flowName === props.searchData.currentFlow) return -1;
        if (b.flowName === props.searchData.currentFlow) return 1;
        // 其他流程按照名称排序
        return a.flowName.localeCompare(b.flowName);
    });
}

function searchVariableByType(text: string, type: 'input' | 'output') {
    searchResults.value = [];
    if (!text) return;
    searchVariable.value = text;
    
    const searchText = text.toLowerCase();
    const tempResults: SearchResult[] = [];
    
    const flowsToSearch = searchScope.value === 'current' 
        ? props.searchData.flows.filter(flow => flow.name === props.searchData.currentFlow)
        : props.searchData.flows;
        
    flowsToSearch.forEach(flow => {
        flow.blocks.forEach((block, index) => {
            const matchedVars: string[] = [];
            let isMatch = false;
            const tmpBlock = block as DirectiveData;
            
            if (type === 'input') {
                // 只搜索输入变量的值
                for (const key in block.inputs) {
                    const value = block.inputs[key].display || block.inputs[key].value;
                    if (value?.toString().toLowerCase() === searchText) {
                        matchedVars.push(`输入: ${key}=${value}`);
                        isMatch = true;
                    }
                }
            } else {
                // 只搜索输出变量的名称
                for (const key in block.outputs) {
                    const name = block.outputs[key].name;
                    if (name?.toString().toLowerCase() === searchText) {
                        matchedVars.push(`输出: ${key}=${name}`);
                        isMatch = true;
                    }
                }
            }
            
            if (isMatch) {
                tmpBlock.commentShow = computeComment(tmpBlock);  // 计算 commentShow
                tempResults.push({
                    index,
                    line: index,
                    directive: block.displayName || block.name,
                    variables: matchedVars,
                    preview: tmpBlock.commentShow || block.comment || block.name,
                    flowName: flow.name,
                    flowAliasName: flow.aliasName || flow.name
                });
            }
        });
    });
    
    // 对搜索结果进行排序
    searchResults.value = sortSearchResults(tempResults);
    currentSearchIndex.value = searchResults.value.length > 0 ? 0 : -1;
}

function searchVariableInBlocks() {
    searchResults.value = [];
    if (!searchVariable.value) return;
    
    const searchText = searchVariable.value.toLowerCase();
    const tempResults: SearchResult[] = [];
    
    // 根据搜索范围选择要搜索的流程
    const flowsToSearch = searchScope.value === 'current' 
        ? props.searchData.flows.filter(flow => flow.name === props.searchData.currentFlow)
        : props.searchData.flows;
    
    // 搜索选定范围内的所有流程
    flowsToSearch.forEach(flow => {
        flow.blocks.forEach((block, index) => {
            const matchedVars: string[] = [];
            let isMatch = false;
            const tmpBlock = block as DirectiveData;
            
            // 搜索指令名称
            const directiveName = (block.displayName || block.name || '').toLowerCase();
            if (directiveName.includes(searchText)) {
                matchedVars.push(`指令: ${block.displayName || block.name}`);
                isMatch = true;
            }
            
            // 搜索输入变量的值
            for (const key in block.inputs) {
                const value = block.inputs[key].display || block.inputs[key].value;
                if (value?.toString().toLowerCase().includes(searchText)) {
                    matchedVars.push(`输入: ${key}=${value}`);
                    isMatch = true;
                }
            }
            
            // 搜索输出变量的名称
            for (const key in block.outputs) {
                const name = block.outputs[key].name;
                if (name?.toString().toLowerCase().includes(searchText)) {
                    matchedVars.push(`输出: ${key}=${name}`);
                    isMatch = true;
                }
            }
            
            if (isMatch) {
                tmpBlock.commentShow = computeComment(tmpBlock);  // 计算 commentShow
                tempResults.push({
                    index,
                    line: index,
                    directive: block.displayName || block.name,
                    variables: matchedVars,
                    preview: tmpBlock.commentShow || block.comment || block.name,
                    flowName: flow.name,
                    flowAliasName: flow.aliasName || flow.name
                });
            }
        });
    });
    
    // 对搜索结果进行排序
    searchResults.value = sortSearchResults(tempResults);
    currentSearchIndex.value = searchResults.value.length > 0 ? 0 : -1;
}

function scrollResultIntoView(idx: number) {
    nextTick(() => {
        const resultElement = searchResultsContainer.value?.querySelector(`.result-item:nth-child(${idx + 1})`);
        resultElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
}

function nextSearchResult() {
    if (searchResults.value.length === 0) return;
    currentSearchIndex.value = (currentSearchIndex.value + 1) % searchResults.value.length;
    scrollResultIntoView(currentSearchIndex.value);
}

function prevSearchResult() {
    if (searchResults.value.length === 0) return;
    currentSearchIndex.value = currentSearchIndex.value - 1;
    if (currentSearchIndex.value < 0) {
        currentSearchIndex.value = searchResults.value.length - 1;
    }
    scrollResultIntoView(currentSearchIndex.value);
}

function handleClick(idx: number) {
    currentSearchIndex.value = idx;
    scrollResultIntoView(idx);
}

function handleKeydown(e: KeyboardEvent) {
    if (!(e.target as HTMLElement).classList.contains('el-input__inner')) return;
    
    if (!searchResults.value.length) return;
    
    switch (e.key) {
        case 'ArrowUp':
            e.preventDefault();
            prevSearchResult();
            break;
        case 'ArrowDown':
            e.preventDefault();
            nextSearchResult();
            break;
        case 'Enter':
            e.preventDefault();
            if (currentSearchIndex.value >= 0) {
                const result = searchResults.value[currentSearchIndex.value];
                emit('scroll-to-line', result.index, result.flowName);
                dialogVisible.value = false;
            }
            break;
    }
}

function handleDoubleClick(idx: number) {
    const result = searchResults.value[idx];
    emit('scroll-to-line', result.index, result.flowName);
    dialogVisible.value = false;
}

// 添加常用变量统计和展示
function getTopVariables(blocks: DirectiveData[], limit = 10) {
    const variableCount = new Map<string, number>();
    
    blocks.forEach(block => {
        // 统计输入变量
        for (const key in block.inputs) {
            const value = block.inputs[key].display || block.inputs[key].value;
            if (value) {
                const count = variableCount.get(value.toString()) || 0;
                variableCount.set(value.toString(), count + 1);
            }
        }
        
        // 统计输出变量
        for (const key in block.outputs) {
            const name = block.outputs[key].name;
            if (name) {
                const count = variableCount.get(name.toString()) || 0;
                variableCount.set(name.toString(), count + 1);
            }
        }
    });
    
    // 排序并返回前N个最常用的变量
    return Array.from(variableCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name]) => name);
}

// 修改 topVariables 的计算方式
const topVariables = computed(() => {
    const blocks = props.searchData.flows.flatMap(flow => 
        flow.blocks.map(block => ({
            ...block,
            pdLvn: 0,  // 设置必需的 DirectiveData 属性
            foldDesc: '',
            commentShow: ''
        }))
    );
    return getTopVariables(blocks);
});

// 点击常用变量标签
function handleTagClick(variable: string) {
    searchVariable.value = variable;
    searchVariableInBlocks();
}

// 暴露方法给父组件调用
defineExpose({
    searchVariableByType
});

// 修改变量显示，添加长度限制
function formatVariable(variable: string, maxLength = 20) {
    if (variable.length <= maxLength) return variable;
    return variable.slice(0, maxLength) + '...';
}
</script>

<template>
    <el-dialog
        v-model="dialogVisible"
        title="搜索关键字"
        width="600px"
        :close-on-click-modal="false"
        append-to-body
        @opened="searchInput?.$el.querySelector('input')?.focus()"
    >
        <!-- 添加搜索范围选择 -->
        <div class="flex items-center gap-4 mb-4">
            <div class="text-sm">搜索范围：</div>
            <el-radio-group v-model="searchScope" @change="searchVariableInBlocks">
                <el-radio-button label="current">当前流程</el-radio-button>
                <el-radio-button label="all">所有流程</el-radio-button>
            </el-radio-group>
        </div>

        <!-- 添加常用变量标签 -->
        <div v-if="topVariables.length" class="mb-4">
            <div class="text-xs text-gray-400 mb-2">常用变量：</div>
            <div class="flex flex-wrap gap-2">
                <el-tag
                    v-for="variable in topVariables"
                    :key="variable"
                    size="small"
                    class="cursor-pointer"
                    effect="plain"
                    @click="handleTagClick(variable)"
                    :title="variable"
                >
                    {{ formatVariable(variable) }}
                </el-tag>
            </div>
        </div>

        <div class="flex flex-col gap-4" @keydown="handleKeydown">
            <el-input
                ref="searchInput"
                v-model="searchVariable"
                placeholder="输入变量或指令名称"
                class="search-input"
                clearable
                @input="searchVariableInBlocks"
            >
                <template #append>
                    <div class="flex items-center">
                        <el-button :disabled="!searchResults.length" @click="prevSearchResult">
                            <el-icon><ArrowUp /></el-icon>
                        </el-button>
                        <el-button :disabled="!searchResults.length" @click="nextSearchResult">
                            <el-icon><ArrowDown /></el-icon>
                        </el-button>
                        <span v-if="searchResults.length" class="mx-2 text-gray-500">
                            {{ currentSearchIndex + 1 }}/{{ searchResults.length }}
                        </span>
                    </div>
                </template>
            </el-input>

            <!-- 搜索结果列表 -->
            <div 
                v-if="searchResults.length" 
                ref="searchResultsContainer"
                class="search-results max-h-60 overflow-auto"
            >
                <div
                    v-for="(result, idx) in searchResults"
                    :key="idx"
                    class="result-item p-2 cursor-pointer hover:bg-gray-100"
                    :class="{'bg-blue-50': idx === currentSearchIndex}"
                    @click="handleClick(idx)"
                    @dblclick="handleDoubleClick(idx)"
                >
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-2">
                            <span class="font-medium">第 {{ result.line + 1 }} 行</span>
                            <span class="text-xs text-gray-400">[{{ result.flowAliasName }}]</span>
                        </div>
                        <span class="text-gray-600">{{ result.directive }}</span>
                    </div>
                    <div class="text-sm text-gray-500 mt-1">
                        {{ result.variables.join('、') }}
                    </div>
                    <div class="text-xs bg-gray-50 p-2 mt-1 rounded" v-html="result.preview"></div>
                </div>
            </div>
            <div v-else-if="searchVariable" class="text-center text-gray-500 py-2">
                未找到匹配的变量
            </div>
        </div>
    </el-dialog>
</template>

<style lang="less" scoped>
.search-results {
    border: 1px solid #dcdfe6;
    border-radius: 4px;
    
    .result-item {
        border-bottom: 1px solid #ebeef5;
        &:last-child {
            border-bottom: none;
        }
        
        :deep(.variable) {
            display: inline-block;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            vertical-align: bottom;
        }
    }
}

:deep(.el-tag) {
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    
    &:hover {
        background-color: var(--el-color-primary-light-9);
    }
}
</style> 