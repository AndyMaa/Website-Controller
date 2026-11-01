# 发布一个版本

1. 同步修改 `package.json` 和 `package-lock.json` 的版本，更新 `CHANGELOG.md`。
2. 在 `docs/releases/v版本号.md` 写发布说明，并更新 README 中的下载文件名。
3. 确认 CI 通过后，在要发布的提交上创建并推送 `v版本号` 标签。

```sh
git tag -a v2.2.0 -m "Website Controller 2.2.0"
git push origin v2.2.0
```

Release 工作流会在 Windows、Apple 芯片 Mac 和 Intel Mac 上运行测试并打包。所有构建成功后，统一生成 SHA-256 校验文件，再创建正式 Release 并上传附件。某个构建失败时不会发布缺少平台的正式版本。

构建使用 GitHub 自带的短期 `GITHUB_TOKEN`，不需要维护者添加个人令牌。发布任务仅在版本标签上获得 `contents: write` 权限。

目前不使用商业签名证书。若以后接入 Apple Developer ID 或 Windows 签名，需要单独配置证书、机密和公证步骤，不能把证书提交到仓库。
