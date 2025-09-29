/* eslint-disable react-hooks/exhaustive-deps */

'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';

// 客户端收藏 API
import {
  type Favorite,
  clearAllFavorites,
  getAllFavorites,
  getAllPlayRecords,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { getDoubanCategories } from '@/lib/douban.client';
import { DoubanItem } from '@/lib/types';

import CapsuleSwitch from '@/components/CapsuleSwitch';
import ContinueWatching from '@/components/ContinueWatching';
import HorizontalCategoryTree from '@/components/HorizontalCategoryTree';
import PageLayout from '@/components/PageLayout';
import PaginatedRow from '@/components/PaginatedRow';
import { useSite } from '@/components/SiteProvider';
import VideoCard from '@/components/VideoCard';

// 主内容区大型 KatelyaTV Logo 组件
const MainKatelyaLogo = () => {
  return (
    <div className='main-logo-container'>
      {/* 背景光效 */}
      <div className='logo-background-glow'></div>

      {/* 主 Logo */}
      <div className='main-katelya-logo'>KatelyaTV</div>

      {/* 副标题 */}
      <div className='mt-3 text-center'>
        <div className='main-logo-subtitle'>极致影视体验，尽在指尖</div>
      </div>

      {/* 装饰性粒子效果 */}
      <div className='logo-particles'>
        <div className='particle particle-1'></div>
        <div className='particle particle-2'></div>
        <div className='particle particle-3'></div>
        <div className='particle particle-4'></div>
        <div className='particle particle-5'></div>
        <div className='particle particle-6'></div>
      </div>
    </div>
  );
};

// KatelyaTV 底部 Logo 组件
const BottomKatelyaLogo = () => {
  return (
    <div className='bottom-logo-container'>
      {/* 浮动几何形状装饰 */}
      <div className='floating-shapes'>
        <div className='shape'></div>
        <div className='shape'></div>
        <div className='shape'></div>
        <div className='shape'></div>
      </div>

      <div className='text-center'>
        <div className='bottom-logo'>KatelyaTV</div>
        <div className='mt-2 text-sm text-gray-500 dark:text-gray-400 opacity-75'>
          Powered by KatelyaTV Core
        </div>
      </div>
    </div>
  );
};

function HomeClient() {
  const [activeTab, setActiveTab] = useState<'home' | 'favorites' | 'sources'>('home');
  const [hotMovies, setHotMovies] = useState<DoubanItem[]>([]);
  const [hotTvShows, setHotTvShows] = useState<DoubanItem[]>([]);
  const [hotVarietyShows, setHotVarietyShows] = useState<DoubanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { announcement } = useSite();

  // 分页状态管理
  const [moviePage, setMoviePage] = useState(0);
  const [tvShowPage, setTvShowPage] = useState(0);
  const [varietyShowPage, setVarietyShowPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState({
    movies: false,
    tvShows: false,
    varietyShows: false,
  });
  const [hasMoreData, setHasMoreData] = useState({
    movies: true,
    tvShows: true,
    varietyShows: true,
  });

  const [showAnnouncement, setShowAnnouncement] = useState(false);

  // 检查公告弹窗状态
  useEffect(() => {
    if (typeof window !== 'undefined' && announcement) {
      const hasSeenAnnouncement = localStorage.getItem('hasSeenAnnouncement');
      if (hasSeenAnnouncement !== announcement) {
        setShowAnnouncement(true);
      } else {
        setShowAnnouncement(Boolean(!hasSeenAnnouncement && announcement));
      }
    }
  }, [announcement]);

  // 收藏夹数据
  type FavoriteItem = {
    id: string;
    source: string;
    title: string;
    poster: string;
    episodes: number;
    source_name: string;
    currentEpisode?: number;
    search_title?: string;
  };

  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([]);

  // 指定源相关状态
  const [availableSources, setAvailableSources] = useState<{key: string, name: string}[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [sourceCategories, setSourceCategories] = useState<{id: string, name: string}[]>([]);
  const [sourceCategoryTree, setSourceCategoryTree] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sourceVideos, setSourceVideos] = useState<any[]>([]);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourcePage, setSourcePage] = useState(1);
  const [sourcePagination, setSourcePagination] = useState<any>(null);
  
  // 指定源搜索相关状态
  const [sourceSearchQuery, setSourceSearchQuery] = useState<string>('');
  const [sourceSearchResults, setSourceSearchResults] = useState<any[]>([]);
  const [sourceSearchLoading, setSourceSearchLoading] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);

  useEffect(() => {
    const fetchDoubanData = async () => {
      try {
        setLoading(true);

        // 并行获取热门电影、热门剧集和热门综艺
        const [moviesData, tvShowsData, varietyShowsData] = await Promise.all([
          getDoubanCategories({
            kind: 'movie',
            category: '热门',
            type: '全部',
          }),
          getDoubanCategories({ kind: 'tv', category: 'tv', type: 'tv' }),
          getDoubanCategories({ kind: 'tv', category: 'show', type: 'show' }),
        ]);

        if (moviesData.code === 200) {
          setHotMovies(moviesData.list);
        }

        if (tvShowsData.code === 200) {
          setHotTvShows(tvShowsData.list);
        }

        if (varietyShowsData.code === 200) {
          setHotVarietyShows(varietyShowsData.list);
        }
      } catch (error) {
        // 静默处理错误，避免控制台警告
        // console.error('获取豆瓣数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDoubanData();
  }, []);

  // 加载更多电影
  const loadMoreMovies = async () => {
    if (loadingMore.movies || !hasMoreData.movies) return;

    setLoadingMore(prev => ({ ...prev, movies: true }));
    try {
      const nextPage = moviePage + 1;
      const moviesData = await getDoubanCategories({
        kind: 'movie',
        category: '热门',
        type: '全部',
        pageStart: nextPage * 20,
        pageLimit: 20,
      });

      if (moviesData.code === 200 && moviesData.list.length > 0) {
        setHotMovies(prev => [...prev, ...moviesData.list]);
        setMoviePage(nextPage);
        // 如果返回的数据少于请求的数量，说明没有更多数据了
        if (moviesData.list.length < 20) {
          setHasMoreData(prev => ({ ...prev, movies: false }));
        }
      } else {
        setHasMoreData(prev => ({ ...prev, movies: false }));
      }
    } catch (error) {
      // 静默处理错误
    } finally {
      setLoadingMore(prev => ({ ...prev, movies: false }));
    }
  };

  // 加载更多剧集
  const loadMoreTvShows = async () => {
    if (loadingMore.tvShows || !hasMoreData.tvShows) return;

    setLoadingMore(prev => ({ ...prev, tvShows: true }));
    try {
      const nextPage = tvShowPage + 1;
      const tvShowsData = await getDoubanCategories({
        kind: 'tv',
        category: 'tv',
        type: 'tv',
        pageStart: nextPage * 20,
        pageLimit: 20,
      });

      if (tvShowsData.code === 200 && tvShowsData.list.length > 0) {
        setHotTvShows(prev => [...prev, ...tvShowsData.list]);
        setTvShowPage(nextPage);
        if (tvShowsData.list.length < 20) {
          setHasMoreData(prev => ({ ...prev, tvShows: false }));
        }
      } else {
        setHasMoreData(prev => ({ ...prev, tvShows: false }));
      }
    } catch (error) {
      // 静默处理错误
    } finally {
      setLoadingMore(prev => ({ ...prev, tvShows: false }));
    }
  };

  // 加载更多综艺
  const loadMoreVarietyShows = async () => {
    if (loadingMore.varietyShows || !hasMoreData.varietyShows) return;

    setLoadingMore(prev => ({ ...prev, varietyShows: true }));
    try {
      const nextPage = varietyShowPage + 1;
      const varietyShowsData = await getDoubanCategories({
        kind: 'tv',
        category: 'show',
        type: 'show',
        pageStart: nextPage * 20,
        pageLimit: 20,
      });

      if (varietyShowsData.code === 200 && varietyShowsData.list.length > 0) {
        setHotVarietyShows(prev => [...prev, ...varietyShowsData.list]);
        setVarietyShowPage(nextPage);
        if (varietyShowsData.list.length < 20) {
          setHasMoreData(prev => ({ ...prev, varietyShows: false }));
        }
      } else {
        setHasMoreData(prev => ({ ...prev, varietyShows: false }));
      }
    } catch (error) {
      // 静默处理错误
    } finally {
      setLoadingMore(prev => ({ ...prev, varietyShows: false }));
    }
  };

  // 处理收藏数据更新的函数
  const updateFavoriteItems = async (allFavorites: Record<string, Favorite>) => {
    const allPlayRecords = await getAllPlayRecords();

    // 根据保存时间排序（从近到远）
    const sorted = Object.entries(allFavorites)
      .sort(([, a], [, b]) => b.save_time - a.save_time)
      .map(([key, fav]) => {
        const plusIndex = key.indexOf('+');
        const source = key.slice(0, plusIndex);
        const id = key.slice(plusIndex + 1);

        // 查找对应的播放记录，获取当前集数
        const playRecord = allPlayRecords[key];
        const currentEpisode = playRecord?.index;

        return {
          id,
          source,
          title: fav.title,
          year: fav.year,
          poster: fav.cover,
          episodes: fav.total_episodes,
          source_name: fav.source_name,
          currentEpisode,
          search_title: fav?.search_title,
        } as FavoriteItem;
      });
    setFavoriteItems(sorted);
  };

  // 当切换到收藏夹时加载收藏数据
  useEffect(() => {
    if (activeTab !== 'favorites') return;

    const loadFavorites = async () => {
      const allFavorites = await getAllFavorites();
      await updateFavoriteItems(allFavorites);
    };

    loadFavorites();

    // 监听收藏更新事件
    const unsubscribe = subscribeToDataUpdates(
      'favoritesUpdated',
      (newFavorites: Record<string, Favorite>) => {
        updateFavoriteItems(newFavorites);
      }
    );

    return unsubscribe;
  }, [activeTab]);

  const handleCloseAnnouncement = (announcement: string) => {
    setShowAnnouncement(false);
    localStorage.setItem('hasSeenAnnouncement', announcement); // 记录已查看弹窗
  };

  // 加载可用的视频源列表
  const loadAvailableSources = async () => {
    try {
      // 添加no-cache参数避免缓存问题
      const response = await fetch('/api/search/resources?t=' + Date.now(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
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

  // 加载指定源的分类信息
  const loadSourceCategories = async (sourceKey: string) => {
    try {
      console.log('开始加载分类:', sourceKey);
      const response = await fetch(`/api/sources/${sourceKey}/categories`);
      console.log('分类API响应状态:', response.status);
      const data = await response.json();
      console.log('分类API响应数据:', data);
      
      if (data.categories && Array.isArray(data.categories)) {
        setSourceCategories(data.categories);
        console.log('设置sourceCategories:', data.categories.length);
      }
      if (data.categoryTree && Array.isArray(data.categoryTree)) {
        setSourceCategoryTree(data.categoryTree);
        console.log('设置sourceCategoryTree:', data.categoryTree.length);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
      setSourceCategories([]);
      setSourceCategoryTree([]);
    }
  };

  // 加载指定源和分类下的视频列表
  const loadSourceVideos = async (sourceKey: string, categoryId: string, page: number, append = false) => {
    try {
      setSourceLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });
      if (categoryId && categoryId !== 'all') {
        params.append('category', categoryId);
      }
      
      const response = await fetch(`/api/sources/${sourceKey}/videos?${params}`);
      const data = await response.json();
      
      if (data.videos && Array.isArray(data.videos)) {
        if (append) {
          setSourceVideos(prev => [...prev, ...data.videos]);
        } else {
          setSourceVideos(data.videos);
        }
        setSourcePagination(data.pagination);
        // 更新当前页码状态
        setSourcePage(page);
      }
    } catch (error) {
      console.error('加载视频列表失败:', error);
    } finally {
      setSourceLoading(false);
    }
  };

  // 指定源搜索功能（联动分类）
  const searchInSource = async (sourceKey: string, query: string, categoryId: string = selectedCategory) => {
    if (!query.trim()) {
      setIsSearchMode(false);
      setSourceSearchResults([]);
      return;
    }

    try {
      setSourceSearchLoading(true);
      setIsSearchMode(true);
      
      // 构建搜索参数，包含分类信息
      const params = new URLSearchParams({
        q: query.trim(),
        source: sourceKey
      });
      
      // 如果有选中的分类且不是"全部"，加入分类名称参数进行精确搜索
      if (categoryId && categoryId !== 'all') {
        // 从分类树中找到对应的分类名称
        const findCategoryName = (categories: any[], id: string): string | null => {
          for (const category of categories) {
            if (category.id === id) {
              return category.name;
            }
            if (category.children) {
              const found = findCategoryName(category.children, id);
              if (found) return found;
            }
          }
          return null;
        };
        
        const categoryName = findCategoryName(sourceCategoryTree, categoryId);
        if (categoryName) {
          params.append('category', categoryName);
        }
      }
      
      const response = await fetch(`/api/search?${params.toString()}`);
      const data = await response.json();
      
      if (data.regular_results && Array.isArray(data.regular_results)) {
        setSourceSearchResults(data.regular_results);
      } else {
        setSourceSearchResults([]);
      }
    } catch (error) {
      console.error('指定源搜索失败:', error);
      setSourceSearchResults([]);
    } finally {
      setSourceSearchLoading(false);
    }
  };

  // 清除搜索状态
  const clearSourceSearch = () => {
    setSourceSearchQuery('');
    setSourceSearchResults([]);
    setIsSearchMode(false);
    // 重新加载当前分类的视频
    if (selectedSource) {
      setSourceVideos([]);
      setSourcePage(1);
      loadSourceVideos(selectedSource, selectedCategory, 1);
    }
  };

  // 当切换到指定源标签页时加载视频源列表
  useEffect(() => {
    if (activeTab === 'sources') {
      loadAvailableSources();
    }
    
    // 监听视频源更新事件
    const handleSourcesUpdate = () => {
      // 如果当前在指定源标签页，立即刷新视频源列表
      if (activeTab === 'sources') {
        loadAvailableSources();
      }
    };
    
    window.addEventListener('videoSourcesUpdated', handleSourcesUpdate);
    
    return () => {
      window.removeEventListener('videoSourcesUpdated', handleSourcesUpdate);
    };
  }, [activeTab]);

  return (
    <PageLayout>
      <div className='px-4 sm:px-8 lg:px-12 py-4 sm:py-8 overflow-visible'>
        {/* 主内容区大型 KatelyaTV Logo - 仅在首页显示 */}
        {activeTab === 'home' && <MainKatelyaLogo />}

        {/* 顶部 Tab 切换 */}
        <div className='mb-8 flex justify-center'>
          <CapsuleSwitch
            options={[
              { label: '首页', value: 'home' },
              { label: '收藏夹', value: 'favorites' },
              { label: '指定源', value: 'sources' },
            ]}
            active={activeTab}
            onChange={(value) => setActiveTab(value as 'home' | 'favorites' | 'sources')}
          />
        </div>

        {/* 主内容区域 - 优化为完全居中布局 */}
        <div className='w-full max-w-none mx-auto'>
          {activeTab === 'sources' ? (
            // 指定源视图
            <>
              {/* 视频源选择器和搜索框 */}
              <section className='mb-6'>
                <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200 mb-4'>
                  选择视频源
                </h2>
                <div className='flex flex-col sm:flex-row gap-4'>
                  {/* 视频源选择器 */}
                  <select
                    value={selectedSource}
                    onChange={(e) => {
                      const newSource = e.target.value;
                      console.log('选择视频源:', newSource);
                      setSelectedSource(newSource);
                      setSelectedCategory('all');
                      setSourceVideos([]);
                      setSourcePage(1);
                      // 清除搜索状态
                      clearSourceSearch();
                      if (newSource) {
                        console.log('开始加载分类:', newSource);
                        loadSourceCategories(newSource);
                        loadSourceVideos(newSource, 'all', 1);
                      } else {
                        setSourceCategories([]);
                        setSourceCategoryTree([]);
                      }
                    }}
                    className='flex-1 min-w-0 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors'
                  >
                    <option value=''>请选择视频源</option>
                    {availableSources.map((source) => (
                      <option key={source.key} value={source.key}>
                        {source.name}
                      </option>
                    ))}
                  </select>
                  
                  {/* 搜索框 */}
                  {selectedSource && (
                    <div className='flex-1 min-w-0 relative'>
                      <input
                        type='text'
                        placeholder={`在 ${availableSources.find(s => s.key === selectedSource)?.name || '当前源'} 中搜索...`}
                        value={sourceSearchQuery}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setSourceSearchQuery(newValue);
                          // 如果用户手动删除了所有内容，触发搜索显示当前分类下的所有视频
                          if (newValue === '') {
                            clearSourceSearch();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && sourceSearchQuery.trim()) {
                            searchInSource(selectedSource, sourceSearchQuery, selectedCategory);
                          }
                          if (e.key === 'Escape') {
                            clearSourceSearch();
                          }
                        }}
                        className='w-full px-4 py-3 pr-20 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-colors'
                      />
                      <div className='absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1'>
                        {sourceSearchQuery && (
                          <button
                            onClick={clearSourceSearch}
                            className='p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors'
                            title='清除搜索'
                          >
                            <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
                              <path fillRule='evenodd' d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z' clipRule='evenodd' />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => sourceSearchQuery.trim() && searchInSource(selectedSource, sourceSearchQuery, selectedCategory)}
                          disabled={!sourceSearchQuery.trim() || sourceSearchLoading}
                          className='p-1 text-green-500 hover:text-green-600 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors'
                          title='搜索'
                        >
                          {sourceSearchLoading ? (
                            <div className='w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin'></div>
                          ) : (
                            <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
                              <path fillRule='evenodd' d='M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z' clipRule='evenodd' />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {selectedSource && (
                <>
                  {/* 分类选择器 - 横向树形结构 */}
                  <section className='mb-6'>
                    <h3 className='text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3'>
                      分类筛选
                    </h3>
                    <HorizontalCategoryTree
                      categories={sourceCategoryTree}
                      selectedCategory={selectedCategory}
                      onCategorySelect={(categoryId) => {
                        setSelectedCategory(categoryId);
                        if (isSearchMode && sourceSearchQuery.trim()) {
                          // 如果在搜索模式下，重新执行搜索以应用新的分类筛选
                          searchInSource(selectedSource, sourceSearchQuery, categoryId);
                        } else {
                          // 否则正常加载分类视频
                          setSourceVideos([]);
                          setSourcePage(1);
                          loadSourceVideos(selectedSource, categoryId, 1);
                        }
                      }}
                    />
                  </section>

                  {/* 视频列表 */}
                  <section className='mb-8'>
                    <div className='mb-4 flex items-center justify-between'>
                      <h3 className='text-lg font-semibold text-gray-800 dark:text-gray-200'>
                        {isSearchMode ? (
                          <>
                            搜索结果
                            <span className='ml-2 text-sm text-gray-500 dark:text-gray-400'>
                              “{sourceSearchQuery}”
                              {selectedCategory !== 'all' && (
                                <span className='ml-1'>
                                  在 “{sourceCategoryTree.find(cat => cat.id === selectedCategory)?.name || 
                                      sourceCategoryTree.find(cat => cat.children?.some((child: any) => child.id === selectedCategory))?.children?.find((child: any) => child.id === selectedCategory)?.name || 
                                      '当前分类'}” 中
                                </span>
                              )}
                              ({sourceSearchResults.length} 个结果)
                            </span>
                          </>
                        ) : (
                          <>
                            视频列表
                            {sourcePagination && (
                              <span className='ml-2 text-sm text-gray-500 dark:text-gray-400'>
                                (共 {sourcePagination.total_count} 部)
                              </span>
                            )}
                          </>
                        )}
                      </h3>
                      {isSearchMode && (
                        <button
                          onClick={clearSourceSearch}
                          className='text-sm text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400 transition-colors'
                        >
                          返回分类浏览
                        </button>
                      )}
                    </div>
                    
                    {/* 分页控件 - 只在非搜索模式下显示 */}
                    {!isSearchMode && sourcePagination && sourcePagination.total_pages > 1 && (
                      <div className='flex items-center justify-center mb-4 space-x-2'>
                        <button
                          onClick={() => {
                            if (sourcePage > 1) {
                              loadSourceVideos(selectedSource, selectedCategory, sourcePage - 1);
                            }
                          }}
                          disabled={sourcePage === 1}
                          className='px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'
                        >
                          上一页
                        </button>
                        
                        <span className='text-gray-700 dark:text-gray-300'>
                          第 {sourcePage} 页 / 共 {sourcePagination.total_pages} 页
                        </span>
                        
                        <button
                          onClick={() => {
                            if (sourcePage < sourcePagination.total_pages) {
                              loadSourceVideos(selectedSource, selectedCategory, sourcePage + 1);
                            }
                          }}
                          disabled={sourcePage === sourcePagination.total_pages}
                          className='px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'
                        >
                          下一页
                        </button>
                      </div>
                    )}
                    
                    {/* 根据模式显示不同内容 */}
                    {isSearchMode ? (
                      // 搜索模式
                      sourceSearchLoading ? (
                        <PaginatedRow itemsPerPage={20}>
                          {Array.from({ length: 20 }).map((_, index) => (
                            <div key={index} className='w-full max-w-44'>
                              <div className='relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-green-200 animate-pulse dark:bg-green-800'>
                                <div className='absolute inset-0 bg-green-300 dark:bg-green-700'></div>
                              </div>
                              <div className='mt-2 h-4 bg-green-200 rounded animate-pulse dark:bg-green-800'></div>
                            </div>
                          ))}
                        </PaginatedRow>
                      ) : sourceSearchResults.length > 0 ? (
                        <PaginatedRow itemsPerPage={20}>
                          {sourceSearchResults.map((video) => (
                            <div key={video.id} className='w-full max-w-44'>
                              <VideoCard
                                {...video}
                                from='search'
                                type={video.episodes && video.episodes.length > 1 ? 'tv' : 'movie'}
                              />
                            </div>
                          ))}
                        </PaginatedRow>
                      ) : (
                        <div className='text-center text-gray-500 py-8 dark:text-gray-400'>
                          未找到“{sourceSearchQuery}”的相关内容
                        </div>
                      )
                    ) : (
                      // 分类浏览模式
                      sourceLoading ? (
                        // 加载状态
                        <PaginatedRow itemsPerPage={20}>
                          {Array.from({ length: 20 }).map((_, index) => (
                            <div key={index} className='w-full max-w-44'>
                              <div className='relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-purple-200 animate-pulse dark:bg-purple-800'>
                                <div className='absolute inset-0 bg-purple-300 dark:bg-purple-700'></div>
                              </div>
                              <div className='mt-2 h-4 bg-purple-200 rounded animate-pulse dark:bg-purple-800'></div>
                            </div>
                          ))}
                        </PaginatedRow>
                      ) : sourceVideos.length > 0 ? (
                        <>
                          {/* 视频网格 - 每行5个视频，现在显示4行共20个视频 */}
                          <PaginatedRow 
                            itemsPerPage={20}
                            currentPage={sourcePage}
                            onPageChange={(page) => loadSourceVideos(selectedSource, selectedCategory, page)}
                            totalPages={sourcePagination?.total_pages}
                          >
                            {sourceVideos.map((video) => (
                              <div key={video.id} className='w-full max-w-44'>
                                <VideoCard
                                  {...video}
                                  from='search'
                                  type={video.episodes && video.episodes.length > 1 ? 'tv' : 'movie'}
                                />
                              </div>
                            ))}
                          </PaginatedRow>
                          
                          {/* 分页控件已移除 */}
                        </>
                      ) : (
                        <div className='text-center text-gray-500 py-8 dark:text-gray-400'>
                          {selectedSource ? '暂无视频内容' : '请先选择视频源'}
                        </div>
                      )
                    )}
                  </section>
                </>
              )}

              {/* 指定源页面底部 Logo */}
              <BottomKatelyaLogo />
            </>
          ) : activeTab === 'favorites' ? (
            // 收藏夹视图
            <>
              <section className='mb-8'>
                <div className='mb-4 flex items-center justify-between'>
                  <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                    我的收藏
                  </h2>
                  {favoriteItems.length > 0 && (
                    <button
                      className='text-sm text-gray-500 hover:text-purple-700 dark:text-gray-400 dark:hover:text-purple-300 transition-colors'
                      onClick={async () => {
                        await clearAllFavorites();
                        setFavoriteItems([]);
                      }}
                    >
                      清空
                    </button>
                  )}
                </div>
                {/* 优化收藏夹网格布局，确保在新的居中布局下完美对齐 */}
                <div className='grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-6 lg:gap-x-8 justify-items-center'>
                  {favoriteItems.map((item) => (
                    <div
                      key={item.id + item.source}
                      className='w-full max-w-44'
                    >
                      <VideoCard
                        query={item.search_title}
                        {...item}
                        from='favorite'
                        type={item.episodes > 1 ? 'tv' : ''}
                      />
                    </div>
                  ))}
                  {favoriteItems.length === 0 && (
                    <div className='col-span-full text-center text-gray-500 py-8 dark:text-gray-400'>
                      暂无收藏内容
                    </div>
                  )}
                </div>
              </section>

              {/* 收藏夹页面底部 Logo */}
              <BottomKatelyaLogo />
            </>
          ) : (
            // 首页视图
            <>
              {/* 继续观看 */}
              <ContinueWatching />

              {/* 热门电影 */}
              <section className='mb-8'>
                <div className='mb-4 flex items-center justify-between'>
                  <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                    热门电影
                  </h2>
                  <Link
                    href='/douban?type=movie'
                    className='flex items-center text-sm text-gray-500 hover:text-purple-700 dark:text-gray-400 dark:hover:text-purple-300 transition-colors'
                  >
                    查看更多
                    <ChevronRight className='w-4 h-4 ml-1' />
                  </Link>
                </div>
                <PaginatedRow 
                  itemsPerPage={10}
                  onLoadMore={loadMoreMovies}
                  hasMoreData={hasMoreData.movies}
                  isLoading={loadingMore.movies}
                >
                  {loading
                    ? // 加载状态显示灰色占位数据 (显示10个，2行x5列)
                      Array.from({ length: 10 }).map((_, index) => (
                        <div
                          key={index}
                          className='w-full'
                        >
                          <div className='relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-purple-200 animate-pulse dark:bg-purple-800'>
                            <div className='absolute inset-0 bg-purple-300 dark:bg-purple-700'></div>
                          </div>
                          <div className='mt-2 h-4 bg-purple-200 rounded animate-pulse dark:bg-purple-800'></div>
                        </div>
                      ))
                    : // 显示真实数据
                      hotMovies.map((movie, index) => (
                        <div
                          key={index}
                          className='w-full'
                        >
                          <VideoCard
                            from='douban'
                            title={movie.title}
                            poster={movie.poster}
                            douban_id={movie.id}
                            rate={movie.rate}
                            year={movie.year}
                            type='movie'
                          />
                        </div>
                      ))}
                </PaginatedRow>
              </section>

              {/* 热门剧集 */}
              <section className='mb-8'>
                <div className='mb-4 flex items-center justify-between'>
                  <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                    热门剧集
                  </h2>
                  <Link
                    href='/douban?type=tv'
                    className='flex items-center text-sm text-gray-500 hover:text-purple-700 dark:text-gray-400 dark:hover:text-purple-300 transition-colors'
                  >
                    查看更多
                    <ChevronRight className='w-4 h-4 ml-1' />
                  </Link>
                </div>
                <PaginatedRow 
                  itemsPerPage={10}
                  onLoadMore={loadMoreTvShows}
                  hasMoreData={hasMoreData.tvShows}
                  isLoading={loadingMore.tvShows}
                >
                  {loading
                    ? // 加载状态显示灰色占位数据 (显示10个，2行x5列)
                      Array.from({ length: 10 }).map((_, index) => (
                        <div
                          key={index}
                          className='w-full'
                        >
                          <div className='relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-purple-200 animate-pulse dark:bg-purple-800'>
                            <div className='absolute inset-0 bg-purple-300 dark:bg-purple-700'></div>
                          </div>
                          <div className='mt-2 h-4 bg-purple-200 rounded animate-pulse dark:bg-purple-800'></div>
                        </div>
                      ))
                    : // 显示真实数据
                      hotTvShows.map((show, index) => (
                        <div
                          key={index}
                          className='w-full'
                        >
                          <VideoCard
                            from='douban'
                            title={show.title}
                            poster={show.poster}
                            douban_id={show.id}
                            rate={show.rate}
                            year={show.year}
                          />
                        </div>
                      ))}
                </PaginatedRow>
              </section>

              {/* 热门综艺 */}
              <section className='mb-8'>
                <div className='mb-4 flex items-center justify-between'>
                  <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                    热门综艺
                  </h2>
                  <Link
                    href='/douban?type=show'
                    className='flex items-center text-sm text-gray-500 hover:text-purple-700 dark:text-gray-400 dark:hover:text-purple-300 transition-colors'
                  >
                    查看更多
                    <ChevronRight className='w-4 h-4 ml-1' />
                  </Link>
                </div>
                <PaginatedRow 
                  itemsPerPage={10}
                  onLoadMore={loadMoreVarietyShows}
                  hasMoreData={hasMoreData.varietyShows}
                  isLoading={loadingMore.varietyShows}
                >
                  {loading
                    ? // 加载状态显示灰色占位数据 (显示10个，2行x5列)
                      Array.from({ length: 10 }).map((_, index) => (
                        <div
                          key={index}
                          className='w-full'
                        >
                          <div className='relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-purple-200 animate-pulse dark:bg-purple-800'>
                            <div className='absolute inset-0 bg-purple-300 dark:bg-purple-700'></div>
                          </div>
                          <div className='mt-2 h-4 bg-purple-200 rounded animate-pulse dark:bg-purple-800'></div>
                        </div>
                      ))
                    : // 显示真实数据
                      hotVarietyShows.map((show, index) => (
                        <div
                          key={index}
                          className='w-full'
                        >
                          <VideoCard
                            from='douban'
                            title={show.title}
                            poster={show.poster}
                            douban_id={show.id}
                            rate={show.rate}
                            year={show.year}
                          />
                        </div>
                      ))}
                </PaginatedRow>
              </section>

              {/* 首页底部 Logo */}
              <BottomKatelyaLogo />
            </>
          )}
        </div>
      </div>
      {announcement && showAnnouncement && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm dark:bg-black/70 p-4 transition-opacity duration-300 ${
            showAnnouncement ? '' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className='w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900 transform transition-all duration-300 hover:shadow-2xl'>
            <div className='flex justify-between items-start mb-4'>
              <h3 className='text-2xl font-bold tracking-tight text-gray-800 dark:text-white border-b border-purple-500 pb-1'>
                提示
              </h3>
              <button
                onClick={() => handleCloseAnnouncement(announcement)}
                className='text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-white transition-colors'
                aria-label='关闭'
              ></button>
            </div>
            <div className='mb-6'>
              <div className='relative overflow-hidden rounded-lg mb-4 bg-purple-50 dark:bg-purple-900/20'>
                <div className='absolute inset-y-0 left-0 w-1.5 bg-purple-500 dark:bg-purple-400'></div>
                <p className='ml-4 text-gray-600 dark:text-gray-300 leading-relaxed'>
                  {announcement}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleCloseAnnouncement(announcement)}
              className='w-full rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 px-4 py-3 text-white font-medium shadow-md hover:shadow-lg hover:from-purple-700 hover:to-purple-800 dark:from-purple-600 dark:to-purple-700 dark:hover:from-purple-700 dark:hover:to-purple-800 transition-all duration-300 transform hover:-translate-y-0.5'
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeClient />
    </Suspense>
  );
}
