import { DirectiveTree, Block } from '../../../types';

export const directive: DirectiveTree = {
    name: 'web.openBarClose',
    sort: 2,
    displayName: '关闭浏览器',
    icon: 'icon-web-create',
    isControl: false,
    isControlEnd: false,
    comment: '关闭浏览器：${closeBrowser}',
    inputs: {
        closeBrowser: {
            name: 'closeBrowser',
            value: '',
            display: '',
            type: 'string',
            // errorHadnler: 'error',
            addConfig: {
                label: '选择要关闭的浏览器',
                type: 'variable',
                filtersType: 'sq.chrome',
                autoComplete: true
            }
        }
    },
    outputs: {},

    async toCode(directive: DirectiveTree, block: string) {
        return `await robotUtil.web.closeBrowser(${directive.inputs.closeBrowser.value},${block});`;
    }
};

export default directive;
