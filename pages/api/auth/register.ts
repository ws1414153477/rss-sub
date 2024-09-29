// pages/api/auth/register.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
      await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
        },
      });
      res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
      console.error('User creation error:', error);
      res.status(400).json({ error: 'User creation failed' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}