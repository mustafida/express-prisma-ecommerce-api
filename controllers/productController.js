// controllers/productController.js
const { PrismaClient, Prisma } = require('@prisma/client');
const prisma = new PrismaClient();

// helper Decimal (hindari float)
const D = (v) => new Prisma.Decimal(v ?? 0);

// CREATE (admin) - /products [POST]
exports.createProduct = async (req, res) => {
  try {
    const { name, price, description } = req.body;

    if (!name || price == null) {
      return res.status(400).json({ message: 'name dan price wajib diisi' });
    }

    // price Decimal
    let priceDec;
    try {
      priceDec = D(price);
    } catch {
      return res.status(400).json({ message: 'Format price tidak valid' });
    }

    const newProduct = await prisma.product.create({
      data: {
        name,
        price: priceDec,
        description: description ?? null,
        userId: req.user.id, // ambil dari JWT
      },
    });

    return res.status(201).json(newProduct);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// READ ALL (user) + search + pagination + sorting - /products [GET]
exports.getAllProducts = async (req, res) => {
  try {
    const {
      q = '',
      page = '1',
      limit = '10',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // pagination guard
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const take = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const skip = (pageNum - 1) * take;

    // sorting guard (whitelist kolom)
    const allowedSort = new Set(['createdAt', 'price', 'name', 'updatedAt']);
    const sortKey = allowedSort.has(sortBy) ? sortBy : 'createdAt';
    const sortDir = (String(sortOrder).toLowerCase() === 'asc') ? 'asc' : 'desc';

    // search condition
    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {};

    // query utama
    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { [sortKey]: sortDir },
        skip,
        take,
        include: {
          user: { select: { id: true, username: true, role: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    // agregasi rating untuk produk yang tampil
    const ids = items.map((p) => p.id);
    let aggMap = new Map();
    if (ids.length > 0) {
      const aggs = await prisma.rating.groupBy({
        by: ['productId'],
        where: { productId: { in: ids } },
        _avg: { value: true },
        _count: { _all: true },
      });
      aggMap = new Map(aggs.map((a) => [a.productId, a]));
    }

    const data = items.map((p) => {
      const a = aggMap.get(p.id);
      const avg = a?._avg?.value ?? null;
      const cnt = a?._count?._all ?? 0;
      return {
        ...p,
        avgRating: avg !== null ? Number(Number(avg).toFixed(2)) : null,
        ratingCount: cnt,
      };
    });

    const totalPages = Math.ceil(total / take);
    return res.json({
      data,
      meta: {
        total,
        page: pageNum,
        limit: take,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1,
        sortBy: sortKey,
        sortOrder: sortDir,
        q: q || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// READ ONE (user) - /products/:id [GET]
exports.getProductById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'ID tidak valid' });

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true } },
      },
    });
    if (!product) return res.status(404).json({ message: 'Produk tidak ditemukan' });

    // agregasi rating produk
    const agg = await prisma.rating.aggregate({
      where: { productId: id },
      _avg: { value: true },
      _count: { _all: true },
    });

    const avg =
      agg._avg.value !== null && agg._avg.value !== undefined
        ? Number(Number(agg._avg.value).toFixed(2))
        : null;

    return res.json({
      ...product,
      avgRating: avg,
      ratingCount: agg._count._all,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// UPDATE (admin) - /products/:id [PUT]
exports.updateProduct = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'ID tidak valid' });

    const { name, price, description } = req.body;

    const exists = await prisma.product.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ message: 'Produk tidak ditemukan' });

    let priceDec;
    if (price !== undefined) {
      try {
        priceDec = D(price);
      } catch {
        return res.status(400).json({ message: 'Format price tidak valid' });
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: name ?? exists.name,
        price: priceDec !== undefined ? priceDec : exists.price,
        description: description ?? exists.description,
      },
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// DELETE (admin) - /products/:id [DELETE]
exports.deleteProduct = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'ID tidak valid' });

    await prisma.product.delete({ where: { id } });
    return res.json({ message: 'Produk berhasil dihapus' });
  } catch (error) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ message: 'Produk tidak ditemukan' });
    }
    return res.status(500).json({ message: error.message });
  }
};
