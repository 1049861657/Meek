/**
 * Studio 商品中心 MCP（stdio）
 * Info 页 stdio：command=node，args=dist/mcp-servers/product-list-mcp.js（相对 worker cwd）
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const DEFAULT_PAGE_SIZE = 520;

const CATEGORIES = [
  '数码/手机',
  '数码/笔记本',
  '家电/冰箱',
  '家电/洗衣机',
  '服饰/男装',
  '服饰/女装',
  '美妆/护肤',
  '食品/零食'
] as const;

const BRANDS = ['星云', '蓝鲸', '赤松', '北辰', '青禾', '曜石', '澄光'] as const;

interface ProductRow {
  productId: string;
  sku: string;
  name: string;
  categoryPath: string;
  brand: string;
  price: number;
  currency: string;
  stock: number;
  status: 'on_sale' | 'off_shelf';
  warehouseCode: string;
  updatedAt: string;
  attributes: Record<string, string | number | boolean>;
  description: string;
  imageUrls: string[];
}

function buildProduct(index: number, keyword?: string): ProductRow {
  const category = CATEGORIES[index % CATEGORIES.length] ?? CATEGORIES[0];
  const brand = BRANDS[index % BRANDS.length] ?? BRANDS[0];
  const sku = `SKU-${String(100000 + index)}`;
  const baseName = keyword?.trim()
    ? `${brand} ${keyword.trim()} ${category.split('/').pop()}`
    : `${brand} ${category.split('/').pop()} 标准款`;

  return {
    productId: `P${String(index).padStart(8, '0')}`,
    sku,
    name: baseName,
    categoryPath: category,
    brand,
    price: Number((19.9 + (index % 97) * 13.5).toFixed(2)),
    currency: 'CNY',
    stock: (index * 17) % 5000,
    status: index % 17 === 0 ? 'off_shelf' : 'on_sale',
    warehouseCode: `WH-${String((index % 12) + 1).padStart(2, '0')}`,
    updatedAt: new Date(Date.UTC(2026, 0, 1 + (index % 28), 8, 0, 0)).toISOString(),
    attributes: {
      color: index % 2 === 0 ? '深空灰' : '云白',
      weightKg: Number((0.3 + (index % 50) * 0.05).toFixed(2)),
      warrantyMonths: 12 + (index % 24),
      freeShipping: index % 3 !== 0
    },
    description:
      `${baseName}，品牌 ${brand}，类目 ${category}。` +
      `含税零售价 ${(19.9 + (index % 97) * 13.5).toFixed(2)} 元，库存以 stock 为准。` +
      `包装重量约 ${(0.3 + (index % 50) * 0.05).toFixed(2)} kg，具体规格见 attributes。`,
    imageUrls: [
      `https://cdn.studio.example/products/${sku}/main.jpg`,
      `https://cdn.studio.example/products/${sku}/gallery-0${(index % 4) + 1}.jpg`
    ]
  };
}

function buildApiResponse(params: {
  page: number;
  pageSize: number;
  keyword?: string;
  category?: string;
}): {
  code: number;
  message: string;
  traceId: string;
  data: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    filters: { keyword?: string; category?: string };
    list: ProductRow[];
  };
} {
  const { page, pageSize, keyword, category } = params;
  const total = 50_000;
  const start = (page - 1) * pageSize;
  const list = Array.from({ length: pageSize }, (_, i) => {
    const index = start + i;
    const row = buildProduct(index, keyword);
    if (category?.trim()) {
      return { ...row, categoryPath: category.trim() };
    }
    return row;
  });

  return {
    code: 0,
    message: '操作成功',
    traceId: `tr_${Date.now().toString(36)}`,
    data: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      filters: { keyword, category },
      list
    }
  };
}

const server = new McpServer({
  name: 'StudioCatalog',
  version: '1.0.0'
});

server.registerTool(
  'queryProductList',
  {
    description:
      '分页查询商品主数据列表（商品中心 GET /api/v1/products）。' +
      '返回 SKU、名称、类目、品牌、价格、库存、上下架状态、仓库、规格属性与主图链接；' +
      '支持 keyword、category 筛选。大批量拉取请提高 pageSize（上限 2000）。',
    inputSchema: {
      page: z.number().int().min(1).optional().describe('页码，从 1 开始，默认 1'),
      pageSize: z
        .number()
        .int()
        .min(1)
        .max(2000)
        .optional()
        .describe('每页条数，未传时由服务端默认分页；全量同步场景可适当增大'),
      keyword: z.string().optional().describe('商品名称关键词，模糊匹配'),
      category: z.string().optional().describe('类目路径，如 数码/手机')
    }
  },
  async (params) => {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
    const body = buildApiResponse({
      page,
      pageSize,
      keyword: params.keyword,
      category: params.category
    });
    const text = JSON.stringify(body, null, 2);

    return {
      content: [
        {
          type: 'text',
          text
        }
      ]
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
