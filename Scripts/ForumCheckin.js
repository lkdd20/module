/* Egern: one module for two NodeSeek and two DeepFlood accounts.
 * NodeSeek integration: https://github.com/Nullwhy/Egern (Curtinp118 / Nullwhy).
 * DeepFlood endpoint reference: https://github.com/agluo/ql-script-hub/blob/master/deepflood_checkin.py
 * Credentials stay in Egern local storage; no password, cookie, or token is uploaded.
 */
const SITES = {
  NS: {origin: 'https://www.nodeseek.com', host: 'www.nodeseek.com', contentType: 'text/plain;charset=UTF-8'},
  DF: {origin: 'https://www.deepflood.com', host: 'www.deepflood.com', contentType: 'application/json'},
};
const ACCOUNTS = [
  {id: 'NS1', site: 'NS', label: 'NS账号1', key: 'nodeseek_headers'},
  {id: 'NS2', site: 'NS', label: 'NS账号2', key: 'nodeseek_headers_2'},
  {id: 'DF1', site: 'DF', label: 'DF账号1', key: 'deepflood_headers_1'},
  {id: 'DF2', site: 'DF', label: 'DF账号2', key: 'deepflood_headers_2'},
];
const CAPTURE_HEADERS = ['Cookie', 'User-Agent', 'Accept-Language', 'refract-key', 'refract-sign'];

function header(headers, name) {
  if (!headers) return '';
  const value = typeof headers.get === 'function' ? headers.get(name)
    : headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()];
  return Array.isArray(value) ? value.join('; ') : String(value || '');
}

