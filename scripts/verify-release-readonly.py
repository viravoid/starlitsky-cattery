"""Compare a running release with a checked-out commit without changing the server.

Run from the repository root after building Admin with the intended VITE_API_BASE_URL:
  python scripts/verify-release-readonly.py --commit <40-hex-sha>

Requires an already authorized SSH alias. It never reads env files or database rows.
"""

import argparse
import hashlib
import json
import os
import subprocess
from pathlib import Path


def git(*args):
    return subprocess.check_output(["git", *args])


def digest(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--commit", required=True, help="Full 40 character Git commit SHA")
    parser.add_argument("--host", default="starlitsky-prod", help="Authorized SSH alias")
    parser.add_argument("--admin-dist", default="dist/admin")
    args = parser.parse_args()
    if len(args.commit) != 40 or any(c not in "0123456789abcdef" for c in args.commit):
        parser.error("--commit must be a lowercase full Git SHA")
    head = git("rev-parse", "HEAD").decode().strip()
    if head != args.commit:
        parser.error("checkout HEAD must match --commit")

    paths = [p.decode("utf-8") for p in git("ls-files", "-z").split(b"\0") if p]
    tracked = {
        path: digest(git("show", f"{args.commit}:{path}").replace(b"\r\n", b"\n"))
        for path in paths
        if Path(path).is_file()
    }
    admin_root = Path(args.admin_dist)
    if not (admin_root / "index.html").is_file():
        parser.error("Admin build missing: run build:admin with the intended API URL first")
    admin = {
        p.relative_to(admin_root).as_posix(): digest(p.read_bytes())
        for p in admin_root.rglob("*")
        if p.is_file()
    }

    # The remote program only opens paths under the known release root and emits mismatches.
    remote = '''
import hashlib,json,os,subprocess
manifest=json.loads(MANIFEST)
pid=subprocess.check_output(['systemctl','show','starlitsky-api','-p','MainPID','--value'],text=True).strip()
cwd=os.path.realpath('/proc/'+pid+'/cwd')
app=os.path.realpath('/opt/starlitsky/app')
if cwd!=app: raise SystemExit('running process cwd differs from active release')
def digest(data): return hashlib.sha256(data).hexdigest()
bad=[]
for name,expected in manifest['tracked'].items():
 path=os.path.realpath(os.path.join(app,name))
 if not path.startswith(app+os.sep) or not os.path.isfile(path): bad.append(name+': missing or outside release'); continue
 if digest(open(path,'rb').read().replace(b'\\r\\n',b'\\n'))!=expected: bad.append(name+': source mismatch')
for name,expected in manifest['admin'].items():
 path=os.path.realpath(os.path.join(app,'dist/admin',name))
 if not path.startswith(app+os.sep) or not os.path.isfile(path): bad.append('dist/admin/'+name+': missing'); continue
 if digest(open(path,'rb').read())!=expected: bad.append('dist/admin/'+name+': build mismatch')
print(json.dumps({'process_pid':pid,'release':app,'tracked_checked':len(manifest['tracked']),'admin_checked':len(manifest['admin']),'mismatches':bad},ensure_ascii=False))
if bad: raise SystemExit(1)
'''
    payload = json.dumps({"tracked": tracked, "admin": admin}, ensure_ascii=False)
    remote = "MANIFEST = " + repr(payload) + "\n" + remote
    result = subprocess.run(
        ["ssh", "-o", "BatchMode=yes", args.host, "sudo -n python3 -"],
        input=remote.encode("utf-8"),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    print(result.stdout.decode("utf-8", "replace").strip())
    if result.returncode:
        print(result.stderr.decode("utf-8", "replace").strip())
        raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()
