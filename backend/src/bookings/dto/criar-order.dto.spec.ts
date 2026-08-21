import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CriarOrderDto } from './criar-order.dto';

describe('CriarOrderDto', () => {
  it('rejects an empty itens array', async () => {
    const dto = plainToInstance(CriarOrderDto, { itens: [] });
    const erros = await validate(dto);
    expect(erros.some((e) => e.property === 'itens')).toBe(true);
  });

  it('rejects an item without quantidade', async () => {
    const dto = plainToInstance(CriarOrderDto, {
      itens: [{ ticketTypeId: 'a' }],
    });
    const erros = await validate(dto);
    expect(erros.length).toBeGreaterThan(0);
  });

  it('accepts a valid payload with two items, one with assentos', async () => {
    const dto = plainToInstance(CriarOrderDto, {
      itens: [
        { ticketTypeId: 'a', quantidade: 2 },
        { ticketTypeId: 'b', quantidade: 2, assentos: ['A1', 'A2'] },
      ],
    });
    const erros = await validate(dto);
    expect(erros).toHaveLength(0);
  });
});
