import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../../utils/auth'; // 确保这行正确导入
import axios from 'axios';

interface QianwenResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

const prisma = new PrismaClient();

async function summarizeArticle(content: string): Promise<string> {
  const apiKey = process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error('DASHSCOPE_API_KEY 未设置');
  }

  try {
    const response = await axios.post<QianwenResponse>(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        model: "qwen-plus",
        messages: [
          { role: "system", content: "你是一个帮助总结文章的助手，总结内容不超过100字" },
          { role: "user", content: `请用中文总结以下文章：\n\n${content}` }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content || "无法生成摘要。";
  } catch (error) {
    console.error('调用通义千问 API 时出错:', error);
    return "生成摘要发生错误。";
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = verifyToken(req);
  if (token === null) {
    console.log('Invalid token');
    return res.status(401).json({ error: '无效的令牌' });
  }
  const userId = token;
  if (!userId) {
    console.log('Invalid user ID:', userId);
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'POST') {
    const { articles } = req.body;

    if (!Array.isArray(articles)) {
      return res.status(400).json({ error: 'Invalid request body' });
    }

    try {
      const summaries = await Promise.all(articles.map(async (article) => {
        const summary = await summarizeArticle(article.content);

        // 查找对应的订阅
        const subscription = await prisma.subscription.findFirst({
          where: { 
            userId: userId,
            url: article.feedUrl
          }
        });

        if (!subscription) {
          throw new Error(`Subscription not found for user ${userId} and feed ${article.feedUrl}`);
        }

        // 创建或更新 Summary 记录
        await prisma.summary.upsert({
          where: {
            articleGuid_userId_subscriptionId: {
              articleGuid: article.guid,
              userId: userId,
              subscriptionId: subscription.id
            }
          },
          update: {
            content: summary
          },
          create: {
            articleGuid: article.guid,
            content: summary,
            userId: userId,
            subscriptionId: subscription.id
          }
        });

        return {
          title: article.title,
          link: article.link,
          summary: summary
        };
      }));
      res.status(200).json({ summaries });
    } catch (error) {
      console.error('Error summarizing articles', error);
      res.status(500).json({ error: 'Error summarizing articles' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
