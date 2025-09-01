import { logVerbose, logInfo, logWarn, logError, logVerboseInfo, actionPrefix } from '../../../src/constants';

describe('constants', () => {
  describe('logVerbose', () => {
    let consoleErrorSpy: jest.SpyInstance;
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('calls console.error when isVerbose is true', () => {
      logVerbose('test message', true);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[ruler:verbose] test message');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('does not call console.error or console.log when isVerbose is false', () => {
      logVerbose('test message', false);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('calls console.error with the correct message format', () => {
      const message = 'verbose debug information';
      logVerbose(message, true);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(`[ruler:verbose] ${message}`);
    });
  });

  describe('centralized logging functions', () => {
    let consoleErrorSpy: jest.SpyInstance;
    let consoleLogSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });

    describe('logInfo', () => {
      it('uses [ruler] prefix by default', () => {
        logInfo('test message');
        expect(consoleLogSpy).toHaveBeenCalledWith('[ruler] test message');
      });

      it('uses [ruler:dry-run] prefix when dryRun is true', () => {
        logInfo('test message', true);
        expect(consoleLogSpy).toHaveBeenCalledWith('[ruler:dry-run] test message');
      });
    });

    describe('logWarn', () => {
      it('uses [ruler] prefix by default', () => {
        logWarn('warning message');
        expect(consoleWarnSpy).toHaveBeenCalledWith('[ruler] warning message');
      });

      it('uses [ruler:dry-run] prefix when dryRun is true', () => {
        logWarn('warning message', true);
        expect(consoleWarnSpy).toHaveBeenCalledWith('[ruler:dry-run] warning message');
      });
    });

    describe('logError', () => {
      it('uses [ruler] prefix by default', () => {
        logError('error message');
        expect(consoleErrorSpy).toHaveBeenCalledWith('[ruler] error message');
      });

      it('uses [ruler:dry-run] prefix when dryRun is true', () => {
        logError('error message', true);
        expect(consoleErrorSpy).toHaveBeenCalledWith('[ruler:dry-run] error message');
      });
    });

    describe('logVerboseInfo', () => {
      it('does not log when isVerbose is false', () => {
        logVerboseInfo('verbose message', false);
        expect(consoleLogSpy).not.toHaveBeenCalled();
      });

      it('logs to stdout with [ruler] prefix when isVerbose is true', () => {
        logVerboseInfo('verbose message', true);
        expect(consoleLogSpy).toHaveBeenCalledWith('[ruler] verbose message');
      });

      it('logs to stdout with [ruler:dry-run] prefix when isVerbose and dryRun are true', () => {
        logVerboseInfo('verbose message', true, true);
        expect(consoleLogSpy).toHaveBeenCalledWith('[ruler:dry-run] verbose message');
      });
    });
  });
});