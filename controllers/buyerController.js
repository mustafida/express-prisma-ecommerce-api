const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * GET /buyer/me
 * - kembalikan profil buyer milik user login
 * - kalau belum ada, auto-bikinin row kosong biar konsisten
 */
exports.getMyBuyerProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    let buyer = await prisma.buyer.findUnique({ where: { id: userId } });
    if (!buyer) {
      buyer = await prisma.buyer.create({
        data: { id: userId }, // buat profil kosong
      });
    }

    return res.json(buyer);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * PUT/PATCH /buyer/me
 * - upsert profil buyer untuk user login
 * - hanya field yang diizinkan yang dipakai
 */
exports.upsertMyBuyerProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const allowed = [
      'fullName',
      'phone',
      'addressLine1',
      'addressLine2',
      'city',
      'province',
      'postalCode',
      'country',
    ];

    const data = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) data[k] = req.body[k];
    }

    const buyer = await prisma.buyer.upsert({
      where: { id: userId },
      update: data,
      create: { id: userId, ...data },
    });

    return res.json(buyer);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
