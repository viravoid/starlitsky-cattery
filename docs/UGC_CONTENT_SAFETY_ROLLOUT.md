# UGC content safety rollout

This change adds prepublication moderation for parent community posts, comments, images, profile text, application display names, and uploaded avatars. Keeper content remains directly publishable. It adds no schema migration.

## WeChat callback configuration

1. Inspect the existing AppID-wide message receiver configuration and dependent features before changing it. Record its URL, Token, encryption mode, data format, and recovery values securely outside Git. Do not overwrite a receiver used by another feature.
2. Configure **secure mode** with JSON format and `https://api.starlitskycattery.top/webhooks/wechat/content-safety` as the single public receiver. Set the same random `WECHAT_MESSAGE_TOKEN` and platform `WECHAT_ENCODING_AES_KEY` in both API environments. The production API verifies `msg_signature` over the encrypted body, decrypts it, checks the embedded AppID and timestamp, and applies a matching production trace locally. The GET handshake still verifies `signature` and returns `echostr`.
3. Since the AppID has one message receiver, set `WECHAT_TRIAL_CALLBACK_URL=http://127.0.0.1:8081/webhooks/wechat/content-safety` **only on production**. An unmatched trace is forwarded as the original encrypted, signed envelope over loopback; the trial API independently verifies the WeChat signature and AppID before accessing its own SQLite database. Keep the trial API on loopback and deny the webhook in the public trial Nginx host. If neither database recognizes the trace, return a retryable error; never acknowledge it as applied. Do not share SQLite files or API session secrets.
4. Check that the public production Nginx callback path is reachable and its error log does not record query signatures. Confirm WeChat can fetch a signed COS image URL during the one-hour read URL lifetime; an image callback can arrive within 30 minutes. Missing callbacks remain pending/timeout and block publication. Failed or timed-out images can be rechecked through the existing upload-completion endpoint, which obtains a fresh signed read URL.
5. In an isolated rehearsal, submit separate production and trial trace IDs and verify each changes only its own database; test an unknown ID and a forged or stale envelope. Then exercise a normal test post, comment, image, nickname, and avatar with a real recent WeChat login. Confirm parent post and comment remain hidden until keeper approval; avatar remains unchanged until a passing image callback. Confirm risky or failed checks never publish automatically.

## Existing UGC and platform declaration

Before enabling a statement that all UGC is checked, inspect existing production parent posts, comments, and avatars. This release does not retroactively classify or hide old visible content. Review or quarantine any unreviewed content before declaring the API and manual review mechanisms active. Keep a count and moderation decision record outside the repository; do not export personal content into Git.

In 微信公众平台 > 设置 > 用户生成内容场景信息安全声明, the app has user profile, image, and text UGC. Select platform content safety API and human review **only after** the API deployment, receiver handshake, callback, and real UGC flow have been verified. The app currently has no user video or audio upload path.

The Mini Program privacy guide must accurately list user data collection and working privacy rights contacts before formal review. The platform attestation is a separate owner commitment.

## Rollback and operations

If WeChat checks fail, requests fail closed or content remains hidden. Do not bypass moderation to restore availability. Repair credentials, message receiver settings, signed image access, or upstream availability; then retry the user action or have a keeper review eligible content. Do not rerun the existing 15 production database migrations for this rollout.
