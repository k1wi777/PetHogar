import type { Logger } from '@nestjs/common';
import type { EventEmitter2 } from '@nestjs/event-emitter';
import { emitirSeguro } from './emitir-seguro';

describe('emitirSeguro', () => {
  const logger = { error: jest.fn() } as unknown as Logger;
  const evento = { id: 1 };

  beforeEach(() => jest.clearAllMocks());

  it('emite el evento con su nombre', () => {
    const emit = jest.fn();
    emitirSeguro({ emit } as unknown as EventEmitter2, 'x.y', evento, logger);
    expect(emit).toHaveBeenCalledWith('x.y', evento);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('si un listener lanza, lo registra y no propaga el error', () => {
    const emit = jest.fn(() => {
      throw new Error('listener roto');
    });
    expect(() =>
      emitirSeguro({ emit } as unknown as EventEmitter2, 'x.y', evento, logger),
    ).not.toThrow();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('listener roto'));
  });
});
