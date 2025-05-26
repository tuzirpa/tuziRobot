<script setup lang="ts">
import type { DirectiveInput, DirectiveTree, FlowVariable } from 'src/main/userApp/types';
import InputValueVar from './InputValueVar.vue';
import OutputValueVar from './OutputValueVar.vue';
import InputValueVarVariable from './InputValueVarVariable.vue';
import { nextTick, ref } from 'vue';
import { Action } from '@renderer/lib/action'
import { ElButton, ElInput, ElSelect, ElTooltip } from 'element-plus';
import { curUserApp } from '../indexvue';
import { copyObject } from '@shared/Utils';

// 添加逻辑
const props = defineProps<{
    directive: DirectiveTree;
    variables: FlowVariable[];
}>();

const _directive = ref(props.directive);
const _variables = ref(props.variables);


console.log(_directive.value.inputs);



_directive.value.failureStrategy = _directive.value.failureStrategy || 'throw';


const groups = ref([
    { name: '常规', active: false },
    { name: '高级', active: false },
    { name: '错误处理', active: false }
]);
groups.value[0].active = true;
function groupClick(group: any) {
    groups.value.forEach((g) => (g.active = false));
    group.active = true;
}

const advancedNum = ref(0);

function addInput(inputItemArr: {
    name: string;
    value: DirectiveInput[];
    values?: DirectiveInput[][];
}) {
    const v = inputItemArr.value;
    inputItemArr.values = inputItemArr.values ?? [];
    inputItemArr.values.push(copyObject(v))
}

function deleteInputs(inputItemArr :{
    name: string;
    value: DirectiveInput[];
    values?: DirectiveInput[][];
},index: number){
    inputItemArr.values?.splice(index, 1);
}


nextTick(async () => {

    for (const key in _directive.value.inputs) {
        if (Object.prototype.hasOwnProperty.call(_directive.value.inputs, key)) {
            const input = _directive.value.inputs[key];
            const addConfig = await Action.getAddConfig(_directive.value.key ?? _directive.value.name, key);
            input.addConfig = addConfig;
        }
    }
   
    setTimeout(() => {
        //输入变量处理
        for (const key in _directive.value.inputs) {
            if (Object.prototype.hasOwnProperty.call(_directive.value.inputs, key)) {
                const input = _directive.value.inputs[key];
                //自动补全处理
                if (!input.value && input.addConfig.autoComplete) {
                    //编辑状态不需要自动补全
                    if (!_directive.value.id){
                        //获取前置变量列表 在变量之后的不能作为输入然后倒序查找 实现最近使用变量优先
                        const beforeVariables = _variables.value.filter(item => item.before).reverse();
                        const variable = beforeVariables.find((item) => item.type === input.addConfig.filtersType);
                        input.value = variable?.name;
                    }
                } else {
                    input.value = input.value || input.addConfig.defaultValue;
                }


                if (input.addConfig.isAdvanced) {
                    advancedNum.value++;
                }
                if (input.addConfig.type === 'select') {

                    if (input.addConfig.getOptions) {
                        (async () => {
                            const directive = _directive.value;
                            const appInfo = curUserApp.value;
                            const optionTuils = {
                                getUserApps: async () => {
                                    const userApps = await Action.getUserApps();
                                    return userApps;
                                }
                            };
                            const fun = new Function(`const fun = ${input.addConfig.getOptions};return fun.apply(null, arguments)`);
                            input.addConfig.options = await fun(directive, appInfo, optionTuils);
                        })();
                    }

                }
            }
        }

        //输出变量处理
        for (const key in _directive.value.outputs) {
            if (Object.prototype.hasOwnProperty.call(_directive.value.outputs, key)) {
                const output = _directive.value.outputs[key];
                if (!output.name) {
                    //未设置 获取默认值 如果默认值有被设置过 则加上序号
                    output.name = output.name || output.addConfig?.defaultValue;
                    let index = _variables.value.findLastIndex((item) => item.name.startsWith(output.name));
                    if (index !== -1) {
                        output.name = output.name + (index++);
                    }
                }
            }
        }
        }, 300);
    
    
});

