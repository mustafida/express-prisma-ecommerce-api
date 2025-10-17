const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createVoucher = async (req, res) => {
  try {
    const {
      code,
      discountType,   // "PERCENTAGE" | "AMOUNT"
      discountValue,  // number/decimal
      minOrderValue,  // optional
      active = true,
      startAt,        // optional ISO
      endAt,          // optional ISO
      usageLimit,     // optional int
    } = req.body;

    if (!code || !discountType || discountValue == null) {
      return res.status(400).json({ message: 'code, discountType, discountValue wajib' });
    }

    const voucher = await prisma.voucher.create({
      data: {
        code,
        discountType,
        discountValue,
        minOrderValue: minOrderValue ?? null,
        active,
        startAt: startAt ? new Date(startAt) : null,
        endAt: endAt ? new Date(endAt) : null,
        usageLimit: usageLimit ?? null,
      },
    });

    return res.status(201).json(voucher);
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ message: 'Kode voucher sudah ada' });
    }
    return res.status(500).json({ message: error.message });
  }
};

exports.listVouchers = async (req, res) => {
  try {
    const { q = '', page = '1', limit = '10', active } = req.query;
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const take = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNum - 1) * take;

    const where = {};
    if (q) where.code = { contains: q, mode: 'insensitive' };
    if (active !== undefined) where.active = active === 'true';

    const [rows, total] = await Promise.all([
      prisma.voucher.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.voucher.count({ where }),
    ]);

    res.json({
      data: rows,
      meta: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.toggleVoucher = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const voucher = await prisma.voucher.findUnique({ where: { id } });
    if (!voucher) return res.status(404).json({ message: 'Voucher tidak ditemukan' });

    const updated = await prisma.voucher.update({
      where: { id },
      data: { active: !voucher.active },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
