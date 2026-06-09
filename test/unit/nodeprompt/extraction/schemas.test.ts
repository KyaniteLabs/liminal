import { describe, it, expect } from 'vitest';
import {
  NODE_TYPES,
  EDGE_RELATIONS,
  ExtractedNodeSchema,
  ExtractedEdgeSchema,
  ExtractionResultSchema,
  ThemeNodeSchema,
  ConceptNodeSchema,
  DetailNodeSchema,
  CrossLinkSchema,
  CrossLinkResultSchema,
  ScaffoldNodeSchema,
  FillNodeSchema,
  PatchNodeSchema,
  buildHierarchicalTool,
  EXTRACTION_TOOL,
  SCAFFOLD_TOOL,
  FILL_TOOL,
  VALIDATE_TOOL,
} from '../../../../src/nodeprompt/extraction/schemas.js';
import type { ExtractionConfig } from '../../../../src/nodeprompt/types/index.js';

describe('nodeprompt extraction schemas', () => {
  describe('constants', () => {
    it('exports valid node types', () => {
      expect(NODE_TYPES).toContain('concept');
      expect(NODE_TYPES).toContain('mood');
      expect(NODE_TYPES.length).toBeGreaterThan(0);
    });

    it('exports valid edge relations', () => {
      expect(EDGE_RELATIONS).toContain('causal');
      expect(EDGE_RELATIONS).toContain('cross-link');
      expect(EDGE_RELATIONS.length).toBeGreaterThan(0);
    });
  });

  describe('ExtractedNodeSchema', () => {
    it('validates a correct node', () => {
      const result = ExtractedNodeSchema.safeParse({
        id: 'n1',
        label: 'Test',
        type: 'concept',
        weight: 0.5,
        description: 'A test concept',
        depth: 0,
        parentId: null,
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid node type', () => {
      const result = ExtractedNodeSchema.safeParse({
        id: 'n1',
        label: 'Test',
        type: 'invalid-type',
        weight: 0.5,
        description: 'A test concept',
        depth: 0,
        parentId: null,
      });
      expect(result.success).toBe(false);
    });

    it('rejects weight above 1', () => {
      const result = ExtractedNodeSchema.safeParse({
        id: 'n1',
        label: 'Test',
        type: 'concept',
        weight: 1.5,
        description: 'A test concept',
        depth: 0,
        parentId: null,
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative weight', () => {
      const result = ExtractedNodeSchema.safeParse({
        id: 'n1',
        label: 'Test',
        type: 'concept',
        weight: -0.1,
        description: 'A test concept',
        depth: 0,
        parentId: null,
      });
      expect(result.success).toBe(false);
    });

    it('accepts node with parentId string', () => {
      const result = ExtractedNodeSchema.safeParse({
        id: 'n2',
        label: 'Child',
        type: 'nuance',
        weight: 0.3,
        description: 'A child node',
        depth: 1,
        parentId: 'n1',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('ExtractedEdgeSchema', () => {
    it('validates a correct edge', () => {
      const result = ExtractedEdgeSchema.safeParse({
        id: 'e1',
        sourceId: 'n1',
        targetId: 'n2',
        relation: 'causal',
        strength: 0.8,
        isHierarchical: false,
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid relation', () => {
      const result = ExtractedEdgeSchema.safeParse({
        id: 'e1',
        sourceId: 'n1',
        targetId: 'n2',
        relation: 'invalid',
        strength: 0.8,
        isHierarchical: false,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ExtractionResultSchema', () => {
    it('validates a complete extraction result', () => {
      const result = ExtractionResultSchema.safeParse({
        nodes: [{ id: 'n1', label: 'A', type: 'concept', weight: 0.5, description: 'test', depth: 0, parentId: null }],
        edges: [{ id: 'e1', sourceId: 'n1', targetId: 'n1', relation: 'parallel', strength: 0.5, isHierarchical: false }],
        summary: 'Test extraction',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('ThemeNodeSchema', () => {
    it('validates a theme node (depth 0, parentId null)', () => {
      const result = ThemeNodeSchema.safeParse({
        id: 't1', label: 'Theme', type: 'philosophy', weight: 0.9, description: 'A theme', depth: 0, parentId: null,
      });
      expect(result.success).toBe(true);
    });

    it('rejects non-zero depth', () => {
      const result = ThemeNodeSchema.safeParse({
        id: 't1', label: 'Theme', type: 'philosophy', weight: 0.9, description: 'A theme', depth: 1, parentId: null,
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-null parentId', () => {
      const result = ThemeNodeSchema.safeParse({
        id: 't1', label: 'Theme', type: 'philosophy', weight: 0.9, description: 'A theme', depth: 0, parentId: 'other',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('ConceptNodeSchema', () => {
    it('validates a concept node (depth 1-2, parentId string)', () => {
      const result = ConceptNodeSchema.safeParse({
        id: 'c1', label: 'Concept', type: 'nuance', weight: 0.7, description: 'A concept', depth: 1, parentId: 't1',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('CrossLinkResultSchema', () => {
    it('validates a cross-link result', () => {
      const result = CrossLinkResultSchema.safeParse({
        crossLinks: [{ id: 'cl1', sourceId: 'n1', targetId: 'n2', relation: 'cross-link', strength: 0.6, rationale: 'test link' }],
        summary: 'Test cross-links',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('PatchNodeSchema', () => {
    it('validates a patch with remove=true', () => {
      const result = PatchNodeSchema.safeParse({
        id: 'n1', label: 'Updated', description: 'Updated desc', remove: true,
      });
      expect(result.success).toBe(true);
    });

    it('provides defaults for optional fields', () => {
      const result = PatchNodeSchema.safeParse({
        id: 'n1', label: 'Updated', description: 'Updated desc',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.remove).toBe(false);
      }
    });
  });

  describe('tool definitions', () => {
    it('EXTRACTION_TOOL has correct structure', () => {
      expect(EXTRACTION_TOOL.name).toBe('extract_concept_graph');
      expect(EXTRACTION_TOOL.input_schema.required).toContain('nodes');
      expect(EXTRACTION_TOOL.input_schema.required).toContain('edges');
      expect(EXTRACTION_TOOL.input_schema.required).toContain('summary');
    });

    it('SCAFFOLD_TOOL has correct structure', () => {
      expect(SCAFFOLD_TOOL.name).toBe('scaffold_graph');
      expect(SCAFFOLD_TOOL.input_schema.required).toContain('nodes');
    });

    it('FILL_TOOL has correct structure', () => {
      expect(FILL_TOOL.name).toBe('fill_graph');
      expect(FILL_TOOL.input_schema.required).toContain('nodes');
    });

    it('VALIDATE_TOOL has correct structure', () => {
      expect(VALIDATE_TOOL.name).toBe('validate_graph');
      expect(VALIDATE_TOOL.input_schema.required).toContain('patches');
    });
  });

  describe('buildHierarchicalTool', () => {
    const config: ExtractionConfig = { maxNodes: 10 };

    it('builds theme extraction tool for pass 1', () => {
      const tool = buildHierarchicalTool(1, config);
      expect(tool.name).toBe('extract_themes');
      expect(tool.input_schema.required).toContain('nodes');
    });

    it('builds concept extraction tool for pass 2', () => {
      const tool = buildHierarchicalTool(2, config);
      expect(tool.name).toBe('extract_concepts');
      expect(tool.input_schema.required).toContain('nodes');
    });

    it('builds detail extraction tool for pass 3', () => {
      const tool = buildHierarchicalTool(3, config);
      expect(tool.name).toBe('extract_details');
      expect(tool.input_schema.required).toContain('nodes');
    });

    it('builds cross-link extraction tool for pass 4', () => {
      const tool = buildHierarchicalTool(4, config);
      expect(tool.name).toBe('extract_cross_links');
      expect(tool.input_schema.required).toContain('crossLinks');
      expect(tool.input_schema.required).toContain('summary');
    });

    it('uses maxNodes from config in description', () => {
      const tool = buildHierarchicalTool(1, { maxNodes: 5 });
      expect(tool.description).toContain('5');
    });
  });
});
