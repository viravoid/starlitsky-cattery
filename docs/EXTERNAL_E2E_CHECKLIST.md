# External E2E Checklist

Use this checklist only with real staging or production-equivalent external services. Do not commit real credentials or verification artifacts containing secrets.

## WeChat

- [ ] Real `wx.login` returns a code in the Miniapp.
- [ ] API `code2session` succeeds with the real WeChat AppID and secret.
- [ ] `/auth/me` returns the logged-in user session.
- [ ] Real parent invite mini-program code is generated.
- [ ] Scanning the invite code opens `parent-auth`.
- [ ] Parent application submission works from the scanned invite.
- [ ] Admin approval creates the expected parent access.
- [ ] Real Admin QR mini-program code is generated from the WeChat API.
- [ ] Scanning the Admin QR opens `admin-auth`.
- [ ] Keeper/admin account can explicitly confirm Admin browser login.
- [ ] Ordinary user account is blocked from Admin QR approval.
- [ ] Expired Admin QR is blocked.
- [ ] Reusing an already consumed Admin QR is blocked.
- [ ] Browser receives a normal Admin `UserSession` after approval.
- [ ] Admin logout revokes the browser session.

## Storage

- [ ] Real presigned `PUT` upload URL is issued.
- [ ] Upload complete step persists the uploaded media record.
- [ ] Miniapp displays uploaded images from the public media URL.
- [ ] Community post image add works.
- [ ] Community post image delete works.
- [ ] Community post image replace works.

## Admin

- [ ] Production Admin origin passes API CORS checks.
- [ ] Admin QR login browser flow completes through `/auth/me`.
- [ ] Admin logout returns the browser to the QR login page.
- [ ] Cat media management works.
- [ ] Litter media management works.
- [ ] FixedPage media management works.
- [ ] Questionnaire management works.
- [ ] Parent invite creation works.
- [ ] Parent application approval works.
- [ ] Community moderation works.

## Miniapp

- [ ] Public FixedPages render.
- [ ] "Our cats" list renders.
- [ ] Cat detail renders.
- [ ] Questionnaire renders and submits.
- [ ] Community feed renders.
- [ ] Community detail renders.
- [ ] Community publish works.
- [ ] Community like works.
- [ ] Community comment works.
- [ ] Parent auth flow works.
- [ ] "My cats" renders for approved parent accounts.
- [ ] Parent cat timeline renders.
