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

## Storage

- [ ] Real presigned `PUT` upload URL is issued.
- [ ] Upload complete step persists the uploaded media record.
- [ ] Miniapp displays uploaded images from the public media URL.
- [ ] Community post image add works.
- [ ] Community post image delete works.
- [ ] Community post image replace works.

## Admin

- [ ] Production Admin origin passes API CORS checks.
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
