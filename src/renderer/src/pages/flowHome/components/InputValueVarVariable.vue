<script setup lang="ts">
import type { AppVariable, DirectiveInput, FlowVariable } from 'src/main/userApp/types';
import { ElInput } from 'element-plus';
import { ref, unref } from 'vue';
import VariableItem from './VariableItem.vue';
import { useElementSize } from '@vueuse/core';
import { curUserApp } from '../indexvue'

// 添加逻辑
const props = defineProps<{
    inputItem: DirectiveInput;
    variables: FlowVariable[];
}>();


const emit = defineEmits<{
    (e: 'inputValueChange', value: any, inputItem: DirectiveInput): void;
}>();


const model = defineModel<string>({ required: true });

const varSelectVal = ref('');

const variableSelect = ref();
const varShow = ref(true);

function varClick() {
    unref(popoverRef).popperRef?.delayHide?.()
}

function varSelectValChange(variable: AppVariable, isGlobal: boolean = false, keys: string[] = []) {
    varShow.value = false;
    const valName = isGlobal ? `_GLOBAL_${variable.name}` : variable.name;
    let valKey = '';
    if (keys.length > 0) {
        valKey = `${valName}${keys.slice(1).map(key => `['${key}']`).join('')}`;
    } else {
        valKey = valName;
    }
    if (props.inputItem.addConfig.multiple) {
        let val = model.value + ',' + valKey;
        val.startsWith(',') && (val = val.substring(1));
        model.value = val;
    } else {
        model.value = valKey;
        popoverRef.value.hide();
    }
    emit('inputValueChange', variable, props.inputItem);
}

const buttonRef = ref();
const popoverRef = ref();

const inputRef = ref();
const { width: varWidth } = useElementSize(inputRef);


const variableFilter = ref(['global', 'local']);

function localVariablesFilter(variable: FlowVariable) {
    let show = variableFilter.value.includes('local')
    if (!variable.before) {
        show = show && variableFilter.value.includes('notusable')
    }
    if (variableFilter.value.includes('recommended')) {
        show = show && props.inputItem.addConfig.filtersType === variable.type;
    }
    return show &&
        (varSelectVal.value.length === 0
            || variable.name.includes(varSelectVal.value)
            || variable.display?.includes(varSelectVal.value));;
}

</script>

<template>
    <div class="relative">
        <div class="flex items-center gap-2" >
            <div class="flex-1" ref="inputRef">
                <el-input type="textarea" v-model="model" :placeholder="inputItem.addConfig?.placeholder"></el-input>
            </div>
            <div class="text-blue-500 text-sm cursor-pointer" ref="buttonRef" @click="varClick">使用变量</div>
        </div>
       

        <el-popover ref="popoverRef" :virtual-ref="buttonRef" placement="bottom-end" :width="varWidth" trigger="click">
            <div ref="variableSelect" filterable tabindex="-1"
                class="active flex flex-col gap-2 mt-1 left-0 p-1 bg-white text-gray-500 text-sm border border-gray-200 border-solid rounded-md w-full">
                <div>
                    <ElInput v-model="varSelectVal" placeholder="搜索变量"></ElInput>
                    <div class="flex justify-end flex-1">
                        <ElCheckboxGroup v-model="variableFilter">
                            <ElCheckbox label="全局" value="global" />
                            <ElCheckbox label="局部" value="local" />
                            <ElCheckbox label="不可用" value="notusable" />
                            <ElCheckbox label="推荐" value="recommended" />
                        </ElCheckboxGroup>
                    </div>
                </div>
                <div class="viewbox min-h-10 max-h-60 overflow-y-auto">
                    <div class="wrapbox">
                        <template v-for="variable in variables">
                            <div class="hover:bg-gray-100 p-1 cursor-pointer rounded"
                                v-show="localVariablesFilter(variable)">
                                <VariableItem :variable="variable"
                                    @varSelectValChange="(val, keys) => varSelectValChange(val, false, keys)">
                                </VariableItem>
                            </div>
                        </template>
                        <template v-for="variable in curUserApp.globalVariables">
                            <div class="hover:bg-gray-100 p-1 cursor-pointer rounded" v-show="varSelectVal.length === 0
                                || variable.name.includes(varSelectVal)
                                || variable.display?.includes(varSelectVal)
                                ">
                                <div class="item" @click="varSelectValChange(variable, true)">
                                    {{ variable.name }}
                                    ({{ variable.display }})
                                    <el-tag type="primary">全局变量</el-tag>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        </el-popover>
    </div>
</template>

<style lang="less" scoped>
// 添加样式
.active {
    z-index: 1000;
}
</style>
