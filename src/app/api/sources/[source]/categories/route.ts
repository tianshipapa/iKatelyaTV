import { NextResponse } from 'next/server';

import { getAvailableApiSites, getCacheTime } from '@/lib/config';
import { addCorsHeaders, handleOptionsRequest } from '@/lib/cors';

export const runtime = 'edge';

// 处理OPTIONS预检请求
export async function OPTIONS() {
  return handleOptionsRequest();
}

interface CategoryItem {
  type_id: string;
  type_name: string;
  type_pid?: string;
}

interface CategoryApiResponse {
  code: number;
  msg: string;
  page?: number;
  pagecount?: number;
  limit?: number;
  total?: number;
  list?: CategoryItem[];
  class?: CategoryItem[];
}

export async function GET(
  request: Request,
  { params }: { params: { source: string } }
) {
  const sourceKey = params.source;

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

    // 构建分类获取URL
    const categoryUrl = `${apiSite.api}?ac=list`;

    let categories: CategoryItem[] = [];
    
    try {
      // 添加超时处理
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(categoryUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data: CategoryApiResponse = await response.json();
        
        // 处理分类数据，优先使用class字段，否则使用list字段
        if (data.class && Array.isArray(data.class)) {
          categories = data.class;
        } else if (data.list && Array.isArray(data.list)) {
          categories = data.list;
        }
      }
    } catch (fetchError) {
      console.warn(`获取远程分类失败 (${sourceKey}):`, fetchError);
      // 继续使用默认分类
    }

    // 如果没有分类数据，提供默认分类（包含子分类）
    if (categories.length === 0) {
      categories = [
        { type_id: '1', type_name: '电影', type_pid: '0' },
        { type_id: '11', type_name: '动作片', type_pid: '1' },
        { type_id: '12', type_name: '喜剧片', type_pid: '1' },
        { type_id: '13', type_name: '爱情片', type_pid: '1' },
        { type_id: '14', type_name: '科幻片', type_pid: '1' },
        { type_id: '15', type_name: '恐怖片', type_pid: '1' },
        { type_id: '16', type_name: '战争片', type_pid: '1' },
        
        { type_id: '2', type_name: '电视剧', type_pid: '0' },
        { type_id: '21', type_name: '国产剧', type_pid: '2' },
        { type_id: '22', type_name: '美剧', type_pid: '2' },
        { type_id: '23', type_name: '韩剧', type_pid: '2' },
        { type_id: '24', type_name: '日剧', type_pid: '2' },
        { type_id: '25', type_name: '港台剧', type_pid: '2' },
        
        { type_id: '3', type_name: '综艺', type_pid: '0' },
        { type_id: '31', type_name: '真人秀', type_pid: '3' },
        { type_id: '32', type_name: '脱口秀', type_pid: '3' },
        { type_id: '33', type_name: '游戏竞技', type_pid: '3' },
        
        { type_id: '4', type_name: '动漫', type_pid: '0' },
        { type_id: '41', type_name: '国产动漫', type_pid: '4' },
        { type_id: '42', type_name: '日本动漫', type_pid: '4' },
        { type_id: '43', type_name: '欧美动漫', type_pid: '4' },
        
        { type_id: '5', type_name: '纪录片', type_pid: '0' },
        { type_id: '6', type_name: '体育', type_pid: '0' },
      ];
    }

    // 格式化分类数据
    const formattedCategories = categories.map((item) => ({
      id: item.type_id || item.type_name,
      name: item.type_name || '未知分类',
      parent_id: item.type_pid || null,
    }));

    // 构建树形结构
    const buildCategoryTree = (categories: any[]) => {
      const categoryMap = new Map();
      const rootCategories: any[] = [];
      
      // 创建分类映射
      categories.forEach(cat => {
        categoryMap.set(cat.id, { ...cat, children: [] });
      });
      
      // 构建父子关系
      categories.forEach(cat => {
        const category = categoryMap.get(cat.id);
        if (cat.parent_id && cat.parent_id !== '0' && categoryMap.has(cat.parent_id)) {
          const parent = categoryMap.get(cat.parent_id);
          parent.children.push(category);
        } else {
          rootCategories.push(category);
        }
      });
      
      return rootCategories;
    };

    const categoryTree = buildCategoryTree(formattedCategories);

    const cacheTime = await getCacheTime();
    const responseData = NextResponse.json(
      {
        source: sourceKey,
        source_name: apiSite.name,
        categories: formattedCategories, // 保持原有格式兼容性
        categoryTree: categoryTree, // 新增树形结构
        total: formattedCategories.length,
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
    console.error('获取分类失败:', error);
    const response = NextResponse.json(
      {
        error: '获取分类失败',
        details: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
    return addCorsHeaders(response);
  }
}