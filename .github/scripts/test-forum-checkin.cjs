const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../../Scripts/ForumCheckin.js'), 'utf8');
const notices = [], logs = [], requests = [];
const main = vm.runInNewContext(source.replace('export default main;', 'main;'), {
  console: {log: value => logs.push(value)},
});
const data = new Map([
  ['nodeseek_headers', JSON.stringify({Cookie: 'session=fixture-ns-one', 'User-Agent': 'NS-browser-1'})],
  ['nodeseek_headers_2', JSON.stringify({Cookie: 'session=fixture-ns-two', 'User-Agent': 'NS-browser-2'})],
]);
const storage = {get: async key => data.get(key), set: async (key, value) => data.set(key, value)};
const notify = async value => notices.push(value);
async function capture(target, site, cookie, status = 200) {
  const response = {status};
  const result = await main({env: {CAPTURE_TARGET: target}, storage, notify, response,
    request: {url: `https://www.${site}.com/api/account/getInfo/1232?readme=1`,
      headers: {cookie, 'user-agent': 'fixture-' + target}}});
  assert.equal(result.response, response);
}
async function sign(env = {}, responder = () => ({status: 200, text: async () => '{"success":true,"message":"签到完成"}'})) {
  requests.length = 0;
  await main({env: {MODE: 'checkin', ...env}, storage, notify,
    http: {post: async (url, options) => {
      requests.push({url, options});
      return responder(requests.length, url, options);
    }}});
  return notices.at(-1).body;
}
(async () => {
  const originalNS = data.get('nodeseek_headers');
  await capture('DF账号1', 'deepflood', 'session=fixture-df-one; cf_clearance=fixture-clearance');
  await capture('DF账号2', 'deepflood', 'session=fixture-df-two');
  assert.equal(data.get('nodeseek_headers'), originalNS);
  assert.equal(JSON.parse(data.get('deepflood_headers_1')).Cookie, 'session=fixture-df-one; cf_clearance=fixture-clearance');
  assert.equal(JSON.parse(data.get('deepflood_headers_2')).Cookie, 'session=fixture-df-two');
  const df2 = data.get('deepflood_headers_2');
  await capture('DF账号2', 'deepflood', 'session=fixture-df-one; cf_clearance=fixture-clearance');
  assert.equal(data.get('deepflood_headers_2'), df2, 'same session cannot replace the other slot');
  await capture('NS账号1', 'deepflood', 'session=fixture-wrong-site');
  await capture('关闭', 'nodeseek', 'session=fixture-disabled');
  await capture('NS账号1', 'nodeseek', 'cf_clearance=fixture-no-login');
  await capture('NS账号1', 'nodeseek', 'session=fixture-error', 403);
  assert.equal(data.get('nodeseek_headers'), originalNS);
  let summary = await sign();
  assert.equal(requests.length, 4);
  assert.deepEqual(requests.map(r => r.options.headers.Cookie), [
    'session=fixture-ns-one', 'session=fixture-ns-two',
    'session=fixture-df-one; cf_clearance=fixture-clearance', 'session=fixture-df-two',
  ]);
  assert(requests.slice(0, 2).every(r => r.url.startsWith('https://www.nodeseek.com/api/attendance?')));
  assert(requests.slice(2).every(r => r.url.startsWith('https://www.deepflood.com/api/attendance?')));
  assert(requests.every(r => r.url.endsWith('random=true')));
  assert(requests.every(r => r.options.redirect === 'manual' && r.options.credentials === 'omit'));
  assert.equal((summary.match(/签到成功/g) || []).length, 4);
  // Older Egern/manual execution can pass unexpanded template strings as env values.
  summary = await sign({
    ENABLE_NS1: '{{{ENABLE_NS1}}}', ENABLE_NS2: '{{{ENABLE_NS2}}}',
    ENABLE_DF1: '{{{ENABLE_DF1}}}', ENABLE_DF2: '{{{ENABLE_DF2}}}',
  });
  assert.equal(requests.length, 4, 'unexpanded defaults must not disable all accounts');
  summary = await sign({ENABLE_NS1: 'null', ENABLE_NS2: 'undefined', ENABLE_DF1: '  ', ENABLE_DF2: null});
  assert.equal(requests.length, 4, 'missing or unrecognized defaults remain enabled');
  summary = await sign({ENABLE_NS1: false, ENABLE_NS2: 'false', ENABLE_DF1: '0', ENABLE_DF2: 'off'});
  assert.equal(requests.length, 4, 'legacy persisted off settings must not prevent saved-cookie accounts from running');
  assert(!summary.includes('所有账号均已停用'));
  await sign({FIXED_LEGS: 'true', ENABLE_NS2: 'false', ENABLE_DF2: 'false'});
  assert.equal(requests.length, 4);
  assert(requests.every(r => r.url.endsWith('random=false')));
  summary = await sign({}, i => i === 1 ? {status: 403}
    : i === 2 ? {status: 200, text: async () => '<html>Just a moment</html>'}
    : i === 3 ? {status: 200, text: async () => '{"success":false,"message":"未登录"}'}
    : {status: 200, text: async () => '{"success":false,"message":"今日已签到"}'});
  assert.equal(requests.length, 4, 'a failed account must not stop the remaining accounts');
  assert(summary.includes('NS账号1：HTTP 403'));
  assert(summary.includes('NS账号2：返回非 JSON'));
  assert(summary.includes('DF账号1：登录失效'));
  assert(summary.includes('DF账号2：今日已签到'));
  assert(!summary.includes('签到成功'));
  summary = await sign({}, () => {throw new Error('fixture-df-two request headers must stay private');});
  assert.equal((summary.match(/网络错误/g) || []).length, 4);
  data.delete('deepflood_headers_2');
  summary = await sign();
  assert.equal(requests.length, 3);
  assert(summary.includes('DF账号2：未获取 Cookie'));
  const visible = JSON.stringify({notices, logs});
  for (const secret of ['fixture-ns-one', 'fixture-ns-two', 'fixture-df-one', 'fixture-df-two', 'fixture-clearance']) {
    assert(!visible.includes(secret), 'credentials must not enter logs or notifications');
  }
  console.log('PASS: four account slots, legacy NS cookies, capture gates, independent requests, failure isolation, private logs');
})().catch(error => {console.error(error); process.exitCode = 1;});
