/**
 * NODEPROMPT — Spatial Prompt Engineering through Interactive Concept Graphs
 * Copyright (c) 2025-2026 Taewoo Park
 * Licensed under the MIT License — see THIRD_PARTY_NOTICES.md
 *
 * Zod schemas and LLM tool definitions for extraction passes.
 * Tool definitions use Claude/Anthropic tool_use JSON schema format.
 * The LLM adapter layer handles actual API call format translation.
 */

import { z } from 'zod';
import type { ExtractionConfig } from '../types/index.js';

// ── Constants ──

export const NODE_TYPES = [
  'concept',
  'nuance',
  'mood',
  'philosophy',
  'abstraction',
  'context',
] as const;

export const EDGE_RELATIONS = [
  'causal',
  'contrast',
  'amplify',
  'suppress',
  'parallel',
  'dependency',
  'parent-child',
  'cross-link',
] as const;

// ── Single-pass extraction schemas ──

export const ExtractedNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(NODE_TYPES),
  weight: z.number().min(0).max(1),
  description: z.string().min(1),
  depth: z.number().int().min(0),
  parentId: z.string().nullable(),
});

export const ExtractedEdgeSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  relation: z.enum(EDGE_RELATIONS),
  strength: z.number().min(0).max(1),
  isHierarchical: z.boolean(),
});

export const ExtractionResultSchema = z.object({
  nodes: z.array(ExtractedNodeSchema),
  edges: z.array(ExtractedEdgeSchema),
  summary: z.string(),
});

// ── Hierarchical pass 1: Theme nodes ──

export const ThemeNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(NODE_TYPES),
  weight: z.number().min(0).max(1),
  description: z.string().min(1),
  depth: z.literal(0),
  parentId: z.literal(null),
});

// ── Hierarchical pass 2: Concept nodes ──

export const ConceptNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(NODE_TYPES),
  weight: z.number().min(0).max(1),
  description: z.string().min(1),
  depth: z.number().int().min(1).max(2),
  parentId: z.string(),
});

// ── Hierarchical pass 3: Detail nodes ──

export const DetailNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(NODE_TYPES),
  weight: z.number().min(0).max(1),
  description: z.string().min(1),
  depth: z.number().int().min(2),
  parentId: z.string(),
});

// ── Cross-link pass 4 ──

export const CrossLinkSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  relation: z.enum(['cross-link']),
  strength: z.number().min(0).max(1),
  rationale: z.string().min(1),
});

export const CrossLinkResultSchema = z.object({
  crossLinks: z.array(CrossLinkSchema),
  summary: z.string(),
});

// ── 3-Phase scaffold schemas ──

export const ScaffoldNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(NODE_TYPES),
  weight: z.number().min(0).max(1),
  description: z.string().min(1),
  depth: z.number().int().min(0),
  parentId: z.string().nullable(),
  children: z.array(z.string()).default([]),
});

export const FillNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(NODE_TYPES),
  weight: z.number().min(0).max(1),
  description: z.string().min(1),
  depth: z.number().int().min(1),
  parentId: z.string(),
  edgeToParent: z.object({
    relation: z.enum(EDGE_RELATIONS),
    strength: z.number().min(0).max(1),
  }),
});

export const PatchNodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().min(1),
  weight: z.number().min(0).max(1).optional(),
  depth: z.number().int().min(0).optional(),
  parentId: z.string().optional(),
  remove: z.boolean().default(false),
});

// ── Inferred types from schemas ──

export type ExtractedNode = z.infer<typeof ExtractedNodeSchema>;
export type ExtractedEdge = z.infer<typeof ExtractedEdgeSchema>;
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;
export type ThemeNode = z.infer<typeof ThemeNodeSchema>;
export type ConceptNode = z.infer<typeof ConceptNodeSchema>;
export type DetailNode = z.infer<typeof DetailNodeSchema>;
export type CrossLink = z.infer<typeof CrossLinkSchema>;
export type CrossLinkResult = z.infer<typeof CrossLinkResultSchema>;
export type ScaffoldNode = z.infer<typeof ScaffoldNodeSchema>;
export type FillNode = z.infer<typeof FillNodeSchema>;
export type PatchNode = z.infer<typeof PatchNodeSchema>;

// ── LLM tool definition type ──

/**
 * Generic LLM tool definition in Claude/Anthropic tool_use format.
 * The adapter layer handles translation to the actual API call format.
 */
export interface LLMToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

// ── LLM tool definitions (Claude/Anthropic tool_use format) ──

const NODE_TYPE_ENUM = [...NODE_TYPES];
const EDGE_RELATION_ENUM = [...EDGE_RELATIONS];

