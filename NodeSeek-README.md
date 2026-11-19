# NodeSeek 双账号签到（Egern）

基于 [Nullwhy/Egern](https://github.com/Nullwhy/Egern) 的 NodeSeek 模块和脚本。
保留上游作者信息，不保存或上传任何账号 Cookie。

| 账号 | 模块地址 | 本地 Cookie 存储键 | 默认签到时间 |
| --- | --- | --- | --- |
| 原账号 | https://raw.githubusercontent.com/lkdd20/module/main/NodeSeek.module | `nodeseek_headers` | 每天 10:00 |
| 第二个账号 | https://raw.githubusercontent.com/lkdd20/module/main/NodeSeek2.module | `nodeseek_headers_2` | 每天 10:05 |

## 使用步骤

1. 原账号已经使用 Nullwhy 模块时，把原模块 URL 替换成上表的原账号地址；第二个模块单独添加。不要重复开启原模块的签到任务。
2. 若原账号已有 Cookie，先手动执行原账号签到，确认它仍可读取原存储。若提示缺少请求头，再在账号 1 模块开启 Cookie 捕获，登录账号 1 并访问个人页，保存成功后关闭捕获。
3. 保持账号 1 的 Cookie 捕获关闭，只开启账号 2 模块的 Cookie 捕获。
4. 浏览器切换登录第二个 NodeSeek 账号，打开个人页；收到保存成功提示后关闭账号 2 的 Cookie 捕获。
5. 分别手动执行两份签到任务核对结果。`MINUTE` / `HOUR` 可分别修改；Cookie 失效时也只开启对应账号的捕获。

两个模块始终可以同时开启，但获取 Cookie 时应只打开目标账号模块内的 Cookie 捕获开关。
脚本分别位于 `Scripts/NodeSeek.js`、`Scripts/NodeSeek2.js`，不会被已有 `js/` 镜像任务删除。
此配置未在真实账号上执行签到，实际捕获和签到结果须在 Egern 本机确认。

## 自动同步

`Sync NodeSeek dual-account modules` 每 6 小时检查上游，也可在 Actions 手动运行。
同步后重新生成两份模块与脚本，保留第二个账号的独立存储键和名称。
它与原 IBL3ND 同步共享并发锁，原同步配置保持不变。
如果上游修改了关键代码格式，同步会报错停止，保留仓库现有版本供人工检查。
要长期调整生成逻辑，请修改 `.github/scripts/sync-nodeseek.py`，不要仅修改生成文件。
