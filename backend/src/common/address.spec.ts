import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddressDto } from './address.dto.js';

describe('Fictional addresses', () => {
  it('normalizes subdomains without interpreting them as network URLs', async () => {
    const dto = plainToInstance(AddressDto, { address: '  Help.TidePool.ZZ ' });
    expect(dto.address).toBe('help.tidepool.zz');
    expect(await validate(dto)).toEqual([]);
  });

  it.each([
    'https://tidepool.zz',
    'tidepool.com',
    '//tidepool.zz',
    'tidepool.zz/path',
    'tidepool.zz:80',
    'tidepool.zz?q=x',
    'tidepool.zz#anchor',
    '-bad.zz',
    'bad-.zz',
    'a..zz',
    'a_b.zz',
    'zz',
    'a'.repeat(64) + '.zz',
    'abc.'.repeat(64) + 'zz',
    123,
    null,
  ])('rejects malformed identifier %s', async (address) => {
    expect(
      await validate(plainToInstance(AddressDto, { address })),
    ).not.toHaveLength(0);
  });
});
