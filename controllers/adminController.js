const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.promoteToAdmin = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan' });

    const updated = await prisma.user.update({
      where: { id },
      data: { role: 'admin' },
      select: { id: true, username: true, email: true, role: true },
    });

    return res.json({ message: 'User dipromosikan jadi admin', user: updated });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
