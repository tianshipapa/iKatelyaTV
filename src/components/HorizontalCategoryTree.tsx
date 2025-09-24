import { ChevronRight, ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface CategoryNode {
  id: string;
  name: string;
  parent_id?: string | null;
  children?: CategoryNode[];
}

interface HorizontalCategoryTreeProps {
  categories: CategoryNode[];
  selectedCategory: string;
  onCategorySelect: (categoryId: string) => void;
}

const HorizontalCategoryTree = ({
  categories,
  selectedCategory,
  onCategorySelect,
}: HorizontalCategoryTreeProps) => {
  const [loadingCategory, setLoadingCategory] = useState<string | null>(null);
  const [activeMainCategory, setActiveMainCategory] = useState<string | null>(null); // 当前激活的主分类

  // 处理分类点击事件
  const handleCategoryClick = async (categoryId: string) => {
    setLoadingCategory(categoryId);
    await new Promise(resolve => setTimeout(resolve, 200)); // 模拟加载效果
    onCategorySelect(categoryId);
    setLoadingCategory(null);
  };

  // 处理主分类点击（设置激活状态）
  const handleMainCategoryClick = (categoryId: string) => {
    if (activeMainCategory === categoryId) {
      // 如果已经是激活状态，则关闭
      setActiveMainCategory(null);
    } else {
      // 设置为激活状态
      setActiveMainCategory(categoryId);
    }
    handleCategoryClick(categoryId);
  };

  // 检查是否为选中的分类或其父分类
  const isInActivePath = (categoryId: string): boolean => {
    if (selectedCategory === categoryId) return true;
    
    // 检查是否为选中分类的父分类
    for (const rootCategory of categories) {
      if (rootCategory.id === categoryId && rootCategory.children) {
        return rootCategory.children.some(child => child.id === selectedCategory);
      }
    }
    return false;
  };

  // 获取当前激活主分类的子分类
  const getActiveSubCategories = () => {
    if (!activeMainCategory) return [];
    const mainCategory = categories.find(cat => cat.id === activeMainCategory);
    return mainCategory?.children || [];
  };

  return (
    <div className="w-full space-y-6">
      {/* 主分类横向列表 */}
      {categories && categories.length > 0 ? (
        <div>
          {/* 一级分类横向导航 */}
          <div className="mb-6">
            <div className="flex items-center flex-wrap gap-x-6 gap-y-2">
              {/* 全部分类 */}
              <div
                onClick={() => {
                  handleCategoryClick('all');
                  setActiveMainCategory(null); // 清除激活主分类
                }}
                className={`flex items-center space-x-1 cursor-pointer transition-all duration-300 group ${
                  selectedCategory === 'all'
                    ? 'text-red-500 font-semibold'
                    : 'text-gray-700 dark:text-gray-300 hover:text-red-500 font-medium'
                }`}
              >
                <span className="whitespace-nowrap">全部</span>
                {loadingCategory === 'all' && (
                  <div className="ml-1 w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                )}
              </div>
              
              {/* 其他分类 */}
              {categories.map((category) => {
                const hasChildren = category.children && category.children.length > 0;
                const isMainSelected = selectedCategory === category.id;
                const isMainActive = activeMainCategory === category.id;
                const isInPath = isInActivePath(category.id);
                
                return (
                  <div
                    key={category.id}
                    onClick={() => handleMainCategoryClick(category.id)}
                    className={`flex items-center space-x-1 cursor-pointer transition-all duration-300 group ${
                      isMainSelected
                        ? 'text-red-500 font-semibold'
                        : isMainActive || isInPath
                        ? 'text-red-400 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:text-red-500 font-medium'
                    }`}
                  >
                    <span className="whitespace-nowrap">{category.name}</span>
                    {hasChildren && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full transition-colors ${
                        isMainSelected
                          ? 'bg-red-500 text-white'
                          : isMainActive || isInPath
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 group-hover:bg-red-100 dark:group-hover:bg-red-900/30 group-hover:text-red-600 dark:group-hover:text-red-400'
                      }`}>
                        {category.children!.length}
                      </span>
                    )}
                    {hasChildren && (
                      <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${
                        isMainActive ? 'rotate-180' : 'rotate-0'
                      }`} />
                    )}
                    {loadingCategory === category.id && (
                      <div className="ml-1 w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 子分类展示区域 */}
          {activeMainCategory && (
            <div className="second-level-container bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <div className="w-1 h-5 bg-red-500 rounded-full mr-3"></div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {categories.find(cat => cat.id === activeMainCategory)?.name} 子分类
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                {getActiveSubCategories().map((child, index) => {
                  const isChildSelected = selectedCategory === child.id;
                  
                  return (
                    <button
                      key={child.id}
                      onClick={() => handleCategoryClick(child.id)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap child-category-button ${
                        isChildSelected
                          ? 'bg-red-500 text-white shadow-md'
                          : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 border border-gray-200 dark:border-gray-600'
                      }`}
                      style={{
                        animationDelay: `${index * 50}ms`,
                        animation: 'fadeInScale 0.3s ease-out'
                      }}
                    >
                      {child.name}
                      {loadingCategory === child.id && (
                        <div className="inline-block ml-2 w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 border-red-200 border-t-red-500 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">正在加载分类...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default HorizontalCategoryTree;