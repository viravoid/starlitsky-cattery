# Miniapp Production Readiness

This repository is configured for the real StarlitSky Mini Program.

## Production config

- AppID: `wx6d3a94b9d6eadeaa`
- trial API base in source: `https://trial-api.starlitskycattery.top`; the currently uploaded trial package still requires platform verification
- release API base: `https://api.starlitskycattery.top`
- AppSecret: not stored in source. Keep it only in the backend production environment.

`develop` in the local Developer Tools simulator uses the isolated local API at `http://127.0.0.1:4310`. For miniapp public content reads only, that API serves an anonymous, published-content preview from the fixed Production API host. The proxy is available only from the loopback development server, accepts only the explicit GET allowlist, forwards no credentials, and never stores signed media URLs. Admin, parent, and all write operations remain local. WeChat may run a submitted review package with `envVersion=develop` on a real device; that case now uses the Production HTTPS API and does not send the local preview header. `trial` uses the separate HTTPS trial host, and `release` uses the Production HTTPS host. A blank trial address throws instead of falling back to production.

## WeChat legal-domain checklist

Configure exact hostnames in WeChat Public Platform. Query strings and presigned signatures do not change the hostname requirement.

Migration caveat: the checked-in COS hostname and assertions below describe current code/configuration only. They do not prove that the legacy LightCOS bucket actually serves objects on that hostname or that WeChat production has accepted it. The exact LightCOS API endpoint and public/custom object domain remain **待真实只读验证**; do not remove or replace a domain until the separately approved read-only probe and real-device trial identify both the old and new hosts.

| Category                  | Domain to enter                                                           | Required by                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| request legal domain      | `https://api.starlitskycattery.top`                                       | `wx.request` API calls through `apps/miniapp/utils/request/index.ts`, including auth, fixed pages, cats, community, parent invite, selection application, and admin QR approval APIs. |
| request legal domain      | `https://trial-api.starlitskycattery.top`                                 | Trial-channel `wx.request` API calls. Platform acceptance remains to be checked.                                                                                                      |
| request legal domain      | `https://starlitsky-cattery-1480740947.cos.ap-chengdu.myqcloud.com`       | Community image upload uses `wx.request` with `PUT` to API-issued COS presigned upload URLs.                                                                                          |
| request legal domain      | `https://starlitsky-cattery-media-1480740947.cos.ap-chengdu.myqcloud.com` | Community image upload after the primary COS bucket changes.                                                                                                                          |
| uploadFile legal domain   | Not required by current code                                              | The miniapp does not call `wx.uploadFile`.                                                                                                                                            |
| downloadFile legal domain | `https://starlitsky-cattery-1480740947.cos.ap-chengdu.myqcloud.com`       | Remote `<image>` components and `wx.previewImage` display API-issued signed COS image URLs.                                                                                           |
| downloadFile legal domain | `https://starlitsky-cattery-media-1480740947.cos.ap-chengdu.myqcloud.com` | Signed image URLs after the reference switch.                                                                                                                                         |
| downloadFile legal domain | `https://trial-api.starlitskycattery.top`                                 | Present in the current source allowlist for trial media. Confirm actual platform setting before upload.                                                                               |
| socket legal domain       | Not required by current code                                              | The miniapp does not call `wx.connectSocket`.                                                                                                                                         |

The Admin web domain `https://admin.starlitskycattery.top` is not a miniapp legal domain for the current code because the miniapp does not call it directly.

## Human WeChat-console steps

1. Open WeChat Public Platform for AppID `wx6d3a94b9d6eadeaa`.
2. In development settings, add the request legal domains:
   - `https://api.starlitskycattery.top`
   - `https://starlitsky-cattery-1480740947.cos.ap-chengdu.myqcloud.com`
   - `https://starlitsky-cattery-media-1480740947.cos.ap-chengdu.myqcloud.com`
   - `https://trial-api.starlitskycattery.top`
3. Add the downloadFile legal domain:
   - `https://starlitsky-cattery-1480740947.cos.ap-chengdu.myqcloud.com`
   - `https://starlitsky-cattery-media-1480740947.cos.ap-chengdu.myqcloud.com`
4. Do not add uploadFile or socket domains unless code later introduces `wx.uploadFile` or `wx.connectSocket`.
5. Do not add AppSecret to the miniapp source tree.

## WeChat Developer Tools

1. Import `apps/miniapp` as the Mini Program project root.
2. Confirm Developer Tools shows AppID `wx6d3a94b9d6eadeaa`, not `touristappid`.
3. Confirm `wx.getAccountInfoSync().miniProgram.envVersion` resolves to the intended environment. Do not upload a trial build while `MINIAPP_TRIAL_API_BASE_URL` is blank.

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
