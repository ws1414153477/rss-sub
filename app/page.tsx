"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import dynamic from 'next/dynamic';

const FaSearch = dynamic(() => import('react-icons/fa').then(mod => mod.FaSearch), { ssr: false });
const FaTrash = dynamic(() => import('react-icons/fa').then(mod => mod.FaTrash), { ssr: false });
const FaEraser = dynamic(() => import('react-icons/fa').then(mod => mod.FaEraser), { ssr: false });

interface Subscription {
  id: number;
  url: string;
  title: string;
}

interface LoginResponse {
  token: string;
}

interface RssResponse {
  feed: {
    title: string;
  };
}

interface Summary {
  id: number;
  title: string;
  content: string;
  link: string;
  summary: string;
}

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [newSubscription, setNewSubscription] = useState('');
  const [summaries, setSummaries] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [fetchPeriod, setFetchPeriod] = useState(3);
  const [isEditing, setIsEditing] = useState(false);
  const [tempFetchPeriod, setTempFetchPeriod] = useState(fetchPeriod);
  const [pushTime, setPushTime] = useState('');
  const [isEditingPushTime, setIsEditingPushTime] = useState(false);
  const [tempPushTime, setTempPushTime] = useState(pushTime);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredSubscriptions, setFilteredSubscriptions] = useState<Subscription[]>([]);
  const itemsPerPage = 10;

  const updateFetchPeriod = async (newPeriod: number) => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.error('No token found');
      return;
    }
  
    try {
      await axios.put('/api/subscriptions', 
        { fetchPeriodDays: newPeriod }, 
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      setFetchPeriod(newPeriod);
      fetchSubscriptions();
    } catch (error) {
      console.error('Failed to update fetch period:', error);
    }
  };

  const updatePushTime = async (newTime: string) => {
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(newTime)) {
      console.error('Invalid push time format:', newTime);
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put('/api/subscriptions?action=pushTime', 
        { pushTime: newTime },
        {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('Push time update response:', response.data);
      setPushTime(newTime);
      fetchSubscriptions();
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error('Failed to update push time:', error.message);
      } else {
        console.error('Failed to update push time:', String(error));
      }
    }
  };

  const handleEditFetchPeriod = () => {
    setIsEditing(true);
    setTempFetchPeriod(fetchPeriod);
  };

  const handleSaveFetchPeriod = () => {
    setIsEditing(false);
    updateFetchPeriod(tempFetchPeriod);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleEditPushTime = () => {
    setIsEditingPushTime(true);
    setTempPushTime(pushTime);
  };

  const handleSavePushTime = () => {
    setIsEditingPushTime(false);
    updatePushTime(tempPushTime);
  };

  const handleCancelEditPushTime = () => {
    setIsEditingPushTime(false);
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsLoggedIn(true);
      fetchSubscriptions();
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const filtered = subscriptions.filter(sub => 
      sub.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.url.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredSubscriptions(filtered);
    setCurrentPage(1);
  }, [searchTerm, subscriptions]);

  const pageCount = Math.ceil(filteredSubscriptions.length / itemsPerPage);
  const paginatedSubscriptions = filteredSubscriptions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const response = await axios.post<LoginResponse>('/api/auth/login', { email, password });
      localStorage.setItem('token', response.data.token);
      setIsLoggedIn(true);
      fetchSubscriptions();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email || !password) {
      alert('邮箱和密码不能为空');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      alert('请输入有效的邮箱地址');
      return;
    }
    if (password.length < 6) {
      alert('密码长度至少为6个字符');
      return;
    }
    try {
      await axios.post('/api/auth/register', { email, password });
      alert('注册成功。请登录。');
    } catch (error) {
      console.error('注册失败:', error);
      alert('注册失败，请重试。');
    }
  };

  const fetchSubscriptions = async () => {
    try {
      const response = await axios.get('/api/subscriptions', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setSubscriptions(response.data as Subscription[]);
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error);
    }
  };

  const clearSubscriptionHistory = async (id: number) => {
    try {
      await axios.post(`/api/clearHistory?id=${id}`, null, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      alert('推送历史已清除');
      fetchSubscriptions();
      setSummaries([]);
    } catch (error) {
      console.error('清除推送历史失败:', error);
      alert('清除推送历史失败，请重试。');
    }
  };

  const getRssTitle = async (url: string) => {
    try {
      const response = await axios.get<RssResponse>(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`);
      return response.data.feed.title;
    } catch (error) {
      console.error('获取RSS标题失败:', error);
      return '默认标题';
    }
  };

  const addSubscription = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const url = newSubscription.trim();

      if (!url) {
        alert('请提供有效的URL');
        return;
      }

      const title = await getRssTitle(url);

      await axios.post('/api/subscriptions', { 
        url, 
        title
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setNewSubscription('');
      fetchSubscriptions();
    } catch (error) {
      console.error('Failed to add subscription:', error);
    }
  };

  const handleGenerateSummaries = async () => {
    setLoading(true);
    setSummaries([]);
    try {
      const response = await axios.get('/api/fetchRss', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        params: { fetchPeriodDays: fetchPeriod }
      });

      const { summaries } = response.data as {
        summaries: Summary[];
        newSummariesCount: number;
        existingSummariesCount: number;
      };

      if (!summaries || !Array.isArray(summaries)) {
        throw new Error('无效的摘要数据');
      }

      setSummaries(summaries);
    } catch (error: unknown) {
      console.error('获取或总结 RSS 时出错:', error);
      alert(`生成摘要时发生错误：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setSubscriptions([]);
    setSummaries([]);
  }, []);

  const deleteSubscription = async (id: number) => {
    try {
      await axios.delete(`/api/subscriptions?id=${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchSubscriptions();
    } catch (error) {
      console.error('Failed to delete subscription:', error);
      alert('删除订阅失败，请重试。');
    }
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-500 to-green-500">
        <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
          <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">登录 / 注册</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="邮箱"
              required
              className="w-full p-3 border border-gray-300 rounded-lg"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
              required
              className="w-full p-3 border border-gray-300 rounded-lg"
            />
            <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700">
              登录
            </button>
          </form>
          <form onSubmit={handleRegister}>
            <button type="submit" className="w-full mt-4 bg-green-600 text-white p-3 rounded-lg hover:bg-green-700">
              注册
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">RSS 阅读助手</h1>
          <div className="relative" ref={dropdownRef}>
            <button onClick={toggleDropdown} className="flex items-center focus:outline-none">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">{email ? email[0].toUpperCase() : 'U'}</span>
              </div>
              <svg className="ml-2 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1">
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  退出登录
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <div className="bg-white shadow-lg rounded-lg p-4 mb-6">
              <form onSubmit={addSubscription} className="mb-6">
                <div className="flex flex-col space-y-2">
                  <input
                    type="text"
                    value={newSubscription}
                    onChange={(e) => setNewSubscription(e.target.value)}
                    placeholder="添加新的RSS订阅"
                    required
                    className="p-3 border border-gray-300 rounded-lg"
                  />
                  <button type="submit" className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700">
                    添加订阅
                  </button>
                </div>
              </form>
              <div className="mb-6">
                <div className="flex items-center">
                  <label htmlFor="fetchPeriod" className="text-sm font-medium text-gray-700 mr-2">
                    订阅最近
                  </label>
                  <input
                    type="number"
                    id="fetchPeriod"
                    value={tempFetchPeriod}
                    onChange={(e) => {
                      const value = e.target.value === '' ? 0 : parseInt(e.target.value);
                      setTempFetchPeriod(value);
                    }}
                    min="1"
                    className="p-2 border border-gray-300 rounded-lg w-20 mr-2"
                    disabled={!isEditing}
                  />
                  <span className="text-gray-700">天</span>
                  {!isEditing ? (
                    <button onClick={handleEditFetchPeriod} className="ml-2 text-blue-600 hover:text-blue-800">
                      编辑
                    </button>
                  ) : (
                    <>
                      <button onClick={handleSaveFetchPeriod} className="ml-2 text-green-600 hover:text-green-800">
                        确认
                      </button>
                      <button onClick={handleCancelEdit} className="ml-2 text-red-600 hover:text-red-800">
                        取消
                      </button>
                    </>
                  )}
                </div>
                <div className="flex items-center mt-4">
                  <label htmlFor="pushTime" className="text-sm font-medium text-gray-700 mr-2">
                    推送时间
                  </label>
                  <input
                    type="time"
                    id="pushTime"
                    value={tempPushTime}
                    onChange={(e) => setTempPushTime(e.target.value)}
                    className="p-2 border border-gray-300 rounded-lg w-24 mr-2"
                    disabled={!isEditingPushTime}
                  />
                  {!isEditingPushTime ? (
                    <button onClick={handleEditPushTime} className="ml-2 text-blue-600 hover:text-blue-800">
                      编辑
                    </button>
                  ) : (
                    <>
                      <button onClick={handleSavePushTime} className="ml-2 text-green-600 hover:text-green-800">
                        确认
                      </button>
                      <button onClick={handleCancelEditPushTime} className="ml-2 text-red-600 hover:text-red-800">
                        取消
                      </button>
                    </>
                  )}
                </div>
              </div>
              <hr className="my-6 border-gray-200" />
              <div>
                <h2 className="text-xl font-semibold mb-3">订阅列表</h2>
                <div className="relative mb-3">
                  <input
                    type="text"
                    placeholder="搜索订阅..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md"
                  />
                  <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {paginatedSubscriptions.map((sub) => (
                    <div key={sub.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors">
                      <div className="flex-grow mr-2 overflow-hidden">
                        <h3 className="font-medium text-sm truncate">{sub.title}</h3>
                        <p className="text-xs text-gray-500 truncate">{sub.url}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => clearSubscriptionHistory(sub.id)}
                          className="text-blue-600 hover:text-blue-800"
                          title="清除推送历史"
                        >
                          <FaEraser size={16} />
                        </button>
                        <button
                          onClick={() => deleteSubscription(sub.id)}
                          className="text-red-600 hover:text-red-800"
                          title="删除订阅"
                        >
                          <FaTrash size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-3">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="bg-blue-500 text-white px-3 py-1 rounded text-sm disabled:bg-gray-300"
                  >
                    上一页
                  </button>
                  <span className="text-sm">{currentPage} / {pageCount}</span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, pageCount))}
                    disabled={currentPage === pageCount}
                    className="bg-blue-500 text-white px-3 py-1 rounded text-sm disabled:bg-gray-300"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={handleGenerateSummaries}
              disabled={loading}
              className="w-full bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
            >
              {loading ? '生成中...' : '推送摘要'}
            </button>
          </div>
          <div className="md:col-span-2">
            {loading && <p className="text-center mt-4">加载中...</p>}
            {summaries.length > 0 ? (
              <div className="space-y-4">
                {summaries.map((article, index) => (
                  <div key={index} className="bg-white shadow-lg rounded-lg p-4">
                    <h2 className="text-xl font-semibold mb-2">
                      <a href={article.link} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline">
                        {article.title}
                      </a>
                    </h2>
                    <ReactMarkdown className="text-gray-800 prose">{article.summary}</ReactMarkdown>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-100 rounded-lg p-8 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">还没有推送摘要</h3>
                <p className="mt-1 text-sm text-gray-500">点击"推送摘要"按钮开始获取您的 RSS 订阅内容摘要。</p>
                <div className="mt-6">
                  <button
                    onClick={handleGenerateSummaries}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    推送摘要
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
