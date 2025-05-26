<script setup lang="ts">
import { Action } from '@renderer/lib/action';
import { useElementSize } from '@vueuse/core';
import { ElInput } from 'element-plus';
import type { AppVariable, DirectiveInput, FlowVariable } from 'src/main/userApp/types';
import { ref, unref } from 'vue';
import { curUserApp } from '../indexvue';
import { addElementLibrary, elementLibraryEditConfirm } from '../propertyTabs';
import VariableItem from './VariableItem.vue';
// import { typeDisplay } from '../directiveConfig';

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
const varShow = ref(false);
const cursorPos = ref(0);

props.inputItem.objectMode = props.inputItem.objectMode || 'string';

function varClick() {
    const input = valInputRef?.value?.ref;
    if (input) {
        cursorPos.value = input.selectionStart ?? 0;
    }
    unref(popoverRef).popperRef?.delayHide?.()
}

function varSelectValChange(val: AppVariable, isGlobal: boolean = false, keys: string[] = []) {
    console.log(val, cursorPos.value);
    varShow.value = false;
    let valName = isGlobal ? `_GLOBAL_${val.name}` : val.name;
    const tValue = (model.value ?? '');

    if (props.inputItem.enableExpression) {
        if (keys.length > 0) {
            valName = `${valName}${keys.slice(1).map(key => `['${key}']`).join('')}`;
        } else {
            valName = `${valName}`;
        }
    } else {
        if (keys.length > 0) {
            valName = `\${${valName}${keys.slice(1).map(key => `['${key}']`).join('')}}`;
        } else {
            valName = `\${${valName}}`;
        }
    }
    model.value = tValue.substring(0, cursorPos.value) + valName + tValue.substring(cursorPos.value);
    popoverRef.value.hide();
    // model.value = (model.value ?? '') + `\${${val}}`;
    emit('inputValueChange', model.value, props.inputItem);
}

async function filePathSelect(_e: any, inputItem: DirectiveInput) {
    console.log('选择文件');
    const files = await Action.selectFileOrFolder(inputItem.addConfig.openDirectory ?? false, inputItem.addConfig.extensions ?? ["*"]);
    if (files.length === 0) {
        return;
    }
    const file = files[0];
    model.value = file.replace(/\\/g, '/');
}

const buttonRef = ref();
const popoverRef = ref();

const inputRef = ref();
const valInputRef = ref<any>();
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


function enableExpressionToggle(_e: Event) {
    if (props.inputItem.objectMode === 'expression') {
        model.value = (model.value ?? '').replace(/^\${/g, '').replace(/}$/g, '');
    }else if(props.inputItem.objectMode === 'string'){
        model.value = `\${${model.value}}`;
    }

}

const activeTabsName = ref('variable');

function selectCssSelector(elementInfo: any) {
    model.value = `${elementInfo.cssSelector}`;
    popoverRef.value.hide();
    emit('inputValueChange', model.value, props.inputItem);
}
function selectXpathSelector(elementInfo: any) {
    model.value = `${elementInfo.xPath}`;
    popoverRef.value.hide();
    emit('inputValueChange', model.value, props.inputItem);
}

</script>