/** Single-pass extraction tool definition */
export const EXTRACTION_TOOL = {
  name: 'extract_concept_graph',
  description:
    'Extract a concept graph from the given text. Return nodes (concepts, themes, moods) and edges (relationships between them).',
  input_schema: {
    type: 'object' as const,
    properties: {
      nodes: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            id: { type: 'string', description: 'Unique identifier' },
            label: { type: 'string', description: 'Human-readable concept name' },
            type: {
              type: 'string',
              enum: NODE_TYPE_ENUM,
              description: 'Cognitive category of the node',
            },
            weight: {
              type: 'number',
              description: 'Importance score 0-1',
            },
            description: {
              type: 'string',
              description: 'Brief explanation of the concept',
            },
            depth: {
              type: 'integer',
              description: 'Hierarchy depth (0=root)',
            },
            parentId: {
              type: ['string', 'null'] as string[],
              description: 'Parent node ID, or null for root',
            },
          },
          required: ['id', 'label', 'type', 'weight', 'description', 'depth', 'parentId'],
        },
      },
      edges: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            id: { type: 'string', description: 'Unique edge identifier' },
            sourceId: { type: 'string', description: 'Source node ID' },
            targetId: { type: 'string', description: 'Target node ID' },
            relation: {
              type: 'string',
              enum: EDGE_RELATION_ENUM,
              description: 'Type of relationship',
            },
            strength: {
              type: 'number',
              description: 'Relationship strength 0-1',
            },
            isHierarchical: {
              type: 'boolean',
              description: 'Whether this is a parent-child link',
            },
          },
          required: ['id', 'sourceId', 'targetId', 'relation', 'strength', 'isHierarchical'],
        },
      },
      summary: {
        type: 'string' as const,
        description: 'Brief summary of the extracted graph structure',
      },
    },
    required: ['nodes', 'edges', 'summary'],
  },
} as const;

/** 3-Phase scaffold tool (pass 1) */
export const SCAFFOLD_TOOL = {
  name: 'scaffold_graph',
  description:
    'Build the top-level scaffold of a concept graph. Create high-level theme nodes that form the backbone structure.',
  input_schema: {
    type: 'object' as const,
    properties: {
      nodes: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            id: { type: 'string', description: 'Unique identifier' },
            label: { type: 'string', description: 'Theme or concept name' },
            type: {
              type: 'string',
              enum: NODE_TYPE_ENUM,
              description: 'Cognitive category',
            },
            weight: {
              type: 'number',
              description: 'Importance 0-1',
            },
            description: {
              type: 'string',
              description: 'What this theme represents',
            },
            depth: {
              type: 'integer',
              description: 'Depth level (scaffold is typically 0-1)',
            },
            parentId: {
              type: ['string', 'null'] as string[],
              description: 'Parent node ID or null',
            },
            children: {
              type: 'array' as const,
              items: { type: 'string' },
              description: 'Child node IDs',
            },
          },
          required: ['id', 'label', 'type', 'weight', 'description', 'depth', 'parentId'],
        },
      },
    },
    required: ['nodes'],
  },
} as const;

/** 3-Phase fill tool (pass 2) */
export const FILL_TOOL = {
  name: 'fill_graph',
  description:
    'Fill in concept nodes under an existing scaffold. Each new node must connect to an existing scaffold node via a parent edge.',
  input_schema: {
    type: 'object' as const,
    properties: {
      nodes: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            id: { type: 'string', description: 'Unique identifier' },
            label: { type: 'string', description: 'Concept name' },
            type: {
              type: 'string',
              enum: NODE_TYPE_ENUM,
              description: 'Cognitive category',
            },
            weight: {
              type: 'number',
              description: 'Importance 0-1',
            },
            description: {
              type: 'string',
              description: 'What this concept adds to the graph',
            },
            depth: {
              type: 'integer',
              description: 'Depth level (must be >= 1)',
            },
            parentId: {
              type: 'string',
              description: 'Must reference an existing scaffold node',
            },
            edgeToParent: {
              type: 'object' as const,
              properties: {
                relation: {
                  type: 'string',
                  enum: EDGE_RELATION_ENUM,
                  description: 'Relationship to parent',
                },
                strength: {
                  type: 'number',
                  description: 'Edge strength 0-1',
                },
              },
              required: ['relation', 'strength'],
            },
          },
          required: ['id', 'label', 'type', 'weight', 'description', 'depth', 'parentId', 'edgeToParent'],
        },
      },
    },
    required: ['nodes'],
  },
} as const;

