import { logVerbose } from '../../../src/constants';

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
});