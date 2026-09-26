"""
IP 확인 라우터: 클라이언트 IP 및 서버 공인 IP(증권사 Open API 허용 IP 등록용) 조회
"""
import logging
import httpx
from fastapi import APIRouter, Request

logger = logging.getLogger("ip_route")

router = APIRouter(tags=["system"])

IP_CHECK_SERVICES = [
    ("https://api64.ipify.org?format=json", "json", "ip"),
    ("https://checkip.amazonaws.com", "text", ""),
    ("https://ifconfig.me/ip", "text", ""),
]


async def fetch_public_ip() -> str:
    """서버의 외부 아웃바운드 공인 IP 확인 (토스/한투 WTS 허용 IP 등록용)"""
    async with httpx.AsyncClient(timeout=4.0) as client:
        for url, fmt, key in IP_CHECK_SERVICES:
            try:
                res = await client.get(url)
                if res.status_code == 200:
                    if fmt == "json":
                        return res.json().get(key, "").strip()
                    return res.text.strip()
            except Exception as e:
                logger.debug(f"IP 조회 서비스 ({url}) 실패: {e}")
                continue
    return "unknown"


def extract_client_ip(request: Request) -> str:
    """클라이언트(요청자)의 IP 추출 (프록시 헤더 고려)"""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


@router.get("/api/ip", summary="내 IP 및 서버 공인 IP 확인")
@router.get("/ip", include_in_schema=False)
async def get_my_ip(request: Request):
    """
    내 IP 주소 확인 API:
    - client_ip: 현재 API를 호출한 클라이언트의 접속 IP
    - server_public_ip: 이 서버가 외부 통신 시 사용하는 공인 IP (토스/한투 WTS 허용 IP 등록용)
    """
    client_ip = extract_client_ip(request)
    public_ip = await fetch_public_ip()

    is_local = client_ip in ("127.0.0.1", "::1", "localhost", "testclient")

    return {
        "client_ip": client_ip,
        "server_public_ip": public_ip,
        "is_local_request": is_local,
        "guide": (
            f"토스증권(WTS) 또는 한국투자증권 Open API의 [허용 IP(White-list)]에는 "
            f"'{public_ip}' (서버 공인 IP)를 등록해야 403 오류 없이 연동됩니다."
        ),
    }
