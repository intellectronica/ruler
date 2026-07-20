import { applyAllAgentConfigs } from '../../src/lib';
import * as ApplyEngine from '../../src/core/apply-engine';
import * as Constants from '../../src/constants';

describe('applyAllAgentConfigs diagnostics', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('emits formatted non-deprecation diagnostics once', async () => {
    jest.spyOn(ApplyEngine, 'loadSingleConfiguration').mockResolvedValue({
      config: {
        agentConfigs: {},
        defaultAgents: ['claude'],
      },
      concatenatedRules: '# Rules',
      rulerMcpJson: null,
      projectRoot: '/tmp/project',
      diagnostics: [
        {
          severity: 'error',
          code: 'TEST_DIAGNOSTIC',
          message: 'Broken config',
          file: '/tmp/ruler.toml',
          detail: 'bad syntax',
        },
        {
          severity: 'error',
          code: 'TEST_DIAGNOSTIC',
          message: 'Broken config',
          file: '/tmp/ruler.toml',
          detail: 'bad syntax',
        },
        {
          severity: 'warning',
          code: 'MCP_JSON_DEPRECATED',
          message: 'Legacy MCP JSON',
        },
      ],
    });
    jest.spyOn(ApplyEngine, 'processSingleConfiguration').mockResolvedValue([]);
    jest.spyOn(ApplyEngine, 'updateGitignore').mockResolvedValue();
    const logErrorSpy = jest.spyOn(Constants, 'logError').mockImplementation();
    const logWarnSpy = jest.spyOn(Constants, 'logWarn').mockImplementation();

    await applyAllAgentConfigs('/tmp/project', ['claude']);

    expect(logErrorSpy).toHaveBeenCalledTimes(1);
    expect(logErrorSpy).toHaveBeenCalledWith(
      'Configuration error [TEST_DIAGNOSTIC]: Broken config (File: /tmp/ruler.toml, Detail: bad syntax)',
      false,
    );
    expect(logWarnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('MCP_JSON_DEPRECATED'),
      expect.any(Boolean),
    );
  });
});
