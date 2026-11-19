// Exercise capture + scheduled requests against shared local storage, without networking.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const values = new Map([
  ['nodeseek_headers', JSON.stringify({Cookie: 'fixture-original-session'})],
]);
const notices = [];
const storage = {
  get: async key => values.get(key),
  set: async (key, value) => values.set(key, value),
};
function load(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  assert.equal((source.match(/export default main;/g) || []).length, 1);
  return vm.runInNewContext(
    source.replace('export default main;', 'main;'),
    {console: {log() {}}, $notification: {post: (...args) => notices.push(args)}},
    {filename: file},
  );
}
async function check(main, cookie, fixed) {
  const requests = [];
  await main({env: {MODE: 'checkin', FIXED_LEGS: String(fixed)}, storage,
    http: {post: async (url, options) => {
      requests.push({url, options});
      return {status: 200, text: async () => '{"message":"fixture-success"}'};
    }},
  });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.headers.Cookie, cookie);
  assert.equal(requests[0].url, `https://www.nodeseek.com/api/attendance?random=${!fixed}`);
}
(async () => {
  const one = load('Scripts/NodeSeek.js');
  const two = load('Scripts/NodeSeek2.js');
  // Existing account 1 data remains usable before capturing either account again.
  await check(one, 'fixture-original-session', false);
  await two({env: {ENABLE_CAPTURE: 'true'}, storage,
    request: {url: 'https://www.nodeseek.com/api/account/getInfo/fixture',
      headers: {Cookie: 'fixture-second-session', 'User-Agent': 'fixture-browser'}},
    response: {status: 200}});
  assert.equal(JSON.parse(values.get('nodeseek_headers')).Cookie, 'fixture-original-session');
  assert.equal(JSON.parse(values.get('nodeseek_headers_2')).Cookie, 'fixture-second-session');
  await check(two, 'fixture-second-session', true);
  // With capture off, browsing as another account cannot replace account 2 data.
  await two({env: {ENABLE_CAPTURE: 'false'}, storage,
    request: {headers: {Cookie: 'fixture-unwanted-session'}}, response: {status: 200}});
  await check(two, 'fixture-second-session', false);
  await check(one, 'fixture-original-session', false);
  assert(notices.some(item => item[0] === 'NodeSeek账号2🎉'));
  console.log('PASS: original cookie preserved; second account isolated; capture-off and both sign-in modes verified');
})().catch(error => { console.error(error); process.exitCode = 1; });
