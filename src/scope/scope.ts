import * as Shift from 'shift-ast';

/**
 * 作用域类，用于管理变量和子作用域。
 * @typeParam T - 存储在作用域中的元素类型
 */
export default class Scope<T> {
    node: Shift.Node;
    type: ScopeType;
    parent?: Scope<T>;
    children: Map<Shift.Node, Scope<T>>;
    elements: Map<string, T>;

    /**
     * 创建一个新的作用域实例。
     * @param node - 创建作用域的节点
     * @param type - 作用域类型
     * @param parent - 父级作用域（可选）
     */
    constructor(node: Shift.Node, type: ScopeType, parent?: Scope<T>) {
        this.node = node;
        this.type = type;
        this.parent = parent;
        this.children = new Map<Shift.Node, Scope<T>>();
        this.elements = new Map<string, T>();

        if (this.parent) {
            this.parent.children.set(this.node, this);
        }
    }

    /**
     * 根据名称获取元素。
     * @param name - 元素关联的名称
     * @returns 元素或 null
     */
    public get(name: string): T | null {
        if (this.elements.has(name)) {
            return this.elements.get(name) as T;
        }

        return this.parent ? this.parent.get(name) : null;
    }

    /**
     * 添加一个元素到作用域中。
     * @param name - 元素关联的名称
     * @param element - 元素
     * @param type - 变量类型，默认为 'const'
     */
    public add(name: string, element: T, type: VariableType = 'const'): void {
        switch (type) {
            case 'const':
            case 'let': {
                this.elements.set(name, element);
                break;
            }

            case 'var': {
                const scope = this.findScope([ScopeType.Function, ScopeType.Global]);
                if (!scope) {
                    throw new Error(`Failed to find scope for var ${name}`);
                }
                scope.elements.set(name, element);
                break;
            }

            case undefined: {
                const scope = this.findScope([ScopeType.Global]);
                if (!scope) {
                    throw new Error(`Failed to find scope for global var ${name}`);
                }
                scope.elements.set(name, element);
                break;
            }
        }
    }

    /**
     * 获取给定声明类型的变量的作用域。
     * @param type - 声明类型
     * @returns 找到的作用域
     */
    public getDeclarationScope(type: VariableType): Scope<T> {
        switch (type) {
            case 'const':
            case 'let':
                return this;

            case 'var':
            case 'global': {
                const scopeTypes =
                    type === 'var' ? [ScopeType.Function, ScopeType.Global] : [ScopeType.Global];
                const scope = this.findScope(scopeTypes);
                if (!scope) {
                    throw new Error(`Failed to find scope for variable declaration type ${type}`);
                }
                return scope;
            }
        }
    }

    /**
     * 查找指定类型的父作用域。
     * @param types - 需要查找的作用域类型数组
     * @returns 找到的作用域或 undefined
     */
    private findScope(types: ScopeType[]): Scope<T> | undefined {
        let scope: Scope<T> | undefined = this;

        while (scope && !types.includes(scope.type)) {
            scope = scope.parent;
        }

        return scope;
    }
}

// 变量类型定义
export type VariableType = 'var' | 'const' | 'let' | 'global';

// 作用域类型枚举
export enum ScopeType {
    Global = 'Global',
    Function = 'Function',
    Other = 'Other'
}
