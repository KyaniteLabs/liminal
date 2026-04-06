/**
 * NODEPROMPT — Spatial Prompt Engineering through Interactive Concept Graphs
 * Copyright (c) 2025-2026 Taewoo Park
 * Licensed under the MIT License — see THIRD_PARTY_NOTICES.md
 *
 * SphereLayout — maps extraction results onto a sphere using Fibonacci lattice
 * distribution and Tammes repulsion simulation for hierarchical graphs.
 *
 * MIT License — Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to
 * whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or
 * substantial portions of the Software.
 */

import type { NodeData, EdgeData, Vec3, SphericalCoord, AbstractionLevel, FacetSet } from '../types/index.js';
import { createNodeData } from '../types/index.js';
import type { ExtractionResult } from '../extraction/schemas.js';
import { fibonacciSphere } from './fibonacciSphere.js';
import { cartesianToSpherical } from './coordinates.js';

// ── Helper: map depth to abstraction level (Rosch taxonomy) ──

function depthToAbstraction(depth: number, maxDepth: number): AbstractionLevel {
  const ratio = maxDepth > 0 ? depth / maxDepth : 0;
  if (ratio <= 0.25) return 'superordinate';
  if (ratio <= 0.5) return 'basic';
  if (ratio <= 0.75) return 'subordinate';
  return 'instance';
}

// ── Helper: assign default facets based on node type and depth ──

function inferFacets(type: NodeData['type'], depth: number): FacetSet {
  return {
    cognitive: type,
    epistemological: depth === 0 ? 'normative' : 'theoretical',
    rhetorical: depth === 0 ? 'thesis' : 'evidence',
  };
}

// ── mapNodesToSphere ──

/**
 * Distribute extraction result nodes uniformly on a sphere using Fibonacci lattice.
 * Creates positioned NodeData entries with sphere and radial coordinates.
 * Filters edges to only include those where both endpoints exist.
 */
export function mapNodesToSphere(
  result: ExtractionResult,
  sphereRadius: number,
): { nodes: NodeData[]; edges: EdgeData[] } {
  const n = result.nodes.length;
  if (n === 0) return { nodes: [], edges: [] };

  // Generate Fibonacci lattice positions
  const positions = fibonacciSphere(n, sphereRadius);

  // Build node ID set for edge filtering
  const nodeIdSet = new Set(result.nodes.map((rn) => rn.id));

  // Map extracted nodes to NodeData with sphere positions
  const nodes: NodeData[] = result.nodes.map((rn, i) => {
    const pos = positions[i] ?? { x: 0, y: 0, z: 0 };
    const spherical: SphericalCoord & { r: number } = cartesianToSpherical(pos.x, pos.y, pos.z);

    return createNodeData({
      id: rn.id,
      label: rn.label,
      type: rn.type,
      weight: rn.weight,
      description: rn.description,
      depth: rn.depth,
      parentId: rn.parentId,
      sphereCoord: { theta: spherical.theta, phi: spherical.phi },
      radialCoord: { angle: spherical.phi, depth: rn.depth },
      position: pos,
    });
  });

  // Filter edges: both source and target must exist
  const edges: EdgeData[] = result.edges
    .filter((re) => nodeIdSet.has(re.sourceId) && nodeIdSet.has(re.targetId))
    .map((re) => ({
      id: re.id,
      sourceId: re.sourceId,
      targetId: re.targetId,
      relation: re.relation,
      strength: re.strength,
      isUserCreated: false,
      isDeleted: false,
      isHierarchical: re.isHierarchical,
      extractionPass: 0,
    }));

  return { nodes, edges };
}

// ── Hierarchical types ──

/** Raw hierarchical node as produced by multi-pass extraction. */
export interface HierarchicalRawNode {
  id: string;
  label: string;
  type: NodeData['type'];
  weight: number;
  description: string;
  parentId: string | null;
  children?: string[];
}

/** Raw edge as produced by multi-pass extraction. */
export interface RawEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relation: EdgeData['relation'];
  strength: number;
  isHierarchical: boolean;
}

// ── Tammes repulsion simulation ──

