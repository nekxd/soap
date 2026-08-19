#!/usr/bin/env python3
import re, os, posixpath, urllib.parse

HOSTMAP = {
    'img.imgsmail.ru': 'ii',
    'img.mail.ru': 'im',
    'go.imgsmail.ru': 'gi',
    'go.mail.ru': 'gm',
    'limg1.imgsmail.ru': 'l1',
    'limg2.imgsmail.ru': 'l2',
    'limg3.imgsmail.ru': 'l3',
    'limg4.imgsmail.ru': 'l4',
    'img.torg.mail.ru': 'it',
    'rs.mail.ru': 'rs',
}

def local_path_for(url):
    p = urllib.parse.urlparse(url)
    host = p.netloc
    prefix = HOSTMAP.get(host, host.replace('.', '_'))
    path = p.path.lstrip('/')
    return f"assets/img/{prefix}/{path}"

def is_good(lp):
    return os.path.exists(lp) and os.path.getsize(lp) > 0 and \
        not open(lp,'rb').read(32).lstrip().lower().startswith((b'<!doctype', b'<html'))

def resolve(u, base_dir):
    u = u.strip()
    if u.startswith('data:') or u.startswith('#'):
        return None
    full = u
    if not full.startswith('http'):
        full = posixpath.normpath(posixpath.join(base_dir, u))
    lp = local_path_for(full)
    if is_good(lp):
        return os.path.relpath(lp, 'assets/css').replace(os.sep, '/')
    return None

css_files = ['assets/css/mail-splash3.css', 'assets/css/blocks.css',
             'assets/css/go_search.css', 'assets/css/search_top.css']
base = {f: 'http://img.imgsmail.ru/mail/ru/css/' for f in css_files}
TRANSPARENT = '../img/transparent.gif'

missing = set()
for f in css_files:
    if not os.path.exists(f):
        continue
    txt = open(f, encoding='utf-8', errors='ignore').read()
    def repl(m):
        u = m.group(1)
        local = resolve(u, base[f])
        if local is None:
            full = u if u.startswith('http') else posixpath.normpath(posixpath.join(base[f], u))
            if full.startswith('http'):
                missing.add(full)
            return f"url('{TRANSPARENT}')"
        return f"url('{local}')"
    new = re.sub(r'url\(\s*[\'"]?([^\'")]+)[\'"]?\s*\)', repl, txt)
    open(f, 'w', encoding='utf-8').write(new)
    print(f"rewrote {f}")

if not os.path.exists('assets/img/transparent.gif'):
    import base64
    open('assets/img/transparent.gif','wb').write(base64.b64decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'))
    print("created transparent.gif")

print(f"\nMissing ({len(missing)}):")
for u in sorted(missing):
    print("  ", u)
