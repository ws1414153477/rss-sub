import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../../utils/auth';
import { fetchRssAndPush } from '../../utils/rss';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = verifyToken(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const subscriptions = await prisma.subscription.findMany({ where: { userId } });
      const allNewSummaries = [];
      let totalArticles = 0;
      let totalProcessedArticles = 0;

      for (const subscription of subscriptions) {
        const authHeader = req.headers.authorization;
        if (typeof authHeader !== 'string') {
          throw new Error('Authorization header is missing or invalid');
        }
        const result = await fetchRssAndPush(subscription, authHeader, user.fetchPeriodDays);
        allNewSummaries.push(...result.newSummaries);
        totalArticles += result.stats.totalArticles;
        totalProcessedArticles += result.stats.processedArticles;
      }

      console.log(`抓取了最近 ${user.fetchPeriodDays} 天的 ${totalArticles} 篇文章，去重后处理了 ${totalProcessedArticles} 篇`);

      res.status(200).json({ 
        summaries: allNewSummaries, 
        newSummariesCount: allNewSummaries.length,
        stats: {
          totalArticles,
          processedArticles: totalProcessedArticles
        }
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      res.status(500).json({ error: 'Error fetching RSS', details: errorMessage });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}