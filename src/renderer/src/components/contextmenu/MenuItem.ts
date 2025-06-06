export default class MenuItem {
    constructor(
        public label: string,
        public icon: string | Object,
        public shortcut: string,
        public onClick: () => void,
        public disabled?: boolean
    ) {}
}
