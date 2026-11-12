"""
RedisEmulator: 외부 Redis 없이 HTTP REST API로 Redis 핵심 연산(Key-Value, List, SortedSet)을 수행할 수 있는 초경량 자체 에뮬레이터
"""
import asyncio
import time
from typing import Any, Optional


class RedisEmulator:
    def __init__(self):
        self._kv: dict[str, Any] = {}
        self._expires: dict[str, float] = {}
        self._lists: dict[str, list[Any]] = {}
        self._zsets: dict[str, dict[str, float]] = {}  # {key: {member: score}}
        self._lock = asyncio.Lock()

    def _is_expired(self, key: str) -> bool:
        if key in self._expires:
            if time.time() > self._expires[key]:
                self._del_key(key)
                return True
        return False

    def _del_key(self, key: str) -> None:
        self._kv.pop(key, None)
        self._expires.pop(key, None)
        self._lists.pop(key, None)
        self._zsets.pop(key, None)

    async def get(self, key: str) -> Optional[Any]:
        async with self._lock:
            if self._is_expired(key):
                return None
            return self._kv.get(key)

    async def set(self, key: str, value: Any, ex_sec: Optional[int] = None) -> bool:
        async with self._lock:
            self._kv[key] = value
            if ex_sec:
                self._expires[key] = time.time() + ex_sec
            else:
                self._expires.pop(key, None)
            return True

    async def delete(self, key: str) -> bool:
        async with self._lock:
            existed = key in self._kv or key in self._lists or key in self._zsets
            self._del_key(key)
            return existed

    async def expire(self, key: str, ex_sec: int) -> bool:
        async with self._lock:
            if key in self._kv or key in self._lists or key in self._zsets:
                self._expires[key] = time.time() + ex_sec
                return True
            return False

    # List (Queue) 연산
    async def lpush(self, key: str, *values: Any) -> int:
        async with self._lock:
            if self._is_expired(key):
                pass
            lst = self._lists.setdefault(key, [])
            for val in values:
                lst.insert(0, val)
            return len(lst)

    async def rpop(self, key: str) -> Optional[Any]:
        async with self._lock:
            if self._is_expired(key):
                return None
            lst = self._lists.get(key)
            if not lst:
                return None
            return lst.pop()

    async def llen(self, key: str) -> int:
        async with self._lock:
            if self._is_expired(key):
                return 0
            return len(self._lists.get(key, []))

    # Sorted Set (대기열 순번) 연산
    async def zadd(self, key: str, member: str, score: float) -> int:
        async with self._lock:
            if self._is_expired(key):
                pass
            zset = self._zsets.setdefault(key, {})
            is_new = member not in zset
            zset[member] = score
            return 1 if is_new else 0

    async def zrank(self, key: str, member: str) -> Optional[int]:
        """점수 오름차순 기준 순번 (0-indexed) 반환"""
        async with self._lock:
            if self._is_expired(key):
                return None
            zset = self._zsets.get(key)
            if not zset or member not in zset:
                return None
            sorted_members = sorted(zset.items(), key=lambda x: x[1])
            for idx, (m, _) in enumerate(sorted_members):
                if m == member:
                    return idx
            return None

    async def zrem(self, key: str, member: str) -> int:
        async with self._lock:
            if self._is_expired(key):
                return 0
            zset = self._zsets.get(key)
            if zset and member in zset:
                del zset[member]
                return 1
            return 0


# 싱글톤 인스턴스
redis_emulator = RedisEmulator()
