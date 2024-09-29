import { NextApiRequest } from 'next';
import jwt from 'jsonwebtoken';

export function verifyToken(req: NextApiRequest): number | null {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET is not defined');
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
    return decoded.userId as number;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}