import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../../utils/auth';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = verifyToken(req);
  if (!userId) {
    return res.status(401).json({ error: '未授权' });
  }

  if (req.method === 'POST') {
    const { id } = req.query;
    if (typeof id !== 'string') {
      return res.status(400).json({ error: '无效的订阅ID' });
    }

    try {
      await prisma.summary.deleteMany({
        where: {
          userId: userId,
          subscriptionId: parseInt(id)
        }
      });

      return res.status(200).json({ message: '推送历史已成功清除' });
    } catch (error) {
      console.error('Error clearing push history:', error);
      return res.status(500).json({ error: '清除推送历史失败', details: (error as Error).message });
    }
  }

  res.status(405).json({ error: '方法不允许' });
}