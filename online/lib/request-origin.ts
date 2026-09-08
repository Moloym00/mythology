// 反向代理外部地址必须显式配置；不信任客户端伪造的转发头。
export function allowedOrigin(request: Request, publicOrigin?: string) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  if (origin === new URL(request.url).origin) return true;
  if (!publicOrigin) return false;
  try {
    const configured = new URL(publicOrigin);
    return configured.protocol === 'https:' && origin === configured.origin;
  } catch {
    return false;
  }
}
