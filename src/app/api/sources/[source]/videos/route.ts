import { NextResponse } from 'next/server';

import { getAvailableApiSites, getCacheTime } from '@/lib/config';
import { addCorsHeaders, handleOptionsRequest } from '@/lib/cors';
import { cleanHtmlTags } from '@/lib/utils';
import { SearchResult } from '@/lib/types';

export const runtime = 'edge';

// 处理OPTIONS预检请求
export async function OPTIONS() {
  return handleOptionsRequest();
}

interface ApiVideoItem {
  vod_id: string;
  vod_name: string;
  vod_pic: string;
  vod_remarks?: string;
  vod_play_url?: string;
  vod_class?: string;
  vod_year?: string;
  vod_content?: string;
  vod_douban_id?: number;
  type_name?: string;
}

interface VideoListApiResponse {
  code: number;
  msg: string;
  page?: number;
  pagecount?: number;
  limit?: number;
  total?: number;
  list?: ApiVideoItem[];
}

export async function GET(
  request: Request,
  { params }: { params: { source: string } }
) {
  const { searchParams } = new URL(request.url);
  const sourceKey = params.source;
  const categoryId = searchParams.get('category') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');

  if (!sourceKey) {
    const response = NextResponse.json(
      { error: '缺少源参数' },
      { status: 400 }
    );
    return addCorsHeaders(response);
  }

  try {
    // 获取可用的API站点
    const apiSites = await getAvailableApiSites();
    const apiSite = apiSites.find((site) => site.key === sourceKey);

    if (!apiSite) {
      const response = NextResponse.json(
        { error: '指定的视频源不存在' },
        { status: 404 }
      );
      return addCorsHeaders(response);
    }

    // 构建视频列表获取URL
    let videoListUrl = `${apiSite.api}?ac=videolist&pg=${page}`;
    if (categoryId && categoryId !== 'all') {
      videoListUrl += `&t=${categoryId}`;
    }

    let data: VideoListApiResponse | null = null;
    
    try {
      // 添加超时处理
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(videoListUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        data = await response.json();
      }
    } catch (fetchError) {
      console.warn(`获取远程视频列表失败 (${sourceKey}):`, fetchError);
      // 继续使用默认数据
    }

    // 如果没有数据或数据格式不正确，返回空列表
    if (!data || !data.list || !Array.isArray(data.list)) {
      data = {
        code: 1,
        msg: 'success',
        page: page,
        pagecount: 0,
        total: 0,
        list: []
      };
    }

    if (!data.list || !Array.isArray(data.list)) {
      const cacheTime = await getCacheTime();
      const responseData = NextResponse.json(
        {
          source: sourceKey,
          source_name: apiSite.name,
          category: categoryId,
          videos: [],
          pagination: {
            current_page: page,
            total_pages: 0,
            total_count: 0,
            per_page: limit,
          },
        },
        {
          headers: {
            'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
            'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
            'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          },
        }
      );
      return addCorsHeaders(responseData);
    }

    // 处理视频数据
    const videos: SearchResult[] = data.list.map((item) => {
      let episodes: string[] = [];

      // 处理播放源拆分
      if (item.vod_play_url) {
        const m3u8Regex = /\$(https?:\/\/[^"'\s]+?\.m3u8)/g;
        const vod_play_url_array = item.vod_play_url.split('$$$');
        vod_play_url_array.forEach((url: string) => {
          const matches = url.match(m3u8Regex) || [];
          if (matches.length > episodes.length) {
            episodes = matches;
          }
        });
      }

      episodes = Array.from(new Set(episodes)).map((link: string) => {
        link = link.substring(1); // 去掉开头的 $
        const parenIndex = link.indexOf('(');
        return parenIndex > 0 ? link.substring(0, parenIndex) : link;
      });

      return {
        id: item.vod_id.toString(),
        title: item.vod_name.trim().replace(/\s+/g, ' '),
        poster: item.vod_pic,
        episodes,
        source: apiSite.key,
        source_name: apiSite.name,
        class: item.vod_class,
        year: item.vod_year
          ? item.vod_year.match(/\d{4}/)?.[0] || ''
          : 'unknown',
        desc: cleanHtmlTags(item.vod_content || ''),
        type_name: item.type_name,
        douban_id: item.vod_douban_id,
      };
    });

    const cacheTime = await getCacheTime();
    const responseData = NextResponse.json(
      {
        source: sourceKey,
        source_name: apiSite.name,
        category: categoryId,
        videos,
        pagination: {
          current_page: page,
          total_pages: data.pagecount || 0,
          total_count: data.total || 0,
          per_page: limit,
        },
      },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        },
      }
    );
    return addCorsHeaders(responseData);
  } catch (error) {
    console.error('获取视频列表失败:', error);
    const response = NextResponse.json(
      {
        error: '获取视频列表失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
    return addCorsHeaders(response);
  }
}