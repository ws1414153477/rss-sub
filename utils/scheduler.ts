import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { fetchRssAndPush } from './rss';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export async function setupScheduler() {
  const users = await prisma.user.findMany({
    where: { pushTime: { not: null } },
    include: { subscriptions: true }
  });

  users.forEach(user => {
    if (user.pushTime) {
      const [hour, minute] = user.pushTime.split(':');
      cron.schedule(`${minute} ${hour} * * *`, async () => {
        console.log(`执行用户 ${user.id} 的推送任务`);
        for (const subscription of user.subscriptions) {
          await fetchRssAndPush(subscription, `Bearer ${generateToken(user.id)}`, user.fetchPeriodDays);
        }
      });
    }
  });
}

function generateToken(userId: number): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not defined');
  }
  return jwt.sign({ userId }, secret, { expiresIn: '1d' });
}