/**
 * 选择变量后触发的值变化
 * @param value 
 * @param inputItem 
 */
function inputValueChange(value: any, inputItem: DirectiveInput) {
    // 获取数组项 需要特殊处理 将变量描述带到 输出变量中
    if (_directive.value.name === 'dataProcessing.getArrayItem') {
        console.log(value, inputItem);
        _directive.value.outputs.item.display = value.comment + ' 的项';
    }
}

function optionChange(e: string, inputItem: DirectiveInput) {
    console.log(inputItem.value, '选择的值');
    if (!inputItem.addConfig) {
        return;
    }
    if (inputItem.addConfig.type !== 'select') {
        return;
    }
    console.log(e, '选择的值', inputItem.addConfig.options);

    // 清空其他 有filters 参数的值
    for (const key in _directive.value.inputs) {
        if (Object.prototype.hasOwnProperty.call(_directive.value.inputs, key)) {
            const item = _directive.value.inputs[key];
            if (inputItem !== item) {
                if (item.addConfig.filters) {
                    // item.value = '';
                    // item.display = '';
                }
            }
        }
    }

    inputItem.display = inputItem.addConfig.options?.find((item) => item.value === e)?.label;

    //特殊处理 设置变量指令
    if (_directive.value.name === 'dataProcessing.setVariable') {
        _directive.value.outputs.varName.display = _directive.value.inputs.varType.display;
        let varTypeValue = _directive.value.inputs.varType.value;
        varTypeValue = varTypeValue === 'object' ? varTypeValue : 'textarea';
        _directive.value.inputs.varValue.addConfig.type = varTypeValue;
        if (varTypeValue === 'object') {
            _directive.value.inputs.varValue.type = 'object';
        }else{
            _directive.value.inputs.varValue.type = 'string';
        }
        
    }
    console.log(inputItem.display);
}

function handleFailureStrategy(e: string) {
    if (e === 'retry') {
        _directive.value.intervalTime = _directive.value.intervalTime || 1;
        _directive.value.retryCount = _directive.value.retryCount || 1;
    }
}



function inputItemFilters(directive: DirectiveTree, inputItem: DirectiveInput) {
    if (inputItem.addConfig?.filters) {
        const fun = new Function('return ' + inputItem.addConfig.filters);
        return fun.apply(directive);
    }
    return true;
}

// const curInstance = getCurrentInstance();
// onMounted(() => {
//     console.log('onMounted', curInstance);
// });
</script>

