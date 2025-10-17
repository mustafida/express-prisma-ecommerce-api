const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.upsertRating = async (req, res) => {
  try {
    const userId = req.user.id;
    const productId = Number(req.params.productId);
    const { value, comment } = req.body;

    const v = Number(value);
    if (!v || v < 1 || v > 5) {
      return res.status(400).json({ message: 'value harus 1..5' });
    }

    // pastikan product ada
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return res.status(404).json({ message: 'Produk tidak ditemukan' });

    const rating = await prisma.rating.upsert({
      where: { userId_productId: { userId, productId } }, // sesuai @@unique([userId, productId])
      update: { value: v, comment: comment ?? null },
      create: { userId, productId, value: v, comment: comment ?? null },
      select: { id: true, value: true, comment: true, productId: true, userId: true, updatedAt: true },
    });

    return res.status(200).json({ message: 'Rating tersimpan', rating });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.listProductRatings = async (req, res) => {
  try {
    const productId = Number(req.params.productId);
    const { page = '1', limit = '10' } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const take = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNum - 1) * take;

    // pastikan produk ada
    const exists = await prisma.product.findUnique({ where: { id: productId } });
    if (!exists) return res.status(404).json({ message: 'Produk tidak ditemukan' });

    const [rows, total, agg] = await Promise.all([
      prisma.rating.findMany({
        where: { productId },
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        include: { user: { select: { id: true, username: true } } },
      }),
      prisma.rating.count({ where: { productId } }),
      prisma.rating.aggregate({
        where: { productId },
        _avg: { value: true },
        _count: { _all: true },
      }),
    ]);

    return res.json({
      data: rows,
      meta: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take),
        average: agg._avg.value ? Number(agg._avg.value.toFixed(2)) : null,
        count: agg._count._all,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.getMyRatingForProduct = async (req, res) => {
  try {
    const userId = req.user.id;
    const productId = Number(req.params.productId);

    const rating = await prisma.rating.findUnique({
      where: { userId_productId: { userId, productId } },
      select: { id: true, value: true, comment: true, updatedAt: true },
    });

    if (!rating) return res.status(404).json({ message: 'Kamu belum memberi rating untuk produk ini' });
    return res.json(rating);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
