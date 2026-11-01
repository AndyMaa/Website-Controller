# 参与开发

先用当前版本复现问题，再提交 Issue。请写明系统、软件版本、网站名称、复现步骤，以及你预期看到的结果。截图前遮住客户姓名、消息正文和账号信息。

修改代码需要 Node.js 24：

```sh
npm ci
npm start
npm test
npm run test:e2e
npm run test:network
```

桌面测试会创建独立的本地配置和测试网站，不读取日常使用的登录会话。生成的截图和报告在 `test-results/`，不要提交这个目录。

修复消息识别时，请用本地响应样例或虚构数据补充测试。不要提交真实 Cookie、请求头、客户消息或完整的带令牌 URL。

提交 PR 时说明具体问题、改动后的行为和验证方式。界面改动附上截图；涉及平台差异时写明测试过的系统。

发布流程见 [docs/releasing.md](docs/releasing.md)。
