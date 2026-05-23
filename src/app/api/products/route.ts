import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const products = await prisma.product.findMany({
    include: {
      stocks: {
        include: { warehouse: true }
      }
    }
  });

  const formatted = products.map(p => ({
    ...p,
    stocks: p.stocks.map(s => ({
      ...s,
      availableQuantity: s.totalQuantity - s.reservedQuantity
    }))
  }));

  return NextResponse.json(formatted);
}
