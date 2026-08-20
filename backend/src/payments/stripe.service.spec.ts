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
          useValue: { get: (key: string) => (key === 'STRIPE_SECRET_KEY' ? 'sk_test_fake' : 'whsec_fake') },
        },
      ],
    }).compile();

    service = moduleRef.get(StripeService);
  });

  it('constructs without throwing when STRIPE_SECRET_KEY is set', () => {
    expect(service).toBeDefined();
  });
});
