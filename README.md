# 政府审批自动化 Skill

[![OpenClaw](https://img.shields.io/badge/OpenClaw-%E5%9C%A8%E7%94%A8-blue)](https://openclaw.ai)
[![License](https://img.shields.io/badge/license-Apache--2.0-green)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-brightgreen)](skill.md)

基于 OpenClaw 的政府审批自动化解决方案，专为中国政务场景设计。

## ✨ 功能特性

- **多场景支持**：高新技术企业认定、科技型中小企业认定、专精特新申报、项目资金申请、资质证书申请
- **国产模型适配**：完美兼容 DeepSeek V3、GLM-5、Kimi K2.5
- **全自动流程**：材料解析 → 合规判断 → 公文生成 → 后续步骤建议
- **等保合规**：支持数据本地化、最小权限原则（需OpenClaw配置）
- **一人公司友好**：部署简单，适合小型团队快速上线

## 📦 安装

### 方式1：ClawHub CLI（推荐）

```bash
# 安装Skill
clawhub skill install government.approval

# 查看已安装的Skill
clawhub skill list
```

### 方式2：手动部署

```bash
# 1. 下载Skill包
git clone https://github.com/yourusername/government-approval-skill.git
cd government-approval-skill

# 2. 安装依赖
npm install

# 3. 编译TypeScript
npm run build

# 4. 配置到OpenClaw（编辑 openclaw.config.yaml）
# 5. 重启OpenClaw服务
```

## 🚀 快速开始

### 1. 配置 OpenClaw 平台

确保你的 OpenClaw 实例已安装并启用了以下工具：
- `file_parser`（文件解析）
- `ocr_engine`（OCR识别）
- `llm_judge`（大模型判断）
- `doc_generator`（公文生成）
- `knowledge_base`（政策知识库，可选）

在 `openclaw.config.yaml` 中添加：

```yaml
skills:
  - name: 'government.approval'
    path: './dist/GovernmentApprovalSkill.js'
    config:
      enabled: true
      maxConcurrent: 5
      timeout: 300000
```

### 2. 执行审批任务

```javascript
const { OpenClawClient } = require('@openclaw/client');

const client = new OpenClawClient({
  endpoint: 'http://localhost:8080'
});

const result = await client.executeSkill('government.approval', {
  applicant: '无锡智云科技有限公司',
  applicationType: '高新技术企业认定',
  materials: [
    {
      name: '营业执照',
      path: '/uploads/business-license.pdf'
    },
    {
      name: '审计报告',
      path: '/uploads/audit-report.pdf'
    }
  ],
  rules: {
    minRegisteredCapital: 1000000,
    requireIP: true,
    minRDInvestment: 500000
  }
});

console.log('审批结果:', result);
```

## 📊 输入输出示例

### 输入参数

```json
{
  "applicant": "无锡智云科技有限公司",
  "applicationType": "高新技术企业认定",
  "materials": [
    {
      "name": "营业执照",
      "path": "/data/营业执照.pdf"
    },
    {
      "name": "审计报告",
      "path": "/data/审计报告.pdf"
    }
  ],
  "rules": {
    "minRegisteredCapital": 1000000,
    "requireIP": true,
    "minRDInvestment": 500000
  }
}
```

### 输出结果

```json
{
  "success": true,
  "data": {
    "approved": true,
    "reason": "符合高新技术企业认定条件：注册资本200万元（达标），拥有3项发明专利，研发投入占比15%。",
    "document": {
      "title": "关于无锡智云科技有限公司高新技术企业认定的批复",
      "content": "无锡市科学技术局\n关于无锡智云科技有限公司高新技术企业认定的批复\n\n经审查，无锡智云科技有限公司提交的高新技术企业认定申请材料齐全，符合《高新技术企业认定管理办法》相关规定。\n\n审批意见：同意\n理由：符合高新技术企业认定条件：注册资本200万元（达标），拥有3项发明专利，研发投入占比15%。\n\n如对本决定有异议，可自收到本批复之日起60日内向无锡市人民政府申请行政复议。\n\n无锡市科学技术局\n2026-03-12",
      "format": "docx",
      "filePath": "/generated/审批意见-无锡智云科技有限公司.docx"
    },
    "nextSteps": [
      "公示期7个工作日",
      "公示无异议后领取证书",
      "每年需提交年度报告"
    ],
    "_meta": {
      "processedAt": "2026-03-12T12:30:00.000Z",
      "skillVersion": "1.0.0",
      "materialsCount": 2
    }
  }
}
```

## 🔧 依赖工具说明

| 工具名 | 说明 | 必需 | 配置建议 |
|--------|------|------|----------|
| `file_parser` | 文件解析（PDF/Docx/Txt） | ✅ | 支持最大10MB文件 |
| `ocr_engine` | OCR识别（图片材料） | ✅ | 推荐PaddleOCR中文模型 |
| `llm_judge` | 大模型判断 | ✅ | DeepSeek V3（temperature=0.1） |
| `doc_generator` | 公文生成（Docx/PDF） | ✅ | 使用官方公文模板 |
| `knowledge_base` | 政策知识库检索 | 可选 | 向量存储政策文件 |

## 🏢 适用场景

- **政务服务中心**：企业资质审批自动化
- **高新区管委会**：科技项目申报初审
- **代办服务机构**：批量处理企业申请
- **企业内部**：政策补贴资格预审

## 📈 性能指标

| 指标 | 数值 | 说明 |
|------|------|------|
| 平均响应时间 | 30秒 | 取决于材料大小和数量 |
| 并发能力 | 5-10 任务/分钟 | 建议配置GPU加速 |
| 准确率 | >95% | 基于测试数据集（100份样本） |
| 支持文件格式 | PDF, Docx, JPG, PNG, Txt |  |

## 🛠️ 开发与测试

```bash
# 安装依赖
npm install

# 运行单元测试
npm test

# 编译TypeScript
npm run build

# 本地预览（需要OpenClaw实例）
clawhub skill preview .
```

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目基于 Apache License 2.0 开源协议。详见 [LICENSE](LICENSE) 文件。

## 🔗 相关链接

- [OpenClaw 官网](https://openclaw.ai)
- [ClawHub Skill 市场](https://clawhub.com/skills)
- [无锡高新区 OpenClaw 政策](https://www.wuxi.gov.cn)

---

**注意**：本 Skill 仅用于辅助审批，最终审批决定应由人工确认。使用前请确保符合当地法律法规。
