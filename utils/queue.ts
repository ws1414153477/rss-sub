import Queue from 'bull';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { fetchRssAndPush } from './rss';

const prisma = new PrismaClient();

const pushQueue = new Queue('push-queue', process.env.REDIS_URL || 'redis://localhost:6379');

let isQueueInitialized = false;
let setupPromise: Promise<void> | null = null;


export async function setupPushQueue() {
    if (setupPromise) {
        return setupPromise;
    }

    setupPromise = new Promise(async (resolve) => {
        if (isQueueInitialized) {
            console.log('Push queue already initialized');
            resolve();
            return;
        }

        const users = await prisma.user.findMany({
            where: {
                pushTime: {
                    not: null
                }
            }
        });

        for (const user of users) {
            if (user.pushTime) {
                await scheduleUserPush(user.id, user.pushTime);
            }
        }

        if (!pushQueue.isReady()) {
            console.log('Push queue is not ready, setting up process handler');
            pushQueue.process(async (job) => {
                console.log('开始处理推送任务:', job.data);
                try {
                    await processPushJob(job.data.userId);
                    console.log('推送任务处理成功:', job.data.userId);
                } catch (error) {
                    console.error('推送任务处理失败:', error);
                }
            });
        } else {
            console.log('Push queue is already ready');
        }

        isQueueInitialized = true;
        resolve();
    });

    return setupPromise;
}

export async function scheduleUserPush(userId: number, pushTime: string) {
    const [hour, minute] = pushTime.split(':');
    const cronExpression = `${minute} ${hour} * * *`;
    
    await pushQueue.removeRepeatable({ 
      jobId: `user-${userId}-push`,
      every: 0 // 添加这一行
    });
    
    await pushQueue.add(
        { userId },
        { 
            repeat: { cron: cronExpression },
            jobId: `user-${userId}-push`
        }
    );
    console.log(`Scheduled push for user ${userId} at ${pushTime} with cron: ${cronExpression}`);
}

export async function processPushJob(userId: number) {
    console.log(`开始处理用户 ${userId} 的推送任务`);
    try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new Error(`未找到用户 ${userId}`);
        }

        const subscriptions = await prisma.subscription.findMany({ where: { userId } });
        const allNewSummaries = [];

        for (const subscription of subscriptions) {
            const result = await fetchRssAndPush(subscription, generateToken(userId), user.fetchPeriodDays);
            allNewSummaries.push(...result.newSummaries);
        }

        if (allNewSummaries.length > 0) {
            // 这里可以添加发送推送通知的逻辑,例如发送邮件或其他通知方式
            console.log(`为用户 ${userId} 生成了 ${allNewSummaries.length} 条新摘要`);
        } else {
            console.log(`用户 ${userId} 没有新的摘要`);
        }

    } catch (error) {
        console.error(`处理用户 ${userId} 的推送任务时出错:`, error);
    }
}

function generateToken(userId: number): string {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        throw new Error('JWT_SECRET is not defined');
    }
    return jwt.sign({ userId }, jwtSecret, { expiresIn: '1d' });
}

pushQueue.on('completed', (job) => {
    console.log(`Job completed: ${job.id}`);
});

pushQueue.on('failed', (job, err) => {
    console.error(`Job failed: ${job.id}`, err);
});

pushQueue.on('error', (error) => {
    console.error('Queue error:', error);
});