<template>
    <div class="add-directive-container flex flex-col gap-3">
        <div class="directive-header flex justify-between items-center">
            <div class="left flex gap-3">
                <div class="directive-icon">
                    <i class="iconfont text-3xl" :class="_directive.icon"></i>
                </div>
                <div class="directive-info">
                    <div class="directive-name text-gray-950 font-bold">
                        {{ _directive.displayName ?? _directive.name }}
                    </div>
                    <div class="directive-description text-gray-500 text-sm">
                        {{ _directive.description }}
                    </div>
                </div>
            </div>
            <div class="right text-blue-500">使用说明</div>
        </div>
        <div class="directive-body flex flex-col gap-3">
            <div class="group flex gap-2">
                <template v-for="(group, index) in groups">
                    <div class="group-item px-2 cursor-pointer" v-show="index !== 1 || (advancedNum > 0 && index === 1)"
                        :class="[group.active ? 'border-b-2 border-red-600' : '']" @click="groupClick(group)">
                        {{ group.name }}
                    </div>
                </template>
            </div>
            <div class="directive-params-container flex flex-col gap-8" v-show="groups[0].active">
                <div class="directive-params flex flex-col gap-2">
                    <div class="param-title flex items-center gap-4">
                        <div class="text-gray-950 font-bold">指令输入</div>
                        <div class="w-full flex-1 border-b border-gray-400 border-dashed"></div>
                    </div>
                    <div class="param-content flex flex-col gap-2">
                        <div class="param-item flex gap-4 items-center" v-for="inputItem of _directive.inputs"
                            v-if="Object.keys(_directive.inputs).length > 0">
                            <template v-if="inputItem.addConfig &&
                                !inputItem.addConfig.isAdvanced &&
                                inputItemFilters(_directive, inputItem)
                                ">
                                <div class="param-name" :class="{ required: inputItem.addConfig.required }">
                                    {{ inputItem.addConfig.label }}：
                                </div>
                                <div class="param-value flex-1">
                                    <div class="relative" v-if="inputItem.addConfig.type === 'string'">
                                        <InputValueVar @inputValueChange="inputValueChange" v-model="inputItem.value"
                                            :variables="_variables" :inputItem="inputItem">
                                        </InputValueVar>
                                    </div>
                                    <div class="relative" v-if="inputItem.addConfig.type === 'object'">
                                        <InputValueVar @inputValueChange="inputValueChange" v-model="inputItem.value"
                                            :variables="_variables" :inputItem="inputItem">
                                        </InputValueVar>
                                    </div>
                                    <div class="relative" v-if="inputItem.type === 'variable' || inputItem.addConfig.type === 'variable'">
                                        <InputValueVarVariable @inputValueChange="inputValueChange"
                                            v-model="inputItem.value" :variables="_variables" :inputItem="inputItem">
                                        </InputValueVarVariable>
                                    </div>
                                    <div class="relative" v-else-if="inputItem.addConfig.type === 'textarea'">
                                        <InputValueVar @inputValueChange="inputValueChange" v-model="inputItem.value"
                                            :inputItem="inputItem" :variables="_variables">
                                        </InputValueVar>
                                    </div>
                                    <el-select v-else-if="inputItem.addConfig.type === 'select'" v-model="inputItem.value"
                                        placeholder="请选择" @change="optionChange($event, inputItem)" filterable
                                        :multiple="inputItem.addConfig.multiple">
                                        <el-option v-for="option in inputItem.addConfig.options" :key="option.value"
                                            :label="option.label" :value="option.value"></el-option>
                                    </el-select>
                                    <el-checkbox v-if="inputItem.addConfig.type === 'boolean'" v-model="inputItem.value"
                                        :placeholder="inputItem.addConfig.placeholder"></el-checkbox>
                                    <el-input-number v-if="inputItem.addConfig.type === 'number'" v-model="inputItem.value"
                                        :placeholder="inputItem.addConfig.placeholder"></el-input-number>
                                    <div class="relative" v-if="inputItem.addConfig.type === 'filePath'">
                                        <InputValueVar @inputValueChange="inputValueChange" v-model="inputItem.value"
                                            :variables="_variables" :inputItem="inputItem">
                                        </InputValueVar>
                                    </div>
                                </div>
                                <div class="param-desc text-gray-500 text-sm" v-if="inputItem.addConfig.tip">
                                    <ElTooltip :content="inputItem.addConfig.tip">
                                        <i class="iconfont icon-xinxi text-gray-500"></i>
                                    </ElTooltip>
                                </div>
                            </template>
                        </div>
                        <template  v-if="_directive.inputs2">
                            <div class="param-item flex gap-4 items-center" v-for="inputItemArr of _directive.inputs2">
                                <template v-if="inputItemArr">
                                    <div>{{ inputItemArr.name }}:</div>
                                    <div class="flex-1 flex flex-col justify-content gap-2">
                                        <div class="flex gap-2 inputHead">
                                            <div class="flex-1" v-for="headName in inputItemArr.value">
                                                {{ headName.addConfig.label }}
                                            </div>
                                        </div><!-- -->
                                    
                                        <div class="flex gap-2" v-for="(inputItemj,index) in inputItemArr.values">
                                            <template v-for="inputItem in inputItemj">
                                                <template v-if="inputItem.addConfig">
                                                <!--  <div class="param-name" :class="{ required: inputItem.addConfig.required }">
                                                        {{ inputItem.addConfig.label }}：
                                                    </div> -->
                                                    <div class="param-value flex-1">
                                                        <div class="relative" v-if="inputItem.addConfig.type === 'string'">
                                                            <InputValueVar @inputValueChange="inputValueChange" v-model="inputItem.value"
                                                                :variables="_variables" :inputItem="inputItem">
                                                            </InputValueVar>
                                                        </div>
                                                        <div class="relative" v-if="inputItem.addConfig.type === 'object'">
                                                            <InputValueVar @inputValueChange="inputValueChange" v-model="inputItem.value"
                                                                :variables="_variables" :inputItem="inputItem">
                                                            </InputValueVar>
                                                        </div>
                                                        <div class="relative" v-if="inputItem.type === 'variable' || inputItem.addConfig.type === 'variable'">
                                                            <InputValueVarVariable @inputValueChange="inputValueChange"
                                                                v-model="inputItem.value" :variables="_variables" :inputItem="inputItem">
                                                            </InputValueVarVariable>
                                                        </div>
                                                        <div class="relative" v-else-if="inputItem.addConfig.type === 'textarea'">
                                                            <InputValueVar @inputValueChange="inputValueChange" v-model="inputItem.value"
                                                                :inputItem="inputItem" :variables="_variables">
                                                            </InputValueVar>
                                                        </div>
                                                        <el-select v-else-if="inputItem.addConfig.type === 'select'" v-model="inputItem.value"
                                                            placeholder="请选择" @change="optionChange($event, inputItem)" filterable
                                                            :multiple="inputItem.addConfig.multiple">
                                                            <el-option v-for="option in inputItem.addConfig.options" :key="option.value"
                                                                :label="option.label" :value="option.value"></el-option>
                                                        </el-select>
                                                        <el-checkbox v-if="inputItem.addConfig.type === 'boolean'" v-model="inputItem.value"
                                                            :placeholder="inputItem.addConfig.placeholder"></el-checkbox>
                                                        <el-input-number v-if="inputItem.addConfig.type === 'number'" v-model="inputItem.value"
                                                            :placeholder="inputItem.addConfig.placeholder"></el-input-number>
                                                        <div class="relative" v-if="inputItem.addConfig.type === 'filePath'">
                                                            <InputValueVar @inputValueChange="inputValueChange" v-model="inputItem.value"
                                                                :variables="_variables" :inputItem="inputItem">
                                                            </InputValueVar>
                                                        </div>
                                                    </div>
                                                </template>
                                            </template>
                                            <ElButton link type="danger" @click="deleteInputs(inputItemArr,index)">删除</ElButton>
                                        </div>
                                        <ElButton @click="addInput(inputItemArr)">添加选项</ElButton>
                                    </div>
                                </template>
                            </div>
                        </template>
                        
                    </div>
                </div>
                <div class="directive-params viewbox gap-2">
                    <div class="param-title flex items-center gap-4">
                        <div class="text-gray-950 font-bold">指令输出</div>
                        <div class="w-full flex-1 border-b border-gray-400 border-dashed"></div>
                    </div>
                    <div class="param-content viewbox gap-2">
                        <template v-if="Object.keys(_directive.outputs).length > 0">
                            <div class="param-item flex gap-4 items-center" v-if="_directive.outputs"
                                v-for="outputItem of _directive.outputs">
                                <template v-if="outputItem.addConfig">
                                    <div class="param-name">{{ outputItem.addConfig.label }}：</div>
                                    <div class="param-value flex-1">
                                        <!-- <el-input v-if="directiveConfig.outputs[key].type === 'variable'"
                                            v-model="outputItem.name" :placeholder="outputItem.placeholder"></el-input> -->
                                        <OutputValueVar v-if="outputItem.addConfig.type === 'variable'"
                                            :output-item="outputItem" :variables="_variables"></OutputValueVar>
                                    </div>
                                    <div class="param-desc text-gray-500 text-sm" v-if="outputItem.addConfig.tip">
                                        <ElTooltip :content="outputItem.addConfig.tip">
                                            <i class="iconfont icon-xinxi text-gray-500"></i>
                                        </ElTooltip>
                                    </div>
                                </template>
                            </div>
                        </template>

                        <div v-else>没有输出参数</div>
                    </div>
                </div>
            </div>
            <div class="directive-params-container flex flex-col gap-8" v-show="groups[1].active && advancedNum > 0">
                <div class="directive-params flex flex-col gap-2">
                    <div class="param-content flex flex-col gap-2">
                        <div class="param-item flex gap-4 items-center" v-for="inputItem of _directive.inputs"
                            v-if="Object.keys(_directive.inputs).length > 0">
                            <template v-if="inputItem.addConfig && inputItem.addConfig.isAdvanced">
                                <div class="param-name">{{ inputItem.addConfig.label }}：</div>
                                <div class="param-value flex-1">
                                    <div class="relative" v-if="inputItem.addConfig.type === 'string'">
                                        <InputValueVar v-model="inputItem.value" :variables="_variables"
                                            :inputItem="inputItem">
                                        </InputValueVar>
                                    </div>
                                    <div class="relative" v-else-if="inputItem.addConfig.type === 'textarea'">
                                        <InputValueVar v-model="inputItem.value" :inputItem="inputItem"
                                            :variables="_variables">
                                        </InputValueVar>
                                    </div>
                                    <el-select v-else-if="inputItem.addConfig.type === 'select'" v-model="inputItem.value"
                                        placeholder="请选择" @change="optionChange($event, inputItem)">
                                        <el-option v-for="option in inputItem.addConfig.options" :key="option.value"
                                            :label="option.label" :value="option.value"></el-option>
                                    </el-select>
                                    <el-checkbox v-if="inputItem.addConfig.type === 'boolean'" v-model="inputItem.value"
                                        :placeholder="inputItem.addConfig.placeholder"></el-checkbox>
                                    <el-input-number v-if="inputItem.addConfig.type === 'number'" v-model="inputItem.value"
                                        :placeholder="inputItem.addConfig.placeholder"></el-input-number>
                                </div>
                                <div class="param-desc text-gray-500 text-sm" v-if="inputItem.addConfig.tip">
                                    <ElTooltip :content="inputItem.addConfig.tip">
                                        <i class="iconfont icon-xinxi text-gray-500"></i>
                                    </ElTooltip>
                                </div>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
            <div class="directive-params-container flex flex-col gap-8" v-show="groups[2].active">
                <div class="directive-params flex flex-col gap-2">
                    <div class="param-content flex flex-col gap-2">
                        <div class="param-item flex gap-4 items-center">
                            <div class="param-name">失败处理：</div>
                            <div class="param-value flex-1">
                                <el-select v-model="_directive.failureStrategy" @change="handleFailureStrategy">
                                    <el-option label="终止流程" value="terminate"></el-option>
                                    <el-option label="忽略并继续执行" value="ignore"></el-option>
                                    <el-option label="重试此指令" value="retry"></el-option>
                                    <el-option label="往上抛出" value="throw"></el-option>
                                </el-select>
                            </div>
                        </div>
                    </div>
                    <div v-show="_directive.failureStrategy === 'retry'">
                        <div class="param-content flex flex-col gap-2">
                            <div class="param-item flex gap-4 items-center">
                                <div class="param-name">重试间隔：</div>
                                <div class="param-value flex-1">
                                    <el-input-number v-model="_directive.intervalTime" :min="1"
                                        :step="1"></el-input-number>
                                    秒
                                </div>
                            </div>
                            <div class="param-item flex gap-4 items-center">
                                <div class="param-name">重试次数：</div>
                                <div class="param-value flex-1">
                                    <el-input-number v-model="_directive.retryCount" :min="1"
                                        :step="1"></el-input-number>
                                    次
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="directive-footer flex justify-between">
            <div class="remark-title text-gray-950 font-bold">流程备注：</div>
            <div class="remark-input flex-1">
                <ElInput type="textarea" v-model="_directive.remark" placeholder="这边可以写一些备注"></ElInput>
            </div>
        </div>
    </div>
</template>

<style lang="less" scoped>
// 添加样式

.add-directive-container {
    max-height: 70vh;
}

.open {
    .el-select-dropdown {
        display: block !important;
    }
}

.param-name.required {
    position: relative;
    // color: red;

    &:before {
        position: absolute;
        top: 0;
        right: -10px;
        content: '*';
        color: red;
    }
}
</style>
