import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const warehouses = await prisma.warehouse.findMany();
  return NextResponse.json(warehouses);
}
