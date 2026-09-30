import asyncio
import logging
import time
import httpx
from fastapi import APIRouter

logger = logging.getLogger('debug_yahoo')
router = APIRouter(tags=['debug'])

UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
Y1 = 'https://query1.finance.yahoo.com'


async def _try_method(name, url, client):
    import time as _t
    start = _t.time()
    try:
        r1 = await client.get(url, headers={'User-Agent': UA}, follow_redirects=True)
        # res.cookies + Set-Cookie 헤더 직접 파싱 (환경에 따라 쿠키 인식 차이)
        cookies = {k: v for k, v in r1.cookies.items()}
        for sc in r1.headers.get_list('set-cookie'):
            part = sc.split(';')[0].strip()
            if '=' in part:
                ck, cv = part.split('=', 1)
                cookies[ck.strip()] = cv.strip()
        cookie_str = '; '.join(f'{k}={v}' for k, v in cookies.items())
        if not cookie_str:
            return {'method': name, 'success': False, 'error': f'no_cookie HTTP {r1.status_code}', 'elapsed_ms': round((_t.time()-start)*1000)}
        r2 = await client.get(f'{Y1}/v1/test/getcrumb', headers={'User-Agent': UA, 'Cookie': cookie_str})
        crumb = r2.text.strip()
        # crumb 유효성: HTTP 200이고, JSON/HTML/에러 텍스트가 아닌 1~30자 문자열
        valid = (
            r2.status_code == 200
            and bool(crumb)
            and '{' not in crumb
            and '<' not in crumb
            and ' ' not in crumb  # 'Too Many Requests' 같은 문장 차단
            and len(crumb) <= 30
        )
        return {'method': name, 'success': valid, 'cookie_count': len(cookies), 'cookie_keys': list(cookies.keys()), 'crumb': crumb if valid else None, 'crumb_raw': crumb[:80], 'crumb_status': r2.status_code, 'fetch_status': r1.status_code, 'elapsed_ms': round((_t.time()-start)*1000)}
    except Exception as e:
        return {'method': name, 'success': False, 'error': str(e), 'elapsed_ms': round((_t.time()-start)*1000)}


@router.get('/debug/yahoo-cookie', summary='Yahoo Finance cookie/crumb method test')
async def debug_yahoo_cookie(ticker: str = 'AAPL'):
    targets = [
        ('fc.yahoo.com', 'https://fc.yahoo.com'),
        ('finance.yahoo.com', 'https://finance.yahoo.com'),
        ('consent.yahoo.com', 'https://consent.yahoo.com/v2/collectConsent?sessionId=1_test'),
        ('chart_cookie', f'{Y1}/v8/finance/chart/{ticker}?range=1d' + '&interval=1d'),
    ]
    logger.info(f'[DebugYahoo] test start ticker={ticker}')
    async with httpx.AsyncClient(timeout=20.0) as client:
        results = await asyncio.gather(*[_try_method(n, u, client) for n, u in targets], return_exceptions=True)
    methods, working = [], []
    for r in results:
        if isinstance(r, Exception):
            methods.append({'method': 'unknown', 'success': False, 'error': str(r)})
        else:
            methods.append(r)
            if r.get('success'):
                working.append(r['method'])
    logger.info(f'[DebugYahoo] done working={working or None}')
    return {'ticker': ticker, 'working_methods': working, 'recommended': working[0] if working else None, 'results': methods}
