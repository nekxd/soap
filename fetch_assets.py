#!/usr/bin/env python3
import re, os, posixpath, subprocess, urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

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

def local_path(url):
    p = urllib.parse.urlparse(url)
    host = p.netloc
    prefix = HOSTMAP.get(host, host.replace('.', '_'))
    path = p.path.lstrip('/')
    return f"assets/img/{prefix}/{path}"

def fetch(url):
    dst = local_path(url)
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        # verify not an HTML error page
        with open(dst, 'rb') as f:
            head = f.read(32)
        if not head.lstrip().lower().startswith(b'<!doctype') and not head.lstrip().lower().startswith(b'<html'):
            return (url, dst, 'cached')
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    wb = f"https://web.archive.org/web/2010id_/{url}"
    try:
        subprocess.run(['curl', '-sL', '--max-time', '40', '-A', 'Mozilla/5.0', '-o', dst, wb],
                       capture_output=True, timeout=50)
    except Exception as e:
        return (url, dst, f'err:{e}')
    if os.path.exists(dst) and os.path.getsize(dst) > 0:
        with open(dst, 'rb') as f:
            head = f.read(32)
        if head.lstrip().lower().startswith(b'<!doctype') or head.lstrip().lower().startswith(b'<html'):
            return (url, dst, 'HTML-error-page')
        return (url, dst, 'ok')
    return (url, dst, 'empty')

# Collect URLs from CSS files + img_urls.txt
urls = set()
css_files = ['assets/css/mail-splash3.css', 'assets/css/blocks.css',
             'assets/css/go_search.css', 'assets/css/search_top.css']
base = {f: 'http://img.imgsmail.ru/mail/ru/css/' for f in css_files}
for f in css_files:
    if not os.path.exists(f):
        continue
    txt = open(f, encoding='utf-8', errors='ignore').read()
    for m in re.finditer(r'url\(\s*[\'"]?([^\'")]+)[\'"]?\s*\)', txt):
        u = m.group(1).strip()
        if u.startswith('data:') or u.startswith('#'):
            continue
        if not u.startswith('http'):
            u = posixpath.normpath(posixpath.join(base[f], u))
        urls.add(u)
for line in open('img_urls.txt'):
    line = line.strip()
    if line:
        urls.add(line)

urls = sorted(urls)
print(f"Total URLs: {len(urls)}")
results = {'ok':0,'cached':0,'fail':[]}
with ThreadPoolExecutor(max_workers=8) as ex:
    futs = {ex.submit(fetch, u): u for u in urls}
    for fut in as_completed(futs):
        url, dst, status = fut.result()
        if status in ('ok','cached'):
            results[status if status=='ok' else 'ok'] += 1
        else:
            results['fail'].append((url, status))

print(f"ok={results['ok']} fail={len(results['fail'])}")
for u, s in results['fail']:
    print(f"  FAIL [{s}] {u}")

# Save the URL -> local map for CSS rewriting
mapping = {}
for u in urls:
    mapping[u] = local_path(u)
import json
with open('url_map.json', 'w') as f:
    json.dump(mapping, f, indent=1)
print("Wrote url_map.json")
