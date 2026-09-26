// 模拟常见动态 commitlint 配置：静态解析不可行，命令文本约定模型按字面量遵守
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'header-max-length': [2, 'always', 88],
  },
};
