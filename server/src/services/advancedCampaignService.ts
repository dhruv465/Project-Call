import ScriptTemplate from '../models/ScriptTemplate';
import ABTest from '../models/ABTest';
import Campaign from '../models/Campaign';
import { logger } from '../index';
import { LLMService } from './llmService';

// Initialize LLM service instance
const llmService = new LLMService(process.env.OPENAI_API_KEY || '', process.env.ANTHROPIC_API_KEY);

export interface ScriptGenerationOptions {
  industry: string;
  targetAudience: string;
  campaignGoal: string;
  tone: 'professional' | 'friendly' | 'authoritative' | 'casual';
  language: string;
  complianceRegion: string[];
  customVariables?: { [key: string]: string };
}

export interface ABTestConfig {
  name: string;
  campaignId: string;
  testType: 'script' | 'voice' | 'timing' | 'approach';
  variants: Array<{
    name: string;
    configuration: any;
    trafficAllocation: number;
  }>;
  hypothesis: string;
  successCriteria: {
    primaryMetric: string;
    minimumImprovement: number;
    sampleSize: number;
  };
  duration: {
    startDate: Date;
    endDate: Date;
  };
}

export class AdvancedCampaignService {
  
  // Script Generation
  async generateScript(options: ScriptGenerationOptions): Promise<any> {
    try {
      // Find similar templates for reference
      const similarTemplates = await this.findSimilarTemplates(options);
      
      // Generate script using LLM
      const prompt = this.buildScriptGenerationPrompt(options, similarTemplates);
      const llmResponse = await llmService.generateResponse([
        { role: 'user', content: prompt }
      ], 'auto', { temperature: 0.7, maxTokens: 1500 });
      const generatedScript = llmResponse.text;
      
      // Validate compliance
      const complianceCheck = await this.validateCompliance(generatedScript, options.complianceRegion);
      
      // Parse and structure the generated script
      const structuredScript = this.parseGeneratedScript(generatedScript);
      
      return {
        script: structuredScript,
        compliance: complianceCheck,
        metadata: {
          generatedAt: new Date(),
          options,
          templateInfluences: similarTemplates.map(t => t._id)
        }
      };
    } catch (error) {
      logger.error('Error generating script:', error);
      throw new Error('Script generation failed');
    }
  }

  private async findSimilarTemplates(options: ScriptGenerationOptions) {
    return await ScriptTemplate.find({
      industry: options.industry,
      'compliance.approved': true,
      'compliance.region': { $in: options.complianceRegion }
    })
    .sort({ 'performance.conversionRate': -1 })
    .limit(3);
  }

  private buildScriptGenerationPrompt(options: ScriptGenerationOptions, templates: any[]): string {
    const templateExamples = templates.map(t => `
      Template: ${t.name}
      Opening: ${t.template.opening}
      Presentation: ${t.template.presentation}
      Closing: ${t.template.closing}
    `).join('\n');

    return `
      Generate a ${options.tone} outreach script for the ${options.industry} industry.
      
      Requirements:
      - Target Audience: ${options.targetAudience}
      - Campaign Goal: ${options.campaignGoal}
      - Language: ${options.language}
      - Compliance Region: ${options.complianceRegion.join(', ')}
      
      High-performing templates for reference:
      ${templateExamples}
      
      The script should include:
      1. Opening (30 seconds max)
      2. Presentation (2-3 minutes)
      3. Common objection handling responses
      4. Closing with clear call-to-action
      
      Format as JSON with sections: opening, presentation, objectionHandling, closing, variables
    `;
  }

