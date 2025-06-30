import Modification from '../../modification';
import * as Shift from 'shift-ast';
import { traverse } from '../../helpers/traverse';
import Array from './array';
import TraversalHelper from '../../helpers/traversalHelper';
import Scope, { ScopeType } from '../../scope/scope';

/**
 * 数组解包器类，用于识别和处理字面量数组。
 */
export default class ArrayUnpacker extends Modification {
    // 存储允许的作用域类型（块级作用域、函数体）
    private readonly scopeTypes = new Set(['Block', 'FunctionBody']);
    // 是否需要移除数组
    private readonly shouldRemoveArrays: boolean;
    // 全局作用域对象
    private readonly globalScope: Scope<Array>;
    // 存储所有找到的数组节点
    private readonly arrayNodes: Set<Shift.Node>;

    /**
     * 创建一个新的数组解包修改器。
     * @param ast - AST
     * @param removeArrays - 是否需要移除数组
     */
    constructor(ast: Shift.Script | Shift.Module, removeArrays: boolean) {
        super('Unpack Arrays', ast);
        this.shouldRemoveArrays = removeArrays;
        this.globalScope = new Scope(this.ast, ScopeType.Other);
        this.arrayNodes = new Set<Shift.Node>();
    }

    /**
     * 执行数组解包操作。
     */
    execute(): void {
        while (this.findArrays()) {
            this.unpackArrays();
        }

        if (this.shouldRemoveArrays) {
            this.removeArrays(this.globalScope);
        }
    }

    /**
     * 查找所有的字面量数组，并将它们存储到相应的作用域中。
     * @returns 是否找到了新的字面量数组
     */
    private findArrays(): boolean {
        const self = this;
        let scope = this.globalScope;
        let foundArrays = false;

        traverse(this.ast, {
            enter(node: Shift.Node, parent: Shift.Node) {
                if (self.scopeTypes.has(node.type)) {
                    scope = new Scope(node, ScopeType.Other, scope);
                } else if (self.isLiteralArrayDeclaration(node) && !self.arrayNodes.has(node)) {
                    const name = (node as any).binding.name;
                    const elements = (node as any).init.elements;

                    const array = new Array(node, parent, name, elements);
                    scope.add(name, array);

                    self.arrayNodes.add(node);
                    foundArrays = true;
                }
            },
            leave(node: Shift.Node) {
                if (node == scope.node && scope.parent) {
                    scope = scope.parent;
                }
            }
        });

        return foundArrays;
    }

    /**
     * 替换所有使用字面量数组的地方。
     */
    private unpackArrays(): void {
        const self = this;
        let scope = this.globalScope;

        traverse(this.ast, {
            enter(node: Shift.Node, parent: Shift.Node) {
                if (self.scopeTypes.has(node.type)) {
                    scope = scope.children.get(node) as Scope<Array>;
                } else if (self.isSimpleArrayAccess(node)) {
                    const name = (node as any).object.name;
                    const array = scope.get(name);

                    if (array) {
                        const index = (node as any).expression.value;
                        const replacement = array.elements[index];

                        if (replacement) {
                            array.replaceCount++;
                            TraversalHelper.replaceNode(parent, node, replacement);
                        }
                    }
                }
            },
            leave(node: Shift.Node) {
                if (node == scope.node && scope.parent) {
                    scope = scope.parent;
                }
            }
        });
    }

    /**
     * 移除指定作用域及其子作用域中的数组。
     * @param scope - 要移除数组的作用域
     */
    private removeArrays(scope: Scope<Array>): void {
        for (const [_, array] of scope.elements) {
            if (array.replaceCount > 0) {
                TraversalHelper.removeNode(array.parentNode, array.node);
            }
        }

        for (const [_, child] of scope.children) {
            this.removeArrays(child);
        }
    }

    /**
     * 判断一个节点是否为字面量数组声明。
     * @param node - AST 节点
     * @returns 是否是字面量数组声明
     */
    private isLiteralArrayDeclaration(node: Shift.Node): boolean {
        return (
            node.type == 'VariableDeclarator' &&
            node.binding.type == 'BindingIdentifier' &&
            node.init != null &&
            node.init.type == 'ArrayExpression' &&
            node.init.elements.find(e => e && !e.type.startsWith('Literal')) == undefined
        );
    }

    /**
     * 判断一个节点是否是对数组索引的访问。
     * @param node - AST 节点
     * @returns 是否是对数组索引的访问
     */
    private isSimpleArrayAccess(node: Shift.Node): boolean {
        return (
            node.type == 'ComputedMemberExpression' &&
            node.object.type == 'IdentifierExpression' &&
            node.expression.type == 'LiteralNumericExpression'
        );
    }
}