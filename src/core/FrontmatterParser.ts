import * as yaml from 'js-yaml';
import { MdcFrontmatter } from '../types';

export interface ParsedContent {
  /** Parsed frontmatter metadata, or null if none found. */
  frontmatter: MdcFrontmatter | null;
  /** Content body with frontmatter stripped. */
  body: string;
}

/**
 * Parses YAML frontmatter from MDC file content.
 * Frontmatter must be at the start of the file, between --- delimiters.
 *
 * @example
 * ```
 * ---
 * description: My rule
 * alwaysApply: true
 * ---
 * # Rule content here
 * ```
 *
 * @param content The full file content
 * @returns Object with parsed frontmatter and body (frontmatter stripped)
 */
export function parseFrontmatter(content: string): ParsedContent {
  // Match YAML frontmatter at the start of the file
  // Pattern: start of string, ---, content, ---, rest
  // Allow for empty content between delimiters (consecutive ---\n--- lines)
  const frontmatterRegex = /^---\s*\n([\s\S]*?)---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    // No frontmatter found
    return {
      frontmatter: null,
      body: content,
    };
  }

  const [, yamlContent, body] = match;

  try {
    // Try parsing YAML as-is first
    const parsed = yaml.load(yamlContent) as Record<string, unknown> | null;
    return extractFrontmatter(parsed, body);
  } catch (error) {
    // YAML parsing failed - try to fix common issues
    try {
      // Fix common issue: globs as comma-separated unquoted strings
      // Pattern: globs: *.tsx,**/path -> globs: ["*.tsx", "**/path"]
      const fixedYaml = yamlContent.replace(
        /^(\s*globs\s*:\s*)([^\n\[\{]+)$/gm,
        (match, prefix, value) => {
          // Check if value looks like comma-separated patterns (contains * or commas)
          if (value.includes('*') || value.includes(',')) {
            // Split by comma and quote each part
            const patterns = value
              .split(',')
              .map((p: string) => p.trim())
              .filter((p: string) => p.length > 0)
              .map((p: string) => `"${p}"`)
              .join(', ');
            return `${prefix}[${patterns}]`;
          }
          return match;
        },
      );

      // Try parsing again with fixed YAML
      if (fixedYaml !== yamlContent) {
        const parsed = yaml.load(fixedYaml) as Record<string, unknown> | null;
        return extractFrontmatter(parsed, body);
      }
    } catch {
      // Fixed version also failed, fall through to warning
    }

    // YAML parsing failed - treat as no frontmatter
    return {
      frontmatter: null,
      body: content,
    };
  }
}

/**
 * Extracts and validates frontmatter fields from parsed YAML.
 */
function extractFrontmatter(
  parsed: Record<string, unknown> | null,
  body: string,
): ParsedContent {
  // Extract and validate frontmatter fields
  const frontmatter: MdcFrontmatter = {};

  // Handle null or undefined parsed YAML (empty frontmatter)
  if (!parsed) {
    return {
      frontmatter: {},
      body: body.trim(),
    };
  }

  if (typeof parsed === 'object') {
    // Extract description
    if (typeof parsed.description === 'string') {
      frontmatter.description = parsed.description;
    }

    // Extract globs (can be string or array)
    if (typeof parsed.globs === 'string') {
      frontmatter.globs = [parsed.globs];
    } else if (Array.isArray(parsed.globs)) {
      frontmatter.globs = parsed.globs.filter(
        (g): g is string => typeof g === 'string',
      );
    }

    // Extract alwaysApply
    if (typeof parsed.alwaysApply === 'boolean') {
      frontmatter.alwaysApply = parsed.alwaysApply;
    }
  }

  return {
    frontmatter,
    body: body.trim(),
  };
}
