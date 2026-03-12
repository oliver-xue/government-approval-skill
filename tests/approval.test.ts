import { SkillTestHarness } from '@openclaw/testkit';
import GovernmentApprovalSkill from '../src/GovernmentApprovalSkill';

describe('GovernmentApprovalSkill', () => {
  let harness: SkillTestHarness;

  beforeAll(async () => {
    harness = new SkillTestHarness(GovernmentApprovalSkill);
    await harness.setup();
  });

  afterAll(async () => {
    await harness.teardown();
  });

  describe('输入验证', () => {
    test('应该拒绝缺少applicant的输入', async () => {
      const inputs = {
        applicationType: '高新技术企业认定',
        materials: [],
        rules: {}
      };

      const result = await harness.execute(inputs);
      expect(result.success).toBe(false);
      expect(result.error).toContain('applicant');
    });

    test('应该拒绝无效的applicationType', async () => {
      const inputs = {
        applicant: '测试公司',
        applicationType: '无效类型',
        materials: [],
        rules: {}
      };

      const result = await harness.execute(inputs);
      expect(result.success).toBe(false);
    });
  });

  describe('业务逻辑', () => {
    test('应该正确审批符合条件的申请', async () => {
      const inputs = {
        applicant: '无锡智云科技有限公司',
        applicationType: '高新技术企业认定',
        materials: [
          { name: '营业执照', path: '/test/营业执照.pdf' },
          { name: '审计报告', path: '/test/审计报告.pdf' }
        ],
        rules: {
          minRegisteredCapital: 1000000,
          requireIP: true
        }
      };

      harness.mockTool('file_parser', {
        parsePDF: async (path: string) => {
          if (path.includes('营业执照')) {
            return JSON.stringify({
              company: '无锡智云科技有限公司',
              capital: 2000000,
              date: '2024-01-01'
            });
          }
          return '{"company": "无锡智云科技有限公司", "revenue": 5000000, "rdInvestment": 800000}';
        },
        parseDocx: async (path: string) => '{"content": "审计报告内容"}',
        parseText: async (path: string) => '文本内容'
      });

      harness.mockTool('ocr_engine', {
        extractText: async (path: string) => '{"company": "无锡智云科技有限公司"}'
      });

      harness.mockTool('llm_judge', {
        chat: async (prompt: string, options?: any) => {
          expect(prompt).toContain('无锡智云科技有限公司');
          expect(prompt).toContain('高新技术企业认定');

          return JSON.stringify({
            approved: true,
            reason: '符合高新技术企业认定条件：注册资本200万元（达标），拥有3项发明专利，研发投入占比15%。',
            missingMaterials: [],
            violatedRules: []
          });
        }
      });

      harness.mockTool('knowledge_base', {
        search: async (type: string, query: string) => {
          return {
            requirements: '注册资本≥100万，拥有发明专利，研发投入占比≥5%',
            duration: '认定后有效期三年'
          };
        }
      });

      harness.mockTool('doc_generator', {
        createDocx: async (params: any) => {
          expect(params.title).toContain('无锡智云科技有限公司');
          expect(params.content).toContain('同意');
          return `/generated/${params.title}.docx`;
        }
      });

      const result = await harness.execute(inputs);

      expect(result.success).toBe(true);
      expect(result.data?.approved).toBe(true);
      expect(result.data?.reason).toContain('符合');
      expect(result.data?.document.title).toContain('批复');
      expect(result.data?.document.format).toBe('docx');
      expect(result.data?.nextSteps).toContain('公示期7个工作日');
      expect(result.data?._meta).toBeDefined();
      expect(result.data?._meta.skillVersion).toBe('1.0.0');
    });

    test('应该拒绝注册资本不足的申请', async () => {
      const inputs = {
        applicant: '不合格公司',
        applicationType: '高新技术企业认定',
        materials: [
          { name: '营业执照', path: '/test/营业执照.pdf' }
        ],
        rules: {
          minRegisteredCapital: 1000000,
          requireIP: true
        }
      };

      harness.mockTool('file_parser', {
        parsePDF: async () => JSON.stringify({
          company: '不合格公司',
          capital: 500000
        })
      });

      harness.mockTool('llm_judge', {
        chat: async () => JSON.stringify({
          approved: false,
          reason: '注册资本不足100万元',
          missingMaterials: [],
          violatedRules: ['minRegisteredCapital']
        })
      });

      const result = await harness.execute(inputs);

      expect(result.data?.approved).toBe(false);
      expect(result.data?.reason).toContain('不足');
      expect(result.data?.document).toBeUndefined();
    });

    test('应该处理材料缺失的情况', async () => {
      const inputs = {
        applicant: '缺材料公司',
        applicationType: '高新技术企业认定',
        materials: [
          { name: '营业执照', path: '/test/营业执照.pdf' }
        ],
        rules: {
          minRegisteredCapital: 1000000,
          requireIP: true
        }
      };

      harness.mockTool('file_parser', {
        parsePDF: async () => JSON.stringify({ company: '缺材料公司', capital: 2000000 })
      });

      harness.mockTool('llm_judge', {
        chat: async () => JSON.stringify({
          approved: false,
          reason: '缺少必要的审计报告和知识产权证明材料',
          missingMaterials: ['审计报告', '知识产权证书'],
          violatedRules: []
        })
      });

      const result = await harness.execute(inputs);

      expect(result.data?.approved).toBe(false);
      expect(result.data?.reason).toContain('缺少');
      expect(result.data?.reason).toContain('审计报告');
    });

    test('应该处理工具调用失败的情况', async () => {
      const inputs = {
        applicant: '测试公司',
        applicationType: '高新技术企业认定',
        materials: [{ name: '营业执照', path: '/test/ nonexistent.pdf' }],
        rules: {}
      };

      harness.mockTool('file_parser', {
        parsePDF: async () => {
          throw new Error('文件不存在或格式错误');
        }
      });

      const result = await harness.execute(inputs);

      expect(result.success).toBe(false);
      expect(result.error).toContain('失败');
    });
  });

  describe('边界条件', () => {
    test('应该处理空材料列表', async () => {
      const inputs = {
        applicant: '测试公司',
        applicationType: '项目资金申请',
        materials: [],
        rules: {}
      };

      const result = await harness.execute(inputs);
      expect(result.success).toBe(false);
    });

    test('应该处理超大文件（截断）', async () => {
      const hugeContent = 'a'.repeat(1000000);
      const inputs = {
        applicant: '测试公司',
        applicationType: '高新技术企业认定',
        materials: [{ name: '大文件', path: '/test/huge.pdf' }],
        rules: {}
      };

      harness.mockTool('file_parser', {
        parsePDF: async () => hugeContent
      });

      const result = await harness.execute(inputs);
      expect(result).toBeDefined();
    });
  });
});
