import { NextResponse } from 'next/server';

import { getAvailableApiSites, getCacheTime } from '@/lib/config';
import { addCorsHeaders, handleOptionsRequest } from '@/lib/cors';

export const runtime = 'edge';

// 处理OPTIONS预检请求（OrionTV客户端需要）
export async function OPTIONS() {
  return handleOptionsRequest();
}

// OrionTV 兼容接口
export async function GET(request: Request) {
  try {
    // 检查是否需要跳过缓存
    const url = new URL(request.url);
    const noCache = url.searchParams.has('t');
    
    const apiSites = await getAvailableApiSites();
    const cacheTime = await getCacheTime();

    const response = NextResponse.json(apiSites, {
      headers: {
        // 如果请求要求无缓存，则设置不缓存的头
        'Cache-Control': noCache 
          ? 'no-cache, no-store, must-revalidate' 
          : `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
        'CDN-Cache-Control': noCache 
          ? 'no-cache, no-store, must-revalidate' 
          : `public, s-maxage=${cacheTime}`,
        'Vercel-CDN-Cache-Control': noCache 
          ? 'no-cache, no-store, must-revalidate' 
          : `public, s-maxage=${cacheTime}`,
        'Pragma': noCache ? 'no-cache' : 'cache',
        'Expires': noCache ? '0' : new Date(Date.now() + cacheTime * 1000).toUTCString()
      },
    });
    return addCorsHeaders(response);
  } catch (error) {
    const response = NextResponse.json({ error: '获取资源失败' }, { status: 500 });
    return addCorsHeaders(response);
  }
}