  private async validateCompliance(script: string, regions: string[]): Promise<any> {
    // Implement compliance checking logic
    const complianceRules = {
      'IN': [ // India
        'Must include opt-out option',
        'Cannot call DND numbers',
        'Must identify caller and purpose',
        'Limited calling hours: 9 AM - 9 PM'
      ],
      'US': [
        'TCPA compliance required',
        'Must provide opt-out mechanism',
        'Cannot use robocalls without consent'
      ],
      'EU': [
        'GDPR compliance required',
        'Must obtain explicit consent',
        'Right to be forgotten must be mentioned'
      ]
    };

    const violations = [];
    for (const region of regions) {
      const rules = complianceRules[region as keyof typeof complianceRules] || [];
      // Check script against rules (simplified)
      // In real implementation, use NLP to detect compliance issues
    }

    return {
      approved: violations.length === 0,
      violations,
      recommendations: this.getComplianceRecommendations(regions)
    };
  }

  private parseGeneratedScript(generatedContent: string): any {
    try {
      // Try to parse as JSON first
      return JSON.parse(generatedContent);
    } catch (error) {
      // If not JSON, parse manually
      return {
        opening: this.extractSection(generatedContent, 'opening'),
        presentation: this.extractSection(generatedContent, 'presentation'),
        objectionHandling: this.extractObjectionHandling(generatedContent),
        closing: this.extractSection(generatedContent, 'closing'),
        variables: {}
      };
    }
  }

