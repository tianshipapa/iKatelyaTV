import { NextResponse } from 'next/server';

import { getAvailableApiSites,getCacheTime } from '@/lib/config';
import { addCorsHeaders, handleOptionsRequest } from '@/lib/cors';
import { getStorage } from '@/lib/db';
import { searchFromApi } from '@/lib/downstream';

export const runtime = 'edge';

// 处理OPTIONS预检请求（OrionTV客户端需要）
export async function OPTIONS() {
  return handleOptionsRequest();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const sourceFilter = searchParams.get('source'); // 单个视频源筛选
  const sourcesFilter = searchParams.get('sources'); // 多个视频源筛选（逗号分隔）
  const categoryFilter = searchParams.get('category'); // 分类筛选
  
  // 从 Authorization header 或 query parameter 获取用户名
  let userName: string | undefined = searchParams.get('user') || undefined;
  if (!userName) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      userName = authHeader.substring(7);
    }
  }

  if (!query) {
    const cacheTime = await getCacheTime();
    const response = NextResponse.json(
      { 
        regular_results: [],
        adult_results: []
      },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        },
      }
    );
    return addCorsHeaders(response);
  }

  try {
    // 检查是否明确要求包含成人内容（用于关闭过滤时的明确请求）
    const includeAdult = searchParams.get('include_adult') === 'true';
    
    // 获取用户的成人内容过滤设置
    let shouldFilterAdult = true; // 默认过滤
    if (userName) {
      try {
        const storage = getStorage();
        const userSettings = await storage.getUserSettings(userName);
        // 如果用户设置存在且明确设为false，则不过滤；否则默认过滤
        shouldFilterAdult = userSettings?.filter_adult_content !== false;
      } catch (error) {
        // 出错时默认过滤成人内容
        shouldFilterAdult = true;
      }
    }

    // 根据用户设置和明确请求决定最终的过滤策略
    const finalShouldFilter = shouldFilterAdult || !includeAdult;
    
    // 使用动态过滤方法，但不依赖缓存，实时获取设置
    let availableSites = finalShouldFilter 
      ? await getAvailableApiSites(true) // 过滤成人内容
      : await getAvailableApiSites(false); // 不过滤成人内容
    
    // 如果指定了视频源，只搜索该源或者指定的多个源
    if (sourcesFilter && sourcesFilter.trim() !== '') {
      // 多个视频源模式
      const requestedSources = sourcesFilter.trim().split(',').filter(s => s.trim() !== '');
      availableSites = availableSites.filter(site => requestedSources.includes(site.key));
      
      if (availableSites.length === 0) {
        const cacheTime = await getCacheTime();
        const response = NextResponse.json({ 
          regular_results: [], 
          adult_results: [],
          error: '指定的视频源都不存在或不可用'
        }, {
          headers: {
            'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
            'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
            'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          },
        });
        return addCorsHeaders(response);
      }
    } else if (sourceFilter && sourceFilter.trim() !== '') {
      // 单个视频源模式
      availableSites = availableSites.filter(site => site.key === sourceFilter.trim());
      if (availableSites.length === 0) {
        const cacheTime = await getCacheTime();
        const response = NextResponse.json({ 
          regular_results: [], 
          adult_results: [],
          error: '指定的视频源不存在或不可用'
        }, {
          headers: {
            'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
            'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
            'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          },
        });
        return addCorsHeaders(response);
      }
    }
    
    if (!availableSites || availableSites.length === 0) {
      const cacheTime = await getCacheTime();
      const response = NextResponse.json({ 
        regular_results: [], 
        adult_results: [] 
      }, {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        },
      });
      return addCorsHeaders(response);
    }

    // 搜索所有可用的资源站（已根据用户设置动态过滤）
    const searchPromises = availableSites.map((site) => {
      console.log(`搜索视频源: ${site.key} - ${site.name}`); // 调试信息
      return searchFromApi(site, query);
    });
    let searchResults = (await Promise.all(searchPromises)).flat();
    
    // 调试：检查搜索结果中的source_name
    console.log('\u641c索结果样本:', searchResults.slice(0, 2).map(r => ({title: r.title, source: r.source, source_name: r.source_name})));
    
    // 如果指定了分类筛选，过滤搜索结果
    if (categoryFilter && categoryFilter !== 'all' && categoryFilter.trim() !== '') {
      console.log(`应用分类过滤: ${categoryFilter}`);
      const originalCount = searchResults.length;
      
      // 直接使用传入的分类名称进行匹配
      const categoryName = categoryFilter.trim();
      const simpleName = categoryName.replace(/片$/, ''); // 去掉后缀"片"
      
      searchResults = searchResults.filter(result => {
        const resultCategory = result.class || result.type_name || '';
        
        return (
          resultCategory === categoryName ||
          resultCategory.includes(categoryName) ||
          resultCategory.split(',').map(c => c.trim()).includes(categoryName) ||
          (simpleName !== categoryName && (
            resultCategory.includes(simpleName) ||
            resultCategory.split(',').map(c => c.trim()).includes(simpleName)
          ))
        );
      });
      
      console.log(`分类过滤: ${categoryFilter} -> ${searchResults.length}/${originalCount} 结果`);
    }

    // 所有结果都作为常规结果返回，因为成人内容源已经在源头被过滤掉了
    const cacheTime = await getCacheTime();
    const response = NextResponse.json(
      { 
        regular_results: searchResults,
        adult_results: [] // 始终为空，因为成人内容在源头就被过滤了
      },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        },
      }
    );
    return addCorsHeaders(response);
  } catch (error) {
    const response = NextResponse.json(
      { 
        regular_results: [],
        adult_results: [],
        error: '搜索失败' 
      }, 
      { status: 500 }
    );
    return addCorsHeaders(response);
  }
}
