import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // 1. Clean existing data
  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.product.deleteMany();

  // 2. Create Warehouses
  const w1 = await prisma.warehouse.create({
    data: { name: 'Allo Warehouse 1', location: 'Tamil Nadu, India' },
  });
  const w2 = await prisma.warehouse.create({
    data: { name: 'Allo Warehouse 2', location: 'Karnataka, India' },
  });
  const w3 = await prisma.warehouse.create({
    data: { name: 'Allo Warehouse 3', location: 'Telangana, India' },
  });
  const w4 = await prisma.warehouse.create({
    data: { name: 'Allo Warehouse 4', location: 'Andhra Pradesh, India' },
  });

  // 3. Create Products
  const p1 = await prisma.product.create({
    data: {
      name: 'Ergonomic Chair',
      description: 'Premium office chair with lumbar support.',
      price: 299.99,
    },
  });
  const p2 = await prisma.product.create({
    data: {
      name: 'Wireless Keyboard',
      description: 'Mechanical wireless keyboard.',
      price: 129.5,
    },
  });
  const p3 = await prisma.product.create({
    data: {
      name: 'Noise-Cancelling Headphones',
      description: 'Over-ear noise-cancelling headphones.',
      price: 199.0,
    },
  });
  const p4 = await prisma.product.create({
    data: {
      name: 'Premium Monitor',
      description: 'High resolution monitor with high refresh rate.',
      price: 500.0,
    },
  });
  const p5 = await prisma.product.create({
    data: {
      name: 'X-ray Machine',
      description: 'X-ray Machine for hospital',
      price: 1000.0,
    },
  });
  const p6 = await prisma.product.create({
    data: {
      name: 'CT Scan Machine',
      description: 'CT Scan Machine for hospital',
      price: 15000.0,
    },
  });
  const p7 = await prisma.product.create({
    data: {
      name: 'MRI Machine',
      description: 'MRI Machine for hospital',
      price: 20000.0,
    },
  });

  // 4. Create Stock
  await prisma.stock.createMany({
    data: [
      { productId: p1.id, warehouseId: w1.id, totalQuantity: 50, reservedQuantity: 0 },
      { productId: p1.id, warehouseId: w2.id, totalQuantity: 30, reservedQuantity: 0 },
      
      { productId: p2.id, warehouseId: w1.id, totalQuantity: 100, reservedQuantity: 0 },
      { productId: p2.id, warehouseId: w2.id, totalQuantity: 150, reservedQuantity: 0 },

      // Low stock item
      { productId: p3.id, warehouseId: w1.id, totalQuantity: 2, reservedQuantity: 0 },
      { productId: p3.id, warehouseId: w2.id, totalQuantity: 0, reservedQuantity: 0 },
      { productId: p4.id, warehouseId: w1.id, totalQuantity: 10, reservedQuantity: 0 },
      { productId: p4.id, warehouseId: w2.id, totalQuantity: 15, reservedQuantity: 0 },
      { productId: p5.id, warehouseId: w1.id, totalQuantity: 20, reservedQuantity: 0 },
      { productId: p5.id, warehouseId: w2.id, totalQuantity: 25, reservedQuantity: 0 },
      { productId: p6.id, warehouseId: w1.id, totalQuantity: 30, reservedQuantity: 0 },
      { productId: p6.id, warehouseId: w2.id, totalQuantity: 35, reservedQuantity: 0 },
      { productId: p7.id, warehouseId: w1.id, totalQuantity: 40, reservedQuantity: 0 },
      { productId: p7.id, warehouseId: w2.id, totalQuantity: 45, reservedQuantity: 0 },
    ],
  });

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
