import * as path from 'path';
import { PiAgent } from '../../../src/agents/PiAgent';

describe('PiAgent', () => {
  let agent: PiAgent;

  beforeEach(() => {
    agent = new PiAgent();
  });

  it('returns the correct identifier', () => {
    expect(agent.getIdentifier()).toBe('pi');
  });

  it('returns the correct name', () => {
    expect(agent.getName()).toBe('Pi Coding Agent');
  });

  it('returns the default output path', () => {
    const projectRoot = '/tmp/project';
    expect(agent.getDefaultOutputPath(projectRoot)).toBe(
      path.join(projectRoot, 'AGENTS.md'),
    );
  });

  it('does not support MCP', () => {
    expect(agent.supportsMcpStdio()).toBe(false);
    expect(agent.supportsMcpRemote()).toBe(false);
  });

  it('supports native skills', () => {
    expect(agent.supportsNativeSkills()).toBe(true);
  });
});
