type UserApp = {
    name: string;
    id: string;
    description: string;
    version: string;
    author: string;
    flows: {
        appDir: string;
        filePath: string;
        name: string;
        aliasName?: string;
    }[];
};

/**
 * 元素库
 */
export interface ElementLibrary {
    /**
     * 生成id
     */
    id: string;
    /**
     * 名称
     */
    name: string;
    /**
     * 预览图路径
     */
    previewPath: string;
    /**
     * 描述
     */
    description?: string;
    /**
     * css选择器
     */
    cssSelector: string;
    /**
     * xpath
     */
    xPath: string;

    /**
     * 最后一次验证类型
     */
    lastVerifyType?: 'css' | 'xpath';

    /**
     * 是否激活
     */
    active?: boolean;
}

export type FlowError = {
    flowName: string;
    flowAliasName?: string;
    line: number;
    message: string;
    messageObject: any;
    ruleId: string | null;
    errorLevel: 'error' | 'warning';
};

export type LogMessage = {
    level: LogLevel;
    time: number;
    message: string;
    data?: Block;
    error?: Error;
};

export type DataType =
    | 'string'
    | 'number'
    | 'boolean'
    | 'textarea'
    | 'array'
    | 'variable'
    | 'object';

export interface AppVariable {
    /**
     * 变量名称
     */
    name: string;
    /**
     * 变量类型
     */
    type: string;
    /**
     * value值
     */
    value?: any;

    /**
     * 变量描述
     */
    display?: string;

    /**
     * 输出类型详情
     */
    typeDetails?: OutputTypeDetails[];
}

export interface FlowVariable extends AppVariable {
    /**
     * 是否在当前指令之后
     */
    before: boolean;
}

export type AddConfigInputType =
    | 'string'
    | 'number'
    | 'boolean'
    | 'select'
    | 'checkbox'
    | 'textarea'
    | 'filePath'
    | 'object'
    | 'variable';

export type AddConfigOnputType = 'variable';

export interface AddConfig<T> {
    /**
     * 输入标签
     */
    label: string;
    /**
     * 是否必填
     */
    required?: boolean;
    /**
     * 是否为高级配置
     */
    isAdvanced?: boolean;

    /**
     * 添加配置类型
     */
    type: T;

    /**
     * type 为 filePath 时 打开文件选择器是否选择目录
     */
    openDirectory?: boolean;

    /**
     * type 为 filePath 时 打开文件选择器时可选的文件后缀名
     */
    extensions?: string[];

    /**
     * 类型过滤 警告用户输入的类型不符合要求 不做强制
     */
    filtersType?: string;

    /**
     * 自动补全 从上下文中 过滤出符合 filtersType 出来的第一个值进行自动补全
     */
    autoComplete?: true;

    /**
     * type为select时，选项列表
     */
    options?: {
        label: string;
        value: string;
    }[];
    /**
     * 如果options为空是，则可以通过此方法获取
     * @returns 选项列表
     */
    getOptions?:
        | string
        | ((
              directive: DirectiveTree,
              appInfo: UserApp,
              getOptionUtils: { getUserApps: () => Promise<UserApp[]> }
          ) =>
              | {
                    label: string;
                    value: string;
                }[]
              | Promise<
                    {
                        label: string;
                        value: string;
                    }[]
                >);
    /**
     * 是否多选
     * type为select时生效
     */
    multiple?: boolean;
    /**
     * 输入提示
     */
    placeholder?: string;
    /**
     * 输入提示
     */
    tip?: string;

    /**
     * 输入默认值
     * 多选时此字段无效
     */
    defaultValue?: any;

    /**
     * 选项显示表达式
     */
    filters?: string;

    /**
     * 输入限制
     */
    limit?: {
        [key: string]: any;
    };
    /**
     * 是否支持元素库
     */
    elementLibrarySupport?: boolean;
}

/**
 * 指令输入对象
 */
export interface DirectiveInput {
    /**
     * 输入字段名称
     */
    name?: string;
    /**
     * 输入值
     */
    value: any;
    /**
     * 描述显示的值 (可选) 不填则显示value
     */
    display?: string;
    /**
     * 对应变量类型的描述
     */
    typeDisplay?: string;

    /**
     * 输入类型
     */
    type: DataType;

    /**
     * 是否启用表达式
     */
    enableExpression?: boolean;

    /**
     * 添加字段配置，配置添加弹窗的样式
     */
    addConfig: AddConfig<AddConfigInputType>;
}

export interface DirectiveOutput {
    /**
     * 输入字段名称
     */
    name: string;
    /**
     * 描述显示的值 (可选) 不填则显示value
     */
    display?: string;

    /**
     * 输出类型
     */
    type: string;

    /**
     * 输出类型详情
     */
    typeDetails?: OutputTypeDetails[];

    addConfig?: AddConfig<AddConfigOnputType>;
}

/**
 * 输出类型详情
 */
export interface OutputTypeDetails {
    /**
     * 输出类型详情名称
     */
    key: string;
    /**
     * 输出类型
     */
    type: string;
    /**
     * 输出类型显示名称
     */
    display: string;

    typeDetails?: OutputTypeDetails[];
}

/**
 * 指令树
 */
export interface DirectiveTree {
    /**
     * 指令排序
     */
    sort?: number;
    /**
     * 显示名称空 直接显示name
     */
    displayName?: string;

    /**
     * 指令描述
     */
    description?: string;

    /**
     * 备注 可以给指令添加备注
     */
    remark?: string;

    /**
     * name 指令名称 需要全局唯一
     */
    name: string;

    /**
     * 指令name 的别名
     */
    key?: string;

    /**
     * 指令描述 支持变量占位符
     */
    comment?: string;

    /**
     * 是否流程控制指令 （if, for, while, switch）
     */
    isControl?: boolean;

    /**
     * 是否循环指令 （for, while ,...)
     */
    isLoop?: boolean;

    /**
     * 是否流程控制指令 （else）
     */
    isElse?: boolean;

    /**
     * 是否流程控制指令结束 （if, for, while, switch）
     */
    isControlEnd?: boolean;

    /**
     * 图标
     */
    icon?: string;
    /**
     * 指令输入
     */
    inputs: {
        [key: string]: DirectiveInput;
    };
    /**
     * 指令输出
     */
    outputs: {
        [key: string]: DirectiveOutput;
    };

    children?: DirectiveTree[];

    open?: boolean;
    hide?: boolean;
    pdLvn?: number;
    isFold?: boolean;
    id?: string;

    /**
     * 是否禁用
     */
    disabled?: boolean;

    breakpoint?: boolean;

    /**
     * 失败策略    terminate: 终止流程   ignore: 忽略错误   retry: 重试流程
     */
    failureStrategy?: 'terminate' | 'ignore' | 'retry';
    /**
     * retry时 重试间隔时间
     */
    intervalTime?: number;
    /**
     * retry时 重试次数
     */
    retryCount?: number;

    toCode?: (directive: DirectiveTree, block: string) => Promise<string>;
}

export interface Block {
    blockLine: number;
    flowName: string;
    directiveName: string;
    directiveDisplayName: string;
    failureStrategy: 'terminate' | 'ignore' | 'retry';
    intervalTime: number;
    retryCount: number;
}

export type LogLevel = 'info' | 'warn' | 'debug' | 'error' | 'fatalError';
