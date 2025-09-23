/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any */
'use client';

import { ChevronUp, Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import {
  addSearchHistory,
  clearSearchHistory,
  deleteSearchHistory,
  getSearchHistory,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { SearchResult } from '@/lib/types';

import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

function SearchPageClient() {
  // 搜索历史
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  // 返回顶部按钮显示状态
  const [showBackToTop, setShowBackToTop] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  
  // 视频源筛选状态
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [availableSources, setAvailableSources] = useState<Array<{key: string, name: string}>>([]);
  
  // 搜索框视频源选择器状态
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  
  // 分组结果状态
  const [groupedResults, setGroupedResults] = useState<{
    regular: SearchResult[];
    adult: SearchResult[];
  } | null>(null);
  
  // 分组标签页状态
  const [activeTab, setActiveTab] = useState<'regular' | 'adult'>('regular');

  // 获取默认聚合设置：只读取用户本地设置，默认为 true
  const getDefaultAggregate = () => {
    if (typeof window !== 'undefined') {
      const userSetting = localStorage.getItem('defaultAggregateSearch');
      if (userSetting !== null) {
        return JSON.parse(userSetting);
      }
    }
    return true; // 默认启用聚合
  };

  const [viewMode, setViewMode] = useState<'agg' | 'all'>(() => {
    return getDefaultAggregate() ? 'agg' : 'all';
  });

  // 聚合函数
  const aggregateResults = (results: SearchResult[]) => {
    const map = new Map<string, SearchResult[]>();
    results.forEach((item) => {
      // 使用 title + year + type 作为键
      const key = `${item.title.replaceAll(' ', '')}-${
        item.year || 'unknown'
      }-${item.episodes.length === 1 ? 'movie' : 'tv'}`;
      const arr = map.get(key) || [];
      arr.push(item);
      map.set(key, arr);
    });
    return Array.from(map.entries()).sort((a, b) => {
      // 优先排序：标题与搜索词完全一致的排在前面
      const aExactMatch = a[1][0].title
        .replaceAll(' ', '')
        .includes(searchQuery.trim().replaceAll(' ', ''));
      const bExactMatch = b[1][0].title
        .replaceAll(' ', '')
        .includes(searchQuery.trim().replaceAll(' ', ''));

      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;

      // 年份排序
      if (a[1][0].year === b[1][0].year) {
        return a[0].localeCompare(b[0]);
      } else {
        const aYear = a[1][0].year;
        const bYear = b[1][0].year;

        if (aYear === 'unknown' && bYear === 'unknown') {
          return 0;
        } else if (aYear === 'unknown') {
          return 1;
        } else if (bYear === 'unknown') {
          return -1;
        } else {
          return aYear > bYear ? -1 : 1;
        }
      }
    });
  };

  // 加载所有可用的视频源列表（用于搜索框下拉选项）
  const loadAvailableSources = async () => {
    try {
      const response = await fetch('/api/search/resources');
      const sources = await response.json();
      if (Array.isArray(sources)) {
        setAvailableSources(sources.map(source => ({
          key: source.key,
          name: source.name
        })));
      }
    } catch (error) {
      console.error('加载视频源列表失败:', error);
    }
  };

  // 处理视频源选择
  const handleSourceToggle = (sourceKey: string) => {
    setSelectedSource(sourceKey);
    setShowSourceDropdown(false);
    // 如果当前有搜索内容，自动触发搜索
    if (searchQuery.trim()) {
      const trimmed = searchQuery.trim();
      // 直接使用新的sourceKey，而不是selectedSource状态
      fetchSearchResults(trimmed, sourceKey);
    }
  };

  // 获取当前选中的源显示文本
  const getSelectedSourcesText = () => {
    return selectedSource 
      ? (availableSources.find(s => s.key === selectedSource)?.name || '全部源') 
      : '全部源';
  };

  useEffect(() => {
    // 无搜索参数时聚焦搜索框
    !searchParams.get('q') && document.getElementById('searchInput')?.focus();

    // 初始加载搜索历史
    getSearchHistory().then(setSearchHistory);
    
    // 加载可用的视频源列表
    loadAvailableSources();

    // 点击外部区域关闭下拉菜单
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.source-dropdown')) {
        setShowSourceDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };

  }, []);

  useEffect(() => {
    // 当搜索参数变化时更新搜索状态
    const query = searchParams.get('q');
    const source = searchParams.get('source') || '';
    
    // 更新选中的视频源
    setSelectedSource(source);
    
    if (query) {
      setSearchQuery(query);
      fetchSearchResults(query);

      // 保存到搜索历史 (事件监听会自动更新界面)
      addSearchHistory(query);
    } else {
      setShowResults(false);
    }
  }, [searchParams]);

  const fetchSearchResults = async (query: string, overrideSource?: string) => {
    try {
      setIsLoading(true);
      
      // 获取用户认证信息
      const authInfo = getAuthInfoFromBrowserCookie();
      
      // 构建请求头
      const headers: HeadersInit = {};
      if (authInfo?.username) {
        headers['Authorization'] = `Bearer ${authInfo.username}`;
      }
      
      // 简化的搜索请求 - 成人内容过滤现在在API层面自动处理
      // 添加时间戳参数避免缓存问题
      const timestamp = Date.now();
      let searchUrl = `/api/search?q=${encodeURIComponent(query.trim())}&t=${timestamp}`;
      
      // 处理视频源筛选（使用传入的overrideSource或当前状态）
      const sourceToUse = overrideSource !== undefined ? overrideSource : selectedSource;
      if (sourceToUse && sourceToUse !== '') {
        // 单选模式：传递单个源
        searchUrl += `&source=${encodeURIComponent(sourceToUse)}`;
      }
      
      const response = await fetch(
        searchUrl, 
        { 
          headers: {
            ...headers,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
      );
      const data = await response.json();
      
      // 处理新的搜索结果格式
      if (data.regular_results || data.adult_results) {
        // 处理分组结果
        const allResults = [...(data.regular_results || []), ...(data.adult_results || [])];
        setGroupedResults({
          regular: data.regular_results || [],
          adult: data.adult_results || []
        });
        setSearchResults(allResults);
        
        // 不再根据搜索结果更新视频源列表，保持显示所有可用源
        // updateAvailableSources(allResults);
      } else if (data.grouped) {
        // 兼容旧的分组格式
        const allResults = [...(data.regular || []), ...(data.adult || [])];
        setGroupedResults({
          regular: data.regular || [],
          adult: data.adult || []
        });
        setSearchResults(allResults);
        
        // 不再根据搜索结果更新视频源列表，保持显示所有可用源
        // updateAvailableSources(allResults);
      } else {
        // 兼容旧的普通结果格式
        const allResults = data.results || [];
        setGroupedResults(null);
        setSearchResults(allResults);
        
        // 不再根据搜索结果更新视频源列表，保持显示所有可用源
        // updateAvailableSources(allResults);
      }
      
      setShowResults(true);
    } catch (error) {
      setGroupedResults(null);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim().replace(/\s+/g, ' ');
    if (!trimmed) return;

    // 回显搜索框
    setSearchQuery(trimmed);
    setIsLoading(true);
    setShowResults(true);

    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    // 直接发请求
    fetchSearchResults(trimmed);

    // 保存到搜索历史 (事件监听会自动更新界面)
    addSearchHistory(trimmed);
  };

  // 返回顶部功能
  const scrollToTop = () => {
    try {
      // 根据调试结果，真正的滚动容器是 document.body
      document.body.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } catch (error) {
      // 如果平滑滚动完全失败，使用立即滚动
      document.body.scrollTop = 0;
    }
  };

  return (
    <PageLayout activePath='/search'>
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible mb-10'>
        {/* 搜索框 */}
        <div className='mb-8'>
          <form onSubmit={handleSearch} className='max-w-2xl mx-auto'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500' />
              
              {/* 视频源选择器（可收缩） */}
              {availableSources.length > 0 && (
                <div className='absolute left-10 top-1/2 -translate-y-1/2 z-10 source-dropdown'>
                  <div className='relative'>
                    <button
                      type='button'
                      onClick={() => setShowSourceDropdown(!showSourceDropdown)}
                      className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md border transition-all duration-200 bg-gradient-to-r from-gray-100 to-gray-50 border-gray-300 text-gray-700 hover:from-gray-200 hover:to-gray-100 dark:bg-gradient-to-r dark:from-gray-700 dark:to-gray-600 dark:border-gray-600 dark:text-gray-300"
                    >
                      <span className='max-w-12 truncate font-medium text-xs'>
                        {getSelectedSourcesText()}
                      </span>
                      <svg className={`w-3 h-3 transition-transform duration-200 ${
                        showSourceDropdown ? 'rotate-180' : ''
                      }`} fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M19 9l-7 7-7-7' />
                      </svg>
                    </button>
                    
                    {/* 下拉菜单 */}
                    {showSourceDropdown && (
                      <div className='absolute top-full left-0 mt-2 w-56 max-h-80 overflow-hidden bg-white border border-gray-200 rounded-lg shadow-xl z-20 dark:bg-gray-800 dark:border-gray-600'>
                        {/* 源列表 */}
                        <div className='max-h-60 overflow-y-auto'>
                          {/* 全部源选项 */}
                          <button
                            type='button'
                            onClick={() => {
                              setSelectedSource('');
                              setShowSourceDropdown(false);
                              // 如果当前有搜索内容，自动触发搜索
                              if (searchQuery.trim()) {
                                const trimmed = searchQuery.trim();
                                // 传递空字符串作为source参数，表示搜索所有源
                                fetchSearchResults(trimmed, '');
                              }
                            }}
                            className={`w-full text-left px-4 py-3 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors duration-150 flex items-center gap-3 ${
                              selectedSource === '' 
                                ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-500 dark:bg-blue-900/30 dark:text-blue-300' 
                                : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                              selectedSource === ''
                                ? 'bg-blue-500 border-blue-500'
                                : 'border-gray-300 dark:border-gray-600'
                            }`}>
                              {selectedSource === '' && (
                                <svg className='w-3 h-3 text-white' fill='currentColor' viewBox='0 0 20 20'>
                                  <path fillRule='evenodd' d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' clipRule='evenodd' />
                                </svg>
                              )}
                            </div>
                            <span className='font-medium'>全部视频源</span>
                            <div className='ml-auto px-2 py-1 bg-gray-100 dark:bg-gray-600 rounded-full text-xs text-gray-600 dark:text-gray-400'>
                              {availableSources.length}
                            </div>
                          </button>
                          
                          {/* 各个视频源选项 */}
                          {availableSources.map((source, index) => {
                            const isSelected = selectedSource === source.key;
                            
                            return (
                              <button
                                key={source.key}
                                type='button'
                                onClick={() => handleSourceToggle(source.key)}
                                className={`w-full text-left px-4 py-3 text-sm hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors duration-150 flex items-center gap-3 ${
                                  isSelected
                                    ? 'bg-green-50 text-green-700 border-r-2 border-green-500 dark:bg-green-900/30 dark:text-green-300'
                                    : 'text-gray-700 dark:text-gray-300'
                                }`}
                              >
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                  isSelected
                                    ? 'bg-green-500 border-green-500'
                                    : 'border-gray-300 dark:border-gray-600'
                                }`}>
                                  {isSelected && (
                                    <svg className='w-3 h-3 text-white' fill='currentColor' viewBox='0 0 20 20'>
                                      <path fillRule='evenodd' d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' clipRule='evenodd' />
                                    </svg>
                                  )}
                                </div>
                                <span className='font-medium'>{source.name}</span>
                                <div className={`ml-auto w-3 h-3 rounded-full ${
                                  index % 6 === 0 ? 'bg-red-400' :
                                  index % 6 === 1 ? 'bg-blue-400' :
                                  index % 6 === 2 ? 'bg-green-400' :
                                  index % 6 === 3 ? 'bg-yellow-400' :
                                  index % 6 === 4 ? 'bg-purple-400' : 'bg-pink-400'
                                }`} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <input
                id='searchInput'
                type='text'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='搜索电影、电视剧...'
                className={`w-full h-12 rounded-lg bg-gray-50/80 py-3 pr-4 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white border border-gray-200/50 shadow-sm dark:bg-gray-800 dark:text-gray-300 dark:placeholder-gray-500 dark:focus:bg-gray-700 dark:border-gray-700 ${
                  availableSources.length > 0 ? 'pl-24' : 'pl-10'
                }`}
              />
            </div>
          </form>
        </div>

        {/* 搜索结果或搜索历史 */}
        <div className='max-w-[95%] mx-auto mt-12 overflow-visible'>
          {isLoading ? (
            <div className='flex justify-center items-center h-40'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-green-500'></div>
            </div>
          ) : showResults ? (
            <section className='mb-12'>
              {/* 标题 + 聚合开关 */}
              <div className='mb-8 space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='flex flex-col'>
                    <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                      搜索结果
                    </h2>
                    {selectedSource && availableSources.length > 0 && (
                      <p className='text-sm text-gray-500 dark:text-gray-400 mt-1'>
                        来源: {availableSources.find(s => s.key === selectedSource)?.name || selectedSource}
                      </p>
                    )}
                  </div>
                  {/* 聚合开关 */}
                  <label className='flex items-center gap-2 cursor-pointer select-none'>
                    <span className='text-sm text-gray-700 dark:text-gray-300'>
                      聚合
                    </span>
                    <div className='relative'>
                      <input
                        type='checkbox'
                        className='sr-only peer'
                        checked={viewMode === 'agg'}
                        onChange={() =>
                          setViewMode(viewMode === 'agg' ? 'all' : 'agg')
                        }
                      />
                      <div className='w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                      <div className='absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4'></div>
                    </div>
                  </label>
                </div>
              </div>
              
              {/* 如果有分组结果且有成人内容，显示分组标签 */}
              {groupedResults && groupedResults.adult.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-center mb-4">
                    <div className="inline-flex p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <button
                        onClick={() => setActiveTab('regular')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          activeTab === 'regular'
                            ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                      >
                        常规结果 ({groupedResults.regular.length})
                      </button>
                      <button
                        onClick={() => setActiveTab('adult')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          activeTab === 'adult'
                            ? 'bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                      >
                        成人内容 ({groupedResults.adult.length})
                      </button>
                    </div>
                  </div>
                  {activeTab === 'adult' && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                      <p className="text-sm text-red-600 dark:text-red-400 text-center">
                        ⚠️ 以下内容可能包含成人资源，请确保您已年满18周岁
                      </p>
                    </div>
                  )}
                </div>
              )}
              <div
                key={`search-results-${viewMode}-${activeTab}`}
                className='justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8'
              >
                {(() => {
                  // 确定要显示的结果
                  let displayResults = searchResults;
                  if (groupedResults && groupedResults.adult.length > 0) {
                    displayResults = activeTab === 'adult' 
                      ? groupedResults.adult 
                      : groupedResults.regular;
                  }
                  
                  // 前端保障性筛选，确保只显示选中源的结果
                  if (selectedSource && selectedSource !== '') {
                    displayResults = displayResults.filter(item => item.source === selectedSource);
                  }

                  // 聚合显示模式
                  if (viewMode === 'agg') {
                    const aggregated = aggregateResults(displayResults);
                    return aggregated.map(([mapKey, group]: [string, SearchResult[]]) => (
                      <div key={`agg-${mapKey}`} className='w-full'>
                        <VideoCard
                          from='search'
                          items={group}
                          query={
                            searchQuery.trim() !== group[0].title
                              ? searchQuery.trim()
                              : ''
                          }
                        />
                      </div>
                    ));
                  }

                  // 列表显示模式
                  return displayResults.map((item) => (
                    <div
                      key={`all-${item.source}-${item.id}`}
                      className='w-full'
                    >
                      <VideoCard
                        id={item.id}
                        title={item.title}
                        poster={item.poster}
                        episodes={item.episodes.length}
                        source={item.source}
                        source_name={item.source_name}
                        douban_id={item.douban_id?.toString()}
                        query={
                          searchQuery.trim() !== item.title
                            ? searchQuery.trim()
                            : ''
                        }
                        year={item.year}
                        from='search'
                        type={item.episodes.length > 1 ? 'tv' : 'movie'}
                      />
                    </div>
                  ));
                })()}
                {(() => {
                  // 检查是否有结果显示
                  let displayResults = searchResults;
                  if (groupedResults && groupedResults.adult.length > 0) {
                    displayResults = activeTab === 'adult' 
                      ? groupedResults.adult 
                      : groupedResults.regular;
                  }
                  
                  if (displayResults.length === 0) {
                    const message = selectedSource && selectedSource !== '' 
                      ? `在 "${availableSources.find(s => s.key === selectedSource)?.name || selectedSource}" 中未找到相关结果`
                      : '未找到相关结果';
                      
                    return (
                      <div className='col-span-full text-center text-gray-500 py-8 dark:text-gray-400'>
                        {message}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </section>
          ) : searchHistory.length > 0 ? (
            // 搜索历史
            <section className='mb-12'>
              <h2 className='mb-4 text-xl font-bold text-gray-800 text-left dark:text-gray-200'>
                搜索历史
                {searchHistory.length > 0 && (
                  <button
                    onClick={() => {
                      clearSearchHistory(); // 事件监听会自动更新界面
                    }}
                    className='ml-3 text-sm text-gray-500 hover:text-red-500 transition-colors dark:text-gray-400 dark:hover:text-red-500'
                  >
                    清空
                  </button>
                )}
              </h2>
              <div className='flex flex-wrap gap-2'>
                {searchHistory.map((item) => (
                  <div key={item} className='relative group'>
                    <button
                      onClick={() => {
                        setSearchQuery(item);
                        // 构建 URL参数，保持当前选中的视频源
                        const params = new URLSearchParams({ q: item.trim() });
                        if (selectedSource && selectedSource !== '') {
                          params.set('source', selectedSource);
                        }
                        router.push(`/search?${params.toString()}`);
                      }}
                      className='px-4 py-2 bg-gray-500/10 hover:bg-gray-300 rounded-full text-sm text-gray-700 transition-colors duration-200 dark:bg-gray-700/50 dark:hover:bg-gray-600 dark:text-gray-300'
                    >
                      {item}
                    </button>
                    {/* 删除按钮 */}
                    <button
                      aria-label='删除搜索历史'
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        deleteSearchHistory(item); // 事件监听会自动更新界面
                      }}
                      className='absolute -top-1 -right-1 w-4 h-4 opacity-0 group-hover:opacity-100 bg-gray-400 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] transition-colors'
                    >
                      <X className='w-3 h-3' />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {/* 返回顶部悬浮按钮 */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-20 md:bottom-6 right-6 z-[500] w-12 h-12 bg-green-500/90 hover:bg-green-500 text-white rounded-full shadow-lg backdrop-blur-sm transition-all duration-300 ease-in-out flex items-center justify-center group ${
          showBackToTop
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        aria-label='返回顶部'
      >
        <ChevronUp className='w-6 h-6 transition-transform group-hover:scale-110' />
      </button>
    </PageLayout>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageClient />
    </Suspense>
  );
}
