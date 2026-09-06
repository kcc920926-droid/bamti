#!/usr/bin/env python3
"""실사이트를 단일 HTML로 미러링 — CSS를 인라인해 computed style이 살아있게 한다.
스크립트는 제거(로컬에서 돌릴 이유 없음). 음성 대조군 검증용.
사용: python3 test/mirror.py https://example.com out-name"""
import sys, re, os, urllib.request, urllib.parse

UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
                    '(KHTML, like Gecko) Chrome/140.0 Safari/537.36'}

def get(url, timeout=25):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout).read().decode('utf-8', 'replace')

def mirror(url, name):
    html = get(url)
    # <script> 제거 (로컬 실행 불필요 + 외부 호출 차단)
    html = re.sub(r'<script\b[^>]*>.*?</script>', '', html, flags=re.S | re.I)
    html = re.sub(r'<script\b[^>]*/?>', '', html, flags=re.I)

    inlined = 0
    for m in list(re.finditer(r'<link\b[^>]*>', html, re.I)):
        tag = m.group(0)
        if 'stylesheet' not in tag.lower():
            continue
        href = re.search(r'href=["\']([^"\']+)["\']', tag, re.I)
        if not href:
            continue
        try:
            css = get(urllib.parse.urljoin(url, href.group(1)))
        except Exception as e:
            print(f'  ! css skip {href.group(1)[:60]}: {e}')
            continue
        html = html.replace(tag, f'<style>{css}</style>', 1)
        inlined += 1

    path = f'test/mirror/{name}.html'
    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f'✓ {name}: {len(html):,} bytes, 스타일시트 {inlined}개 인라인 → {path}')

if __name__ == '__main__':
    mirror(sys.argv[1], sys.argv[2])
