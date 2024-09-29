import { PrismaClient } from '@prisma/client';
import { fetchRssItems, filterArticles, generateSummary } from './rssProcessor';
import axios from 'axios'; 

const prisma = new PrismaClient();

async function sendToServerChan(title: string, desp: string) {
    const scKey = process.env.SERVER_CHAN_KEY;
    if (!scKey) {
      throw new Error('SERVER_CHAN_KEY 未设置');
    }
  
    try {
      const response = await axios.post(`http://sctapi.ftqq.com/${scKey}.send`, {
        title,
        desp
      });
      interface ServerChanResponse {
        code: number;
        message?: string;
      }
      const data = response.data as ServerChanResponse;
      if (data.code !== 0) {
        console.error('发送消息到 Server酱 失败:', data.message);
      }
    } catch (error) {
      console.error('发送消息到 Server酱 时出错:', error);
    }
  }

interface Subscription {
  url: string;
  userId: number;
  id: number;
  // 可能还有其他属性
}

export async function fetchRssAndPush(subscription: Subscription, authorizationHeader: string, userFetchPeriodDays: number) {
  try {
    const items = await fetchRssItems(subscription.url);
    const currentDate = new Date();
    const fetchPeriodStart = new Date(currentDate.getTime() - userFetchPeriodDays * 24 * 60 * 60 * 1000);
    const articles = filterArticles(items.map(item => ({
      pubDate: item.pubDate as string,
      guid: item.guid as string,
      link: item.link as string,
      title: item.title as string,
      content: item.content as string
    })), fetchPeriodStart);

    const existingSummaries = await prisma.summary.findMany({
      where: {
        articleGuid: { in: articles.map(a => a.guid) },
        userId: subscription.userId,
        subscriptionId: subscription.id
      },
      select: { articleGuid: true }
    });

    const existingGuids = new Set(existingSummaries.map(s => s.articleGuid));
    const newArticles = articles.filter(a => !existingGuids.has(a.guid));

    const newSummaries = [];
    let pushContent = '';

    for (const article of newArticles) {
      const summary = await generateSummary(article, authorizationHeader);
      if (summary) {
        newSummaries.push({
          title: article.title,
          link: article.link,
          summary: summary,
          existingBefore: false
        });
        
        // 将摘要添加到推送内容中
        pushContent += `## ${article.title}\n\n${summary}\n\n阅读全文：${article.link}\n\n---\n\n`;

        try {
          await prisma.summary.create({
            data: {
              articleGuid: article.guid,
              content: summary,
              userId: subscription.userId,
              subscriptionId: subscription.id
            }
          });
        } catch (error: unknown) {
          if (error instanceof Error && 'code' in error && error.code !== 'P2002') {
            throw error;
          }
        }
      }
    }

    // 如果有新的摘要，发送一条合并的消息到 Server酱
    if (newSummaries.length > 0) {
      await sendToServerChan("今日推送", pushContent);
    }

    return {
      newSummaries,
      stats: {
        totalArticles: articles.length,
        processedArticles: newArticles.length
      }
    };
  } catch (error) {
    console.error('Error in fetchRssAndPush:', error);
    throw error;
  }
}