function enabled(value, fallback = true) {
  if (value == null || String(value).trim() === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

async function notify(ctx, subtitle, body) {
  console.log(`[论坛签到] ${subtitle}: ${body}`);
  try {
    if (typeof ctx.notify === 'function') {
      await ctx.notify({title: 'NS + DF 签到', subtitle, body});
    } else if (typeof $notification !== 'undefined' && $notification.post) {
      $notification.post('NS + DF 签到', subtitle, body);
    }
  } catch (_) {
    console.log('[论坛签到] 通知发送失败，请查看脚本日志');
  }
}

function sessionCookie(cookie) {
  const match = /(?:^|;\s*)session=([^;]+)/i.exec(cookie || '');
  return match ? match[1] : '';
}

async function capture(ctx) {
  const target = String((ctx.env || {}).CAPTURE_TARGET || '关闭').trim();
  const account = ACCOUNTS.find(a => a.label === target || a.id === target);
  if (!account) return {response: ctx.response};
  const site = SITES[account.site];
  // Match a pinned forum origin + account API, never arbitrary web requests.
  const escapedHost = site.host.replace(/\./g, '\\.');
  if (!new RegExp(`^https://${escapedHost}/api/account/getInfo(?:/|\\?|$)`).test(ctx.request.url || '')) {
    return {response: ctx.response};
  }
  const status = Number(ctx.response && ctx.response.status);
  if (status && (status < 200 || status >= 300)) {
    await notify(ctx, `${account.label}获取失败`, `个人页请求 HTTP ${status}，请先在浏览器正常登录`);
    return {response: ctx.response};
  }
  const saved = {};
  for (const key of CAPTURE_HEADERS) {
    const value = header(ctx.request.headers, key);
    if (value) saved[key] = value;
  }
  if (!saved.Cookie || !sessionCookie(saved.Cookie)) {
    await notify(ctx, `${account.label}获取失败`, '未检测到 session 登录 Cookie，请登录后刷新自己的个人页');
    return {response: ctx.response};
  }
  // Catch accidentally capturing the same logged-in account into both slots.
  const peer = ACCOUNTS.find(a => a.site === account.site && a.id !== account.id);
  const peerRaw = await ctx.storage.get(peer.key);
  try {
    const other = peerRaw && JSON.parse(peerRaw);
    if (other && sessionCookie(header(other, 'Cookie')) === sessionCookie(saved.Cookie)) {
      await notify(ctx, `${account.label}未保存`, `与${peer.label}登录会话相同，请先切换浏览器账号`);
      return {response: ctx.response};
    }
  } catch (_) { /* A corrupt unused peer must not prevent capturing this slot. */ }
  await ctx.storage.set(account.key, JSON.stringify(saved));
  await notify(ctx, `${account.label}获取成功`, '已保存到 Egern 本机；请把“Cookie 捕获账号”切回“关闭”');
  return {response: ctx.response};
}

async function signOne(ctx, account) {
  const raw = await ctx.storage.get(account.key);
  if (!raw) return `${account.label}：未获取 Cookie，跳过`;
  let saved;
  try {
    saved = JSON.parse(raw);
    if (!saved || !header(saved, 'Cookie')) throw new Error('missing cookie');
  } catch (_) {
    return `${account.label}：本地数据异常，请重新获取 Cookie`;
  }
  const site = SITES[account.site];
  const headers = {
    'Content-Type': site.contentType, Accept: 'application/json, text/plain, */*',
    Origin: site.origin, Referer: site.origin + '/',
  };
  for (const key of CAPTURE_HEADERS) {
    const value = header(saved, key);
    if (value) headers[key] = value;
  }
  if (!headers['User-Agent']) headers['User-Agent'] = 'Mozilla/5.0';
  const random = !enabled((ctx.env || {}).FIXED_LEGS, false);
  try {
    const response = await ctx.http.post(`${site.origin}/api/attendance?random=${random}`, {
      headers, body: '', timeout: 12000, redirect: 'manual', credentials: 'omit',
    });
    const status = Number(response.status);
    if (status === 401) return `${account.label}：登录失效，请重新获取 Cookie`;
    if (status === 403) return `${account.label}：HTTP 403，站点验证未通过；请在浏览器正常访问后重新获取 Cookie`;
    if (status === 429) return `${account.label}：请求频率受限，请稍后再试`;
    if (status < 200 || status >= 300) return `${account.label}：HTTP ${status}，签到未确认`;
    let data;
    try { data = JSON.parse(await response.text()); }
    catch (_) { return `${account.label}：返回非 JSON，可能是登录页或站点验证，签到未确认`; }
    if (!data || typeof data !== 'object') return `${account.label}：响应格式异常，签到未确认`;
    const message = String(data.message || '');
    if (/未登录|请.*登录|登录.*失效|USER NOT FOUND/i.test(message) || Number(data.status) === 404) {
      return `${account.label}：登录失效，请重新获取 Cookie`;
    }
    if (/已完成签到|今日已签到|今天已签到|已经签到/.test(message)) return `${account.label}：今日已签到`;
    const positiveMessage = /签到成功|签到完成|签到收益.*\d+.*鸡腿/.test(message);
    if (data.success === true || (data.success == null && positiveMessage)) {
      return `${account.label}：签到成功${message ? '；' + message.slice(0, 160) : ''}`;
    }
    return `${account.label}：签到失败或结果未确认${message ? '；' + message.slice(0, 160) : ''}`;
  } catch (_) {
    // Do not echo exception text: HTTP clients may include private request headers.
    return `${account.label}：网络错误或超时，请查看连接情况`;
  }
}

async function main(ctx) {
  if (ctx.request && String((ctx.env || {}).MODE || '').toLowerCase() !== 'checkin') return capture(ctx);
  const results = [];
  for (const account of ACCOUNTS) {
    if (!enabled((ctx.env || {})['ENABLE_' + account.id])) continue;
    try { results.push(await signOne(ctx, account)); }
    catch (_) { results.push(`${account.label}：本地存储读取失败`); }
  }
  await notify(ctx, '签到结果', results.length ? results.join('\n') : '所有账号均已停用');
}

export default main;
