import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StripeService } from './stripe.service';

describe('StripeService', () => {
  let service: StripeService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        StripeService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'STRIPE_SECRET_KEY' ? 'sk_test_fake' : 'whsec_fake',
          },
        },
      ],
    }).compile();

    service = moduleRef.get(StripeService);
  });

  it('constructs without throwing when STRIPE_SECRET_KEY is set', () => {
    expect(service).toBeDefined();
  });

  describe('criarReembolso', () => {
    let refundsCreateMock: jest.Mock;

    beforeEach(() => {
      refundsCreateMock = jest
        .fn()
        .mockResolvedValue({ id: 're_test', status: 'succeeded' });
      (
        service as unknown as {
          client: { refunds: { create: jest.Mock } };
        }
      ).client.refunds.create = refundsCreateMock;
    });

    it('passes amount to Stripe when a partial refund amount is given', async () => {
      const resultado = await service.criarReembolso('pi_test', 1500);

      expect(refundsCreateMock).toHaveBeenCalledWith({
        payment_intent: 'pi_test',
        amount: 1500,
      });
      expect(resultado.id).toBe('re_test');
    });

    it('omits amount for a full refund when no amount is given', async () => {
      await service.criarReembolso('pi_test');

      expect(refundsCreateMock).toHaveBeenCalledWith({
        payment_intent: 'pi_test',
      });
    });
  });
});
