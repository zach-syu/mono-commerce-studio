"""Fetch the user-specified public product pages for a local reference audit."""
import ast, concurrent.futures, html, json, re, urllib.parse, urllib.request
from pathlib import Path
from html.parser import HTMLParser

ROOT = Path('artifacts/benchmark-v3/references')
PAGES = {
 'ts6': 'https://www.ts6.com.tw/products/1002320',
 'zhuji': 'https://www.zhuji.com.tw/products/set2022008',
 'jsmix': 'https://www.jsmix.com.tw/products/印花短t-t62jt10154',
 'magforce': 'https://www.magforce.com.tw/zh-TW/products/0562',
 'philips': 'https://www.philips-da.com.tw/products/ac4221',
 'supplement': 'https://www.ts6.com.tw/products/probiotics-at0001a00203103',
}

class Images(HTMLParser):
 def __init__(self): super().__init__(); self.images=[]
 def handle_starttag(self, tag, attrs):
  a=dict(attrs)
  if tag=='img': self.images.append(a)
  if tag=='meta' and a.get('property')=='og:image': self.images.append({'src':a.get('content'),'role':'og:image'})
  if tag=='variant-photos-block' and ':product-photos-json' in a:
   try:
    value=ast.literal_eval(a[':product-photos-json'])
    photos=ast.literal_eval(value) if isinstance(value,str) else value
    for item in photos:self.images.append({'src':item['imageMaxUrl'],'role':'product-gallery','alt':str(item['id'])})
   except (ValueError,SyntaxError,KeyError):pass

def fetch(entry):
 key,url=entry
 parsed=urllib.parse.urlsplit(url)
 encoded=urllib.parse.urlunsplit((parsed.scheme,parsed.netloc,urllib.parse.quote(urllib.parse.unquote(parsed.path)),parsed.query,''))
 directory=ROOT/key;directory.mkdir(parents=True,exist_ok=True)
 try:
  with urllib.request.urlopen(encoded,timeout=40) as r: content=r.read().decode('utf-8');final=r.url
  (directory/'page.html').write_text(content)
  parser=Images();parser.feed(content)
  links=[]
  for item in parser.images:
   candidates=[v for k,v in item.items() if k in ['src','data-src','data-original','data-lazy'] and v and not v.startswith('data:')]
   for candidate in candidates:
    absolute=urllib.parse.urljoin(final,html.unescape(candidate))
    if not any(x['url']==absolute for x in links):links.append({'url':absolute,'alt':item.get('alt',''),'class':item.get('class',''),'role':item.get('role','')})
  title=re.search(r'<title[^>]*>(.*?)</title>',content,re.S)
  record={'id':key,'pageUrl':final,'title':html.unescape(title.group(1)).strip() if title else '', 'images':links}
  (directory/'inventory.json').write_text(json.dumps(record,ensure_ascii=False,indent=2))
  return {'id':key,'title':record['title'],'images':len(links),'firstImages':links[:4]}
 except Exception as e:return {'id':key,'error':str(e)}

if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
  for result in pool.map(fetch,PAGES.items()):print(json.dumps(result,ensure_ascii=False))
