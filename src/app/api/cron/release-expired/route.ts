import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { acquireLock, releaseLock } from '@/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Vercel automatically passes the CRON_SECRET via the Authorization header
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find all reservations that are pending but past their expiry time
  const expiredReservations = await prisma.reservation.findMany({
    where: {
      status: 'PENDING',
      expiresAt: { lt: new Date() }
    }
  });

  let processed = 0;

  for (const res of expiredReservations) {
    const lockKey = `lock:reservation:${res.id}`;
    // Lock the individual reservation so we don't race against the user confirming or cancelling it
    const locked = await acquireLock(lockKey, 5);
    
    if (!locked) continue;

    try {
      // Re-check status in case it changed right before lock was acquired
      const currentRes = await prisma.reservation.findUnique({ where: { id: res.id } });
      if (currentRes?.status !== 'PENDING') continue;

      await prisma.$transaction(async (tx) => {
        await tx.reservation.update({
          where: { id: res.id },
          data: { status: 'RELEASED' }
        });
        await tx.stock.update({
          where: { productId_warehouseId: { productId: res.productId, warehouseId: res.warehouseId } },
          data: { reservedQuantity: { decrement: res.quantity } }
        });
      });
      processed++;
    } catch (e) {
      console.error(`Error releasing expired reservation ${res.id}:`, e);
    } finally {
      await releaseLock(lockKey);
    }
  }

  return NextResponse.json({ success: true, processed });
}
