import { NextApiRequest, NextApiResponse } from 'next';
import { setupScheduler } from '../../utils/scheduler';

let isSetup = false;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    try {
      if (!isSetup) {
        await setupScheduler();
        isSetup = true;
      }
      console.log('Push queue setup completed successfully');
      res.status(200).json({ message: 'Push queue setup completed' });
    } catch (error: unknown) {
      console.error('Error setting up push queue:', error);
      res.status(500).json({ error: 'Failed to set up push queue', details: error instanceof Error ? error.message : String(error) });
    }
  } else {
    console.log('Invalid method for setup queue API');
    res.status(405).json({ error: 'Method not allowed' });
  }
}