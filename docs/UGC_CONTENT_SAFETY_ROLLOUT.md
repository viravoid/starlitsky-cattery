# UGC content safety rollout

This change adds prepublication moderation for parent community posts, comments, images, profile text, application display names, and uploaded avatars. Keeper content remains directly publishable. It adds no schema migration.

## WeChat callback configuration

1. Generate a new random message token. Store it as `WECHAT_MESSAGE_TOKEN` in the API service environment only. Keep `WECHAT_APP_ID` and `WECHAT_APP_SECRET` available to the API.
2. Deploy the API and configure the WeChat Mini Program message receiver URL as `https://api.starlitskycattery.top/webhooks/wechat/content-safety`, with that same token, **plaintext** encryption mode, and **JSON** data format. The GET handshake returns `echostr`; POST requests verify the WeChat signature and accept `wxa_media_check` callbacks.
3. Check that the API's public Nginx route permits this webhook and that WeChat can fetch a signed COS image URL during the one hour read URL lifetime. A callback can arrive within 30 minutes. An unknown `trace_id` receives a retryable error to cover the short gap before the upload record is stored. A missing callback leaves the image pending and blocks publication.
4. Exercise a test post, comment, image, nickname, and avatar with a real recent WeChat login. Confirm parent post and comment remain hidden until keeper approval; avatar remains unchanged until a passing image callback. Confirm risky or failed checks never publish automatically.

## Existing UGC and platform declaration

Before enabling a statement that all UGC is checked, inspect existing production parent posts, comments, and avatars. This release does not retroactively classify or hide old visible content. Review or quarantine any unreviewed content before declaring the API and manual review mechanisms active. Keep a count and moderation decision record outside the repository; do not export personal content into Git.

In 微信公众平台 > 设置 > 用户生成内容场景信息安全声明, the app has user profile, image, and text UGC. Select platform content safety API and human review **only after** the API deployment, receiver handshake, callback, and real UGC flow have been verified. The app currently has no user video or audio upload path.

The Mini Program privacy guide must accurately list user data collection and working privacy rights contacts before formal review. The platform attestation is a separate owner commitment.

## Rollback and operations

If WeChat checks fail, requests fail closed or content remains hidden. Do not bypass moderation to restore availability. Repair credentials, message receiver settings, signed image access, or upstream availability; then retry the user action or have a keeper review eligible content. Do not rerun the existing 15 production database migrations for this rollout.
