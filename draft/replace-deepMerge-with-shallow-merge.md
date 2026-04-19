# Replace deepMerge with Shallow Merge

## Background

- 当前使用 `deepMerge` 处理所有配置合并，它会递归合并 plain object 类型的字段
- `AdapterConfig` 的显式字段几乎都是标量/函数/数组 — 对这些类型 deepMerge 本身就是直接覆盖，和 shallow merge 行为一致
- `extraBody` 和 `extraHeaders` 是 `Record` 类型，deepMerge 会递归合并它们的内部字段

### Why Replace

- **顶层字段心智模型应该简单**：后设置的配置覆盖前面的，不需要递归
- **但 `extraBody`/`extraHeaders` 语义特殊**：它们是"额外补充"字段，各层级设置的值应该**叠加**而非覆盖
  - global 设了 `extraHeaders: { 'X-App': 'test' }`，call 设了 `extraHeaders: { 'X-Req': 'call' }`，用户期望两个 header 都出现
  - 如果顶层 shallow merge，call-level 的 `extraHeaders` 会丢掉 global 的
- **所以采用混合策略**：顶层 shallow + `extraBody`/`extraHeaders` 内部字段合并

---

## Merge Strategy

### 规则

- **顶层字段**：shallow merge，后值覆盖前值
  - 标量（`timeout`、`temperature`、`model` 等）— 直接覆盖
  - 数组（`model`、`messages`）— 整体替换
  - 函数（`onFallback`、动态 `apiKey`/`apiBase`/`apiPath`）— 直接覆盖
  - 特殊对象（`AbortSignal`）— 直接覆盖
  - 嵌套 plain object（非 `extraBody`/`extraHeaders`）— 整体替换，不递归

- **`extraBody`/`extraHeaders` 内部字段**：跨层级合并
  - 各层级（global / API-level / call-level）设置的 key-value 都保留
  - 同名 key：后层级的值覆盖前层级的值
  - 仅合并一层，不递归到 `extraBody` 内部的嵌套对象

### 与当前行为的差异

- **当前 deepMerge**：对所有 plain object 字段都递归合并（包括未知的用户自定义字段）
- **新策略**：只对 `extraBody` 和 `extraHeaders` 做一层合并，其他 object 字段全部顶层替换
- 实际效果：对 `AdapterConfig` 已声明的字段来说，行为**几乎不变**；变化在于不再对任意嵌套对象递归合并

---

## Scope

### 需要修改的范围

- 配置合并函数所在模块（`config.ts`）— 替换实现
- Adapter 主模块（`adapter.ts`）— 更新函数引用
- 模块导出入口（`core/index.ts`、`index.ts`）— 更新 export 名称
- 配置合并的单元测试 — 移除通用递归合并测试，新增混合策略测试
- Adapter 集成测试 — 确认现有 extraBody/extraHeaders 三级合并测试仍然通过

### 不需要修改的范围

- Provider 包（`packages/providers/*`）— 不使用 `deepMerge`
- 类型定义（`types/*`）— `AdapterConfig` 接口不变
- `createContext()` 中的 extraBody/extraHeaders 注入逻辑 — 保持不变
- 与配置合并无关的其他测试文件

---

## Implementation Rules

### Naming

- 新函数名：`mergeConfig`（替代 `deepMerge`）
- 删除 `isPlainObject` 辅助函数 — 不再做通用递归合并
- 所有 import/export 引用同步更新

### mergeConfig 语义

- **函数签名不变**：接受多个 `Partial<AdapterConfig> | undefined` 参数
- **顶层 shallow merge**：后一个 source 的顶层 key 直接覆盖前一个 source 的同名 key
- **`extraBody`/`extraHeaders` 特殊处理**：这两字段的内部 key-value 跨层级合并（同名 key 后值覆盖）
- **跳过 null/undefined source**：保持当前行为
- **不修改 source 对象**：始终返回新对象
- **`extraBody`/`extraHeaders` 合并仅一层**：不递归到其内部的嵌套对象

### 行为对照表

| 字段类型 | 当前 deepMerge | 新 mergeConfig |
|---------|---------------|----------------|
| 标量字段（timeout 等） | 后值覆盖 | 后值覆盖（不变） |
| 数组字段（model, messages） | 整体替换 | 整体替换（不变） |
| 函数字段（onFallback 等） | 后值覆盖 | 后值覆盖（不变） |
| `extraBody` 内部字段 | 递归合并 | **一层合并**（行为基本不变） |
| `extraHeaders` 内部字段 | 递归合并 | **一层合并**（行为基本不变） |
| 其他未知嵌套对象 | 递归合并 | **整体替换**（行为变化） |

### 对 configure() 方法的影响

- 多次 `configure()` 传入不同 key — 行为不变
- 多次 `configure()` 传入 `extraBody`/`extraHeaders` — 内部字段合并，行为不变
- 多次 `configure()` 传入其他 object 类型字段 — 后者整体替换前者

---

## Test Strategy

### 需要移除的测试

- `isPlainObject` 相关测试组 — 整组移除
- 验证任意嵌套对象递归合并的测试（非 extraBody/extraHeaders）
- 验证深层嵌套（多层递归）合并的测试
- 验证 frozen/sealed 对象递归合并的测试
- 验证循环引用处理的测试

### 需要保留的测试

- 扁平对象合并（后值覆盖前值）
- 三级/四级配置合并优先级
- undefined/null source 跳过
- 数组整体替换
- 函数直接覆盖
- 不修改 source 对象
- null 值覆盖
- 单 source 返回浅拷贝
- 空 source 处理
- 特殊数值（NaN、Infinity、BigInt）
- 性能和内存测试
- `extraBody`/`extraHeaders` 多层级合并测试 — **保留**，验证内部字段跨层级合并

### 需要新增的测试

- 验证顶层 object 字段被整体替换（不递归合并）
- 验证 `extraBody` 内部字段跨层级合并、同名 key 后值覆盖
- 验证 `extraHeaders` 内部字段跨层级合并、同名 key 后值覆盖
- 验证 `extraBody`/`extraHeaders` 合并仅一层，不递归到嵌套对象内部

### 需要更新的测试

- "deep merges global config on multiple calls" — 移除 "deep" 字眼，测试内容不变
- "extraBody and extraHeaders support three-level merge" — 行为不变，测试应继续通过，确认即可
- 其他包含嵌套 object 合并断言的测试 — 更新为整体替换预期

---

## Execution Order

1. 替换 `config.ts` 中的 `deepMerge` 为 `mergeConfig`，实现混合策略
2. 更新 `adapter.ts` 中的函数引用
3. 更新 `core/index.ts` 和 `index.ts` 的 export
4. 更新 `config.test.ts` — 移除通用递归测试，新增混合策略测试
5. 更新 `adapter.test.ts` — 确认/修复受影响的测试
6. 运行全量测试验证
7. 添加 changeset 记录此行为变更
