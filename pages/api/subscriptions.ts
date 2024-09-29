import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../../utils/auth';
import { setupScheduler } from '../../utils/scheduler';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const userId = verifyToken(req);
  if (userId === null) {
    console.log('Authorization failed');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const subscriptions = await prisma.subscription.findMany({
        where: { userId }
      });
      return res.status(200).json(subscriptions);
    } catch (error) {
      console.error('获取订阅时出错:', error);
      return res.status(500).json({ error: '获取订阅失败' });
    }
  }

  if (req.method === 'POST') {
    const { url, title } = req.body;
    if (!url || !title) {
      return res.status(400).json({ error: '无效的请求数据' });
    }
    try {
      const newSubscription = await prisma.subscription.create({
        data: {
          url,
          title,
          userId,
          fetchPeriodDays: 3 // 默认为3天
        }
      });
      return res.status(201).json(newSubscription);
    } catch (error) {
      console.error('Error creating subscription:', error);
      return res.status(500).json({ error: '创建订阅失败', details: (error as Error).message });
    }
  }

  if (req.method === 'PUT') {
    if (req.query.action === 'pushTime') {
      const { pushTime } = req.body;
      if (typeof pushTime !== 'string' || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(pushTime)) {
        console.log('无效的推送时间格式:', pushTime);
        return res.status(400).json({ error: '无效的推送时间格式', details: { pushTime } });
      }
      
      try {
        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: { pushTime }
        });
        
        // 重新设置定时任务
        await setupScheduler();
        console.log('已为用户重新设置定时任务:', userId, '推送时间:', pushTime);
        
        if (!updatedUser) {
          return res.status(500).json({ message: '更新推送时间失败' });
        }
        return res.status(200).json({ message: '推送时间更新成功', pushTime: updatedUser.pushTime });
      } catch (error: unknown) {
        console.error('更新推送时间时出错:', error);
        return res.status(500).json({ error: '更新推送时间失败', details: (error as Error).message });
      }
    } else {
      const { fetchPeriodDays } = req.body;
      if (typeof fetchPeriodDays !== 'number') {
        return res.status(400).json({ error: '无效的请求数据', details: { fetchPeriodDays } });
      }
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { fetchPeriodDays }
        });
        return res.status(200).json({ message: '订阅周期更新成功' });
      } catch (error: unknown) {
        console.error('Error updating fetch period:', error);
        return res.status(500).json({ error: '更新订阅周期失败', details: (error as Error).message });
      }
    }
  }

  if (req.method === 'PUT' && req.query.action === 'pushTime') {
    const { pushTime } = req.body;
    
    if (typeof pushTime !== 'string' || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(pushTime)) {
      console.log('Invalid pushTime format:', pushTime);
      return res.status(400).json({ error: '无效的推送时间格式', details: { pushTime } });
    }
    
    try {
      const result = await prisma.$executeRaw`
        UPDATE User
        SET pushTime = ${pushTime}
        WHERE id = ${userId}
      `;
      console.log('Update result:', result);
      
      const updatedUser = await prisma.user.findUnique({
        where: { id: userId }
      });
      console.log('Updated user:', updatedUser);
      
      if (!updatedUser) {
        return res.status(500).json({ message: '更新推送时间失败' });
      }
      return res.status(200).json({ message: '推送时间更新成功', pushTime: updatedUser.pushTime });
    } catch (error) {
      console.error('Error updating push time:', error);
      return res.status(500).json({ error: '更新推送时间失败', details: (error as Error).message });
    }
  }

  if (req.method === 'PATCH') {
    const { id } = req.query;
    const { fetchPeriodDays } = req.body;
    
    if (typeof id !== 'string') {
      return res.status(400).json({ error: '无效的订阅ID' });
    }
  
    const parsedId = parseInt(id, 10);
    const parsedFetchPeriodDays = parseInt(fetchPeriodDays, 10);
  
    if (isNaN(parsedId) || isNaN(parsedFetchPeriodDays)) {
      return res.status(400).json({ error: '无效的请求数据', details: { id, fetchPeriodDays } });
    }
  
    try {
      const updatedSubscription = await prisma.subscription.updateMany({
        where: { id: parsedId, userId },
        data: { fetchPeriodDays: parsedFetchPeriodDays }
      });
      if (updatedSubscription.count === 0) {
        return res.status(404).json({ error: '未找到订阅' });
      }
      return res.status(200).json({ message: '订阅周期更新成功' });
    } catch (error) {
      console.error('Error updating subscription period:', error);
      return res.status(500).json({ error: '更新订阅周期失败', details: (error as Error).message });
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (typeof id !== 'string') {
      return res.status(400).json({ error: '无效的订阅ID' });
    }
    try {
      // 首先删除与该订阅相关的所有摘要
      await prisma.summary.deleteMany({
        where: { 
          userId,
          subscriptionId: parseInt(id)
        }
      });

      // 然后删除订阅
      const deletedSubscription = await prisma.subscription.deleteMany({
        where: { id: parseInt(id), userId }
      });

      if (deletedSubscription.count === 0) {
        return res.status(404).json({ error: '未找到订阅' });
      }
      return res.status(200).json({ message: '订阅及其相关摘要已成功删除' });
    } catch (error) {
      console.error('Error deleting subscription:', error);
      return res.status(500).json({ error: '删除订阅失败', details: (error as Error).message });
    }
  }

  // 如果没有匹配的处理逻辑，返回 405 Method Not Allowed
  res.status(405).json({ error: 'Method not allowed' });
}