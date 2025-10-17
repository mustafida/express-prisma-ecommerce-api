const { PrismaClient, OrderStatus, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

// helper Decimal (hindari float)
const D = (v) => new Prisma.Decimal(v ?? 0);

// validate voucher
async function validateVoucher(code, subtotal) {
  if (!code) return { voucher: null, discount: D(0) };

  const now = new Date();
  const voucher = await prisma.voucher.findUnique({ where: { code } });
  if (!voucher || !voucher.active) return { voucher: null, discount: D(0) };

  if (voucher.startAt && now < voucher.startAt) return { voucher: null, discount: D(0) };
  if (voucher.endAt && now > voucher.endAt) return { voucher: null, discount: D(0) };
  if (voucher.usageLimit != null && voucher.usedCount >= voucher.usageLimit) {
    return { voucher: null, discount: D(0) };
  }
  if (voucher.minOrderValue && D(subtotal).lessThan(voucher.minOrderValue)) {
    return { voucher: null, discount: D(0) };
  }

  let discount = D(0);
  if (voucher.discountType === 'PERCENTAGE') {
    discount = D(subtotal).mul(voucher.discountValue).div(100).toDecimalPlaces(2);
  } else {
    // AMOUNT
    discount = Prisma.Decimal.min(D(voucher.discountValue), D(subtotal)).toDecimalPlaces(2);
  }
  return { voucher, discount };
}

/**
 * POST /orders
 * body: { items: [{productId, quantity}], voucherCode? }
 */
exports.createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const { items, voucherCode } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Items wajib diisi' });
    }

    // Ambil produk sekaligus, map per id untuk efisiensi
    const productIds = items.map(i => Number(i.productId));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, price: true },
    });

    const productMap = new Map(products.map(p => [p.id, p]));

    // Build orderItems dengan snapshot harga
    const orderItems = [];
    for (const it of items) {
      const pid = Number(it.productId);
      const qty = Math.max(parseInt(it.quantity ?? 1, 10), 1);
      const prod = productMap.get(pid);
      if (!prod) {
        return res.status(400).json({ message: `Produk ${pid} tidak ditemukan` });
      }
      const unitPrice = prod.price; // Decimal dari DB
      const subtotal = D(unitPrice).mul(qty).toDecimalPlaces(2);

      orderItems.push({
        productId: pid,
        quantity: qty,
        unitPrice: unitPrice,
        subtotal: subtotal,
      });
    }

    // subtotal order
    const subtotal = orderItems.reduce((acc, it) => acc.add(it.subtotal), D(0)).toDecimalPlaces(2);

    // voucher (opsional)
    const { voucher, discount } = await validateVoucher(voucherCode, subtotal);

    const total = D(subtotal).sub(discount).toDecimalPlaces(2);

    // Simpan dalam transaction
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          userId,
          status: OrderStatus.PENDING,
          subtotal,
          discount,
          total,
          voucherId: voucher ? voucher.id : null,
          items: {
            create: orderItems.map(it => ({
              productId: it.productId,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              subtotal: it.subtotal,
            })),
          },
        },
        include: {
          items: true,
          voucher: true,
        },
      });

      // Catatan: umumnya usedCount voucher dinaikkan saat order PAID,
      // tapi kalau tugasmu minta di saat create, aktifkan kode ini:
      // if (voucher) {
      //   await tx.voucher.update({
      //     where: { id: voucher.id },
      //     data: { usedCount: { increment: 1 } },
      //   });
      // }

      return order;
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * GET /orders
 * query (opsional): page, limit, status
 */
exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = '1', limit = '10', status } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const take = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNum - 1) * take;

    const where = { userId };
    if (status && Object.values(OrderStatus).includes(status)) {
      where.status = status;
    }

    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          items: { include: { product: { select: { id: true, name: true } } } },
          voucher: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    return res.json({
      data: rows,
      meta: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * GET /orders/:id
 * - hanya pemilik order atau admin
 */
exports.getOrderById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { id: true, name: true } } } },
        voucher: true,
        user: { select: { id: true, username: true, role: true } },
      },
    });
    if (!order) return res.status(404).json({ message: 'Order tidak ditemukan' });

    const isOwner = order.userId === req.user.id;
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Tidak boleh melihat order orang lain' });
    }

    return res.json(order);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * GET /orders/admin/list (admin)
 * query: page, limit, status, q (by username or email)
 */
exports.adminListOrders = async (req, res) => {
  try {
    const { page = '1', limit = '10', status, q = '' } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const take = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNum - 1) * take;

    const where = {};
    if (status && Object.values(OrderStatus).includes(status)) {
      where.status = status;
    }
    if (q) {
      where.user = {
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    const [rows, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          user: { select: { id: true, username: true, email: true } },
          voucher: true,
          items: true,
        },
      }),
      prisma.order.count({ where }),
    ]);

    return res.json({
      data: rows,
      meta: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * PATCH /orders/:id/status (admin)
 * body: { status: "PAID" | "SHIPPED" | "COMPLETED" | "CANCELED" }
 * - contoh kebijakan: increment voucher.usedCount saat status menjadi PAID
 */
exports.adminUpdateStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!Object.values(OrderStatus).includes(status)) {
      return res.status(400).json({ message: 'Status tidak valid' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.order.findUnique({ where: { id } });
      if (!before) return null;

      const after = await tx.order.update({
        where: { id },
        data: { status },
        include: { voucher: true },
      });

      // Kebijakan: hit voucher usage saat order jadi PAID (sekali saja)
      if (
        after.voucherId &&
        status === 'PAID' &&
        before.status !== 'PAID'
      ) {
        await tx.voucher.update({
          where: { id: after.voucherId },
          data: { usedCount: { increment: 1 } },
        });
      }

      return after;
    });

    if (!updated) return res.status(404).json({ message: 'Order tidak ditemukan' });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
