import { Skill, SkillInput, SkillOutput, ToolContext } from '@openclaw/core';

export class GovernmentApprovalSkill extends Skill {
  static metadata = {
    name: 'government.approval',
    version: '1.0.0',
    description: '自动化的政府审批流程处理，支持多种审批类型',
    author: '你的名字',
    tags: ['government', 'approval', 'document', 'compliance'],
    inputSchema: {
      type: 'object',
      required: ['applicant', 'applicationType', 'materials', 'rules'],
      properties: {
        applicant: { type: 'string', description: '申请单位名称' },
        applicationType: {
          type: 'string',
          enum: ['高新技术企业认定', '科技型中小企业认定', '专精特新企业申报', '项目资金申请', '资质证书申请'],
          description: '申请事项类型'
        },
        materials: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              path: { type: 'string' }
            }
          },
          description: '申请材料列表'
        },
        rules: {
          type: 'object',
          description: '审批规则配置',
          properties: {
            minRegisteredCapital: { type: 'number' },
            requireIP: { type: 'boolean' },
            minRDInvestment: { type: 'number' },
            maxDaysSinceEstablishment: { type: 'number' }
          }
        }
      }
    },
    outputSchema: {
      type: 'object',
      required: ['approved', 'reason', 'document'],
      properties: {
        approved: { type: 'boolean', description: '是否通过审批' },
        reason: { type: 'string', description: '审批结果理由' },
        document: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            content: { type: 'string' },
            format: { type: 'string', enum: ['docx', 'pdf', 'html'] }
          }
        },
        nextSteps: { type: 'array', items: { type: 'string' } }
      }
    }
  };

  static dependencies = [
    'file_parser',
    'ocr_engine',
    'llm_judge',
    'doc_generator',
    'knowledge_base'
  ];

  async execute(inputs: SkillInput, context: ToolContext): Promise<SkillOutput> {
    console.log(`[GovernmentApprovalSkill] 开始处理申请: ${inputs.applicant}`);
    
    try {
      const parsedData = await this.parseMaterials(inputs.materials, context);
      const complianceResult = await this.judgeCompliance(
        inputs.applicant, 
        inputs.applicationType, 
        parsedData, 
        inputs.rules, 
        context
      );
      const document = await this.generateDocument(
        inputs.applicant,
        inputs.applicationType,
        complianceResult,
        context
      );
      const nextSteps = this.suggestNextSteps(inputs.applicationType, complianceResult.approved);
      
      return {
        success: true,
        data: {
          approved: complianceResult.approved,
          reason: complianceResult.reason,
          document: document,
          nextSteps: nextSteps,
          _meta: {
            processedAt: new Date().toISOString(),
            skillVersion: this.constructor.metadata.version,
            materialsCount: inputs.materials.length
          }
        }
      };
      
    } catch (error) {
      console.error('[GovernmentApprovalSkill] 执行失败:', error);
      return {
        success: false,
        error: `审批处理失败: ${error.message}`,
        data: null
      };
    }
  }

  private async parseMaterials(materials: any[], context: ToolContext) {
    const results = [];
    
    for (const material of materials) {
      const fileParser = context.getTool('file_parser');
      let content = '';
      
      if (material.path.endsWith('.pdf')) {
        content = await fileParser.parsePDF(material.path);
      } else if (material.path.endsWith('.docx')) {
        content = await fileParser.parseDocx(material.path);
      } else if (['.jpg', '.png', '.jpeg'].some(ext => material.path.endsWith(ext))) {
        const ocr = context.getTool('ocr_engine');
        content = await ocr.extractText(material.path);
      } else {
        content = await fileParser.parseText(material.path);
      }
      
      results.push({
        name: material.name,
        content: content,
        extractedFields: await this.extractKeyFields(material.name, content, context)
      });
    }
    
    return results;
  }

  private async extractKeyFields(materialName: string, content: string, context: ToolContext) {
    const llm = context.getTool('llm_judge');
    const prompt = `
      从以下${materialName}材料中提取关键信息，返回JSON格式：
      ${content.substring(0, 2000)}
      
      请提取：金额、日期、编号、单位名称等
    `;
    
    try {
      const result = await llm.chat(prompt, { responseFormat: 'json' });
      return JSON.parse(result);
    } catch {
      return {};
    }
  }

  private async judgeCompliance(
    applicant: string,
    applicationType: string,
    parsedData: any[],
    rules: any,
    context: ToolContext
  ) {
    const knowledgeBase = context.getTool('knowledge_base');
    const policy = await knowledgeBase.search(applicationType, '政策要求');
    
    const llm = context.getTool('llm_judge');
    const prompt = `
      你是政府审批系统AI助手。请根据以下信息判断申请是否通过：
      
      申请单位：${applicant}
      申请事项：${applicationType}
      相关政策要求：${JSON.stringify(policy)}
      审批规则：${JSON.stringify(rules)}
      材料内容：${JSON.stringify(parsedData.map(p => p.extractedFields))}
      
      判断标准：
      1. 材料是否齐全、真实
      2. 是否满足所有硬性规则（如注册资本、成立时间等）
      3. 是否符合政策导向
      
      请输出JSON格式：
      {
        "approved": true/false,
        "reason": "详细的审批理由",
        "missingMaterials": ["缺失材料列表"],
        "violatedRules": ["违反的规则列表"]
      }
    `;
    
    const result = await llm.chat(prompt, { 
      temperature: 0.1,
      responseFormat: 'json' 
    });
    
    return JSON.parse(result);
  }

  private async generateDocument(
    applicant: string, 
    applicationType: string, 
    complianceResult: any,
    context: ToolContext
  ) {
    const docGenerator = context.getTool('doc_generator');
    if (!docGenerator) {
      throw new Error('doc_generator工具未配置');
    }
    
    const template = this.getDocumentTemplate(applicationType);
    
    const content = template
      .replace('{{applicant}}', applicant)
      .replace('{{date}}', new Date().toLocaleDateString('zh-CN'))
      .replace('{{result}}', complianceResult.approved ? '同意' : '不予同意')
      .replace('{{reason}}', complianceResult.reason);
    
    return {
      title: `关于${applicant}${applicationType}的审批意见`,
      content: content,
      format: 'docx',
      filePath: await docGenerator.createDocx({
        title: `审批意见-${applicant}`,
        content: content
      })
    };
  }

  private suggestNextSteps(applicationType: string, approved: boolean): string[] {
    if (approved) {
      return ['公示期7个工作日', '公示无异议后领取证书', '每年需提交年度报告'];
    } else {
      return ['根据反馈修改申请材料', '30日内可申请复查', '咨询电话：12345'];
    }
  }

  private getDocumentTemplate(applicationType: string): string {
    const templates: Record<string, string> = {
      '高新技术企业认定': `
        无锡市科学技术局
        关于${'{{applicant}}'}高新技术企业认定的批复
        
        经审查，${'{{applicant}}'}提交的高新技术企业认定申请材料齐全，符合《高新技术企业认定管理办法》相关规定。
        
        审批意见：${'{{result}}'}
        理由：${'{{reason}}'}
        
        如对本决定有异议，可自收到本批复之日起60日内向无锡市人民政府申请行政复议。
        
        无锡市科学技术局
        ${'{{date}}'}
      `,
      default: `
        【审批意见】
        申请单位：${'{{applicant}}'}
        申请事项：${'{{applicationType}}'}
        审批结果：${'{{result}}'}
        理由：${'{{reason}}'}
        
        ${'{{date}}'}
      `
    };
    
    return templates[applicationType] || templates.default;
  }
}

export { GovernmentApprovalSkill };
export default GovernmentApprovalSkill;