/** 3-Phase validate/patch tool (pass 3) */
export const VALIDATE_TOOL = {
  name: 'validate_graph',
  description:
    'Validate and patch an existing concept graph. Fix weights, refine descriptions, remove duplicates, or add missing connections.',
  input_schema: {
    type: 'object' as const,
    properties: {
      patches: {
        type: 'array' as const,
        items: {
          type: 'object' as const,
          properties: {
            id: { type: 'string', description: 'Node ID to patch' },
            label: { type: 'string', description: 'Updated label' },
            description: { type: 'string', description: 'Updated description' },
            weight: { type: 'number', description: 'Updated importance 0-1' },
            depth: { type: 'integer', description: 'Updated depth' },
            parentId: { type: 'string', description: 'Updated parent' },
            remove: {
              type: 'boolean',
              description: 'Set true to remove this node',
            },
          },
          required: ['id', 'label', 'description'],
        },
      },
    },
    required: ['patches'],
  },
} as const;

// ── Hierarchical tool builder ──

/**
 * Build a tool definition for a specific hierarchical extraction pass.
 * Pass 1: themes (depth 0 roots)
 * Pass 2: concepts (depth 1-2, under existing themes)
 * Pass 3: details (depth 2+, under existing concepts)
 * Pass 4: cross-links between nodes across branches
 */
export function buildHierarchicalTool(
  pass: 1 | 2 | 3 | 4,
  config: ExtractionConfig,
): LLMToolDefinition {
  const maxNodes = config.maxNodes;

  switch (pass) {
    case 1:
      return {
        name: 'extract_themes',
        description: `Extract ${Math.min(maxNodes, 7)} top-level theme nodes (depth=0, parentId=null) from the text. These form the root structure of the concept graph.`,
        input_schema: {
          type: 'object',
          properties: {
            nodes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Unique node identifier' },
                  label: { type: 'string', description: 'Theme name' },
                  type: {
                    type: 'string',
                    enum: NODE_TYPE_ENUM,
                    description: 'Cognitive category',
                  },
                  weight: { type: 'number', description: 'Importance 0-1' },
                  description: { type: 'string', description: 'Theme summary' },
                  depth: { type: 'integer', description: 'Must be 0 for themes', enum: [0] },
                  parentId: { type: 'null', description: 'Must be null for root themes' },
                },
                required: ['id', 'label', 'type', 'weight', 'description', 'depth', 'parentId'],
              },
            },
          },
          required: ['nodes'],
        },
      };

    case 2:
      return {
        name: 'extract_concepts',
        description: 'Extract concept nodes (depth 1-2) under the given theme nodes. Each concept must reference an existing theme as parentId.',
        input_schema: {
          type: 'object',
          properties: {
            nodes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Unique node identifier' },
                  label: { type: 'string', description: 'Concept name' },
                  type: {
                    type: 'string',
                    enum: NODE_TYPE_ENUM,
                    description: 'Cognitive category',
                  },
                  weight: { type: 'number', description: 'Importance 0-1' },
                  description: { type: 'string', description: 'Concept explanation' },
                  depth: { type: 'integer', description: 'Depth level (1 or 2)' },
                  parentId: { type: 'string', description: 'Must reference an existing theme node' },
                },
                required: ['id', 'label', 'type', 'weight', 'description', 'depth', 'parentId'],
              },
            },
          },
          required: ['nodes'],
        },
      };

    case 3:
      return {
        name: 'extract_details',
        description: 'Extract detail nodes (depth 2+) under existing concept nodes. These provide fine-grained nuance and specific examples.',
        input_schema: {
          type: 'object',
          properties: {
            nodes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Unique node identifier' },
                  label: { type: 'string', description: 'Detail name' },
                  type: {
                    type: 'string',
                    enum: NODE_TYPE_ENUM,
                    description: 'Cognitive category',
                  },
                  weight: { type: 'number', description: 'Importance 0-1' },
                  description: { type: 'string', description: 'Detail explanation' },
                  depth: { type: 'integer', description: 'Depth level (2 or deeper)' },
                  parentId: { type: 'string', description: 'Must reference an existing concept node' },
                },
                required: ['id', 'label', 'type', 'weight', 'description', 'depth', 'parentId'],
              },
            },
          },
          required: ['nodes'],
        },
      };

    case 4:
      return {
        name: 'extract_cross_links',
        description: 'Identify cross-links between nodes in different branches of the concept graph. These reveal non-obvious connections.',
        input_schema: {
          type: 'object',
          properties: {
            crossLinks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Unique cross-link identifier' },
                  sourceId: { type: 'string', description: 'Source node ID' },
                  targetId: { type: 'string', description: 'Target node ID' },
                  relation: { type: 'string', enum: ['cross-link'], description: 'Always cross-link' },
                  strength: { type: 'number', description: 'Connection strength 0-1' },
                  rationale: { type: 'string', description: 'Why these nodes are connected' },
                },
                required: ['id', 'sourceId', 'targetId', 'relation', 'strength', 'rationale'],
              },
            },
            summary: { type: 'string', description: 'Summary of discovered cross-links' },
          },
          required: ['crossLinks', 'summary'],
        },
      };
  }
}
