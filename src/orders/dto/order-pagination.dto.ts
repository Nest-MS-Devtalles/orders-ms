import { IsEnum, IsOptional } from 'class-validator';
import { OrderStatus } from '@prisma/client';

import { PaginationDto } from '../../common';
import { OrderStatusList } from '../enums/order.enum';

export class OrderPaginationDto extends PaginationDto {
  @IsOptional()
  @IsEnum(OrderStatusList, {
    message: `status must be a valid enum value: ${OrderStatusList}`,
  })
  status?: OrderStatus;
}
