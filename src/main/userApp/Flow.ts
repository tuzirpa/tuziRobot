import fs from 'fs';
import { DirectiveTree } from './types';
import path, { join } from 'path';
import { convertDirective } from './directiveconvert';
import { IBreakpoint } from './devuserapp/DevNodeJs';

export default class Flow {
    delete() {
        fs.unlinkSync(this.filePath);
        fs.unlinkSync(this.jsFilePath);
    }
    destroy() {
        this.blocks = [];
    }

    blocks: DirectiveTree[] = [];
    static headLinkCount = 9;

    constructor(
        public appDir: string,
        public filePath: string,
        public name: string,
        public aliasName?: string
    ) {
        this.init();
    }

    get breakpoints() {
        const breakpoints: IBreakpoint[] = [];
        this.blocks.forEach((block, index) => {
            const breakpoint = block.breakpoint;
            if (breakpoint) {
                breakpoints.push(this.step2Breakpoint(index));
            }
        });
        return breakpoints;
    }

    get jsFilePath() {
        return join(this.appDir, `${this.name}.js`);
    }

    /**
     * 步骤索引转换成断点行号
     * @param index 步骤的索引
     * @returns 断点行号
     */
    step2Breakpoint(index: number): IBreakpoint {
        return {
            url: `file:///${this.appDir}/${this.name}.js`.replace(/\\/g, '/'),
            line: index + Flow.headLinkCount
        };
    }

    init() {
        //检查文件是否存在
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (fs.existsSync(this.filePath)) {
            //读取文件内容
            let content = fs.readFileSync(this.filePath, {
                encoding: 'utf-8'
            });
            content = content || '{}';
            const contentObj = JSON.parse(content);
            this.blocks = contentObj.blocks || [];
            this.aliasName = contentObj.aliasName || this.name;
        } else {
            this.save();
        }
    }

    get isMainFlow() {
        return this.name.startsWith('main');
    }

    //获取流程所有定义的变量
    getVariables() {
        const variableSet = new Set<string>();

        this.blocks.forEach((block) => {
            // 从指令的 outputs 中提取变量
            if (block.outputs) {
                Object.values(block.outputs).forEach((output) => {
                    if (output.name && typeof output.name === 'string') {
                        variableSet.add(output.name);
                    }
                });
            }
        });

        return Array.from(variableSet);
    }

    /**
     * 转换流程到js文件
     */
    public async convert() {
        let content = ['//流程自动生成'];
        content.push(`let robotUtilAll = require('tuzirobot');`);
        content.push(`let robotUtil = robotUtilAll.default;`);
        content.push(`const generateBlock = robotUtilAll.generateBlock;`);
        content.push(`const fatalError = robotUtilAll.fatalError;`);

        // 添加变量声明
        const variables = this.getVariables();
        if (variables.length > 0) {
            content.push('//变量声明');
            content.push(`let ${variables.join(', ')};`);
        }else{
            content.push('//变量声明');
            content.push(`//无变量`);
        }

        content.push(
            `module.exports = async function (${this.isMainFlow ? '' : '{ _callParams }'}) {`
        );
        content.push(`let _returnVal = [];//流程返回值`);
        let flowControlBlock = 0;
        for (let index = 0; index < this.blocks.length; index++) {
            const block = this.blocks[index];
            let convertCode = await convertDirective(block, index, this);
            convertCode = convertCode.replace(/\n/g, '\\n');
            let indent = '    ';
            if (block.pdLvn) {
                for (let index = 0; index < block.pdLvn * 2; index++) {
                    indent += ' ';
                }
            }
            let jsCode = indent + convertCode;

            if (block.disabled) {
                jsCode = '//' + jsCode;
            } else {
                // continue break 这两个指令只能在循环中使用
                if (block.name === 'flowControl.continue' || block.name === 'flowControl.break') {
                    if (flowControlBlock <= 0) {
                        jsCode = '//' + jsCode;
                    }
                }
            }
            //记录是否在for或while中 循环中
            if (block.isLoop) {
                flowControlBlock++;
            } else if (block.name === 'flowControl.for.end') {
                flowControlBlock--;
            }

            content.push(jsCode);
        }
        content.push(`return { returnVal: _returnVal };`);
        // content.push('  } catch (error) {');
        // content.push(`    fatalError(error,__filename);process.exit(1);`);
        // content.push('  }');
        content.push('};');

        return content.join('\n');
    }

    async save() {
        //保存编辑内容
        fs.writeFileSync(this.filePath, JSON.stringify(this, null, 2), {
            encoding: 'utf-8'
        });
        //转换成js代码
        const content = await this.convert();
        //保存js代码
        fs.writeFileSync(this.jsFilePath, content, {
            encoding: 'utf-8'
        });
    }
}
