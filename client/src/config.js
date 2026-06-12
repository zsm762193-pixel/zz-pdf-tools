// 后端 API 地址
// 本地开发时通过 Vite proxy 转发，生产环境指向 Render 部署的后端
const API_BASE = import.meta.env.VITE_API_BASE || '';

export const API_URL = API_BASE;
export const IS_PRODUCTION = import.meta.env.PROD;
