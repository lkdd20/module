# NS + DF 四账号合并签到（Egern）

只安装一个模块，使用一个脚本处理 NodeSeek 两账号和 DeepFlood 两账号。

模块地址：https://raw.githubusercontent.com/lkdd20/module/main/ForumCheckin.module

脚本地址：https://raw.githubusercontent.com/lkdd20/module/main/Scripts/ForumCheckin.js

## v1.0.1 更新说明

修复部分手动运行场景中，未展开的模板参数被当成 false，导致“所有账号均已停用”。
账号开关改为脚本层明确默认 true，用户在模块环境变量中设置的 false 仍优先生效。
模块内的脚本 URL 已增加版本参数，以触发更新后的脚本下载。
更新模块及脚本资源后再手动运行，日志应包含 `论坛签到 v1.0.1` 和已启用的账号列表。
所有 Cookie 存储键保持不变，无需因为本次升级重新捕获。
如仍显示全部停用，检查模块环境变量 `ENABLE_NS1/NS2/DF1/DF2` 是否被明确设为 false。

## v1.0.2 更新说明（当前版本）

旧版 Egern 的账号开关可能持久化为关闭，导致 v1.0.1 仍然没有执行任何签到请求。
现已移除四个账号开关，也不读取本机遗留的 `ENABLE_*` 值。
每次直接读取四份本地 Cookie：有记录则尝试签到，没有记录则跳过。
所有存储键仍保持不变，升级本身无需重新获取 Cookie。
更新模块和脚本资源后，日志应显示 `论坛签到 v1.0.2` 和“自动读取四份本地 Cookie”。

## 安装与迁移

1. 在 Egern 添加上面的模块地址。
2. 停用原先的 NodeSeek、NodeSeek账号2 等同类签到模块，避免重复运行和重复捕获；不要清理它们保存的脚本数据。
3. 本合并脚本沿用 `nodeseek_headers`、`nodeseek_headers_2` 两个 NS 存储键。已有 Cookie 会尝试直接使用；如果 Egern 本机未读取到，再按下面步骤捕获。
4. 生成、安装并完全信任 Egern 本机的 MITM 证书。确认模块资源已成功下载。

## 获取四个账号的 Cookie

在模块设置的 **Cookie 捕获账号** 中依次操作：

| 捕获选项 | 浏览器操作 | 本地存储键 |
| --- | --- | --- |
| NS账号1 | 登录 NS 第一个账号，打开并刷新自己的个人页 | `nodeseek_headers` |
| NS账号2 | 切换到 NS 第二个账号，打开并刷新自己的个人页 | `nodeseek_headers_2` |
| DF账号1 | 登录 DF 第一个账号，打开并刷新自己的个人页 | `deepflood_headers_1` |
| DF账号2 | 切换到 DF 第二个账号，打开并刷新自己的个人页 | `deepflood_headers_2` |

每次收到“获取成功”通知后，把捕获选项切回“关闭”。同一个站点的两份登录 session 完全相同时会拒绝覆盖第二个存储位。
捕获记录属于当前浏览器登录会话，并不由个人页 URL 中的用户编号决定；不要固定填写分享链接中的 `1232`。
捕获只保存所选站点的账号信息，不会因浏览另一个站点而串用 Cookie。

## 签到

- 默认每天 **10:15（设备本地时间）**依次执行 NS1、NS2、DF1、DF2，一条通知汇总结果。
- 也可在脚本/定时任务中手动运行“论坛合并签到－四账号”。
- `MINUTE`、`HOUR` 修改时间；“固定鸡腿”关闭表示随机，打开表示固定。
- 四个账号自动按本地 Cookie 是否存在处理。未保存 Cookie 的账号会跳过；某一账号失败不阻止其余账号。
- 不会把 HTTP 200 的 HTML 验证页当成签到成功。遇到 403，请先用浏览器正常访问站点并按需重新获取 Cookie。
- Cookie、User-Agent 等凭据仅保存在 Egern 本机，不需要上传到 GitHub、SFO 或发给其他人。

## 维护与验证范围

这是仓库内的自定义合并版；它独立于原来的 NodeSeek 上游镜像生成文件，不会被该同步任务覆盖。原有 YouTube 与 NodeSeek 同步任务保持不变。
每次修改相关代码都会运行无网络模拟测试，覆盖四账号隔离、旧 NS 数据、捕获开关、错误响应和凭据不进入日志等场景。
未使用真实账号执行签到；DeepFlood 本次匿名访问受到 HTTP 403 拦截，实际请求能否通过须在 Egern 本机获取 Cookie 后验证。

协议依据：

- NodeSeek 原脚本：https://github.com/Nullwhy/Egern/blob/main/Scripts/NodeSeek.js （Curtinp118 / Nullwhy）
- DeepFlood 签到接口参考：https://github.com/agluo/ql-script-hub/blob/master/deepflood_checkin.py
- Egern 原生脚本 API：https://egernapp.com/zh-CN/docs/javascript-api/