interface SimNode {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

/**
 * Run Tammes-style repulsion simulation.
 * Uses Coulomb inverse-square repulsion between all pairs, with force decay
 * over iterations. Re-projects points onto sphere surface each iteration.
 */
function tammesRepulsion(
  simNodes: SimNode[],
  radius: number,
  iterations: number,
): void {
  const n = simNodes.length;
  if (n <= 1) return;

  for (let iter = 0; iter < iterations; iter++) {
    // Decaying force coefficient — starts strong, diminishes
    const forceScale = 1.0 / (1 + iter * 0.01);

    // Reset velocities
    for (const node of simNodes) {
      node.vx = 0;
      node.vy = 0;
      node.vz = 0;
    }

    // Pairwise Coulomb repulsion (inverse-square)
    for (let i = 0; i < n; i++) {
      const a = simNodes[i]!;
      for (let j = i + 1; j < n; j++) {
        const b = simNodes[j]!;

        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;

        const distSq = dx * dx + dy * dy + dz * dz;
        const dist = Math.sqrt(distSq);

        // Avoid division by zero for coincident points
        const safeDist = Math.max(dist, 0.001);
        const force = forceScale / (safeDist * safeDist);

        // Normalize direction
        const nx = dx / safeDist;
        const ny = dy / safeDist;
        const nz = dz / safeDist;

        a.vx += nx * force;
        a.vy += ny * force;
        a.vz += nz * force;

        b.vx -= nx * force;
        b.vy -= ny * force;
        b.vz -= nz * force;
      }
    }

    // Apply velocities and re-project onto sphere
    for (const node of simNodes) {
      node.x += node.vx;
      node.y += node.vy;
      node.z += node.vz;

      // Project back onto sphere surface
      const r = Math.sqrt(node.x * node.x + node.y * node.y + node.z * node.z);
      if (r > 0) {
        node.x = (node.x / r) * radius;
        node.y = (node.y / r) * radius;
        node.z = (node.z / r) * radius;
      }
    }
  }
}

// ── BFS depth computation ──

/**
 * Compute depth for each node via BFS starting from roots (parentId === null).
 * Returns a Map of nodeId → computed depth.
 */
function computeDepthsBFS(nodes: HierarchicalRawNode[]): Map<string, number> {
  const depthMap = new Map<string, number>();
  const childrenMap = new Map<string, string[]>();

  // Build children index
  const roots: string[] = [];
  for (const node of nodes) {
    if (node.parentId === null) {
      roots.push(node.id);
      depthMap.set(node.id, 0);
    } else {
      const siblings = childrenMap.get(node.parentId) ?? [];
      siblings.push(node.id);
      childrenMap.set(node.parentId, siblings);
    }
  }

  // BFS from roots
  const queue = [...roots];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentDepth = depthMap.get(currentId) ?? 0;
    const children = childrenMap.get(currentId) ?? [];

    for (const childId of children) {
      depthMap.set(childId, currentDepth + 1);
      queue.push(childId);
    }
  }

  // Assign depth 0 to any orphaned nodes not reached by BFS
  for (const node of nodes) {
    if (!depthMap.has(node.id)) {
      depthMap.set(node.id, 0);
    }
  }

  return depthMap;
}

// ── mapHierarchicalToSphere ──

/**
 * Map hierarchical extraction results onto a sphere with Tammes repulsion.
 *
 * Algorithm:
 * 1. BFS to compute depth from parentId relationships
 * 2. Fibonacci initial distribution, interleaved by depth
 * 3. Tammes repulsion simulation (Coulomb inverse-square, 300+ iterations)
 * 4. Re-project onto sphere surface each iteration
 * 5. Create full NodeData with facets, abstraction levels, hierarchy
 */
