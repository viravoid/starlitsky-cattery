# Miniapp Production Readiness

This repository is configured for the real StarlitSky Mini Program.

## Production config

- AppID: `wx6d3a94b9d6eadeaa`
- trial API base: `https://api.starlitskycattery.top`
- release API base: `https://api.starlitskycattery.top`
- AppSecret: not stored in source. Keep it only in the backend production environment.

`develop` keeps local API behavior at `http://127.0.0.1:4310`. Unknown or blank runtime environments still fail closed in `apps/miniapp/config/env.ts`.

## WeChat legal-domain checklist

Configure exact hostnames in WeChat Public Platform. Query strings and presigned signatures do not change the hostname requirement.

Migration caveat: the checked-in COS hostname and assertions below describe current code/configuration only. They do not prove that the legacy LightCOS bucket actually serves objects on that hostname or that WeChat production has accepted it. The exact LightCOS API endpoint and public/custom object domain remain **待真实只读验证**; do not remove or replace a domain until the separately approved read-only probe and real-device trial identify both the old and new hosts.

| Category                  | Domain to enter                                                           | Required by                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| request legal domain      | `https://api.starlitskycattery.top`                                       | `wx.request` API calls through `apps/miniapp/utils/request/index.ts`, including auth, fixed pages, cats, community, parent invite, selection application, and admin QR approval APIs. |
| request legal domain      | `https://starlitsky-cattery-1480740947.cos.ap-chengdu.myqcloud.com`       | Community image upload uses `wx.request` with `PUT` to API-issued COS presigned upload URLs.                                                                                          |
| request legal domain      | `https://starlitsky-cattery-media-1480740947.cos.ap-chengdu.myqcloud.com` | Community image upload after the primary COS bucket changes.                                                                                                                          |
| uploadFile legal domain   | Not required by current code                                              | The miniapp does not call `wx.uploadFile`.                                                                                                                                            |
| downloadFile legal domain | `https://starlitsky-cattery-1480740947.cos.ap-chengdu.myqcloud.com`       | Remote `<image>` components and `wx.previewImage` display API-issued signed COS image URLs.                                                                                           |
| downloadFile legal domain | `https://starlitsky-cattery-media-1480740947.cos.ap-chengdu.myqcloud.com` | Signed image URLs after the reference switch.                                                                                                                                         |
| socket legal domain       | Not required by current code                                              | The miniapp does not call `wx.connectSocket`.                                                                                                                                         |

The Admin web domain `https://admin.starlitskycattery.top` is not a miniapp legal domain for the current code because the miniapp does not call it directly.

## Human WeChat-console steps

1. Open WeChat Public Platform for AppID `wx6d3a94b9d6eadeaa`.
2. In development settings, add the request legal domains:
   - `https://api.starlitskycattery.top`
   - `https://starlitsky-cattery-1480740947.cos.ap-chengdu.myqcloud.com`
   - `https://starlitsky-cattery-media-1480740947.cos.ap-chengdu.myqcloud.com`
3. Add the downloadFile legal domain:
   - `https://starlitsky-cattery-1480740947.cos.ap-chengdu.myqcloud.com`
   - `https://starlitsky-cattery-media-1480740947.cos.ap-chengdu.myqcloud.com`
4. Do not add uploadFile or socket domains unless code later introduces `wx.uploadFile` or `wx.connectSocket`.
5. Do not add AppSecret to the miniapp source tree.

## WeChat Developer Tools

1. Import `apps/miniapp` as the Mini Program project root.
2. Confirm Developer Tools shows AppID `wx6d3a94b9d6eadeaa`, not `touristappid`.
3. Build as trial/release so `wx.getAccountInfoSync().miniProgram.envVersion` resolves to `trial` or `release`.

## Post-console testing

After the legal domains are configured in WeChat Public Platform, test:

- real `wx.login`
- backend `code2session`
- `/auth/me`
- signed COS image display in `<image>` and `wx.previewImage`
- community image upload if the miniapp account supports publishing
- Admin QR scan/approval flow
- parent invitation QR flow

Run `npm run verify:miniapp-production-config` before submitting changes that touch miniapp networking or production config.
