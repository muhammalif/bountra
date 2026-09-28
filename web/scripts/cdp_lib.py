#!/usr/bin/env python3
"""Shared CDP plumbing: launch Brave headless and speak DevTools protocol.

Playwright cannot install on macOS 13 and both browser backends were down,
so the probes talk to Brave directly. Requires the `websockets` package that
already ships inside the browser-use venv.
"""
import asyncio
import json
import os
import signal
import subprocess
import time
import urllib.request

import websockets
from websockets.asyncio.client import ClientConnection

BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
WIDTHS = [320, 375, 390, 430, 768, 1440]
DEFAULT_PATHS = ["/", "/explore", "/dashboard"]
MIN_TARGET = 44

# Any interactive control a finger has to hit.
SELECTOR = "a, button, [role=button], input:not([type=hidden]), select, textarea"

MEASURE = """(() => {
  const arr = [];
  document.querySelectorAll(%s).forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return;
    arr.push({t: (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 22),
              w: Math.round(r.width), h: Math.round(r.height)});
  });
  return {arr, of: document.documentElement.scrollWidth - document.documentElement.clientWidth};
})()""" % json.dumps(SELECTOR)


def launch(port: int) -> str:
    # A unique profile dir per port, or a leftover instance locks the shared one.
    proc = subprocess.Popen(
        [
            BRAVE,
            f"--remote-debugging-port={port}",
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--hide-scrollbars",
            f"--user-data-dir=/tmp/cdp-probe-{port}",
            "about:blank",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    deadline = time.time() + 60
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/version", timeout=2) as r:
                # Keep the process alive: the debugging port dies with it.
                # Callers clean up via /close on the browser session.
                return json.load(r)["webSocketDebuggerUrl"]
        except Exception:
            time.sleep(0.5)
    # Killing the parent leaves the renderer children holding the profile, so
    # signal the whole process group and wait for it to drain.
    try:
        os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        proc.kill()
    raise SystemExit(f"Brave did not expose a debugging port on {port} within 60s")


class Session:
    """Minimal CDP client. One socket, replies matched on their id."""

    def __init__(self, ws_url: str) -> None:
        self._id = 0
        self._ws: ClientConnection | None = None
        self._url = ws_url

    async def __aenter__(self):
        self._ws = await websockets.connect(self._url, max_size=None)
        return self

    async def __aexit__(self, *exc):
        if self._ws is not None:
            await self._ws.close()

    async def send(self, method: str, **params):
        ws = self._ws
        if ws is None:
            raise RuntimeError("session is not connected")
        self._id += 1
        await ws.send(json.dumps({"id": self._id, "method": method, "params": params}))
        while True:
            msg = json.loads(await ws.recv())
            if msg.get("id") == self._id:
                if "error" in msg:
                    raise RuntimeError(f"{method}: {msg['error']}")
                return msg.get("result", {})

    async def shutdown(self) -> None:
        """Close the browser gracefully so no renderer is left holding the profile."""
        try:
            await self.send("Browser.close")
        except Exception:
            pass


