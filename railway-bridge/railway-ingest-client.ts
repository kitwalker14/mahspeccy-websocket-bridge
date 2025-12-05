/**
 * Railway SDK Ingestion Client
 * 
 * Frontend utility to trigger Railway SDK ingestion and access manifest data
 */

import { projectId, publicAnonKey } from '../utils/supabase/info';

const SERVER_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-5a9e4cc2`;

export interface RailwaySDKMetadata {
  repository: string;
  branch: string;
  lastIngestion: string;
  totalItems: number;
  filesCount: number;
  directoriesCount: number;
}

export interface ManifestNode {
  type: 'file' | 'directory';
  name: string;
  path: string;
  size?: number;
  sha?: string;
  content?: string;
  preview?: string;
  children?: ManifestNode[];
}

export interface RailwaySDKManifest {
  repository: string;
  branch: string;
  timestamp: string;
  totalItems: number;
  manifest: ManifestNode[];
}

export interface IngestionResult {
  success: boolean;
  message?: string;
  error?: string;
  metadata?: {
    repository: string;
    branch: string;
    timestamp: string;
    totalItems: number;
    filesCount: number;
    directoriesCount: number;
  };
}

export interface IngestionStatus {
  success: boolean;
  ingested: boolean;
  message?: string;
  metadata?: RailwaySDKMetadata;
}

export interface ManifestResponse {
  success: boolean;
  data?: RailwaySDKManifest;
  error?: string;
}

export interface SearchResult {
  success: boolean;
  query?: string;
  results?: ManifestNode[];
  count?: number;
  error?: string;
}

/**
 * Trigger Railway SDK ingestion
 */
export async function ingestRailwaySDK(): Promise<IngestionResult> {
  try {
    const response = await fetch(`${SERVER_BASE}/railway-ingest`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('Error triggering Railway SDK ingestion:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get ingestion status
 */
export async function getIngestionStatus(): Promise<IngestionStatus> {
  try {
    const response = await fetch(`${SERVER_BASE}/railway-ingest/status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('Error fetching ingestion status:', error);
    return {
      success: false,
      ingested: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get full manifest data
 */
export async function getManifest(): Promise<ManifestResponse> {
  try {
    const response = await fetch(`${SERVER_BASE}/railway-ingest/manifest`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('Error fetching manifest:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Search files by path or name
 */
export async function searchManifest(query: string): Promise<SearchResult> {
  try {
    const response = await fetch(
      `${SERVER_BASE}/railway-ingest/search?q=${encodeURIComponent(query)}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('Error searching manifest:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Helper: Find specific file in manifest
 */
export function findFileInManifest(
  manifest: ManifestNode[],
  pathOrName: string
): ManifestNode | null {
  for (const node of manifest) {
    if (node.path === pathOrName || node.name === pathOrName) {
      return node;
    }
    if (node.children) {
      const found = findFileInManifest(node.children, pathOrName);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Helper: Get all files with specific extension
 */
export function getFilesByExtension(
  manifest: ManifestNode[],
  extension: string
): ManifestNode[] {
  const results: ManifestNode[] = [];

  function traverse(nodes: ManifestNode[]) {
    for (const node of nodes) {
      if (node.type === 'file' && node.name.endsWith(extension)) {
        results.push(node);
      }
      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(manifest);
  return results;
}

/**
 * Helper: Get directory structure as string
 */
export function getDirectoryTree(
  manifest: ManifestNode[],
  indent: number = 0
): string {
  let tree = '';

  for (const node of manifest) {
    const prefix = '  '.repeat(indent);
    const icon = node.type === 'directory' ? '📁' : '📄';
    const size = node.size ? ` (${(node.size / 1024).toFixed(2)} KB)` : '';
    tree += `${prefix}${icon} ${node.name}${size}\n`;

    if (node.children && node.children.length > 0) {
      tree += getDirectoryTree(node.children, indent + 1);
    }
  }

  return tree;
}

/**
 * Helper: Count files and directories
 */
export function getManifestStats(manifest: ManifestNode[]): {
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
  filesByExtension: Record<string, number>;
} {
  let totalFiles = 0;
  let totalDirectories = 0;
  let totalSize = 0;
  const filesByExtension: Record<string, number> = {};

  function traverse(nodes: ManifestNode[]) {
    for (const node of nodes) {
      if (node.type === 'file') {
        totalFiles++;
        if (node.size) totalSize += node.size;

        const ext = node.name.includes('.')
          ? '.' + node.name.split('.').pop()!
          : 'no-extension';
        filesByExtension[ext] = (filesByExtension[ext] || 0) + 1;
      } else {
        totalDirectories++;
      }

      if (node.children) {
        traverse(node.children);
      }
    }
  }

  traverse(manifest);

  return {
    totalFiles,
    totalDirectories,
    totalSize,
    filesByExtension,
  };
}
