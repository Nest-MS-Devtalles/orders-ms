import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PRODUCT_SERVICE } from '../config/services';
import { envs } from '../config';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: PRODUCT_SERVICE,
        transport: Transport.TCP,
        options: {
          host: envs.productsMsHost,
          port: envs.productsMsPort,
        },
      },
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
