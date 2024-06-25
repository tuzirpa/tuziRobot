import { DirectiveTree } from '../../../types';

export const directive: DirectiveTree = {
    name: 'flowControl.continue',
    displayName: '继续下一次循环',
    icon: 'icon-web-create',
    isControl: false,
    sort: 32,
    isControlEnd: false,
    comment: '忽略本次循环，继续下一次循环',
    inputs: {},
    outputs: {},
    async toCode(_directive: DirectiveTree, _block: string) {
        return `continue;`;
    }
};

export default directive;