export function mapHierarchicalToSphere(
  rawNodes: HierarchicalRawNode[],
  rawEdges: RawEdge[],
  sphereRadius: number,
  maxDepth: number,
): { nodes: NodeData[]; edges: EdgeData[] } {
  const n = rawNodes.length;
  if (n === 0) return { nodes: [], edges: [] };

  // Step 1: BFS depth computation
  const depthMap = computeDepthsBFS(rawNodes);

  // Step 2: Sort nodes by depth, then interleave by depth for even distribution
  const sortedNodes = [...rawNodes].sort((a, b) => {
    const da = depthMap.get(a.id) ?? 0;
    const db = depthMap.get(b.id) ?? 0;
    return da - db;
  });

  // Generate Fibonacci positions
  const fibPositions = fibonacciSphere(n, sphereRadius);

  // Interleave: group by depth, then pick round-robin from each group
  const depthGroups = new Map<number, HierarchicalRawNode[]>();
  for (const node of sortedNodes) {
    const d = depthMap.get(node.id) ?? 0;
    const group = depthGroups.get(d) ?? [];
    group.push(node);
    depthGroups.set(d, group);
  }

  const interleaved: HierarchicalRawNode[] = [];
  const maxD = Math.max(...Array.from(depthGroups.keys()));
  let hasMore = true;
  while (hasMore) {
    hasMore = false;
    for (let d = 0; d <= maxD; d++) {
      const group = depthGroups.get(d);
      if (group && group.length > 0) {
        interleaved.push(group.shift()!);
        hasMore = hasMore || group.length > 0;
      }
    }
  }

  // Fallback: if interleaving missed any, append them
  const interleavedIds = new Set(interleaved.map((n) => n.id));
  for (const node of rawNodes) {
    if (!interleavedIds.has(node.id)) {
      interleaved.push(node);
    }
  }

  // Step 3: Initialize simulation nodes from interleaved Fibonacci positions
  const simNodes: SimNode[] = interleaved.map((node, i) => {
    const pos = fibPositions[i] ?? { x: 0, y: 0, z: 0 };
    return {
      id: node.id,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      vx: 0,
      vy: 0,
      vz: 0,
    };
  });

  // Step 4: Run Tammes repulsion (300 iterations with decaying force)
  const ITERATIONS = 300;
  tammesRepulsion(simNodes, sphereRadius, ITERATIONS);

  // Build index from simNode id → final position
  const finalPositions = new Map<string, Vec3>();
  for (const sn of simNodes) {
    finalPositions.set(sn.id, { x: sn.x, y: sn.y, z: sn.z });
  }

  // Step 5: Create NodeData with full metadata
  const nodeIdSet = new Set(rawNodes.map((rn) => rn.id));

  const nodes: NodeData[] = rawNodes.map((rn) => {
    const depth = depthMap.get(rn.id) ?? 0;
    const pos = finalPositions.get(rn.id) ?? { x: 0, y: 0, z: 0 };
    const spherical = cartesianToSpherical(pos.x, pos.y, pos.z);

    return createNodeData({
      id: rn.id,
      label: rn.label,
      type: rn.type,
      weight: rn.weight,
      description: rn.description,
      depth,
      abstractionLevel: depthToAbstraction(depth, maxDepth),
      facets: inferFacets(rn.type, depth),
      parentId: rn.parentId,
      children: rn.children ?? [],
      sphereCoord: { theta: spherical.theta, phi: spherical.phi },
      radialCoord: { angle: spherical.phi, depth },
      position: pos,
    });
  });

  // Build parent-child relationships from parentId
  for (const node of nodes) {
    if (node.parentId) {
      const parent = nodes.find((n) => n.id === node.parentId);
      if (parent && !parent.children.includes(node.id)) {
        parent.children.push(node.id);
      }
    }
  }

  // Filter and map edges
  const edges: EdgeData[] = rawEdges
    .filter((re) => nodeIdSet.has(re.sourceId) && nodeIdSet.has(re.targetId))
    .map((re) => ({
      id: re.id,
      sourceId: re.sourceId,
      targetId: re.targetId,
      relation: re.relation,
      strength: re.strength,
      isUserCreated: false,
      isDeleted: false,
      isHierarchical: re.isHierarchical,
      extractionPass: 0,
    }));

  // Add implicit parent-child edges for hierarchical nodes not already covered
  const existingEdgeKeys = new Set(
    edges.map((e) => `${e.sourceId}->${e.targetId}`),
  );

  for (const rn of rawNodes) {
    if (rn.parentId && nodeIdSet.has(rn.parentId) && nodeIdSet.has(rn.id)) {
      const key = `${rn.parentId}->${rn.id}`;
      if (!existingEdgeKeys.has(key)) {
        edges.push({
          id: `hierarchy-${rn.parentId}-${rn.id}`,
          sourceId: rn.parentId,
          targetId: rn.id,
          relation: 'parent-child',
          strength: 0.8,
          isUserCreated: false,
          isDeleted: false,
          isHierarchical: true,
          extractionPass: 0,
        });
        existingEdgeKeys.add(key);
      }
    }
  }

  return { nodes, edges };
}
