import * as path from 'path';

export function isPathInsideOrEqual(
  parentPath: string,
  targetPath: string,
): boolean {
  const relative = path.relative(
    path.resolve(parentPath),
    path.resolve(targetPath),
  );
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}
