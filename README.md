# FunSig - Function Signature Extractor

一个使用 tree-sitter 来生成函数声明列表的工具。

## 功能特点

- 使用 TypeScript 和 Node.js 实现
- 支持多种编程语言（JavaScript, TypeScript, Python 等）
- 可生成函数依赖关系（可选）
- 提供简单的 CLI 接口

## 安装

```bash
# 克隆仓库
git clone https://github.com/yourusername/funsig.git
cd funsig

# 安装依赖
npm install

# 构建项目
npm run build
```

## 使用方法

### 基本用法

```bash
# 扫描当前目录中的所有 JS 和 TS 文件
npm start

# 或者使用 CLI
npx funsig
```

### 高级选项

```bash
# 扫描指定目录
npm start -- --directory /path/to/your/codebase

# 指定文件扩展名
npm start -- --extensions js,ts,jsx,tsx

# 计算函数依赖关系
npm start -- --dependencies

# 将结果输出到文件
npm start -- --output results.json

# 组合使用
npm start -- --directory /path/to/your/codebase --extensions js,ts --dependencies --output results.json
```

## 输出格式

输出的 JSON 格式如下：

```json
[
  {
    "id": 1,
    "functionName": "exampleFunction",
    "lineNo": 200,
    "fileName": "./path/to/file.ts",
    "dependOn": [2, 3]  // 可选，表示该函数依赖的其他函数的 ID
  }
]
```

## 语言支持

本工具支持以下语言：

- JavaScript (.js)
- TypeScript (.ts)
- Python (.py)
- Ruby (.rb)
- Go (.go)
- C (.c, .h)
- C++ (.cpp, .hpp, .cc)
- Java (.java)
- PHP (.php)
- Rust (.rs)

## Testing

The project includes a test suite that verifies the functionality of the parser.

### Running Tests

```bash
# Run all tests
npm test
```

### Test Structure

- `tests/run-tests.ts` - Main test runner
- `tests/parser.test.ts` - Unit tests for the parser module
- `tests/fixtures/` - Sample code files for testing

### Adding New Tests

To add new tests:
1. Add test files to the `tests/fixtures/` directory
2. Create a test module in the `tests/` directory
3. Update the test runner to include your new tests

## 添加新的语言支持

要添加新的语言支持，需要：

1. 安装相应的 tree-sitter 语法包
2. 在 `src/parser.ts` 的 `getLanguageForFile` 函数中添加文件扩展名到语言的映射
3. 在 `extractFunctionDeclarations` 函数中添加该语言特定的函数声明检测

## 注意事项

- 需要为每种语言安装相应的 tree-sitter 语法包
- 依赖分析是基于简单的函数名匹配，可能存在误报

## 许可证

MIT