  private extractSection(content: string, section: string): string {
    const regex = new RegExp(`${section}:?\\s*([\\s\\S]*?)(?=\\n(?:presentation|objection|closing|$))`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }

  private extractObjectionHandling(content: string): string[] {
    const regex = /objection[s]?:?\s*([\s\S]*?)(?=\n(?:closing|$))/i;
    const match = content.match(regex);
    if (match) {
      return match[1].split('\n').filter(line => line.trim()).map(line => line.trim());
    }
    return [];
  }

  private getComplianceRecommendations(regions: string[]): string[] {
    const recommendations = [];
    if (regions.includes('IN')) {
      recommendations.push('Add DND compliance check', 'Include calling time restrictions');
    }
    if (regions.includes('US')) {
      recommendations.push('Add TCPA compliance statement');
    }
    if (regions.includes('EU')) {
      recommendations.push('Include GDPR consent language');
    }
    return recommendations;
  }

  // Template Management
  async createTemplate(templateData: any, userId: string): Promise<any> {
    try {
      const template = new ScriptTemplate({
        ...templateData,
        createdBy: userId
      });
      
      // Run compliance check
      const complianceCheck = await this.validateCompliance(
        JSON.stringify(templateData.template), 
        templateData.compliance.region
      );
      
      template.compliance.approved = complianceCheck.approved;
      
      return await template.save();
    } catch (error) {
      logger.error('Error creating template:', error);
      throw new Error('Template creation failed');
    }
  }

  async getTemplates(filters: any = {}): Promise<any> {
    return await ScriptTemplate.find(filters)
      .sort({ 'performance.conversionRate': -1 })
      .populate('createdBy', 'name email');
  }

  async updateTemplatePerformance(templateId: string, metrics: any): Promise<any> {
    return await ScriptTemplate.findByIdAndUpdate(
      templateId,
      { $set: { performance: metrics } },
      { new: true }
    );
  }

  // A/B Testing
  async createABTest(config: ABTestConfig, userId: string): Promise<any> {
    try {
      // Validate traffic allocation totals 100%
      const totalAllocation = config.variants.reduce((sum, v) => sum + v.trafficAllocation, 0);
      if (totalAllocation !== 100) {
        throw new Error('Traffic allocation must total 100%');
      }

      const abTest = new ABTest({
        ...config,
        createdBy: userId,
        variants: config.variants.map((variant, index) => ({
          ...variant,
          id: `variant_${index + 1}`,
          metrics: {
            calls: 0,
            conversions: 0,
            conversionRate: 0,
            averageCallDuration: 0,
            customerSatisfactionScore: 0
          }
        }))
      });

      return await abTest.save();
    } catch (error) {
      logger.error('Error creating A/B test:', error);
      throw new Error('A/B test creation failed');
    }
  }

  async updateABTestMetrics(testId: string, variantId: string, metrics: any): Promise<any> {
    try {
      const test = await ABTest.findById(testId);
      if (!test) throw new Error('A/B test not found');

      const variant = test.variants.find(v => v.id === variantId);
      if (!variant) throw new Error('Variant not found');

      // Update metrics
      variant.metrics = { ...variant.metrics, ...metrics };
      variant.metrics.conversionRate = variant.metrics.calls > 0 
        ? (variant.metrics.conversions / variant.metrics.calls) * 100 
        : 0;

      await test.save();

      // Check if test should be concluded
      await this.checkTestCompletion(testId);

      return test;
    } catch (error) {
      logger.error('Error updating A/B test metrics:', error);
      throw new Error('A/B test update failed');
    }
  }

  private async checkTestCompletion(testId: string): Promise<void> {
    const test = await ABTest.findById(testId);
    if (!test || test.status !== 'running') return;

    const totalCalls = test.variants.reduce((sum, v) => sum + v.metrics.calls, 0);
    
    if (totalCalls >= test.successCriteria.sampleSize || new Date() >= test.duration.endDate) {
      // Calculate statistical significance
      const results = this.calculateTestResults(test);
      
      test.results = results;
      test.status = 'completed';
      test.duration.actualEndDate = new Date();
      
      await test.save();
    }
  }

  private calculateTestResults(test: any): any {
    // Simplified statistical analysis
    const variants = test.variants.sort((a, b) => b.metrics.conversionRate - a.metrics.conversionRate);
    const winner = variants[0];
    const control = variants[1];

    const improvement = control.metrics.conversionRate > 0 
      ? ((winner.metrics.conversionRate - control.metrics.conversionRate) / control.metrics.conversionRate) * 100
      : 0;

    const confidence = this.calculateConfidence(winner.metrics, control.metrics);
    
    return {
      winner: winner.id,
      confidence,
      statisticalSignificance: confidence >= test.successCriteria.confidenceLevel,
      insights: [
        `${winner.name} performed ${improvement.toFixed(2)}% better than control`,
        `Achieved ${confidence.toFixed(1)}% confidence level`
      ],
      recommendations: improvement >= test.successCriteria.minimumImprovement
        ? [`Implement ${winner.name} configuration for improved performance`]
        : ['No significant improvement detected. Consider testing different variables.']
    };
  }

  private calculateConfidence(winnerMetrics: any, controlMetrics: any): number {
    // Simplified confidence calculation
    // In a real implementation, use proper statistical tests (Chi-square, Z-test, etc.)
    const winnerRate = winnerMetrics.conversionRate / 100;
    const controlRate = controlMetrics.conversionRate / 100;
    
    if (winnerMetrics.calls < 30 || controlMetrics.calls < 30) return 0;
    
    const pooledRate = (winnerMetrics.conversions + controlMetrics.conversions) / 
                     (winnerMetrics.calls + controlMetrics.calls);
    
    const standardError = Math.sqrt(pooledRate * (1 - pooledRate) * 
                         (1/winnerMetrics.calls + 1/controlMetrics.calls));
    
    if (standardError === 0) return 0;
    
    const zScore = Math.abs(winnerRate - controlRate) / standardError;
    
    // Convert Z-score to confidence (simplified)
    if (zScore >= 2.58) return 99;
    if (zScore >= 1.96) return 95;
    if (zScore >= 1.65) return 90;
    if (zScore >= 1.28) return 80;
    return Math.min(zScore * 50, 75);
  }

  async getABTests(campaignId?: string): Promise<any> {
    const filter = campaignId ? { campaignId } : {};
    return await ABTest.find(filter)
      .populate('campaignId', 'name')
      .sort({ createdAt: -1 });
  }

  async getABTestResults(testId: string): Promise<any> {
    const test = await ABTest.findById(testId).populate('campaignId', 'name');
    if (!test) throw new Error('A/B test not found');
    
    return {
      test,
      analysis: test.status === 'completed' ? test.results : null,
      performance: test.variants.map(v => ({
        variant: v.name,
        metrics: v.metrics,
        trafficAllocation: v.trafficAllocation
      }))
    };
  }
}

export const advancedCampaignService = new AdvancedCampaignService();
