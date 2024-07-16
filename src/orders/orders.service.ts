import {
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { PrismaClient } from '@prisma/client';

import { firstValueFrom } from 'rxjs';
import { NATS_SERVICE } from '../config/services';
import { ChangeOrderStatusDto, OrderPaginationDto } from './dto';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService extends PrismaClient implements OnModuleInit {
  constructor(@Inject(NATS_SERVICE) private readonly client: ClientProxy) {
    super();
  }

  private readonly logger = new Logger(OrdersService.name);

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async create(createOrderDto: CreateOrderDto) {
    try {
      // 1. Confirmar ids de los productos
      const productsIds = createOrderDto.items.map((item) => item.productId);
      const products: any[] = await firstValueFrom(
        this.client.send({ cmd: 'validate_products' }, productsIds),
      );

      // 2. Calculos de los valores
      const totalAmount = createOrderDto.items.reduce((acc, orderItem) => {
        const price = products.find(
          (product) => product.id === orderItem.productId,
        ).price;

        return price * orderItem.quantity;
      }, 0);

      const totalItems = createOrderDto.items.reduce((acc, orderItem) => {
        return acc + orderItem.quantity;
      }, 0);

      // 3. Crear la ordenen db
      const order = await this.order.create({
        data: {
          totalAmount,
          totalItems,
          OrderItem: {
            createMany: {
              data: createOrderDto.items.map((item) => ({
                price: products.find((product) => product.id === item.productId)
                  .price,
                quantity: item.quantity,
                productId: item.productId,
              })),
            },
          },
        },
        include: {
          OrderItem: {
            select: {
              price: true,
              quantity: true,
              productId: true,
            },
          },
        },
      });

      return {
        ...order,
        OrderItem: order.OrderItem.map((item) => ({
          ...item,
          name: products.find((product) => product.id === item.productId).name,
        })),
      };
    } catch (error) {
      throw new RpcException({
        status: HttpStatus.BAD_REQUEST,
        message: 'Check logs for more information',
      });
    }
  }

  async findAll(orderPaginationDto: OrderPaginationDto) {
    const totalPages = await this.order.count({
      where: {
        status: orderPaginationDto.status,
      },
    });

    const currentPage = orderPaginationDto.page;
    const perPage = orderPaginationDto.limit;
    const status = orderPaginationDto.status;

    return {
      data: await this.order.findMany({
        skip: (currentPage - 1) * perPage,
        take: perPage,
        where: {
          status,
        },
      }),
      meta: {
        total: totalPages,
        page: currentPage,
        lastPage: Math.ceil(totalPages / perPage),
      },
    };
  }

  async findOne(id: string) {
    const order = await this.order.findUnique({
      where: { id },
      include: {
        OrderItem: {
          select: {
            price: true,
            quantity: true,
            productId: true,
          },
        },
      },
    });

    if (!order) {
      throw new RpcException({
        message: `Order with id ${id} not found`,
        status: HttpStatus.NOT_FOUND,
      });
    }

    const productsIds = order.OrderItem.map((item) => item.productId);
    const products: any[] = await firstValueFrom(
      this.client.send({ cmd: 'validate_products' }, productsIds),
    );

    return {
      ...order,
      OrderItem: order.OrderItem.map((item) => ({
        ...item,
        name: products.find((product) => product.id === item.productId).name,
      })),
    };
  }

  async changeStatus(changeOrderStatusDto: ChangeOrderStatusDto) {
    const { id, status } = changeOrderStatusDto;

    const order = await this.findOne(id);

    if (order.status === status) {
      return order;
    }

    return this.order.update({
      where: { id },
      data: { status },
    });
  }
}
