import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { redis, acquireLock, releaseLock } from '@/lib/redis';
import { z } from 'zod';

const schema = z.object({
  productId: z.string(),
  warehouseId: z.string(),
  quantity: z.number().int().positive(),
});

export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get('Idempotency-Key');
  if (idempotencyKey) {
    const cached = await redis.get(`idempotency:${idempotencyKey}`);
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached as { status: number, body: any };
      return NextResponse.json(parsed.body, { status: parsed.status });
    }
  }

  const cacheResponse = (status: number, body: any) => {
    if (idempotencyKey) redis.set(`idempotency:${idempotencyKey}`, JSON.stringify({ status, body }), { ex: 86400 });
    return NextResponse.json(body, { status });
  };

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return cacheResponse(400, parsed.error);

  const { productId, warehouseId, quantity } = parsed.data;
  const lockKey = `lock:stock:${productId}:${warehouseId}`;

  // Simplistic retry for lock
  let locked = false;
  for (let i = 0; i < 20; i++) {
    locked = await acquireLock(lockKey, 5);
    if (locked) break;
    await new Promise(r => setTimeout(r, 100)); // wait 100ms
  }

  if (!locked) {
    return NextResponse.json({ error: 'System busy, please try again' }, { status: 503 });
  }

  try {
    const stock = await prisma.stock.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } }
    });

    if (!stock) return cacheResponse(404, { error: 'Stock not found' });
    
    const available = stock.totalQuantity - stock.reservedQuantity;
    if (available < quantity) {
      return cacheResponse(409, { error: 'Not enough stock available' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedStock = await tx.stock.update({
        where: { productId_warehouseId: { productId, warehouseId } },
        data: { reservedQuantity: { increment: quantity } }
      });
      const reservation = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
          idempotencyKey: idempotencyKey || null,
        }
      });
      return { reservation, available: updatedStock.totalQuantity - updatedStock.reservedQuantity };
    });

    return cacheResponse(201, result);
  } catch (error) {
    console.error('Reservation error:', error);
    return cacheResponse(500, { error: 'Internal Server Error' });
  } finally {
    await releaseLock(lockKey);
  }
}
