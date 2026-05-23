import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { acquireLock, releaseLock } from '@/lib/redis';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const { id } = resolvedParams;
  
  const lockKey = `lock:reservation:${id}`;
  const locked = await acquireLock(lockKey, 5);
  if (!locked) return NextResponse.json({ error: 'System busy' }, { status: 503 });

  try {
    const res = await prisma.reservation.findUnique({ where: { id } });
    if (!res) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (res.status !== 'PENDING') return NextResponse.json({ message: 'Already processed' }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const updatedRes = await tx.reservation.update({
        where: { id },
        data: { status: 'RELEASED' }
      });
      await tx.stock.update({
        where: { productId_warehouseId: { productId: res.productId, warehouseId: res.warehouseId } },
        data: { reservedQuantity: { decrement: res.quantity } }
      });
      return updatedRes;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Release error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  } finally {
    await releaseLock(lockKey);
  }
}
