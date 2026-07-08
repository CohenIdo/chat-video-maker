#!/usr/bin/env python3
"""Generate per-app SEO landing pages from index.html.

Each page is the full app preset to one chat skin, with unique title/meta/
canonical/H2/intro. Re-run after editing index.html:  python3 gen_landing_pages.py
"""
import re

BASE = 'https://cohenido.github.io/chat-video-maker/'

PAGES = [
    {
        'file': 'whatsapp-chat-generator.html',
        'app': 'whatsapp',
        'title': 'Fake WhatsApp Chat Generator — Animated Video & Screenshot Maker',
        'desc': 'Create a fake WhatsApp conversation with realistic bubbles, ticks and typing animation. Export as HD-4K video or PNG screenshot. Free, no watermark, no signup.',
        'h2': 'Fake WhatsApp Chat Generator — Video & Screenshots, Free',
        'intro': 'Write any WhatsApp conversation between two people and watch it come to life with the green header, delivery ticks, typing indicator and keyboard animation. Export it as a crisp MP4 video (up to 4K) or a PNG screenshot — free and without a watermark.',
    },
    {
        'file': 'imessage-generator.html',
        'app': 'imessage',
        'title': 'Fake iMessage Generator — iPhone Text Conversation Video Maker',
        'desc': 'Make fake iPhone text conversations with blue iMessage bubbles, typing dots and Dynamic Island. Export as video or screenshot in up to 4K. Free, no watermark.',
        'h2': 'Fake iMessage Generator — iPhone Text Video Maker',
        'intro': 'Create realistic iPhone text conversations with blue and gray iMessage bubbles, the typing dots, "Delivered" receipts and an authentic iPhone 16 frame with Dynamic Island. Export as MP4 video or PNG screenshot — free, no watermark.',
    },
    {
        'file': 'instagram-dm-generator.html',
        'app': 'instagram',
        'title': 'Fake Instagram DM Generator — Direct Message Video Maker',
        'desc': 'Create fake Instagram direct messages with gradient bubbles and profile photos. Animate the chat and export as HD-4K video or screenshot. Free, no watermark.',
        'h2': 'Fake Instagram DM Generator — Animated Direct Messages',
        'intro': 'Simulate Instagram direct messages with the purple-pink gradient bubbles, profile photos and "Active now" header. Animate the whole conversation and export it as a video or screenshot for Reels, TikTok or memes — free, no watermark.',
    },
    {
        'file': 'messenger-chat-generator.html',
        'app': 'messenger',
        'title': 'Fake Messenger Chat Generator — Facebook DM Video Maker',
        'desc': 'Build fake Facebook Messenger conversations with blue gradient bubbles and avatars. Export animated video up to 4K or PNG screenshots. Free, no watermark.',
        'h2': 'Fake Messenger Chat Generator — Facebook DM Videos',
        'intro': 'Create Facebook Messenger conversations with the blue gradient bubbles, avatars and "Active now" status. Play them back with typing animation and export as MP4 video or PNG screenshot — free and watermark-free.',
    },
    {
        'file': 'tiktok-dm-generator.html',
        'app': 'tiktok',
        'title': 'Fake TikTok DM Generator — Chat Story Video Maker',
        'desc': 'Make fake TikTok direct message conversations and export them as texting-story videos for TikTok, Shorts and Reels. Up to 4K, free, no watermark.',
        'h2': 'Fake TikTok DM Generator — Chat Story Videos',
        'intro': 'Write TikTok DM conversations with red bubbles and both-side avatars, then export them as texting-story videos ready to post on TikTok, YouTube Shorts or Reels. Keyboard typing animation and sounds included — free, no watermark.',
    },
]

src = open('index.html', encoding='utf-8').read()

for p in PAGES:
    out = src
    url = BASE + p['file']
    # head swaps
    out = re.sub(r'<title>.*?</title>', f"<title>{p['title']}</title>", out, count=1, flags=re.S)
    out = re.sub(r'(<meta name="description" content=").*?(" />)', rf"\g<1>{p['desc']}\g<2>", out, count=1)
    out = re.sub(r'(<link rel="canonical" href=").*?(" />)', rf"\g<1>{url}\g<2>", out, count=1)
    out = re.sub(r'(<meta property="og:title" content=").*?(" />)', rf"\g<1>{p['title']}\g<2>", out, count=1)
    out = re.sub(r'(<meta property="og:description" content=").*?(" />)', rf"\g<1>{p['desc']}\g<2>", out, count=1)
    out = re.sub(r'(<meta property="og:url" content=").*?(" />)', rf"\g<1>{url}\g<2>", out, count=1)
    out = re.sub(r'(<meta name="twitter:title" content=").*?(" />)', rf"\g<1>{p['title']}\g<2>", out, count=1)
    # preset the app skin before app.js loads
    out = out.replace('<script>window.ADSENSE_CLIENT',
                      f"<script>window.PRESET_APP = '{p['app']}';</script>\n<script>window.ADSENSE_CLIENT")
    # content section swaps
    out = re.sub(r'<h2>Create Fake Chat Videos in Your Browser[^<]*</h2>', f"<h2>{p['h2']}</h2>", out, count=1)
    out = re.sub(
        r'<p>\s*Conversation Simulator is a free <strong>fake chat video maker</strong>.*?</p>',
        f"<p>{p['intro']}</p>", out, count=1, flags=re.S)
    with open(p['file'], 'w', encoding='utf-8') as f:
        f.write(out)
    print('wrote', p['file'])

# refresh sitemap (EXTRA_PAGES are standalone tools not generated from index.html)
EXTRA_PAGES = ['tweet-generator.html']
urls = [BASE, BASE + 'privacy.html', BASE + 'terms.html'] \
    + [BASE + p['file'] for p in PAGES] + [BASE + e for e in EXTRA_PAGES]
sm = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for i, u in enumerate(urls):
    pr = '1.0' if i == 0 else ('0.2' if 'privacy' in u or 'terms' in u else '0.8')
    sm.append(f'  <url><loc>{u}</loc><changefreq>weekly</changefreq><priority>{pr}</priority></url>')
sm.append('</urlset>')
open('sitemap.xml', 'w', encoding='utf-8').write('\n'.join(sm) + '\n')
print('wrote sitemap.xml')
