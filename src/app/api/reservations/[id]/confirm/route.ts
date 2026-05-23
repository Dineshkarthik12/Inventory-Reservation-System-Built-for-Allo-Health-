import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { redis, acquireLock, releaseLock } from '@/lib/redis';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const { id } = resolvedParams;

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

  const lockKey = `lock:reservation:${id}`;
  const locked = await acquireLock(lockKey, 5);
  if (!locked) return cacheResponse(503, { error: 'System busy' });

  try {
    const res = await prisma.reservation.findUnique({ where: { id } });
    if (!res) return cacheResponse(404, { error: 'Reservation not found' });
    if (res.status === 'CONFIRMED') return cacheResponse(200, { message: 'Already confirmed', reservation: res });
    if (res.status === 'RELEASED') return cacheResponse(410, { error: 'Reservation has been released' });
    if (new Date() > res.expiresAt) return cacheResponse(410, { error: 'Reservation expired' });

    const result = await prisma.$transaction(async (tx) => {
      const updatedRes = await tx.reservation.update({
        where: { id },
        data: { status: 'CONFIRMED' }
      });
      await tx.stock.update({
        where: { productId_warehouseId: { productId: res.productId, warehouseId: res.warehouseId } },
        data: {
          totalQuantity: { decrement: res.quantity },
          reservedQuantity: { decrement: res.quantity },
        }
      });
      return updatedRes;
    });

    return cacheResponse(200, result);
  } catch (error) {
    console.error('Confirm error:', error);
    return cacheResponse(500, { error: 'Internal Server Error' });
  } finally {
    await releaseLock(lockKey);
  }
}
