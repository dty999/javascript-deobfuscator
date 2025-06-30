import { parseModule, parseScript } from 'shift-parser';
import * as Shift from 'shift-ast';
import { codeGen, FormattedCodeGen } from 'shift-codegen';
import Modification from './modification';
import ProxyRemover from './modifications/proxies/proxyRemover';
import ExpressionSimplifier from './modifications/expressions/expressionSimplifier';
import ArrayUnpacker from './modifications/arrays/arrayUnpacker';
import PropertySimplifier from './modifications/properties/propertySimplifier';
import CleanupHelper from './helpers/cleanupHelper';
import Config from './config';
import VariableRenamer from './modifications/renaming/variableRenamer';
import DeadBranchRemover from './modifications/branches/deadBranchRemover';
import StringDecoder from './modifications/expressions/stringDecoder';

// 默认配置项
const defaultConfig: Config = {
    verbose: false, // 是否输出详细日志
    isModule: false, // 是否是模块
    arrays: {
        unpackArrays: true, // 是否解包数组
        removeArrays: true // 是否移除数组
    },
    proxyFunctions: {
        replaceProxyFunctions: true, // 是否替换代理函数
        removeProxyFunctions: true // 是否移除代理函数
    },
    expressions: {
        simplifyExpressions: true, // 是否简化表达式
        removeDeadBranches: true, // 是否移除死分支
        undoStringOperations: true // 是否撤销字符串操作
    },
    miscellaneous: {
        beautify: true, // 是否美化代码
        simplifyProperties: true, // 是否简化属性
        renameHexIdentifiers: false // 是否重命名十六进制标识符
    }
};

/**
 * 反混淆给定的源代码。
 * @param source - 源代码
 * @param parsedConfig - 配置（可选）
 * @returns 反混淆后的代码
 */
export function deobfuscate(source: string, parsedConfig?: Partial<Config>): string {
    // 合并默认配置和传入的配置
    const config = Object.assign({}, defaultConfig, parsedConfig);

    // 解析源代码生成AST
    const ast = (config.isModule ? parseModule(source) : parseScript(source)) as Shift.Script;

    const modifications: Modification[] = [];

    // 添加代理函数移除修改
    if (config.proxyFunctions.replaceProxyFunctions) {
        modifications.push(new ProxyRemover(ast, config.proxyFunctions.removeProxyFunctions));
    }

    // 添加表达式简化修改
    if (config.expressions.simplifyExpressions) {
        modifications.push(new ExpressionSimplifier(ast));
    }

    // 添加数组解包修改
    if (config.arrays.unpackArrays) {
        modifications.push(new ArrayUnpacker(ast, config.arrays.removeArrays));
    }

    // 再次添加表达式简化修改，以简化数组解包后暴露的表达式
    if (config.expressions.simplifyExpressions) {
        modifications.push(new ExpressionSimplifier(ast));
    }

    // 添加移除死分支修改
    if (config.expressions.removeDeadBranches) {
        modifications.push(new DeadBranchRemover(ast));
    }

    // 添加属性简化修改
    if (config.miscellaneous.simplifyProperties) {
        modifications.push(new PropertySimplifier(ast));
    }

    // 添加撤销字符串操作修改
    if (config.expressions.undoStringOperations) {
        modifications.push(new StringDecoder(ast));
    }

    // 添加变量重命名修改
    if (config.miscellaneous.renameHexIdentifiers) {
        modifications.push(new VariableRenamer(ast));
    }

    // 执行所有修改
    for (const modification of modifications) {
        if (config.verbose) {
            console.log(
                `[${new Date().toISOString()}]: 正在执行 ${modification.constructor.name}`
            );
        }
        modification.execute();
    }

    // 清理AST
    CleanupHelper.cleanup(ast);

    // 生成目标代码
    const output = config.miscellaneous.beautify
        ? codeGen(ast, new FormattedCodeGen())
        : codeGen(ast);

    return output;
}