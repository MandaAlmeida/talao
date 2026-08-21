import { Module } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { BookingsCleanupService } from './bookings-cleanup.service';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [PaymentsModule],
  providers: [BookingsService, BookingsCleanupService, OrdersService],
  controllers: [BookingsController, OrdersController],
  exports: [BookingsService, OrdersService],
})
export class BookingsModule {}