<template>
    <div class="relative tracking-wider flex gap-1 items-center">
        <div style="width: 60px;" v-if="inputItem.type === 'object'">
            <el-select @change="enableExpressionToggle" class="w-full" v-model="inputItem.objectMode" placeholder="解析模式">
                <el-option label="文本模式" value="string">文本模式 (支持文本、变量混合输入 最终结果会被解析为文本)</el-option>
                <el-option label="表达式模式" value="expression">表达式模式 (最终结果会被解析为表达式)</el-option>
                <el-option label="存文本模式" value="stringRaw">存文本模式 (字符串原始值 不会替换 ${} 变量)</el-option>
            </el-select>
        </div>
      
        


        <div ref="inputRef" class="flex-1">
            <div class="flex  items-center gap-2" v-if="inputItem.addConfig.type === 'textarea'">
                <el-input class="flex-1" ref="valInputRef" type="textarea" v-model="model"
                    :autosize="{ minRows: 1, maxRows: 10 }" :placeholder="inputItem.addConfig?.placeholder"></el-input>
                <div class="text-blue-500 text-sm cursor-pointer w-auto" ref="buttonRef" @click="varClick">变量{{
                    inputItem.addConfig.elementLibrarySupport ? '/元素库' : '' }}</div>
            </div>
            <el-input ref="valInputRef" v-else v-model="model" :placeholder="inputItem.addConfig?.placeholder">
                <template #append>
                    <div class="flex items-center gap-2">
                        <div class="text-gray-500 text-sm cursor-pointer hover:text-blue-500"
                            v-if="inputItem.addConfig.type === 'filePath'" @click="filePathSelect($event, inputItem)">
                            {{ inputItem.addConfig.openDirectory ? '选择文件夹' : '选择文件' }}</div>
                        <div class="text-gray-500 text-sm cursor-pointer hover:text-blue-500 fx" ref="buttonRef"
                            @click="varClick">
                            fx</div>
                    </div>
                </template>
            </el-input>
        </div>

        <el-popover ref="popoverRef" :virtual-ref="buttonRef" placement="bottom-end" :width="varWidth" trigger="click">
            <el-tabs v-model="activeTabsName" class="demo-tabs" v-if="inputItem.addConfig.elementLibrarySupport">
                <el-tab-pane label="变量" name="variable">
                    <div ref="variableSelect" filterable tabindex="-1"
                        class="active flex flex-col gap-2 mt-1 left-0 p-1 bg-white text-gray-500 text-sm border border-gray-200 border-solid rounded-md w-full">
                        <div>
                            <ElInput v-model="varSelectVal" placeholder="搜索关键字" clearable></ElInput>
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
                                    <div class="cursor-pointer rounded" v-show="localVariablesFilter(variable)">
                                        <VariableItem :variable="variable"
                                            @varSelectValChange="(val, keys) => varSelectValChange(val, false, keys)">
                                        </VariableItem>
                                    </div>
                                </template>
                                <template v-for="variable in curUserApp.globalVariables">
                                    <div class="relative cursor-pointer rounded" v-show="variableFilter.includes('global') &&
                                        (varSelectVal.length === 0
                                            || variable.name.includes(varSelectVal)
                                            || variable.display?.includes(varSelectVal))
                                        ">
                                        <VariableItem :variable="(variable as any)" :is-global="true"
                                            @varSelectValChange="(val, keys) => varSelectValChange(val, true, keys)">
                                        </VariableItem>
                                        <el-tag class="absolute top-1/2 right-2 transform -translate-y-1/2"
                                            type="primary">全局变量</el-tag>
                                        <!-- <div class="item" @click="varSelectValChange(variable, true)">
                                    {{ variable.name }}
                                    ({{ variable.display }})
                                    <el-tag type="primary">全局变量</el-tag>
                                </div> -->
                                    </div>
                                </template>
                            </div>
                        </div>
                    </div>
                </el-tab-pane>
                <el-tab-pane label="元素库" name="elementLibrary">
                    <div filterable tabindex="-1"
                        class="active flex flex-col gap-2 mt-1 left-0 p-1 bg-white text-gray-500 text-sm border border-gray-200 border-solid rounded-md w-full">
                        <div>
                            <ElInput v-model="varSelectVal" placeholder="搜索关键字" clearable></ElInput>
                        </div>
                        <div class="viewbox min-h-10 max-h-60 overflow-y-auto">
                            <div @click="addElementLibrary"
                                class="p-2 rounded flex flex-1 justify-center items-center hover:bg-gray-100 hover:text-blue-500 cursor-pointer gap-2">
                                <el-icon>
                                    <Plus />
                                </el-icon>
                                <div>去浏览器捕获元素</div>
                            </div>
                            <div v-for="elementInfo in curUserApp.elementLibrarys" v-show="varSelectVal.length === 0
                                || elementInfo.name.includes(varSelectVal)
                                || elementInfo.description?.includes(varSelectVal)"
                                @dblclick="elementLibraryEditConfirm(elementInfo)">
                                <el-popover :hide-after="0" placement="right" :width="300" trigger="hover">
                                    <div class="flex flex-col gap-2">
                                        <div v-if="elementInfo.description">
                                            描述：{{ elementInfo.description }}
                                        </div>
                                        <div>
                                            预览图：
                                            <ElImage :src="`assets://file?path=${elementInfo.previewPath}`" alt="" />
                                        </div>
                                    </div>
                                    <template #reference>
                                        <div class="hover:bg-gray-100 flex justify-between items-center p-1 rounded">
                                            <div class="flex gap-1 items-center">
                                                <div>
                                                    <div>{{ elementInfo.name }}</div>
                                                    <div class="text-xs text-gray-400" v-if="elementInfo.description">
                                                        {{ elementInfo.description }}
                                                    </div>
                                                </div>
                                            </div>
                                            <div class="ops">
                                                <el-button type="text"
                                                    @click="selectCssSelector(elementInfo)">css</el-button>
                                                <el-button type="text"
                                                    @click="selectXpathSelector(elementInfo)">xPath</el-button>
                                            </div>
                                        </div>

                                    </template>
                                </el-popover>
                            </div>

                        </div>
                    </div>
                </el-tab-pane>

            </el-tabs>
            <div ref="variableSelect" filterable tabindex="-1" v-else
                class="active flex flex-col gap-2 mt-1 left-0 p-1 bg-white text-gray-500 text-sm border border-gray-200 border-solid rounded-md w-full">
                <div>
                    <ElInput v-model="varSelectVal" placeholder="搜索关键字" clearable></ElInput>
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
                            <div class="cursor-pointer rounded" v-show="localVariablesFilter(variable)">
                                <VariableItem :variable="variable"
                                    @varSelectValChange="(val, keys) => varSelectValChange(val, false, keys)">
                                </VariableItem>
                            </div>
                        </template>
                        <template v-for="variable in curUserApp.globalVariables">
                            <div class="relative cursor-pointer rounded" v-show="variableFilter.includes('global') &&
                                (varSelectVal.length === 0
                                    || variable.name.includes(varSelectVal)
                                    || variable.display?.includes(varSelectVal))
                                ">
                                <VariableItem :variable="(variable as any)" :is-global="true"
                                    @varSelectValChange="(val, keys) => varSelectValChange(val, true, keys)">
                                </VariableItem>
                                <el-tag class="absolute top-1/2 right-2 transform -translate-y-1/2"
                                    type="primary">全局变量</el-tag>
                                <!-- <div class="item" @click="varSelectValChange(variable, true)">
                                    {{ variable.name }}
                                    ({{ variable.display }})
                                    <el-tag type="primary">全局变量</el-tag>
                                </div> -->
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

:deep(.el-input-group__append) {
    padding: 0 4px;
}

</style>
