import axios from 'axios';


const RSS2JSON_API = 'https://api.rss2json.com/v1/api.json';
const RSS2JSON_API_KEY = process.env.RSS2JSON_API_KEY;

interface RSSResponse {
  data: {
    items: Record<string, unknown>[];
  }
}

interface RssItem {
  pubDate: string;
  guid: string;
  link: string;
  title: string;
  content: string;
  // 添加其他必要的属性
}

export async function fetchRssItems(url: string) {
  if (!RSS2JSON_API_KEY) {
    throw new Error('RSS2JSON_API_KEY 未设置');
  }

  const response = await axios.get(RSS2JSON_API, {
    params: {
      rss_url: url,
      api_key: RSS2JSON_API_KEY,
      count: 50
    }
  });

  return (response as RSSResponse).data.items;
}

export function filterArticles(items: RssItem[], fetchPeriodStart: Date) {
  return items
    .filter(item => new Date(item.pubDate) >= fetchPeriodStart)
    .map(item => ({
      guid: item.guid || item.link,
      title: item.title,
      link: item.link,
      pubDate: new Date(item.pubDate),
      content: item.content.replace(/<[^>]*>?/gm, '')
    }));
}

interface Article {
  title: string;
  content: string;
}

interface AIResponseData {
  summaries?: Array<{ summary: string }>;
}

export async function generateSummary(article: Article, authorizationHeader: string) {
  try {
    const aiResponse = await axios.post(
      `${process.env.NEXT_PUBLIC_API_URL}/api/summarize`,
      { articles: [article] },
      { headers: { Authorization: authorizationHeader } }
    );

    return (aiResponse.data as AIResponseData)?.summaries?.[0]?.summary;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('Error calling summarize API:', error.message);
    } else {
      console.error('Unknown error calling summarize API');
    }
  }
  return null;
}